import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  inject,
  signal
} from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { WizardSurveyData } from '../../../../core/models/survey-wizard.model';
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
    RichTextEditorComponent
  ],
  template: `
    <div class="step1Container">
      <form [formGroup]="form">
        
        <!-- اطلاعات پایه -->
        <div class="card pad-lg">
          <div class="sectionRow">
            <div class="sectionTitle">اطلاعات پایه</div>
            <span class="badge blue">مرحله 1 از 3</span>
          </div>
          <div class="hr"></div>

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

          <div class="grid grid-2">
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
            <div class="sp-12"></div>
            <div class="alertBox danger">
              <i class="fa fa-exclamation-circle"></i>
              <span>تاریخ شروع نباید بعد از تاریخ پایان باشد</span>
            </div>
          }

          <div class="sp-12"></div>

          <div class="grid grid-2">
          
            <custom-select
              label="نحوه نمایش سوالات"
              formControlName="showType"
              [options]="showTypeOptions"
              identity="showType"
              [required]="true">
            </custom-select>
            <custom-input
              label="حداکثر تعداد پاسخ"
              formControlName="maxResponses"
              type="number"
              identity="maxResponses"
              placeholder="در صورت نیاز مشخص کنید">
            </custom-input>
          </div>
        </div>

        <div class="sp-16"></div>

        <!-- تنظیمات -->
        <div class="card pad-lg">
          <div class="sectionRow">
            <div class="sectionTitle">تنظیمات</div>
            <span class="badge">Options</span>
          </div>
          <div class="hr"></div>

          <div class="grid grid-2">
            <!-- <label class="choice">
              <input type="checkbox" formControlName="allowAnonymous" />
              <span>مجاز به پاسخ‌دهی ناشناس</span>
            </label>

            <label class="choice">
              <input type="checkbox" formControlName="requireLogin" />
              <span>نیاز به ورود به سیستم</span>
            </label> -->
            <label class="choice">
              <input type="checkbox" formControlName="hasCriteria" />
              <span>این نظرسنجی معیار محور است (سوالات در قالب گروه‌های معیار دسته‌بندی شوند)</span>
            </label>
            <label class="choice">
              <input type="checkbox" formControlName="allowSaveDraft" />
              <span>امکان ذخیره پیش‌نویس</span>
            </label>

            <label class="choice">
              <input type="checkbox" formControlName="showProgressBar" />
              <span>نمایش نوار پیشرفت</span>
            </label>

            <!-- <label class="choice">
              <input type="checkbox" formControlName="randomizeQuestions" />
              <span>نمایش تصادفی سوالات</span>
            </label>

            <label class="choice">
              <input type="checkbox" formControlName="allowMultipleResponses" />
              <span>امکان پاسخ‌دهی چندباره</span>
            </label> -->
          </div>
        </div>

        <div class="sp-16"></div>

        <!-- پیام‌ها -->
        <div class="card pad-lg">
          <div class="sectionRow">
            <div class="sectionTitle">پیام‌ها</div>
            <span class="badge">Messages</span>
          </div>
          <div class="hr"></div>

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
        </div>

        <div class="sp-16"></div>

        <!-- ظاهر -->
        <div class="card pad-lg">
          <div class="sectionRow">
            <div class="sectionTitle">تنظیمات ظاهری</div>
            <span class="badge">Theme</span>
          </div>
          <div class="hr"></div>

          <div class="grid grid-3">
            <div class="field">
              <span class="label">رنگ تم</span>
              <input 
                class="in" 
                type="color" 
                formControlName="themeColor">
              <span class="help tiny">رنگ اصلی نظرسنجی</span>
            </div>
          </div>

          <div class="sp-16"></div>

          <!-- Logo Upload -->
          <app-file-uploader
            label="لوگو نظرسنجی"
            help="لوگوی نمایش داده شده در بالای نظرسنجی (اختیاری)"
            icon="image"
            accept="image/*"
            acceptText="PNG, JPG, GIF"
            [maxSizeMB]="2"
            folderPath="surveys/logos"
            [fileGuid]="logoGuid"
            (fileUploaded)="onLogoUploaded($event)"
            (fileRemoved)="onLogoRemoved()">
          </app-file-uploader>

          <div class="sp-16"></div>

          <!-- Background Upload -->
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

      </form>
    </div>
  `,
  styles: [`
    .step1Container {
      max-width: 1100px;
      margin: 0 auto;
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

    .choice:hover {
      border-color: var(--primary);
      background: rgba(29, 78, 216, 0.05);
    }

    .choice input {
      accent-color: var(--primary);
      cursor: pointer;
      width: 20px;
      height: 20px;
    }

    .choice:has(input:checked) {
      border-color: var(--primary);
      background: linear-gradient(135deg, rgba(29, 78, 216, 0.12), rgba(255, 77, 109, 0.08));
    }

    .choice span {
      font-weight: 800;
      font-size: 0.95rem;
    }

    .alertBox {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      border-radius: 14px;
      font-size: 0.95rem;
    }

    .alertBox.danger {
      background: rgba(255, 77, 109, 0.08);
      border: 1px solid rgba(255, 77, 109, 0.3);
      color: var(--accent);
    }

    .alertBox i {
      font-size: 1.2rem;
    }
     /* استایل‌های custom components */
  :host ::ng-deep .form-control,
  :host ::ng-deep .form-select,
  :host ::ng-deep textarea.form-control,
  :host ::ng-deep input.in,
  :host ::ng-deep select.in,
  :host ::ng-deep textarea.in {
    width: 100%;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, .92);
    padding: 10px 12px;
    border-radius: 14px;
    outline: none;
    color: var(--ink);
    transition: .15s ease;
  }

  :host ::ng-deep .form-control:focus,
  :host ::ng-deep .form-select:focus,
  :host ::ng-deep textarea.form-control:focus,
  :host ::ng-deep input.in:focus,
  :host ::ng-deep select.in:focus,
  :host ::ng-deep textarea.in:focus {
    border-color: rgba(29, 78, 216, .35);
    box-shadow: 0 0 0 4px rgba(29, 78, 216, .12);
  }

  :host ::ng-deep .form-label,
  :host ::ng-deep .label {
    font-weight: 900;
    color: var(--ink);
    margin-bottom: 6px;
    display: block;
  }

  :host ::ng-deep .form-text,
  :host ::ng-deep .help {
    color: var(--muted);
    font-size: 0.875rem;
  }

  /* استایل input color */
  :host ::ng-deep input[type="color"].in {
    height: 50px;
    padding: 4px;
    cursor: pointer;
  }

  `]
})
export class SurveyWizardStep1Component implements OnInit {
  @Input() surveyData!: WizardSurveyData;
  @Output() dataChange = new EventEmitter<WizardSurveyData>();
  @Output() fileUploaded = new EventEmitter<{ type: 'logo' | 'background', guid: string }>();

