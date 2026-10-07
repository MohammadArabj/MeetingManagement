import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  WizardQuestionData,
  WizardCriterionData,
  createEmptyCriterion,
} from '../../../../core/models/survey-wizard.model';
import { SwalService } from '../../../../services/framework-services/swal.service';
import { ToastService } from '../../../../services/framework-services/toast.service';
import { QuestionModalComponent, QuestionModalSaveEvent } from './question-modal.component';
import { ExcelImportResult, parseExcelFile, generateExcelTemplate } from '../../../../core/models/excel-import.util';

const UNASSIGNED_KEY = '__none__';

@Component({
  selector: 'app-survey-wizard-step2',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    QuestionModalComponent
  ],
  template: `
    <div class="step2Container">

      <!-- ============ نوار هدر ثابت (کاملاً مات) ============ -->
      <div class="stickyHeader">
        <div class="stickyHeader__row">
          <div class="stickyHeader__titleBlock">
            <h3>سوالات نظرسنجی</h3>
            @if (visibleQuestions().length > 0) {
              <div class="stickyHeader__stats">
                <span class="statChip"><i class="fa fa-question-circle"></i>{{ visibleQuestions().length }} سوال</span>
                <span class="statChip"><i class="fa fa-check-circle"></i>{{ requiredQuestionsCount() }} الزامی</span>
                @if (hasCriteria) {
                  <span class="statChip primary"><i class="fa fa-layer-group"></i>{{ visibleCriteria().length }} معیار</span>
                }
              </div>
            }
          </div>

          <div class="stickyHeader__actions">
            <!-- <button type="button" class="iconBtn" (click)="downloadTemplate()" title="دانلود فایل نمونه اکسل">
              <i class="fa fa-download"></i>
            </button>
            <button type="button" class="iconBtn" (click)="triggerFileInput()" [disabled]="isImporting()" title="ایمپورت از اکسل">
              @if (isImporting()) { <i class="fa fa-spinner fa-spin"></i> } @else { <i class="fa fa-file-excel"></i> }
            </button> -->

            <button type="button" class="btn primary addQuestionBtn" (click)="openAddQuestionModal()">
              <i class="fa fa-plus"></i>
              افزودن سوال
            </button>
          </div>
        </div>

        <!-- نوار معیارها — فقط وقتی معیار محور است -->
        @if (hasCriteria) {
          <div class="criteriaRow">
            <div class="criteriaRow__chips">
              @if (visibleCriteria().length === 0) {
                <span class="criteriaRow__empty">هنوز معیاری اضافه نشده</span>
              }
              @for (c of visibleCriteria(); track c.guid) {
                <div class="criterionChip">
                  <span class="criterionChip__title">{{ c.title }}</span>
                  <span class="criterionChip__count">{{ questionsForCriterion(c.guid).length }}</span>
                  <button type="button" class="criterionChip__btn" (click)="editCriterion(c)" title="ویرایش">
                    <i class="fa fa-pen"></i>
                  </button>
                  <button type="button" class="criterionChip__btn danger" (click)="removeCriterion(c)" title="حذف">
                    <i class="fa fa-trash"></i>
                  </button>
                </div>
              }
            </div>

            <div class="criteriaRow__add">
              <input type="text" class="criteriaRow__input" placeholder="عنوان معیار جدید..."
                [(ngModel)]="newCriterionTitle" (keyup.enter)="addCriterionInline()">
              <button type="button" class="btn sm primary" (click)="addCriterionInline()" [disabled]="!newCriterionTitle.trim()">
                <i class="fa fa-plus"></i> ثبت معیار
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Import Result -->
      @if (importResult()) {
        <div class="sp-12"></div>
        <div class="importResult" [class.success]="importResult()!.success" [class.error]="!importResult()!.success">
          <div class="importResult__header">
            <i class="fa" [class.fa-check-circle]="importResult()!.success" [class.fa-exclamation-circle]="!importResult()!.success"></i>
            <span>
              @if (importResult()!.success) {
                {{ importResult()!.questions.length }} سوال با موفقیت ایمپورت شد
              } @else {
                خطا در ایمپورت فایل
              }
            </span>
            <button type="button" class="closeImportResult" (click)="importResult.set(null)"><i class="fa fa-times"></i></button>
          </div>
          @if (importResult()!.errors.length > 0) {
            <div class="importResult__errors">
              <strong>خطاها:</strong>
              @for (err of importResult()!.errors; track err) {
                <div class="importResult__item error"><i class="fa fa-times-circle"></i>{{ err }}</div>
              }
            </div>
          }
          @if (importResult()!.warnings.length > 0) {
            <div class="importResult__warnings">
              <strong>هشدارها:</strong>
              @for (warn of importResult()!.warnings; track warn) {
                <div class="importResult__item warn"><i class="fa fa-exclamation-triangle"></i>{{ warn }}</div>
              }
            </div>
          }
        </div>
      }

      <div class="sp-16"></div>

      <!-- ============ حالت معیار محور ============ -->
      @if (hasCriteria) {

        @if (visibleCriteria().length === 0) {
          <div class="emptyState">
            <div class="emptyState__icon"><i class="fa fa-layer-group"></i></div>
            <h3>هنوز معیاری تعریف نشده!</h3>
            <p>از کادر بالا عنوان معیار را وارد کرده و Enter بزنید</p>
          </div>
        } @else {

          @for (criterion of visibleCriteria(); track criterion.guid) {
            <div class="criterionBlock">
              <div class="criterionBlock__header" (click)="toggleCollapse(criterion.guid)">
                <div class="criterionBlock__headerLeft">
                  <i class="fa" [class.fa-chevron-down]="!isCollapsed(criterion.guid)" [class.fa-chevron-left]="isCollapsed(criterion.guid)"></i>
                  <span class="criterionBlock__title">{{ criterion.title }}</span>
                  <span class="countBadgeSm">{{ questionsForCriterion(criterion.guid).length }} سوال</span>
                </div>
                <button type="button" class="btn sm primary" (click)="openAddQuestionModal(criterion.guid); $event.stopPropagation()">
                  <i class="fa fa-plus"></i> افزودن سوال
                </button>
              </div>

              @if (!isCollapsed(criterion.guid)) {
                <div class="criterionBlock__body">
                  @if (questionsForCriterion(criterion.guid).length === 0) {
                    <div class="noQuestionsHint">
                      <i class="fa fa-info-circle"></i>
                      هنوز سوالی به این معیار اضافه نشده است
                    </div>
                  } @else {
                    <div class="questionsList" cdkDropList (cdkDropListDropped)="onDrop($event, criterion.guid)">
                      @for (question of questionsForCriterion(criterion.guid); track question.tempId) {
                        <ng-container *ngTemplateOutlet="questionCardTpl; context: { $implicit: question, index: $index }"></ng-container>
                      }
                    </div>
                  }
                </div>
              }
            </div>
            <div class="sp-12"></div>
          }

          <div class="criterionBlock unassigned">
            <div class="criterionBlock__header" (click)="toggleCollapse(unassignedKey)">
              <div class="criterionBlock__headerLeft">
                <i class="fa" [class.fa-chevron-down]="!isCollapsed(unassignedKey)" [class.fa-chevron-left]="isCollapsed(unassignedKey)"></i>
                <span class="criterionBlock__title">بدون معیار</span>
                <span class="countBadgeSm">{{ unassignedQuestions().length }} سوال</span>
              </div>
              <button type="button" class="btn sm primary" (click)="openAddQuestionModal(undefined); $event.stopPropagation()">
                <i class="fa fa-plus"></i> افزودن سوال
              </button>
            </div>

            @if (!isCollapsed(unassignedKey)) {
              <div class="criterionBlock__body">
                @if (unassignedQuestions().length === 0) {
                  <div class="noQuestionsHint">
                    <i class="fa fa-info-circle"></i>
                    سوالی بدون معیار وجود ندارد
                  </div>
                } @else {
                  <div class="questionsList" cdkDropList (cdkDropListDropped)="onDrop($event, undefined)">
                    @for (question of unassignedQuestions(); track question.tempId) {
                      <ng-container *ngTemplateOutlet="questionCardTpl; context: { $implicit: question, index: $index }"></ng-container>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

      } @else {

        @if (visibleQuestions().length === 0) {
          <div class="emptyState">
            <div class="emptyState__icon"><i class="fa fa-clipboard-question"></i></div>
            <h3>هنوز سوالی اضافه نشده!</h3>
            <p>برای شروع، روی دکمه "افزودن سوال" کلیک کنید یا از فایل اکسل ایمپورت کنید</p>
            <div class="emptyState__actions">
              <button type="button" class="btn primary lg" (click)="openAddQuestionModal()">
                <i class="fa fa-plus"></i> اولین سوال را اضافه کنید
              </button>
              <button type="button" class="btn outlined lg" (click)="triggerFileInput()">
                <i class="fa fa-file-excel"></i> ایمپورت از اکسل
              </button>
            </div>
          </div>
        } @else {
          <div class="questionsList" cdkDropList (cdkDropListDropped)="onDrop($event, undefined)">
            @for (question of visibleQuestions(); track question.tempId) {
              <ng-container *ngTemplateOutlet="questionCardTpl; context: { $implicit: question, index: $index }"></ng-container>
            }
          </div>

          <div class="sp-12"></div>
          <div class="addMoreCard" (click)="openAddQuestionModal()">
            <i class="fa fa-plus-circle"></i>
            <span>افزودن سوال جدید</span>
          </div>
        }
      }

      <!-- ============ Template مشترک کارت سوال ============ -->
      <ng-template #questionCardTpl let-question let-index="index">
        <div class="questionCard" [id]="'question-card-' + question.tempId" cdkDrag>
          <div class="questionCard__drag" cdkDragHandle><i class="fa fa-grip-vertical"></i></div>
          <div class="questionCard__number">{{ index + 1 }}</div>

          <div class="questionCard__content">
            <div class="questionCard__header">
              <div class="questionCard__type">
                <i [class]="'fa fa-' + getQuestionIcon(question.questionType)"></i>
                <span>{{ getQuestionTypeName(question.questionType) }}</span>
              </div>
              @if (question.isRequired) {
                <span class="requiredBadge"><i class="fa fa-asterisk"></i> الزامی</span>
              }

              @if (hasCriteria) {
                <select class="criterionSelect" [ngModel]="question.criterionGuid ?? ''"
                  (ngModelChange)="onQuestionCriterionChange(question, $event)"
                  (click)="$event.stopPropagation()">
                  <option value="">بدون معیار</option>
                  @for (c of visibleCriteria(); track c.guid) {
                    <option [value]="c.guid">{{ c.title }}</option>
                  }
                </select>
              }
            </div>

            <div class="questionCard__text">{{ question.questionText }}</div>

            @if (question.helpText) {
              <div class="questionCard__help"><i class="fa fa-info-circle"></i>{{ question.helpText }}</div>
            }

            @if (question.options && question.options.length > 0) {
              <div class="optionsPreview">
                @for (opt of question.options.slice(0, 3); track opt.tempId) {
                  <span class="optionTag">{{ opt.optionText }}</span>
                }
                @if (question.options.length > 3) {
                  <span class="optionTag more">+{{ question.options.length - 3 }} مورد دیگر</span>
                }
              </div>
            }

            @if (question.imageGuid) {
              <div class="mediaBadge"><i class="fa fa-image"></i> تصویر</div>
            }
            @if (question.videoGuid) {
              <div class="mediaBadge"><i class="fa fa-video"></i> ویدیو</div>
            }
          </div>

          <div class="questionCard__actions">
            <button type="button" class="btn sm" (click)="editQuestion(question)" title="ویرایش"><i class="fa fa-edit"></i></button>
            <button type="button" class="btn sm" (click)="duplicateQuestion(question)" title="کپی"><i class="fa fa-copy"></i></button>
            <button type="button" class="btn sm danger" (click)="deleteQuestion(question.tempId)" title="حذف"><i class="fa fa-trash"></i></button>
          </div>

          <div class="dragPreview" *cdkDragPreview>
            <div class="dragPreview__number">{{ index + 1 }}</div>
            <div class="dragPreview__text">{{ question.questionText }}</div>
          </div>
        </div>
      </ng-template>

      <!-- Question Modal -->
      @if (showModal()) {
        <app-question-modal
          [question]="editingQuestion()"
          [hasCriteria]="hasCriteria"
          [criteria]="visibleCriteria()"
          [initialCriterionGuid]="pendingCriterionGuid"
          (save)="onQuestionSave($event)"
          (cancel)="closeModal()"
          (fileUploaded)="onFileUploaded($event)">
        </app-question-modal>
      }

      <input #excelFileInput type="file" accept=".xlsx,.xls,.csv" (change)="onExcelFileSelected($event)" hidden>

      @if (visibleQuestions().length > 2) {
        <div class="scrollFab">
          <button type="button" class="scrollFab__btn" (click)="scrollToFirstQuestion()" title="برو به اولین سوال"><i class="fa fa-arrow-up"></i></button>
          <div class="scrollFab__count">{{ visibleQuestions().length }}</div>
          <button type="button" class="scrollFab__btn" (click)="scrollToLastQuestion()" title="برو به آخرین سوال"><i class="fa fa-arrow-down"></i></button>
        </div>
      }
    </div>
  `,
  styles: [`
    .step2Container { max-width: 1000px; margin: 0 auto; }
    .sp-12 { height: 12px; }
    .sp-16 { height: 16px; }

    /* ==================== نوار هدر ثابت (کاملاً مات) ==================== */
    .stickyHeader {
      position: sticky;
      top: var(--wizard-topbar-h, 78px);
      z-index: 60;
      background-color: #ffffff;
      border: 1px solid var(--line);
      border-radius: 0 0 18px 18px;
      padding: 14px 18px 12px;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
      margin: 0 -1px;
    }

    .stickyHeader__row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .stickyHeader__titleBlock h3 {
      margin: 0;
      font-weight: 950;
      font-size: 1.1rem;
      color: var(--ink);
    }

    .stickyHeader__stats {
      display: flex;
      gap: 8px;
      margin-top: 6px;
      flex-wrap: wrap;
    }

    .statChip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.76rem;
      font-weight: 800;
      color: var(--muted);
      background: rgba(100,116,139,0.08);
      padding: 4px 10px;
      border-radius: 999px;
    }

    .statChip.primary {
      color: var(--primary);
      background: rgba(29,78,216,0.08);
    }

    .stickyHeader__actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .iconBtn {
      width: 36px;
      height: 36px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: white;
      color: var(--muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .iconBtn:hover:not(:disabled) {
      border-color: var(--primary);
      color: var(--primary);
      background: rgba(29,78,216,0.05);
    }

    .iconBtn:disabled { opacity: 0.5; cursor: not-allowed; }

    .addQuestionBtn {
      padding: 9px 20px;
      font-weight: 800;
      font-size: 0.86rem;
      border-radius: 12px;
      box-shadow: 0 4px 14px rgba(29,78,216,0.28);
    }

    /* نوار معیارها داخل هدر ثابت */
    .criteriaRow {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed var(--line);
    }

    .criteriaRow__chips {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      flex: 1;
      min-width: 180px;
    }

    .criteriaRow__empty {
      font-size: 0.8rem;
      color: var(--muted);
      font-weight: 700;
    }

    .criteriaRow__add {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .criteriaRow__input {
      width: 200px;
      padding: 7px 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      font-size: 0.82rem;
      font-family: inherit;
      outline: none;
      color: var(--ink);
      background: #f8fafc;
      transition: all 0.15s;
    }

    .criteriaRow__input:focus {
      border-color: var(--primary);
      background: white;
      box-shadow: 0 0 0 3px rgba(29,78,216,0.1);
    }

    .btn.sm { padding: 7px 14px; font-size: 0.8rem; }

    .criterionChip {
      display: flex; align-items: center; gap: 7px;
      padding: 6px 10px; background: #f0f5ff; border: 1px solid rgba(29,78,216,0.18);
      border-radius: 999px;
    }
    .criterionChip__title { font-weight: 800; font-size: 0.82rem; color: var(--ink); white-space: nowrap; }
    .criterionChip__count {
      font-size: 0.66rem; font-weight: 900; color: var(--primary);
      background: rgba(29,78,216,0.12); padding: 1px 7px; border-radius: 999px;
    }
    .criterionChip__btn {
      width: 20px; height: 20px; border: none; border-radius: 50%;
      background: rgba(100,116,139,0.12); color: var(--muted); cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-size: 0.6rem;
    }
    .criterionChip__btn:hover { background: rgba(29,78,216,0.18); color: var(--primary); }
    .criterionChip__btn.danger:hover { background: rgba(239,68,68,0.15); color: #ef4444; }

    /* Import Result */
    .importResult { padding: 14px 16px; border-radius: 14px; border: 1px solid; }
    .importResult.success { background: #f0fdf4; border-color: #bbf7d0; }
    .importResult.error { background: #fef2f2; border-color: #fecaca; }
    .importResult__header { display: flex; align-items: center; gap: 10px; font-weight: 900; font-size: 0.95rem; }
    .importResult.success .importResult__header { color: #16a34a; }
    .importResult.error .importResult__header { color: #ef4444; }
    .closeImportResult { margin-right: auto; background: none; border: none; cursor: pointer; color: var(--muted); font-size: 1rem; padding: 4px; }
    .importResult__errors, .importResult__warnings { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.06); }
    .importResult__errors strong { color: #ef4444; font-size: 0.85rem; }
    .importResult__warnings strong { color: #d97706; font-size: 0.85rem; }
    .importResult__item { display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; font-size: 0.83rem; }
    .importResult__item.error { color: #ef4444; }
    .importResult__item.warn { color: #d97706; }

    /* Criterion Blocks */
    .criterionBlock {
      background: white; border: 1px solid var(--line); border-radius: 16px; overflow: hidden;
      box-shadow: 0 1px 4px rgba(15,23,42,0.03);
    }
    .criterionBlock.unassigned { border-style: dashed; }
    .criterionBlock__header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 18px; cursor: pointer; background: #fafbfc;
      transition: background 0.15s;
    }
    .criterionBlock__header:hover { background: #f3f6fb; }
    .criterionBlock__headerLeft { display: flex; align-items: center; gap: 10px; color: var(--muted); }
    .criterionBlock__title { font-weight: 900; font-size: 0.98rem; color: var(--ink); }
    .countBadgeSm {
      font-size: 0.7rem; font-weight: 800; color: var(--primary);
      background: rgba(29,78,216,0.1); padding: 2px 10px; border-radius: 999px;
    }
    .criterionBlock__body { padding: 16px 18px; }
    .noQuestionsHint {
      display: flex; align-items: center; gap: 8px; padding: 14px;
      color: var(--muted); font-weight: 700; font-size: 0.85rem;
      background: #f8fafc; border-radius: 10px;
    }

    .criterionSelect {
      margin-right: auto; font-size: 0.76rem; font-weight: 700; padding: 5px 9px;
      border: 1px solid var(--line); border-radius: 9px; background: white;
      color: var(--ink); cursor: pointer; font-family: inherit;
    }

    /* Empty State */
    .emptyState { text-align: center; padding: 48px 32px; background: white; border: 2px dashed var(--line); border-radius: 20px; }
    .emptyState__icon { font-size: 3rem; color: var(--muted); margin-bottom: 14px; opacity: 0.5; }
    .emptyState h3 { margin: 0 0 8px 0; font-weight: 950; font-size: 1.1rem; }
    .emptyState p { margin: 0 0 18px 0; color: var(--muted); font-size: 0.9rem; }
    .emptyState__actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

    /* Questions List */
    .questionsList { display: grid; gap: 12px; }
    .questionCard {
      display: flex; gap: 14px; background: white; border: 1px solid var(--line);
      border-radius: 16px; padding: 18px; transition: all 0.2s ease; position: relative;
    }
    .questionCard:hover { border-color: var(--primary); box-shadow: 0 4px 16px rgba(29,78,216,0.09); }
    .questionCard--highlight {
      border-color: #22c55e !important;
      box-shadow: 0 0 0 4px rgba(34,197,94,0.15), 0 8px 24px rgba(34,197,94,0.2) !important;
      animation: highlightPulse 1.8s ease-out;
    }
    @keyframes highlightPulse { 0% { background: #f0fdf4; } 100% { background: white; } }
    .questionCard.cdk-drag-preview { box-shadow: 0 8px 32px rgba(15,23,42,0.2); border-color: var(--primary); opacity: 0.95; }
    .questionCard.cdk-drag-animating { transition: transform 300ms cubic-bezier(0,0,0.2,1); }
    .questionsList.cdk-drop-list-dragging .questionCard:not(.cdk-drag-placeholder) { transition: transform 300ms cubic-bezier(0,0,0.2,1); }
    .cdk-drag-placeholder { opacity: 0.3; border-style: dashed; }

    .questionCard__drag { display: flex; align-items: center; color: var(--muted); cursor: grab; font-size: 1.1rem; padding: 4px; }
    .questionCard__drag:active { cursor: grabbing; }
    .questionCard__drag:hover { color: var(--primary); }

    .questionCard__number {
      width: 34px; height: 34px; background: linear-gradient(135deg, var(--primary), #3b82f6);
      color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center;
      font-weight: 950; font-size: 1rem; flex-shrink: 0; box-shadow: 0 2px 8px rgba(29,78,216,0.3);
    }

    .questionCard__content { flex: 1; min-width: 0; }
    .questionCard__header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
    .questionCard__type {
      display: flex; align-items: center; gap: 6px; padding: 5px 12px;
      background: rgba(100,116,139,0.1); border-radius: 999px; font-size: 0.76rem;
      font-weight: 800; color: var(--muted);
    }
    .requiredBadge {
      display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px;
      background: rgba(239,68,68,0.1); border-radius: 999px; font-size: 0.72rem;
      font-weight: 900; color: #ef4444;
    }
    .questionCard__text { font-size: 0.96rem; font-weight: 800; line-height: 1.5; color: var(--ink); margin-bottom: 10px; }
    .questionCard__help {
      display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px;
      background: rgba(59,130,246,0.07); border: 1px solid rgba(59,130,246,0.16);
      border-radius: 10px; color: #1e40af; font-size: 0.79rem; line-height: 1.5; margin-bottom: 10px;
    }
    .optionsPreview { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .optionTag { padding: 4px 10px; background: #f8fafc; border: 1px solid var(--line); border-radius: 8px; font-size: 0.78rem; font-weight: 700; color: var(--ink); }
    .optionTag.more { background: rgba(100,116,139,0.1); color: var(--muted); }
    .mediaBadge {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
      background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25);
      border-radius: 8px; font-size: 0.74rem; font-weight: 800; color: #16a34a; margin-top: 6px; margin-left: 6px;
    }
    .questionCard__actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
    .questionCard__actions .btn { width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; }

    .dragPreview {
      display: flex; align-items: center; gap: 12px; padding: 16px; background: white;
      border: 2px solid var(--primary); border-radius: 14px; box-shadow: 0 8px 32px rgba(29,78,216,0.3); max-width: 380px;
    }
    .dragPreview__number { width: 30px; height: 30px; background: var(--primary); color: white; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-weight: 900; flex-shrink: 0; }
    .dragPreview__text { font-weight: 800; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .addMoreCard {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 20px; background: #fafbfc; border: 2px dashed var(--line); border-radius: 16px;
      cursor: pointer; transition: all 0.2s; color: var(--primary); font-weight: 800; font-size: 0.9rem;
    }
    .addMoreCard:hover { background: rgba(29,78,216,0.05); border-color: var(--primary); }
    .addMoreCard i { font-size: 1.2rem; }

    .scrollFab { position: fixed; left: 20px; bottom: 96px; display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 220; }
    .scrollFab__btn {
      width: 42px; height: 42px; border-radius: 50%; border: none;
      background: linear-gradient(135deg, var(--primary), #3b82f6); color: white;
      display: flex; align-items: center; justify-content: center; font-size: 0.95rem;
      cursor: pointer; box-shadow: 0 6px 18px rgba(29,78,216,0.35); transition: all 0.2s ease;
    }
    .scrollFab__btn:hover { transform: translateY(-2px) scale(1.05); }
    .scrollFab__count { width: 26px; height: 26px; border-radius: 50%; background: white; border: 1px solid var(--line); color: var(--ink); display: flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 900; }

    @media (max-width: 768px) {
      .stickyHeader__row { flex-direction: column; align-items: stretch; }
      .stickyHeader__actions { justify-content: stretch; }
      .addQuestionBtn { flex: 1; justify-content: center; }
      .criteriaRow { flex-direction: column; align-items: stretch; }
      .criteriaRow__input { width: 100%; }
      .criteriaRow__add { width: 100%; }
      .criteriaRow__add .btn { flex: 1; }
      .scrollFab { left: 10px; bottom: 96px; }
    }
  `]
})
export class SurveyWizardStep2Component implements OnInit {
  @Input() questions = signal<WizardQuestionData[]>([]);
  @Input() criteria = signal<WizardCriterionData[]>([]);
  @Input() hasCriteria = false;

