import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
  untracked,
  DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormGroup,
  FormBuilder,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { map, distinctUntilChanged } from 'rxjs';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { SwalService } from '../../../services/framework-services/swal.service';
import { SurveyService, SurveyDetailDto, CreateOrEditSurveyDto } from '../../../services/survey.service';
import { AppSharedDataComponent } from '../../../shared/app-shared-data/app-shared-data';
import { CustomInputComponent } from '../../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../../shared/custom-controls/custom-select';

@Component({
  selector: 'app-survey-ops',
  templateUrl: './survey-ops.component.html',
  styleUrls: ['./survey-ops.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CustomInputComponent
  ]
})
export class SurveyOpsComponent extends AppSharedDataComponent implements OnInit {
  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly surveyService = inject(SurveyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly swalService = inject(SwalService);
  private readonly destroyRef = inject(DestroyRef);
  // Signals
  private readonly _surveyId = signal<string>('');
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isEditMode = signal<boolean>(false);

  // Public computed
  readonly surveyId = this._surveyId.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isEditMode = this._isEditMode.asReadonly();

  readonly pageTitle = computed(() =>
    this._isEditMode() ? 'ویرایش نظرسنجی' : 'ثبت نظرسنجی جدید'
  );

  readonly submitButtonText = computed(() =>
    this._isEditMode() ? 'ویرایش' : 'ثبت'
  );

  // Form
  surveyForm!: FormGroup;

  // Dropdown options
  readonly accessTypeOptions = [
    { guid: '1', title: 'عمومی' },
    { guid: '2', title: 'محدود' },
    { guid: '3', title: 'خصوصی' }
  ];

  constructor() {
    super();
    this.initializeBreadcrumbs();
    this.initializeForm();
    this.setupEffects();
  }

  private initializeBreadcrumbs(): void {
    this.breadcrumbService.setItems([
      { label: 'نظرسنجی‌ها', routerLink: '/surveys/list' },
      { label: 'ثبت نظرسنجی', routerLink: '/surveys/create' }
    ]);
  }

  private initializeForm(): void {
    this.surveyForm = this.fb.group({
      guid: [''],
      title: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['',  Validators.maxLength(1000)],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      accessType: [1, Validators.required],
      allowAnonymous: [false],
      allowSaveDraft: [true],
      showProgressBar: [true],
      randomizeQuestions: [false],
      allowMultipleResponses: [false],
      requireLogin: [true],
      welcomeMessage: [''],
      thankYouMessage: [''],
      maxResponses: [null],
      themeColor: ['#667eea'],
      logoUrl: [''],
      backgroundImageUrl: ['']
    }, { validators: this.dateRangeValidator });
  }

  private setupEffects(): void {
    effect(() => {
      const paramMap = this.route.snapshot.paramMap;
      const id = paramMap.get('guid') || '';

      if (id !== this._surveyId()) {
        this._surveyId.set(id);
        this._isEditMode.set(!!id);

        if (id) {
          untracked(() => this.loadSurvey());
        }
      }
    });
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    this.subscribeToRouteParams();
  }

  private subscribeToRouteParams(): void {
    this.route.paramMap
      .pipe(
        map(params => params.get('guid') || ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(id => {
        this._surveyId.set(id);
        this._isEditMode.set(!!id);

        if (id) {
          this.loadSurvey();
        }
      });
  }

  private async loadSurvey(): Promise<void> {
    const id = this._surveyId();
    if (!id) return;

    this._isLoading.set(true);

    try {
      this.surveyService.getDetail(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (survey: SurveyDetailDto) => {
            this.patchSurveyForm(survey);
            this._isLoading.set(false);
          },
          error: (error) => {
            console.error('Error loading survey:', error);
            this.toastService.error('خطا در بارگذاری نظرسنجی');
            this._isLoading.set(false);
          }
        });
    } catch (error) {
      console.error('Error in loadSurvey:', error);
      this._isLoading.set(false);
    }
  }

  private patchSurveyForm(survey: SurveyDetailDto): void {
    this.surveyForm.patchValue({
      guid: survey.guid,
      title: survey.title,
      description: survey.description,
      startDate: survey.startDate,
      endDate: survey.endDate,
      accessType: survey.accessType,
      allowAnonymous: survey.allowAnonymous,
      allowSaveDraft: survey.allowSaveDraft,
      showProgressBar: survey.showProgressBar,
      randomizeQuestions: survey.randomizeQuestions,
      allowMultipleResponses: survey.allowMultipleResponses,
      requireLogin: survey.requireLogin,
      welcomeMessage: survey.welcomeMessage,
      thankYouMessage: survey.thankYouMessage,
      maxResponses: survey.maxResponses,
      themeColor: survey.themeColor,
      logoUrl: survey.logoUrl,
      backgroundImageUrl: survey.backgroundImageUrl
    });
  }

  private dateRangeValidator(group: FormGroup): { [key: string]: any } | null {
    const startDate = group.get('startDate')?.value;
    const endDate = group.get('endDate')?.value;

    if (startDate && endDate && startDate > endDate) {
      return { dateRangeInvalid: true };
    }

    return null;
  }

  async submitSurvey(): Promise<void> {
    if (this.surveyForm.invalid) {
      this.surveyForm.markAllAsTouched();
      this.toastService.error('لطفاً تمام فیلدهای الزامی را پر کنید');
      return;
    }

    this._isLoading.set(true);

    const formValue = this.surveyForm.value;
    const dto: CreateOrEditSurveyDto = {
      guid: formValue.guid || undefined,
      title: formValue.title,
      description: formValue.description,
      startDate: formValue.startDate,
      endDate: formValue.endDate,
      accessType: Number(formValue.accessType),
      allowAnonymous: formValue.allowAnonymous ?? false,
      allowSaveDraft: formValue.allowSaveDraft ?? false,
      showProgressBar: formValue.showProgressBar ?? false,
      randomizeQuestions: formValue.randomizeQuestions ?? false,
      allowMultipleResponses: formValue.allowMultipleResponses ?? false,
      requireLogin: formValue.requireLogin ?? false,
      welcomeMessage: formValue.welcomeMessage || undefined,
      thankYouMessage: formValue.thankYouMessage || undefined,
      maxResponses: formValue.maxResponses || undefined,
      themeColor: formValue.themeColor || undefined,
      logoUrl: formValue.logoUrl || undefined,
      backgroundImageUrl: formValue.backgroundImageUrl || undefined
    };

    this.surveyService.createOrEdit(dto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const isEdit = this._isEditMode();
          const surveyGuid = response?.guid || formValue.guid;

          if (isEdit) {
            // حالت ویرایش: فقط پیام موفقیت و بازگشت
            this.swalService.fireSucceddedSwal('ویرایش نظرسنجی', 'نظرسنجی با موفقیت ویرایش شد');
            this.router.navigate(['/surveys/list']);
          } else {
            // حالت ایجاد: پیام با دو گزینه
            this.showSuccessWithOptions(surveyGuid);
          }
        },
        error: (error) => {
          console.error('Error submitting survey:', error);
          this.toastService.error('خطا در ثبت نظرسنجی');
          this._isLoading.set(false);
        }
      });
  }

