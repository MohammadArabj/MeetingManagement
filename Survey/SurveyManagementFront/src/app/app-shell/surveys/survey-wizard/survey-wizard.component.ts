// ============================================================
// survey-wizard.component.ts
// ✅ تغییرات: اضافه شدن Step 3 (دسترسی‌ها) و تبدیل به 4 مرحله
// ============================================================

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  DestroyRef
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
  WizardUploadedFiles,
  WizardAccessItem,
  createEmptyUploadedFiles,
  CreateSurveyWithQuestionsDto,
  WizardCriterionData,
} from '../../../core/models/survey-wizard.model';
import { SurveyWizardStep1Component } from './survey-wizard-steps/step1-survey-info.component';
import { SurveyWizardStep2Component } from './survey-wizard-steps/step2-questions.component';
import { SurveyWizardStep3AccessComponent } from './survey-wizard-steps/step3-access-control.component';
import { SurveyWizardStep4ReviewComponent } from './survey-wizard-steps/step4-review.component';

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
export class SurveyWizardComponent extends AppSharedDataComponent implements OnInit, OnDestroy {
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
  readonly isEditMode = signal<boolean>(false);
  readonly surveyGuid = signal<string>('');

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
    themeColor: '#667eea',
    hasCriteria: false, // ✅
  });

  readonly questions = signal<WizardQuestionData[]>([]);
  // signal جدید کنار accessItems
  readonly criteria = signal<WizardCriterionData[]>([]);
  // ✅ NEW: لیست دسترسی‌ها
  readonly accessItems = signal<WizardAccessItem[]>([]);

  // مدیریت فایل‌های آپلود شده
  readonly uploadedFiles = signal<WizardUploadedFiles>(createEmptyUploadedFiles());

  // ⭐ Computed — ✅ تغییر به 4 مرحله
  readonly totalSteps = computed(() => 4);

  readonly progress = computed(() =>
    (this.currentStep() / this.totalSteps()) * 100
  );

  readonly canGoNext = computed(() => {
    const step = this.currentStep();
    if (step === 1) return this.isStep1Valid();
    if (step === 2) return this.questions().filter(q => !q.isRemoved).length > 0;
    if (step === 3) return true;
    return false;
  });

  readonly canSubmit = computed(() =>
    this.currentStep() === 4 &&
    this.isStep1Valid() &&
    this.questions().filter(q => !q.isRemoved).length > 0
  );

  readonly canGoPrevious = computed(() => this.currentStep() > 1);


  readonly stepTitle = computed(() => {
    switch (this.currentStep()) {
      case 1: return 'اطلاعات نظرسنجی';
      case 2: return 'افزودن سوالات';
      case 3: return 'مدیریت دسترسی‌ها';    // ✅ NEW
      case 4: return 'بررسی نهایی';
      default: return '';
    }
  });

  readonly stepDescription = computed(() => {
    switch (this.currentStep()) {
      case 1: return 'لطفاً اطلاعات اولیه نظرسنجی را وارد کنید';
      case 2: return 'سوالات خود را اضافه و مرتب کنید';
      case 3: return 'مشخص کنید چه افرادی به نظرسنجی دسترسی داشته باشند'; // ✅ NEW
      case 4: return 'اطلاعات را بررسی و نظرسنجی را ثبت کنید';
      default: return '';
    }
  });

  constructor() {
    super();
    this.initializeBreadcrumbs();
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
  }

  ngOnDestroy(): void {
    if (!this.isEditMode()) {
      this.cleanupUploadedFiles();
    }
  }

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
        next: (data) => {
          const survey = {
            ...data.survey,
            showType: String(data.survey.showType),
          };

          this.surveyData.set(survey);
          this.questions.set(data.questions);
          // ✅ لود دسترسی‌ها در حالت ویرایش (اگر API برمی‌گرداند)
          if (data.accessItems) {
            this.accessItems.set(data.accessItems);
          }
          if (data.criteria) {
            this.criteria.set(data.criteria);
          }
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading survey:', error);
          this.toastService.error('خطا در بارگذاری اطلاعات');
          this.isLoading.set(false);
          this.router.navigate(['/surveys/list']);
        }
      });
  }

  // ==================== VALIDATION ====================
  private isStep1Valid(): boolean {
    const data = this.surveyData();
    return !!(
      data.title?.trim() &&
      data.startDate &&
      data.endDate
    );
  }

  // ==================== NAVIGATION ====================
  goToStep(step: number): void {
    if (step < 1 || step > this.totalSteps()) return;

    if (step > this.currentStep()) {
      if (this.currentStep() === 1 && !this.isStep1Valid()) {
        this.toastService.error('لطفاً تمام فیلدهای الزامی را پر کنید');  // ⚠️ اینجا صدا زده نمیشه
        return;
      }
      if (this.currentStep() === 2 && this.questions().length === 0) {
        this.toastService.error('لطفاً حداقل یک سوال اضافه کنید');       // ⚠️ اینجا هم
        return;
      }
    }

    this.currentStep.set(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextStep(): void {
    this.goToStep(this.currentStep() + 1);
  }

  previousStep(): void {
    if (this.canGoPrevious()) {
      this.goToStep(this.currentStep() - 1);
    }
  }

  // ==================== DATA UPDATES ====================
  onSurveyDataChange(data: WizardSurveyData): void {
    this.surveyData.set(data);
  }

  onQuestionsChange(questions: WizardQuestionData[]): void {
    this.questions.set(questions);
  }

  // ✅ NEW: تغییر لیست دسترسی‌ها
  onAccessItemsChange(items: WizardAccessItem[]): void {
    this.accessItems.set(items);
  }
  onCriteriaChange(items: WizardCriterionData[]): void {
    this.criteria.set(items);
  }
  // مدیریت فایل‌های آپلود شده
  onFileUploaded(type: 'logo' | 'background' | 'questionImage' | 'questionVideo' | 'optionImage', guid: string, relatedId?: string): void {
    this.uploadedFiles.update(files => {
      const updated = { ...files };

      switch (type) {
        case 'logo':
          updated.logo = guid;
          break;
        case 'background':
          updated.backgroundImage = guid;
          break;
        case 'questionImage':
          if (relatedId) updated.questionImages.set(relatedId, guid);
          break;
        case 'questionVideo':
          if (relatedId) updated.questionVideos.set(relatedId, guid);
          break;
        case 'optionImage':
          if (relatedId) updated.optionImages.set(relatedId, guid);
          break;
      }

      return updated;
    });
  }

  // ==================== SUBMIT ====================
  async submitWizard(): Promise<void> {
    if (!this.canSubmit()) {
      this.toastService.error('لطفاً تمام مراحل را کامل کنید');
      return;
    }

    this.isLoading.set(true);

    const dto: CreateSurveyWithQuestionsDto = {
      survey: {
        guid: this.isEditMode() ? this.surveyGuid() : undefined,
        ...this.surveyData(),
        // ✅ اگر فایل جدید آپلود نشده، مقدار قبلی حفظ شود (نه اینکه خالی بشه)
        logoGuid: this.uploadedFiles().logo ?? this.surveyData().logoGuid ?? '',
        backgroundImageGuid: this.uploadedFiles().backgroundImage ?? this.surveyData().backgroundImageGuid ?? '',
      },
      questions: this.questions().map((q) => ({
        ...q,
        // ✅ همان منطق برای عکس/ویدیوی سوال
        imageGuid: this.uploadedFiles().questionImages.get(q.tempId) ?? q.imageGuid,
        videoGuid: this.uploadedFiles().questionVideos.get(q.tempId) ?? q.videoGuid,
        options: q.options?.map(opt => ({
          ...opt,
          imageGuid: this.uploadedFiles().optionImages.get(opt.tempId) ?? opt.imageGuid,
        })),
      })),
      accessItems: this.accessItems().map(item => ({
        guid: item.guid,             // ✅ جدید — برای اینکه بک‌اند بفهمه ویرایش است یا جدید
        isRemoved: !!item.isRemoved, // ✅ جدید
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

    this.surveyService.createOrEditWithQuestions(dto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isLoading.set(false);
          this.showSuccessDialog(response);
        },
        error: (error) => {
          console.error('Error submitting wizard:', error);
          this.toastService.error('خطا در ثبت اطلاعات');
          this.isLoading.set(false);
        }
      });
  }

  private showSuccessDialog(response: any): void {
    this.swalService.fire({
      icon: 'success',
      title: this.isEditMode() ? '✅ نظرسنجی ویرایش شد!' : '✅ نظرسنجی ایجاد شد!',
      html: `
        <div style="text-align:center;font-family:Sahel,Vazir,sans-serif">
          <p style="font-size:1.1rem;margin:16px 0;color:#334155">
            ${this.isEditMode()
          ? 'نظرسنجی و سوالات شما با موفقیت ویرایش شدند.'
          : 'نظرسنجی و سوالات شما با موفقیت ثبت شدند.'}
          </p>
          <p style="font-size:0.95rem;color:#64748b;margin-bottom:16px">
            تعداد سوالات: <b>${this.questions().length}</b>
            ${this.accessItems().length > 0
          ? ` | تعداد دسترسی‌ها: <b>${this.accessItems().length}</b>`
          : ''}
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
    this.swalService.fire({
      icon: 'warning',
      title: 'انصراف از ایجاد نظرسنجی؟',
      html: `
        <div style="text-align:center;font-family:Sahel,Vazir,sans-serif">
          <p style="margin:12px 0;color:#64748b">
            تمام اطلاعات وارد شده ${this.hasUploadedFiles() ? 'و فایل‌های آپلود شده' : ''} از بین خواهند رفت.
          </p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'بله، انصراف',
      cancelButtonText: 'ادامه',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.cleanupUploadedFiles();
        this.router.navigate(['/surveys/list']);
      }
    });
  }

  private hasUploadedFiles(): boolean {
    const files = this.uploadedFiles();
    return !!(
      files.logo ||
      files.backgroundImage ||
      files.questionImages.size > 0 ||
      files.questionVideos.size > 0 ||
      files.optionImages.size > 0
    );
  }

  private async cleanupUploadedFiles(): Promise<void> {
    const files = this.uploadedFiles();
    const guidsToDelete: string[] = [];

    if (files.logo) guidsToDelete.push(files.logo);
    if (files.backgroundImage) guidsToDelete.push(files.backgroundImage);

    files.questionImages.forEach(guid => guidsToDelete.push(guid));
    files.questionVideos.forEach(guid => guidsToDelete.push(guid));
    files.optionImages.forEach(guid => guidsToDelete.push(guid));

    if (guidsToDelete.length > 0) {
      try {
        await this.tusUploadService.deleteAttachments(guidsToDelete);
        console.log(`Cleaned up ${guidsToDelete.length} uploaded files`);
      } catch (error) {
        console.error('Error cleaning up files:', error);
      }
    }
  }
}