import {
  AfterViewInit,
  Component,
  OnInit,
  Renderer2,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MeetingOptionsCellComponent } from './meetingOptionsCellComponent';
import { AgGridBaseComponent } from '../../../shared/ag-grid-base/ag-grid-base';
import { POSITION_ID, USER_ID_NAME } from '../../../core/types/configuration';
import { SwalService } from '../../../services/framework-services/swal.service';
import { MeetingService } from '../../../services/meeting.service';
import { AgGridAngular } from 'ag-grid-angular';
import { LabelButtonComponent } from "../../../shared/custom-buttons/label-button";
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';
import { catchError, of } from 'rxjs';
import { AppSettings } from '../../../services/system-setting.service';

declare var Swal: any;

interface MeetingRecord {
  guid: string;
  number: string;
  title: string;
  date: string;
  status: string;
  statusId: number;
  location: string;
  chairman: string;
  secretary: string;
  creator: string;
  roleId: number;
}

interface FilterModel {
  positionGuid: string;
  userGuid: string;
  filterType: string | null;
  canViewAll: boolean;
}

interface GridState {
  page: number;
  filters: any;
  highlightGuid?: string;
}

@Component({
  selector: 'app-meeting-list',
  templateUrl: './meeting-list.html',
  styleUrls: ['./meeting-list.css'],
  standalone: true,
  imports: [AgGridAngular, LabelButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingListComponent extends AgGridBaseComponent implements OnInit, AfterViewInit {
  // Injected services using modern inject()
  private readonly renderer = inject(Renderer2);
  private readonly meetingService = inject(MeetingService);
  readonly router = inject(Router);
  private readonly swalService = inject(SwalService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly route = inject(ActivatedRoute);
  private readonly passwordFlowService = inject(PasswordFlowService);
  public isBoardSecretary = signal<boolean>(false);
  private readonly meetingNoCollator = new Intl.Collator('fa', {
    numeric: true,
    sensitivity: 'base',
  });

  private normalizeDigits(input: any): string {
    let s = (input ?? '').toString().trim();
    s = s.replace(/[۰-۹]/g, (d: string) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    s = s.replace(/[٠-٩]/g, (d: string) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    return s;
  }

  private extractFirstNumber(input: any): number | null {
    const s = this.normalizeDigits(input);
    const m = s.match(/\d+/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }

  private compareMeetingNumber(a: any, b: any): number {
    const sa = this.normalizeDigits(a);
    const sb = this.normalizeDigits(b);
    const na = this.extractFirstNumber(sa);
    const nb = this.extractFirstNumber(sb);
    if (na !== null && nb !== null && na !== nb) return na - nb;
    return this.meetingNoCollator.compare(sa, sb);
  }

  private isBoardMeetingRow(data: any): boolean {
    const rowCat = (data?.categoryGuid || data?.meetingCategoryGuid || '').toString().toLowerCase();
    return rowCat === AppSettings.boardCategoryGuid.toLowerCase();
  }

  private isCurrentPositionBoardSecretary(): boolean {
    const pos = (this.localStorageService.getItem(POSITION_ID) || '').toString().toLowerCase();
    return pos === AppSettings.boardPositionGuid.toLowerCase();
  }

  // Signals for reactive state management
  public records = signal<MeetingRecord[]>([]);
  public isDelegate = signal<boolean>(false);
  public isPermitted = signal<boolean>(false);
  public filterType = signal<string | null>(null);
  public loading = signal<boolean>(false);
  public gridState = signal<GridState>({ page: 0, filters: {} });
  public selectedRowGuid = signal<string | null>(null); // اضافه شد

  // Computed signals
  public hasRecords = computed(() => this.records().length > 0);
  public canViewAllMeetings = signal<boolean>(false);

  constructor() {
    super();
    this.setupBreadcrumb();
    this.setupRouteEffects();
  }

  private setupBreadcrumb(): void {
    this.breadcrumbService.setItems([
      { label: 'جلسات', routerLink: '/meetings/list' },
    ]);
  }

  private setupRouteEffects(): void {
    effect(() => {
      this.route.queryParams
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(params => {
          this.filterType.set(params['filter'] || 'All');
          if (this.isPermitted()) {
            this.getRecords();
          }
        });
    });
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    await this.checkPermissions();
    if (this.isPermitted()) {
      this.setupGridColumns();
      this.isBoardSecretary.set(this.isCurrentPositionBoardSecretary());
    }
  }

  private async checkPermissions(): Promise<void> {
    try {
      const checkPermission = await this.passwordFlowService.checkPermission('MT_Meetings');
      if (!checkPermission) {
        this.toastService.error('شما مجوز مشاهده این صفحه را ندارید');
        return;
      }
      const canViewAll = await this.passwordFlowService.checkPermission('MT_Meetings_ViewAllMeetings');
      this.canViewAllMeetings.set(canViewAll);
      this.isPermitted.set(true);
    } catch (error) {
      console.error('Error checking permissions:', error);
      this.toastService.error('خطا در بررسی مجوزها');
    }
  }

  ngAfterViewInit(): void {
    this.restoreGridState();
  }

  private restoreGridState(): void {
    const pageStr = sessionStorage.getItem('meetingGridPage');
    if (pageStr) {
      const page = parseInt(pageStr, 10);
      setTimeout(() => {
        this.gridApi().paginationGoToPage(page);
      }, 100);
      sessionStorage.removeItem('meetingGridPage');
    }

    // بازگردانی فیلترها
    const savedFilters = sessionStorage.getItem('meetingGridFilters');
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        setTimeout(() => {
          this.gridApi().setFilterModel(filters);
        }, 200); // زمان بیشتر برای اطمینان از آماده بودن گرید
        sessionStorage.removeItem('meetingGridFilters');
      } catch (error) {
        console.error('خطا در بازگردانی فیلترها:', error);
      }
    }

    const editedGuid = sessionStorage.getItem('editedMeetingGuid');
    if (editedGuid) {
      this.gridOptions().getRowStyle = (params: any) => {
        if (params.data?.guid === editedGuid) {
          return {
            backgroundColor: '#ffffcc',
            transition: 'background-color 0.5s ease',
          };
        }
        return null;
      };
    }
  }

  private highlightSelectedRow(): void {
    const api = this.gridApi();
    const guid = sessionStorage.getItem('editedMeetingGuid');

    if (!api || !guid) return;

    api.forEachNode((node: any) => {
      if (node.data?.guid === guid) {
        node.setSelected(true);
        setTimeout(() => {
          api.ensureIndexVisible(node.rowIndex, 'middle');
          api.redrawRows();
        }, 100);
      } else {
        node.setSelected(false);
      }
    });
  }

  public onFirstDataRendered(event: any): void {
    setTimeout(() => {
      this.restoreGridState();
      this.highlightSelectedRow();
      this.autoSizeExceptFixed();
    }, 700);
  }

  override onGridReady(params: any): void {
    super.onGridReady(params);
    setTimeout(() => {
      this.restoreGridState();
      this.highlightSelectedRow();
      this.autoSizeExceptFixed();
    }, 500);
  }

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.columnDefs = [
      {
        field: 'actions',
        headerName: 'عملیات',
        filter: false,
        width: 120,
        minWidth: 120,
        maxWidth: 140,
        flex: 0,
        cellRenderer: MeetingOptionsCellComponent,
        cellStyle: { textAlign: 'center', overflow: 'unset', 'font-family': 'Sahel' }
      },
      {
        field: 'number',
        colId: 'number',
        headerName: 'شماره جلسه',
        filter: 'agTextColumnFilter',
        //sort: 'desc',
      //  comparator: (a: any, b: any) => this.compareMeetingNumber(a, b),

        // ✅ مهم‌ترین بخش
        flex: 0,
        width: 165,
        cellClass: 'col-meeting-number',
        cellStyle: { 'font-family': 'Sahel', direction: 'ltr', textAlign: 'center' }
      },
      {
        field: 'title',
        headerName: 'عنوان جلسه',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' },
      },
      {
        field: 'category',
        headerName: 'دسته بندی',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel',textAlign:'center' },
      },
      {
        field: 'date',
        headerName: 'زمان',
        filter: 'agTextColumnFilter',
        cellStyle: { direction: 'ltr', 'font-family': 'Sahel' }
      },
      {
        headerName: 'وضعیت',
        field: 'status',
        valueGetter: (params: any) => params.data?.status ?? '',
        cellRenderer: this.statusCellRenderer
      },
      {
        field: 'location',
        headerName: 'محل برگزاری',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'chairman',
        headerName: 'رئیس',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'secretary',
        headerName: 'دبیر',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'creator',
        headerName: 'ثبت کننده',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
    ];

    // تنظیمات pagination
    options.pagination = true;
    options.paginationPageSize = 20;
    options.paginationAutoPageSize = false;
    options.domLayout = 'normal';

    // شناسه یکتا برای هر ردیف
    options.getRowNodeId = (data: any) => data.guid;

    // فرمت نمایش شماره صفحات
    options.paginationNumberFormatter = (params: any) => `${params.value + 1}`;

    // ذخیره صفحه فعلی هنگام تغییر صفحه
    options.onPaginationChanged = () => {
      const api = this.gridApi();
      if (!api) return;
      const currentPage = api.paginationGetCurrentPage();
      sessionStorage.setItem('meetingGridPage', currentPage.toString());
    };

    // استایل ردیف انتخاب شده
    options.getRowStyle = (params: any) => {
      const guid = sessionStorage.getItem('editedMeetingGuid');
      if (params.data?.guid === guid) {
        return {
          backgroundColor: '#ffffcc',
          transition: 'background-color 0.5s ease',
          fontWeight: 'bold'
        };
      }
      return null;
    };

    this.setupGridInteractions(options);
  }

  private statusCellRenderer = (params: any): string => {
    const statusId = params.data?.statusId;
    const status = params.data?.status;
    if (!statusId || !status) return '';

    const colors: { [key: number]: string } = {
      1: '#5bc0de',
      2: '#337ab7',
      3: '#fcb612',
      4: '#5cb85c',
      5: 'red',
    };

    return `<span class="badge-status" style="background-color: ${colors[statusId] || 'gray'};">
              ${status}
            </span>`;
  };

  private setupGridInteractions(options: any): void {
    options.rowStyle = { cursor: 'pointer' };

    options.rowClassRules = {
      'clickable-row': () => true,
      'board-meeting-row': (params: any) =>
        this.isBoardSecretary() && this.isBoardMeetingRow(params.data),
    };

    options.onCellClicked = (event: any) => {
      if (event.colDef.field !== 'actions' && event.data) {
        this.saveGridState();
        sessionStorage.setItem('editedMeetingGuid', event.data.guid);
        this.selectedRowGuid.set(event.data.guid);
        this.goToMeetingDetails(event.data.guid);
      }
    };

    options.onGridReady = (params: any) => {
      setTimeout(() => {
        this.highlightSelectedRow();
        this.autoSizeExceptFixed();
      }, 500);
    };
  }
  private autoSizeExceptFixed(): void {
    const api = this.gridApi();
    const columnApi = this.gridApi?.() || api?.getColumnApi?.(); // بسته به Base شما
    if (!columnApi) return;

    const all: string[] = api.getColumnDefs()?.map((col: any) => col.field) || [];

    const ids = all
      .filter((id: string) => id !== 'actions' && id !== 'number'); // ✅ ثابت‌ها حذف

    if (ids.length) {
      columnApi.autoSizeColumns(ids, true);
    }
  }
  private async getRecords(): Promise<void> {
    this.loading.set(true);

    try {
      const positionGuid = this.localStorageService.getItem(POSITION_ID);
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);

      const filterModel: FilterModel = {
        positionGuid,
        userGuid,
        filterType: this.filterType(),
        canViewAll: this.canViewAllMeetings()
      };

      this.meetingService.getMeetings(filterModel)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(error => {
            console.error('Error loading meetings:', error);
            this.toastService.error('خطا در بارگذاری جلسات');
            return of([]);
          })
        )
        .subscribe((data: any) => {
          const boardGuid = AppSettings.boardCategoryGuid.toLowerCase();

          const boards = data
            .filter((x: { categoryGuid: any; }) => (x.categoryGuid || '').toLowerCase() === boardGuid)
            .sort((x: { number: any; }, y: { number: any; }) => this.compareMeetingNumber(y.number, x.number));

          const others = data.filter((x: { categoryGuid: any; }) => (x.categoryGuid || '').toLowerCase() !== boardGuid);

          this.records.set(data);
          this.loading.set(false);

          // هایلایت کردن ردیف انتخاب شده بعد از لود دیتا
          setTimeout(() => {
            this.highlightSelectedRow();
          }, 700);
        });

    } catch (error) {
      console.error('Error in getRecords:', error);
      this.loading.set(false);
    }
  }

  // Navigation methods
  private saveGridState(): void {
    const api = this.gridApi();
    if (api) {
      const currentPage = api.paginationGetCurrentPage();
      sessionStorage.setItem('meetingGridPage', currentPage.toString());

      const filterModel = api.getFilterModel();
      if (filterModel && Object.keys(filterModel).length > 0) {
        sessionStorage.setItem('meetingGridFilters', JSON.stringify(filterModel));
      }
    }
  }

  goToMeetingDetails(meetingGuid: string): void {
    this.saveGridState();
    sessionStorage.setItem('editedMeetingGuid', meetingGuid);
    this.router.navigate(['/meetings/details', meetingGuid]);
  }

  // CRUD operations with improved error handling
  async askForDelete(id: string | number): Promise<void> {
    try {
      const result = await this.swalService.fireSwal('آیا از حذف این جلسه اطمینان دارید؟');
      if (result.value === true) {
        this.meetingService.delete(id)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(error => {
              this.toastService.error('خطا در حذف جلسه');
              return of(null);
            })
          )
          .subscribe(() => {
            this.getRecords();
          });
      }
    } catch (error) {
      console.error('Error in delete operation:', error);
    }
  }



  async changeStatus(meetingGuid: string, status: number): Promise<void> {
    try {
      const result = await this.swalService.fireSwal('آیا از انجام عملیات اطمینان دارید؟');
      if (result.value === true) {
        this.meetingService.changeStatus(meetingGuid, status)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(() => {
              this.toastService.error('خطا در تغییر وضعیت جلسه.');
              return of(null);
            })
          )
          .subscribe(() => {
            this.getRecords();
          });
      }
    } catch (error) {
      console.error('Error changing status:', error);
    }
  }

  // Navigation methods
  addNewMeeting(): void {
    this.router.navigateByUrl('/meetings/create');
  }

  clone(guid: string): void {
    this.router.navigate([`/meetings/clone/${guid}`]);
  }

  viewMeetingDetails(id: string, roleId: number, statusId: number): void {
    this.router.navigate([`/meetings/details/${id}`], {
      state: { roleId, statusId }
    });
  }
}
