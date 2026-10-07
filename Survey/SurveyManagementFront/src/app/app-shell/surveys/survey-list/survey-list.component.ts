import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { catchError, of } from 'rxjs';
import { SurveyOptionsCellComponent } from './survey-options-cell.component';
import { SurveyService, SurveyListDto, SurveySearchRequest } from '../../../services/survey.service';
import { AgGridBaseComponent } from '../../../shared/ag-grid-base/ag-grid-base';
import { ShareLinkModalComponent } from "./share-link-modal/share-link-modal.component";
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';

@Component({
  selector: 'app-survey-list',
  templateUrl: './survey-list.component.html',
  styleUrls: ['./survey-list.component.css'],
  standalone: true,
  imports: [AgGridAngular, ShareLinkModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SurveyListComponent extends AgGridBaseComponent implements OnInit {
  // Injected services
  private readonly surveyService = inject(SurveyService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  readonly router = inject(Router);
  public isPermitted = signal<boolean>(false);
  public canCreate = signal<boolean>(false);
  public canExport = signal<boolean>(false);
  // Signals for reactive state management
  public surveys = signal<SurveyListDto[]>([]);
  public loading = signal<boolean>(false);
  public filterType = signal<string>('All');
  public selectedRowGuid = signal<string | null>(null);
  showShareModal = signal(false);
  selectedSurveyGuid = signal<string>('');

  showShareLinkModal(surveyGuid: string): void {
    this.selectedSurveyGuid.set(surveyGuid);
    this.showShareModal.set(true);
  }

  // ⭐ اضافه کن
  closeShareModal(): void {
    this.showShareModal.set(false);
    this.selectedSurveyGuid.set('');
  }
  // Computed signals
  public hasSurveys = computed(() => this.surveys().length > 0);

  constructor() {
    super();
    this.setupBreadcrumb();
  }

 

  private async checkPermissions(): Promise<void> {
    try {
      const canView = await this.passwordFlowService.checkPermission('SV_Surveys');
      if (!canView) {
        this.toastService.error('شما مجوز مشاهده این صفحه را ندارید');
        return;
      }
      const [create, exportPerm] = await Promise.all([
        this.passwordFlowService.checkPermission('SV_Surveys_Create'),
        this.passwordFlowService.checkPermission('SV_Responses_Export'),
      ]);
      this.canCreate.set(create);
      this.canExport.set(exportPerm);
      this.isPermitted.set(true);
    } catch {
      this.toastService.error('خطا در بررسی مجوزها');
    }
  }

  private setupBreadcrumb(): void {
    // اگر BreadcrumbService دارید اینجا استفاده کنید
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    await this.checkPermissions();
    if (this.isPermitted()) {
      this.setupGridColumns();
      await this.loadSurveys();
    }
  }

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.columnDefs = [
      {
        colId: 'actions',
        headerName: 'عملیات',
        filter: false,
        cellRenderer: SurveyOptionsCellComponent,
        cellStyle: { textAlign: 'center', overflow: 'unset' },
        width: 100,
        maxWidth: 100,
        minWidth: 100
      },
      {
        field: 'title',
        headerName: 'عنوان نظرسنجی',
        filter: 'agTextColumnFilter',
        minWidth: 200
      },
      {
        field: 'description',
        headerName: 'توضیحات',
        filter: 'agTextColumnFilter',
        minWidth: 250
      },
      {
        field: 'startDate',
        headerName: 'تاریخ شروع',
        filter: 'agTextColumnFilter',
        width: 120
      },
      {
        field: 'endDate',
        headerName: 'تاریخ پایان',
        filter: 'agTextColumnFilter',
        width: 120
      },
      {
        field: 'status',
        headerName: 'وضعیت',
        filter: 'agTextColumnFilter',
        cellRenderer: this.statusCellRenderer,
        width: 130
      },
      {
        field: 'accessType',
        headerName: 'نوع دسترسی',
        filter: 'agTextColumnFilter',
        width: 130
      },
      {
        field: 'totalResponses',
        headerName: 'تعداد پاسخ',
        filter: 'agNumberColumnFilter',
        width: 120,
        //type: 'numericColumn'
      },
      {
        field: 'createdBy',
        headerName: 'ایجاد کننده',
        filter: 'agTextColumnFilter',
        width: 150
      },
      {
        field: 'created',
        headerName: 'تاریخ ایجاد',
        filter: 'agTextColumnFilter',
        width: 150
      }
    ];

    // تنظیمات pagination
    options.pagination = true;
    options.paginationPageSize = 20;
    options.domLayout = 'normal';

    // شناسه یکتا برای هر ردیف
    options.getRowNodeId = (data: any) => data.guid;

    // استایل ردیف انتخاب شده
    options.getRowStyle = (params: any) => {
      const guid = sessionStorage.getItem('editedSurveyGuid');
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
    const statusEnum = params.data?.statusEnum;
    const status = params.data?.status;
    if (!statusEnum || !status) return '';

    const colors: { [key: number]: string } = {
      1: '#6c757d', // پیش‌نویس - خاکستری
      2: '#0dcaf0', // فعال - آبی روشن
      3: '#ffc107', // متوقف شده - زرد
      4: '#198754', // بسته شده - سبز
      5: '#dc3545'  // آرشیو - قرمز
    };

    return `<span class="badge" style="background-color: ${colors[statusEnum] || '#6c757d'};color:white;">
              ${status}
            </span>`;
  };

  private setupGridInteractions(options: any): void {
    options.rowStyle = { cursor: 'pointer' };

    options.onCellClicked = (event: any) => {
      if (event.colDef.colId !== 'actions' && event.data) {
        this.saveGridState();
        sessionStorage.setItem('editedSurveyGuid', event.data.guid);
        this.selectedRowGuid.set(event.data.guid);
        this.goToSurveyDetails(event.data.guid);
      }
    };

    options.onGridReady = (params: any) => {
      this.onGridReady(params);
      setTimeout(() => {
        this.highlightSelectedRow();
        this.autoSizeAllColumns();
      }, 500);
    };

    options.onFirstDataRendered = () => {
      setTimeout(() => {
        this.highlightSelectedRow();
        this.autoSizeAllColumns();
      }, 700);
    };

    // ذخیره صفحه فعلی
    options.onPaginationChanged = () => {
      const api = this.gridApi();
      if (!api) return;
      const currentPage = api.paginationGetCurrentPage();
      sessionStorage.setItem('surveyGridPage', currentPage.toString());
    };
  }

  private async loadSurveys(): Promise<void> {
    this.loading.set(true);

    try {
      const searchRequest: SurveySearchRequest = {
        pageNumber: 1,
        pageSize: 1000 // یا هر مقدار دیگری
      };

      this.surveyService.searchSurveys(searchRequest)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(error => {
            console.error('Error loading surveys:', error);
            this.toastService.error('خطا در بارگذاری نظرسنجی‌ها');
            return of([]);
          })
        )
        .subscribe((data: SurveyListDto[]) => {
          this.surveys.set(data);
          this.loading.set(false);

          setTimeout(() => {
            this.highlightSelectedRow();
          }, 700);
        });
    } catch (error) {
      console.error('Error in loadSurveys:', error);
      this.loading.set(false);
    }
  }

  private highlightSelectedRow(): void {
    const api = this.gridApi();
    const guid = sessionStorage.getItem('editedSurveyGuid');

    if (!api || !guid) return;

    api.forEachNode((node: any) => {
      if (node.data?.guid === guid) {
        node.setSelected(true);
        setTimeout(() => {
          api.ensureIndexVisible(node.rowIndex, 'middle');
        }, 100);
      } else {
        node.setSelected(false);
      }
    });
  }

  private saveGridState(): void {
    const api = this.gridApi();
    if (api) {
      const currentPage = api.paginationGetCurrentPage();
      sessionStorage.setItem('surveyGridPage', currentPage.toString());

      const filterModel = api.getFilterModel();
      if (filterModel && Object.keys(filterModel).length > 0) {
        sessionStorage.setItem('surveyGridFilters', JSON.stringify(filterModel));
      }
    }
  }

  // ==================== NAVIGATION ====================
  goToSurveyDetails(surveyGuid: string): void {
    this.saveGridState();
    sessionStorage.setItem('editedSurveyGuid', surveyGuid);
    this.router.navigate(['/surveys/edit', surveyGuid]);
  }

  addNewSurvey(): void {
    this.router.navigate(['/surveys/create']);
  }

  // ==================== CRUD OPERATIONS ====================
  async askForDelete(id: string): Promise<void> {
    try {
      const result = await this.fireDeleteSwal();
      if (result.value === true) {
        this.surveyService.deleteSurvey(id)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(error => {
              this.toastService.error('خطا در حذف نظرسنجی');
              return of(null);
            })
          )
          .subscribe(() => {
            this.fireDeleteSucceededSwal();
            this.loadSurveys();
          });
      }
    } catch (error) {
      console.error('Error in delete operation:', error);
    }
  }

  async changeStatus(surveyGuid: string, action: string): Promise<void> {
    try {
      let observable: any;
      let message = '';

      switch (action) {
        case 'publish':
          observable = this.surveyService.publishSurvey(surveyGuid);
          this.showShareModal.set(true);
          this.selectedSurveyGuid.set(surveyGuid);
          break;
        case 'activate':
          observable = this.surveyService.activateSurvey(surveyGuid);
          break;
        case 'pause':
          observable = this.surveyService.pauseSurvey(surveyGuid);
          break;
        case 'close':
          observable = this.surveyService.closeSurvey(surveyGuid);
          break;
        case 'archive':
          observable = this.surveyService.archiveSurvey(surveyGuid);
          break;
        default:
          return;
      }

      observable
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError((error: any) => {
            this.toastService.error('خطا در تغییر وضعیت نظرسنجی');
            return of(null);
          })
        )
        .subscribe(() => {
          this.loadSurveys();
        });
    } catch (error) {
      console.error('Error changing status:', error);
    }
  }

  viewStatistics(surveyGuid: string): void {
    this.router.navigate(['/surveys/statistics', surveyGuid]);
  }

  viewResponses(surveyGuid: string): void {
    this.router.navigate(['/responses/list', surveyGuid]);
  }
  viewPublishResult(surveyGuid: string): void {
    this.showShareLinkModal(surveyGuid);
  }
  manageQuestions(guid: string): void {
    this.router.navigate(['/questions/list'], {
      queryParams: { surveyGuid: guid }
    });
  }
}
