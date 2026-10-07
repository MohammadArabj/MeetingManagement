import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
  DestroyRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

// Services
import { ResolutionService } from '../../../../services/resolution.service';
import { ToastService } from '../../../../services/framework-services/toast.service';
import { MeetingBehaviorService } from '../meeting-behavior-service';
import { TusUploadService } from '../../../../services/framework-services/tus-upload.service';

// Environment
import { environment } from '../../../../../environments/environment';

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
export interface ActionItem {
  actionId: number;
  actionDate: string;
  actionText: string;
  actionStatus: ActionStatus;
  result?: AssignmentResult;
  createdBy: string;
  createdAt: string;
  attachmentsCount: number;
}

export interface AssignmentItem {
  assignmentId: number;
  actorName: string;
  actorPosition: string;
  followerName: string;
  type: string;
  dueDate: string;
  actionStatus: ActionStatus;
  result?: AssignmentResult;
  lastActionDate?: string;
  actions: ActionItem[];
  totalActions: number;
  isOverdue?: boolean;
}

export interface ResolutionItem {
  resolutionId: number;
  resolutionNumber: string;
  resolutionTitle: string;
  resolutionText: string;
  decisionsMade?: string;
  documentation?: string;
  assignments: AssignmentItem[];
  totalAssignments: number;
}

export interface FollowupReportData {
  meetingGuid: string;
  meetingNumber: string;
  meetingTitle: string;
  meetingDate: string;
  resolutions: ResolutionItem[];
  summary: {
    totalResolutions: number;
    totalAssignments: number;
    totalActions: number;
    completedAssignments: number;
    inProgressAssignments: number;
    pendingAssignments: number;
    overdueAssignments: number;
  };
}

// Filter Types
type StatusFilter = 'all' | 'completed' | 'inProgress' | 'pending' | 'overdue';

