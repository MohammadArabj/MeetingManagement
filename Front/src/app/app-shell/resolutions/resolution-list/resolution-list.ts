import {
  AfterViewInit,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AgGridAngular } from 'ag-grid-angular';
import { AgGridBaseComponent } from '../../../shared/ag-grid-base/ag-grid-base';

import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';
import { AssignmentService } from '../../../services/assignment.service';
import { POSITION_ID, USER_ID_NAME } from '../../../core/types/configuration';

import { AssignmentOptionsCellComponent } from './resolutionOptionsCellComponent';
import { LongTextCellComponent } from './longtextCellComponent';

export enum AssignmentViewType {
  All = 'All',
  OriginalAssignment = 'OriginalAssignment',
  ReceivedReferral = 'ReceivedReferral',
  GivenReferral = 'GivenReferral'
}

export enum ActionStatus {
  Pending = 1,
  InProgress = 2,
  End = 3,
  Overdue = 4
}

export enum ActionFollowStatus {
  Pending = 1,
  InProgress = 2,
  End = 3
}

export enum AssignmentResult {
  Done = 1,
  NotDone = 2
}

export interface ViewTypeOption {
  value: AssignmentViewType;
  label: string;
  description: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-resolution-list',
  templateUrl: './resolution-list.html',
  styleUrl: './resolution-list.css',
  imports: [AgGridAngular, FormsModule],
  standalone: true
})
export class ResolutionListComponent extends AgGridBaseComponent implements OnInit, AfterViewInit {
  protected readonly AssignmentViewType = AssignmentViewType;
  protected readonly ActionStatus = ActionStatus;
  protected readonly ActionFollowStatus = ActionFollowStatus;
  protected readonly AssignmentResult = AssignmentResult;

