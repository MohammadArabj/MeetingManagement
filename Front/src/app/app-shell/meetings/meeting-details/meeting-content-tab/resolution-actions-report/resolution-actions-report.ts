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

import { environment } from '../../../../../../environments/environment';
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
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      this.toastService.error('امکان باز کردن پنجره چاپ وجود ندارد');
      return;
    }

    const printContent = this.generatePrintContent();
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
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
              <div class="content">${resolution.resolutionText}</div>
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
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${this.reportTitle()}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .resolution-card { page-break-inside: avoid; }
          }
          
          * { box-sizing: border-box; margin: 0; padding: 0; }
          
          body {
            font-family: 'B Yekan', 'Iranian Sans', Tahoma, Arial, sans-serif;
            direction: rtl;
            line-height: 1.6;
            color: #333;
            background: white;
            padding: 20px;
          }
          
          .print-header {
            text-align: center;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 20px;
            margin-bottom: 25px;
          }
          
          .logo {
            width: 80px;
            height: 60px;
            margin: 0 auto 10px;
          }
          
          .logo img { width: 100%; }
          
          .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 8px;
          }
          
          .report-title {
            font-size: 16px;
            font-weight: 600;
            color: #4f46e5;
            margin: 10px 0;
          }
          
          .meeting-info {
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
            margin-top: 15px;
            padding: 10px;
            background: #f3f4f6;
            border-radius: 8px;
          }
          
          .meeting-info-item {
            display: flex;
            gap: 5px;
          }
          
          .meeting-info-item .label {
            font-weight: 600;
            color: #6b7280;
          }
          
          .meeting-info-item .value {
            color: #1f2937;
          }
          
          .summary-section {
            background: linear-gradient(135deg, #f8faff 0%, #e7eeff 100%);
            border: 1px solid #c7d2fe;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 25px;
          }
          
          .summary-title {
            font-size: 14px;
            font-weight: 600;
            color: #4338ca;
            margin-bottom: 10px;
            text-align: center;
          }
          
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 10px;
          }
          
          .summary-item {
            text-align: center;
            padding: 8px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
          }
          
          .summary-item .label {
            display: block;
            font-size: 11px;
            color: #6b7280;
          }
          
          .summary-item .value {
            display: block;
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
          }
          
          .summary-item.completed { border-color: #10b981; background: #ecfdf5; }
          .summary-item.completed .value { color: #059669; }
          
          .summary-item.progress { border-color: #f59e0b; background: #fffbeb; }
          .summary-item.progress .value { color: #d97706; }
          
          .summary-item.pending { border-color: #6b7280; background: #f9fafb; }
          .summary-item.pending .value { color: #4b5563; }
          
          .resolution-card {
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            margin-bottom: 20px;
            overflow: hidden;
          }
          
          .resolution-header {
            background: linear-gradient(135deg, #4f46e5, #6366f1);
            color: white;
            padding: 12px 15px;
            display: flex;
            align-items: center;
            gap: 15px;
          }
          
          .resolution-number {
            background: rgba(255,255,255,0.2);
            padding: 5px 12px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 13px;
          }
          
          .resolution-title {
            font-size: 14px;
            font-weight: 600;
          }
          
          .resolution-text, .resolution-decisions {
            padding: 12px 15px;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .section-title {
            font-weight: 600;
            color: #4338ca;
            margin-bottom: 8px;
            font-size: 13px;
          }
          
          .content {
            color: #374151;
            font-size: 12px;
            line-height: 1.8;
            text-align: justify;
          }
          
          .assignments-section {
            padding: 15px;
          }
          
          .assignment-card {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 12px;
            overflow: hidden;
          }
          
          .assignment-header {
            background: #f3f4f6;
            padding: 10px 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .assignment-info {
            display: flex;
            gap: 5px;
            align-items: center;
            flex-wrap: wrap;
            font-size: 11px;
          }
          
          .assignment-info .label {
            color: #6b7280;
          }
          
          .assignment-info .value {
            color: #1f2937;
            font-weight: 500;
          }
          
          .assignment-info .separator {
            color: #d1d5db;
            margin: 0 5px;
          }
          
          .assignment-status {
            display: flex;
            gap: 5px;
          }
          
          .badge {
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
          }
          
          .status-pending { background: #6b7280; color: white; }
          .status-progress { background: #f59e0b; color: white; }
          .status-completed { background: #10b981; color: white; }
          .result-done { background: #059669; color: white; }
          .result-notdone { background: #dc2626; color: white; }
          
          .actions-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          
          .actions-table th {
            background: #e5e7eb;
            padding: 8px;
            text-align: center;
            font-weight: 600;
            color: #374151;
            border: 1px solid #d1d5db;
          }
          
          .actions-table td {
            padding: 8px;
            text-align: center;
            border: 1px solid #e5e7eb;
            vertical-align: middle;
          }
          
          .actions-table tbody tr:nth-child(even) {
            background: #f9fafb;
          }
          
          .action-row td:nth-child(3) {
            text-align: right;
          }
          
          .no-data, .no-assignments {
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-style: italic;
          }
          
          .print-footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            text-align: left;
            font-size: 10px;
            color: #9ca3af;
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div class="logo">
            <img src="${environment.selfEndpoint}/img/MainLogo.png" alt="لوگو" />
          </div>
          <div class="company-name">شرکت پتروشیمی اصفهان</div>
          <div class="report-title">${this.reportTitle()}</div>
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
        
        <div class="print-footer">
          تاریخ چاپ: ${new Date().toLocaleDateString('fa-IR')}
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 100);
          };
        </script>
      </body>
      </html>
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
