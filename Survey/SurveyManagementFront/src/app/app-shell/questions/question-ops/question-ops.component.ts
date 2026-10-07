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
  FormArray,
  ReactiveFormsModule
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { map, distinctUntilChanged, startWith } from 'rxjs';

import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { SwalService } from '../../../services/framework-services/swal.service';
import { TusUploadService } from '../../../services/framework-services/tus-upload.service';

import {
  QuestionService,
  QuestionDetailDto,
  CreateQuestionOptionDto,
  CreateQuestionLogicDto,
  CreateOrEditQuestionDto
} from '../../../services/question.service';

import { AppSharedDataComponent } from '../../../shared/app-shared-data/app-shared-data';
import { CustomInputComponent } from '../../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../../shared/custom-controls/custom-select';

@Component({
  selector: 'app-question-ops',
  templateUrl: './question-ops.component.html',
  styleUrls: ['./question-ops.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
  ]
})
export class QuestionOpsComponent extends AppSharedDataComponent implements OnInit {
  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly questionService = inject(QuestionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly swalService = inject(SwalService);
  private readonly tusUploadService = inject(TusUploadService);
  private readonly destroyRef = inject(DestroyRef);

  // Signals
  private readonly _questionGuid = signal<string>('');
  private readonly _surveyGuid = signal<string>('');
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isEditMode = signal<boolean>(false);

  // Public computed
  readonly questionGuid = this._questionGuid.asReadonly();
  readonly surveyGuid = this._surveyGuid.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isEditMode = this._isEditMode.asReadonly();

  readonly pageTitle = computed(() =>
    this._isEditMode() ? 'ویرایش سوال' : 'افزودن سوال جدید'
  );

  readonly submitButtonText = computed(() =>
    this._isEditMode() ? 'ویرایش' : 'ثبت'
  );

  // Form
  questionForm!: FormGroup;
  options!: FormArray;
  logics!: FormArray;

  // Dropdown options
  readonly questionTypeOptions = [
    { guid: '1', title: 'چند گزینه‌ای (تک انتخابی)' },
    { guid: '2', title: 'چند گزینه‌ای (چند انتخابی)' },
    { guid: '3', title: 'متن کوتاه' },
    { guid: '4', title: 'متن بلند' },
    { guid: '5', title: 'امتیازدهی' },
    { guid: '8', title: 'تاریخ' },
    { guid: '9', title: 'آپلود فایل' },
    { guid: '10', title: 'لیست کشویی' },
    { guid: '11', title: 'ماتریس' }
  ];
  getQuestionTypeName(type: number): string {
    const types: Record<number, string> = {
      3: 'متن کوتاه',
      4: 'متن بلند',
      1: 'چند گزینه‌ای (تک)',
      2: 'چند گزینه‌ای (چند)',
      10: 'لیست کشویی',
      5: 'امتیازدهی',
      8: 'تاریخ',
      9: 'آپلود فایل',
      11: 'ماتریس'
    };
    return types[type] || 'نامشخص';
  }
  readonly validationTypeOptions = [
    { guid: '0', title: 'بدون اعتبارسنجی' },
    { guid: '1', title: 'ایمیل' },
    { guid: '2', title: 'شماره تلفن' },
    { guid: '3', title: 'URL' },
    { guid: '4', title: 'عددی' },
    { guid: '5', title: 'کد ملی' },
    { guid: '6', title: 'سفارشی (Regex)' }
  ];

  readonly logicTypeOptions = [
    { guid: '1', title: 'نمایش سوال' },
    { guid: '2', title: 'پرش به سوال' },
    { guid: '3', title: 'اتمام نظرسنجی' }
  ];

  readonly conditionOperatorOptions = [
    { guid: '1', title: 'برابر است' },
    { guid: '2', title: 'برابر نیست' },
    { guid: '3', title: 'شامل می‌شود' },
    { guid: '4', title: 'شامل نمی‌شود' }
  ];

  // ⭐ Signal برای نوع سوال انتخاب شده (به جای computed)
  readonly selectedQuestionType = signal<number>(1);

  // Computed signals بر اساس selectedQuestionType
  readonly needsOptions = computed(() => {
    const type = this.selectedQuestionType();
    return type === 1|| type === 2 || type === 10;
  });

  readonly needsScaleLabels = computed(() => this.selectedQuestionType() === 5);
  readonly needsFileSettings = computed(() => this.selectedQuestionType() === 9);
  readonly needsMatrix = computed(() => this.selectedQuestionType() === 11);

  readonly needsValidation = computed(() => {
    const type = this.selectedQuestionType();
    return type === 3 || type === 4;
  });

  constructor() {
    super();
    this.initializeBreadcrumbs();
    this.initializeForm();
    this.setupEffects();
  }

  private initializeBreadcrumbs(): void {
    this.breadcrumbService.setItems([
      { label: 'نظرسنجی‌ها', routerLink: '/surveys/list' },
      { label: 'سوالات', routerLink: '/questions/list' },
      { label: 'افزودن سوال', routerLink: '/questions/create' }
    ]);
  }

  private initializeForm(): void {
    this.questionForm = this.fb.group({
      guid: [''],
      surveyGuid: ['', Validators.required],

      questionText: ['', [Validators.required, Validators.maxLength(500)]],
      questionType: [1, Validators.required],
      sortOrder: [1, Validators.required],
      isRequired: [false],

      helpText: [''],
      placeholder: [''],

      randomizeOptions: [false],
      allowOtherOption: [false],
      otherOptionText: ['دیگر'],

      imageUrl: [''],
      videoUrl: [''],

      validationType: [0],
      validationErrorMessage: [''],
      customValidationRegex: [''],

      minLength: [null],
      maxLength: [null],
      minValue: [null],
      maxValue: [null],
      minSelections: [null],
      maxSelections: [null],

      maxFileSize: [null],
      allowedFileTypes: [''],

      minScaleLabel: [''],
      maxScaleLabel: [''],

      matrixRows: [''],
      matrixColumns: [''],

      options: this.fb.array([]),
      logics: this.fb.array([])
    });

    this.options = this.questionForm.get('options') as FormArray;
    this.logics = this.questionForm.get('logics') as FormArray;
  }

  private setupEffects(): void {
    effect(() => {
      const paramMap = this.route.snapshot.paramMap;
      const queryParams = this.route.snapshot.queryParams;

      const guid = paramMap.get('guid') || '';
      const surveyGuid = queryParams['surveyGuid'] || '';

      if (guid !== this._questionGuid()) {
        this._questionGuid.set(guid);
        this._isEditMode.set(!!guid);

        if (guid) {
          untracked(() => this.loadQuestion());
        }
      }

      if (surveyGuid && surveyGuid !== this._surveyGuid()) {
        this._surveyGuid.set(surveyGuid);
        this.questionForm.patchValue({ surveyGuid });
      }
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.subscribeToRouteParams();
    this.setupFormListeners(); // ⭐ مهم: Listen کردن به تغییرات form
  }

  private subscribeToRouteParams(): void {
    this.route.paramMap
      .pipe(
        map(params => params.get('guid') || ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(id => {
        this._questionGuid.set(id);
        this._isEditMode.set(!!id);
        if (id) this.loadQuestion();
      });

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const surveyGuid = params['surveyGuid'] || params['surveyId'];
        if (surveyGuid && surveyGuid !== this._surveyGuid()) {
          this._surveyGuid.set(surveyGuid);
          this.questionForm.patchValue({ surveyGuid });
        }
      });
  }

  /**
   * ⭐ مهم: Listen کردن به تغییرات questionType
   * این متد باعث می‌شود وقتی کاربر نوع سوال را تغییر می‌دهد،
   * UI به‌روز شود و بخش‌های مربوطه نمایش داده شوند
   */
  private setupFormListeners(): void {
    // Listen به تغییرات questionType
    this.questionForm.get('questionType')?.valueChanges
      .pipe(
        startWith(this.questionForm.get('questionType')?.value || 1),
        map(value => Number(value)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(type => {
        this.selectedQuestionType.set(type);
        console.log('Question type changed:', type); // برای debug
      });
  }

  private loadQuestion(): void {
    const guid = this._questionGuid();
    if (!guid) return;

    this._isLoading.set(true);

    this.questionService
      .getDetail(guid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (question: QuestionDetailDto) => {
          this.patchQuestionForm(question);
          this._isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading question:', error);
          this.toastService.error('خطا در بارگذاری سوال');
          this._isLoading.set(false);
        }
      });
  }

  private patchQuestionForm(question: QuestionDetailDto): void {
    this.questionForm.patchValue({
      guid: question.guid,
      surveyGuid: this._surveyGuid() || this.questionForm.get('surveyGuid')?.value,

      questionText: question.questionText,
      questionType: question.questionType,
      sortOrder: question.sortOrder,
      isRequired: question.isRequired,

      helpText: question.helpText,
      placeholder: question.placeholder,

      randomizeOptions: question.randomizeOptions,
      allowOtherOption: question.allowOtherOption,
      otherOptionText: question.otherOptionText,

      imageUrl: question.imageUrl,
      videoUrl: question.videoUrl,

      validationType: question.validationType ?? 0,
      validationErrorMessage: question.validationErrorMessage,
      customValidationRegex: question.customValidationRegex,

      minLength: question.minLength,
      maxLength: question.maxLength,
      minValue: question.minValue,
      maxValue: question.maxValue,
      minSelections: question.minSelections,
      maxSelections: question.maxSelections,

      maxFileSize: question.maxFileSize,
      allowedFileTypes: question.allowedFileTypes,

      minScaleLabel: question.minScaleLabel,
      maxScaleLabel: question.maxScaleLabel,

      matrixRows: (question.matrixRows || []).join(','),
      matrixColumns: (question.matrixColumns || []).join(',')
    });

    // Options
    this.options.clear();
    (question.options || []).forEach(opt => {
      this.addOption(opt.optionText, opt.sortOrder, opt.value, opt.imageUrl, opt.color);
    });

    // Logics
    this.logics.clear();
    (question.logics || []).forEach(l => this.addLogicFromDetail(l));

    // ⭐ به‌روز کردن selectedQuestionType بعد از patch
    const type = Number(question.questionType);
    this.selectedQuestionType.set(type);
  }

  // ==================== OPTIONS MANAGEMENT ====================
  addOption(
    text: string = '',
    sortOrder?: number,
    value?: string,
    imageUrl?: string,
    color?: string
  ): void {
    const order = sortOrder ?? this.options.length + 1;
    const optionGroup = this.fb.group({
      optionText: [text, Validators.required],
      sortOrder: [order],
      value: [value || ''],
      imageUrl: [imageUrl || ''],
      color: [color || '']
    });
    this.options.push(optionGroup);
  }

  removeOption(index: number): void {
    this.options.removeAt(index);
    this.options.controls.forEach((control, idx) => {
      control.patchValue({ sortOrder: idx + 1 });
    });
  }

  // ==================== LOGICS MANAGEMENT ====================
  addLogic(): void {
    const logicGroup = this.fb.group({
      targetQuestionGuid: [null],
      logicType: [1],
      conditionOperator: [1],
      conditionValue: [''],
      optionGuid: [null],
      priority: [1]
    });
    this.logics.push(logicGroup);
  }

  private addLogicFromDetail(detail: any): void {
    const logicGroup = this.fb.group({
      targetQuestionGuid: [detail?.targetQuestionGuid || null],
      logicType: [detail?.logicTypeEnum ?? 1],
      conditionOperator: [detail?.conditionOperatorEnum ?? 1],
      conditionValue: [detail?.conditionValue || ''],
      optionGuid: [detail?.optionGuid ?? null],
      priority: [detail?.priority ?? 1]
    });
    this.logics.push(logicGroup);
  }

  removeLogic(index: number): void {
    this.logics.removeAt(index);
  }

  // ==================== SUBMIT ====================
  submitQuestion(): void {
    if (this.questionForm.invalid) {
      this.questionForm.markAllAsTouched();
      this.toastService.error('لطفاً تمام فیلدهای الزامی را پر کنید');
      return;
    }

    if (this.needsOptions() && this.options.length === 0) {
      this.toastService.error('لطفاً حداقل یک گزینه اضافه کنید');
      return;
    }

    this._isLoading.set(true);

    const v = this.questionForm.value;

    const optionsArray: CreateQuestionOptionDto[] = this.options.controls.map(c => ({
      optionText: c.value.optionText,
      sortOrder: Number(c.value.sortOrder),
      value: c.value.value || undefined,
      imageUrl: c.value.imageUrl || undefined,
      color: c.value.color || undefined
    }));

    const logicsArray: CreateQuestionLogicDto[] = this.logics.controls.map(c => ({
      targetQuestionGuid: c.value.targetQuestionGuid || undefined,
      logicType: Number(c.value.logicType),
      conditionOperator: Number(c.value.conditionOperator),
      conditionValue: c.value.conditionValue || undefined,
      optionGuid: c.value.optionGuid || undefined,
      priority: c.value.priority ? Number(c.value.priority) : undefined
    }));

    const dto: CreateOrEditQuestionDto = {
      guid: v.guid || undefined,
      surveyGuid: v.surveyGuid || this._surveyGuid(),

      questionText: v.questionText,
      questionType: Number(v.questionType),
      sortOrder: Number(v.sortOrder),
      isRequired: !!v.isRequired,

      helpText: v.helpText || undefined,
      placeholder: v.placeholder || undefined,

      randomizeOptions: !!v.randomizeOptions,
      allowOtherOption: !!v.allowOtherOption,
      otherOptionText: v.otherOptionText || undefined,

      imageUrl: v.imageUrl || undefined,
      videoUrl: v.videoUrl || undefined,

      validationType: v.validationType !== null && v.validationType !== undefined
        ? Number(v.validationType)
        : undefined,
      validationErrorMessage: v.validationErrorMessage || undefined,
      customValidationRegex: v.customValidationRegex || undefined,

      minLength: v.minLength ?? undefined,
      maxLength: v.maxLength ?? undefined,
      minValue: v.minValue ?? undefined,
      maxValue: v.maxValue ?? undefined,
      minSelections: v.minSelections ?? undefined,
      maxSelections: v.maxSelections ?? undefined,

      maxFileSize: v.maxFileSize ?? undefined,
      allowedFileTypes: v.allowedFileTypes || undefined,

      minScaleLabel: v.minScaleLabel || undefined,
      maxScaleLabel: v.maxScaleLabel || undefined,

      matrixRows: v.matrixRows
        ? String(v.matrixRows)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
        : undefined,
      matrixColumns: v.matrixColumns
        ? String(v.matrixColumns)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
        : undefined,

      options: this.needsOptions() ? optionsArray : undefined,
      logics: logicsArray.length ? logicsArray : undefined
    };

    this.questionService
      .createOrEdit(dto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const title = this._isEditMode() ? 'ویرایش سوال' : 'ثبت سوال';
          const text = this._isEditMode()
            ? 'سوال با موفقیت ویرایش شد'
            : 'سوال با موفقیت ثبت شد';

          this.swalService.fireSucceddedSwal(title, text);
          this.backToQuestions();
        },
        error: (error) => {
          console.error('Error submitting question:', error);
          this.toastService.error('خطا در ثبت سوال');
          this._isLoading.set(false);
        }
      });
  }

  cancel(): void {
    this.backToQuestions();
  }

  private backToQuestions(): void {
    const surveyGuid = this._surveyGuid() || this.questionForm.get('surveyGuid')?.value;

    if (surveyGuid) {
      this.router.navigate(['/questions/list'], {
        queryParams: { surveyGuid }
      });
    } else {
      this.router.navigate(['/surveys/list']);
    }
  }
}