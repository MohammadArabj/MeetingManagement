import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  DestroyRef,
  HostListener,
  ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin, catchError, of, interval, Subscription } from 'rxjs';
import { TusUploadService } from '../../../services/framework-services/tus-upload.service';
import {
  QuestionService,
  QuestionDetailDto,
} from '../../../services/question.service';
import {
  ResponseService,
  SubmitAnswerDto,
  SubmitResponseDto,
} from '../../../services/response.service';
import {
  SurveyService,
  SurveyDetailDto,
} from '../../../services/survey.service';
import { AppSharedDataComponent } from '../../../shared/app-shared-data/app-shared-data';
import { USER_ID_NAME } from '../../../core/types/configuration';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface TakeSurveyQuestionGroup {
  key: string;
  title: string;
  description?: string;
  questions: QuestionDetailDto[];
}
/** فازهای مختلف صفحه نظرسنجی */
type SurveyPhase =
  | 'loading'
  | 'welcome'
  | 'survey'
  | 'submitting'
  | 'thankyou'
  | 'error'
  | 'blocked';

/** نتیجه validation یک فیلد */
interface ValidationResult {
  valid: boolean;
  message: string;
}
type BlockReason = 'alreadyAnswered' | 'full' | 'notStarted' | 'ended' | null;
// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