  @Output() questionsChange = new EventEmitter<WizardQuestionData[]>();
  @Output() criteriaChange = new EventEmitter<WizardCriterionData[]>();
  @Output() fileUploaded = new EventEmitter<{
    type: 'questionImage' | 'questionVideo' | 'optionImage',
    guid: string,
    relatedId: string
  }>();

  @ViewChild('excelFileInput') excelFileInput?: ElementRef<HTMLInputElement>;

  private readonly swalService = inject(SwalService);
  private readonly toastService = inject(ToastService);

  readonly unassignedKey = UNASSIGNED_KEY;

  readonly showModal = signal(false);
  readonly editingQuestion = signal<WizardQuestionData | null>(null);
  pendingCriterionGuid: string | undefined = undefined;

  readonly isImporting = signal(false);
  readonly importResult = signal<ExcelImportResult | null>(null);

  readonly collapsedGroups = signal<Set<string>>(new Set());

  newCriterionTitle = '';

  readonly visibleQuestions = computed(() => this.questions().filter(q => !q.isRemoved));
  readonly requiredQuestionsCount = computed(() => this.visibleQuestions().filter(q => q.isRequired).length);

  readonly visibleCriteria = computed(() =>
    this.criteria().filter(c => !c.isRemoved).sort((a, b) => a.sortOrder - b.sortOrder)
  );

