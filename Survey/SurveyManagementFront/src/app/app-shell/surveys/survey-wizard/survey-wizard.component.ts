// ============================================================
// survey-wizard.component.ts
// ویزارد ۴ مرحله‌ای ایجاد/ویرایش نظرسنجی
// - اعتبارسنجی همه‌ی مراحل قبلی هنگام پرش به جلو (W6)
// - تشخیص تغییرات ذخیره‌نشده + beforeunload + گارد CanDeactivate (W7)
// - پاک‌سازی فقط فایل‌های واقعاً رهاشده (W1) و عدم بازگشت فایل‌های حذف‌شده (W8)
// - بررسی نتیجه‌ی ناموفق سرور (W2)
// ============================================================

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  effect,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { SwalService } from '../../../services/framework-services/swal.service';
import { TusUploadService } from '../../../services/framework-services/tus-upload.service';
import { SurveyService } from '../../../services/survey.service';
import { AppSharedDataComponent } from '../../../shared/app-shared-data/app-shared-data';
import {
  WizardSurveyData,
  WizardQuestionData,
  WizardAccessItem,
  CreateSurveyWithQuestionsDto,
  WizardCriterionData,
  normalizeCompletionEffect,
  normalizeQuestionFromServer,
  parseList,
} from '../../../core/models/survey-wizard.model';
import { SurveyWizardStep1Component } from './survey-wizard-steps/step1-survey-info.component';
import { SurveyWizardStep2Component } from './survey-wizard-steps/step2-questions.component';
import { SurveyWizardStep3AccessComponent } from './survey-wizard-steps/step3-access-control.component';
import { SurveyWizardStep4ReviewComponent } from './survey-wizard-steps/step4-review.component';
import { WizardUnsavedChangesAware } from './survey-wizard.guard';

interface StepDef { index: number; label: string; icon: string; }

