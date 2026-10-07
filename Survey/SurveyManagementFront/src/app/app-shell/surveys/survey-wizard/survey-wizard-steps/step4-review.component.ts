import { Component, Input, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TusUploadService } from '../../../../services/framework-services/tus-upload.service';
import { WizardSurveyData, WizardQuestionData, WizardCriterionData } from '../../../../core/models/survey-wizard.model';

const UNASSIGNED_KEY = '__none__';

interface ReviewGroup {
  key: string;
  title: string;
  questions: WizardQuestionData[];
}

@Component({
  selector: 'app-survey-wizard-step3',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="reviewContainer">

      <!-- Survey Summary Card -->
      <div class="card summaryCard">
        <div class="summaryCard__header">
          <div>
            <h2>{{ surveyData.title }}</h2>
            <p>{{ surveyData.description }}</p>
          </div>
          <span class="badge blue">پیش‌نمایش نهایی</span>
        </div>

        <div class="summaryCard__meta">
          <div class="metaRow">
            <div class="metaItem">
              <i class="fa fa-calendar"></i>
              <div>
                <span class="metaLabel">تاریخ شروع</span>
                <span class="metaValue">{{ surveyData.startDate }}</span>
              </div>
            </div>

            <div class="metaItem">
              <i class="fa fa-calendar-check"></i>
              <div>
                <span class="metaLabel">تاریخ پایان</span>
                <span class="metaValue">{{ surveyData.endDate }}</span>
              </div>
            </div>

            <div class="metaItem">
              <i class="fa fa-question-circle"></i>
              <div>
                <span class="metaLabel">تعداد سوالات</span>
                <span class="metaValue">{{ questions.length }} سوال</span>
              </div>
            </div>

            @if (hasCriteria) {
              <div class="metaItem">
                <i class="fa fa-layer-group"></i>
                <div>
                  <span class="metaLabel">تعداد معیارها</span>
                  <span class="metaValue">{{ visibleCriteria().length }} معیار</span>
                </div>
              </div>
            }
          </div>
        </div>

        @if (surveyData.themeColor || surveyData.logoGuid || surveyData.backgroundImageGuid) {
          <div class="brandRow">
            @if (surveyData.themeColor) {
              <div class="brandChip">
                <span class="brandChip__label">رنگ تم</span>
                <span class="brandChip__color" [style.background]="surveyData.themeColor">
                  {{ surveyData.themeColor }}
                </span>
              </div>
            }

            @if (surveyData.logoGuid) {
              <div class="brandChip brandChip--media">
                <span class="brandChip__label">لوگو</span>
                @if (logoUrl()) {
                  <img class="brandChip__img" [src]="logoUrl()" alt="Logo">
                } @else {
                  <i class="fa fa-spinner fa-spin"></i>
                }
              </div>
            }

            @if (surveyData.backgroundImageGuid) {
              <div class="brandChip brandChip--media">
                <span class="brandChip__label">پس‌زمینه</span>
                @if (backgroundUrl()) {
                  <img class="brandChip__img" [src]="backgroundUrl()" alt="Background">
                } @else {
                  <i class="fa fa-spinner fa-spin"></i>
                }
              </div>
            }
          </div>
        }

        <div class="settingsSummary">
          <div class="settingsList">
            @if (hasCriteria) {
              <span class="settingTag ok">
                <i class="fa fa-layer-group"></i>
                نظرسنجی معیار محور
              </span>
            }
            @if (surveyData.showProgressBar) {
              <span class="settingTag">
                <i class="fa fa-tasks"></i>
                نوار پیشرفت
              </span>
            }
            @if (surveyData.randomizeQuestions) {
              <span class="settingTag">
                <i class="fa fa-random"></i>
                نمایش تصادفی
              </span>
            }
            @if (surveyData.allowMultipleResponses) {
              <span class="settingTag">
                <i class="fa fa-repeat"></i>
                پاسخ چندباره
              </span>
            }
            @if (surveyData.maxResponses) {
              <span class="settingTag">
                <i class="fa fa-users"></i>
                حداکثر {{ surveyData.maxResponses }} پاسخ
              </span>
            }
          </div>
        </div>
      </div>

      <div class="sp-16"></div>

      <!-- Questions — گروه‌بندی‌شده بر اساس معیار (اگر معیار محور باشد) -->
      @for (group of reviewGroups(); track group.key) {
        <div class="questionsSection">
          <div class="questionsSection__header">
            <h3>{{ group.title }}</h3>
            <span class="badge ok">{{ group.questions.length }} سوال</span>
          </div>

          <div class="tableWrap">
            <table class="qTable">
              <thead>
                <tr>
                  <th class="col-num">#</th>
                  <th class="col-question">سوال</th>
                  <th class="col-answers">گزینه‌ها / پاسخ</th>
                  <th class="col-required">الزامی</th>
                </tr>
              </thead>
              <tbody>
                @for (question of group.questions; track question.tempId; let qi = $index) {
                  <tr>
                    <td class="col-num">
                      <span class="numBadge">{{ qi + 1 }}</span>
                    </td>

                    <td class="col-question">
                      <div class="qText">{{ question.questionText }}</div>

                      @if (question.helpText) {
                        <div class="qHelp">
                          <i class="fa fa-info-circle"></i>
                          {{ question.helpText }}
                        </div>
                      }

                      @if (question.imageGuid && questionImageUrls().has(question.tempId)) {
                        <div class="qImage">
                          <img [src]="questionImageUrls().get(question.tempId)" [alt]="question.questionText">
                        </div>
                      }

                      @if (question.validationType && question.validationType > 0) {
                        <div class="qValidation">
                          <i class="fa fa-shield-alt"></i>
                          {{ getValidationTypeName(question.validationType) }}
                        </div>
                      }
                    </td>

                    <td class="col-answers">
                      @if (question.options && question.options.length > 0) {
                        <div class="optionsChips">
                          @for (opt of question.options; track opt.tempId) {
                            <span class="optionChip">
                              @if (opt.color) {
                                <span class="optionChip__dot" [style.background]="opt.color"></span>
                              }
                              @if (opt.imageGuid && optionImageUrls().has(opt.tempId)) {
                                <img class="optionChip__img" [src]="optionImageUrls().get(opt.tempId)" [alt]="opt.optionText">
                              }
                              <span>{{ opt.optionText }}</span>
                            </span>
                          }
                        </div>
                      } @else if (question.questionType === 5) {
                        <div class="scalePreview">
                          @if (question.minScaleLabel) {
                            <span class="scaleLabel">{{ question.minScaleLabel }}</span>
                          }
                          <div class="scalePreview__dots">
                            @for (n of [1,2,3,4,5]; track n) {
                              <span class="scaleDot">{{ n }}</span>
                            }
                          </div>
                          @if (question.maxScaleLabel) {
                            <span class="scaleLabel">{{ question.maxScaleLabel }}</span>
                          }
                        </div>
                      } @else if (question.questionType === 11 && question.matrixRows && question.matrixColumns) {
                        <div class="matrixPreview">
                          <i class="fa fa-table"></i>
                          <span>ماتریسی</span>
                        </div>
                      } @else {
                        <span class="freeTextHint">
                          <i class="fa fa-pen"></i>
                          پاسخ متنی آزاد
                        </span>
                      }
                    </td>

                    <td class="col-required">
                      @if (question.isRequired) {
                        <span class="requiredBadge">
                          <i class="fa fa-asterisk"></i>
                          الزامی
                        </span>
                      } @else {
                        <span class="optionalBadge">اختیاری</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <div class="sp-16"></div>
      }

      <!-- Final Confirmation Card -->
      <div class="confirmationCard">
        <div class="confirmationCard__icon">
          <i class="fa fa-check-circle"></i>
        </div>
        <div class="confirmationCard__content">
          <h3>آماده ثبت نهایی هستید؟</h3>
          <p>با کلیک روی دکمه «ثبت نظرسنجی»، تمام اطلاعات شامل:</p>
          <ul>
            <li>اطلاعات نظرسنجی و تنظیمات</li>
            <li>{{ questions.length }} سوال</li>
            @if (hasCriteria) {
              <li>{{ visibleCriteria().length }} معیار</li>
            }
            @if (surveyData.logoGuid || surveyData.backgroundImageGuid) {
              <li>فایل‌های آپلود شده ({{ uploadedFilesCount() }} فایل)</li>
            }
          </ul>
          <p class="confirmationCard__note">در یک تراکنش واحد ذخیره خواهند شد.</p>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .reviewContainer {
      max-width: 1300px;
      margin: 0 auto;
    }

    .sp-16 { height: 16px; }

    /* ==================== Summary Card ==================== */
    .summaryCard {
      padding: 22px 24px;
      background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(249,250,251,0.95));
      border: 2px solid var(--line);
      border-radius: 18px;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
    }

    .summaryCard__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 2px solid var(--line);
      gap: 16px;
    }

    .summaryCard__header h2 {
      margin: 0 0 6px 0;
      font-weight: 950;
      font-size: 1.35rem;
      color: var(--ink);
      line-height: 1.3;
    }

    .summaryCard__header p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
      font-size: 0.9rem;
    }

    .badge.blue {
      background: rgba(29,78,216,0.1);
      color: var(--primary);
      border: 1px solid rgba(29,78,216,0.25);
      padding: 5px 13px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 800;
      white-space: nowrap;
    }

    .badge.ok {
      background: rgba(34,197,94,0.1);
      color: var(--ok);
      border: 1px solid rgba(34,197,94,0.25);
      padding: 5px 13px;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 800;
    }

    .summaryCard__meta {
      margin-bottom: 14px;
    }

    .metaRow {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
    }

    .metaItem {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: white;
      border: 1px solid var(--line);
      border-radius: 12px;
    }

    .metaItem i {
      font-size: 1.1rem;
      color: var(--primary);
    }

    .metaLabel {
      display: block;
      font-size: 0.72rem;
      color: var(--muted);
      margin-bottom: 2px;
    }

    .metaValue {
      display: block;
      font-weight: 900;
      font-size: 0.88rem;
      color: var(--ink);
    }

    .brandRow {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 14px;
    }

    .brandChip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 13px;
      background: white;
      border: 1px solid var(--line);
      border-radius: 12px;
    }

    .brandChip__label {
      font-size: 0.75rem;
      font-weight: 800;
      color: var(--muted);
    }

    .brandChip__color {
      padding: 4px 12px;
      border-radius: 6px;
      color: white;
      font-weight: 800;
      font-size: 0.75rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }

    .brandChip--media {
      padding: 5px 11px;
    }

    .brandChip__img {
      height: 30px;
      max-width: 84px;
      object-fit: contain;
      border-radius: 6px;
    }

    .settingsList {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .settingTag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: rgba(100, 116, 139, 0.1);
      border: 1px solid rgba(100, 116, 139, 0.2);
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 800;
      color: var(--muted);
    }

    .settingTag.ok {
      background: rgba(34, 197, 94, 0.1);
      border-color: rgba(34, 197, 94, 0.3);
      color: var(--ok);
    }

    /* ==================== Questions Section ==================== */
    .questionsSection__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .questionsSection__header h3 {
      margin: 0;
      font-weight: 950;
      font-size: 1.1rem;
      color: var(--ink);
    }

    .tableWrap {
      background: white;
      border: 2px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
    }

    .qTable {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
    }

    .qTable thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: linear-gradient(135deg, rgba(249,250,251,0.98), rgba(243,244,246,0.98));
      backdrop-filter: blur(6px);
      padding: 12px 16px;
      font-size: 0.8rem;
      font-weight: 900;
      color: var(--muted);
      text-align: right;
      border-bottom: 2px solid var(--line);
      white-space: nowrap;
    }

    .qTable thead th.col-num { text-align: center; width: 50px; }
    .qTable thead th.col-answers { width: 34%; }
    .qTable thead th.col-required { text-align: center; width: 100px; }

    .qTable tbody tr:nth-child(even) { background: rgba(249, 250, 251, 0.55); }
    .qTable tbody tr:hover { background: rgba(29, 78, 216, 0.045); }
    .qTable tbody tr:not(:last-child) td { border-bottom: 1px solid var(--line); }
    .qTable tbody td { padding: 12px 16px; vertical-align: top; }

    .col-num { text-align: center; vertical-align: middle !important; }

    .numBadge {
      display: inline-flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 8px;
      background: linear-gradient(135deg, var(--primary), #3b82f6);
      color: white; font-weight: 900; font-size: 0.75rem;
    }

    .qText { font-weight: 800; font-size: 0.88rem; color: var(--ink); line-height: 1.55; }

    .qHelp {
      display: flex; align-items: flex-start; gap: 6px; margin-top: 6px;
      font-size: 0.72rem; color: #1e40af; background: rgba(59, 130, 246, 0.07);
      border: 1px solid rgba(59, 130, 246, 0.18); border-radius: 8px; padding: 5px 9px; line-height: 1.4;
    }

    .qImage { margin-top: 8px; max-width: 200px; border-radius: 8px; overflow: hidden; border: 1px solid var(--line); }
    .qImage img { width: 100%; max-height: 80px; object-fit: cover; display: block; }

    .qValidation {
      display: inline-flex; align-items: center; gap: 5px; margin-top: 6px;
      padding: 3px 9px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.25);
      border-radius: 999px; font-size: 0.66rem; font-weight: 800; color: var(--ok);
    }

    .optionsChips { display: flex; flex-wrap: wrap; gap: 6px; }
    .optionChip {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
      background: rgba(249, 250, 251, 0.9); border: 1px solid var(--line); border-radius: 999px;
      font-size: 0.73rem; font-weight: 700; color: var(--ink);
    }
    .optionChip__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 1px rgba(0,0,0,0.05); }
    .optionChip__img { width: 16px; height: 16px; border-radius: 4px; object-fit: cover; flex-shrink: 0; }

    .freeTextHint { display: inline-flex; align-items: center; gap: 6px; font-size: 0.76rem; color: var(--muted); font-weight: 700; }
    .freeTextHint i { color: var(--primary); opacity: 0.6; }

    .scalePreview { display: flex; align-items: center; gap: 6px; }
    .scaleLabel { font-weight: 800; font-size: 0.64rem; color: var(--muted); white-space: nowrap; }
    .scalePreview__dots { display: flex; gap: 4px; }
    .scaleDot {
      width: 20px; height: 20px; background: white; border: 1.5px solid var(--primary); border-radius: 50%;
      display: flex; align-items: center; justify-content: center; font-weight: 900; color: var(--primary); font-size: 0.6rem;
    }

    .matrixPreview {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
      background: rgba(249, 250, 251, 0.9); border: 1px solid var(--line); border-radius: 999px;
      font-weight: 800; font-size: 0.73rem; color: var(--primary);
    }

    .col-required { text-align: center; vertical-align: middle !important; }

    .requiredBadge {
      display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;
      background: rgba(255, 77, 109, 0.1); border: 1px solid rgba(255, 77, 109, 0.25);
      border-radius: 999px; font-size: 0.68rem; font-weight: 900; color: var(--accent); white-space: nowrap;
    }
    .requiredBadge i { font-size: 0.58rem; }

    .optionalBadge {
      display: inline-flex; align-items: center; padding: 4px 10px;
      background: rgba(100, 116, 139, 0.08); border: 1px solid rgba(100, 116, 139, 0.2);
      border-radius: 999px; font-size: 0.68rem; font-weight: 800; color: var(--muted); white-space: nowrap;
    }

    /* ==================== Confirmation Card ==================== */
    .confirmationCard {
      display: flex;
      gap: 18px;
      padding: 22px 24px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(16, 185, 129, 0.08));
      border: 3px solid rgba(34, 197, 94, 0.3);
      border-radius: 18px;
      align-items: flex-start;
    }

    .confirmationCard__icon { font-size: 2.6rem; color: var(--ok); line-height: 1; }
    .confirmationCard__content { flex: 1; }
    .confirmationCard__content h3 { margin: 0 0 8px 0; font-weight: 950; font-size: 1.1rem; color: var(--ink); }
    .confirmationCard__content p { margin: 0 0 8px 0; color: var(--muted); line-height: 1.6; font-size: 0.9rem; }
    .confirmationCard__content ul { margin: 10px 0; padding-right: 20px; color: var(--ink); font-weight: 800; font-size: 0.88rem; line-height: 1.9; }
    .confirmationCard__note {
      margin-top: 10px; padding: 9px 13px; background: white; border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 10px; font-size: 0.82rem; font-weight: 800; color: var(--ok);
    }

    @media (max-width: 900px) {
      .tableWrap { overflow-x: auto; }
      .qTable { min-width: 680px; }
    }

    @media (max-width: 640px) {
      .summaryCard { padding: 16px 14px; }
      .confirmationCard { flex-direction: column; padding: 18px 16px; }
    }
  `]
})
export class SurveyWizardStep4ReviewComponent implements OnInit {
  @Input() surveyData!: WizardSurveyData;
  @Input() questions!: WizardQuestionData[];
  @Input() criteria: WizardCriterionData[] = [];
  @Input() hasCriteria = false;

  private readonly tusUploadService = inject(TusUploadService);

  readonly logoUrl = signal<string | null>(null);
  readonly backgroundUrl = signal<string | null>(null);
  readonly questionImageUrls = signal<Map<string, string>>(new Map());
  readonly optionImageUrls = signal<Map<string, string>>(new Map());

  readonly visibleCriteria = computed(() =>
    (this.criteria ?? []).filter(c => !c.isRemoved).sort((a, b) => a.sortOrder - b.sortOrder)
  );

  readonly reviewGroups = computed<ReviewGroup[]>(() => {
    const qs = (this.questions ?? []).filter(q => !q.isRemoved);

    if (!this.hasCriteria || this.visibleCriteria().length === 0) {
      return [{ key: '__all__', title: 'سوالات نظرسنجی', questions: qs }];
    }

    const groups: ReviewGroup[] = this.visibleCriteria().map(c => ({
      key: c.guid,
      title: c.title,
      questions: qs.filter(q => q.criterionGuid === c.guid),
    }));

    const unassigned = qs.filter(q => !q.criterionGuid);
    if (unassigned.length > 0) {
      groups.push({ key: UNASSIGNED_KEY, title: 'بدون معیار', questions: unassigned });
    }

    return groups.filter(g => g.questions.length > 0);
  });

  readonly uploadedFilesCount = computed(() => {
    let count = 0;
    if (this.surveyData.logoGuid) count++;
    if (this.surveyData.backgroundImageGuid) count++;

    this.questions.forEach(q => {
      if (q.imageGuid) count++;
      if (q.videoGuid) count++;
      q.options?.forEach(opt => {
        if (opt.imageGuid) count++;
      });
    });

    return count;
  });

  async ngOnInit() {
    await this.loadAllPreviews();
  }

  private async loadAllPreviews() {
    if (this.surveyData.logoGuid) {
      const url = await this.tusUploadService.getFilePreviewUrl(this.surveyData.logoGuid);
      if (url) this.logoUrl.set(url);
    }

    if (this.surveyData.backgroundImageGuid) {
      const url = await this.tusUploadService.getFilePreviewUrl(this.surveyData.backgroundImageGuid);
      if (url) this.backgroundUrl.set(url);
    }

    const questionGuids = this.questions
      .filter(q => q.imageGuid)
      .map(q => ({ tempId: q.tempId, guid: q.imageGuid! }));

    if (questionGuids.length > 0) {
      const urls = await this.tusUploadService.getFilePreviewUrls(questionGuids.map(q => q.guid));
      const map = new Map<string, string>();
      questionGuids.forEach(q => {
        const url = urls.get(q.guid);
        if (url) map.set(q.tempId, url);
      });
      this.questionImageUrls.set(map);
    }

    const optionGuids: { tempId: string, guid: string }[] = [];
    this.questions.forEach(q => {
      q.options?.forEach(opt => {
        if (opt.imageGuid) {
          optionGuids.push({ tempId: opt.tempId, guid: opt.imageGuid });
        }
      });
    });

    if (optionGuids.length > 0) {
      const urls = await this.tusUploadService.getFilePreviewUrls(optionGuids.map(o => o.guid));
      const map = new Map<string, string>();
      optionGuids.forEach(o => {
        const url = urls.get(o.guid);
        if (url) map.set(o.tempId, url);
      });
      this.optionImageUrls.set(map);
    }
  }

  getValidationTypeName(type: number): string {
    const types: Record<number, string> = {
      0: 'بدون اعتبارسنجی',
      1: 'ایمیل',
      2: 'شماره تلفن',
      3: 'URL',
      4: 'Regex سفارشی',
    };
    return types[type] || 'نامشخص';
  }
}