  readonly groupedQuestions = computed(() => {
    const map = new Map<string, WizardQuestionData[]>();
    for (const q of this.visibleQuestions()) {
      const key = q.criterionGuid ?? UNASSIGNED_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    return map;
  });

  readonly unassignedQuestions = computed(() => this.groupedQuestions().get(UNASSIGNED_KEY) ?? []);

  ngOnInit() { }

  questionsForCriterion(guid: string): WizardQuestionData[] {
    return this.groupedQuestions().get(guid) ?? [];
  }

  isCollapsed(key: string): boolean {
    return this.collapsedGroups().has(key);
  }

  toggleCollapse(key: string): void {
    const updated = new Set(this.collapsedGroups());
    if (updated.has(key)) updated.delete(key);
    else updated.add(key);
    this.collapsedGroups.set(updated);
  }

  // ==================== ✅ افزودن سریع معیار (inline) ====================

  addCriterionInline(): void {
    const title = this.newCriterionTitle.trim();
    if (!title) return;

    const newCriterion = createEmptyCriterion(this.criteria().length + 1);
    newCriterion.title = title;

    const updated = [...this.criteria(), newCriterion];
    this.criteria.set(updated);
    this.criteriaChange.emit(updated);
    this.newCriterionTitle = '';
  }

  async editCriterion(criterion: WizardCriterionData): Promise<void> {
    const result = await this.swalService.fire({
      title: 'ویرایش معیار',
      input: 'text',
      inputValue: criterion.title,
      showCancelButton: true,
      confirmButtonText: 'ذخیره',
      cancelButtonText: 'انصراف',
      confirmButtonColor: '#1d4ed8',
      inputValidator: (value: string) => !value?.trim() ? 'عنوان معیار الزامی است' : null,
    });

    if (!result.isConfirmed || !result.value) return;

    const updated = this.criteria().map(c =>
      c.guid === criterion.guid ? { ...c, title: result.value.trim() } : c
    );
    this.criteria.set(updated);
    this.criteriaChange.emit(updated);
  }

  async removeCriterion(criterion: WizardCriterionData): Promise<void> {
    const questionCount = this.questionsForCriterion(criterion.guid).length;

    const result = await this.swalService.fire({
      icon: 'warning',
      title: 'حذف معیار؟',
      html: questionCount > 0
        ? `<p>${questionCount} سوال به این معیار تعلق دارند و پس از حذف، به گروه «بدون معیار» منتقل می‌شوند.</p>`
        : '<p>این معیار حذف خواهد شد.</p>',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'انصراف',
      confirmButtonColor: '#ef4444',
    });

    if (!result.isConfirmed) return;

    if (questionCount > 0) {
      const updatedQuestions = this.questions().map(q =>
        q.criterionGuid === criterion.guid ? { ...q, criterionGuid: undefined } : q
      );
      this.questions.set(updatedQuestions);
      this.questionsChange.emit(updatedQuestions);
    }

    const updatedCriteria = this.criteria().map(c =>
      c.guid === criterion.guid ? { ...c, isRemoved: true } : c
    );
    this.criteria.set(updatedCriteria);
    this.criteriaChange.emit(updatedCriteria);
  }

  onQuestionCriterionChange(question: WizardQuestionData, newGuid: string): void {
    const updated = this.questions().map(q =>
      q.tempId === question.tempId ? { ...q, criterionGuid: newGuid || undefined } : q
    );
    this.questions.set(updated);
    this.questionsChange.emit(updated);
  }

  // ==================== Excel Import ====================

  triggerFileInput(): void {
    this.excelFileInput?.nativeElement.click();
  }

  async onExcelFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isImporting.set(true);
    this.importResult.set(null);

    try {
      const result = await parseExcelFile(file);
      this.importResult.set(result);

      if (result.success && result.questions.length > 0) {
        if (this.questions().length > 0) {
          const swalResult = await this.swalService.fire({
            icon: 'question',
            title: `${result.questions.length} سوال یافت شد`,
            html: `<div style="text-align:center;font-family:Sahel,Vazir,sans-serif">
              <p style="margin:12px 0;color:#64748b">شما ${this.questions().length} سوال موجود دارید. آیا سوالات جدید جایگزین شوند یا اضافه شوند؟</p>
            </div>`,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '<i class="fa fa-plus"></i> افزودن به انتها',
            denyButtonText: '<i class="fa fa-exchange-alt"></i> جایگزینی',
            cancelButtonText: 'انصراف',
            confirmButtonColor: '#1d4ed8',
            denyButtonColor: '#f59e0b',
          });

          if (swalResult.isConfirmed) {
            const startOrder = this.questions().length;
            const newQuestions = result.questions.map((q, i) => ({ ...q, sortOrder: startOrder + i + 1 }));
            const updated = [...this.questions(), ...newQuestions];
            this.questions.set(updated);
            this.questionsChange.emit(updated);
            this.toastService.success(`${newQuestions.length} سوال اضافه شد`);
          } else if (swalResult.isDenied) {
            this.questions.set(result.questions);
            this.questionsChange.emit(result.questions);
            this.toastService.success(`${result.questions.length} سوال جایگزین شد`);
          }
        } else {
          this.questions.set(result.questions);
          this.questionsChange.emit(result.questions);
          this.toastService.success(`${result.questions.length} سوال ایمپورت شد`);
        }
      }
    } catch (err) {
      this.importResult.set({
        success: false,
        questions: [],
        errors: [`خطای غیرمنتظره: ${(err as Error).message}`],
        warnings: [],
      });
    } finally {
      this.isImporting.set(false);
      input.value = '';
    }
  }

