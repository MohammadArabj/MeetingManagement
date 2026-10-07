import {
  Component,
  inject,
  signal,
  computed,
  input,
  output,
  effect,
  DestroyRef
} from '@angular/core';

import { AssignmentService } from '../../../../../services/assignment.service';
import { ToastService } from '../../../../../services/framework-services/toast.service';
import { ResolutionService } from '../../../../../services/resolution.service';
import { ReportMode } from '../../../../../core/types/configuration';

// Enums
export enum ActionStatus {
  Pending = 1,
  InProgress = 2,
  End = 3
}

export enum AssignmentResult {
  Done = 1,
  NotDone = 2
}

// Interfaces
export interface ActionReportItem {
  actionId: number;
  actionDate: string;
  actionText: string;
  actionStatus: ActionStatus;
  result?: AssignmentResult;
  createdBy: string;
  createdAt: string;
  attachmentsCount: number;
}

export interface AssignmentReportItem {
  assignmentId: number;
  actorName: string;
  actorPosition: string;
  followerName: string;
  type: string;
  dueDate: string;
  actionStatus: ActionStatus;
  result?: AssignmentResult;
  lastActionDate?: string;
  actions: ActionReportItem[];
  totalActions: number;
}

export interface ResolutionReportItem {
  resolutionId: number;
  resolutionNumber: string;
  resolutionTitle: string;
  resolutionText: string;
  decisionsMade?: string;
  documentation?: string;
  assignments: AssignmentReportItem[];
  totalAssignments: number;
}

export interface MeetingActionsReportDto {
  meetingGuid: string;
  meetingNumber: string;
  meetingTitle: string;
  meetingDate: string;
  meetingCategory: string;
  isBoardMeeting: boolean;
  resolutions: ResolutionReportItem[];
  summary: {
    totalResolutions: number;
    totalAssignments: number;
    totalActions: number;
    completedAssignments: number;
    inProgressAssignments: number;
    pendingAssignments: number;
  };
}


import { PrintService } from '../../../../../core/print/print.service';
import { toRichHtml } from '../../../../../core/rich-text/rich-text';
@Component({
  selector: 'app-resolution-actions-report',
  standalone: true,
  imports: [],
  templateUrl: './resolution-actions-report.html',
  styleUrls: ['./resolution-actions-report.css']
})
export class ResolutionActionsReportComponent {
  // Injected services
  private readonly resolutionService = inject(ResolutionService);
  private readonly assignmentService = inject(AssignmentService);
  private readonly printService = inject(PrintService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // Enums for template
  public ActionStatus = ActionStatus;
  public AssignmentResult = AssignmentResult;

  // Inputs
  readonly meetingGuid = input.required<string>();
  readonly meetingInfo = input.required<{
    number: string;
    title: string;
    date: string;
    category?: string;
    isBoardMeeting: boolean;
  }>();
  readonly resolutionId = input<number | null>(null);
  readonly assignmentId = input<number | null>(null);
  readonly mode = input<ReportMode>('all-resolutions');

  // Outputs
  readonly closed = output<void>();

  // Signals
  private readonly _reportData = signal<MeetingActionsReportDto | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _expandedResolutions = signal<Set<number>>(new Set());
  private readonly _expandedAssignments = signal<Set<number>>(new Set());

  // Public readonly signals
  readonly reportData = this._reportData.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed signals
  readonly filteredResolutions = computed(() => {
    const data = this._reportData();
    if (!data) return [];

    const resId = this.resolutionId();
    const assignId = this.assignmentId();
    const currentMode = this.mode();

    if (currentMode === 'single-resolution' && resId) {
      return data.resolutions.filter(r => r.resolutionId === resId);
    }

    if (currentMode === 'single-assignment' && assignId) {
      return data.resolutions
        .map(r => ({
          ...r,
          assignments: r.assignments.filter(a => a.assignmentId === assignId)
        }))
        .filter(r => r.assignments.length > 0);
    }

    return data.resolutions;
  });

  readonly reportTitle = computed(() => {
    const currentMode = this.mode();
    const info = this.meetingInfo();

    switch (currentMode) {
      case 'single-resolution':
        return `گزارش اقدامات مصوبه - جلسه ${info.number}`;
      case 'single-assignment':
        return `گزارش اقدامات تخصیص - جلسه ${info.number}`;
      default:
        return `گزارش کلی اقدامات مصوبات - جلسه ${info.number}`;
    }
  });

  readonly hasData = computed(() => {
    return this.filteredResolutions().length > 0;
  });

  constructor() {
    // Effect to load data when inputs change
    effect(() => {
      const guid = this.meetingGuid();
      if (guid) {
        this.loadReportData();
      }
    });
  }

  closeModal(): void {
    this.closed.emit();
  }
  // ========== Data Loading ==========

  async loadReportData(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const meetingGuid = this.meetingGuid();
      const info = this.meetingInfo();

      // دریافت گزارش اقدامات از سرویس
      const result = await this.resolutionService.getActionsReport(meetingGuid).toPromise();

      if (result) {
        const reportData: MeetingActionsReportDto = {
          meetingGuid: meetingGuid,
          meetingNumber: info.number,
          meetingTitle: info.title,
          meetingDate: info.date,
          meetingCategory: info.category || '',
          isBoardMeeting: info.isBoardMeeting,
          resolutions: result.resolutions || [],
          summary: result.summary || {
            totalResolutions: 0,
            totalAssignments: 0,
            totalActions: 0,
            completedAssignments: 0,
            inProgressAssignments: 0,
            pendingAssignments: 0
          }
        };

        this._reportData.set(reportData);

        // Expand all by default for single mode
        if (this.mode() !== 'all-resolutions') {
          this.expandAll();
        }
      }
    } catch (error) {
      console.error('Error loading actions report:', error);
      this._error.set('خطا در بارگذاری گزارش اقدامات');
      this.toastService.error('خطا در بارگذاری گزارش');
    } finally {
      this._loading.set(false);
    }
  }