  cancel(): void {
    this.router.navigate(['/surveys/list']);
  }

  /**
   * نمایش پیام موفقیت با دو گزینه:
   * 1. افزودن سوالات (primary)
   * 2. بازگشت به لیست (ghost)
   */
  private showSuccessWithOptions(surveyGuid: string): void {
    this.swalService.fire({
      icon: 'success',
      title: '✅ نظرسنجی ایجاد شد!',
      html: `
        <div style="text-align:center;font-family:Sahel,Vazir,sans-serif">
          <p style="font-size:1.1rem;margin:16px 0;color:#334155">
            نظرسنجی شما با موفقیت ثبت شد.
          </p>
          <p style="font-size:0.95rem;color:#64748b;margin-bottom:24px">
            اکنون می‌توانید سوالات خود را اضافه کنید یا بعداً این کار را انجام دهید.
          </p>
        </div>
      `,
      showCancelButton: true,
      showConfirmButton: true,
      confirmButtonText: '<i class="fa fa-plus" style="margin-left:6px"></i> افزودن سوالات',
      cancelButtonText: '<i class="fa fa-list" style="margin-left:6px"></i> بازگشت به لیست',
      confirmButtonColor: '#1d4ed8',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
      allowOutsideClick: false,
      customClass: {
        confirmButton: 'swal-btn-primary',
        cancelButton: 'swal-btn-ghost'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        // کاربر "افزودن سوالات" را انتخاب کرد
        this.router.navigate(['/questions/list'], {
          queryParams: { surveyGuid }
        });
      } else {
        // کاربر "بازگشت به لیست" را انتخاب کرد
        this.router.navigate(['/surveys/list']);
      }
    });
  }
}