  private readonly assignmentService = inject(AssignmentService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly route = inject(ActivatedRoute);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  public records = signal<any[]>([]);
  public isPermitted = signal<boolean>(false);
  public loading = signal<boolean>(false);
  public selectedRowId = signal<number | null>(null);

  public showGuide = signal<boolean>(true);

  public selectedViewType = signal<AssignmentViewType>(AssignmentViewType.All);
  public selectedRole = signal<string>('');
  public selectedActionStatus = signal<ActionStatus | null>(null);
  public selectedFollowStatus = signal<ActionFollowStatus | null>(null);
  public selectedResult = signal<AssignmentResult | null>(null);
  public showOverdueOnly = signal<boolean>(false);

  public tempViewType = signal<AssignmentViewType>(AssignmentViewType.All);
  public tempRole = signal<string>('');
  public tempActionStatus = signal<ActionStatus | null>(null);
  public tempFollowStatus = signal<ActionFollowStatus | null>(null);
  public tempResult = signal<AssignmentResult | null>(null);
  public tempShowOverdue = signal<boolean>(false);

  public viewTypeOptions: ViewTypeOption[] = [
    {
      value: AssignmentViewType.All,
      label: 'همه تخصیص‌ها',
      description: 'نمایش کلیه مصوبه‌هایی که به عنوان اقدام‌کننده یا پیگیری‌کننده به شما مربوط می‌شوند.',
      icon: 'fa-list',
      color: 'primary'
    },
    {
      value: AssignmentViewType.OriginalAssignment,
      label: 'تخصیص‌های اصلی',
      description: 'مصوبه‌هایی که مستقیماً و بدون واسطه به شما محول شده‌اند.',
      icon: 'fa-user-circle',
      color: 'info'
    },
    {
      value: AssignmentViewType.ReceivedReferral,
      label: 'ارجاعات دریافتی',
      description: 'مصوبه‌هایی که توسط شخص دیگری به شما ارجاع داده شده است.',
      icon: 'fa-arrow-down',
      color: 'success'
    },
    {
      value: AssignmentViewType.GivenReferral,
      label: 'ارجاعات ارسالی',
      description: 'مصوبه‌هایی که شما به شخص دیگری ارجاع داده‌اید.',
      icon: 'fa-arrow-up',
      color: 'warning'
    }
  ];

  public counts = signal<any>({
    action: { all: 0, pending: 0, inProgress: 0, end: 0, overdue: 0 },
    follow: { all: 0, pending: 0, inProgress: 0, end: 0 },
    receivedReferrals: { total: 0 },
    sentReferrals: { total: 0 },
    originalAssignments: { total: 0 }
  });

  public showRoleFilter = computed(() => {
    const viewType = this.tempViewType();
    return viewType === AssignmentViewType.All || viewType === AssignmentViewType.OriginalAssignment;
  });

  public showActionStatusFilter = computed(() => {
    const viewType = this.tempViewType();
    const role = this.tempRole();
    return (viewType === AssignmentViewType.All && role !== 'Follow') ||
      (viewType === AssignmentViewType.OriginalAssignment && role !== 'Follow') ||
      viewType === AssignmentViewType.ReceivedReferral;
  });

  public showFollowStatusFilter = computed(() => {
    const viewType = this.tempViewType();
    const role = this.tempRole();
    return (viewType === AssignmentViewType.All && role !== 'Action') ||
      (viewType === AssignmentViewType.OriginalAssignment && role !== 'Action') ||
      viewType === AssignmentViewType.GivenReferral;
  });

  public showResultFilter = computed(() => this.tempActionStatus() === ActionStatus.End);

  public activeFilters = computed(() => {
    const filters: Array<{ type: string, label: string, value: any }> = [];

    const viewType = this.selectedViewType();
    if (viewType !== AssignmentViewType.All) {
      const option = this.viewTypeOptions.find(o => o.value === viewType);
      filters.push({ type: 'viewType', label: option?.label || '', value: viewType });
    }

    const role = this.selectedRole();
    if (role) {
      filters.push({ type: 'role', label: role === 'Action' ? 'اقدام‌کننده' : 'پیگیری‌کننده', value: role });
    }

    const actionStatus = this.selectedActionStatus();
    if (actionStatus !== null) {
      filters.push({ type: 'actionStatus', label: `وضعیت اقدام: ${this.getActionStatusLabel(actionStatus)}`, value: actionStatus });
    }

    const followStatus = this.selectedFollowStatus();
    if (followStatus !== null) {
      filters.push({ type: 'followStatus', label: `وضعیت پیگیری: ${this.getFollowStatusLabel(followStatus)}`, value: followStatus });
    }

    const result = this.selectedResult();
    if (result !== null) {
      filters.push({ type: 'result', label: `نتیجه: ${this.getResultLabel(result)}`, value: result });
    }

    if (this.showOverdueOnly()) {
      filters.push({ type: 'overdue', label: 'فقط گذشته از مهلت', value: true });
    }

    return filters;
  });

  public hasActiveFilters = computed(() => this.activeFilters().length > 0);

  public getViewTypeCount = computed(() => {
    const counts = this.counts();
    const viewType = this.selectedViewType();
    switch (viewType) {
      case AssignmentViewType.All: return counts.action.all + counts.follow.all;
      case AssignmentViewType.OriginalAssignment: return counts.originalAssignments?.total || 0;
      case AssignmentViewType.ReceivedReferral: return counts.receivedReferrals?.total || 0;
      case AssignmentViewType.GivenReferral: return counts.sentReferrals?.total || 0;
      default: return 0;
    }
  });

  // کامپوننت‌های سفارشی AG-Grid (فقط همین)
  public override components: any = {
    longTextCell: LongTextCellComponent,
  };

  constructor() {
    super();
    this.breadcrumbService.setItems([{ label: 'مصوبات', routerLink: '/resolutions/list' }]);

    const guideHidden = localStorage.getItem('resolutionListGuideHidden');
    if (guideHidden === 'true') this.showGuide.set(false);

    effect(() => {
      if (this.isPermitted()) this.getRecords();
    });
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();

    const checkPermission = await this.passwordFlowService.checkPermission('MT_Followups');
    if (!checkPermission) {
      this.toastService.error('شما مجوز مشاهده این صفحه را ندارید');
      return;
    }

    this.isPermitted.set(true);

    this.route.queryParams.subscribe(params => {
      if (params['viewType']) {
        const viewType = params['viewType'] as AssignmentViewType;
        this.selectedViewType.set(viewType);
        this.tempViewType.set(viewType);
      }
      if (params['role']) {
        this.selectedRole.set(params['role']);
        this.tempRole.set(params['role']);
      }
      if (params['actionStatus']) {
        const status = parseInt(params['actionStatus'], 10) as ActionStatus;
        this.selectedActionStatus.set(status);
        this.tempActionStatus.set(status);
      }
      if (params['followStatus']) {
        const status = parseInt(params['followStatus'], 10) as ActionFollowStatus;
        this.selectedFollowStatus.set(status);
        this.tempFollowStatus.set(status);
      }
      if (params['result']) {
        const result = parseInt(params['result'], 10) as AssignmentResult;
        this.selectedResult.set(result);
        this.tempResult.set(result);
      }
      if (params['overdue']) {
        const overdue = params['overdue'] === 'true';
        this.showOverdueOnly.set(overdue);
        this.tempShowOverdue.set(overdue);
      }

      if (this.isPermitted()) this.loadCounts();
    });

    this.setupGridColumns();
  }

  ngAfterViewInit(): void {
    this.restoreGridState();
  }

  public hideGuide(): void {
    this.showGuide.set(false);
    localStorage.setItem('resolutionListGuideHidden', 'true');
  }

  public resetGuide(): void {
    this.showGuide.set(true);
    localStorage.removeItem('resolutionListGuideHidden');
  }

  public applyFilters(): void {
    this.selectedViewType.set(this.tempViewType());
    this.selectedRole.set(this.tempRole());
    this.selectedActionStatus.set(this.tempActionStatus());
    this.selectedFollowStatus.set(this.tempFollowStatus());
    this.selectedResult.set(this.tempResult());
    this.showOverdueOnly.set(this.tempShowOverdue());

    const viewType = this.selectedViewType();

    if (viewType === AssignmentViewType.ReceivedReferral) {
      this.selectedRole.set('Action');
      this.tempRole.set('Action');
      this.selectedFollowStatus.set(null);
      this.tempFollowStatus.set(null);
    } else if (viewType === AssignmentViewType.GivenReferral) {
      this.selectedRole.set('Follow');
      this.tempRole.set('Follow');
      this.selectedActionStatus.set(null);
      this.tempActionStatus.set(null);
      this.selectedResult.set(null);
      this.tempResult.set(null);
    }

    if (this.selectedActionStatus() !== ActionStatus.End) {
      this.selectedResult.set(null);
      this.tempResult.set(null);
    }

    this.updateUrlParams();
  }

  public removeFilter(filterType: string): void {
    switch (filterType) {
      case 'viewType':
        this.selectedViewType.set(AssignmentViewType.All);
        this.tempViewType.set(AssignmentViewType.All);
        break;
      case 'role':
        this.selectedRole.set('');
        this.tempRole.set('');
        break;
      case 'actionStatus':
        this.selectedActionStatus.set(null);
        this.tempActionStatus.set(null);
        this.selectedResult.set(null);
        this.tempResult.set(null);
        break;
      case 'followStatus':
        this.selectedFollowStatus.set(null);
        this.tempFollowStatus.set(null);
        break;
      case 'result':
        this.selectedResult.set(null);
        this.tempResult.set(null);
        break;
      case 'overdue':
        this.showOverdueOnly.set(false);
        this.tempShowOverdue.set(false);
        break;
    }
    this.updateUrlParams();
  }

  public clearAllFilters(): void {
    this.tempViewType.set(AssignmentViewType.All);
    this.tempRole.set('');
    this.tempActionStatus.set(null);
    this.tempFollowStatus.set(null);
    this.tempResult.set(null);
    this.tempShowOverdue.set(false);

    this.selectedViewType.set(AssignmentViewType.All);
    this.selectedRole.set('');
    this.selectedActionStatus.set(null);
    this.selectedFollowStatus.set(null);
    this.selectedResult.set(null);
    this.showOverdueOnly.set(false);

    this.updateUrlParams();
  }

  public updateUrlParams(): void {
    const params: any = {};
    params.viewType = this.selectedViewType() !== AssignmentViewType.All ? this.selectedViewType() : null;
    params.role = this.selectedRole() || null;
    params.actionStatus = this.selectedActionStatus() !== null ? this.selectedActionStatus() : null;
    params.followStatus = this.selectedFollowStatus() !== null ? this.selectedFollowStatus() : null;
    params.result = this.selectedResult() !== null ? this.selectedResult() : null;
    params.overdue = this.showOverdueOnly() ? 'true' : null;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge'
    });
  }

  public getActionStatusLabel(status: ActionStatus): string {
    const labels: any = {
      [ActionStatus.Pending]: 'در انتظار اقدام',
      [ActionStatus.InProgress]: 'در حال انجام',
      [ActionStatus.End]: 'پایان یافته',
      [ActionStatus.Overdue]: 'گذشته از مهلت'
    };
    return labels[status] || '';
  }

  public getFollowStatusLabel(status: ActionFollowStatus): string {
    const labels: any = {
      [ActionFollowStatus.Pending]: 'در انتظار پیگیری',
      [ActionFollowStatus.InProgress]: 'در حال پیگیری',
      [ActionFollowStatus.End]: 'پایان پیگیری'
    };
    return labels[status] || '';
  }

  public getResultLabel(result: AssignmentResult): string {
    const labels: any = {
      [AssignmentResult.Done]: 'انجام شده',
      [AssignmentResult.NotDone]: 'انجام نشده'
    };
    return labels[result] || '';
  }

  public async loadCounts(): Promise<void> {
    try {
      const positionGuid = this.localStorageService.getItem(POSITION_ID);
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);

      const [assignmentCounts, originalCounts, receivedCounts, sentCounts] = await Promise.all([
        firstValueFrom(this.assignmentService.getCounts(positionGuid)),
        firstValueFrom(this.assignmentService.getOriginalAssignmentCounts(positionGuid)),
        firstValueFrom(this.assignmentService.getReceivedReferralCounts(positionGuid)),
        firstValueFrom(this.assignmentService.getSentReferralCounts(userGuid))
      ]);

      this.counts.set({
        action: assignmentCounts.actionCounts || { all: 0, pending: 0, inProgress: 0, end: 0, overdue: 0 },
        follow: assignmentCounts.followCounts || { all: 0, pending: 0, inProgress: 0, end: 0 },
        originalAssignments: originalCounts || { total: 0 },
        receivedReferrals: receivedCounts || { total: 0 },
        sentReferrals: sentCounts || { total: 0 }
      });
    } catch (e) {
      console.error(e);
    }
  }

  public async getRecords(): Promise<void> {
    this.loading.set(true);

    try {
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      const positionGuid = this.localStorageService.getItem(POSITION_ID);

      const requestModel: any = {
        userGuid,
        positionGuid,
        viewType: this.selectedViewType()
      };

      if (this.selectedRole()) requestModel.type = this.selectedRole();
      if (this.selectedActionStatus() !== null) requestModel.actionStatus = this.selectedActionStatus();
      if (this.selectedFollowStatus() !== null) requestModel.approvalStatus = this.selectedFollowStatus();
      if (this.selectedResult() !== null) requestModel.result = this.selectedResult();
      if (this.showOverdueOnly()) requestModel.overdueOnly = true;

      const data = await firstValueFrom(this.assignmentService.getAll(requestModel));
      this.records.set(data);

      const api = this.gridApi();
      api?.sizeColumnsToFit();
      setTimeout(() => this.highlightSelectedRow(), 300);
    } catch (error) {
      console.error(error);
      this.toastService.error('خطا در بارگذاری داده‌ها');
    } finally {
      this.loading.set(false);
    }
  }

  private restoreGridState(): void {
    const pageStr = sessionStorage.getItem('resolutionGridPage');
    if (pageStr) {
      const page = parseInt(pageStr, 10);
      setTimeout(() => {
        const api = this.gridApi();
        api?.paginationGoToPage(page);
        this.highlightSelectedRow();
      }, 300);
    }
  }

  private highlightSelectedRow(): void {
    const api = this.gridApi();
    const id = parseInt(sessionStorage.getItem('editedAssignmentId') ?? '0', 10);
    if (!api || !id) return;

    api.forEachNode((node: any) => {
      if (node.data?.id === id) {
        node.setSelected(true);
        setTimeout(() => api.ensureIndexVisible(node.rowIndex, 'middle'), 50);
      } else node.setSelected(false);
    });
  }

  private saveGridState(): void {
    const api = this.gridApi();
    if (!api) return;
    sessionStorage.setItem('resolutionGridPage', api.paginationGetCurrentPage().toString());
  }

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    // Tooltip داخلی AG-Grid را کامل غیرفعال می‌کنیم
    options.tooltipShowDelay = 0;
    options.tooltipHideDelay = 0;

    options.defaultColDef = {
      ...options.defaultColDef,
      sortable: true,
      resizable: false
    };

    options.columnDefs = [
      {
        colId: 'actions',
        headerName: 'عملیات',
        cellRenderer: AssignmentOptionsCellComponent,
        cellStyle: { textAlign: 'center', overflow: 'unset', 'font-family': 'Sahel' },
        width: 120,
        pinned: 'right',
        suppressMovable: true
      },
      { field: 'meetingDate', headerName: 'تاریخ جلسه', filter: 'agTextColumnFilter', width: 120, cellStyle: { direction: 'ltr', textAlign: 'center', 'font-family': 'Sahel' } },
      { field: 'meetingNumber', headerName: 'شماره جلسه', filter: 'agTextColumnFilter', width: 120, cellStyle: { textAlign: 'center', 'font-family': 'Sahel' } },
      { field: 'number', headerName: 'شماره مصوبه', filter: 'agTextColumnFilter', width: 120, cellStyle: { textAlign: 'center', fontWeight: 'bold', color: '#f0bd05', 'font-family': 'Sahel' } },

      // ستون‌های طولانی -> renderer اختصاصی
      { field: 'meetingTitle', headerName: 'عنوان جلسه', filter: 'agTextColumnFilter', width: 180, cellRenderer: 'longTextCell', cellRendererParams: { max: 22 } },
      { field: 'title', headerName: 'عنوان مصوبه', filter: 'agTextColumnFilter', width: 220, cellRenderer: 'longTextCell', cellRendererParams: { max: 30 } },
      { field: 'resolution', headerName: 'متن مصوبه', filter: 'agTextColumnFilter', width: 260, cellRenderer: 'longTextCell', cellRendererParams: { max: 40 } },

      { field: 'actor', headerName: 'اقدام‌کننده', filter: 'agTextColumnFilter', width: 140, cellStyle: { direction: 'rtl', 'font-family': 'Sahel' } },
      { field: 'follower', headerName: 'پیگیری‌کننده', filter: 'agTextColumnFilter', width: 140, cellStyle: { direction: 'rtl', 'font-family': 'Sahel' } },

      { field: 'actionStatus', headerName: 'وضعیت اقدام', width: 140, cellRenderer: this.actionStatusCellRenderer, cellStyle: { textAlign: 'center', 'font-family': 'Sahel' } },
      { field: 'followStatus', headerName: 'وضعیت پیگیری', width: 140, cellRenderer: this.followStatusCellRenderer, cellStyle: { textAlign: 'center', 'font-family': 'Sahel' } },

      {
        field: 'actionResult',
        headerName: 'نتیجه اقدام',
        width: 130,
        cellRenderer: (params: any) => {
          const result = params.data?.actionResult;
          const resultName = params.data?.resultName;
          if (!result || !resultName) return '<span class="text-muted">-</span>';
          const badgeClass = result === 'Done' ? 'bg-success' : 'bg-danger';
          return `<span class="badge ${badgeClass}">${resultName}</span>`;
        },
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },

      { field: 'resultDate', headerName: 'تاریخ پایان اقدام', width: 130, cellStyle: { direction: 'ltr', textAlign: 'center', 'font-family': 'Sahel' } },

      { field: 'category', headerName: 'دسته‌بندی', filter: 'agTextColumnFilter', width: 130, cellStyle: { direction: 'rtl', 'font-family': 'Sahel' } },

      { field: 'resultDescription', headerName: 'توضیحات نتیجه', filter: 'agTextColumnFilter', width: 200, cellRenderer: 'longTextCell', cellRendererParams: { max: 28 } },

      {
        field: 'statusDescription',
        headerName: 'نوع تخصیص',
        width: 130,
        cellRenderer: (params: any) => {
          const viewType = params.data?.viewType;
          const description = params.data?.statusDescription;
          let badgeClass = 'bg-secondary';
          if (viewType === 'OriginalAssignment') badgeClass = 'bg-primary';
          if (viewType === 'ReceivedReferral') badgeClass = 'bg-success';
          if (viewType === 'GivenReferral') badgeClass = 'bg-warning';
          return `<span class="badge ${badgeClass}" style="min-width:90px">${description || '-'}</span>`;
        },
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },

      { field: 'dueDate', headerName: 'مهلت اقدام', filter: 'agDateColumnFilter', width: 120, cellStyle: { direction: 'ltr', textAlign: 'center', 'font-family': 'Sahel' } },

      {
        field: 'referralsCount',
        headerName: 'تعداد ارجاع',
        width: 100,
        cellRenderer: (params: any) => {
          const count = params.data?.referralsCount || 0;
          return count > 0 ? `<span class="badge bg-info">${count}</span>` : '<span class="text-muted">-</span>';
        },
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      }
    ];

    options.pagination = true;
    options.paginationPageSize = 20;
    options.domLayout = 'normal';
    options.getRowNodeId = (data: any) => data.id?.toString();

    options.onPaginationChanged = () => {
      const api = this.gridApi();
      if (!api) return;
      sessionStorage.setItem('resolutionGridPage', api.paginationGetCurrentPage().toString());
    };

    this.setupGridInteractions(options);
  }

  private setupGridInteractions(options: any): void {
    options.rowStyle = { cursor: 'pointer' };

    options.onCellClicked = (event: any) => {
      if (event.colDef.colId !== 'actions' && event.data) {
        this.saveGridState();
        sessionStorage.setItem('editedAssignmentId', event.data.id);
        this.selectedRowId.set(event.data.id);
        this.openAssignmentManagement(event.data);
      }
    };

    options.onCellDoubleClicked = (event: any) => {
      const field = event.colDef.field;
      const longTextFields = ['resolution', 'resultDescription', 'title', 'meetingTitle'];
      if (longTextFields.includes(field) && event.value) this.copyToClipboard(event.value);
    };

    options.onGridReady = () => {
      setTimeout(() => {
        this.highlightSelectedRow();
        this.autoSizeAllColumns();
      }, 300);
    };
  }

  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.toastService.success('متن کپی شد');
    }).catch(() => {
      this.toastService.error('خطا در کپی متن');
    });
  }

  public openAssignmentManagement(assignment: any): void {
    this.saveGridState();
    sessionStorage.setItem('editedAssignmentId', assignment.id);
    this.router.navigate(['/resolutions/details', assignment.id]);
  }

  private actionStatusCellRenderer = (params: any): string => {
    const statusId = params.data?.status;
    const status = params.data?.actionStatus;
    if (!statusId || !status) return '<span class="text-muted">-</span>';

    const colors: { [key: number]: string } = {
      [ActionStatus.Pending]: '#f27e63',
      [ActionStatus.InProgress]: '#f0ad4e',
      [ActionStatus.End]: '#5cb85c',
      [ActionStatus.Overdue]: '#d9534f'
    };

    return `<span class="badge-status" style="background-color:${colors[statusId] || 'gray'};">
      ${status}
    </span>`;
  };

  private followStatusCellRenderer = (params: any): string => {
    const statusId = params.data?.followStatusId;
    const status = params.data?.followStatus;
    if (!statusId || !status) return '<span class="text-muted">-</span>';

    const colors: { [key: number]: string } = {
      [ActionFollowStatus.Pending]: '#f27e63',
      [ActionFollowStatus.InProgress]: '#3dd456',
      [ActionFollowStatus.End]: '#5cb85c'
    };

    return `<span class="badge-status" style="background-color:${colors[statusId] || 'gray'};">
      ${status}
    </span>`;
  };
}