  // ========== Expand/Collapse ==========

  isResolutionExpanded(resolutionId: number): boolean {
    return this._expandedResolutions().has(resolutionId);
  }

  isAssignmentExpanded(assignmentId: number): boolean {
    return this._expandedAssignments().has(assignmentId);
  }

  toggleResolution(resolutionId: number): void {
    this._expandedResolutions.update(set => {
      const newSet = new Set(set);
      if (newSet.has(resolutionId)) {
        newSet.delete(resolutionId);
      } else {
        newSet.add(resolutionId);
      }
      return newSet;
    });
  }

  toggleAssignment(assignmentId: number): void {
    this._expandedAssignments.update(set => {
      const newSet = new Set(set);
      if (newSet.has(assignmentId)) {
        newSet.delete(assignmentId);
      } else {
        newSet.add(assignmentId);
      }
      return newSet;
    });
  }

  expandAll(): void {
    const resolutions = this.filteredResolutions();
    const resIds = new Set(resolutions.map(r => r.resolutionId));
    const assignIds = new Set(
      resolutions.flatMap(r => r.assignments.map(a => a.assignmentId))
    );

    this._expandedResolutions.set(resIds);
    this._expandedAssignments.set(assignIds);
  }

  collapseAll(): void {
    this._expandedResolutions.set(new Set());
    this._expandedAssignments.set(new Set());
  }

  // ========== Status Methods ==========

  getActionStatusText(status?: ActionStatus): string {
    if (!status) return '-';
    const statusMap: Record<ActionStatus, string> = {
      [ActionStatus.Pending]: 'در انتظار اقدام',
      [ActionStatus.InProgress]: 'در حال انجام',
      [ActionStatus.End]: 'پایان یافته'
    };
    return statusMap[status] || '-';
  }

  getActionStatusClass(status?: ActionStatus): string {
    if (!status) return 'status-unknown';
    const classMap: Record<ActionStatus, string> = {
      [ActionStatus.Pending]: 'status-pending',
      [ActionStatus.InProgress]: 'status-progress',
      [ActionStatus.End]: 'status-completed'
    };
    return classMap[status] || 'status-unknown';
  }

  getResultText(result?: AssignmentResult): string {
    if (!result) return '-';
    const resultMap: Record<AssignmentResult, string> = {
      [AssignmentResult.Done]: 'انجام شده',
      [AssignmentResult.NotDone]: 'انجام نشده'
    };
    return resultMap[result] || '-';
  }

  getResultClass(result?: AssignmentResult): string {
    if (!result) return '';
    return result === AssignmentResult.Done ? 'result-done' : 'result-notdone';
  }

  // ========== Print Methods ==========

  printReport(): void {
    void this.printService
      .printReport('actions-report', this.generatePrintContent(), { title: this.reportTitle() })
      .catch((e: any) => this.toastService.error(e?.message || 'خطا در آماده‌سازی چاپ'));
  }