  private readonly fb = inject(FormBuilder);

  form!: FormGroup;

  readonly logoGuid = signal<string | undefined>(undefined);
  readonly backgroundGuid = signal<string | undefined>(undefined);

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
  }

  private initForm() {
    this.form = this.fb.group({
      title: [this.surveyData.title, [Validators.required, Validators.maxLength(200)]],
      description: [this.surveyData.description, Validators.maxLength(1000)],
      startDate: [this.surveyData.startDate, Validators.required],
      endDate: [this.surveyData.endDate, Validators.required],
      accessType: [this.surveyData.accessType || '1', Validators.required],
      showType: [this.surveyData.showType || '1', Validators.required],
      maxResponses: [this.surveyData.maxResponses],
      allowAnonymous: [this.surveyData.allowAnonymous],
      requireLogin: [this.surveyData.requireLogin],
      allowSaveDraft: [this.surveyData.allowSaveDraft],
      showProgressBar: [this.surveyData.showProgressBar],
      randomizeQuestions: [this.surveyData.randomizeQuestions],
      allowMultipleResponses: [this.surveyData.allowMultipleResponses],
      welcomeMessage: [this.surveyData.welcomeMessage],
      thankYouMessage: [this.surveyData.thankYouMessage],
      themeColor: [this.surveyData.themeColor || '#667eea'],
      hasCriteria: [!!this.surveyData.hasCriteria],
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
    this.form.valueChanges.subscribe(value => {
      this.dataChange.emit({
        ...value,
        logoGuid: this.logoGuid(),
        backgroundImageGuid: this.backgroundGuid(),
      });
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

  // File Upload Handlers
  onLogoUploaded(guid: string) {
    this.logoGuid.set(guid);
    this.fileUploaded.emit({ type: 'logo', guid });
    this.emitDataChange();
  }

  onLogoRemoved() {
    this.logoGuid.set(undefined);
    this.emitDataChange();
  }

  onBackgroundUploaded(guid: string) {
    this.backgroundGuid.set(guid);
    this.fileUploaded.emit({ type: 'background', guid });
    this.emitDataChange();
  }

  onBackgroundRemoved() {
    this.backgroundGuid.set(undefined);
    this.emitDataChange();
  }

  private emitDataChange() {
    const formValue = this.form.value;
    this.dataChange.emit({
      ...formValue,
      logoGuid: this.logoGuid(),
      backgroundImageGuid: this.backgroundGuid(),
    });
  }
}
