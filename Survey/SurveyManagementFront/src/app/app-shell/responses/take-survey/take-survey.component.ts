import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, OnInit, computed, effect, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { TusUploadService } from '../../../services/framework-services/tus-upload.service';
import { CompletionEffectComponent } from '../../../shared/completion-effect/completion-effect.component';
import { QuestionFieldComponent } from './question-field.component';
import { SurveyApiError, TakeSurveyApi } from './take-survey.api';
import {
  AnswerValue, PublicCriterion, PublicQuestion, PublicSurvey, SavedAnswer, UserDraft, fromSaved, isFilled,
  relevantQuestionGuids, toDto, toPersianDigits, validateAnswer,
} from './take-survey.model';

type Phase = 'loading' | 'error' | 'blocked' | 'welcome' | 'survey' | 'submitting' | 'thankyou';
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'failed' | 'local';

interface Section { key: string; title: string; description?: string | null; questions: PublicQuestion[]; }
interface Page { key: string; section: Section; questions: PublicQuestion[]; }

const SLIDE = 1;
const AUTOSAVE_DELAY = 1200;
const LOCAL_PREFIX = 'survey.local-draft.';

/**
 * صفحه‌ی شرکت در نظرسنجی (بازطراحی کامل).
 * ─────────────────────────────────────────────────────────────────────────
 * ✅ ذخیره‌ی خودکار: کاربر واردشده روی سرور (SaveDraft)، کاربر ناشناس در همین مرورگر.
 *    کاربر می‌تواند بخشی را پاسخ دهد، برود و بعداً دقیقاً از همان سوال ادامه دهد.
 * ✅ منطق شرطی (نمایش/پنهان/پرش/پایان) اجرا می‌شود و با سرور یکسان است.
 * ✅ نمی‌توان با نقشه‌ی سوال‌ها از سوال اجباری عبور کرد؛ ثبت ناموفق هرگز صفحه‌ی تشکر نشان نمی‌دهد.
 * ✅ گام‌ها (معیارها) به‌صورت مرحله‌ای با نوار پیشرفت؛ پیام‌های خوش‌آمد/تشکر بدون دور زدن پاک‌سازی HTML.
 */