@Component({
  selector: 'app-meeting-followup-tab',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './meeting-followup-tab.html',
  styleUrls: ['./meeting-followup-tab.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingFollowupTabComponent implements OnInit {

  // ═══════════════════════════════════════════════════════════
  // Injected Services
  // ═══════════════════════════════════════════════════════════
  private readonly resolutionService = inject(ResolutionService);
  private readonly toastService = inject(ToastService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly tusUploadService = inject(TusUploadService);
  private readonly destroyRef = inject(DestroyRef);

  // Enums for template
  readonly ActionStatus = ActionStatus;
  readonly AssignmentResult = AssignmentResult;

  // ═══════════════════════════════════════════════════════════
  // Signals - Data
  // ═══════════════════════════════════════════════════════════
  private readonly _reportData = signal<FollowupReportData | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // ═══════════════════════════════════════════════════════════
  // Signals - Filters
  // ═══════════════════════════════════════════════════════════
  private readonly _statusFilter = signal<StatusFilter>('all');
  private readonly _actorFilter = signal<string>('all');
  private readonly _searchText = signal<string>('');

  // ═══════════════════════════════════════════════════════════
  // Signals - UI State
  // ═══════════════════════════════════════════════════════════
  private readonly _expandedResolutions = signal<Set<number>>(new Set());
  private readonly _expandedAssignments = signal<Set<number>>(new Set());

  // ═══════════════════════════════════════════════════════════
  // Public Readonly Signals
  // ═══════════════════════════════════════════════════════════
  readonly reportData = this._reportData.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly statusFilter = this._statusFilter.asReadonly();
  readonly actorFilter = this._actorFilter.asReadonly();
  readonly searchText = this._searchText.asReadonly();

  // ═══════════════════════════════════════════════════════════
  // Computed - Meeting Info
  // ═══════════════════════════════════════════════════════════
  readonly meeting = computed(() => this.meetingBehaviorService.meeting());
  readonly meetingGuid = computed(() => {
    const mt = this.meeting();
    return (mt as any)?.guid || (mt as any)?.meetingGuid || '';
  });

  // ═══════════════════════════════════════════════════════════
  // Computed - Unique Actors for Filter
  // ═══════════════════════════════════════════════════════════
  readonly uniqueActors = computed(() => {
    const data = this._reportData();
    if (!data) return [];

    const actorSet = new Set<string>();
    data.resolutions.forEach(r => {
      r.assignments.forEach(a => {
        if (a.actorName) actorSet.add(a.actorName);
      });
    });

    return Array.from(actorSet).sort();
  });

  // ═══════════════════════════════════════════════════════════
  // Computed - Filtered Resolutions
  // ═══════════════════════════════════════════════════════════
  readonly filteredResolutions = computed(() => {
    const data = this._reportData();
    if (!data) return [];

    const statusFilterValue = this._statusFilter();
    const actorFilterValue = this._actorFilter();
    const searchTextValue = this._searchText().toLowerCase().trim();

    let resolutions = data.resolutions;

    // Filter by status
    if (statusFilterValue !== 'all') {
      resolutions = resolutions.map(r => ({
        ...r,
        assignments: r.assignments.filter(a => {
          switch (statusFilterValue) {
            case 'completed':
              return a.actionStatus === ActionStatus.End;
            case 'inProgress':
              return a.actionStatus === ActionStatus.InProgress;
            case 'pending':
              return a.actionStatus === ActionStatus.Pending;
            case 'overdue':
              return a.isOverdue === true;
            default:
              return true;
          }
        })
      })).filter(r => r.assignments.length > 0);
    }

    // Filter by actor
    if (actorFilterValue !== 'all') {
      resolutions = resolutions.map(r => ({
        ...r,
        assignments: r.assignments.filter(a => a.actorName === actorFilterValue)
      })).filter(r => r.assignments.length > 0);
    }

    // Filter by search text
    if (searchTextValue) {
      resolutions = resolutions.filter(r => {
        // Search in resolution
        const resolutionMatch =
          r.resolutionTitle?.toLowerCase().includes(searchTextValue) ||
          r.resolutionText?.toLowerCase().includes(searchTextValue) ||
          r.decisionsMade?.toLowerCase().includes(searchTextValue);

        // Search in assignments
        const assignmentMatch = r.assignments.some(a =>
          a.actorName?.toLowerCase().includes(searchTextValue) ||
          a.followerName?.toLowerCase().includes(searchTextValue) ||
          a.actions.some(act => act.actionText?.toLowerCase().includes(searchTextValue))
        );

        return resolutionMatch || assignmentMatch;
      });
    }

    return resolutions;
  });

  // ═══════════════════════════════════════════════════════════
  // Computed - Statistics
  // ═══════════════════════════════════════════════════════════
  readonly statistics = computed(() => {
    const data = this._reportData();
    if (!data) {
      return {
        totalAssignments: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        overdue: 0,
        completionRate: 0
      };
    }

    const { summary } = data;
    const completionRate = summary.totalAssignments > 0
      ? Math.round((summary.completedAssignments / summary.totalAssignments) * 100)
      : 0;

    return {
      totalAssignments: summary.totalAssignments,
      completed: summary.completedAssignments,
      inProgress: summary.inProgressAssignments,
      pending: summary.pendingAssignments,
      overdue: summary.overdueAssignments || 0,
      completionRate
    };
  });

  readonly hasData = computed(() => this.filteredResolutions().length > 0);

  // ═══════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════
  constructor() {
    // Auto-load when meeting changes
    effect(() => {
      const guid = this.meetingGuid();
      if (guid) {
        this.loadReportData();
      }
    });
  }

  ngOnInit(): void {
    // Initial load handled by effect
  }

  // ═══════════════════════════════════════════════════════════
  // Data Loading
  // ═══════════════════════════════════════════════════════════

  async loadReportData(): Promise<void> {
    const meetingGuid = this.meetingGuid();
    if (!meetingGuid) return;

    this._loading.set(true);
    this._error.set(null);

    this.resolutionService.getActionsReport(meetingGuid)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error loading followup report:', error);
          this._error.set('خطا در بارگذاری گزارش پیگیری');
          return of(null);
        })
      )
      .subscribe(result => {
        if (result) {
          const meeting = this.meeting();

          // Calculate overdue for each assignment
          const today = new Date();
          const resolutions = (result.resolutions || []).map((r: ResolutionItem) => ({
            ...r,
            assignments: r.assignments.map(a => ({
              ...a,
              isOverdue: this.isOverdue(a.dueDate, a.actionStatus, today)
            }))
          }));

          // Count overdue
          const overdueCount = resolutions.reduce((sum: number, r: ResolutionItem) =>
            sum + r.assignments.filter(a => a.isOverdue).length, 0
          );

          const reportData: FollowupReportData = {
            meetingGuid: meetingGuid,
            meetingNumber: (meeting as any)?.number || '',
            meetingTitle: (meeting as any)?.title || '',
            meetingDate: (meeting as any)?.mtDate || (meeting as any)?.date || '',
            resolutions: resolutions,
            summary: {
              ...result.summary,
              overdueAssignments: overdueCount
            }
          };

          this._reportData.set(reportData);

          // Expand all by default
          this.expandAll();
        }

        this._loading.set(false);
      });
  }

  private isOverdue(dueDate: string, status: ActionStatus, today: Date): boolean {
    if (status === ActionStatus.End) return false;
    if (!dueDate) return false;

    try {
      // Parse Persian date or standard date
      const dueParts = dueDate.split('/');
      if (dueParts.length === 3) {
        // Assuming format: YYYY/MM/DD or 1403/12/15
        const year = parseInt(dueParts[0]);
        const month = parseInt(dueParts[1]);
        const day = parseInt(dueParts[2]);

        // Simple comparison (works for Persian calendar too as string comparison)
        const todayStr = today.toLocaleDateString('fa-IR').replace(/\//g, '');
        const enDate=this.toEnglishNumber(todayStr);
        const dueStr = `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;
        return dueStr < enDate;
      }
    } catch {
      return false;
    }

    return false;
  }

  toEnglishNumber(str:string):string{
    return str.replaceAll("۰", "0")
    .replaceAll("۱", "1")
    .replaceAll("۲", "2")
    .replaceAll("۳", "3")
    .replaceAll("۴", "4")
    .replaceAll("۵", "5")
    .replaceAll("۶", "6")
    .replaceAll("۷", "7")
    .replaceAll("۸", "8")
    .replaceAll("۹", "9");
  }

  refreshData(): void {
    this.loadReportData();
    this.toastService.success('گزارش به‌روزرسانی شد');
  }

  // ═══════════════════════════════════════════════════════════
  // Filter Methods
  // ═══════════════════════════════════════════════════════════

  onStatusFilterChange(value: string): void {
    this._statusFilter.set(value as StatusFilter);
  }

  onActorFilterChange(value: string): void {
    this._actorFilter.set(value);
  }

  onSearchChange(value: string): void {
    this._searchText.set(value);
  }

  clearFilters(): void {
    this._statusFilter.set('all');
    this._actorFilter.set('all');
    this._searchText.set('');
  }

  hasActiveFilters(): boolean {
    return this._statusFilter() !== 'all' ||
      this._actorFilter() !== 'all' ||
      this._searchText().trim() !== '';
  }

  // ═══════════════════════════════════════════════════════════
  // Expand/Collapse
  // ═══════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════
  // Status Methods
  // ═══════════════════════════════════════════════════════════

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

  getActionStatusIcon(status?: ActionStatus): string {
    if (!status) return 'fa-question-circle';
    const iconMap: Record<ActionStatus, string> = {
      [ActionStatus.Pending]: 'fa-clock',
      [ActionStatus.InProgress]: 'fa-spinner',
      [ActionStatus.End]: 'fa-check-circle'
    };
    return iconMap[status] || 'fa-question-circle';
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

  // ═══════════════════════════════════════════════════════════
  // Print & Export
  // ═══════════════════════════════════════════════════════════

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
    }, 500);
  }

  exportToExcel(): void {
    const data = this._reportData();
    if (!data) {
      this.toastService.warning('داده‌ای برای خروجی وجود ندارد');
      return;
    }

    // Build CSV content
    const rows: string[][] = [];

    // Header
    rows.push([
      'شماره مصوبه',
      'عنوان مصوبه',
      'اقدام کننده',
      'پیگیری کننده',
      'نوع',
      'سررسید',
      'وضعیت',
      'نتیجه',
      'تعداد اقدامات',
      'آخرین اقدام'
    ]);

    // Data rows
    this.filteredResolutions().forEach(resolution => {
      resolution.assignments.forEach(assignment => {
        rows.push([
          resolution.resolutionNumber || '',
          resolution.resolutionTitle || '',
          assignment.actorName || '',
          assignment.followerName || '',
          assignment.type || '',
          assignment.dueDate || '',
          this.getActionStatusText(assignment.actionStatus),
          this.getResultText(assignment.result),
          assignment.totalActions.toString(),
          assignment.lastActionDate || ''
        ]);
      });
    });

    // Convert to CSV
    const BOM = '\uFEFF';
    const csvContent = BOM + rows.map(row =>
      row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `پیگیری-مصوبات-جلسه-${data.meetingNumber}-${new Date().toLocaleDateString('fa-IR')}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.toastService.success('فایل Excel با موفقیت دانلود شد');
  }

  private generatePrintContent(): string {
    const data = this._reportData();
    if (!data) return '';

    const resolutions = this.filteredResolutions();
    const stats = this.statistics();

    let resolutionsHtml = '';

    resolutions.forEach((resolution, rIndex) => {
      let assignmentsHtml = '';

      resolution.assignments.forEach(assignment => {
        let actionsHtml = '';

        if (assignment.actions && assignment.actions.length > 0) {
          assignment.actions.forEach((action, actIndex) => {
            actionsHtml += `
              <tr class="action-row">
                <td>${actIndex + 1}</td>
                <td>${action.actionDate || '-'}</td>
                <td class="text-right">${action.actionText || '-'}</td>
                <td><span class="badge ${this.getActionStatusClass(action.actionStatus)}">${this.getActionStatusText(action.actionStatus)}</span></td>
                <td>${action.actionStatus === ActionStatus.End ? this.getResultText(action.result) : '-'}</td>
                <td>${action.createdBy || '-'}</td>
              </tr>
            `;
          });
        } else {
          actionsHtml = `<tr><td colspan="6" class="no-data">هیچ اقدامی ثبت نشده است</td></tr>`;
        }

        const overdueClass = assignment.isOverdue ? 'overdue' : '';

        assignmentsHtml += `
          <div class="assignment-card ${overdueClass}">
            <div class="assignment-header">
              <div class="assignment-info">
                <span><strong>اقدام کننده:</strong> ${assignment.actorName || '-'}</span>
                <span><strong>پیگیری:</strong> ${assignment.followerName || '-'}</span>
                <span><strong>نوع:</strong> ${assignment.type || '-'}</span>
                <span><strong>سررسید:</strong> ${assignment.dueDate || '-'}</span>
                ${assignment.isOverdue ? '<span class="overdue-badge">⚠️ دیرکرد</span>' : ''}
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
                  <th width="45%">شرح اقدام</th>
                  <th width="12%">وضعیت</th>
                  <th width="12%">نتیجه</th>
                  <th width="14%">ثبت کننده</th>
                </tr>
              </thead>
              <tbody>${actionsHtml}</tbody>
            </table>
          </div>
        `;
      });

      if (resolution.assignments.length === 0) {
        assignmentsHtml = `<div class="no-assignments">هیچ تخصیصی تعریف نشده است</div>`;
      }

      resolutionsHtml += `
        <div class="resolution-card">
          <div class="resolution-header">
            <span class="resolution-number">مصوبه ${resolution.resolutionNumber || (rIndex + 1)}</span>
            <span class="resolution-title">${resolution.resolutionTitle || ''}</span>
          </div>
          ${resolution.resolutionText ? `<div class="resolution-text">${resolution.resolutionText}</div>` : ''}
          ${resolution.decisionsMade ? `<div class="resolution-decisions"><strong>تصمیمات:</strong> ${resolution.decisionsMade}</div>` : ''}
          <div class="assignments-section">${assignmentsHtml}</div>
        </div>
      `;
    });

    return `
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>گزارش پیگیری مصوبات - جلسه ${data.meetingNumber}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .resolution-card { page-break-inside: avoid; }
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'B Yekan', 'Iranian Sans', Tahoma, sans-serif;
            direction: rtl;
            line-height: 1.6;
            color: #333;
            background: white;
            padding: 20px;
          }
          .print-header {
            text-align: center;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .company-name { font-size: 18px; font-weight: bold; color: #1f2937; }
          .report-title { font-size: 16px; color: #4f46e5; margin: 10px 0; }
          .meeting-info { display: flex; justify-content: center; gap: 30px; background: #f3f4f6; padding: 10px; border-radius: 8px; }
          .stats-bar { display: flex; justify-content: space-around; background: #f8f9fa; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
          .stat-item { text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; }
          .stat-label { font-size: 12px; color: #6b7280; }
          .resolution-card { border: 2px solid #e5e7eb; border-radius: 10px; margin-bottom: 20px; overflow: hidden; }
          .resolution-header { background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; padding: 12px; display: flex; gap: 15px; }
          .resolution-number { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-weight: bold; }
          .resolution-text, .resolution-decisions { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
          .assignment-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin: 10px; overflow: hidden; }
          .assignment-card.overdue { border-color: #f87171; background: #fef2f2; }
          .assignment-header { padding: 10px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; font-size: 12px; }
          .assignment-info { display: flex; gap: 15px; flex-wrap: wrap; }
          .overdue-badge { color: #dc2626; font-weight: bold; }
          .actions-table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .actions-table th { background: #e5e7eb; padding: 8px; border: 1px solid #d1d5db; }
          .actions-table td { padding: 8px; border: 1px solid #e5e7eb; text-align: center; }
          .text-right { text-align: right !important; }
          .badge { padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
          .status-pending { background: #6b7280; color: white; }
          .status-progress { background: #f59e0b; color: white; }
          .status-completed { background: #10b981; color: white; }
          .result-done { background: #059669; color: white; }
          .result-notdone { background: #dc2626; color: white; }
          .no-data, .no-assignments { text-align: center; padding: 15px; color: #6b7280; font-style: italic; }
          .print-footer { margin-top: 20px; text-align: left; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div class="company-name">شرکت پتروشیمی اصفهان</div>
          <div class="report-title">گزارش پیگیری مصوبات</div>
          <div class="meeting-info">
            <span><strong>شماره جلسه:</strong> ${data.meetingNumber}</span>
            <span><strong>عنوان:</strong> ${data.meetingTitle}</span>
            <span><strong>تاریخ:</strong> ${data.meetingDate}</span>
          </div>
        </div>

        <div class="stats-bar">
          <div class="stat-item">
            <div class="stat-value">${stats.totalAssignments}</div>
            <div class="stat-label">کل تخصیص‌ها</div>
          </div>
          <div class="stat-item" style="color: #10b981;">
            <div class="stat-value">${stats.completed}</div>
            <div class="stat-label">پایان یافته</div>
          </div>
          <div class="stat-item" style="color: #f59e0b;">
            <div class="stat-value">${stats.inProgress}</div>
            <div class="stat-label">در حال انجام</div>
          </div>
          <div class="stat-item" style="color: #6b7280;">
            <div class="stat-value">${stats.pending}</div>
            <div class="stat-label">در انتظار</div>
          </div>
          <div class="stat-item" style="color: #dc2626;">
            <div class="stat-value">${stats.overdue}</div>
            <div class="stat-label">دیرکرد</div>
          </div>
        </div>

        ${resolutionsHtml || '<div class="no-data">هیچ مصوبه‌ای یافت نشد</div>'}

        <div class="print-footer">تاریخ چاپ: ${new Date().toLocaleDateString('fa-IR')}</div>
      </body>
      </html>
    `;
  }

  // ═══════════════════════════════════════════════════════════
  // Track By
  // ═══════════════════════════════════════════════════════════

  trackByResolution(index: number, item: ResolutionItem): number {
    return item.resolutionId;
  }

  trackByAssignment(index: number, item: AssignmentItem): number {
    return item.assignmentId;
  }

  trackByAction(index: number, item: ActionItem): number {
    return item.actionId;
  }
}
