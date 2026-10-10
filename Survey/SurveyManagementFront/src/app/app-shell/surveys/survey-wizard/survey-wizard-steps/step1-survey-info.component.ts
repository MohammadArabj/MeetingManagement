import {
  Component,
  DestroyRef,
  Input,
  Output,
  EventEmitter,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormGroup,
  FormBuilder,
  ValidationErrors,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  COMPLETION_EFFECTS,
  CompletionEffectType,
  WizardSurveyData,
  normalizeCompletionEffect,
} from '../../../../core/models/survey-wizard.model';
import { CompletionEffectComponent } from '../../../../shared/completion-effect/completion-effect.component';
import { CustomInputComponent } from '../../../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../../../shared/custom-controls/custom-select';
import { FileUploaderComponent } from '../../../../shared/file-uploader/file-uploader.component';
import { RichTextEditorComponent } from '../../../../shared/custom-controls/rich-text-editor';


@Component({
  selector: 'app-survey-wizard-step1',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CustomInputComponent,
    CustomSelectComponent,
    FileUploaderComponent,
    RichTextEditorComponent,
    CompletionEffectComponent,
  ],
  template: `
    <div class="step1Container">
      <form [formGroup]="form" novalidate>

        <!-- اطلاعات پایه -->
        <section class="wzCard" aria-labelledby="s1-basic">
          <header class="wzCard__head">
            <span class="wzCard__icon"><i class="fa fa-info-circle" aria-hidden="true"></i></span>
            <div>
              <h2 id="s1-basic" class="wzCard__title">اطلاعات پایه</h2>
              <p class="wzCard__sub">عنوان، توضیحات و بازه‌ی زمانی نظرسنجی</p>
            </div>
          </header>

          <custom-input
            label="عنوان نظرسنجی"
            formControlName="title"
            identity="title"
            [required]="true"
            placeholder="عنوان واضح و جذاب انتخاب کنید">
          </custom-input>

          <div class="sp-12"></div>

          <custom-input
            label="توضیحات"
            formControlName="description"
            type="textarea"
            rows="4"
            identity="description"
            [required]="false"
            placeholder="توضیحات کامل درباره نظرسنجی و هدف آن">
          </custom-input>

          <div class="sp-12"></div>

          <div class="grid2">
            <custom-input
              label="تاریخ شروع"
              formControlName="startDate"
              type="date"
              identity="startDate"
              [required]="true">
            </custom-input>

            <custom-input
              label="تاریخ پایان"
              formControlName="endDate"
              type="date"
              identity="endDate"
              [required]="true">
            </custom-input>
          </div>

          @if (form.errors?.['dateRangeInvalid']) {
            <div class="fieldError" role="alert">
              <i class="fa fa-exclamation-circle" aria-hidden="true"></i>
              <span>تاریخ شروع نباید بعد از تاریخ پایان باشد</span>
            </div>
          }

          <div class="sp-12"></div>

          <div class="grid2">
            <custom-select
              label="نحوه نمایش سوالات"
              formControlName="showType"
              [options]="showTypeOptions"
              identity="showType"
              [required]="true">
            </custom-select>
            <div>
              <custom-input
                label="حداکثر تعداد پاسخ"
                formControlName="maxResponses"
                type="number"
                identity="maxResponses"
                placeholder="خالی = بدون محدودیت">
              </custom-input>
              @if (form.get('maxResponses')?.errors?.['min'] && (form.get('maxResponses')?.touched || showErrorsState)) {
                <div class="fieldError" role="alert">
                  <i class="fa fa-exclamation-circle" aria-hidden="true"></i>
                  <span>حداکثر تعداد پاسخ باید بزرگ‌تر از صفر باشد</span>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- تنظیمات -->
        <section class="wzCard" aria-labelledby="s1-settings">
          <header class="wzCard__head">
            <span class="wzCard__icon"><i class="fa fa-sliders-h" aria-hidden="true"></i></span>
            <div>
              <h2 id="s1-settings" class="wzCard__title">تنظیمات</h2>
              <p class="wzCard__sub">رفتار نظرسنجی هنگام پاسخ‌دهی</p>
            </div>
          </header>

          <div class="choiceGrid">
            <label class="choice">
              <input type="checkbox" formControlName="hasCriteria" />
              <span class="choice__text">
                <strong>نظرسنجی معیار محور</strong>
                <small>سوالات در قالب گروه‌های معیار دسته‌بندی شوند</small>
              </span>
            </label>
            <label class="choice">
              <input type="checkbox" formControlName="allowSaveDraft" />
              <span class="choice__text">
                <strong>امکان ذخیره پیش‌نویس</strong>
                <small>پاسخ‌دهنده بتواند بعداً ادامه دهد</small>
              </span>
            </label>
            <label class="choice">
              <input type="checkbox" formControlName="showProgressBar" />
              <span class="choice__text">
                <strong>نمایش نوار پیشرفت</strong>
                <small>میزان تکمیل نظرسنجی نمایش داده شود</small>
              </span>
            </label>
          </div>
        </section>

        <!-- پیام‌ها -->
        <section class="wzCard" aria-labelledby="s1-messages">
          <header class="wzCard__head">
            <span class="wzCard__icon"><i class="fa fa-comment-dots" aria-hidden="true"></i></span>
            <div>
              <h2 id="s1-messages" class="wzCard__title">پیام‌ها</h2>
              <p class="wzCard__sub">متن‌های ابتدا و انتهای نظرسنجی</p>
            </div>
          </header>

          <div class="field">
            <span class="label">پیام خوشامدگویی (اختیاری)</span>
            <app-rich-text-editor
              formControlName="welcomeMessage"
              placeholder="پیامی که در ابتدای نظرسنجی نمایش داده می‌شود">
            </app-rich-text-editor>
          </div>

          <div class="sp-16"></div>

          <div class="field">
            <span class="label">پیام تشکر (اختیاری)</span>
            <app-rich-text-editor
              formControlName="thankYouMessage"
              placeholder="پیامی که پس از تکمیل نظرسنجی نمایش داده می‌شود">
            </app-rich-text-editor>
          </div>

          <div class="sp-16"></div>

          <!-- جلوه‌ی پایان نظرسنجی -->
          <fieldset class="effectPicker">
            <legend class="label">جلوه‌ی صفحه‌ی تشکر</legend>
            <p class="help">پس از ثبت پاسخ، این جلوه همراه پیام تشکر نمایش داده می‌شود.</p>

            <div class="effectGrid" role="radiogroup" aria-label="جلوه‌ی صفحه‌ی تشکر">
              @for (eff of effects; track eff.value) {
                <label class="effectCard" [class.selected]="selectedEffect() === eff.value">
                  <input type="radio" class="srOnly" name="completionEffect"
                    formControlName="completionEffect" [value]="eff.value">
                  <span class="effectCard__preview" [class.none]="eff.value === 'none'">
                    @if (eff.value === 'none') {
                      <i class="fa fa-ban" aria-hidden="true"></i>
                    } @else {
                      <app-completion-effect [effect]="eff.value" [contained]="true" [loop]="true" [density]="0.6">
                      </app-completion-effect>
                    }
                  </span>
                  <span class="effectCard__label">
                    @if (selectedEffect() === eff.value) {
                      <i class="fa fa-check-circle" aria-hidden="true"></i>
                    }
                    {{ eff.title }}
                  </span>
                </label>
              }
            </div>

            @if (selectedEffect() !== 'none') {
              <button type="button" class="linkBtn" (click)="previewEffect()">
                <i class="fa fa-play-circle" aria-hidden="true"></i>
                پیش‌نمایش تمام‌صفحه
              </button>
            }
          </fieldset>
        </section>

        <!-- ظاهر -->
        <section class="wzCard" aria-labelledby="s1-theme">
          <header class="wzCard__head">
            <span class="wzCard__icon"><i class="fa fa-palette" aria-hidden="true"></i></span>
            <div>
              <h2 id="s1-theme" class="wzCard__title">ظاهر نظرسنجی</h2>
              <p class="wzCard__sub">رنگ، لوگو و تصویر پس‌زمینه</p>
            </div>
          </header>

          <div class="field colorField">
            <label class="label" for="s1-theme-color">رنگ اصلی</label>
            <div class="colorField__row">
              <input id="s1-theme-color" class="colorInput" type="color" formControlName="themeColor">
              <span class="colorField__value">{{ form.get('themeColor')?.value }}</span>
              <div class="swatches" role="group" aria-label="رنگ‌های پیشنهادی">
                @for (c of swatches; track c) {
                  <button type="button" class="swatch" [style.background]="c"
                    [class.active]="form.get('themeColor')?.value === c"
                    [attr.aria-label]="'انتخاب رنگ ' + c" (click)="setThemeColor(c)"></button>
                }
              </div>
            </div>
          </div>

          <div class="sp-16"></div>

          <div class="grid2">
            <app-file-uploader
              label="لوگو نظرسنجی"
              help="در بالای نظرسنجی نمایش داده می‌شود (اختیاری)"
              icon="image"
              accept="image/*"
              acceptText="PNG, JPG, GIF"
              [maxSizeMB]="2"
              folderPath="surveys/logos"
              [fileGuid]="logoGuid"
              (fileUploaded)="onLogoUploaded($event)"
              (fileRemoved)="onLogoRemoved()">
            </app-file-uploader>

            <app-file-uploader
              label="تصویر پس‌زمینه"
              help="تصویر پس‌زمینه نظرسنجی (اختیاری)"
              icon="image"
              accept="image/*"
              acceptText="PNG, JPG, GIF"
              [maxSizeMB]="5"
              folderPath="surveys/backgrounds"
              [fileGuid]="backgroundGuid"
              (fileUploaded)="onBackgroundUploaded($event)"
              (fileRemoved)="onBackgroundRemoved()">
            </app-file-uploader>
          </div>
        </section>

      </form>
    </div>

    @if (fullPreviewKey() > 0) {
      <app-completion-effect [effect]="selectedEffect()" [trigger]="fullPreviewKey()" [duration]="3500"
        (finished)="fullPreviewKey.set(0)">
      </app-completion-effect>
    }
  `,
  styles: [`
    .step1Container {
      max-width: 1100px;
      margin: 0 auto;
      display: block;
    }
    form { display: grid; gap: 16px; }

    .wzCard {
      background: var(--wz-surface, #fff);
      border: 1px solid var(--wz-border, #e2e8f0);
      border-radius: var(--wz-radius-lg, 18px);
      box-shadow: var(--wz-shadow-sm, 0 1px 2px rgba(15,23,42,.05));
      padding: 20px 22px;
    }
    .wzCard__head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--wz-border, #e2e8f0);
    }
    .wzCard__icon {
      width: 38px; height: 38px;
      border-radius: 12px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--wz-primary-soft, rgba(29,78,216,.08));
      color: var(--wz-primary, #1d4ed8);
      flex-shrink: 0;
    }
    .wzCard__title { margin: 0; font-size: 1.02rem; font-weight: 900; color: var(--wz-ink, #0f172a); }
    .wzCard__sub { margin: 2px 0 0; font-size: .8rem; color: var(--wz-muted, #64748b); }

    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

    .choiceGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
    .choice {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 14px 16px;
      border-radius: var(--wz-radius, 14px);
      border: 1px solid var(--wz-border, #e2e8f0);
      background: var(--wz-surface, #fff);
      cursor: pointer;
      transition: border-color .15s, background .15s;
    }
    .choice:hover { border-color: var(--wz-border-strong, #cbd5e1); background: var(--wz-subtle, #f8fafc); }
    .choice input { accent-color: var(--wz-primary, #1d4ed8); cursor: pointer; width: 18px; height: 18px; margin-top: 2px; flex-shrink: 0; }
    .choice:has(input:checked) { border-color: var(--wz-primary, #1d4ed8); background: var(--wz-primary-soft, rgba(29,78,216,.08)); }
    .choice:has(input:focus-visible) { box-shadow: 0 0 0 3px var(--wz-primary-ring, rgba(29,78,216,.18)); }
    .choice__text { display: flex; flex-direction: column; gap: 2px; }
    .choice__text strong { font-size: .92rem; font-weight: 800; color: var(--wz-ink, #0f172a); }
    .choice__text small { font-size: .78rem; color: var(--wz-muted, #64748b); }

    .fieldError {
      display: flex; align-items: center; gap: 8px;
      margin-top: 8px;
      padding: 8px 12px;
      border-radius: var(--wz-radius-sm, 10px);
      font-size: .85rem;
      background: var(--wz-danger-soft, rgba(220,38,38,.08));
      color: var(--wz-danger, #dc2626);
    }

    /* ---------- Effect picker ---------- */
    .effectPicker { border: 0; padding: 0; margin: 0; min-width: 0; }
    .effectPicker legend { padding: 0; margin-bottom: 2px; }
    .effectPicker .help { margin: 0 0 12px; }
    .effectGrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 10px;
    }
    .effectCard {
      position: relative;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--wz-border, #e2e8f0);
      border-radius: var(--wz-radius, 14px);
      background: var(--wz-surface, #fff);
      overflow: hidden;
      cursor: pointer;
      transition: border-color .15s, box-shadow .15s, transform .15s;
    }
    .effectCard:hover { border-color: var(--wz-border-strong, #cbd5e1); transform: translateY(-1px); }
    .effectCard.selected {
      border-color: var(--wz-primary, #1d4ed8);
      box-shadow: 0 0 0 3px var(--wz-primary-ring, rgba(29,78,216,.18));
    }
    .effectCard:has(input:focus-visible) { outline: 2px solid var(--wz-primary, #1d4ed8); outline-offset: 2px; }
    .effectCard__preview {
      position: relative;
      display: block;
      height: 86px;
      background: linear-gradient(180deg, #f8fafc, #eef2ff);
      overflow: hidden;
    }
    .effectCard__preview.none {
      display: flex; align-items: center; justify-content: center;
      color: var(--wz-muted, #64748b);
      font-size: 1.6rem;
      background: var(--wz-subtle, #f8fafc);
    }
    .effectCard__label {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 8px 6px;
      font-size: .82rem;
      font-weight: 800;
      color: var(--wz-ink, #0f172a);
      text-align: center;
    }
    .effectCard.selected .effectCard__label { color: var(--wz-primary, #1d4ed8); }
    .srOnly {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }
    .linkBtn {
      margin-top: 10px;
      display: inline-flex; align-items: center; gap: 6px;
      border: none; background: none; padding: 6px 2px;
      color: var(--wz-primary, #1d4ed8);
      font: inherit; font-weight: 800; font-size: .86rem;
      cursor: pointer;
    }
    .linkBtn:hover { text-decoration: underline; }
    .linkBtn:focus-visible { outline: 2px solid var(--wz-primary, #1d4ed8); outline-offset: 2px; border-radius: 6px; }

    /* ---------- Theme color ---------- */
    .colorField__row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .colorInput {
      width: 52px; height: 42px;
      padding: 3px;
      border: 1px solid var(--wz-border, #e2e8f0);
      border-radius: var(--wz-radius-sm, 10px);
      background: #fff;
      cursor: pointer;
    }
    .colorField__value { font-family: monospace; font-size: .85rem; color: var(--wz-muted, #64748b); direction: ltr; }
    .swatches { display: flex; gap: 8px; flex-wrap: wrap; }
    .swatch {
      width: 28px; height: 28px;
      border-radius: 50%;
      border: 2px solid #fff;
      box-shadow: 0 0 0 1px var(--wz-border-strong, #cbd5e1);
      cursor: pointer;
      padding: 0;
    }
    .swatch.active { box-shadow: 0 0 0 2px var(--wz-ink, #0f172a); }
    .swatch:focus-visible { outline: 2px solid var(--wz-primary, #1d4ed8); outline-offset: 2px; }

    @media (max-width: 760px) {
      .wzCard { padding: 16px 14px; }
      .grid2 { grid-template-columns: 1fr; }
      .effectGrid { grid-template-columns: repeat(2, 1fr); }
    }

    /* استایل‌های custom components */
    :host ::ng-deep .form-control,
    :host ::ng-deep .form-select,
    :host ::ng-deep textarea.form-control,
    :host ::ng-deep input.in,
    :host ::ng-deep select.in,
    :host ::ng-deep textarea.in {
      width: 100%;
      border: 1px solid var(--wz-border, #e2e8f0);
      background: #fff;
      padding: 10px 12px;
      border-radius: var(--wz-radius-sm, 10px);
      outline: none;
      color: var(--wz-ink, #0f172a);
      transition: .15s ease;
    }
    :host ::ng-deep .form-control:focus,
    :host ::ng-deep .form-select:focus,
    :host ::ng-deep textarea.form-control:focus,
    :host ::ng-deep input.in:focus,
    :host ::ng-deep select.in:focus,
    :host ::ng-deep textarea.in:focus {
      border-color: var(--wz-primary, #1d4ed8);
      box-shadow: 0 0 0 3px var(--wz-primary-ring, rgba(29,78,216,.18));
    }
    :host ::ng-deep .form-label,
    :host ::ng-deep .label {
      font-weight: 800;
      color: var(--wz-ink, #0f172a);
      margin-bottom: 6px;
      display: block;
      font-size: .9rem;
    }
    :host ::ng-deep .form-text,
    :host ::ng-deep .help {
      color: var(--wz-muted, #64748b);
      font-size: 0.84rem;
    }
  `]
})
export class SurveyWizardStep1Component implements OnInit {
  @Input() surveyData!: WizardSurveyData;
  /** وقتی true شود (تلاش برای عبور از مرحله)، خطاهای همه‌ی فیلدها نمایش داده می‌شوند */
  @Input() set showErrors(v: boolean) {
    this.showErrorsState = !!v;
    if (v && this.form) this.form.markAllAsTouched();
  }
  @Output() dataChange = new EventEmitter<WizardSurveyData>();
  @Output() fileUploaded = new EventEmitter<{ type: 'logo' | 'background', guid: string }>();
  /** فایل توسط آپلودر از سرور حذف شد */
  @Output() fileRemoved = new EventEmitter<{ type: 'logo' | 'background', guid?: string }>();

  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  form!: FormGroup;
  showErrorsState = false;

