import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
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
import { SwalService } from '../../../../services/framework-services/swal.service';
import {
  QUESTION_TYPE_LABELS,
  VALIDATION_TYPE_LABELS,
  WizardCriterionData,
  WizardOptionData,
  WizardQuestionData,
  parseList,
} from '../../../../core/models/survey-wizard.model';

export interface QuestionModalSaveEvent {
  question: WizardQuestionData;
  criterionGuid?: string;
}

/** انواع سوالی که گزینه دارند */
const CHOICE_TYPES = [1, 2, 10];
/** انواع سوال متنی که اعتبارسنجی دارند */
const TEXT_TYPES = [3, 4];
/** اعتبارسنجی‌های عددی (مطابق enum بک‌اند) */
const NUMERIC_VALIDATIONS = [4, 5];
const REGEX_VALIDATION = 7;

let modalSeq = 0;

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
    <div class="modalOverlay" (keydown)="onKeydown($event)">
      <div #dialog class="modalContent" role="dialog" aria-modal="true"
        [attr.aria-labelledby]="titleId" tabindex="-1" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="modalHeader">
          <div class="modalHeader__title">
            <span class="modalHeader__icon"><i class="fa" [class.fa-pen]="isEditMode()" [class.fa-plus]="!isEditMode()" aria-hidden="true"></i></span>
            <h2 [id]="titleId">{{ isEditMode() ? 'ویرایش سوال' : 'افزودن سوال جدید' }}</h2>
          </div>
          <button type="button" class="closeBtn" (click)="requestClose()" aria-label="بستن پنجره">
            <i class="fa fa-times" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="modalBody">
          <form [formGroup]="form" novalidate (ngSubmit)="onSave()">

            @if (submitted() && errorList().length > 0) {
              <div class="errorSummary" role="alert">
                <i class="fa fa-exclamation-circle" aria-hidden="true"></i>
                <div>
                  <strong>برای ذخیره، موارد زیر را اصلاح کنید:</strong>
                  <ul>
                    @for (e of errorList(); track e) { <li>{{ e }}</li> }
                  </ul>
                </div>
              </div>
            }

            <!-- ========== انتخاب معیار ========== -->
            @if (hasCriteria) {
              <div class="section criterionSection">
                <h3 class="sectionTitle"><i class="fa fa-layer-group" aria-hidden="true"></i> معیار مرتبط</h3>
                <select class="in" [(ngModel)]="selectedCriterionGuid" [ngModelOptions]="{standalone: true}"
                  aria-label="معیار مرتبط">
                  <option value="">بدون معیار</option>
                  @for (c of criteria; track c.guid) {
                    <option [value]="c.guid">{{ c.title }}</option>
                  }
                </select>
              </div>
            }

            <!-- ========== اطلاعات پایه ========== -->
            <div class="section">
              <h3 class="sectionTitle">اطلاعات پایه</h3>

              <custom-select
                label="نوع سوال"
                formControlName="questionType"
                [options]="questionTypes()"
                [clearable]="false"
                identity="questionType"
                [required]="true">
              </custom-select>
              @if (questionTypeSig() === 8) {
                <p class="hint"><i class="fa fa-info-circle" aria-hidden="true"></i>
                  این سوال با نوع قدیمی «زمان/تاریخ» ذخیره شده است. برای استفاده از نوع جدید، «تاریخ» را انتخاب کنید.</p>
              }

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
              @if (showErr('questionText')) {
                <div class="fieldError" role="alert">{{ fieldErrors()['questionText'] }}</div>
              }

              <div class="sp-12"></div>

              <div class="grid grid-2">
                <custom-input
                  label="متن راهنما"
                  formControlName="helpText"
                  identity="helpText"
                  placeholder="توضیح کوتاه زیر سوال">
                </custom-input>

                @if (showPlaceholder()) {
                  <custom-input
                    label="متن نمونه‌ی کادر پاسخ"
                    formControlName="placeholder"
                    identity="placeholder"
                    placeholder="مثلاً: پاسخ خود را بنویسید">
                  </custom-input>
                }
              </div>

              <div class="sp-12"></div>

              <label class="choice">
                <input type="checkbox" formControlName="isRequired" />
                <span>پاسخ به این سوال الزامی است</span>
              </label>
            </div>

            <!-- ========== گزینه‌ها ========== -->
            @if (showOptions()) {
              <div class="section">
                <div class="sectionHeader">
                  <h3 class="sectionTitle" id="optionsTitle">گزینه‌ها</h3>
                  <button type="button" class="mBtn mBtn--soft sm" (click)="addOption(true)">
                    <i class="fa fa-plus" aria-hidden="true"></i>
                    افزودن گزینه
                  </button>
                </div>

                <div formArrayName="options" class="optionsList" role="list" aria-labelledby="optionsTitle">
                  @for (opt of options.controls; track trackOption($index, opt); let i = $index, first = $first, last = $last) {
                    <div class="optionRow" [formGroupName]="i" role="listitem">
                      <span class="optionRow__num" aria-hidden="true">{{ i + 1 }}</span>

                      <input
                        type="text"
                        class="in optionRow__text"
                        formControlName="optionText"
                        [id]="'opt-text-' + opt.get('tempId')?.value"
                        [attr.aria-label]="'متن گزینه ' + (i + 1)"
                        placeholder="متن گزینه"
                        (keydown.enter)="onOptionEnter($event, i)">

                      <input
                        type="number"
                        class="in optionRow__value"
                        formControlName="value"
                        [attr.aria-label]="'امتیاز گزینه ' + (i + 1)"
                        title="امتیاز (اختیاری)"
                        placeholder="امتیاز">

                      <div class="optionRow__color">
                        @if (opt.get('color')?.value) {
                          <input type="color" class="colorDot" formControlName="color"
                            [attr.aria-label]="'رنگ گزینه ' + (i + 1)">
                          <button type="button" class="iconBtn sm" (click)="clearOptionColor(i)"
                            [attr.aria-label]="'حذف رنگ گزینه ' + (i + 1)" title="حذف رنگ">
                            <i class="fa fa-times" aria-hidden="true"></i>
                          </button>
                        } @else {
                          <button type="button" class="iconBtn" (click)="setOptionColor(i)"
                            [attr.aria-label]="'افزودن رنگ به گزینه ' + (i + 1)" title="افزودن رنگ (اختیاری)">
                            <i class="fa fa-palette" aria-hidden="true"></i>
                          </button>
                        }
                      </div>

                      <div class="optionRow__actions">
                        <button type="button" class="iconBtn" [id]="'opt-up-' + opt.get('tempId')?.value"
                          (click)="moveOption(i, -1, 'up')" [disabled]="first"
                          [attr.aria-label]="'انتقال گزینه ' + (i + 1) + ' به بالا'" title="انتقال به بالا">
                          <i class="fa fa-arrow-up" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="iconBtn" [id]="'opt-down-' + opt.get('tempId')?.value"
                          (click)="moveOption(i, 1, 'down')" [disabled]="last"
                          [attr.aria-label]="'انتقال گزینه ' + (i + 1) + ' به پایین'" title="انتقال به پایین">
                          <i class="fa fa-arrow-down" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="iconBtn danger" (click)="removeOption(i)"
                          [disabled]="options.length <= 2"
                          [attr.aria-label]="'حذف گزینه ' + (i + 1)" title="حذف گزینه">
                          <i class="fa fa-trash" aria-hidden="true"></i>
                        </button>
                      </div>
                    </div>
                  }
                </div>

                @if (showErr('options')) {
                  <div class="fieldError" role="alert">{{ fieldErrors()['options'] }}</div>
                } @else {
                  <p class="hint">گزینه‌های خالی هنگام ذخیره نادیده گرفته می‌شوند. رنگ گزینه اختیاری است.</p>
                }

                <div class="sp-12"></div>

                <div class="grid grid-2">
                  <label class="choice">
                    <input type="checkbox" formControlName="randomizeOptions" />
                    <span>نمایش تصادفی گزینه‌ها</span>
                  </label>

                  <label class="choice">
                    <input type="checkbox" formControlName="allowOtherOption" />
                    <span>افزودن گزینه‌ی «سایر»</span>
                  </label>
                </div>

                @if (allowOtherOptionSig()) {
                  <div class="sp-12"></div>
                  <custom-input
                    label="متن گزینه‌ی «سایر»"
                    formControlName="otherOptionText"
                    identity="otherOptionText"
                    placeholder="سایر (لطفاً توضیح دهید)">
                  </custom-input>
                }
              </div>
            }

            <!-- ========== اعتبارسنجی (فقط سوالات متنی) ========== -->
            @if (needsValidation()) {
              <div class="section">
                <h3 class="sectionTitle">اعتبارسنجی پاسخ</h3>

                <custom-select
                  label="نوع اعتبارسنجی"
                  formControlName="validationType"
                  [options]="validationTypes"
                  [clearable]="false"
                  identity="validationType">
                </custom-select>

                @if (validationTypeSig() > 0) {
                  <div class="sp-12"></div>
                  <custom-input
                    label="پیام خطا (اختیاری)"
                    formControlName="validationErrorMessage"
                    identity="validationErrorMessage"
                    placeholder="مقدار وارد شده معتبر نیست">
                  </custom-input>
                }

                @if (validationTypeSig() === regexValidation) {
                  <div class="sp-12"></div>
                  <custom-input
                    label="الگوی عبارت باقاعده"
                    formControlName="validationRegex"
                    identity="validationRegex"
                    placeholder="^[0-9]{10}$">
                  </custom-input>
                  @if (showErr('validationRegex')) {
                    <div class="fieldError" role="alert">{{ fieldErrors()['validationRegex'] }}</div>
                  }
                  <div class="regexTester">
                    <label class="label" for="regexSample">آزمایش الگو</label>
                    <input id="regexSample" class="in" type="text" dir="auto" placeholder="یک نمونه پاسخ بنویسید"
                      [ngModel]="regexSample()" (ngModelChange)="regexSample.set($event)" [ngModelOptions]="{standalone: true}">
                    @if (regexSample() && regexTestResult() !== null) {
                      <span class="regexTester__result" [class.ok]="regexTestResult()" role="status">
                        <i class="fa" [class.fa-check-circle]="regexTestResult()" [class.fa-times-circle]="!regexTestResult()" aria-hidden="true"></i>
                        {{ regexTestResult() ? 'نمونه با الگو مطابقت دارد' : 'نمونه با الگو مطابقت ندارد' }}
                      </span>
                    }
                  </div>
                }

                @if (!isNumericValidation()) {
                  <div class="sp-12"></div>
                  <div class="grid grid-2">
                    <custom-input label="حداقل طول (کاراکتر)" formControlName="minLength" type="number" identity="minLength"></custom-input>
                    <custom-input label="حداکثر طول (کاراکتر)" formControlName="maxLength" type="number" identity="maxLength"></custom-input>
                  </div>
                  @if (showErr('length')) {
                    <div class="fieldError" role="alert">{{ fieldErrors()['length'] }}</div>
                  }
                } @else {
                  <div class="sp-12"></div>
                  <div class="grid grid-2">
                    <custom-input label="حداقل مقدار" formControlName="minValue" type="number" identity="minValue"></custom-input>
                    <custom-input label="حداکثر مقدار" formControlName="maxValue" type="number" identity="maxValue"></custom-input>
                  </div>
                  @if (showErr('value')) {
                    <div class="fieldError" role="alert">{{ fieldErrors()['value'] }}</div>
                  }
                }
              </div>
            }

            <!-- ========== محدودیت انتخاب (فقط چند انتخابی) ========== -->
            @if (questionTypeSig() === 2) {
              <div class="section">
                <h3 class="sectionTitle">محدودیت انتخاب</h3>
                <div class="grid grid-2">
                  <custom-input label="حداقل تعداد انتخاب" formControlName="minSelection" type="number" identity="minSelection" placeholder="بدون محدودیت"></custom-input>
                  <custom-input label="حداکثر تعداد انتخاب" formControlName="maxSelection" type="number" identity="maxSelection" placeholder="بدون محدودیت"></custom-input>
                </div>
                @if (showErr('selection')) {
                  <div class="fieldError" role="alert">{{ fieldErrors()['selection'] }}</div>
                }
              </div>
            }

            <!-- ========== امتیازدهی ========== -->
            @if (questionTypeSig() === 5) {
              <div class="section">
                <h3 class="sectionTitle">تنظیمات امتیازدهی</h3>
                <div class="grid grid-2">
                  <custom-input label="برچسب کمترین امتیاز" formControlName="minScaleLabel" identity="minScaleLabel" placeholder="بسیار ضعیف"></custom-input>
                  <custom-input label="برچسب بیشترین امتیاز" formControlName="maxScaleLabel" identity="maxScaleLabel" placeholder="عالی"></custom-input>
                </div>
              </div>
            }

            <!-- ========== ماتریس ========== -->
            @if (questionTypeSig() === 11) {
              <div class="section">
                <h3 class="sectionTitle">تنظیمات ماتریس</h3>
                <div class="grid grid-2">
                  <div class="field">
                    <label class="label" for="matrixRows">ردیف‌ها</label>
                    <textarea id="matrixRows" class="in" rows="4" formControlName="matrixRows"
                      placeholder="کیفیت&#10;قیمت&#10;خدمات"></textarea>
                    <span class="hint">هر ردیف در یک خط (یا جداشده با کاما) — {{ matrixRowCount() }} ردیف</span>
                  </div>
                  <div class="field">
                    <label class="label" for="matrixColumns">ستون‌ها</label>
                    <textarea id="matrixColumns" class="in" rows="4" formControlName="matrixColumns"
                      placeholder="موافقم&#10;نظری ندارم&#10;مخالفم"></textarea>
                    <span class="hint">هر ستون در یک خط (یا جداشده با کاما) — {{ matrixColumnCount() }} ستون</span>
                  </div>
                </div>
                @if (showErr('matrix')) {
                  <div class="fieldError" role="alert">{{ fieldErrors()['matrix'] }}</div>
                }
              </div>
            }

            <!-- ========== آپلود فایل ========== -->
            @if (questionTypeSig() === 9) {
              <div class="section">
                <h3 class="sectionTitle">تنظیمات آپلود فایل</h3>
                <div class="grid grid-2">
                  <custom-input label="حداکثر حجم (مگابایت)" formControlName="maxFileSize" type="number" identity="maxFileSize" placeholder="10"></custom-input>
                  <custom-input label="پسوندهای مجاز" formControlName="allowedFileTypes" identity="allowedFileTypes" placeholder=".pdf,.jpg,.png"></custom-input>
                </div>
                @if (showErr('maxFileSize')) {
                  <div class="fieldError" role="alert">{{ fieldErrors()['maxFileSize'] }}</div>
                }
              </div>
            }

            <!-- ========== رسانه ========== -->
            <div class="section">
              <h3 class="sectionTitle">رسانه (اختیاری)</h3>
              <div class="grid grid-2">
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
            </div>

          </form>
        </div>

        <!-- Footer -->
        <div class="modalFooter">
          @if (submitted() && errorList().length > 0) {
            <span class="modalFooter__msg" aria-hidden="true">
              <i class="fa fa-exclamation-circle"></i> {{ errorList().length }} مورد نیاز به اصلاح دارد
            </span>
          }
          <button type="button" class="mBtn mBtn--ghost" (click)="requestClose()">انصراف</button>
          <button type="button" class="mBtn mBtn--primary" (click)="onSave()">
            <i class="fa fa-check" aria-hidden="true"></i>
            {{ isEditMode() ? 'ذخیره تغییرات' : 'افزودن سوال' }}
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .modalOverlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 20px;
      animation: fadeIn 0.18s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .modalContent {
      background: #fff;
      border-radius: var(--wz-radius-lg, 18px);
      width: 100%;
      max-width: 860px;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 64px rgba(15, 23, 42, 0.25);
      animation: slideUp 0.22s ease;
      outline: none;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .modalOverlay, .modalContent { animation: none; }
    }

    .modalHeader {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 22px;
      border-bottom: 1px solid var(--wz-border, #e2e8f0);
      flex-shrink: 0;
    }
    .modalHeader__title { display: flex; align-items: center; gap: 10px; }
    .modalHeader__icon {
      width: 36px; height: 36px; border-radius: 10px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--wz-primary-soft, rgba(29,78,216,.08));
      color: var(--wz-primary, #1d4ed8);
    }
    .modalHeader h2 { margin: 0; font-weight: 900; font-size: 1.15rem; color: var(--wz-ink, #0f172a); }

    .closeBtn {
      width: 38px; height: 38px;
      border: 1px solid var(--wz-border, #e2e8f0);
      background: #fff;
      border-radius: 10px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: var(--wz-muted, #64748b);
      transition: all 0.15s;
    }
    .closeBtn:hover { background: var(--wz-danger-soft, rgba(220,38,38,.08)); color: var(--wz-danger, #dc2626); }
    .closeBtn:focus-visible { outline: 2px solid var(--wz-primary, #1d4ed8); outline-offset: 2px; }

    .modalBody { flex: 1; overflow-y: auto; padding: 20px 22px; overscroll-behavior: contain; }
    .modalBody form { display: grid; gap: 14px; }

    .section {
      padding: 16px 18px;
      background: var(--wz-subtle, #f8fafc);
      border: 1px solid var(--wz-border, #e2e8f0);
      border-radius: var(--wz-radius, 14px);
      min-width: 0;
    }
    .sectionTitle {
      font-size: 0.98rem;
      font-weight: 900;
      margin: 0 0 12px 0;
      color: var(--wz-ink, #0f172a);
    }
    .sectionHeader {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .sectionHeader .sectionTitle { margin: 0; }

    .choice {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 11px 14px;
      border-radius: var(--wz-radius-sm, 10px);
      border: 1px solid var(--wz-border, #e2e8f0);
      background: #fff;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .choice:hover { border-color: var(--wz-border-strong, #cbd5e1); }
    .choice input { accent-color: var(--wz-primary, #1d4ed8); cursor: pointer; width: 18px; height: 18px; }
    .choice:has(input:checked) { border-color: var(--wz-primary, #1d4ed8); background: var(--wz-primary-soft, rgba(29,78,216,.08)); }
    .choice:has(input:focus-visible) { box-shadow: 0 0 0 3px var(--wz-primary-ring, rgba(29,78,216,.18)); }
    .choice span { font-weight: 700; font-size: 0.9rem; }

    /* ---------- Options ---------- */
    .optionsList { display: grid; gap: 8px; }
    .optionRow {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) 92px auto auto;
      gap: 8px;
      align-items: center;
      background: #fff;
      padding: 8px;
      border: 1px solid var(--wz-border, #e2e8f0);
      border-radius: var(--wz-radius-sm, 10px);
    }
    .optionRow__num {
      width: 28px; height: 28px;
      background: var(--wz-primary-soft, rgba(29,78,216,.08));
      color: var(--wz-primary, #1d4ed8);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 0.82rem;
    }
    .optionRow__color, .optionRow__actions { display: flex; gap: 4px; align-items: center; }
    .colorDot {
      width: 34px; height: 34px; padding: 2px;
      border: 1px solid var(--wz-border, #e2e8f0);
      border-radius: 8px; background: #fff; cursor: pointer;
    }

    .iconBtn {
      width: 34px; height: 34px;
      border: 1px solid var(--wz-border, #e2e8f0);
      border-radius: 8px;
      background: #fff;
      color: var(--wz-muted, #64748b);
      cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      transition: all 0.15s;
      font-size: 0.85rem;
    }
    .iconBtn.sm { width: 26px; height: 26px; font-size: 0.72rem; }
    .iconBtn:hover:not(:disabled) { border-color: var(--wz-primary, #1d4ed8); color: var(--wz-primary, #1d4ed8); }
    .iconBtn.danger:hover:not(:disabled) { border-color: var(--wz-danger, #dc2626); color: var(--wz-danger, #dc2626); background: var(--wz-danger-soft, rgba(220,38,38,.08)); }
    .iconBtn:disabled { opacity: 0.35; cursor: not-allowed; }
    .iconBtn:focus-visible { outline: 2px solid var(--wz-primary, #1d4ed8); outline-offset: 1px; }

    .hint { margin: 8px 0 0; font-size: 0.8rem; color: var(--wz-muted, #64748b); display: block; }
    .fieldError {
      margin-top: 6px;
      padding: 7px 10px;
      border-radius: 8px;
      font-size: 0.82rem;
      background: var(--wz-danger-soft, rgba(220,38,38,.08));
      color: var(--wz-danger, #dc2626);
    }
    .errorSummary {
      display: flex; gap: 10px; align-items: flex-start;
      padding: 12px 14px;
      border-radius: var(--wz-radius-sm, 10px);
      border: 1px solid rgba(220, 38, 38, 0.25);
      background: var(--wz-danger-soft, rgba(220,38,38,.08));
      color: #991b1b;
      font-size: 0.86rem;
    }
    .errorSummary ul { margin: 4px 0 0; padding-inline-start: 18px; }

    .regexTester { margin-top: 10px; display: grid; gap: 6px; }
    .regexTester__result { font-size: 0.82rem; font-weight: 700; color: var(--wz-danger, #dc2626); display: inline-flex; gap: 6px; align-items: center; }
    .regexTester__result.ok { color: var(--wz-success, #16a34a); }

    .field { display: flex; flex-direction: column; gap: 6px; }
    .label { font-weight: 800; font-size: 0.88rem; color: var(--wz-ink, #0f172a); }

    .grid { display: grid; gap: 12px; }
    .grid.grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }

    .modalFooter {
      position: sticky;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 22px;
      border-top: 1px solid var(--wz-border, #e2e8f0);
      background: #fff;
      border-radius: 0 0 var(--wz-radius-lg, 18px) var(--wz-radius-lg, 18px);
      flex-shrink: 0;
    }
    .modalFooter__msg { margin-inline-end: auto; font-size: 0.82rem; color: var(--wz-danger, #dc2626); font-weight: 700; }

    .mBtn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      min-height: 42px;
      padding: 9px 20px;
      border-radius: var(--wz-radius-sm, 10px);
      font: inherit; font-weight: 800; font-size: 0.9rem;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background 0.15s, border-color 0.15s;
    }
    .mBtn.sm { min-height: 34px; padding: 6px 12px; font-size: 0.82rem; }
    .mBtn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--wz-primary-ring, rgba(29,78,216,.18)); }
    .mBtn--primary { background: var(--wz-primary, #1d4ed8); color: #fff; }
    .mBtn--primary:hover { background: var(--wz-primary-600, #1e40af); }
    .mBtn--ghost { background: #fff; border-color: var(--wz-border, #e2e8f0); color: var(--wz-ink, #0f172a); }
    .mBtn--ghost:hover { background: var(--wz-subtle, #f8fafc); }
    .mBtn--soft { background: var(--wz-primary-soft, rgba(29,78,216,.08)); color: var(--wz-primary, #1d4ed8); }
    .mBtn--soft:hover { background: rgba(29, 78, 216, 0.14); }

    :host ::ng-deep .in,
    :host ::ng-deep .sel,
    :host ::ng-deep .ta {
      width: 100%;
      border: 1px solid var(--wz-border, #e2e8f0);
      background: #fff;
      padding: 9px 12px;
      border-radius: var(--wz-radius-sm, 10px);
      outline: none;
      color: var(--wz-ink, #0f172a);
      font-family: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
      min-width: 0;
    }
    :host ::ng-deep .in:focus,
    :host ::ng-deep .sel:focus,
    :host ::ng-deep .ta:focus {
      border-color: var(--wz-primary, #1d4ed8);
      box-shadow: 0 0 0 3px var(--wz-primary-ring, rgba(29,78,216,.18));
    }
    textarea.in { resize: vertical; }
    .criterionSection { background: #f0f5ff; border-color: rgba(29,78,216,0.2); }
    .criterionSection select.in { max-width: 100%; }

    /* ---------- موبایل ---------- */
    @media (max-width: 640px) {
      .modalOverlay { padding: 0; align-items: stretch; }
      .modalContent { max-width: none; max-height: none; height: 100%; border-radius: 0; }
      .modalFooter { border-radius: 0; padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0)); }
      .modalFooter .mBtn { flex: 1; }
      .modalFooter__msg { display: none; }
      .modalHeader { padding: 12px 14px; }
      .modalBody { padding: 14px; }
      .section { padding: 14px 12px; }
      .grid.grid-2 { grid-template-columns: 1fr; }
      .optionRow {
        grid-template-columns: auto minmax(0, 1fr) 76px;
        grid-template-areas: 'num text value' 'color color actions';
      }
      .optionRow__num { grid-area: num; }
      .optionRow__text { grid-area: text; }
      .optionRow__value { grid-area: value; }
      .optionRow__color { grid-area: color; }
      .optionRow__actions { grid-area: actions; justify-content: flex-end; }
    }
  `],
})
export class QuestionModalComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
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

  @ViewChild('dialog') dialogRef?: ElementRef<HTMLElement>;

  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly swalService = inject(SwalService);

  readonly titleId = `qm-title-${++modalSeq}`;
  readonly regexValidation = REGEX_VALIDATION;

  form!: FormGroup;

  // Signals
  readonly questionImageGuid = signal<string | undefined>(undefined);
  readonly questionVideoGuid = signal<string | undefined>(undefined);
  readonly optionImageGuids = signal<(string | undefined)[]>([]);

  readonly isEditMode = signal(false);

  readonly questionTypeSig = signal<number>(3);
  readonly validationTypeSig = signal<number>(0);
  readonly allowOtherOptionSig = signal<boolean>(false);
  /** با هر تغییر فرم یک واحد افزایش می‌یابد تا computedها دوباره محاسبه شوند */
  private readonly formTick = signal(0);
  readonly submitted = signal(false);
  readonly regexSample = signal('');

  // Computed
  readonly showOptions = computed(() => CHOICE_TYPES.includes(this.questionTypeSig()));
  readonly needsValidation = computed(() => TEXT_TYPES.includes(this.questionTypeSig()));
  readonly showPlaceholder = computed(() => [3, 4, 10].includes(this.questionTypeSig()));
  readonly isNumericValidation = computed(() => NUMERIC_VALIDATIONS.includes(this.validationTypeSig()));

  /** نوع ۸ (قدیمی) فقط وقتی در لیست می‌آید که سوال فعلی از همان نوع باشد */
  readonly questionTypes = computed(() => {
    const list = [
      { guid: '3', title: QUESTION_TYPE_LABELS[3] },
      { guid: '4', title: QUESTION_TYPE_LABELS[4] },
      { guid: '1', title: QUESTION_TYPE_LABELS[1] },
      { guid: '2', title: QUESTION_TYPE_LABELS[2] },
      { guid: '10', title: QUESTION_TYPE_LABELS[10] },
      { guid: '5', title: QUESTION_TYPE_LABELS[5] },
      { guid: '7', title: QUESTION_TYPE_LABELS[7] },
      { guid: '9', title: QUESTION_TYPE_LABELS[9] },
      { guid: '11', title: QUESTION_TYPE_LABELS[11] },
    ];
    if (this.questionTypeSig() === 8 || this.originalType === 8) {
      list.push({ guid: '8', title: QUESTION_TYPE_LABELS[8] });
    }
    return list;
  });

  readonly validationTypes = Object.entries(VALIDATION_TYPE_LABELS)
    .map(([guid, title]) => ({ guid, title }));

  readonly matrixRowCount = computed(() => { this.formTick(); return parseList(this.form?.get('matrixRows')?.value).length; });
  readonly matrixColumnCount = computed(() => { this.formTick(); return parseList(this.form?.get('matrixColumns')?.value).length; });

  /** خطاهای فیلدها (کلید → پیام) */
  readonly fieldErrors = computed<Record<string, string>>(() => {
    this.formTick();
    const type = this.questionTypeSig();
    const vt = this.validationTypeSig();
    const errs: Record<string, string> = {};
    if (!this.form) return errs;
    const v = this.form.getRawValue();

    if (!String(v.questionText ?? '').trim()) errs['questionText'] = 'متن سوال الزامی است.';
    else if (String(v.questionText).length > 500) errs['questionText'] = 'متن سوال حداکثر ۵۰۰ کاراکتر است.';

    if (CHOICE_TYPES.includes(type)) {
      const filled = (v.options ?? []).filter((o: any) => String(o?.optionText ?? '').trim()).length;
      if (filled < 2) errs['options'] = 'حداقل دو گزینه‌ی دارای متن لازم است.';
    }

    if (TEXT_TYPES.includes(type)) {
      if (NUMERIC_VALIDATIONS.includes(vt)) {
        const minV = this.num(v.minValue), maxV = this.num(v.maxValue);
        if (Number.isNaN(minV) || Number.isNaN(maxV)) errs['value'] = 'حداقل و حداکثر مقدار باید عدد باشند.';
        else if (minV != null && maxV != null && minV > maxV) errs['value'] = 'حداقل مقدار نباید از حداکثر مقدار بیشتر باشد.';
        else if (vt === 5 && (minV == null || maxV == null)) errs['value'] = 'برای «بازه‌ی عددی» حداقل و حداکثر مقدار را وارد کنید.';
      } else {
        const minL = this.num(v.minLength), maxL = this.num(v.maxLength);
        if (Number.isNaN(minL) || Number.isNaN(maxL) || (minL != null && (minL < 0 || !Number.isInteger(minL))) || (maxL != null && (maxL < 0 || !Number.isInteger(maxL)))) {
          errs['length'] = 'طول متن باید عدد صحیح و غیرمنفی باشد.';
        } else if (minL != null && maxL != null && minL > maxL) {
          errs['length'] = 'حداقل طول نباید از حداکثر طول بیشتر باشد.';
        }
      }
      if (vt === REGEX_VALIDATION) {
        const pattern = String(v.validationRegex ?? '').trim();
        if (!pattern) errs['validationRegex'] = 'الگوی عبارت باقاعده را وارد کنید.';
        else if (!this.compileRegex(pattern)) errs['validationRegex'] = 'الگوی وارد شده معتبر نیست.';
      }
    }

    if (type === 2) {
      const minS = this.num(v.minSelection), maxS = this.num(v.maxSelection);
      const optCount = (v.options ?? []).filter((o: any) => String(o?.optionText ?? '').trim()).length;
      if (Number.isNaN(minS) || Number.isNaN(maxS) || (minS != null && minS < 0) || (maxS != null && maxS < 0)) {
        errs['selection'] = 'تعداد انتخاب باید عدد غیرمنفی باشد.';
      } else if (minS != null && maxS != null && minS > maxS) {
        errs['selection'] = 'حداقل انتخاب نباید از حداکثر انتخاب بیشتر باشد.';
      } else if (maxS != null && optCount >= 2 && maxS > optCount) {
        errs['selection'] = `حداکثر انتخاب نمی‌تواند از تعداد گزینه‌ها (${optCount}) بیشتر باشد.`;
      }
    }

    if (type === 11) {
      const rows = parseList(v.matrixRows).length;
      const cols = parseList(v.matrixColumns).length;
      if (rows < 1 || cols < 2) errs['matrix'] = 'ماتریس حداقل به یک ردیف و دو ستون نیاز دارد.';
    }

    if (type === 9) {
      const size = this.num(v.maxFileSize);
      if (Number.isNaN(size) || (size != null && size <= 0)) errs['maxFileSize'] = 'حداکثر حجم باید عددی بزرگ‌تر از صفر باشد.';
    }

    return errs;
  });

  readonly errorList = computed(() => Object.values(this.fieldErrors()));

  readonly regexTestResult = computed<boolean | null>(() => {
    this.formTick();
    const sample = this.regexSample();
    const re = this.compileRegex(String(this.form?.get('validationRegex')?.value ?? '').trim());
    if (!re || !sample) return null;
    return re.test(sample);
  });

  private originalType = 0;
  private initialSnapshot = '';
  private previouslyFocused: HTMLElement | null = null;
  private previousBodyOverflow = '';

  ngOnInit(): void {
    this.previouslyFocused = (document.activeElement as HTMLElement) ?? null;
    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    this.initForm();
    this.applyQuestion(this.question);
    this.bindReactiveFields();
    this.selectedCriterionGuid = this.question?.criterionGuid ?? this.initialCriterionGuid ?? '';
    this.initialSnapshot = this.snapshot();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      const target = this.dialogRef?.nativeElement.querySelector<HTMLElement>('#questionText textarea, #questionText, textarea, input:not([type=hidden])');
      (target ?? this.dialogRef?.nativeElement)?.focus();
    });
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.previousBodyOverflow;
    const prev = this.previouslyFocused;
    if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
      setTimeout(() => prev.focus());
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['question'] && this.form) {
      this.applyQuestion(this.question);
      this.selectedCriterionGuid = this.question?.criterionGuid ?? this.initialCriterionGuid ?? '';
      this.initialSnapshot = this.snapshot();
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      // Base
      questionType: ['3', Validators.required],
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

      // Matrix (متن چندخطی؛ هنگام ذخیره به آرایه تبدیل می‌شود)
      matrixRows: [''],
      matrixColumns: [''],

      // File Upload
      maxFileSize: [null],
      allowedFileTypes: [''],
    });
  }

  private bindReactiveFields(): void {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formTick.update(v => v + 1));

    this.form.get('questionType')?.valueChanges
      .pipe(
        map(v => this.toNumber(v)),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(type => {
        if (!type) return;
        this.questionTypeSig.set(type);
        this.syncByQuestionType(type);
        this.formTick.update(v => v + 1);
      });

    this.form.get('validationType')?.valueChanges
      .pipe(
        map(v => this.toNumber(v)),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(type => {
        this.validationTypeSig.set(type);
        // فیلدهای نامرتبط را پاک کن تا مقدار پنهان ذخیره نشود
        if (NUMERIC_VALIDATIONS.includes(type)) {
          this.form.patchValue({ minLength: null, maxLength: null }, { emitEvent: false });
        } else {
          this.form.patchValue({ minValue: null, maxValue: null }, { emitEvent: false });
        }
        if (type !== REGEX_VALIDATION) {
          this.form.patchValue({ validationRegex: '' }, { emitEvent: false });
        }
        this.formTick.update(v => v + 1);
      });

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

  /** null برای خالی، NaN برای نامعتبر */
  private num(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  private compileRegex(pattern: string): RegExp | null {
    if (!pattern) return null;
    try {
      return new RegExp(pattern);
    } catch {
      return null;
    }
  }

  private syncByQuestionType(type: number): void {
    const needsOptions = CHOICE_TYPES.includes(type);

    if (!needsOptions) {
      this.options.clear({ emitEvent: false });
      this.optionImageGuids.set([]);
      this.form.patchValue(
        { randomizeOptions: false, allowOtherOption: false, otherOptionText: '' },
        { emitEvent: false }
      );
      this.allowOtherOptionSig.set(false);
    } else {
      while (this.options.length < 2) this.addOption();
    }

    // ✅ W4: فقط سوالات متنی (۳ و ۴) اعتبارسنجی دارند؛ برای بقیه ریست کن
    if (!TEXT_TYPES.includes(type)) {
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

    if (type !== 2) {
      this.form.patchValue({ minSelection: null, maxSelection: null }, { emitEvent: false });
    }
    if (type !== 5) {
      this.form.patchValue({ minScaleLabel: '', maxScaleLabel: '' }, { emitEvent: false });
    }
    if (type !== 11) {
      this.form.patchValue({ matrixRows: '', matrixColumns: '' }, { emitEvent: false });
    }
    if (type !== 9) {
      this.form.patchValue({ maxFileSize: null, allowedFileTypes: '' }, { emitEvent: false });
    }
  }

  private applyQuestion(q: WizardQuestionData | null): void {
    this.isEditMode.set(!!q);
    this.questionImageGuid.set(q?.imageGuid);
    this.questionVideoGuid.set(q?.videoGuid);

    this.options.clear({ emitEvent: false });
    this.optionImageGuids.set([]);

    const type = this.toNumber(q?.questionType ?? 3);
    this.originalType = q ? type : 0;

    // سازگاری با سوالات قدیمی: قبلاً «Regex سفارشی» کد ۴ داشت (در بک‌اند ۷ است)
    let vType = this.toNumber(q?.validationType ?? 0);
    if (vType === 4 && (q?.customValidationRegex ?? '').trim()) vType = REGEX_VALIDATION;
    if (!VALIDATION_TYPE_LABELS[vType]) vType = 0;

    const allowOther = !!q?.allowOtherOption;

    this.questionTypeSig.set(type);
    this.validationTypeSig.set(vType);
    this.allowOtherOptionSig.set(allowOther);

    this.form.reset({
      questionType: String(type),
      questionText: q?.questionText ?? '',
      helpText: q?.helpText ?? '',
      placeholder: q?.placeholder ?? '',
      isRequired: !!q?.isRequired,

      randomizeOptions: !!q?.randomizeOptions,
      allowOtherOption: allowOther,
      otherOptionText: q?.otherOptionText ?? '',

      validationType: String(vType),
      validationErrorMessage: q?.validationErrorMessage ?? '',
      validationRegex: q?.customValidationRegex ?? '',
      minLength: q?.minLength ?? null,
      maxLength: q?.maxLength ?? null,
      minValue: q?.minValue ?? null,
      maxValue: q?.maxValue ?? null,

      minSelection: q?.minSelections ?? null,
      maxSelection: q?.maxSelections ?? null,

      minScaleLabel: q?.minScaleLabel ?? '',
      maxScaleLabel: q?.maxScaleLabel ?? '',

      // ✅ W5: آرایه/JSON/متن → متن چندخطی
      matrixRows: parseList(q?.matrixRows).join('\n'),
      matrixColumns: parseList(q?.matrixColumns).join('\n'),

      maxFileSize: q?.maxFileSize ?? null,
      allowedFileTypes: q?.allowedFileTypes ?? '',
    }, { emitEvent: false });

    if (CHOICE_TYPES.includes(type)) {
      const qOpts = (q?.options ?? []).filter(o => !o.isRemoved)
        .slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const guids: (string | undefined)[] = [];
      for (const opt of qOpts) {
        this.options.push(this.createOptionGroup(opt), { emitEvent: false });
        guids.push(opt.imageGuid);
      }
      this.optionImageGuids.set(guids);
      while (this.options.length < 2) this.addOption();
    }

    this.syncByQuestionType(type);
    this.formTick.update(v => v + 1);
  }

  private snapshot(): string {
    return JSON.stringify({
      v: this.form.getRawValue(),
      img: this.questionImageGuid(),
      vid: this.questionVideoGuid(),
      c: this.selectedCriterionGuid,
    });
  }

  private isDirty(): boolean {
    return this.snapshot() !== this.initialSnapshot;
  }

  // ========== Options ==========
  get options(): FormArray<FormGroup> {
    return this.form.get('options') as FormArray<FormGroup>;
  }

  trackOption(index: number, ctrl: AbstractControl): any {
    return ctrl.get('tempId')?.value ?? index;
  }

  private createOptionGroup(opt?: Partial<WizardOptionData>): FormGroup {
    return this.fb.group({
      guid: [opt?.guid],
      optionText: [opt?.optionText ?? ''],
      value: [opt?.value ?? null],
      // ✅ W10: پیش‌فرض بدون رنگ
      color: [opt?.color || ''],
      tempId: [opt?.tempId ?? this.generateTempId()],
    });
  }

  addOption(focus = false): void {
    const group = this.createOptionGroup();
    this.options.push(group);
    this.optionImageGuids.update(curr => [...curr, undefined]);
    if (focus) this.focusById('opt-text-' + group.get('tempId')?.value);
  }

  onOptionEnter(event: Event, index: number): void {
    event.preventDefault();
    if (index === this.options.length - 1) {
      this.addOption(true);
    } else {
      this.focusById('opt-text-' + this.options.at(index + 1).get('tempId')?.value);
    }
  }

  removeOption(index: number): void {
    if (this.options.length <= 2) return;
    const nextFocus = this.options.at(index + 1) ?? this.options.at(index - 1);
    this.options.removeAt(index);
    this.optionImageGuids.update(curr => curr.filter((_, i) => i !== index));
    if (nextFocus) this.focusById('opt-text-' + nextFocus.get('tempId')?.value);
  }

  moveOption(index: number, delta: number, dir: 'up' | 'down'): void {
    const target = index + delta;
    if (target < 0 || target >= this.options.length) return;
    const ctrl = this.options.at(index);
    this.options.removeAt(index, { emitEvent: false });
    this.options.insert(target, ctrl);
    this.optionImageGuids.update(curr => {
      const copy = [...curr];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
    // فوکوس روی همان دکمه در جایگاه جدید (یا دکمه‌ی مخالف اگر غیرفعال شد)
    const id = ctrl.get('tempId')?.value;
    const atEdge = (dir === 'up' && target === 0) || (dir === 'down' && target === this.options.length - 1);
    this.focusById(`opt-${atEdge ? (dir === 'up' ? 'down' : 'up') : dir}-${id}`);
  }

  setOptionColor(index: number): void {
    this.options.at(index).get('color')?.setValue('#1d4ed8');
  }

  clearOptionColor(index: number): void {
    this.options.at(index).get('color')?.setValue('');
  }

  private focusById(id: string): void {
    setTimeout(() => document.getElementById(id)?.focus());
  }

  // ========== Question Media ==========
  onQuestionImageUploaded(guid: string): void {
    this.questionImageGuid.set(guid);
    const relatedId = this.question?.tempId || this.generateTempId();
    this.fileUploaded.emit({ type: 'questionImage', guid, relatedId });
  }
  onQuestionImageRemoved(): void {
    this.questionImageGuid.set(undefined);
  }

  onQuestionVideoUploaded(guid: string): void {
    this.questionVideoGuid.set(guid);
    const relatedId = this.question?.tempId || this.generateTempId();
    this.fileUploaded.emit({ type: 'questionVideo', guid, relatedId });
  }
  onQuestionVideoRemoved(): void {
    this.questionVideoGuid.set(undefined);
  }

  // ========== Errors ==========
  showErr(key: string): boolean {
    if (!this.fieldErrors()[key]) return false;
    if (this.submitted()) return true;
    // خطاهای منطقی (بازه‌ها/الگو) به محض ورود مقدار نمایش داده می‌شوند
    if (key === 'validationRegex') return !!String(this.form.get('validationRegex')?.value ?? '').trim();
    return ['length', 'value', 'selection', 'maxFileSize'].includes(key);
  }

  // ========== Save/Cancel ==========
  canSave(): boolean {
    return this.errorList().length === 0;
  }

  onSave(): void {
    this.submitted.set(true);
    if (!this.canSave()) {
      this.form.markAllAsTouched();
      setTimeout(() => this.dialogRef?.nativeElement.querySelector('.modalBody')?.scrollTo({ top: 0, behavior: 'smooth' }));
      return;
    }

    const v = this.form.getRawValue();
    const type = this.questionTypeSig();
    const isChoice = CHOICE_TYPES.includes(type);
    const isText = TEXT_TYPES.includes(type);
    const vt = isText ? this.toNumber(v.validationType) : 0;

    // ✅ W3: گزینه‌های خالی حذف می‌شوند
    const finalOptions: WizardOptionData[] = isChoice
      ? (v.options ?? [])
        .map((opt: any, index: number) => ({ opt, image: this.optionImageGuids()[index] }))
        .filter(({ opt }: any) => String(opt.optionText ?? '').trim())
        .map(({ opt, image }: any, index: number) => ({
          tempId: opt.tempId,
          guid: opt.guid || undefined,
          optionText: String(opt.optionText).trim(),
          sortOrder: index + 1,
          value: opt.value === '' || opt.value == null ? null : Number(opt.value),
          color: opt.color || undefined,
          imageGuid: image,
        }))
      : [];

    // گزینه‌های موجود در سرور که حذف شده‌اند باید با isRemoved=true ارسال شوند
    const keptGuids = new Set(finalOptions.map(o => o.guid).filter(Boolean));
    const removedExisting: WizardOptionData[] = (this.question?.options ?? [])
      .filter(o => o.guid && !keptGuids.has(o.guid))
      .map(o => ({ ...o, isRemoved: true }));

    const allOptions = [...finalOptions, ...removedExisting];

    const nullIfEmpty = (x: any) => (x === '' || x === undefined ? null : x);

    const questionData: WizardQuestionData = {
      tempId: this.question?.tempId || this.generateTempId(),
      guid: this.question?.guid,
      questionText: String(v.questionText).trim(),
      questionType: type,
      sortOrder: this.question?.sortOrder || 1,
      isRequired: !!v.isRequired,
      helpText: v.helpText,
      placeholder: this.showPlaceholder() ? v.placeholder : '',
      imageGuid: this.questionImageGuid(),
      videoGuid: this.questionVideoGuid(),
      criterionGuid: this.question?.criterionGuid,
      logics: this.question?.logics,

      validationType: vt,
      validationErrorMessage: vt ? v.validationErrorMessage : '',
      customValidationRegex: vt === REGEX_VALIDATION ? String(v.validationRegex ?? '').trim() : '',
      minLength: isText ? nullIfEmpty(v.minLength) : null,
      maxLength: isText ? nullIfEmpty(v.maxLength) : null,
      minValue: isText ? nullIfEmpty(v.minValue) : null,
      maxValue: isText ? nullIfEmpty(v.maxValue) : null,

      minSelections: type === 2 ? nullIfEmpty(v.minSelection) : null,
      maxSelections: type === 2 ? nullIfEmpty(v.maxSelection) : null,

      minScaleLabel: v.minScaleLabel,
      maxScaleLabel: v.maxScaleLabel,

      // ✅ W5: List<string>
      matrixRows: type === 11 ? parseList(v.matrixRows) : undefined,
      matrixColumns: type === 11 ? parseList(v.matrixColumns) : undefined,

      maxFileSize: type === 9 ? nullIfEmpty(v.maxFileSize) : null,
      allowedFileTypes: type === 9 ? v.allowedFileTypes : '',

      randomizeOptions: isChoice && !!v.randomizeOptions,
      allowOtherOption: isChoice && !!v.allowOtherOption,
      otherOptionText: isChoice && v.allowOtherOption ? v.otherOptionText : '',

      options: isChoice || removedExisting.length ? allOptions : undefined,
    };

    this.initialSnapshot = this.snapshot();
    this.save.emit({
      question: questionData,
      criterionGuid: this.selectedCriterionGuid || undefined,
    });
  }

  /** بستن با تأیید در صورت وجود تغییرات ذخیره‌نشده */
  async requestClose(): Promise<void> {
    if (!this.isDirty()) {
      this.cancel.emit();
      return;
    }
    const result = await this.swalService.fire({
      icon: 'warning',
      title: 'تغییرات این سوال ذخیره نشده‌اند',
      text: 'آیا می‌خواهید بدون ذخیره پنجره را ببندید؟',
      showCancelButton: true,
      confirmButtonText: 'بستن بدون ذخیره',
      cancelButtonText: 'ادامه ویرایش',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
      focusCancel: true,
    });
    if (result.isConfirmed) {
      this.cancel.emit();
    } else {
      this.dialogRef?.nativeElement.focus();
    }
  }

  /** @deprecated برای سازگاری — از requestClose استفاده کنید */
  onCancel(): void {
    this.requestClose();
  }

  // ========== Keyboard: Esc + Focus trap ==========
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // اگر یک dropdown باز است، اجازه بده خودش Esc را مدیریت کند
      const target = event.target as HTMLElement | null;
      if (target?.closest('ng-select.ng-select-opened')) return;
      event.preventDefault();
      event.stopPropagation();
      this.requestClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const root = this.dialogRef?.nativeElement;
    if (!root) return;
    const focusables = Array.from(root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && (active === first || active === root)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private generateTempId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