@Component({
  selector: 'app-survey-wizard',
  templateUrl: './survey-wizard.component.html',
  styleUrls: ['./survey-wizard.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    SurveyWizardStep1Component,
    SurveyWizardStep2Component,
    SurveyWizardStep3AccessComponent,
    SurveyWizardStep4ReviewComponent
  ]
})
export class SurveyWizardComponent extends AppSharedDataComponent
  implements OnInit, OnDestroy, WizardUnsavedChangesAware {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly swalService = inject(SwalService);
  private readonly surveyService = inject(SurveyService);
  private readonly tusUploadService = inject(TusUploadService);
  private readonly destroyRef = inject(DestroyRef);

  // ⭐ State Management
  readonly currentStep = signal<number>(1);
  readonly isLoading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly isEditMode = signal<boolean>(false);
  /** نظرسنجی منتشرشده و کاربر مدیر سامانه نیست: فقط مشاهده (ویرایش پس از انتشار فقط برای مدیر سامانه) */
  readonly readOnly = signal<boolean>(false);
  /** مدیر سامانه در حال ویرایش نظرسنجی منتشرشده است */
  readonly adminEditingPublished = signal<boolean>(false);
  readonly surveyGuid = signal<string>('');

  /** مراحلی که کاربر سعی کرده از آن‌ها عبور کند (برای نمایش خطاهای inline) */
  readonly attemptedSteps = signal<Set<number>>(new Set());

  readonly steps: StepDef[] = [
    { index: 1, label: 'اطلاعات', icon: 'fa-info-circle' },
    { index: 2, label: 'سوالات', icon: 'fa-list-ol' },
    { index: 3, label: 'دسترسی‌ها', icon: 'fa-user-shield' },
    { index: 4, label: 'بررسی', icon: 'fa-clipboard-check' },
  ];

  // ⭐ Wizard Data
  readonly surveyData = signal<WizardSurveyData>({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    accessType: '1',
    showType: '2',
    allowAnonymous: false,
    allowSaveDraft: true,
    showProgressBar: true,
    randomizeQuestions: false,
    allowMultipleResponses: false,
    requireLogin: true,
    welcomeMessage: '',
    thankYouMessage: '',
    maxResponses: null,
    themeColor: '#1d4ed8',
    hasCriteria: false,
    completionEffect: 'confetti',
  });

  readonly questions = signal<WizardQuestionData[]>([]);
  readonly criteria = signal<WizardCriterionData[]>([]);
  readonly accessItems = signal<WizardAccessItem[]>([]);

  /**
   * ✅ W1: شناسه‌ی فایل‌هایی که در این نشست آپلود شده‌اند و هنوز در سرور ثبت نشده‌اند.
   * پس از ثبت موفق پاک می‌شود؛ فقط در صورت رهاکردن ویزارد حذف می‌شوند.
   */
  private readonly pendingUploads = new Set<string>();
  private savedSuccessfully = false;
  private skipLeaveGuard = false;

  /** snapshot وضعیت اولیه برای تشخیص تغییرات */
  private readonly baseline = signal<string>('');

  readonly totalSteps = computed(() => this.steps.length);
  readonly progress = computed(() => (this.currentStep() / this.totalSteps()) * 100);

  readonly visibleQuestionCount = computed(() => this.questions().filter(q => !q.isRemoved).length);
  readonly visibleAccessCount = computed(() => this.accessItems().filter(a => !a.isRemoved).length);

  readonly isDirty = computed(() => this.snapshot() !== this.baseline());

  /** خطاهای هر مرحله */
  readonly stepErrors = computed<Record<number, string[]>>(() => ({
    1: this.validateStep1(),
    2: this.visibleQuestionCount() === 0 ? ['حداقل یک سوال به نظرسنجی اضافه کنید.'] : [],
    3: [],
    4: [],
  }));

  readonly currentStepErrors = computed(() =>
    this.attemptedSteps().has(this.currentStep()) ? (this.stepErrors()[this.currentStep()] ?? []) : []
  );

  readonly canSubmit = computed(() =>
    this.currentStep() === 4 &&
    this.stepErrors()[1].length === 0 &&
    this.stepErrors()[2].length === 0
  );

  readonly canGoPrevious = computed(() => this.currentStep() > 1);

  readonly stepTitle = computed(() => {
    switch (this.currentStep()) {
      case 1: return 'اطلاعات نظرسنجی';
      case 2: return 'افزودن سوالات';
      case 3: return 'مدیریت دسترسی‌ها';
      case 4: return 'بررسی نهایی';
      default: return '';
    }
  });

  readonly stepDescription = computed(() => {
    switch (this.currentStep()) {
      case 1: return 'اطلاعات اولیه، تنظیمات و ظاهر نظرسنجی را مشخص کنید';
      case 2: return 'سوالات خود را اضافه و مرتب کنید';
      case 3: return 'مشخص کنید چه افرادی به نظرسنجی دسترسی داشته باشند';
      case 4: return 'اطلاعات را بررسی و نظرسنجی را ثبت کنید';
      default: return '';
    }
  });

  private readonly hostEl = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly topBarRef = viewChild<ElementRef<HTMLElement>>('topBar');
  private topBarRo: ResizeObserver | null = null;

  constructor() {
    super();
    this.initializeBreadcrumbs();

    // ارتفاع واقعی نوار بالا برای چسبیدن هدر مرحله‌ی ۲ زیر آن
    effect(() => {
      const el = this.topBarRef()?.nativeElement;
      this.topBarRo?.disconnect();
      this.topBarRo = null;
      if (!el || typeof ResizeObserver === 'undefined') return;
      this.topBarRo = new ResizeObserver(() =>
        this.hostEl.nativeElement.style.setProperty('--wizard-topbar-h', `${el.offsetHeight}px`));
      this.topBarRo.observe(el);
    });
  }

  private initializeBreadcrumbs(): void {
    this.breadcrumbService.setItems([
      { label: 'نظرسنجی‌ها', routerLink: '/surveys/list' },
      { label: 'ایجاد نظرسنجی', routerLink: '/surveys/wizard' }
    ]);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.checkEditMode();
    if (!this.isEditMode()) this.resetBaseline();
  }

  ngOnDestroy(): void {
    this.topBarRo?.disconnect();
    // ✅ W1: فقط اگر ثبت موفق نبوده، فایل‌های آپلودشده‌ی این نشست (که هرگز ذخیره نشده‌اند) رها شده‌اند
    if (!this.savedSuccessfully) {
      this.deleteFiles([...this.pendingUploads]);
    }
    this.pendingUploads.clear();
  }

  // ==================== UNSAVED CHANGES (W7) ====================
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      // برای مرورگرهای قدیمی‌تر
      event.returnValue = '';
    }
  }

  hasUnsavedChanges(): boolean {
    if (this.savedSuccessfully || this.skipLeaveGuard || this.readOnly()) return false;
    return this.isDirty() || this.pendingUploads.size > 0;
  }

  /** توسط گارد surveyWizardCanDeactivateGuard فراخوانی می‌شود */
  async confirmLeave(): Promise<boolean> {
    if (!this.hasUnsavedChanges()) return true;
    const result = await this.swalService.fire({
      icon: 'warning',
      title: 'تغییرات ذخیره نشده‌اند',
      text: 'اگر از این صفحه خارج شوید، اطلاعات وارد شده و فایل‌های آپلود شده از بین می‌روند.',
      showCancelButton: true,
      confirmButtonText: 'خروج بدون ذخیره',
      cancelButtonText: 'ماندن در صفحه',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
      focusCancel: true,
    });
    return !!result.isConfirmed;
  }

  private snapshot(): string {
    // نرمال‌سازی تا تغییرات ظاهری (HTML خالی ویرایشگر، null/'') تغییر محسوب نشوند
    const stripHtml = (v: unknown) =>
      String(v ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    const s: Record<string, unknown> = {};
    const data = this.surveyData() as unknown as Record<string, unknown>;
    for (const key of Object.keys(data).sort()) {
      const val = data[key];
      if (key === 'welcomeMessage' || key === 'thankYouMessage') s[key] = stripHtml(val);
      else s[key] = val === '' || val === undefined ? null : val;
    }
    return JSON.stringify({
      s,
      q: this.questions(),
      a: this.accessItems(),
      c: this.criteria(),
    });
  }

  private resetBaseline(): void {
    this.baseline.set(this.snapshot());
  }

  // ==================== LOAD ====================
  private checkEditMode(): void {
    const guid = this.route.snapshot.paramMap.get('guid');
    if (guid) {
      this.isEditMode.set(true);
      this.surveyGuid.set(guid);
      this.loadSurveyForEdit(guid);
    }
  }

  private loadSurveyForEdit(guid: string): void {
    this.isLoading.set(true);

    this.surveyService.getDetailWithQuestions(guid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: any) => {
          if (!data || data.isSuccess === false || !data.survey) {
            this.isLoading.set(false);
            this.toastService.error(data?.message || 'خطا در بارگذاری اطلاعات');
            this.skipLeaveGuard = true;
            this.router.navigate(['/surveys/list']);
            return;
          }
          // سرور تعیین می‌کند: مالک فقط پیش از انتشار؛ مدیر سامانه همیشه
          this.readOnly.set(data.canEdit === false);
          this.adminEditingPublished.set(data.canEdit !== false && !!data.isAdmin && Number(data.status ?? 1) !== 1);
          const survey: WizardSurveyData = {
            ...data.survey,
            showType: String(data.survey.showType ?? '2'),
            accessType: data.survey.accessType != null ? String(data.survey.accessType) : '1',
            logoGuid: data.survey.logoGuid || undefined,
            backgroundImageGuid: data.survey.backgroundImageGuid || undefined,
            completionEffect: normalizeCompletionEffect(data.survey.completionEffect),
          };

          this.surveyData.set(survey);
          this.questions.set((data.questions ?? []).map((q: any) => normalizeQuestionFromServer(q)));
          if (data.accessItems) this.accessItems.set(data.accessItems);
          if (data.criteria) this.criteria.set(data.criteria);
          this.resetBaseline();
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading survey:', error);
          this.toastService.error(error?.message || 'خطا در بارگذاری اطلاعات');
          this.isLoading.set(false);
          this.skipLeaveGuard = true;
          this.router.navigate(['/surveys/list']);
        }
      });
  }

  // ==================== VALIDATION ====================
  private validateStep1(): string[] {
    const d = this.surveyData();
    const errors: string[] = [];
    if (!d.title?.trim()) errors.push('عنوان نظرسنجی الزامی است.');
    if (!d.startDate) errors.push('تاریخ شروع را مشخص کنید.');
    if (!d.endDate) errors.push('تاریخ پایان را مشخص کنید.');
    if (d.startDate && d.endDate && String(d.startDate) > String(d.endDate)) {
      errors.push('تاریخ شروع نباید بعد از تاریخ پایان باشد.');
    }
    if (d.maxResponses != null && (d.maxResponses as any) !== '' && Number(d.maxResponses) < 1) {
      errors.push('حداکثر تعداد پاسخ باید عددی بزرگ‌تر از صفر باشد.');
    }
    return errors;
  }

  isStepDone(step: number): boolean {
    return step < this.currentStep() && (this.stepErrors()[step]?.length ?? 0) === 0;
  }

  hasStepError(step: number): boolean {
    return this.attemptedSteps().has(step) && (this.stepErrors()[step]?.length ?? 0) > 0;
  }

  // ==================== NAVIGATION ====================
  goToStep(step: number): void {
    if (step < 1 || step > this.totalSteps() || step === this.currentStep()) return;

    // ✅ W6: همه‌ی مراحل قبل از مقصد باید معتبر باشند
    if (step > this.currentStep() && !this.ensureStepsValid(step)) return;

    this.setStep(step);
  }

  /** مراحل ۱ تا (target-1) را بررسی می‌کند؛ در صورت خطا به اولین مرحله‌ی نامعتبر می‌رود */
  private ensureStepsValid(target: number): boolean {
    for (let s = 1; s < target; s++) {
      const errs = this.stepErrors()[s] ?? [];
      if (errs.length > 0) {
        this.attemptedSteps.update(set => new Set(set).add(s));
        if (this.currentStep() !== s) this.setStep(s);
        this.toastService.error(errs[0]);
        return false;
      }
    }
    return true;
  }

  private setStep(step: number): void {
    this.currentStep.set(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextStep(): void {
    this.goToStep(this.currentStep() + 1);
  }

  previousStep(): void {
    if (this.canGoPrevious()) this.goToStep(this.currentStep() - 1);
  }

  // ==================== DATA UPDATES ====================
  onSurveyDataChange(data: WizardSurveyData): void {
    this.surveyData.update(prev => ({ ...prev, ...data }));
  }

  onQuestionsChange(questions: WizardQuestionData[]): void {
    this.questions.set(questions);
  }

  onAccessItemsChange(items: WizardAccessItem[]): void {
    this.accessItems.set(items);
  }

  onCriteriaChange(items: WizardCriterionData[]): void {
    this.criteria.set(items);
  }

  /** ثبت فایل آپلودشده در این نشست (برای پاک‌سازی در صورت رهاکردن) */
  onFileUploaded(_type: string, guid: string, _relatedId?: string): void {
    if (guid) this.pendingUploads.add(guid.toLowerCase());
  }

  /** فایل توسط آپلودر از سرور حذف شده — دیگر نیازی به پاک‌سازی نیست */
  onFileRemoved(guid: string | undefined): void {
    if (guid) this.pendingUploads.delete(guid.toLowerCase());
  }

  // ==================== SUBMIT ====================
  private buildDto(): CreateSurveyWithQuestionsDto {
    const s = this.surveyData();
    return {
      survey: {
        ...s,
        guid: this.isEditMode() ? this.surveyGuid() : undefined,
        // ✅ W8: مقدار فعلی مرحله‌ی ۱ منبع حقیقت است (حذف لوگو => null)
        logoGuid: s.logoGuid || null,
        backgroundImageGuid: s.backgroundImageGuid || null,
        maxResponses: s.maxResponses != null && (s.maxResponses as any) !== '' ? Number(s.maxResponses) : null,
        completionEffect: normalizeCompletionEffect(s.completionEffect),
      },
      questions: this.questions().map((q) => ({
        ...q,
        imageGuid: q.imageGuid || undefined,
        videoGuid: q.videoGuid || undefined,
        // ✅ W5: بک‌اند List<string> انتظار دارد
        matrixRows: [11, 12].includes(Number(q.questionType)) ? parseList(q.matrixRows) : undefined,
        matrixColumns: [11, 12].includes(Number(q.questionType)) ? parseList(q.matrixColumns) : undefined,
        options: q.options?.map(opt => ({
          ...opt,
          imageGuid: opt.imageGuid || undefined,
          color: opt.color || undefined,
        })),
      })),
      accessItems: this.accessItems().map(item => ({
        guid: item.guid,
        isRemoved: !!item.isRemoved,
        targetType: item.targetType,
        targetGuid: item.targetGuid,
        canView: item.canView,
        canRespond: item.canRespond,
        canViewResults: item.canViewResults,
        canEdit: item.canEdit,
        canDelete: item.canDelete,
        expirationDate: item.expirationDate,
      })),
      criteria: this.criteria().map(c => ({
        guid: c.guid,
        title: c.title,
        description: c.description,
        sortOrder: c.sortOrder,
        isRemoved: !!c.isRemoved,
      })),
    };
  }

  submitWizard(): void {
    if (this.readOnly()) {
      this.toastService.warning('نظرسنجی منتشر شده است و فقط مدیر سامانه می‌تواند آن را ویرایش کند.');
      return;
    }
    if (this.isSubmitting()) return;
    if (!this.canSubmit()) {
      if (this.ensureStepsValid(this.totalSteps())) {
        this.toastService.error('لطفاً تمام مراحل را کامل کنید');
      }
      return;
    }

    this.isSubmitting.set(true);
    const dto = this.buildDto();

    this.surveyService.createOrEditWithQuestions(dto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          this.isSubmitting.set(false);
          // ✅ W2: HttpService قدیمی ممکن است Result ناموفق را به‌جای throw برگرداند
          if (res == null || res?.isSuccess === false) {
            this.showErrorDialog(res?.message);
            return;
          }
          this.onSaveSucceeded(dto);
          this.showSuccessDialog();
        },
        error: (error) => {
          console.error('Error submitting wizard:', error);
          this.isSubmitting.set(false);
          this.showErrorDialog(error?.message || error?.error?.message);
        }
      });
  }

  private onSaveSucceeded(dto: CreateSurveyWithQuestionsDto): void {
    this.savedSuccessfully = true;

    // فایل‌هایی که در این نشست آپلود شدند اما در نسخه‌ی ذخیره‌شده ارجاعی ندارند (مثلاً جایگزین‌شده) یتیم‌اند
    const referenced = new Set<string>();
    const add = (g?: string | null) => { if (g) referenced.add(String(g).toLowerCase()); };
    add(dto.survey.logoGuid);
    add(dto.survey.backgroundImageGuid);
    dto.questions.forEach(q => {
      add(q.imageGuid);
      add(q.videoGuid);
      q.options?.forEach(o => add(o.imageGuid));
    });
    const orphans = [...this.pendingUploads].filter(g => !referenced.has(g));
    this.pendingUploads.clear();
    this.deleteFiles(orphans);
    this.resetBaseline();
  }

  private showErrorDialog(message?: string): void {
    this.swalService.fire({
      icon: 'error',
      title: 'ثبت نظرسنجی انجام نشد',
      text: message || 'خطا در ثبت اطلاعات. لطفاً دوباره تلاش کنید.',
      confirmButtonText: 'متوجه شدم',
      confirmButtonColor: '#1d4ed8',
    });
  }

  private showSuccessDialog(): void {
    const accessCount = this.visibleAccessCount();
    this.swalService.fire({
      icon: 'success',
      title: this.isEditMode() ? 'نظرسنجی ویرایش شد' : 'نظرسنجی ایجاد شد',
      html: `
        <div style="text-align:center;font-family:Sahel,Vazir,sans-serif">
          <p style="font-size:1.05rem;margin:16px 0;color:#334155">
            ${this.isEditMode()
          ? 'نظرسنجی و سوالات شما با موفقیت ویرایش شدند.'
          : 'نظرسنجی و سوالات شما با موفقیت ثبت شدند.'}
          </p>
          <p style="font-size:0.95rem;color:#64748b;margin-bottom:16px">
            تعداد سوالات: <b>${this.visibleQuestionCount()}</b>
            ${accessCount > 0 ? ` | تعداد دسترسی‌ها: <b>${accessCount}</b>` : ''}
          </p>
        </div>
      `,
      confirmButtonText: '<i class="fa fa-list"></i> بازگشت به لیست',
      confirmButtonColor: '#1d4ed8',
      allowOutsideClick: false
    }).then(() => {
      this.router.navigate(['/surveys/list']);
    });
  }

  cancel(): void {
    if (!this.hasUnsavedChanges()) {
      this.skipLeaveGuard = true;
      this.router.navigate(['/surveys/list']);
      return;
    }
    this.swalService.fire({
      icon: 'warning',
      title: this.isEditMode() ? 'انصراف از ویرایش نظرسنجی؟' : 'انصراف از ایجاد نظرسنجی؟',
      html: `
        <div style="text-align:center;font-family:Sahel,Vazir,sans-serif">
          <p style="margin:12px 0;color:#64748b">
            تغییرات ذخیره‌نشده ${this.pendingUploads.size > 0 ? 'و فایل‌های آپلود شده‌ی جدید' : ''} از بین خواهند رفت.
          </p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'بله، انصراف',
      cancelButtonText: 'ادامه ویرایش',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
      focusCancel: true,
    }).then((result) => {
      if (result.isConfirmed) {
        // پاک‌سازی در ngOnDestroy انجام می‌شود
        this.skipLeaveGuard = true;
        this.router.navigate(['/surveys/list']);
      }
    });
  }

  private async deleteFiles(guids: string[]): Promise<void> {
    if (!guids.length) return;
    try {
      await this.tusUploadService.deleteAttachments(guids);
    } catch (error) {
      console.error('Error cleaning up files:', error);
    }
  }
}
