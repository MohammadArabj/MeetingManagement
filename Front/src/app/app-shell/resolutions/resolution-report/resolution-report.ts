import { Component, OnInit, signal, inject, OnDestroy, computed, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';

import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { firstValueFrom, Subject, debounceTime, takeUntil } from 'rxjs';
import { ToastService } from '../../../services/framework-services/toast.service';
import { ResolutionService } from '../../../services/resolution.service';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { POSITION_ID, USER_ID_NAME } from '../../../core/types/configuration';
import { CategoryService } from '../../../services/category.service';
import { ComboBase } from '../../../shared/combo-base';
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';
import { PositionService } from '../../../services/position.service';
import { UserService } from '../../../services/user.service';
import { SystemUser } from '../../../core/models/User';

// AG Grid
import { AgGridAngular } from 'ag-grid-angular';
import { AgGridBaseComponent } from '../../../shared/ag-grid-base/ag-grid-base';

// ✅ اضافه کردن LongTextCellComponent
import { LongTextCellComponent } from '../../resolutions/resolution-list/longtextCellComponent';
import { AssignmentService } from '../../../services/assignment.service';

// Enums
enum ActionStatus {
  Pending = 1,
  InProgress = 2,
  End = 3
}

enum AssignmentResult {
  Done = 1,
  NotDone = 2
}

// Interfaces
interface ResolutionDetailReportDto {
  meetingNumber: string;
  meetingTitle: string;
  meetingDate: string;
  meetingCategory: string;
  resolutionNumber: string;
  resolutionTitle: string;
  resolutionSubject: string;
  resolutionText: string;
  position: string;
  actorName: string;
  followerName: string;
  dueDate: string;
  actionStatus?: ActionStatus;
  result?: AssignmentResult;
  description: string;
  lastActionDate?: Date;
  totalActions: number;
  decisionsMade: string;
  documentation: string;
}

interface PositionResolutionSummary {
  totalMeetings: number;
  positionName: string;
  positionGuid: string;
  totalResolutions: number;
  completedResolutions: number;
  inProgressResolutions: number;
  notStartedResolutions: number;
  overdueResolutions: number;
  completionPercentage: number;
}

interface ResolutionSummaryReportDto {
  totalMeetings: number;
  totalResolutions: number;
  positionSummaries: PositionResolutionSummary[];
}

import { PrintService } from '../../../core/print/print.service';
@Component({
  selector: 'app-resolution-report',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, AgGridAngular],
  templateUrl: './resolution-report.html',
  styleUrls: ['./resolution-report.css']
})
export class ResolutionReportComponent extends AgGridBaseComponent implements OnInit, OnDestroy, AfterViewInit {
  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly resolutionReportService = inject(ResolutionService);
  private readonly positionService = inject(PositionService);
  private readonly categoryService = inject(CategoryService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly userService = inject(UserService);
  private readonly printService = inject(PrintService);

  // Destroy subject
  private destroy$ = new Subject<void>();

  // Enums for template
  public ActionStatus = ActionStatus;
  public AssignmentResult = AssignmentResult;

  // ✅ کامپوننت‌های سفارشی AG-Grid (مثل ResolutionListComponent)
  public override components: any = {
    longTextCell: LongTextCellComponent,
  };

  // Signals
  public activeTab = signal<'detail' | 'stats' | 'summary'>('detail');
  public detailResults = signal<ResolutionDetailReportDto[]>([]);
  public detailLoading = signal<boolean>(false);
  public summaryResult = signal<ResolutionSummaryReportDto | null>(null);
  public summaryLoading = signal<boolean>(false);
  private readonly _categories = signal<ComboBase[]>([]);
  readonly categories = this._categories.asReadonly();
  private readonly _ceoManagers = signal<ComboBase[]>([]);
  public ceoManagers = this._ceoManagers.asReadonly();
  private searchPerformed = signal<boolean>(false);
  private isSubmitting = signal<boolean>(false);

  // Form
  public reportForm!: FormGroup;
  private searchSubject = new Subject<void>();

  constructor() {
    super();
    this.setupBreadcrumb();
    this.initializeForm();
    this.setupSearchDebounce();
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    await this.loadCategories();
    await this.loadActors();
    this.setupGridColumns();
  }

  ngAfterViewInit(): void {
    // Grid ready
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupBreadcrumb(): void {
    this.breadcrumbService.setItems([
      { label: 'گزارش‌گیری مصوبات', routerLink: '/reports/resolutions' },
    ]);
  }

  private initializeForm(): void {
    this.reportForm = this.fb.group({
      fromDate: new FormControl(''),
      toDate: new FormControl(''),
      meetingNumber: new FormControl(''),
      meetingTitle: new FormControl(''),
      categoryGuid: new FormControl(''),
      resolutionNumber: new FormControl(''),
      resolutionTitle: new FormControl(''),
      resolutionText: new FormControl(''),
      dueDate: new FormControl(''),
      actionStatus: new FormControl(''),
      assignmentResult: new FormControl(''),
      decisions: new FormControl(''),
      description: new FormControl(''),
      documentation: new FormControl(''),
      positionGuid: new FormControl(''),
      actorPositionGuid: new FormControl('')
    });
  }

  private setupSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(500),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.performSearch();
    });
  }

  private readonly assignmentService = inject(AssignmentService);
  private readonly _actors = signal<ComboBase[]>([]);
  public actors = this._actors.asReadonly();
  private async loadActors(): Promise<void> {
    try {
      const result = await firstValueFrom(this.assignmentService.getBoardActors());
      const data = result||[];
      this._actors.set(
        data.map(a => ({ guid: a.actorPositionGuid, title: a.actorName }))
      );
    } catch (error) {
      console.error('خطا در بارگذاری اقدام‌کنندگان:', error);
      this._actors.set([]);
    }
  }
  private async loadCategories(): Promise<void> {
    try {
      const hasPermission = await this.passwordFlowService.checkPermission('MT_Meetings_ViewAllMeetings');
      const categories = await this.categoryService.getForComboByCondition<ComboBase[]>(hasPermission).toPromise() || [];
      this._categories.set(categories);
    } catch (error) {
      console.error('Error loading categories:', error);
      this._categories.set([]);
    }
  }

  // ============= Grid Setup =============

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.tooltipShowDelay = 0;
    options.tooltipHideDelay = 0;

    options.defaultColDef = {
      ...options.defaultColDef,
      sortable: true,
      resizable: false
    };

    options.columnDefs = [
      {
        headerName: 'ردیف',
        valueGetter: 'node.rowIndex + 1',
        width: 30,
        pinned: 'right',
        sortable: false,
        filter: false,
        cellStyle: { textAlign: 'center', fontWeight: 'bold', 'font-family': 'Sahel' }
      },
      {
        field: 'meetingCategory',
        headerName: 'دسته جلسه',
        width: 110,
        cellRenderer: this.categoryCellRenderer,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },
      {
        field: 'meetingNumber',
        headerName: 'شماره جلسه',
        width: 100,
        filter: 'agTextColumnFilter',
        cellStyle: { textAlign: 'center', fontWeight: 'bold', color: '#4f46e5', 'font-family': 'Sahel' }
      },
      {
        field: 'meetingDate',
        headerName: 'تاریخ جلسه',
        width: 100,
        filter: 'agTextColumnFilter',
        cellStyle: { textAlign: 'center', direction: 'ltr', 'font-family': 'Sahel' }
      },
      // ✅ عنوان جلسه - عرض زیاد با flex
      {
        field: 'meetingTitle',
        headerName: 'عنوان جلسه',
        minWidth: 300,
        flex: 2,
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      // ✅ سمت - عرض زیاد با flex
      {
        field: 'position',
        headerName: 'سمت',
        minWidth: 200,
        flex: 1.5,
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'resolutionNumber',
        headerName: 'شماره مصوبه',
        width: 100,
        filter: 'agTextColumnFilter',
        cellStyle: { textAlign: 'center', fontWeight: 'bold', color: '#f0bd05', 'font-family': 'Sahel' }
      },
      {
        field: 'resolutionTitle',
        headerName: 'عنوان مصوبه',
        minWidth: 200,
        flex: 1.5,
        filter: 'agTextColumnFilter',
        cellRenderer: 'longTextCell',
        cellRendererParams: { max: 50 }
      },
      {
        field: 'dueDate',
        headerName: 'سررسید',
        width: 95,
        filter: 'agTextColumnFilter',
        cellStyle: { textAlign: 'center', direction: 'ltr', 'font-family': 'Sahel' }
      },
      {
        field: 'actionStatus',
        headerName: 'وضعیت اقدام',
        width: 120,
        cellRenderer: this.actionStatusCellRenderer,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },
      {
        field: 'result',
        headerName: 'نتیجه اقدام',
        width: 100,
        cellRenderer: this.resultCellRenderer,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },
      {
        field: 'totalActions',
        headerName: 'تعداد اقدامات',
        width: 90,
        cellRenderer: (params: any) => {
          const count = params.value || 0;
          return `<span class="badge bg-info">${count}</span>`;
        },
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },
      {
        field: 'decisionsMade',
        headerName: 'تصمیمات متخذه',
        minWidth: 180,
        flex: 1,
        filter: 'agTextColumnFilter',
        cellRenderer: 'longTextCell',
        cellRendererParams: { max: 40 }
      },
      {
        field: 'description',
        headerName: 'توضیحات',
        minWidth: 150,
        flex: 1,
        filter: 'agTextColumnFilter',
        cellRenderer: 'longTextCell',
        cellRendererParams: { max: 35 }
      }
    ];

    options.pagination = true;
    options.paginationPageSize = 25;
    options.paginationPageSizeSelector = [10, 25, 50, 100];
    options.domLayout = 'normal';
    options.getRowNodeId = (data: any) => data.resolutionNumber || Math.random().toString();

    this.setupGridInteractions(options);
  }

  private setupGridInteractions(options: any): void {
    options.rowStyle = { cursor: 'pointer' };

    options.onCellDoubleClicked = (event: any) => {
      const field = event.colDef.field;
      const longTextFields = ['meetingTitle', 'resolutionTitle', 'decisionsMade', 'description'];
      if (longTextFields.includes(field) && event.value) {
        this.copyToClipboard(event.value);
      }
    };

    options.onGridReady = () => {
      setTimeout(() => {
        // this.autoSizeAllColumns();
      }, 300);
    };
  }
  // ===== در بخش Signals =====
  readonly statsReport = computed(() => {
    const results = this.detailResults();
    if (results.length === 0) return null;

    const uniqueMeetings = new Set(results.map(r => r.meetingNumber)).size;
    const total = results.length;
    const pending = results.filter(r => r.actionStatus === ActionStatus.Pending).length;
    const inProgress = results.filter(r => r.actionStatus === ActionStatus.InProgress).length;
    const endDone = results.filter(r => r.actionStatus === ActionStatus.End && r.result === AssignmentResult.Done).length;
    const endNotDone = results.filter(r => r.actionStatus === ActionStatus.End && r.result === AssignmentResult.NotDone).length;
    const endTotal = results.filter(r => r.actionStatus === ActionStatus.End).length;

    return { uniqueMeetings, total, pending, inProgress, endDone, endNotDone, endTotal };
  });

  public pct(part: number, total: number): number {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  public printStats(): void {
    const stats = this.statsReport();
    if (!stats) { this.toastService.warning('ابتدا گزارش را تولید کنید'); return; }

    const formValue = this.reportForm.value;
    const p = (part: number) => Math.round((part / stats.total) * 100);
    const bar = (pct: number, color: string) =>
      `<div style="background:#f1f5f9;border-radius:4px;height:10px;overflow:hidden;">
       <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;"></div>
     </div>`;

    const rows = [
      { label: 'تعداد جلسات', val: stats.uniqueMeetings, pct: null, color: null },
      { label: 'کل مصوبات', val: stats.total, pct: 100, color: '#6b7280' },
      { label: 'در انتظار اقدام', val: stats.pending, pct: p(stats.pending), color: '#f59e0b' },
      { label: 'در حال انجام', val: stats.inProgress, pct: p(stats.inProgress), color: '#8b5cf6' },
      { label: 'پایان یافته — کل', val: stats.endTotal, pct: p(stats.endTotal), color: '#14b8a6' },
      { label: 'پایان یافته — انجام شده', val: stats.endDone, pct: p(stats.endDone), color: '#10b981' },
      { label: 'پایان یافته — انجام نشده', val: stats.endNotDone, pct: p(stats.endNotDone), color: '#ef4444' },
    ];

    const tableRows = rows.map(r => `
    <tr>
      <td>${r.label}</td>
      <td style="text-align:center;font-weight:700;">${r.val}</td>
      <td style="text-align:center;">${r.pct !== null ? r.pct + '%' : '—'}</td>
      <td style="padding:8px 10px;">${r.pct !== null && r.color ? bar(r.pct, r.color) : ''}</td>
    </tr>
  `).join('');

    const filters: string[] = [];
    if (formValue.fromDate) filters.push(`از تاریخ: ${formValue.fromDate}`);
    if (formValue.toDate) filters.push(`تا تاریخ: ${formValue.toDate}`);
    if (formValue.meetingNumber) filters.push(`شماره جلسه: ${formValue.meetingNumber}`);

    const content = `
    ${filters.length ? `<div class="filters-applied">${filters.map(f => `<span class="filter-item">${f}</span>`).join('')}</div>` : ''}
    <table class="stats-table">
      <thead>
      <tr><th style="width:38%">شاخص</th><th style="width:14%">تعداد</th><th style="width:14%">درصد</th><th>نسبت</th></tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>`;

    void this.printService
      .printReport('resolution-report', content, { title: 'گزارش آماری مصوبات' })
      .catch((e: any) => this.toastService.error(e?.message || 'خطا در آماده‌سازی چاپ'));
  }
  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.success('متن کپی شد');
    }).catch(() => {
      this.toastService.error('خطا در کپی متن');
    });
  }

  // ============= Cell Renderers =============

  private categoryCellRenderer = (params: any): string => {
    const category = params.value || '-';
    let badgeClass = 'bg-secondary';

    if (category === 'هیئت مدیره') badgeClass = 'bg-primary';
    else if (category === 'کمیته') badgeClass = 'bg-info';
    else if (category === 'عمومی') badgeClass = 'bg-success';

    return `<span class="badge ${badgeClass}" style="font-size: 11px;">${category}</span>`;
  };

  private actionStatusCellRenderer = (params: any): string => {
    const status = params.value;
    if (!status) return '<span class="text-muted">-</span>';

    const statusMap: Record<number, { text: string; color: string }> = {
      [ActionStatus.Pending]: { text: 'در انتظار اقدام', color: '#f27e63' },
      [ActionStatus.InProgress]: { text: 'در حال انجام', color: '#f0ad4e' },
      [ActionStatus.End]: { text: 'پایان یافته', color: '#5cb85c' }
    };

    const config = statusMap[status] || { text: '-', color: 'gray' };
    return `<span class="badge-status" style="background-color: ${config.color};">${config.text}</span>`;
  };

  private resultCellRenderer = (params: any): string => {
    const data = params.data;
    if (data?.actionStatus !== ActionStatus.End) {
      return '<span class="text-muted">-</span>';
    }

    const result = params.value;
    if (!result) return '<span class="text-muted">-</span>';

    const resultMap: Record<number, { text: string; class: string }> = {
      [AssignmentResult.Done]: { text: 'انجام شده', class: 'bg-success' },
      [AssignmentResult.NotDone]: { text: 'انجام نشده', class: 'bg-danger' }
    };

    const config = resultMap[result] || { text: '-', class: 'bg-secondary' };
    return `<span class="badge ${config.class}" style="font-size: 11px;">${config.text}</span>`;
  };

  // ============= Grid Events =============

  override onGridReady(params: any): void {
    super.onGridReady(params);
    setTimeout(() => {
      // const api = this.gridApi();
      // api?.sizeColumnsToFit();
    }, 300);
  }

  public onFirstDataRendered(event: any): void {
    setTimeout(() => {
      // const api = this.gridApi();
      // api?.sizeColumnsToFit();
    }, 300);
  }

  // ============= Form Methods =============

  public isEndStatus(): boolean {
    const status = this.reportForm.get('actionStatus')?.value;
    return status == ActionStatus.End;
  }

  public onActionStatusChange(): void {
    if (!this.isEndStatus()) {
      this.reportForm.get('assignmentResult')?.setValue('');
    }
  }

  public generateReport(): void {
    if (this.isSubmitting()) {
      this.toastService.warning('لطفاً منتظر تکمیل درخواست قبلی باشید');
      return;
    }
    this.isSubmitting.set(true);
    this.searchSubject.next();
  }

  private async performSearch(): Promise<void> {
    try {
      await this.generateDetailReport();
      this.searchPerformed.set(true);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private async generateDetailReport(): Promise<void> {
    this.detailLoading.set(true);
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    const positionGuid = this.localStorageService.getItem(POSITION_ID);

    try {
      const formValue = this.reportForm.value;
      const request = {
        fromDate: formValue.fromDate || undefined,
        toDate: formValue.toDate || undefined,
        meetingNumber: formValue.meetingNumber?.trim() || undefined,
        meetingTitle: formValue.meetingTitle?.trim() || undefined,
        categoryGuid: formValue.categoryGuid || undefined,
        resolutionNumber: formValue.resolutionNumber?.trim() || undefined,
        resolutionTitle: formValue.resolutionTitle?.trim() || undefined,
        resolutionText: formValue.resolutionText?.trim() || undefined,
        dueDate: formValue.dueDate || undefined,
        actionStatus: formValue.actionStatus ? +formValue.actionStatus : undefined,
        assignmentResult: formValue.assignmentResult ? +formValue.assignmentResult : undefined,
        decisions: formValue.decisions?.trim() || undefined,
        description: formValue.description?.trim() || undefined,
        documentation: formValue.documentation?.trim() || undefined,
        positionGuid: formValue.positionGuid || undefined,
        userGuid: userGuid,
        positionMainGuid: positionGuid,
        actorPositionGuid: formValue.actorPositionGuid || undefined
      };

      const result = await firstValueFrom(
        this.resolutionReportService.getDetailReport(request)
      );

      this.detailResults.set(result.details?.length > 0 ? result.details : []);
      this.summaryResult.set(result.summary || null);

    } catch (error) {
      console.error('خطا در تولید گزارش تفصیلی:', error);
      this.toastService.error('خطا در تولید گزارش تفصیلی');
      this.detailResults.set([]);
    } finally {
      this.detailLoading.set(false);
    }
  }

  public clearFilters(): void {
    this.reportForm.reset();
    this.detailResults.set([]);
    this.summaryResult.set(null);
    this.searchPerformed.set(false);
  }

  public switchTab(tab: 'detail' | 'stats' | 'summary'): void {
    this.activeTab.set(tab);

    if (tab === 'detail') {
      setTimeout(() => {
        const api = this.gridApi();
        api?.sizeColumnsToFit();
      }, 100);
    }
  }

  // ========== Print Methods ==========

  public printReport(): void {
    if (this.activeTab() === 'detail' && this.detailResults().length === 0) {
      this.toastService.warning('ابتدا گزارش تفصیلی را تولید کنید');
      return;
    }
    if (this.activeTab() === 'summary' && !this.summaryResult()) {
      this.toastService.warning('ابتدا گزارش خلاصه را تولید کنید');
      return;
    }
    this.openPrintWindow(false);
  }

  public printReportWithDecisions(): void {
    if (this.activeTab() === 'detail' && this.detailResults().length === 0) {
      this.toastService.warning('ابتدا گزارش تفصیلی را تولید کنید');
      return;
    }
    this.openPrintWindow(true);
  }

  private openPrintWindow(withDecisions: boolean = false): void {
    const reportTitle = this.activeTab() === 'detail'
      ? (withDecisions ? 'گزارش تفصیلی با تصمیمات متخذه' : 'گزارش تفصیلی')
      : 'گزارش خلاصه';
    const content = this.getAppliedFiltersHtml()
      + (this.activeTab() === 'detail' ? this.getDetailTableHtml(withDecisions) : this.getSummaryTableHtml());

    void this.printService
      .printReport('resolution-report', content, { title: `${reportTitle} مصوبات` })
      .catch((e: any) => this.toastService.error(e?.message || 'خطا در آماده‌سازی چاپ'));
  }

  private getAppliedFiltersHtml(): string {
    const formValue = this.reportForm.value;
    let fromDate = formValue.fromDate;
    let toDate = formValue.toDate;

    if (!fromDate || !toDate) {
      const results = this.detailResults();
      if (results.length > 0) {
        const dates = results.map(r => r.meetingDate);
        fromDate = fromDate || dates.reduce((min, curr) => curr < min ? curr : min);
        toDate = toDate || dates.reduce((max, curr) => curr > max ? curr : max);
      }
    }

    return `
      <div class="filters-applied">
          <span class="filter-item">از تاریخ: ${fromDate || '-'}</span>
          <span class="filter-item">تا تاریخ: ${toDate || '-'}</span>
      </div>
    `;
  }

  private getDetailTableHtml(withDecisions: boolean = false): string {
    const results = this.detailResults();
    if (results.length === 0) {
      return '<div style="text-align: center; padding: 50px;">هیچ نتیجه‌ای یافت نشد</div>';
    }

    const tableRows = results.map((item, index) => `
      <tr>
          <td>${index + 1}</td>
          <td>${item.meetingDate}</td>
          <td>${item.meetingNumber || '-'}</td>
          <td>${item.resolutionNumber || '-'}</td>
          <td>${item.resolutionTitle || '-'}</td>
          <td>${item.position || '-'}</td>
          <td>${this.getActionStatusText(item.actionStatus)}</td>
          <td>${item.actionStatus === ActionStatus.End ? this.getResultText(item.result) : '-'}</td>
          <td>${item.description || '-'}</td>
          ${withDecisions ? `<td>${item.meetingCategory === 'هیئت مدیره' ? (item.decisionsMade || '-') : (item.resolutionText || '-')}</td>` : ''}
      </tr>
    `).join('');

    return `
      <table>
          <thead>
              <tr>
                  <th>ردیف</th>
                  <th>تاریخ جلسه</th>
                  <th>شماره جلسه</th>
                  <th>شماره مصوبه</th>
                  <th>موضوع مصوبه</th>
                  <th>سمت</th>
                  <th>وضعیت اقدام</th>
                  <th>نتیجه</th>
                  <th>توضیحات</th>
                  ${withDecisions ? '<th>تصمیمات متخذه / متن مصوبه</th>' : ''}
              </tr>
          </thead>
          <tbody>${tableRows}</tbody>
      </table>
    `;
  }

  private getSummaryTableHtml(): string {
    const result = this.summaryResult();
    if (!result) {
      return '<div style="text-align: center; padding: 50px;">هیچ داده‌ای یافت نشد</div>';
    }

    const tableRows = result.positionSummaries?.map(item => `
      <tr>
          <td class="fw-bold">${item.positionName}</td>
          <td>${item.totalMeetings}</td>
          <td>${item.totalResolutions}</td>
          <td>${item.notStartedResolutions}</td>
          <td>${item.inProgressResolutions}</td>
          <td>${item.completedResolutions}</td>
      </tr>
    `).join('') || '';

    return `
      <table>
          <thead>
              <tr>
                  <th>نام سمت</th>
                  <th>تعداد جلسات</th>
                  <th>تعداد مصوبات</th>
                  <th>در انتظار اقدام</th>
                  <th>در حال انجام</th>
                  <th>پایان یافته</th>
              </tr>
          </thead>
          <tbody>${tableRows}</tbody>
      </table>
    `;
  }

  public getActionStatusText(status?: ActionStatus): string {
    if (!status) return '-';
    const map: Record<ActionStatus, string> = {
      [ActionStatus.Pending]: 'در انتظار اقدام',
      [ActionStatus.InProgress]: 'در حال انجام',
      [ActionStatus.End]: 'پایان یافته'
    };
    return map[status] || '-';
  }

  public getResultText(result?: AssignmentResult): string {
    if (!result) return '-';
    const map: Record<AssignmentResult, string> = {
      [AssignmentResult.Done]: 'انجام شده',
      [AssignmentResult.NotDone]: 'انجام نشده'
    };
    return map[result] || '-';
  }

  // ============= Getters =============

  public get isDetailTabEmpty(): boolean {
    return this.searchPerformed() && this.detailResults().length === 0;
  }

  public get isSummaryTabEmpty(): boolean {
    return this.searchPerformed() && !this.summaryResult();
  }

  public get isLoading(): boolean {
    return this.detailLoading() || this.summaryLoading() || this.isSubmitting();
  }
}


