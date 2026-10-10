import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TusUploadService, UploadStatus } from '../../../services/framework-services/tus-upload.service';
import {
  AnswerValue, PublicOption, PublicQuestion, QT, isChoice, isMatrix, jalaliDaysInMonth, numericRange,
  sortedOptions, toLatinDigits, toPersianDigits, todayJalali,
} from './take-survey.model';

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

/**
 * نمایش و ویرایش پاسخ یک سوال (همه‌ی ۱۹ نوع).
 * بدون فرم واکنشی: مقدار از والد می‌آید و هر تغییر یک AnswerValue جدید emit می‌کند (منبع واحد حقیقت).
 */
@Component({
  selector: 'ts-question-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './question-field.component.html',
  styleUrls: ['./question-field.component.css'],
})
export class QuestionFieldComponent {
  private readonly tus = inject(TusUploadService);

  readonly question = input.required<PublicQuestion>();
  readonly value = input<AnswerValue | undefined>(undefined);
  readonly error = input<string | null>(null);
  readonly index = input<number>(0);
  readonly canUpload = input<boolean>(false);
  readonly imageUrl = input<string | null>(null);
  readonly valueChange = output<AnswerValue>();

  readonly QT = QT;
  readonly months = MONTHS;
  readonly fa = toPersianDigits;
  readonly uploading = signal<{ name: string; progress: number } | null>(null);
  readonly uploadError = signal<string>('');

  readonly qid = computed(() => `q-${this.question().guid}`);
  readonly type = computed(() => this.question().questionType);
  readonly options = computed(() => sortedOptions(this.question()));
  readonly v = computed<AnswerValue>(() => this.value() ?? {});
  readonly isChoiceType = computed(() => isChoice(this.type()));
  readonly isMatrixType = computed(() => isMatrix(this.type()));

  // ── مقیاس‌ها ──
  readonly scale = computed(() => {
    const { min, max } = numericRange(this.question());
    const lo = Math.max(-100, Math.floor(min)), hi = Math.min(100, Math.ceil(max));
    const values: number[] = [];
    for (let i = lo; i <= hi && values.length < 21; i++) values.push(i);
    return values;
  });

  // ── رتبه‌بندی ──
  readonly rankingOrder = computed(() => {
    const order = this.v().ranking;
    const opts = this.options();
    if (!order?.length) return opts;
    const byGuid = new Map(opts.map(o => [o.guid, o]));
    const ordered = order.map(g => byGuid.get(g)).filter((o): o is PublicOption => !!o);
    return [...ordered, ...opts.filter(o => !order.includes(o.guid))];
  });

  // ── تاریخ شمسی ──
  private readonly today = todayJalali();
  readonly years = computed(() => {
    const ys: number[] = [];
    for (let y = this.today.y + 5; y >= this.today.y - 90; y--) ys.push(y);
    return ys;
  });
  readonly dateParts = computed(() => {
    const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(toLatinDigits(this.v().date ?? ''));
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : { y: 0, m: 0, d: 0 };
  });
  private readonly pendingDate = signal<{ y: number; m: number; d: number } | null>(null);
  readonly shownDate = computed(() => this.pendingDate() ?? this.dateParts());
  readonly days = computed(() => {
    const p = this.shownDate();
    const n = p.y && p.m ? jalaliDaysInMonth(p.y, p.m) : 31;
    return Array.from({ length: n }, (_, i) => i + 1);
  });

  // ── فایل ──
  readonly accept = computed(() => {
    const raw = this.question().allowedFileTypes ?? '';
    const list = raw.split(/[,،;\s|]+/).map(x => x.trim()).filter(Boolean)
      .map(x => (x.includes('/') || x.startsWith('.')) ? x : `.${x}`);
    return list.join(',');
  });

  // ───────────────────────── رویدادها ─────────────────────────

  private emit(patch: Partial<AnswerValue>): void {
    this.valueChange.emit({ ...this.v(), ...patch });
  }

  setText(text: string): void { this.emit({ text }); }

  setNumberText(raw: string): void {
    const latin = toLatinDigits(raw).replace(/[٫,]/g, '.').trim();
    const n = latin === '' ? null : Number(latin);
    this.emit({ number: n == null || Number.isNaN(n) ? null : n, text: raw });
  }

  setNumber(n: number): void {
    // انتخاب دوباره‌ی همان مقدار → حذف پاسخ (امکان برگشت از انتخاب اشتباه)
    this.emit({ number: this.v().number === n ? null : n });
  }

  selectOption(guid: string): void {
    this.emit({ option: guid, otherSelected: false });
  }

  selectOther(): void { this.emit({ option: null, otherSelected: true }); }