  downloadTemplate(): void {
    const blob = generateExcelTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'survey-questions-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    this.toastService.success('فایل نمونه دانلود شد');
  }

  // ==================== Modal ====================

  openAddQuestionModal(criterionGuid?: string): void {
    this.editingQuestion.set(null);
    this.pendingCriterionGuid = criterionGuid;
    this.showModal.set(true);
  }

  editQuestion(question: WizardQuestionData): void {
    this.editingQuestion.set(question);
    this.pendingCriterionGuid = question.criterionGuid;
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingQuestion.set(null);
    this.pendingCriterionGuid = undefined;
  }

  onQuestionSave(event: QuestionModalSaveEvent): void {
    const { question, criterionGuid } = event;
    const currentQuestions = [...this.questions()];
    const isNewQuestion = !this.editingQuestion();

    const questionWithCriterion: WizardQuestionData = { ...question, criterionGuid };

    if (this.editingQuestion()) {
      const index = currentQuestions.findIndex(q => q.tempId === questionWithCriterion.tempId);
      if (index !== -1) currentQuestions[index] = questionWithCriterion;
    } else {
      const sortOrder = currentQuestions.length + 1;
      currentQuestions.push({ ...questionWithCriterion, sortOrder });
    }

    this.questions.set(currentQuestions);
    this.questionsChange.emit(currentQuestions);
    this.closeModal();

    this.scrollToQuestion(questionWithCriterion.tempId, isNewQuestion);
  }