  private generatePrintContent(): string {
    const data = this._reportData();
    const info = this.meetingInfo();
    const resolutions = this.filteredResolutions();

    let resolutionsHtml = '';

    resolutions.forEach((resolution, rIndex) => {
      let assignmentsHtml = '';

      resolution.assignments.forEach((assignment, aIndex) => {
        let actionsHtml = '';

        if (assignment.actions && assignment.actions.length > 0) {
          assignment.actions.forEach((action, actIndex) => {
            actionsHtml += `
              <tr class="action-row">
                <td>${actIndex + 1}</td>
                <td>${action.actionDate || '-'}</td>
                <td>${action.actionText || '-'}</td>
                <td><span class="badge ${this.getActionStatusClass(action.actionStatus)}">${this.getActionStatusText(action.actionStatus)}</span></td>
                <td>${action.actionStatus === ActionStatus.End ? this.getResultText(action.result) : '-'}</td>
                <td>${action.createdBy || '-'}</td>
              </tr>
            `;
          });
        } else {
          actionsHtml = `
            <tr>
              <td colspan="6" class="no-data">هیچ اقدامی ثبت نشده است</td>
            </tr>
          `;
        }

        assignmentsHtml += `
          <div class="assignment-card">
            <div class="assignment-header">
              <div class="assignment-info">
                <span class="label">اقدام کننده:</span>
                <span class="value">${assignment.actorName || '-'}</span>
                <span class="separator">|</span>
                <span class="label">پیگیری کننده:</span>
                <span class="value">${assignment.followerName || '-'}</span>
                <span class="separator">|</span>
                <span class="label">نوع:</span>
                <span class="value">${assignment.type || '-'}</span>
                <span class="separator">|</span>
                <span class="label">سررسید:</span>
                <span class="value">${assignment.dueDate || '-'}</span>
              </div>
              <div class="assignment-status">
                <span class="badge ${this.getActionStatusClass(assignment.actionStatus)}">${this.getActionStatusText(assignment.actionStatus)}</span>
                ${assignment.actionStatus === ActionStatus.End ? `<span class="badge ${this.getResultClass(assignment.result)}">${this.getResultText(assignment.result)}</span>` : ''}
              </div>
            </div>
            <table class="actions-table">
              <thead>
                <tr>
                  <th width="5%">ردیف</th>
                  <th width="12%">تاریخ</th>
                  <th width="40%">شرح اقدام</th>
                  <th width="15%">وضعیت</th>
                  <th width="13%">نتیجه</th>
                  <th width="15%">ثبت کننده</th>
                </tr>
              </thead>
              <tbody>
                ${actionsHtml}
              </tbody>
            </table>
          </div>
        `;
      });

      if (resolution.assignments.length === 0) {
        assignmentsHtml = `
          <div class="no-assignments">
            <i class="fas fa-info-circle"></i>
            هیچ تخصیصی برای این مصوبه تعریف نشده است
          </div>
        `;
      }

      resolutionsHtml += `
        <div class="resolution-card" ${rIndex < resolutions.length - 1 ? 'style="page-break-after: auto;"' : ''}>
          <div class="resolution-header">
            <div class="resolution-number">مصوبه ${resolution.resolutionNumber || (rIndex + 1)}</div>
            <div class="resolution-title">${resolution.resolutionTitle || '-'}</div>
          </div>
          ${resolution.resolutionText ? `
            <div class="resolution-text">
              <div class="section-title">متن مصوبه:</div>
              <div class="content">${toRichHtml(resolution.resolutionText)}</div>
            </div>
          ` : ''}
          ${resolution.decisionsMade ? `
            <div class="resolution-decisions">
              <div class="section-title">تصمیمات متخذه:</div>
              <div class="content">${resolution.decisionsMade}</div>
            </div>
          ` : ''}
          <div class="assignments-section">
            <div class="section-title">تخصیص‌ها و اقدامات:</div>
            ${assignmentsHtml}
          </div>
        </div>
      `;
    });

    // Summary section
    const summary = data?.summary;
    const summaryHtml = summary ? `
      <div class="summary-section">
        <div class="summary-title">خلاصه گزارش</div>
        <div class="summary-grid">
          <div class="summary-item">
            <span class="label">تعداد مصوبات:</span>
            <span class="value">${summary.totalResolutions}</span>
          </div>
          <div class="summary-item">
            <span class="label">تعداد تخصیص‌ها:</span>
            <span class="value">${summary.totalAssignments}</span>
          </div>
          <div class="summary-item">
            <span class="label">تعداد اقدامات:</span>
            <span class="value">${summary.totalActions}</span>
          </div>
          <div class="summary-item completed">
            <span class="label">پایان یافته:</span>
            <span class="value">${summary.completedAssignments}</span>
          </div>
          <div class="summary-item progress">
            <span class="label">در حال انجام:</span>
            <span class="value">${summary.inProgressAssignments}</span>
          </div>
          <div class="summary-item pending">
            <span class="label">در انتظار:</span>
            <span class="value">${summary.pendingAssignments}</span>
          </div>
        </div>
      </div>
    ` : '';

    return `
        <div class="print-header">
          <div class="meeting-info">
            <div class="meeting-info-item">
              <span class="label">شماره جلسه:</span>
              <span class="value">${info.number}</span>
            </div>
            <div class="meeting-info-item">
              <span class="label">عنوان:</span>
              <span class="value">${info.title}</span>
            </div>
            <div class="meeting-info-item">
              <span class="label">تاریخ:</span>
              <span class="value">${info.date}</span>
            </div>
            ${info.category ? `
            <div class="meeting-info-item">
              <span class="label">دسته‌بندی:</span>
              <span class="value">${info.category}</span>
            </div>
            ` : ''}
          </div>
        </div>
        
        ${summaryHtml}
        
        ${resolutionsHtml || '<div class="no-data">هیچ مصوبه‌ای یافت نشد</div>'}
    `;
  }

  // ========== Modal Control ==========

  close(): void {
    this.closed.emit();
  }

  refresh(): void {
    this.loadReportData();
  }
}