  setDropdown(guid: string): void {
    if (guid === '__other__') this.selectOther();
    else this.emit({ option: guid || null, otherSelected: false });
  }

  toggleOption(guid: string): void {
    const cur = this.v().options ?? [];
    const next = cur.includes(guid) ? cur.filter(g => g !== guid) : [...cur, guid];
    this.emit({ options: next });
  }

  isMaxReached(guid: string): boolean {
    const max = this.question().maxSelections;
    if (!max) return false;
    const count = (this.v().options?.length ?? 0) + (this.v().otherSelected ? 1 : 0);
    return count >= max && !(this.v().options ?? []).includes(guid);
  }

  toggleOtherMulti(): void { this.emit({ otherSelected: !this.v().otherSelected }); }

  setOther(text: string): void { this.emit({ other: text }); }

  setMatrix(row: string, col: string): void {
    const m = { ...(this.v().matrix ?? {}) };
    if (this.type() === QT.MatrixMultiple) {
      const set = new Set((m[row] ?? '').split(',').map(x => x.trim()).filter(Boolean));
      set.has(col) ? set.delete(col) : set.add(col);
      m[row] = [...set].join(',');
    } else {
      m[row] = m[row] === col ? '' : col;
    }
    this.emit({ matrix: m });
  }

  matrixChecked(row: string, col: string): boolean {
    const cur = this.v().matrix?.[row] ?? '';
    return this.type() === QT.MatrixMultiple ? cur.split(',').map(x => x.trim()).includes(col) : cur === col;
  }

  moveRank(i: number, dir: -1 | 1): void {
    const order = this.rankingOrder().map(o => o.guid);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    this.emit({ ranking: order });
  }

  acceptRanking(): void { this.emit({ ranking: this.rankingOrder().map(o => o.guid) }); }

  setDatePart(part: 'y' | 'm' | 'd', raw: string): void {
    const p = { ...this.shownDate(), [part]: Number(raw) || 0 };
    if (p.y && p.m && p.d > jalaliDaysInMonth(p.y, p.m)) p.d = jalaliDaysInMonth(p.y, p.m);
    if (p.y && p.m && p.d) {
      this.pendingDate.set(null);
      this.emit({ date: `${p.y}/${String(p.m).padStart(2, '0')}/${String(p.d).padStart(2, '0')}` });
    } else {
      this.pendingDate.set(p);
      if (this.v().date) this.emit({ date: '' });
    }
  }

  setToday(): void {
    const t = this.today;
    this.pendingDate.set(null);
    this.emit({ date: `${t.y}/${String(t.m).padStart(2, '0')}/${String(t.d).padStart(2, '0')}` });
  }

  clearDate(): void { this.pendingDate.set(null); this.emit({ date: '' }); }

  setTime(t: string): void { this.emit({ date: t }); }

  async onFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploadError.set('');
    const q = this.question();
    if (q.maxFileSize && file.size > q.maxFileSize * 1024 * 1024) {
      this.uploadError.set(`حجم فایل بیش از ${this.fa(q.maxFileSize)} مگابایت است.`);
      return;
    }
    const allowed = (q.allowedFileTypes ?? '').split(/[,،;\s|]+/).map(x => x.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (allowed.length && !allowed.some(a => a.includes('/')) && !allowed.includes(ext)) {
      this.uploadError.set(`فقط این قالب‌ها مجاز است: ${allowed.join('، ')}`);
      return;
    }
    const [item] = this.tus.addFiles([file], { localPreview: false });
    if (!item) { this.uploadError.set('فایل قابل افزودن نیست.'); return; }
    this.uploading.set({ name: file.name, progress: 0 });
    const timer = setInterval(() => {
      const cur = this.tus.filesMap().get(item.id);
      if (cur) this.uploading.set({ name: file.name, progress: cur.progress });
    }, 300);
    try {
      const guid = await this.tus.uploadFile(item.id, { folderPath: 'surveys/responses' });
      const state = this.tus.filesMap().get(item.id);
      if (!guid || state?.status === UploadStatus.Failed) throw new Error(state?.errorMessage || 'upload');
      this.emit({ file: { url: guid, name: file.name, size: file.size } });
    } catch {
      this.uploadError.set('بارگذاری فایل انجام نشد. دوباره تلاش کنید.');
    } finally {
      clearInterval(timer);
      this.tus.removeFile(item.id);
      this.uploading.set(null);
    }
  }

  removeFile(): void { this.emit({ file: null }); }

  formatSize(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${this.fa(Math.max(1, Math.round(bytes / 1024)))} کیلوبایت`;
    return `${this.fa((bytes / 1024 / 1024).toFixed(1))} مگابایت`;
  }

  npsTone(n: number): string { return n <= 6 ? 'low' : n <= 8 ? 'mid' : 'high'; }
}