  private scrollToQuestion(tempId: string, isNew: boolean = false): void {
    setTimeout(() => {
      const element = document.getElementById(`question-card-${tempId}`);
      if (!element) return;
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('questionCard--highlight');
      setTimeout(() => element.classList.remove('questionCard--highlight'), 1800);
    }, 150);
  }

  scrollToFirstQuestion(): void {
    const list = this.visibleQuestions();
    if (list.length === 0) return;
    this.scrollToQuestion(list[0].tempId, false);
  }

  scrollToLastQuestion(): void {
    const list = this.visibleQuestions();
    if (list.length === 0) return;
    this.scrollToQuestion(list[list.length - 1].tempId, false);
  }

  // ==================== Delete ====================

  async deleteQuestion(tempId: string): Promise<void> {
    const result = await this.swalService.fire({
      icon: 'warning',
      title: 'حذف سوال؟',
      text: 'در صورت وجود پاسخ برای این سوال، آن پاسخ‌ها هم پس از ثبت نهایی حذف خواهند شد.',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'انصراف',
      confirmButtonColor: '#ef4444'
    });

    if (!result.isConfirmed) return;

    const target = this.questions().find(q => q.tempId === tempId);
    if (!target) return;

    let updated: WizardQuestionData[];
    if (target.guid) {
      updated = this.questions().map(q => q.tempId === tempId ? { ...q, isRemoved: true } : q);
    } else {
      updated = this.questions().filter(q => q.tempId !== tempId);
    }

    let order = 1;
    updated = updated.map(q => q.isRemoved ? q : { ...q, sortOrder: order++ });

    this.questions.set(updated);
    this.questionsChange.emit(updated);
  }