  readonly logoGuid = signal<string | undefined>(undefined);
  readonly backgroundGuid = signal<string | undefined>(undefined);
  readonly selectedEffect = signal<CompletionEffectType>('confetti');
  readonly fullPreviewKey = signal(0);

  readonly effects = COMPLETION_EFFECTS;
  readonly swatches = ['#1d4ed8', '#0f766e', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#334155'];

  readonly accessTypeOptions = [
    { guid: '1', title: 'عمومی' },
    { guid: '2', title: 'محدود' },
    { guid: '3', title: 'خصوصی' }
  ];
  readonly showTypeOptions = [
    { guid: '1', title: 'اسلایدری' },
    { guid: '2', title: 'لیست' },
  ];

  ngOnInit() {
    this.initForm();
    this.watchChanges();
    this.loadExistingFiles();
    if (this.showErrorsState) this.form.markAllAsTouched();
  }

  private initForm() {
    const effect = normalizeCompletionEffect(this.surveyData.completionEffect);
    this.selectedEffect.set(effect);
    this.form = this.fb.group({
      title: [this.surveyData.title, [Validators.required, Validators.maxLength(200)]],
      description: [this.surveyData.description, Validators.maxLength(1000)],
      startDate: [this.surveyData.startDate, Validators.required],
      endDate: [this.surveyData.endDate, Validators.required],
      accessType: [this.surveyData.accessType || '1', Validators.required],
      showType: [this.surveyData.showType || '1', Validators.required],
      maxResponses: [this.surveyData.maxResponses, Validators.min(1)],
      allowAnonymous: [this.surveyData.allowAnonymous],
      requireLogin: [this.surveyData.requireLogin],
      allowSaveDraft: [this.surveyData.allowSaveDraft],
      showProgressBar: [this.surveyData.showProgressBar],
      randomizeQuestions: [this.surveyData.randomizeQuestions],
      allowMultipleResponses: [this.surveyData.allowMultipleResponses],
      welcomeMessage: [this.surveyData.welcomeMessage],
      thankYouMessage: [this.surveyData.thankYouMessage],
      themeColor: [this.surveyData.themeColor || '#1d4ed8'],
      hasCriteria: [!!this.surveyData.hasCriteria],
      completionEffect: [effect],
    }, { validators: this.dateRangeValidator });
  }

  private loadExistingFiles() {
    if (this.surveyData.logoGuid) {
      this.logoGuid.set(this.surveyData.logoGuid);
    }
    if (this.surveyData.backgroundImageGuid) {
      this.backgroundGuid.set(this.surveyData.backgroundImageGuid);
    }
  }

  private watchChanges() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.selectedEffect.set(normalizeCompletionEffect(this.form.get('completionEffect')?.value));
        this.emitDataChange();
      });
  }

  private dateRangeValidator(group: AbstractControl): ValidationErrors | null {
    const startDate = group.get('startDate')?.value;
    const endDate = group.get('endDate')?.value;
    if (startDate && endDate && String(startDate) > String(endDate)) {
      return { dateRangeInvalid: true };
    }
    return null;
  }

  setThemeColor(color: string) {
    this.form.get('themeColor')?.setValue(color);
  }

  previewEffect() {
    this.fullPreviewKey.update(v => v + 1);
  }

  // File Upload Handlers
  onLogoUploaded(guid: string) {
    this.logoGuid.set(guid);
    this.fileUploaded.emit({ type: 'logo', guid });
    this.emitDataChange();
  }

  onLogoRemoved() {
    const old = this.logoGuid();
    this.logoGuid.set(undefined);
    this.fileRemoved.emit({ type: 'logo', guid: old });
    this.emitDataChange();
  }

  onBackgroundUploaded(guid: string) {
    this.backgroundGuid.set(guid);
    this.fileUploaded.emit({ type: 'background', guid });
    this.emitDataChange();
  }

  onBackgroundRemoved() {
    const old = this.backgroundGuid();
    this.backgroundGuid.set(undefined);
    this.fileRemoved.emit({ type: 'background', guid: old });
    this.emitDataChange();
  }

  private emitDataChange() {
    const formValue = this.form.getRawValue();
    this.dataChange.emit({
      ...formValue,
      completionEffect: normalizeCompletionEffect(formValue.completionEffect),
      logoGuid: this.logoGuid(),
      backgroundImageGuid: this.backgroundGuid(),
    });
  }
}