@Component({
  selector: 'app-take-survey',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, QuestionFieldComponent, CompletionEffectComponent],
  templateUrl: './take-survey.component.html',
  styleUrls: ['./take-survey.component.css'],
})
export class TakeSurveyComponent implements OnInit {
  private readonly api = inject(TakeSurveyApi);
  private readonly auth = inject(AuthService);
  private readonly tus = inject(TusUploadService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly fa = toPersianDigits;

  // ── وضعیت ──
  readonly phase = signal<Phase>('loading');
  readonly message = signal('');
  readonly survey = signal<PublicSurvey | null>(null);
  readonly answers = signal<ReadonlyMap<string, AnswerValue>>(new Map());
  readonly errors = signal<ReadonlyMap<string, string>>(new Map());
  readonly pageIndex = signal(0);
  readonly maxReached = signal(0);
  readonly draft = signal<{ progress: number; savedAt?: string; resumeGuid?: string | null } | null>(null);
  readonly saveState = signal<SaveState>('idle');
  readonly savedAt = signal('');
  readonly submitError = signal('');
  readonly sendAnonymously = signal(false);
  readonly logoUrl = signal<string | null>(null);
  readonly imageUrls = signal<ReadonlyMap<string, string>>(new Map());
  readonly direction = signal<'next' | 'prev'>('next');

  readonly loggedIn = signal(false);
  private surveyGuid = '';
  private readonly dirty = new Set<string>();
  private saveTimer?: ReturnType<typeof setTimeout>;
  private saving?: Promise<void>;

  // ── ساختار ──
  readonly sections = computed<Section[]>(() => {
    const s = this.survey();
    if (!s) return [];
    const qs = s.questions;
    if (!s.criteria?.length) return [{ key: '__all__', title: '', questions: qs }];
    const byCriterion = (c: PublicCriterion) => qs.filter(q => q.criterionGuid?.toLowerCase() === c.guid.toLowerCase());
    const list: Section[] = [...s.criteria].sort((a, b) => a.sortOrder - b.sortOrder)
      .map(c => ({ key: c.guid, title: c.title, description: c.description, questions: byCriterion(c) }));
    const known = new Set(s.criteria.map(c => c.guid.toLowerCase()));
    const rest = qs.filter(q => !q.criterionGuid || !known.has(q.criterionGuid.toLowerCase()));
    if (rest.length) list.push({ key: '__rest__', title: 'سایر سوالات', questions: rest });
    return list.filter(x => x.questions.length);
  });

  readonly hasSteps = computed(() => !!this.survey()?.criteria?.length && this.sections().length > 1);
  readonly isSlide = computed(() => this.survey()?.showType === SLIDE);

  readonly relevant = computed(() => relevantQuestionGuids(this.survey()?.questions ?? [], this.answers()));

  /** صفحات: اسلایدی با گام → هر گام یک صفحه؛ اسلایدی بدون گام → هر سوال یک صفحه؛ یک‌صفحه‌ای → یک صفحه */
  readonly pages = computed<Page[]>(() => {
    const sections = this.sections();
    const rel = this.relevant();
    const pages: Page[] = [];
    if (!this.isSlide()) {
      const all = sections.flatMap(s => s.questions.filter(q => rel.has(q.guid)));
      if (all.length) pages.push({ key: 'all', section: { key: 'all', title: '', questions: all }, questions: all });
      return pages;
    }
    for (const s of sections) {
      const qs = s.questions.filter(q => rel.has(q.guid));
      if (!qs.length) continue;
      if (this.hasSteps()) pages.push({ key: s.key, section: s, questions: qs });
      else qs.forEach(q => pages.push({ key: q.guid, section: s, questions: [q] }));
    }
    return pages;
  });

  readonly page = computed(() => this.pages()[Math.min(this.pageIndex(), Math.max(0, this.pages().length - 1))]);
  readonly isFirst = computed(() => this.pageIndex() === 0);
  readonly isLast = computed(() => this.pageIndex() >= this.pages().length - 1);

  /** برای یک‌صفحه‌ای با گام: سوال‌های صفحه به تفکیک گام */
  readonly pageGroups = computed(() => {
    const p = this.page();
    if (!p) return [];
    if (this.isSlide() || !this.hasSteps()) return [{ section: p.section, questions: p.questions }];
    const set = new Set(p.questions.map(q => q.guid));
    return this.sections().map(s => ({ section: s, questions: s.questions.filter(q => set.has(q.guid)) })).filter(g => g.questions.length);
  });

  readonly numbering = computed(() => {
    const map = new Map<string, number>();
    let i = 0;
    for (const s of this.sections()) for (const q of s.questions) if (this.relevant().has(q.guid)) map.set(q.guid, ++i);
    return map;
  });

  readonly relevantQuestions = computed(() => (this.survey()?.questions ?? []).filter(q => this.relevant().has(q.guid)));
  readonly answeredCount = computed(() => this.relevantQuestions().filter(q => isFilled(q, this.answers().get(q.guid))).length);
  readonly progress = computed(() => {
    const total = this.relevantQuestions().length;
    return total ? Math.round(this.answeredCount() * 100 / total) : 0;
  });

  /** نقشه‌ی گام‌ها (فقط حالت اسلایدی) */
  readonly steps = computed(() => {
    if (!this.isSlide()) return [];
    return this.pages().map((p, i) => {
      const done = p.questions.every(q => !validateAnswer(q, this.answers().get(q.guid)));
      const answered = p.questions.filter(q => isFilled(q, this.answers().get(q.guid))).length;
      return { index: i, title: this.hasSteps() ? p.section.title : this.fa(i + 1), done, answered, total: p.questions.length };
    });
  });

  readonly estimatedMinutes = computed(() => Math.max(1, Math.round((this.survey()?.questions.length ?? 0) * 0.35)));
  readonly canSendAnonymously = computed(() => !!this.survey()?.allowAnonymous && this.loggedIn());
  readonly needsLoginForFiles = computed(() => !this.loggedIn());

  constructor() {
    // پیش‌نویس ناشناس پس از هر تغییر در مرورگر ذخیره می‌شود
    effect(() => {
      const answers = this.answers();
      if (this.phase() !== 'survey' || this.loggedIn() || !this.surveyGuid) return;
      this.writeLocal(answers);
    });
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.saveTimer);
      void this.flush();
    });
  }

  ngOnInit(): void {
    this.surveyGuid = this.route.snapshot.paramMap.get('surveyGuid') ?? '';
    void this.load();
  }

  // ───────────────────────── بارگذاری ─────────────────────────

  private async load(): Promise<void> {
    this.phase.set('loading');
    if (!/^[0-9a-f-]{36}$/i.test(this.surveyGuid)) return this.fail('نشانی نظرسنجی معتبر نیست.');
    this.loggedIn.set(this.auth.isAuthenticated());

    let survey: PublicSurvey;
    try {
      survey = await firstValueFrom(this.api.getSurvey(this.surveyGuid).pipe(timeout(30000)));
    } catch (e) {
      return this.block(e instanceof SurveyApiError ? e.message : 'بارگذاری نظرسنجی انجام نشد. اتصال را بررسی و دوباره تلاش کنید.', !(e instanceof SurveyApiError));
    }
    if (survey.isFull) return this.block('ظرفیت این نظرسنجی تکمیل شده است.');
    this.survey.set(survey);
    this.applyTheme(survey.themeColor);
    void this.loadImages(survey);

    if (this.loggedIn()) {
      try {
        const status = await firstValueFrom(this.api.getStatus(this.surveyGuid).pipe(timeout(20000)));
        if (status && !status.canRespond) return this.block('شما قبلاً در این نظرسنجی شرکت کرده‌اید. از همراهی شما سپاسگزاریم.', false, 'done');
        if (status?.hasDraft) {
          const draft = await firstValueFrom(this.api.getDraft(this.surveyGuid).pipe(timeout(20000)));
          if (draft) this.applyDraft(draft);
        }
      } catch { /* وضعیت/پیش‌نویس اختیاری است؛ ثبت نهایی دوباره بررسی می‌شود */ }
    } else {
      this.readLocal();
    }
    this.phase.set('welcome');
  }

  private applyDraft(draft: UserDraft): void {
    this.restoreAnswers(draft.savedAnswers ?? []);
    this.draft.set({ progress: Math.round(draft.progressPercentage ?? 0), savedAt: draft.lastSavedAt, resumeGuid: draft.resumeQuestionGuid });
  }

  private restoreAnswers(saved: SavedAnswer[]): void {
    const byGuid = new Map((this.survey()?.questions ?? []).map(q => [q.guid.toLowerCase(), q]));
    const map = new Map<string, AnswerValue>();
    for (const s of saved) {
      const q = byGuid.get(String(s.questionGuid).toLowerCase());
      if (q) map.set(q.guid, fromSaved(q, s));
    }
    this.answers.set(map);
  }

  private fail(msg: string): void { this.message.set(msg); this.phase.set('error'); }

  readonly blockKind = signal<'info' | 'done' | 'retry'>('info');
  private block(msg: string, retry = false, kind: 'info' | 'done' = 'info'): void {
    this.message.set(msg);
    this.blockKind.set(retry ? 'retry' : kind);
    this.phase.set('blocked');
  }

  retry(): void { void this.load(); }

  login(): void {
    void this.auth.login(`/survey/take/${this.surveyGuid}`);
  }

  // ───────────────────────── شروع / ادامه ─────────────────────────

  start(resume: boolean): void {
    if (!resume && this.answers().size) {
      this.answers.set(new Map());
      this.draft.set(null);
      if (this.loggedIn()) this.api.discardDraft(this.surveyGuid).subscribe({ error: () => void 0 });
      else this.clearLocal();
    }
    let index = 0;
    if (resume) {
      const target = this.draft()?.resumeGuid?.toLowerCase()
        ?? this.relevantQuestions().find(q => !isFilled(q, this.answers().get(q.guid)))?.guid.toLowerCase();
      const found = target ? this.pages().findIndex(p => p.questions.some(q => q.guid.toLowerCase() === target)) : -1;
      index = found >= 0 ? found : Math.max(0, this.pages().length - 1);
    }
    this.pageIndex.set(index);
    this.maxReached.set(index);
    this.phase.set('survey');
    this.focusPage();
    const resumeGuid = this.draft()?.resumeGuid;
    if (resume && resumeGuid && !(this.isSlide() && !this.hasSteps())) this.scrollToQuestion(resumeGuid);
  }

  // ───────────────────────── پاسخ‌ها ─────────────────────────

  answerOf(q: PublicQuestion): AnswerValue | undefined { return this.answers().get(q.guid); }
  errorOf(q: PublicQuestion): string | null { return this.errors().get(q.guid) ?? null; }
  imageOf(q: PublicQuestion): string | null { return q.imageUrl ? this.imageUrls().get(q.imageUrl.toLowerCase()) ?? null : null; }

  onAnswer(q: PublicQuestion, value: AnswerValue): void {
    const next = new Map(this.answers());
    next.set(q.guid, value);
    this.answers.set(next);
    if (this.errors().has(q.guid)) {
      const errs = new Map(this.errors());
      const msg = validateAnswer(q, value);
      msg ? errs.set(q.guid, msg) : errs.delete(q.guid);
      this.errors.set(errs);
    }
    this.dirty.add(q.guid);
    this.scheduleSave();
  }

  // ───────────────────────── ذخیره‌ی خودکار ─────────────────────────

  private scheduleSave(): void {
    if (!this.loggedIn()) { this.saveState.set('local'); return; }
    this.saveState.set('pending');
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), AUTOSAVE_DELAY);
  }

  /** ارسال پاسخ‌های تغییرکرده به سرور (پشت‌سرهم، بدون هم‌پوشانی) */
  flush(): Promise<void> {
    clearTimeout(this.saveTimer);
    if (!this.loggedIn() || !this.dirty.size || this.phase() === 'thankyou') return this.saving ?? Promise.resolve();
    const run = async () => {
      if (this.saving) await this.saving.catch(() => void 0);
      const guids = [...this.dirty];
      this.dirty.clear();
      const byGuid = new Map((this.survey()?.questions ?? []).map(q => [q.guid, q]));
      const dtos = guids.map(g => byGuid.get(g)).filter((q): q is PublicQuestion => !!q)
        .map(q => {
          const v = this.answers().get(q.guid);
          // مقدار نامعتبر (مثلاً ایمیل نیمه‌تمام) ذخیره نمی‌شود تا سرور کل درخواست را رد نکند
          return validateAnswer({ ...q, isRequired: false }, v) ? null : toDto(q, v);
        })
        .filter(d => !!d);
      if (!dtos.length) { this.saveState.set('saved'); return; }
      this.saveState.set('saving');
      try {
        const res = await firstValueFrom(this.api.saveDraft(this.surveyGuid, dtos as any).pipe(timeout(20000)));
        this.savedAt.set(new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
        this.saveState.set(this.dirty.size ? 'pending' : 'saved');
        void res;
      } catch {
        guids.forEach(g => this.dirty.add(g));
        this.saveState.set('failed');
      }
    };
    this.saving = run().finally(() => { this.saving = undefined; });
    return this.saving;
  }

  retrySave(): void { void this.flush(); }

  /** خروج از صفحه/تغییر تب: پاسخ‌های ذخیره‌نشده فوراً ارسال می‌شوند */
  @HostListener('window:pagehide')
  onPageHide(): void { void this.flush(); }

  @HostListener('document:visibilitychange')
  onVisibility(): void { if (document.visibilityState === 'hidden') void this.flush(); }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.phase() === 'survey' && this.loggedIn() && (this.dirty.size || this.saveState() === 'saving')) {
      void this.flush();
      e.preventDefault();
    }
  }

  private localKey(): string { return `${LOCAL_PREFIX}${this.surveyGuid.toLowerCase()}`; }

  private writeLocal(answers: ReadonlyMap<string, AnswerValue>): void {
    try {
      const qs = new Map((this.survey()?.questions ?? []).map(q => [q.guid, q]));
      const saved = [...answers.entries()].map(([g, v]) => qs.get(g) ? toDto(qs.get(g)!, v) : null)
        .filter(d => d && !d.isSkipped);
      localStorage.setItem(this.localKey(), JSON.stringify({ at: Date.now(), page: this.pageIndex(), answers: saved }));
      this.saveState.set('local');
    } catch { /* حافظه‌ی مرورگر در دسترس نیست */ }
  }

  private readLocal(): void {
    try {
      const raw = localStorage.getItem(this.localKey());
      if (!raw) return;
      const data = JSON.parse(raw) as { at: number; answers: SavedAnswer[] };
      // پیش‌نویس محلی قدیمی‌تر از ۳۰ روز نگه داشته نمی‌شود
      if (!data?.answers?.length || Date.now() - data.at > 30 * 86_400_000) { this.clearLocal(); return; }
      this.restoreAnswers(data.answers);
      this.draft.set({ progress: this.progress(), savedAt: new Date(data.at).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) });
    } catch { this.clearLocal(); }
  }

  private clearLocal(): void { try { localStorage.removeItem(this.localKey()); } catch { /* */ } }

  // ───────────────────────── پیمایش ─────────────────────────

  private validatePage(page: Page | undefined): boolean {
    if (!page) return true;
    const errs = new Map(this.errors());
    let firstInvalid: string | null = null;
    for (const q of page.questions) {
      const msg = validateAnswer(q, this.answers().get(q.guid));
      if (msg) { errs.set(q.guid, msg); firstInvalid ??= q.guid; }
      else errs.delete(q.guid);
    }
    this.errors.set(errs);
    if (firstInvalid) this.scrollToQuestion(firstInvalid);
    return !firstInvalid;
  }

  next(): void {
    if (!this.validatePage(this.page())) return;
    void this.flush();
    if (this.isLast()) { void this.submit(); return; }
    this.go(this.pageIndex() + 1);
  }

  prev(): void { if (!this.isFirst()) this.go(this.pageIndex() - 1); }

  /** پرش از نقشه: فقط به گام‌های قبلی یا تا اولین گام ناقص (عبور از سوال اجباری ممکن نیست) */
  jump(i: number): void {
    if (i === this.pageIndex()) return;
    if (i > this.pageIndex()) {
      for (let k = this.pageIndex(); k < i; k++) {
        if (!this.pages()[k].questions.every(q => !validateAnswer(q, this.answers().get(q.guid)))) {
          this.go(k);
          setTimeout(() => this.validatePage(this.pages()[k]));
          return;
        }
      }
    }
    this.go(i);
  }

  canJump(i: number): boolean {
    if (i <= this.pageIndex()) return true;
    return this.pages().slice(0, i).every(p => p.questions.every(q => !validateAnswer(q, this.answers().get(q.guid))));
  }

  private go(i: number): void {
    this.direction.set(i > this.pageIndex() ? 'next' : 'prev');
    this.pageIndex.set(Math.max(0, Math.min(i, this.pages().length - 1)));
    this.maxReached.update(m => Math.max(m, this.pageIndex()));
    this.focusPage();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (this.phase() !== 'survey' || !this.isSlide() || e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    const el = e.target as HTMLElement;
    if (el?.closest('textarea, button, select, a, [role="radio"], label')) return;
    e.preventDefault();
    this.next();
  }

  private focusPage(): void {
    setTimeout(() => {
      const root = this.host.nativeElement as HTMLElement;
      root.querySelector('.ts-main')?.scrollIntoView({ behavior: this.motion(), block: 'start' });
      (root.querySelector('.ts-page__title, .ts-page') as HTMLElement | null)?.focus({ preventScroll: true });
    });
  }

  private scrollToQuestion(guid: string): void {
    setTimeout(() => {
      const el = (this.host.nativeElement as HTMLElement).querySelector(`[data-q="${CSS.escape(guid)}"]`) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: this.motion(), block: 'center' });
      (el.querySelector('input:not([type=hidden]), textarea, select, button') as HTMLElement | null)?.focus({ preventScroll: true });
    }, 50);
  }

  private motion(): ScrollBehavior {
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  // ───────────────────────── ثبت نهایی ─────────────────────────

  async submit(): Promise<void> {
    const s = this.survey();
    if (!s || this.phase() === 'submitting') return;
    // اعتبارسنجی همه‌ی صفحات؛ رفتن به اولین صفحه‌ی ناقص
    const bad = this.pages().findIndex(p => !p.questions.every(q => !validateAnswer(q, this.answers().get(q.guid))));
    if (bad >= 0) {
      this.go(bad);
      setTimeout(() => this.validatePage(this.pages()[bad]));
      return;
    }
    this.submitError.set('');
    this.phase.set('submitting');
    clearTimeout(this.saveTimer);
    if (this.saving) await this.saving.catch(() => void 0);

    const rel = this.relevant();
    const dtos = s.questions.filter(q => rel.has(q.guid)).map(q => toDto(q, this.answers().get(q.guid)));
    const anonymous = this.loggedIn() ? (s.allowAnonymous && this.sendAnonymously()) : s.allowAnonymous;
    try {
      await firstValueFrom(this.api.submit(s.guid, anonymous, dtos).pipe(timeout(60000)));
      this.dirty.clear();
      this.clearLocal();
      this.phase.set('thankyou');
      window.scrollTo({ top: 0, behavior: this.motion() });
    } catch (e) {
      // ✅ ثبت ناموفق: پاسخ‌ها حفظ می‌شوند و پیام واقعی نمایش داده می‌شود (نه صفحه‌ی تشکر)
      this.submitError.set(e instanceof SurveyApiError ? e.message : 'ارسال پاسخ‌ها انجام نشد. اتصال را بررسی و دوباره تلاش کنید؛ پاسخ‌های شما حفظ شده است.');
      this.phase.set('survey');
    }
  }

  respondAgain(): void {
    this.answers.set(new Map());
    this.errors.set(new Map());
    this.draft.set(null);
    this.pageIndex.set(0);
    this.maxReached.set(0);
    this.phase.set('welcome');
  }

  goHome(): void { void this.router.navigateByUrl('/dashboard'); }

  // ───────────────────────── ظاهر ─────────────────────────

  private applyTheme(color: string | null | undefined): void {
    const el = this.host.nativeElement as HTMLElement;
    if (!color || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color.trim())) return;
    el.style.setProperty('--ts-primary', color.trim());
  }

  private async loadImages(s: PublicSurvey): Promise<void> {
    const guids = [s.logoGuid, ...s.questions.map(q => q.imageUrl)].filter((g): g is string => !!g);
    if (!guids.length || !this.loggedIn()) return;   // دریافت فایل نیازمند ورود است
    try {
      const map = await this.tus.getFilePreviewUrls(guids);
      if (s.logoGuid) this.logoUrl.set(map.get(s.logoGuid.toLowerCase()) ?? null);
      this.imageUrls.set(map);
    } catch { /* تصویر اختیاری است */ }
  }
}