  // ==================== Duplicate ====================

  duplicateQuestion(question: WizardQuestionData): void {
    const duplicate: WizardQuestionData = {
      ...question,
      tempId: this.generateTempId(),
      guid: undefined,                          // ✅ سوال جدیده، نباید guid قبلی رو داشته باشه
      questionText: `${question.questionText} (کپی)`,
      sortOrder: this.questions().length + 1,
      imageGuid: undefined,
      videoGuid: undefined,
      options: question.options?.map(opt => ({
        ...opt,
        tempId: this.generateTempId(),
        guid: undefined,                        // ✅ گزینه‌های جدیدن، guid قبلی رو نداشته باشن
        imageGuid: undefined,
      })),
    };

    const updated = [...this.questions(), duplicate];
    this.questions.set(updated);
    this.questionsChange.emit(updated);
  }

  // ==================== Drag & Drop ====================

  onDrop(event: CdkDragDrop<WizardQuestionData[]>, criterionGuid: string | undefined): void {
    const groupKey = criterionGuid ?? UNASSIGNED_KEY;
    const groupItems = [...(this.groupedQuestions().get(groupKey) ?? [])];
    moveItemInArray(groupItems, event.previousIndex, event.currentIndex);

    const all = [...this.questions()];
    const byTempId = new Map(all.map(q => [q.tempId, q]));

    let order = 1;
    const orderedTempIds: string[] = [];

    for (const c of this.visibleCriteria()) {
      const items = c.guid === groupKey ? groupItems : (this.groupedQuestions().get(c.guid) ?? []);
      for (const q of items) orderedTempIds.push(q.tempId);
    }
    const unassignedItems = groupKey === UNASSIGNED_KEY ? groupItems : this.unassignedQuestions();
    for (const q of unassignedItems) orderedTempIds.push(q.tempId);

    for (const q of all) {
      if (q.isRemoved && !orderedTempIds.includes(q.tempId)) orderedTempIds.push(q.tempId);
    }

    const reordered = orderedTempIds
      .map(id => byTempId.get(id)!)
      .map(q => q.isRemoved ? q : { ...q, sortOrder: order++ });

    this.questions.set(reordered);
    this.questionsChange.emit(reordered);
  }

  // ==================== File Upload ====================

  onFileUploaded(event: { type: string, guid: string, relatedId: string }): void {
    this.fileUploaded.emit(event as any);
  }

  // ==================== Helpers ====================

  private generateTempId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getQuestionTypeName(type: number): string {
    const types: Record<number, string> = {
      3: 'متن کوتاه', 4: 'متن بلند', 1: 'چند گزینه‌ای (تک)', 2: 'چند گزینه‌ای (چند)',
      10: 'لیست کشویی', 5: 'امتیازدهی', 8: 'تاریخ', 9: 'آپلود فایل', 11: 'ماتریس'
    };
    return types[type] || 'نامشخص';
  }

  getQuestionIcon(type: number): string {
    const icons: Record<number, string> = {
      3: 'text-width', 4: 'align-left', 1: 'circle-dot', 2: 'check-square',
      10: 'caret-square-down', 5: 'star', 8: 'calendar', 9: 'upload', 11: 'table'
    };
    return icons[type] || 'question';
  }
}