@Component({
  selector: 'app-take-survey',
  templateUrl: './take-survey.component.html',
  styleUrls: ['./take-survey.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
})
export class TakeSurveyComponent
  extends AppSharedDataComponent
  implements OnInit, OnDestroy {
  // ==================== Services ====================

  private readonly surveyService = inject(SurveyService);
  private readonly questionService = inject(QuestionService);
  private readonly responseService = inject(ResponseService);
  private readonly tusUploadService = inject(TusUploadService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef);
  private readonly sanitizer = inject(DomSanitizer);

  // ==================== Constants ====================

  readonly DisplayType = { slide: 1, onePage: 2 };

  readonly QuestionType = {
    TEXT: 3,
    LONG_TEXT: 4,
    MULTIPLE_CHOICE: 1,
    CHECKBOX: 2,
    DROPDOWN: 10,
    RATING: 5,
    DATE: 8,
    FILE_UPLOAD: 9,
    MATRIX: 11,
  };

  private readonly VALIDATION_PATTERNS: Record<number, RegExp> = {
    1: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    2: /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
    3: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/,
  };

  private readonly VALIDATION_MESSAGES: Record<number, string> = {
    1: 'آدرس ایمیل معتبر نیست',
    2: 'شماره تلفن معتبر نیست',
    3: 'آدرس URL معتبر نیست',
    4: 'مقدار وارد شده با فرمت مورد انتظار مطابقت ندارد',
  };
  /**
 * تبدیل تاریخ شمسی (فرمت "1405/06/23") به Date میلادی.
 * الگوریتم استاندارد تبدیل جلالی → گرگوری.
 */
  private jalaliToGregorian(jalaliStr: string): Date | null {
    if (!jalaliStr) return null;
    const parts = jalaliStr.split(/[\/\-]/).map(p => parseInt(p, 10));
    if (parts.length !== 3 || parts.some(isNaN)) return null;

    let [jy, jm, jd] = parts;

    jy += 1595;
    let days =
      -355668 +
      365 * jy +
      Math.floor(jy / 33) * 8 +
      Math.floor(((jy % 33) + 3) / 4) +
      jd +
      (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

    let gy = 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      gy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }

    let gd = days + 1;
    const gDaysInMonth = [31, (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 0;
    while (gm < 12 && gd > gDaysInMonth[gm]) {
      gd -= gDaysInMonth[gm];
      gm++;
    }

    return new Date(gy, gm, gd);
  }
  /**
   * بررسی وضعیت زمانی نظرسنجی قبل از ورود کاربر به فرم.
   * نکته: input[type=date] در فرم ویزارد همیشه مقدار ISO (yyyy-MM-dd) تولید می‌کند،
   * صرف‌نظر از تقویمی که به کاربر نمایش داده می‌شود، پس new Date() اینجا امن است.
   */
  private checkSurveyTiming(survey: any): { ok: boolean; reason: BlockReason } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (survey.startDate) {
      const start = this.jalaliToGregorian(survey.startDate);
      if (start) {
        start.setHours(0, 0, 0, 0);
        if (today < start) return { ok: false, reason: 'notStarted' };
      }
    }

    if (survey.endDate) {
      const end = this.jalaliToGregorian(survey.endDate);
      if (end) {
        end.setHours(0, 0, 0, 0);
        if (today > end) return { ok: false, reason: 'ended' };
      }
    }

    if (survey.maxResponses && survey.totalResponses >= survey.maxResponses) {
      return { ok: false, reason: 'full' };
    }

    return { ok: true, reason: null };
  }
  // ==================== Signals ====================

  readonly phase = signal<SurveyPhase>('loading');
  readonly surveyGuid = signal<string>('');
  /** فقط بعد از ثبت نهایی پر می‌شود؛ برای resume/draft استفاده نمی‌شود */
  readonly responseGuid = signal<string | null>(null);
  readonly currentQuestionIndex = signal<number>(0);
  readonly survey = signal<SurveyDetailDto | null>(null);
  readonly questions = signal<QuestionDetailDto[]>([]);
  readonly answers = signal<Map<string, SubmitAnswerDto>>(new Map());
  readonly errorMessage = signal<string>('');
  readonly slideDirection = signal<'next' | 'prev'>('next');
  readonly elapsedSeconds = signal<number>(0);
  readonly invalidQuestionGuids = signal<Set<string>>(new Set());
  readonly currentValidationError = signal<string>('');
  readonly logoUrl = signal<string | null>(null);
  readonly backgroundImageUrl = signal<string | null>(null);
  readonly blockReason = signal<BlockReason>(null);
  readonly hasCriteria = computed(() => {
    const s = this.survey() as any;
    return !!s?.hasCriteria && !!s?.criteria?.length;
  });

  readonly questionGroups = computed<TakeSurveyQuestionGroup[]>(() => {
    const s = this.survey() as any;
    const qs = this.questions();

    if (!this.hasCriteria()) {
      return [{ key: '__all__', title: '', questions: qs }];
    }

    const criteria = [...(s.criteria ?? [])].sort(
      (a: any, b: any) => a.sortOrder - b.sortOrder
    );

    const groups: TakeSurveyQuestionGroup[] = criteria.map((c: any) => ({
      key: c.guid,
      title: c.title,
      description: c.description,
      questions: qs.filter((q) => (q as any).criterionGuid === c.guid),
    }));

    const unassigned = qs.filter((q) => !(q as any).criterionGuid);
    if (unassigned.length > 0) {
      groups.push({ key: '__none__', title: 'سایر سوالات', questions: unassigned });
    }

    return groups.filter((g) => g.questions.length > 0);
  });

  readonly currentGroupIndex = signal<number>(0);
  readonly totalGroups = computed(() => this.questionGroups().length);
  readonly currentGroup = computed(() => this.questionGroups()[this.currentGroupIndex()]);
  readonly isFirstGroup = computed(() => this.currentGroupIndex() === 0);
  readonly isLastGroup = computed(() => this.currentGroupIndex() === this.totalGroups() - 1);
  // ==================== Computed ====================

  readonly totalQuestions = computed(() => this.questions().length);

  readonly currentQuestion = computed(
    () => this.questions()[this.currentQuestionIndex()]
  );

  readonly isFirstQuestion = computed(() => this.currentQuestionIndex() === 0);

  readonly isLastQuestion = computed(
    () => this.currentQuestionIndex() === this.totalQuestions() - 1
  );

  readonly progress = computed(() => {
    if (this.hasCriteria() && this.isSlideMode()) {
      const total = this.totalGroups();
      if (total === 0) return 0;
      return Math.round(((this.currentGroupIndex() + 1) / total) * 100);
    }
    const total = this.totalQuestions();
    if (total === 0) return 0;
    return Math.round(((this.currentQuestionIndex() + 1) / total) * 100);
  });

  readonly isSlideMode = computed(
    () => this.survey()?.showType === this.DisplayType.slide
  );

  readonly formattedTime = computed(() => {
    const s = this.elapsedSeconds();
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  });

  readonly welcomeMessageHtml = computed<SafeHtml | null>(() => {
    const msg = this.survey()?.welcomeMessage;
    return msg ? this.sanitizer.bypassSecurityTrustHtml(msg) : null;
  });

  readonly thankYouMessageHtml = computed<SafeHtml | null>(() => {
    const msg = this.survey()?.thankYouMessage;
    return msg ? this.sanitizer.bypassSecurityTrustHtml(msg) : null;
  });

  // ==================== Form ====================

  answerForm!: FormGroup;
  surveyForm!: FormArray;

  get surveyControls(): FormGroup[] {
    return (this.surveyForm?.controls as FormGroup[]) ?? [];
  }

  // ==================== Timer ====================

  private timerSub?: Subscription;

  // ==================== Constructor ====================

  constructor() {
    super();
    this.initForm();
    this.surveyForm = this.fb.array([]);
  }

  // ==================== Keyboard Navigation ====================

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (this.phase() !== 'survey' || !this.isSlideMode()) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA') return;
      e.preventDefault();
      this.nextQuestion();
    }
  }

  // ==================== Lifecycle ====================

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const guid = params.get('surveyGuid');
        if (guid) {
          this.surveyGuid.set(guid);
          this.loadSurveyData();
        } else {
          this.phase.set('error');
          this.errorMessage.set('شناسه نظرسنجی معتبر نیست.');
        }
      });
  }

  ngOnDestroy(): void {
    this.timerSub?.unsubscribe();
  }

  // ==================== Data Loading ====================

  /**
   * بارگذاری همزمان اطلاعات نظرسنجی و سوالات.
   * دیگر پیش‌نویسی برای resume خوانده نمی‌شود — بک‌اند از آن پشتیبانی نمی‌کند.
   * تنها چیزی که بررسی می‌شود این است که آیا کاربر (شناخته‌شده) قبلاً
   * پاسخ کامل داده یا نه — که در نهایت هم دوباره سمت سرور، حین ثبت، چک می‌شود.
   */
  private loadSurveyData(): void {
    this.phase.set('loading');

    const guid = this.surveyGuid();
    const userGuid = this.getCurrentUserGuid();

    // ✅ وضعیت پاسخ‌دهی قبلی کاربر — فقط برای پیام «قبلاً پاسخ داده‌اید» در UI،
    // چک واقعی و قطعی همچنان سمت بک‌اند حین ثبت انجام می‌شود.
    const userStatus$ = userGuid
      ? this.responseService
        .getUserResponseStatus(guid, userGuid)
        .pipe(catchError(() => of(null)))
      : of(null);

    forkJoin({
      survey: this.surveyService.getDetail(guid),
      questions: this.questionService.getQuestionsForResponse(guid, true),
      userStatus: userStatus$,
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error) => {
          console.error('Error loading survey:', error);
          this.phase.set('error');
          this.errorMessage.set(
            'خطا در بارگذاری نظرسنجی. لطفاً دوباره تلاش کنید.'
          );
          return of(null);
        })
      )
      .subscribe(async (result) => {
        if (!result) return;

        this.survey.set(result.survey);
        this.applyTheme(result.survey);
        await this.loadSurveyImages(result.survey);

        const survey = result.survey as any;

        // ✅ بررسی وضعیت زمانی نظرسنجی — قبل از این‌که کاربر وارد فرم بشه
        const timing = this.checkSurveyTiming(survey);
        if (!timing.ok) {
          this.blockReason.set(timing.reason);
          this.phase.set('blocked');
          return;
        }

        // قبلاً پاسخ کامل داده و پاسخ‌دهی مجدد مجاز نیست
        if (
          !survey.allowMultipleResponses &&
          result.userStatus?.hasParticipated
        ) {
          this.blockReason.set('alreadyAnswered');
          this.phase.set('blocked');
          return;
        }

        // ─── randomize اگه لازم باشه ───
        let questions = result.questions;
        if ((result.survey as any).randomizeQuestions) {
          questions = this.shuffleArray([...questions]);
        }
        questions = questions.map((q) => {
          if ((q as any).randomizeOptions && q.options?.length) {
            return { ...q, options: this.shuffleArray([...q.options]) };
          }
          return q;
        });

        this.questions.set(questions);

        // ─── ساخت فرم برای تمام سوالات ───
        this.surveyForm = this.fb.array([]);
        questions.forEach((q) =>
          this.surveyForm.push(this.createQuestionFormGroup(q))
        );

        if (questions.length > 0) {
          this.setupAnswerFormForQuestion(questions[0]);
        }

        this.phase.set('welcome');
      });
  }

  /**
   * بررسی می‌کند آیا یک پاسخ واقعاً پر شده یا خالی است.
   * برای نمایش وضعیت پیشرفت (نقطه‌های نقشه سوالات) استفاده می‌شود.
   */
  private isAnswerFilled(
    answer: SubmitAnswerDto,
    question: QuestionDetailDto
  ): boolean {
    switch (question.questionType) {
      case this.QuestionType.TEXT:
      case this.QuestionType.LONG_TEXT:
        return !!answer.textAnswer?.trim();

      case this.QuestionType.MULTIPLE_CHOICE:
      case this.QuestionType.DROPDOWN:
        return !!answer.selectedOptionGuid || !!answer.otherAnswer?.trim();

      case this.QuestionType.CHECKBOX:
        return (
          !!(answer.selectedOptionGuids?.length) ||
          !!answer.otherAnswer?.trim()
        );

      case this.QuestionType.RATING:
        return answer.numericAnswer != null;

      case this.QuestionType.DATE:
        return !!answer.dateAnswer;

      case this.QuestionType.FILE_UPLOAD:
        return !!answer.fileUrl;

      case this.QuestionType.MATRIX:
        return !!(
          answer.matrixAnswers &&
          Object.keys(answer.matrixAnswers).length > 0 &&
          Object.values(answer.matrixAnswers).every((v) => !!v)
        );

      default:
        return false;
    }
  }

  /**
   * GUID کاربر جاری را از storage می‌خواند.
   * اگر کاربر لاگین نکرده باشد null برمیگرداند.
   */
  private getCurrentUserGuid(): string | null {
    const token = this.localStorageService.getItem(USER_ID_NAME);
    return token;
  }

  // ==================== Image Loading ====================

  private async loadSurveyImages(survey: SurveyDetailDto): Promise<void> {
    const logoGuid = (survey as any).logoGuid as string | undefined;
    const backgroundGuid = (survey as any).backgroundImageGuid as
      | string
      | undefined;
    const guidsToLoad = [logoGuid, backgroundGuid].filter(
      Boolean
    ) as string[];
    if (guidsToLoad.length === 0) return;

    try {
      const urlMap =
        await this.tusUploadService.getFilePreviewUrls(guidsToLoad);

      if (logoGuid) {
        this.logoUrl.set(urlMap.get(logoGuid.toLowerCase()) ?? null);
      }
      if (backgroundGuid) {
        const url = urlMap.get(backgroundGuid.toLowerCase()) ?? null;
        this.backgroundImageUrl.set(url);
        if (url) this.applyBackgroundImage(url);
      }
    } catch (error) {
      console.warn('خطا در لود تصاویر نظرسنجی:', error);
    }
  }

  private applyBackgroundImage(bgUrl: string): void {
    const host = this.elementRef.nativeElement as HTMLElement;
    host.style.backgroundImage = `url(${bgUrl})`;
    host.style.backgroundSize = 'cover';
    host.style.backgroundAttachment = 'fixed';
    host.style.backgroundPosition = 'center';
    host.style.setProperty('--ts-bg-overlay', 'rgba(248,250,252,0.88)');
  }

  // ==================== Theme ====================

  private applyTheme(survey: SurveyDetailDto): void {
    const host = this.elementRef.nativeElement as HTMLElement;
    const hex = (survey as any).themeColor as string | undefined;
    if (!hex) return;

    const rgb = this.hexToRgb(hex);
    host.style.setProperty('--ts-primary', hex);

    if (rgb) {
      host.style.setProperty(
        '--ts-primary-light',
        this.lightenColor(rgb, 0.3)
      );
      host.style.setProperty(
        '--ts-primary-dark',
        this.darkenColor(rgb, 0.15)
      );
      host.style.setProperty(
        '--ts-primary-bg',
        `rgba(${rgb.r},${rgb.g},${rgb.b},0.06)`
      );
      host.style.setProperty(
        '--ts-success-bg',
        `rgba(${rgb.r},${rgb.g},${rgb.b},0.08)`
      );
    }
  }

  private hexToRgb(
    hex: string
  ): { r: number; g: number; b: number } | null {
    const clean = hex.replace('#', '');
    const full =
      clean.length === 3
        ? clean
          .split('')
          .map((c) => c + c)
          .join('')
        : clean;
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full);
    return result
      ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
      : null;
  }

  private lightenColor(
    rgb: { r: number; g: number; b: number },
    amount: number
  ): string {
    return `rgb(${Math.min(255, Math.round(rgb.r + (255 - rgb.r) * amount))},${Math.min(255, Math.round(rgb.g + (255 - rgb.g) * amount))},${Math.min(255, Math.round(rgb.b + (255 - rgb.b) * amount))})`;
  }

  private darkenColor(
    rgb: { r: number; g: number; b: number },
    amount: number
  ): string {
    return `rgb(${Math.max(0, Math.round(rgb.r * (1 - amount)))},${Math.max(0, Math.round(rgb.g * (1 - amount)))},${Math.max(0, Math.round(rgb.b * (1 - amount)))})`;
  }

  private shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ==================== Phase Transitions ====================
  startSurvey(): void {
    this.phase.set('survey');
    this.startTimer();
    this.currentGroupIndex.set(0);

    if (!this.hasCriteria()) {
      const first = this.questions()[0];
      if (first) this.setupAnswerFormForQuestion(first);
    }
  }

  // ==================== Timer ====================

  private startTimer(): void {
    this.elapsedSeconds.set(0);
    this.timerSub = interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.elapsedSeconds.update((s) => s + 1));
  }

  // ==================== Form Setup ====================

  private initForm(): void {
    this.answerForm = this.fb.group({
      textAnswer: [''],
      numericAnswer: [null],
      dateAnswer: [''],
      selectedOptionGuid: [''],
      selectedOptionGuids: this.fb.array([]),
      otherAnswer: [''],
      fileUrl: [''],
      fileName: [''],
      fileSize: [null],
      matrixAnswers: this.fb.group({}),
    });
  }

  private createQuestionFormGroup(question: QuestionDetailDto): FormGroup {
    return this.fb.group({
      questionGuid: question.guid,
      questionType: question.questionType,
      textAnswer: [''],
      numericAnswer: [null],
      dateAnswer: [''],
      selectedOptionGuid: [''],
      selectedOptionGuids: this.fb.array(
        question.options?.map(() => this.fb.control(false)) ?? []
      ),
      otherAnswer: [''],
      fileUrl: [''],
      fileName: [''],
      fileSize: [null],
      matrixAnswers: this.fb.group({}),
    });
  }

  /** فرم سوال جاری (slide mode) را آماده می‌کند. */
  private setupAnswerFormForQuestion(question: QuestionDetailDto): void {
    this.currentValidationError.set('');
    this.answerForm.reset();

    const existingAnswer = this.answers().get(question.guid);

    switch (question.questionType) {
      case this.QuestionType.TEXT:
      case this.QuestionType.LONG_TEXT: {
        this.answerForm.patchValue({
          textAnswer: existingAnswer?.textAnswer || '',
        });
        const textCtrl = this.answerForm.get('textAnswer')!;
        const validators = [];
        if (question.isRequired) validators.push(Validators.required);
        if ((question as any).minLength)
          validators.push(
            Validators.minLength((question as any).minLength)
          );
        if ((question as any).maxLength)
          validators.push(
            Validators.maxLength((question as any).maxLength)
          );
        textCtrl.setValidators(validators);
        textCtrl.updateValueAndValidity();
        break;
      }

      case this.QuestionType.MULTIPLE_CHOICE:
        this.answerForm.patchValue({
          selectedOptionGuid: existingAnswer?.selectedOptionGuid || '',
          otherAnswer: existingAnswer?.otherAnswer || '',
        });
        if (question.isRequired)
          this.answerForm
            .get('selectedOptionGuid')
            ?.setValidators([Validators.required]);
        break;

      case this.QuestionType.CHECKBOX: {
        const checkboxArray = this.answerForm.get(
          'selectedOptionGuids'
        ) as FormArray;
        checkboxArray.clear();
        question.options?.forEach((option) => {
          const isSelected =
            existingAnswer?.selectedOptionGuids?.includes(option.guid) ??
            false;
          checkboxArray.push(new FormControl(isSelected));
        });
        this.answerForm.patchValue({
          otherAnswer: existingAnswer?.otherAnswer || '',
        });
        break;
      }

      case this.QuestionType.DROPDOWN:
        this.answerForm.patchValue({
          selectedOptionGuid: existingAnswer?.selectedOptionGuid || '',
        });
        if (question.isRequired)
          this.answerForm
            .get('selectedOptionGuid')
            ?.setValidators([Validators.required]);
        break;

      case this.QuestionType.RATING:
        this.answerForm.patchValue({
          numericAnswer: existingAnswer?.numericAnswer ?? null,
        });
        if (question.isRequired)
          this.answerForm
            .get('numericAnswer')
            ?.setValidators([Validators.required]);
        break;

      case this.QuestionType.DATE:
        this.answerForm.patchValue({
          dateAnswer: existingAnswer?.dateAnswer || '',
        });
        if (question.isRequired)
          this.answerForm
            .get('dateAnswer')
            ?.setValidators([Validators.required]);
        break;

      case this.QuestionType.FILE_UPLOAD:
        this.answerForm.patchValue({
          fileUrl: existingAnswer?.fileUrl || '',
          fileName: (existingAnswer as any)?.fileName || '',
          fileSize: (existingAnswer as any)?.fileSize ?? null,
        });
        if (question.isRequired)
          this.answerForm
            .get('fileUrl')
            ?.setValidators([Validators.required]);
        break;

      case this.QuestionType.MATRIX: {
        const matrixGroup = this.answerForm.get('matrixAnswers') as FormGroup;
        Object.keys(matrixGroup.controls).forEach((key) =>
          matrixGroup.removeControl(key)
        );
        question.matrixRows?.forEach((row) => {
          const val = existingAnswer?.matrixAnswers?.[row] || '';
          matrixGroup.addControl(
            row,
            new FormControl(
              val,
              question.isRequired ? [Validators.required] : []
            )
          );
        });
        break;
      }
    }
  }

  // ==================== Slide Navigation ====================

  nextQuestion(): void {
    if (!this.validateCurrentSlide()) return;
    this.saveCurrentSlideAnswer();

    if (this.isLastQuestion()) {
      this.submitSurvey();
    } else {
      this.slideDirection.set('next');
      this.currentQuestionIndex.update((i) => i + 1);
      const next = this.currentQuestion();
      if (next) this.setupAnswerFormForQuestion(next);
    }
  }

  previousQuestion(): void {
    this.currentValidationError.set('');
    this.saveCurrentSlideAnswer();

    if (!this.isFirstQuestion()) {
      this.slideDirection.set('prev');
      this.currentQuestionIndex.update((i) => i - 1);
      const prev = this.currentQuestion();
      if (prev) this.setupAnswerFormForQuestion(prev);
    }
  }

  /**
   * رفتن مستقیم به سوال از طریق نقشه (dots).
   * به جلو: فقط با پاس شدن validation | به عقب: آزادانه
   */
  goToQuestion(index: number): void {
    if (index < 0 || index >= this.totalQuestions()) return;

    const isGoingForward = index > this.currentQuestionIndex();

    if (isGoingForward) {
      if (!this.validateCurrentSlide()) return;
    } else {
      this.currentValidationError.set('');
    }

    this.saveCurrentSlideAnswer();
    this.slideDirection.set(isGoingForward ? 'next' : 'prev');
    this.currentQuestionIndex.set(index);

    const q = this.currentQuestion();
    if (q) this.setupAnswerFormForQuestion(q);
  }

  // ==================== Validation ====================

  /** Validate سوال جاری در حالت Slide */
  private validateCurrentSlide(): boolean {
    const question = this.currentQuestion();
    if (!question) return true;

    const value = this.answerForm.value;

    if (question.isRequired) {
      const result = this.checkRequired(question, value);
      if (!result.valid) {
        this.currentValidationError.set(result.message);
        this.toastService.error(result.message);
        this.answerForm.markAllAsTouched();
        return false;
      }
    }

    if (
      [this.QuestionType.TEXT, this.QuestionType.LONG_TEXT].includes(
        question.questionType
      ) &&
      value.textAnswer?.trim()
    ) {
      const result = this.validateFormat(question, value.textAnswer);
      if (!result.valid) {
        this.currentValidationError.set(result.message);
        this.toastService.error(result.message);
        return false;
      }
    }

    if (
      [this.QuestionType.TEXT, this.QuestionType.LONG_TEXT].includes(
        question.questionType
      ) &&
      value.textAnswer?.trim()
    ) {
      const result = this.validateLength(question, value.textAnswer);
      if (!result.valid) {
        this.currentValidationError.set(result.message);
        this.toastService.error(result.message);
        return false;
      }
    }

    if (
      question.questionType === this.QuestionType.RATING &&
      value.numericAnswer != null
    ) {
      const result = this.validateNumericRange(question, value.numericAnswer);
      if (!result.valid) {
        this.currentValidationError.set(result.message);
        this.toastService.error(result.message);
        return false;
      }
    }

    this.currentValidationError.set('');
    return true;
  }

  /** Validate همه سوالات در حالت One-Page */
  private validateAllQuestions(): boolean {
    const invalidGuids = new Set<string>();
    let firstInvalidIndex = -1;

    this.surveyControls.forEach((group, index) => {
      const question = this.getQuestion(group);
      if (!question) return;

      if (
        question.isRequired &&
        !this.isQuestionGroupValid(group, question)
      ) {
        invalidGuids.add(question.guid);
        if (firstInvalidIndex === -1) firstInvalidIndex = index;
        return;
      }

      if (
        [this.QuestionType.TEXT, this.QuestionType.LONG_TEXT].includes(
          question.questionType
        )
      ) {
        const textVal = group.get('textAnswer')?.value;
        if (textVal?.trim()) {
          const fmt = this.validateFormat(question, textVal);
          if (!fmt.valid) {
            invalidGuids.add(question.guid);
            if (firstInvalidIndex === -1) firstInvalidIndex = index;
            return;
          }
          const len = this.validateLength(question, textVal);
          if (!len.valid) {
            invalidGuids.add(question.guid);
            if (firstInvalidIndex === -1) firstInvalidIndex = index;
            return;
          }
        }
      }
    });

    this.invalidQuestionGuids.set(invalidGuids);

    if (invalidGuids.size > 0) {
      this.toastService.error(
        `لطفاً به ${invalidGuids.size} سوال باقی‌مانده پاسخ دهید یا خطاها را برطرف کنید`
      );
      setTimeout(() => {
        const el = document.getElementById(`question-${firstInvalidIndex}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return false;
    }

    return true;
  }

  private isQuestionGroupValid(
    group: FormGroup,
    question: QuestionDetailDto
  ): boolean {
    switch (question.questionType) {
      case this.QuestionType.TEXT:
      case this.QuestionType.LONG_TEXT:
        return !!group.get('textAnswer')?.value?.trim();

      case this.QuestionType.MULTIPLE_CHOICE:
      case this.QuestionType.DROPDOWN:
        return (
          !!group.get('selectedOptionGuid')?.value ||
          !!group.get('otherAnswer')?.value?.trim()
        );

      case this.QuestionType.CHECKBOX: {
        const arr = group.get('selectedOptionGuids') as FormArray;
        return (
          arr?.value?.some((v: boolean) => v) ||
          !!group.get('otherAnswer')?.value?.trim()
        );
      }

      case this.QuestionType.RATING:
        return group.get('numericAnswer')?.value != null;

      case this.QuestionType.DATE:
        return !!group.get('dateAnswer')?.value;

      case this.QuestionType.FILE_UPLOAD:
        return !!group.get('fileUrl')?.value;

      case this.QuestionType.MATRIX: {
        const m = (group.get('matrixAnswers') as FormGroup)?.value;
        return m && Object.keys(m).every((k) => !!m[k]);
      }

      default:
        return true;
    }
  }

  // ──────────────────────────────────────────────
  // Validation Helpers
  // ──────────────────────────────────────────────

  private checkRequired(
    question: QuestionDetailDto,
    value: any
  ): ValidationResult {
    const messages: Record<number, string> = {
      [this.QuestionType.TEXT]: 'لطفاً پاسخ خود را وارد کنید',
      [this.QuestionType.LONG_TEXT]: 'لطفاً پاسخ خود را وارد کنید',
      [this.QuestionType.MULTIPLE_CHOICE]: 'لطفاً یک گزینه انتخاب کنید',
      [this.QuestionType.DROPDOWN]: 'لطفاً یک گزینه انتخاب کنید',
      [this.QuestionType.CHECKBOX]: 'لطفاً حداقل یک گزینه انتخاب کنید',
      [this.QuestionType.RATING]: 'لطفاً امتیاز خود را انتخاب کنید',
      [this.QuestionType.DATE]: 'لطفاً تاریخ را انتخاب کنید',
      [this.QuestionType.FILE_UPLOAD]: 'لطفاً فایل خود را آپلود کنید',
      [this.QuestionType.MATRIX]: 'لطفاً به تمام سطرها پاسخ دهید',
    };

    let isValid = true;

    switch (question.questionType) {
      case this.QuestionType.TEXT:
      case this.QuestionType.LONG_TEXT:
        isValid = !!value.textAnswer?.trim();
        break;

      case this.QuestionType.MULTIPLE_CHOICE:
      case this.QuestionType.DROPDOWN:
        isValid =
          !!value.selectedOptionGuid || !!value.otherAnswer?.trim();
        break;

      case this.QuestionType.CHECKBOX: {
        const selected = (
          this.answerForm.get('selectedOptionGuids') as FormArray
        ).value;
        isValid =
          selected.some((v: boolean) => v) ||
          !!value.otherAnswer?.trim();
        break;
      }

      case this.QuestionType.RATING:
        isValid = value.numericAnswer != null;
        break;

      case this.QuestionType.DATE:
        isValid = !!value.dateAnswer;
        break;

      case this.QuestionType.FILE_UPLOAD:
        isValid = !!value.fileUrl;
        break;

      case this.QuestionType.MATRIX: {
        const matrix = value.matrixAnswers;
        isValid =
          matrix && Object.keys(matrix).every((k: string) => !!matrix[k]);
        break;
      }
    }

    return {
      valid: isValid,
      message:
        messages[question.questionType] ?? 'لطفاً به این سوال پاسخ دهید',
    };
  }

  private validateFormat(
    question: QuestionDetailDto,
    value: string
  ): ValidationResult {
    const q = question as any;
    const validationType = q.validationType as number;
    if (!validationType || validationType === 0)
      return { valid: true, message: '' };

    const customMsg = q.validationErrorMessage as string | undefined;

    if (validationType === 4) {
      const pattern = q.customValidationRegex as string | undefined;
      if (!pattern) return { valid: true, message: '' };
      try {
        return !new RegExp(pattern).test(value)
          ? { valid: false, message: customMsg || this.VALIDATION_MESSAGES[4] }
          : { valid: true, message: '' };
      } catch {
        return { valid: true, message: '' };
      }
    }

    const pattern = this.VALIDATION_PATTERNS[validationType];
    if (!pattern) return { valid: true, message: '' };

    return !pattern.test(value.trim())
      ? {
        valid: false,
        message: customMsg || this.VALIDATION_MESSAGES[validationType],
      }
      : { valid: true, message: '' };
  }

  private validateLength(
    question: QuestionDetailDto,
    value: string
  ): ValidationResult {
    const q = question as any;
    const len = value?.length ?? 0;
    const minLength = q.minLength as number | undefined;
    const maxLength = q.maxLength as number | undefined;

    if (minLength && len < minLength)
      return {
        valid: false,
        message: `پاسخ باید حداقل ${minLength} کاراکتر داشته باشد (وارد شده: ${len})`,
      };
    if (maxLength && len > maxLength)
      return {
        valid: false,
        message: `پاسخ نباید بیشتر از ${maxLength} کاراکتر باشد (وارد شده: ${len})`,
      };

    return { valid: true, message: '' };
  }

  private validateNumericRange(
    question: QuestionDetailDto,
    value: number
  ): ValidationResult {
    const q = question as any;
    const minValue = q.minValue as number | undefined;
    const maxValue = q.maxValue as number | undefined;

    if (minValue !== undefined && minValue !== null && value < minValue)
      return {
        valid: false,
        message: `مقدار نباید کمتر از ${minValue} باشد`,
      };
    if (maxValue !== undefined && maxValue !== null && value > maxValue)
      return {
        valid: false,
        message: `مقدار نباید بیشتر از ${maxValue} باشد`,
      };

    return { valid: true, message: '' };
  }

  // ==================== Save Answer (in-memory only) ====================

  private saveCurrentSlideAnswer(): void {
    const question = this.currentQuestion();
    if (!question) return;
    const answer = this.buildAnswerDto(question, this.answerForm.value);
    this.answers().set(question.guid, answer);
  }

  // ==================== Build Answer DTO ====================

  private buildAnswerDto(
    question: QuestionDetailDto,
    formValue: any
  ): SubmitAnswerDto {
    const answer: SubmitAnswerDto = {
      questionGuid: question.guid,
      questionType: question.questionType,
      isSkipped: false,
      timeSpentSeconds: 0,
    };

    switch (question.questionType) {
      case this.QuestionType.TEXT:
      case this.QuestionType.LONG_TEXT:
        answer.textAnswer = formValue.textAnswer;
        break;

      case this.QuestionType.MULTIPLE_CHOICE:
      case this.QuestionType.DROPDOWN:
        answer.selectedOptionGuid = formValue.selectedOptionGuid;
        answer.otherAnswer = formValue.otherAnswer;
        break;

      case this.QuestionType.CHECKBOX: {
        const guids: string[] = [];
        (formValue.selectedOptionGuids || []).forEach(
          (selected: boolean, index: number) => {
            if (selected && question.options?.[index])
              guids.push(question.options[index].guid);
          }
        );
        answer.selectedOptionGuids = guids;
        answer.otherAnswer = formValue.otherAnswer;
        break;
      }

      case this.QuestionType.RATING:
        answer.numericAnswer = formValue.numericAnswer;
        break;

      case this.QuestionType.DATE:
        answer.dateAnswer = formValue.dateAnswer;
        break;

      case this.QuestionType.FILE_UPLOAD:
        answer.fileUrl = formValue.fileUrl;
        answer.fileName = formValue.fileName;
        // بک‌اند برای FileUpload به FileSize نیاز داره (ResponseAnswerDto.FileSize)
        break;

      case this.QuestionType.MATRIX:
        answer.matrixAnswers = formValue.matrixAnswers;
        break;
    }

    return answer;
  }

  // ==================== Submit ====================

  /** ثبت نهایی از حالت Slide (بعد از آخرین سوال) */
  private submitSurvey(): void {
    this.phase.set('submitting');
    this.doSubmit({
      surveyGuid: this.surveyGuid(),
      isAnonymous: this.survey()?.allowAnonymous ?? false,
      answers: Array.from(this.answers().values()),
    });
  }

  /** ثبت نهایی از حالت One-Page (دکمه ارسال) */
  submitOnePage(): void {
    if (!this.validateAllQuestions()) return;
    this.phase.set('submitting');
    this.doSubmit({
      surveyGuid: this.surveyGuid(),
      isAnonymous: this.survey()?.allowAnonymous ?? false,
      answers: this.buildAllAnswersFromForm(),
    });
  }

  private doSubmit(submitData: SubmitResponseDto): void {
    this.responseService
      .submitResponse(submitData)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error) => {
          const msg =
            error?.error?.message ||
            error?.error?.errors?.[0] ||
            'خطا در ثبت پاسخ‌ها';
          this.toastService.error(msg);
          this.phase.set('survey');
          return of(null);
        })
      )
      .subscribe((result: any) => {
        if (!result) {
          this.phase.set('survey');
          return;
        }

        const guid = result?.data ?? result;
        if (guid && typeof guid === 'string') {
          this.responseGuid.set(guid);
        }

        this.timerSub?.unsubscribe();
        this.phase.set('thankyou');
      });
  }

  // ==================== Build All Answers (One-Page) ====================

  private buildAllAnswersFromForm(): SubmitAnswerDto[] {
    const answers: SubmitAnswerDto[] = [];

    this.surveyControls.forEach((group) => {
      const question = this.getQuestion(group);
      if (!question) return;

      answers.push(
        this.buildAnswerDto(question, {
          textAnswer: group.get('textAnswer')?.value,
          numericAnswer: group.get('numericAnswer')?.value,
          dateAnswer: group.get('dateAnswer')?.value,
          selectedOptionGuid: group.get('selectedOptionGuid')?.value,
          selectedOptionGuids: (
            group.get('selectedOptionGuids') as FormArray
          )?.value,
          otherAnswer: group.get('otherAnswer')?.value,
          fileUrl: group.get('fileUrl')?.value,
          fileName: group.get('fileName')?.value,
          fileSize: group.get('fileSize')?.value,
          matrixAnswers: (group.get('matrixAnswers') as FormGroup)?.value,
        })
      );
    });

    return answers;
  }

  // ==================== User Actions ====================

  onOptionSelected(optionGuid: string): void {
    this.answerForm.patchValue({ selectedOptionGuid: optionGuid });
    this.currentValidationError.set('');
  }

  onRatingSelected(rating: number): void {
    this.answerForm.patchValue({ numericAnswer: rating });
    this.currentValidationError.set('');
  }

  onRatingSelectedInGroup(group: FormGroup, rating: number): void {
    group.patchValue({ numericAnswer: rating });
  }

  onOptionSelectedInGroup(group: FormGroup, optionGuid: string): void {
    group.patchValue({ selectedOptionGuid: optionGuid });
  }

  // ==================== File Upload ====================

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const question = this.currentQuestion();

    if (
      question?.maxFileSize &&
      file.size > question.maxFileSize * 1024 * 1024
    ) {
      this.toastService.error(
        `حجم فایل نباید بیشتر از ${question.maxFileSize} مگابایت باشد`
      );
      return;
    }
    if (question?.allowedFileTypes) {
      const allowed = question.allowedFileTypes.split(',').map((t) => t.trim());
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowed.includes(ext)) {
        this.toastService.error(
          `فرمت مجاز نیست. فرمت‌های مجاز: ${question.allowedFileTypes}`
        );
        return;
      }
    }

    try {
      const fileItems = this.tusUploadService.addFiles([file], {
        maxFiles: 1,
        maxSizeMB: question?.maxFileSize,
        acceptedTypes: question?.allowedFileTypes
          ? question.allowedFileTypes.split(',')
          : undefined,
      });

      if (!fileItems?.length) {
        this.toastService.error('خطا در افزودن فایل');
        return;
      }

      const guid = await this.tusUploadService.uploadFile(fileItems[0].id, {
        folderPath: '/surveys/responses',
        description: 'Response file attachment',
      });

      if (!guid) {
        this.toastService.error('خطا در آپلود فایل');
        return;
      }

      const uploaded = this.tusUploadService.filesMap().get(fileItems[0].id);
      this.answerForm.patchValue({
        fileUrl: uploaded?.path || uploaded?.fileGuid || '',
        fileName: file.name,
        fileSize: file.size,
      });
      this.currentValidationError.set('');
      this.toastService.success('فایل با موفقیت آپلود شد');
      setTimeout(() => this.tusUploadService.removeFile(fileItems[0].id), 1000);
    } catch {
      this.toastService.error('خطا در آپلود فایل');
    }
  }

  async onFileSelectedInGroup(
    event: Event,
    group: FormGroup,
    question: QuestionDetailDto
  ): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];

    if (
      question?.maxFileSize &&
      file.size > question.maxFileSize * 1024 * 1024
    ) {
      this.toastService.error(
        `حجم فایل نباید بیشتر از ${question.maxFileSize} مگابایت باشد`
      );
      return;
    }

    try {
      const fileItems = this.tusUploadService.addFiles([file], {
        maxFiles: 1,
      });
      if (!fileItems?.length) return;

      const guid = await this.tusUploadService.uploadFile(fileItems[0].id, {
        folderPath: '/surveys/responses',
        description: 'Response file attachment',
      });

      if (!guid) {
        this.toastService.error('خطا در آپلود فایل');
        return;
      }

      const uploaded = this.tusUploadService.filesMap().get(fileItems[0].id);
      group.patchValue({
        fileUrl: uploaded?.path || uploaded?.fileGuid || '',
        fileName: file.name,
        fileSize: file.size,
      });
      this.toastService.success('فایل آپلود شد');
      setTimeout(() => this.tusUploadService.removeFile(fileItems[0].id), 1000);
    } catch {
      this.toastService.error('خطا در آپلود');
    }
  }

  // ==================== Helpers ====================

  getQuestion(form: FormGroup): QuestionDetailDto | undefined {
    const guid = form.get('questionGuid')?.value;
    return this.questions().find((q) => q.guid === guid);
  }

  isQuestionInvalid(questionGuid: string): boolean {
    return this.invalidQuestionGuids().has(questionGuid);
  }

  isQuestionAnswered(index: number): boolean {
    const q = this.questions()[index];
    if (!q) return false;
    const answer = this.answers().get(q.guid);
    return answer ? this.isAnswerFilled(answer, q) : false;
  }

  trackByGuid(_: number, item: any): string {
    return item.guid;
  }

  trackByIndex(index: number): number {
    return index;
  }

  goBack(): void {
    this.router.navigate(['/surveys']);
  }

  retry(): void {
    this.loadSurveyData();
  }

  // ==================== Group Navigation (وقتی نظرسنجی معیار محور است) ====================

  getControlForQuestion(q: QuestionDetailDto): FormGroup | undefined {
    return this.surveyControls.find((c) => c.get('questionGuid')?.value === q.guid);
  }

  getControlsForGroup(group: TakeSurveyQuestionGroup): FormGroup[] {
    const guids = new Set(group.questions.map((q) => q.guid));
    return this.surveyControls.filter((c) => guids.has(c.get('questionGuid')?.value));
  }

  isGroupAnswered(index: number): boolean {
    const group = this.questionGroups()[index];
    if (!group) return false;
    return group.questions.every((q) => {
      if (!q.isRequired) return true;
      const control = this.getControlForQuestion(q);
      return control ? this.isQuestionGroupValid(control, q) : false;
    });
  }

  nextGroup(): void {
    if (!this.validateGroup(this.currentGroup())) return;

    if (this.isLastGroup()) {
      this.submitFromGroups();
    } else {
      this.slideDirection.set('next');
      this.currentGroupIndex.update((i) => i + 1);
    }
  }

  previousGroup(): void {
    if (!this.isFirstGroup()) {
      this.slideDirection.set('prev');
      this.currentGroupIndex.update((i) => i - 1);
    }
  }

  goToGroup(index: number): void {
    if (index < 0 || index >= this.totalGroups()) return;
    const isForward = index > this.currentGroupIndex();
    if (isForward && !this.validateGroup(this.currentGroup())) return;
    this.slideDirection.set(isForward ? 'next' : 'prev');
    this.currentGroupIndex.set(index);
  }

  private validateGroup(group: TakeSurveyQuestionGroup): boolean {
    const invalidGuids = new Set<string>(this.invalidQuestionGuids());
    let allValid = true;
    let firstInvalidGuid: string | null = null;

    for (const q of group.questions) {
      const control = this.getControlForQuestion(q);
      if (!control) continue;

      let valid = true;
      if (q.isRequired) {
        valid = this.isQuestionGroupValid(control, q);
      }
      if (
        valid &&
        [this.QuestionType.TEXT, this.QuestionType.LONG_TEXT].includes(q.questionType)
      ) {
        const textVal = control.get('textAnswer')?.value;
        if (textVal?.trim()) {
          if (!this['validateFormat'](q, textVal).valid) valid = false;
          if (valid && !this['validateLength'](q, textVal).valid) valid = false;
        }
      }

      if (valid) {
        invalidGuids.delete(q.guid);
      } else {
        invalidGuids.add(q.guid);
        allValid = false;
        if (!firstInvalidGuid) firstInvalidGuid = q.guid;
      }
    }

    this.invalidQuestionGuids.set(invalidGuids);

    if (!allValid) {
      this.toastService.error('لطفاً به سوالات این بخش پاسخ دهید یا خطاها را برطرف کنید');
      if (firstInvalidGuid) {
        const guid = firstInvalidGuid;
        setTimeout(() => {
          document
            .getElementById(`question-group-${guid}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }

    return allValid;
  }

  private submitFromGroups(): void {
    let allValid = true;
    for (const group of this.questionGroups()) {
      if (!this.validateGroup(group)) allValid = false;
    }
    if (!allValid) return;

    this.phase.set('submitting');
    this.doSubmit({
      surveyGuid: this.surveyGuid(),
      isAnonymous: this.survey()?.allowAnonymous ?? false,
      answers: this.buildAllAnswersFromForm(),
    });
  }
}