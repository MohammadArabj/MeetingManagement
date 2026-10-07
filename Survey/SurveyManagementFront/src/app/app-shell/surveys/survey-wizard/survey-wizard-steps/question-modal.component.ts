import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { distinctUntilChanged, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CustomInputComponent } from '../../../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../../../shared/custom-controls/custom-select';
import { FileUploaderComponent } from '../../../../shared/file-uploader/file-uploader.component';
import { WizardCriterionData, WizardQuestionData } from '../../../../core/models/survey-wizard.model';
export interface QuestionModalSaveEvent {
  question: WizardQuestionData;
  criterionGuid?: string;
}
@Component({
  selector: 'app-question-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    CustomInputComponent,
    CustomSelectComponent,
    FileUploaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modalOverlay">
      <div class="modalContent" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="modalHeader">
          <h2>{{ isEditMode() ? 'ویرایش سوال' : 'افزودن سوال جدید' }}</h2>
          <button type="button" class="closeBtn" (click)="onCancel()">
            <i class="fa fa-times"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="modalBody">
        <form [formGroup]="form">

  <!-- ========== انتخاب معیار (فقط اگر نظرسنجی معیار محور است) ========== -->
  @if (hasCriteria) {
    <div class="section criterionSection">
      <h3 class="sectionTitle"><i class="fa fa-layer-group"></i> معیار مرتبط</h3>
      <select class="in" [(ngModel)]="selectedCriterionGuid" [ngModelOptions]="{standalone: true}">
        <option value="">بدون معیار</option>
        @for (c of criteria; track c.guid) {
          <option [value]="c.guid">{{ c.title }}</option>
        }
      </select>
    </div>
    <div class="sp-16"></div>
  }

  <!-- ========== اطلاعات پایه ========== -->
  <div class="section">
              <h3 class="sectionTitle">اطلاعات پایه</h3>

              <custom-select
                label="نوع سوال"
                formControlName="questionType"
                [options]="questionTypes"
                identity="questionType"
                [required]="true">
              </custom-select>

              <div class="sp-12"></div>

              <custom-input
                label="متن سوال"
                formControlName="questionText"
                type="textarea"
                rows="3"
                identity="questionText"
                [required]="true"
                placeholder="سوال خود را وارد کنید">
              </custom-input>

              <div class="sp-12"></div>

              <div class="grid grid-2">
                <custom-input
                  label="متن راهنما"
                  formControlName="helpText"
                  identity="helpText"
                  placeholder="توضیحات کمکی">
                </custom-input>

                <custom-input
                  label="Placeholder"
                  formControlName="placeholder"
                  identity="placeholder"
                  placeholder="متن پیش‌فرض">
                </custom-input>
              </div>

              <div class="sp-12"></div>

              <label class="choice">
                <input type="checkbox" formControlName="isRequired" />
                <span>این سوال الزامی است</span>
              </label>
            </div>

            <div class="sp-16"></div>

            <!-- ========== گزینه‌ها (Options) ========== -->
            @if (showOptions()) {
              <div class="section">
                <div class="sectionHeader">
                  <h3 class="sectionTitle">گزینه‌ها</h3>
                  <button type="button" class="btn sm primary" (click)="addOption()">
                    <i class="fa fa-plus"></i>
                    افزودن
                  </button>
                </div>

                <!-- ✅ مهم: formArrayName -->
                <div formArrayName="options" class="optionsList">
                  @for (opt of options.controls; track trackOption($index, opt)) {
                    <div class="optionItem" [formGroupName]="$index">
                      <div class="optionItem__number">{{ $index + 1 }}</div>

                      <div class="optionItem__inputs">
                        <input
                          type="text"
                          class="in"
                          formControlName="optionText"
                          placeholder="متن گزینه"
                          style="flex: 2;">

                        <input
                          type="number"
                          class="in"
                          formControlName="value"
                          placeholder="مقدار"
                          style="flex: 1;">

                        <input
                          type="color"
                          class="in"
                          formControlName="color"
                          title="رنگ"
                          style="width: 50px;">
                      </div>

                      <!-- <div class="optionItem__actions">
                        @if (optionImageGuids()[$index]) {
                          <div class="badge ok">
                            <i class="fa fa-image"></i>
                            تصویر
                          </div>
                          <button type="button" class="btn xs danger" (click)="removeOptionImage($index)">
                            <i class="fa fa-times"></i>
                          </button>
                        } @else {
                          <button type="button" class="btn xs" (click)="pickOptionImage($index)">
                            <i class="fa fa-image"></i>
                          </button>
                        }

                        <button
                          type="button"
                          class="btn xs danger"
                          (click)="removeOption($index)"
                          [disabled]="options.length <= 2">
                          <i class="fa fa-trash"></i>
                        </button>
                      </div> -->
                    </div>
                  }
                </div>

                @if (options.length < 2) {
                  <div class="alert warn">
                    <i class="fa fa-exclamation-triangle"></i>
                    حداقل 2 گزینه الزامی است
                  </div>
                }

                <div class="sp-12"></div>

                <div class="grid grid-2">
                  <label class="choice">
                    <input type="checkbox" formControlName="randomizeOptions" />
                    <span>نمایش تصادفی گزینه‌ها</span>
                  </label>

                  <label class="choice">
                    <input type="checkbox" formControlName="allowOtherOption" />
                    <span>اجازه گزینه "سایر"</span>
                  </label>
                </div>

                @if (allowOtherOptionSig()) {
                  <div class="sp-12"></div>
                  <custom-input
                    label='متن گزینه "سایر"'
                    formControlName="otherOptionText"
                    identity="otherOptionText"
                    placeholder="سایر (لطفاً توضیح دهید)">
                  </custom-input>
                }
              </div>

              <div class="sp-16"></div>
            }

            <!-- ========== اعتبارسنجی (Validation) ========== -->
            @if (needsValidation()) {
              <div class="section">
                <h3 class="sectionTitle">اعتبارسنجی</h3>

                <custom-select
                  label="نوع اعتبارسنجی"
                  formControlName="validationType"
                  [options]="validationTypes"
                  identity="validationType">
                </custom-select>

                <div class="sp-12"></div>

                <custom-input
                  label="پیام خطا"
                  formControlName="validationErrorMessage"
                  identity="validationErrorMessage"
                  placeholder="مقدار وارد شده معتبر نیست">
                </custom-input>

                <div class="sp-12"></div>

                @if (validationTypeSig() === 4) {
                  <custom-input
                    label="الگوی Regex"
                    formControlName="validationRegex"
                    identity="validationRegex"
                    placeholder="^[a-zA-Z0-9]+$">
                  </custom-input>
                  <div class="sp-12"></div>
                }

                <div class="grid grid-2">
                  <custom-input label="حداقل طول" formControlName="minLength" type="number" identity="minLength"></custom-input>
                  <custom-input label="حداکثر طول" formControlName="maxLength" type="number" identity="maxLength"></custom-input>
                </div>

                <div class="sp-12"></div>

                <div class="grid grid-2">
                  <custom-input label="حداقل مقدار" formControlName="minValue" type="number" identity="minValue"></custom-input>
                  <custom-input label="حداکثر مقدار" formControlName="maxValue" type="number" identity="maxValue"></custom-input>
                </div>
              </div>

              <div class="sp-16"></div>
            }

            <!-- ========== محدودیت انتخاب (فقط چند انتخابی) ========== -->
            @if (showOptions() && (questionTypeSig() === 2)) {
              <div class="section">
                <h3 class="sectionTitle">محدودیت انتخاب</h3>

                <div class="grid grid-2">
                  <custom-input label="حداقل انتخاب" formControlName="minSelection" type="number" identity="minSelection" placeholder="1"></custom-input>
                  <custom-input label="حداکثر انتخاب" formControlName="maxSelection" type="number" identity="maxSelection" placeholder="3"></custom-input>
                </div>
              </div>

              <div class="sp-16"></div>
            }

            <!-- ========== امتیازدهی ========== -->
            @if (questionTypeSig() === 5) {
              <div class="section">
                <h3 class="sectionTitle">تنظیمات امتیازدهی</h3>

                <div class="grid grid-2">
                  <custom-input label="برچسب حداقل" formControlName="minScaleLabel" identity="minScaleLabel" placeholder="بسیار ضعیف"></custom-input>
                  <custom-input label="برچسب حداکثر" formControlName="maxScaleLabel" identity="maxScaleLabel" placeholder="عالی"></custom-input>
                </div>
              </div>

              <div class="sp-16"></div>
            }

            <!-- ========== ماتریس ========== -->
            @if (questionTypeSig() === 11) {
              <div class="section">
                <h3 class="sectionTitle">تنظیمات ماتریس</h3>

                <custom-input
                  label="ردیف‌ها (با کاما جدا کنید)"
                  formControlName="matrixRows"
                  identity="matrixRows"
                  placeholder="کیفیت, قیمت, خدمات">
                </custom-input>

                <div class="sp-12"></div>

                <custom-input
                  label="ستون‌ها (با کاما جدا کنید)"
                  formControlName="matrixColumns"
                  identity="matrixColumns"
                  placeholder="موافقم, مخالفم">
                </custom-input>
              </div>

              <div class="sp-16"></div>
            }

            <!-- ========== آپلود فایل ========== -->
            @if (questionTypeSig() === 9) {
              <div class="section">
                <h3 class="sectionTitle">تنظیمات آپلود فایل</h3>

                <div class="grid grid-2">
                  <custom-input label="حداکثر حجم (MB)" formControlName="maxFileSize" type="number" identity="maxFileSize" placeholder="10"></custom-input>
                  <custom-input label="فرمت‌های مجاز" formControlName="allowedFileTypes" identity="allowedFileTypes" placeholder=".pdf,.jpg,.png"></custom-input>
                </div>
              </div>

              <div class="sp-16"></div>
            }

            <!-- ========== رسانه ========== -->
            <div class="section">
              <h3 class="sectionTitle">رسانه (اختیاری)</h3>

              <app-file-uploader
                label="تصویر سوال"
                icon="image"
                accept="image/*"
                acceptText="PNG, JPG, GIF"
                [maxSizeMB]="5"
                folderPath="surveys/questions"
                [fileGuid]="questionImageGuid"
                (fileUploaded)="onQuestionImageUploaded($event)"
                (fileRemoved)="onQuestionImageRemoved()">
              </app-file-uploader>

              <div class="sp-12"></div>

              <app-file-uploader
                label="ویدیو سوال"
                icon="video"
                accept="video/*"
                acceptText="MP4, WebM, OGG"
                [maxSizeMB]="50"
                folderPath="surveys/questions"
                [fileGuid]="questionVideoGuid"
                (fileUploaded)="onQuestionVideoUploaded($event)"
                (fileRemoved)="onQuestionVideoRemoved()">
              </app-file-uploader>
            </div>

          </form>
        </div>

        <!-- Footer -->
        <div class="modalFooter">
          <button type="button" class="btn" (click)="onCancel()">انصراف</button>
          <button type="button" class="btn primary" (click)="onSave()" [disabled]="!canSave()">
            {{ isEditMode() ? 'ذخیره تغییرات' : 'افزودن سوال' }}
          </button>
        </div>

      </div>
    </div>

    <input
      #optionFileInput
      type="file"
      accept="image/*"
      (change)="onOptionFileSelected($event)"
      hidden>
  `,
  styles: [`
    .modalOverlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 20px;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .modalContent {
      background: white;
      border-radius: 24px;
      width: 100%;
      max-width: 900px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 64px rgba(15, 23, 42, 0.3);
      animation: slideUp 0.3s ease;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(40px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .modalHeader {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 32px;
      border-bottom: 2px solid var(--line);
    }
    .modalHeader h2 { margin: 0; font-weight: 950; font-size: 1.5rem; }

    .closeBtn {
      width: 40px;
      height: 40px;
      border: none;
      background: rgba(100, 116, 139, 0.1);
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      font-size: 1.2rem;
      transition: all 0.2s;
    }
    .closeBtn:hover { background: rgba(255, 77, 109, 0.1); color: var(--accent); }

    .modalBody { flex: 1; overflow-y: auto; padding: 32px; }
    .modalBody::-webkit-scrollbar { width: 8px; }
    .modalBody::-webkit-scrollbar-track { background: #f1f5f9; }
    .modalBody::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

    .section {
      padding: 20px;
      background: rgba(249, 250, 251, 0.5);
      border: 2px solid var(--line);
      border-radius: 16px;
    }
    .sectionTitle {
      font-size: 1.1rem;
      font-weight: 900;
      margin: 0 0 16px 0;
      color: var(--ink);
    }
    .sectionHeader {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .choice {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      border-radius: 14px;
      border: 2px solid var(--line);
      background: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .choice:hover { border-color: var(--primary); background: rgba(29, 78, 216, 0.05); }
    .choice input { accent-color: var(--primary); cursor: pointer; width: 20px; height: 20px; }
    .choice:has(input:checked) {
      border-color: var(--primary);
      background: linear-gradient(135deg, rgba(29, 78, 216, 0.12), rgba(255, 77, 109, 0.08));
    }
    .choice span { font-weight: 800; font-size: 0.95rem; }

    .optionsList { display: grid; gap: 12px; }

    .optionItem {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      align-items: center;
      background: white;
      padding: 12px;
      border: 2px solid var(--line);
      border-radius: 12px;
    }

    .optionItem__number {
      width: 32px;
      height: 32px;
      background: var(--primary);
      color: white;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 0.9rem;
      flex-shrink: 0;
    }

    .optionItem__inputs { display: flex; gap: 8px; align-items: center; }
    .optionItem__actions { display: flex; gap: 6px; align-items: center; }

    .badge { padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 800; }
    .badge.ok {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: var(--ok);
    }

    .alert {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 0.9rem;
      margin-top: 12px;
    }
    .alert.warn {
      background: rgba(251, 146, 60, 0.1);
      border: 1px solid rgba(251, 146, 60, 0.3);
      color: var(--warn);
    }

    .grid { display: grid; gap: 12px; }
    .grid.grid-2 { grid-template-columns: repeat(2, 1fr); }

    .modalFooter {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 24px 32px;
      border-top: 2px solid var(--line);
    }

    :host ::ng-deep .in,
    :host ::ng-deep .sel,
    :host ::ng-deep .ta {
      width: 100%;
      border: 2px solid var(--line);
      background: white;
      padding: 10px 14px;
      border-radius: 12px;
      outline: none;
      color: var(--ink);
      font-family: inherit;
      transition: all 0.15s ease;
    }
    :host ::ng-deep .in:focus,
    :host ::ng-deep .sel:focus,
    :host ::ng-deep .ta:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.1);
    }
    :host ::ng-deep input[type="color"].in { height: 42px; padding: 4px; cursor: pointer; }
        .criterionSection { background: #f0f5ff; border-color: rgba(29,78,216,0.2); }
    .criterionSection select.in { max-width: 100%; }
  `],
})
export class QuestionModalComponent implements OnInit, OnChanges {
  @Input() question: WizardQuestionData | null = null;
  @Input() hasCriteria = false;
  @Input() criteria: WizardCriterionData[] = [];
  @Input() initialCriterionGuid: string | undefined = undefined;

  @Output() save = new EventEmitter<QuestionModalSaveEvent>();
  @Output() cancel = new EventEmitter<void>();

  selectedCriterionGuid: string = '';
  @Output() fileUploaded = new EventEmitter<{
    type: 'questionImage' | 'questionVideo' | 'optionImage',
    guid: string,
    relatedId: string
  }>();

  @ViewChild('optionFileInput') optionFileInput?: ElementRef<HTMLInputElement>;

  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  form!: FormGroup;

  // Signals
  readonly questionImageGuid = signal<string | undefined>(undefined);
  readonly questionVideoGuid = signal<string | undefined>(undefined);
  readonly optionImageGuids = signal<(string | undefined)[]>([]);

  readonly isEditMode = computed(() => !!this.question);

  readonly questionTypeSig = signal<number>(1);
  readonly validationTypeSig = signal<number>(0);
  readonly allowOtherOptionSig = signal<boolean>(false);

  // Computed
  readonly showOptions = computed(() => [1, 2, 10].includes(this.questionTypeSig()));
  readonly needsValidation = computed(() => [3, 4].includes(this.questionTypeSig()));

  private currentOptionIndex = -1;

  readonly questionTypes = [
    { guid: '3', title: 'متن کوتاه' },
    { guid: '4', title: 'متن بلند' },
    { guid: '1', title: 'چند گزینه‌ای (تک انتخابی)' },
    { guid: '2', title: 'چند گزینه‌ای (چند انتخابی)' },
    { guid: '10', title: 'لیست کشویی' },
    { guid: '5', title: 'امتیازدهی' },
    { guid: '8', title: 'تاریخ' },
    { guid: '9', title: 'آپلود فایل' },
    { guid: '11', title: 'ماتریس' },
  ];

  readonly validationTypes = [
    { guid: '0', title: 'بدون اعتبارسنجی' },
    { guid: '1', title: 'ایمیل' },
    { guid: '2', title: 'شماره تلفن' },
    { guid: '3', title: 'URL' },
    { guid: '4', title: 'Regex سفارشی' },
  ];

  ngOnInit(): void {
    this.initForm();
    this.applyQuestion(this.question);
    this.bindReactiveFields();
    this.selectedCriterionGuid = this.question?.criterionGuid ?? this.initialCriterionGuid ?? '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['question'] && this.form) {
      this.applyQuestion(this.question);
      this.selectedCriterionGuid = this.question?.criterionGuid ?? this.initialCriterionGuid ?? '';
    }
  }
  private initForm(): void {
    this.form = this.fb.group({
      // Base
      questionType: ['1', Validators.required],
      questionText: ['', [Validators.required, Validators.maxLength(500)]],
      helpText: ['', Validators.maxLength(200)],
      placeholder: ['', Validators.maxLength(100)],
      isRequired: [false],

      // Options
      options: this.fb.array([]),
      randomizeOptions: [false],
      allowOtherOption: [false],
      otherOptionText: [''],

      // Validation
      validationType: ['0'],
      validationErrorMessage: [''],
      validationRegex: [''],
      minLength: [null],
      maxLength: [null],
      minValue: [null],
      maxValue: [null],

      // Selection
      minSelection: [null],
      maxSelection: [null],

      // Scale
      minScaleLabel: [''],
      maxScaleLabel: [''],

      // Matrix
      matrixRows: [''],
      matrixColumns: [''],

      // File Upload
      maxFileSize: [null],
      allowedFileTypes: [''],
    });
  }

  private bindReactiveFields(): void {
    this.form.get('questionType')?.valueChanges
      .pipe(
        map(v => this.toNumber(v)),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(type => {
        this.questionTypeSig.set(type);
        this.syncByQuestionType(type);
      });

    this.form.get('validationType')?.valueChanges
      .pipe(
        map(v => this.toNumber(v)),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(type => this.validationTypeSig.set(type));

    this.form.get('allowOtherOption')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => {
        const val = !!v;
        this.allowOtherOptionSig.set(val);
        if (!val) {
          this.form.get('otherOptionText')?.setValue('', { emitEvent: false });
        }
      });
  }

  private toNumber(v: any): number {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return Number(v) || 0;
    if (typeof v === 'object' && 'guid' in v) return Number((v as any).guid) || 0;
    return Number(v) || 0;
  }

  private syncByQuestionType(type: number): void {
    const needsOptions = [1, 2, 10].includes(type);

    if (!needsOptions) {
      // hide options -> clear array safely
      this.options.clear();
      this.optionImageGuids.set([]);

      // reset option settings
      this.form.patchValue(
        { randomizeOptions: false, allowOtherOption: false, otherOptionText: '' },
        { emitEvent: false }
      );
      this.allowOtherOptionSig.set(false);
    } else {
      while (this.options.length < 2) this.addOption();
    }

    // اگر نوع سوال نیاز به validation ندارد، ریست کن
    if (![1, 2].includes(type)) {
      this.form.patchValue(
        {
          validationType: '0',
          validationErrorMessage: '',
          validationRegex: '',
          minLength: null,
          maxLength: null,
          minValue: null,
          maxValue: null,
        },
        { emitEvent: false }
      );
      this.validationTypeSig.set(0);
    }

    // اگر چند انتخابی نیست، محدودیت انتخاب را ریست کن
    if (type !== 2) {
      this.form.patchValue({ minSelection: null, maxSelection: null }, { emitEvent: false });
    }

    // اگر rating نیست، ریست
    if (type !== 5) {
      this.form.patchValue({ minScaleLabel: '', maxScaleLabel: '' }, { emitEvent: false });
    }

    // اگر matrix نیست، ریست
    if (type !== 11) {
      this.form.patchValue({ matrixRows: '', matrixColumns: '' }, { emitEvent: false });
    }

    // اگر upload file نیست، ریست
    if (type !== 9) {
      this.form.patchValue({ maxFileSize: null, allowedFileTypes: '' }, { emitEvent: false });
    }
  }

  private applyQuestion(q: WizardQuestionData | null): void {
    // reset media first
    this.questionImageGuid.set(q?.imageGuid);
    this.questionVideoGuid.set(q?.videoGuid);

    // clear arrays first
    this.options.clear();
    this.optionImageGuids.set([]);

    const type = this.toNumber(q?.questionType ?? 3);
    const vType = this.toNumber(q?.validationType ?? 0);
    const allowOther = !!(q as any)?.allowOtherOption;

    // set signals (UI)
    this.questionTypeSig.set(type);
    this.validationTypeSig.set(vType);
    this.allowOtherOptionSig.set(allowOther);

    // reset form without emitting events (avoid duplicate ensure/clear)
    this.form.reset({
      questionType: String(q?.questionType ?? '3'),
      questionText: q?.questionText ?? '',
      helpText: (q as any)?.helpText ?? '',
      placeholder: (q as any)?.placeholder ?? '',
      isRequired: !!(q as any)?.isRequired,

      randomizeOptions: !!(q as any)?.randomizeOptions,
      allowOtherOption: allowOther,
      otherOptionText: (q as any)?.otherOptionText ?? '',

      validationType: String((q as any)?.validationType ?? '0'),
      validationErrorMessage: (q as any)?.validationErrorMessage ?? '',
      validationRegex: (q as any)?.customValidationRegex ?? '',
      minLength: (q as any)?.minLength ?? null,
      maxLength: (q as any)?.maxLength ?? null,
      minValue: (q as any)?.minValue ?? null,
      maxValue: (q as any)?.maxValue ?? null,

      minSelection: (q as any)?.minSelections ?? null,
      maxSelection: (q as any)?.maxSelections ?? null,

      minScaleLabel: (q as any)?.minScaleLabel ?? '',
      maxScaleLabel: (q as any)?.maxScaleLabel ?? '',

      matrixRows: (q as any)?.matrixRows ?? '',
      matrixColumns: (q as any)?.matrixColumns ?? '',

      maxFileSize: (q as any)?.maxFileSize ?? null,
      allowedFileTypes: (q as any)?.allowedFileTypes ?? '',
    }, { emitEvent: false });

    // load options (if needed)
    if ([1, 2, 10].includes(type)) {
      const qOpts = (q as any)?.options as any[] | undefined;

      if (qOpts?.length) {
        const guids: (string | undefined)[] = [];
        for (const opt of qOpts) {
          this.options.push(this.fb.group({
            guid: [opt.guid],                                // ✅ جدید — guid واقعی گزینه از بک‌اند
            optionText: [opt.optionText ?? '', Validators.required],
            value: [opt.value ?? null],
            color: [opt.color ?? '#667eea'],
            tempId: [opt.tempId ?? this.generateTempId()],
          }));
          guids.push(opt.imageGuid);
        }
        this.optionImageGuids.set(guids);
      }

      while (this.options.length < 2) this.addOption();
    }

    // finally enforce cleanup by type
    this.syncByQuestionType(type);
  }

  // ========== Options ==========
  get options(): FormArray<FormGroup> {
    return this.form.get('options') as FormArray<FormGroup>;
  }

  trackOption(index: number, ctrl: AbstractControl): any {
    return ctrl.get('tempId')?.value ?? index;
  }

  addOption(): void {
    this.options.push(this.fb.group({
      guid: [undefined],          // ✅ جدید
      optionText: ['', Validators.required],
      value: [null],
      color: ['#667eea'],
      tempId: [this.generateTempId()],
    }));
    const curr = [...this.optionImageGuids()];
    curr.push(undefined);
    this.optionImageGuids.set(curr);
  }

  removeOption(index: number): void {
    if (this.options.length <= 2) return;

    this.options.removeAt(index);
    const curr = [...this.optionImageGuids()];
    curr.splice(index, 1);
    this.optionImageGuids.set(curr);
  }

  // ========== Option Image ==========
  pickOptionImage(index: number): void {
    this.currentOptionIndex = index;
    this.optionFileInput?.nativeElement.click();
  }

  onOptionFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.currentOptionIndex < 0) return;

    // TODO: Upload via TusUploadService and set optionImageGuids[index]
    // this.fileUploaded.emit({ type:'optionImage', guid, relatedId: this.options.at(this.currentOptionIndex).get('tempId')?.value })

    input.value = '';
  }

  removeOptionImage(index: number): void {
    const curr = [...this.optionImageGuids()];
    curr[index] = undefined;
    this.optionImageGuids.set(curr);
  }

  // ========== Question Media ==========
  onQuestionImageUploaded(guid: string): void {
    this.questionImageGuid.set(guid);
    const relatedId = (this.question as any)?.tempId || this.generateTempId();
    this.fileUploaded.emit({ type: 'questionImage', guid, relatedId });
  }
  onQuestionImageRemoved(): void {
    this.questionImageGuid.set(undefined);
  }

  onQuestionVideoUploaded(guid: string): void {
    this.questionVideoGuid.set(guid);
    const relatedId = (this.question as any)?.tempId || this.generateTempId();
    this.fileUploaded.emit({ type: 'questionVideo', guid, relatedId });
  }
  onQuestionVideoRemoved(): void {
    this.questionVideoGuid.set(undefined);
  }

  // ========== Save/Cancel ==========
  canSave(): boolean {
    if (!this.form.valid) return false;
    if (this.showOptions()) return this.options.length >= 2 && this.options.valid;
    return true;
  }

  onSave(): void {
    if (!this.canSave()) return;

    const v = this.form.getRawValue();
    const type = this.questionTypeSig();

    const questionData: WizardQuestionData = {
      tempId: (this.question as any)?.tempId || this.generateTempId(),
      guid: (this.question as any)?.guid,
      questionText: v.questionText,
      questionType: type,
      sortOrder: (this.question as any)?.sortOrder || 1,
      isRequired: v.isRequired,
      helpText: v.helpText,
      placeholder: v.placeholder,
      imageGuid: this.questionImageGuid(),
      videoGuid: this.questionVideoGuid(),

      validationType: this.toNumber(v.validationType),
      validationErrorMessage: v.validationErrorMessage,
      customValidationRegex: v.validationRegex,
      minLength: v.minLength,
      maxLength: v.maxLength,
      minValue: v.minValue,
      maxValue: v.maxValue,

      minSelections: v.minSelection,
      maxSelections: v.maxSelection,

      minScaleLabel: v.minScaleLabel,
      maxScaleLabel: v.maxScaleLabel,

      matrixRows: v.matrixRows,
      matrixColumns: v.matrixColumns,

      maxFileSize: v.maxFileSize,
      allowedFileTypes: v.allowedFileTypes,

      randomizeOptions: v.randomizeOptions,
      allowOtherOption: v.allowOtherOption,
      otherOptionText: v.otherOptionText,

      options: this.showOptions()
        ? (v.options ?? []).map((opt: any, index: number) => ({
          tempId: opt.tempId,
          optionText: opt.optionText,
          sortOrder: index + 1,
          value: opt.value,
          guid: opt.guid,                                 // ✅ جدید

          color: opt.color,
          imageGuid: this.optionImageGuids()[index],
        }))
        : undefined,
    };
    this.save.emit({
      question: questionData,
      criterionGuid: this.selectedCriterionGuid || undefined,
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  private generateTempId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
