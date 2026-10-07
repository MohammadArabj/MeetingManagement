import { AfterViewInit, Component, inject, OnInit, Renderer2, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ResolutionService } from '../../../services/resolution.service';
import { UserService } from '../../../services/user.service';
import { AgGridBaseComponent } from '../../../shared/ag-grid-base/ag-grid-base';
import { SystemUser } from '../../../core/models/User';
import { getClientSettings } from '../../../services/framework-services/code-flow.service';
import { ComboBase } from '../../../shared/combo-base';
import { base64ToArrayBuffer, normalizePersian, POSITION_ID, USER_ID_NAME } from '../../../core/types/configuration';
import { SearchResolutionSearchOptionsCellComponent } from './search-resolution-optionscell';
import { CustomSelectComponent } from '../../../shared/custom-controls/custom-select';
import { CustomInputComponent } from '../../../shared/custom-controls/custom-input';
import { AgGridAngular } from 'ag-grid-angular';
import { Router } from '@angular/router';
import { Collapse, Modal } from 'bootstrap';
import { GridState } from 'ag-grid-enterprise';
import { firstValueFrom } from 'rxjs';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { MeetingService } from '../../../services/meeting.service';
import { environment } from '../../../../environments/environment';
import { FileMeetingService } from '../../../services/file-meeting.service';
import { FileItem } from '../../../core/models/file';
import { TusUploadService } from '../../../services/framework-services/tus-upload.service';
import { AppSettings } from '../../../services/system-setting.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { MeetingPrintService } from '../../../services/meeting-print.service';
import { Resolution } from '../../../core/models/Resolution';

@Component({
  selector: 'app-resolution-search',
  standalone: true,
  imports: [ReactiveFormsModule, CustomSelectComponent, CustomInputComponent, AgGridAngular, HasPermissionDirective],
  templateUrl: './resolution-search.html',
  styleUrls: ['./resolution-search.css']
})
export class ResolutionSearchComponent extends AgGridBaseComponent implements OnInit, AfterViewInit {
  // Injected services
  private readonly tusUploadService = inject(TusUploadService);
  private readonly resolutionService = inject(ResolutionService);
  private readonly userService = inject(UserService);
  private readonly meetingService = inject(MeetingService);
  private readonly fileMeetingService = inject(FileMeetingService);
  readonly router = inject(Router);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly printService = inject(MeetingPrintService);
  // Enhanced signals for reactive state management
  public records = signal<any[]>([]);
  public users = signal<SystemUser[]>([]);
  public userList = signal<ComboBase[]>([]);
  public loading = signal<boolean>(false);
  public isSearchEmpty = signal<boolean>(false);
  public gridState = signal<GridState>({ filter: {} });
  public isCollapsed = signal<boolean>(false);

  // Slider modal signals
  public showSlider = signal<boolean>(false);
  public currentResolution = signal<any>(null);
  public currentIndex = signal<number>(0);

  // Quick Preview Tooltip signals
  public showQuickPreview = signal<boolean>(false);
  public previewResolution = signal<any>(null);
  public tooltipPosition = signal<{ top: number, left: number }>({ top: 0, left: 0 });
  private previewTimeout: any;

  // Constants for sessionStorage keys
  private readonly SEARCH_FORM_KEY = 'resolutionSearchForm';
  private readonly SEARCH_RESULTS_KEY = 'resolutionSearchResults';
  private readonly COLLAPSE_STATE_KEY = 'resolutionSearchCollapsed';

  modalInstance: any;

  // Enhanced form group
  public form = signal<FormGroup>(
    new FormGroup({
      text: new FormControl(''),
      meetingTitle: new FormControl(''),
      meetingNumber: new FormControl(''),
      followerGuid: new FormControl(''),
      actorGuid: new FormControl(''),
      assignmentType: new FormControl(null),
      approvalStatus: new FormControl(null),
      actionStatus: new FormControl(null),
      title: new FormControl(''),
      decisions: new FormControl(''),
      description: new FormControl(''),
      resolutionNumber: new FormControl(''),
      resolutionDate: new FormControl(''),
      meetingDateFrom: new FormControl(''),
      meetingDateTo: new FormControl(''),
      documents: new FormControl(''),
    })
  );

  constructor() {
    super();
    this.setupBreadcrumb();
    this.setupKeyboardNavigation();
  }

  private setupBreadcrumb(): void {
    this.breadcrumbService.setItems([
      { label: 'جستجوی مصوبات', routerLink: '/resolutions/search' },
    ]);
  }

  private setupKeyboardNavigation(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.showSlider()) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.previousResolution();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.nextResolution();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.closeSlider();
        }
      }
    });
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    await this.loadUsers();
    this.setupEnhancedGridColumns();
    this.restoreSearchState();
  }

  ngAfterViewInit(): void {
    this.restoreGridState();
  }

  private restoreSearchState(): void {
    try {
      const savedFormData = sessionStorage.getItem(this.SEARCH_FORM_KEY);
      if (savedFormData) {
        const formData = JSON.parse(savedFormData);
        this.form().patchValue(formData);
      }

      const savedResults = sessionStorage.getItem(this.SEARCH_RESULTS_KEY);
      if (savedResults) {
        const results = JSON.parse(savedResults);
        this.records.set(results);
        this.isSearchEmpty.set(results.length === 0);
      }

      const savedCollapseState = sessionStorage.getItem(this.COLLAPSE_STATE_KEY);
      if (savedCollapseState) {
        this.isCollapsed.set(JSON.parse(savedCollapseState));
      }
    } catch (error) {
      console.error('Error restoring search state:', error);
    }
  }

  private saveSearchState(): void {
    try {
      sessionStorage.setItem(this.SEARCH_FORM_KEY, JSON.stringify(this.form().value));
      sessionStorage.setItem(this.SEARCH_RESULTS_KEY, JSON.stringify(this.records()));
      sessionStorage.setItem(this.COLLAPSE_STATE_KEY, JSON.stringify(this.isCollapsed()));
    } catch (error) {
      console.error('Error saving search state:', error);
    }
  }

  private restoreGridState(): void {
    const pageStr = sessionStorage.getItem('resolutionGridPage');
    if (pageStr) {
      const page = parseInt(pageStr, 10);
      setTimeout(() => {
        const api = this.gridApi();
        api?.paginationGoToPage(page);
      }, 100);
      sessionStorage.removeItem('resolutionGridPage');
    }

    const savedFilters = sessionStorage.getItem('resolutionGridFilters');
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        setTimeout(() => {
          const api = this.gridApi();
          api?.setFilterModel(filters);
        }, 200);
        sessionStorage.removeItem('resolutionGridFilters');
      } catch (error) {
        console.error('خطا در بازگردانی فیلترها:', error);
      }
    }
  }

  private async loadUsers(): Promise<void> {
    try {
      const clientId = getClientSettings().client_id ?? "";
      const data = await firstValueFrom(
        this.userService.getAllByClientId<SystemUser[]>(clientId)
      );

      this.users.set(data);
      this.userList.set(data.map(user => ({
        guid: user.guid,
        title: user.name,
      })));
    } catch (error) {
      console.error('Error loading users:', error);
      this.toastService.error('خطا در بارگذاری لیست کاربران');
    }
  }

  private setupEnhancedGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.columnDefs = [
      {
        colId: 'actions',
        headerName: 'عملیات',
        width: 120,
        maxWidth: 140,
        minWidth: 100,
        cellRenderer: SearchResolutionSearchOptionsCellComponent,
        cellStyle: {
          textAlign: 'center',
          overflow: 'unset',
          'font-family': 'Sahel',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      },
      {
        field: 'meetingNumber',
        headerName: 'شماره جلسه',
        filter: 'agTextColumnFilter',
        width: 130,
        maxWidth: 150,
        minWidth: 110,
        cellStyle: { 'font-family': 'Sahel' },
        cellClass: 'text-center'
      },
      {
        field: 'meetingDate',
        headerName: 'تاریخ جلسه',
        filter: 'agTextColumnFilter',
        width: 120,
        maxWidth: 140,
        minWidth: 100,
        cellStyle: { 'font-family': 'Sahel', direction: 'ltr' },
        cellClass: 'text-center'
      },
      {
        field: 'resolutionNumber',
        headerName: 'شماره مصوبه',
        filter: 'agTextColumnFilter',
        width: 130,
        maxWidth: 150,
        minWidth: 110,
        cellStyle: { 'font-family': 'Sahel', fontWeight: 'bold', color: '#4f46e5' },
        cellClass: 'text-center'
      },

      {
        field: 'title',
        headerName: 'عنوان',
        filter: 'agTextColumnFilter',
        width: 300,
        maxWidth: 350,
        minWidth: 250,
        cellStyle: { 'font-family': 'Sahel', fontWeight: '500' },
        cellRenderer: (params: any) => {
          if (params.value && params.value.length > 50) {
            return `<span title="${params.value}">${params.value.substring(0, 50)}...</span>`;
          }
          return params.value;
        }
      },
      {
        field: 'decisions',
        headerName: 'تصمیمات متخذه',
        filter: 'agTextColumnFilter',
        width: 250,
        maxWidth: 300,
        minWidth: 200,
        cellStyle: { 'font-family': 'Sahel' },
        cellRenderer: (params: any) => {
          if (params.value && params.value.length > 40) {
            return `<span title="${params.value}">${params.value.substring(0, 40)}...</span>`;
          }
          return params.value;
        }
      },
      {
        field: 'description',
        headerName: 'توضیحات',
        filter: 'agTextColumnFilter',
        width: 200,
        maxWidth: 250,
        minWidth: 150,
        cellStyle: { 'font-family': 'Sahel', color: '#6b7280' }
      },

      {
        field: 'documents',
        headerName: 'سوابق و مستندات',
        filter: 'agTextColumnFilter',
        width: 180,
        maxWidth: 220,
        minWidth: 150,
        cellStyle: { 'font-family': 'Sahel' },
        cellRenderer: (params: any) => {
          if (params.value) {
            return `<i class="fas fa-paperclip text-success me-1"></i>${params.value}`;
          }
          return '<span class="text-muted">ندارد</span>';
        }
      },
      {
        field: 'meetingTitle',
        headerName: 'عنوان جلسه',
        filter: 'agTextColumnFilter',
        width: 250,
        maxWidth: 300,
        minWidth: 200,
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'resolutionDate',
        headerName: 'تاریخ سررسید',
        filter: 'agTextColumnFilter',
        width: 120,
        maxWidth: 140,
        minWidth: 100,
        cellStyle: { 'font-family': 'Sahel', direction: 'ltr' },
        cellClass: 'text-center'
      },

    ];
    options.pagination = true;
    options.paginationPageSize = 20; // تعداد ردیف در هر صفحه — میتوانید مقدار را تغییر دهید یا از تنظیمات کاربر بگیرید
    options.paginationAutoPageSize = false;
    options.domLayout = 'normal';
    this.setupGridInteractions(options);
  }

  private setupGridInteractions(options: any): void {
    options.rowStyle = { cursor: 'pointer' };
    options.rowClassRules = {
      'clickable-row': (params: any) => true,
      'high-priority-row': (params: any) => params.data?.priority === 'High' || params.data?.priority === 'Critical',
      'completed-row': (params: any) => params.data?.actionStatus === 'Completed'
    };

    options.getRowStyle = (params: any) => {
      if (params.data?.priority === 'Critical') {
        return { backgroundColor: 'rgba(239, 68, 68, 0.05)', borderLeft: '3px solid #ef4444' };
      }
      if (params.data?.priority === 'High') {
        return { backgroundColor: 'rgba(245, 158, 11, 0.05)', borderLeft: '3px solid #f59e0b' };
      }
      if (params.data?.actionStatus === 'Completed') {
        return { backgroundColor: 'rgba(16, 185, 129, 0.05)', borderLeft: '3px solid #10b981' };
      }
      return null;
    };

    // استفاده از onCellMouseOver به جای onRowMouseEnter
    options.onCellMouseOver = (event: any) => {
      if (event.data && !this.showSlider()) {
        clearTimeout(this.previewTimeout);
        this.previewTimeout = setTimeout(() => {
          this.showQuickPreviewTooltip(event);
        }, 500);
      }
    };

    // استفاده از onCellMouseOut به جای onRowMouseLeave
    options.onCellMouseOut = () => {
      clearTimeout(this.previewTimeout);
      this.hideQuickPreviewTooltip();
    };
  }

  private showQuickPreviewTooltip(event: any): void {
    if (!event.data || this.showSlider()) return;

    this.previewResolution.set(event.data);

    // Calculate tooltip position
    const mouseEvent = event.event as MouseEvent;
    const tooltipWidth = 400;
    const tooltipHeight = 250;
    const padding = 20;

    let top = mouseEvent.clientY + 10;
    let left = mouseEvent.clientX + 10;

    // Adjust if tooltip goes off screen
    if (left + tooltipWidth > window.innerWidth) {
      left = mouseEvent.clientX - tooltipWidth - 10;
    }

    if (top + tooltipHeight > window.innerHeight) {
      top = mouseEvent.clientY - tooltipHeight - 10;
    }

    this.tooltipPosition.set({ top, left });
    this.showQuickPreview.set(true);
  }

  private hideQuickPreviewTooltip(): void {
    this.showQuickPreview.set(false);
    setTimeout(() => {
      this.previewResolution.set(null);
    }, 300);
  }

  public onRowClicked(event: any): void {
    // بررسی می‌کنیم که آیا روی ستون عملیات کلیک شده یا خیر
    const isActionsColumn = event.column?.colId === 'actions';

    // اگر روی دکمه، منوی dropdown یا ستون عملیات کلیک شده، هیچ کاری نکن
    if (event.data &&
      !event.event.target.closest('button') &&
      !event.event.target.closest('.dropdown-menu') &&
      !event.event.target.closest('.dropdown') &&
      !isActionsColumn) {

      // Hide quick preview when opening slider
      this.hideQuickPreviewTooltip();

      const clickedIndex = this.records().findIndex(r => r.id === event.data.id);
      if (clickedIndex !== -1) {
        this.openSlider(clickedIndex);
      }
    }
  }

  public openSlider(index: number): void {
    // Hide quick preview
    this.hideQuickPreviewTooltip();

    this.currentIndex.set(index);
    this.currentResolution.set(this.records()[index]);
    this.showSlider.set(true);
    document.body.style.overflow = 'hidden';
  }

  public closeSlider(): void {
    this.showSlider.set(false);
    this.currentResolution.set(null);
    document.body.style.overflow = '';
  }

  public closeSliderOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeSlider();
    }
  }

  public nextResolution(): void {
    const nextIndex = this.currentIndex() + 1;
    if (nextIndex < this.records().length) {
      this.currentIndex.set(nextIndex);
      this.currentResolution.set(this.records()[nextIndex]);

      // Add smooth transition animation
      const sliderBody = document.querySelector('.slider-body');
      if (sliderBody) {
        sliderBody.scrollTop = 0;
        sliderBody.classList.add('slide-transition');
        setTimeout(() => sliderBody.classList.remove('slide-transition'), 300);
      }
    }
  }

  public previousResolution(): void {
    const prevIndex = this.currentIndex() - 1;
    if (prevIndex >= 0) {
      this.currentIndex.set(prevIndex);
      this.currentResolution.set(this.records()[prevIndex]);

      // Add smooth transition animation
      const sliderBody = document.querySelector('.slider-body');
      if (sliderBody) {
        sliderBody.scrollTop = 0;
        sliderBody.classList.add('slide-transition');
        setTimeout(() => sliderBody.classList.remove('slide-transition'), 300);
      }
    }
  }

  public toggleCollapse(): void {
    this.isCollapsed.update(v => !v);
    this.saveSearchState();
  }

  public onQuickFilter(event: any): void {
    const api = this.gridApi();
    if (api) {
      this.gridApi()?.setGridOption('quickFilterText', event.target.value);
    }
  }

  public async search(): Promise<void> {
    const formValue = this.form().value;
    const hasSearchCriteria = Object.values(formValue).some(value =>
      value !== null && value !== undefined && value !== ''
    );

    this.loading.set(true);

    try {
      const searchData = Object.fromEntries(
        Object.entries(formValue).map(([key, value]) => [
          key,
          typeof value === 'string' ? normalizePersian(value) : value
        ])
      ); const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      const positionGuid = this.localStorageService.getItem(POSITION_ID);

      const searchModel = {
        ...searchData,
        userGuid: userGuid,
        positionGuid: positionGuid
      };

      const response = await firstValueFrom(
        this.resolutionService.searchResolution(searchModel)
      );

      this.isSearchEmpty.set(response.length === 0);
      this.records.set(response);

      this.saveSearchState();
    } catch (error) {
      console.error('Error in search:', error);
      this.toastService.error('خطا در انجام جستجو');
    } finally {
      this.loading.set(false);
    }
  }

  public clearForm(): void {
    this.form().reset();
    this.records.set([]);
    this.isSearchEmpty.set(false);

    sessionStorage.removeItem(this.SEARCH_FORM_KEY);
    sessionStorage.removeItem(this.SEARCH_RESULTS_KEY);
    sessionStorage.removeItem(this.COLLAPSE_STATE_KEY);
  }

  saveGridState(): void {
    const api = this.gridApi();
    if (api) {
      const currentPage = api.paginationGetCurrentPage();
      sessionStorage.setItem('resolutionGridPage', currentPage.toString());

      const filterModel = api.getFilterModel();
      if (filterModel && Object.keys(filterModel).length > 0) {
        sessionStorage.setItem('resolutionGridFilters', JSON.stringify(filterModel));
      }

      const columnState = api.getColumnState();
      sessionStorage.setItem('resolutionGridColumns', JSON.stringify(columnState));
    }
  }

  viewMeeting(meetingGuid: string): void {
    this.saveGridState();
    this.saveSearchState();
    this.closeSlider();
    this.router.navigate([`/meetings/details/${meetingGuid}`]);
  }

  /** چاپ مصوبه‌ی جلسه‌ی عادی با قالب «resolution» (مصوبات هیئت مدیره به‌صورت PDF نمایش داده می‌شوند) */
  private printResolution(resolution: any, meeting: any, index: number): void {
    this.printService.printSingle({ resolution, meeting, index, isBoardMeeting: false });
  }

  exportToExcel(): void {
    const api = this.gridApi();
    if (api) {
      api.exportDataAsExcel({
        fileName: `مصوبات_${new Date().toISOString().split('T')[0]}.xlsx`,
        sheetName: 'مصوبات'
      });
      this.toastService.success('فایل اکسل با موفقیت دانلود شد');
    }
  }

  printResults(): void {
    const api = this.gridApi();
    if (api) {
      window.print();
    }
  }

  override onGridReady(params: any): void {
    super.onGridReady(params);

    const savedColumns = sessionStorage.getItem('resolutionGridColumns');
    if (savedColumns) {
      try {
        const columnState = JSON.parse(savedColumns);
        params.api.applyColumnState({ state: columnState });
      } catch (error) {
        console.error('Error restoring column state:', error);
      }
    }

    this.autoSizeAllColumns();
  }

  public _selectedResolutionFiles = signal<Map<number, FileItem[]>>(new Map());
  public _loadingFiles = signal<Set<number>>(new Set());

  // متد viewResolution را به این صورت تغییر دهید:
  async viewResolution(resolutionId: string): Promise<void> {
    try {
      const resolution = this.records().find(r => r.id === resolutionId);
      if (!resolution) {
        this.toastService.error('مصوبه یافت نشد');
        return;
      }

      const positionGuid = this.localStorageService.getItem(POSITION_ID);
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);

      const meeting = await firstValueFrom(
        this.meetingService.getUserMeeting(resolution.meetingGuid, userGuid, positionGuid, false)
      ) as any;

      if (!meeting) {
        this.toastService.error('اطلاعات جلسه یافت نشد');
        return;
      }

      const isBoardMeeting = meeting.categoryGuid === AppSettings.boardCategoryGuid;

      if (isBoardMeeting) {
        // برای جلسات هیئت مدیره، فایل‌های PDF را بارگذاری و نمایش دهید
        await this.viewBoardResolutionPDF(resolution);
      } else {
        // برای جلسات عادی، چاپ HTML
        const index = this.records().findIndex(r => r.id === resolutionId);
        this.printResolution(resolution, meeting, index);
      }
    } catch (error) {
      console.error('Error viewing resolution:', error);
      this.toastService.error('خطا در نمایش مصوبه');
    }
  }


  // در صورت نیاز به نمایش پیش‌نمایش PDF در modal (اختیاری):
  async showPDFPreviewInModal(resolution: any): Promise<void> {
    try {
      const files = await firstValueFrom(
        this.fileMeetingService.getFiles(resolution.id, 'Resolution')
      ) as FileItem[];

      const pdfFiles = files.filter((file: any) =>
        file.contentType === 'application/pdf' ||
        file.fileName?.toLowerCase().endsWith('.pdf')
      );

      if (pdfFiles.length === 0) {
        this.toastService.warning('فایل PDF موجود نیست');
        return;
      }

      const selectedFile = pdfFiles[0];
      const blob = new Blob([base64ToArrayBuffer(selectedFile.details?.file)], {
        type: 'application/pdf'
      });
      const fileUrl = URL.createObjectURL(blob);

      // نمایش PDF در iframe داخل modal
      const modalHtml = `
      <div class="modal fade" id="pdfPreviewModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-xl modal-dialog-centered">
          <div class="modal-content" style="height: 90vh;">
            <div class="modal-header">
              <h5 class="modal-title">پیش‌نمایش PDF - ${resolution.title || 'مصوبه'}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-0">
              <iframe src="${fileUrl}" style="width: 100%; height: 100%; border: none;"></iframe>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-primary" onclick="window.open('${fileUrl}', '_blank')">
                <i class="fas fa-external-link-alt me-2"></i>باز کردن در تب جدید
              </button>
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">بستن</button>
            </div>
          </div>
        </div>
      </div>
    `;

      const modalElement = document.createElement('div');
      modalElement.innerHTML = modalHtml;
      document.body.appendChild(modalElement.firstElementChild as HTMLElement);

      const modal = new Modal(document.getElementById('pdfPreviewModal')!);
      modal.show();

      document.getElementById('pdfPreviewModal')?.addEventListener('hidden.bs.modal', () => {
        setTimeout(() => {
          URL.revokeObjectURL(fileUrl);
          document.getElementById('pdfPreviewModal')?.remove();
        }, 300);
      });

    } catch (error) {
      console.error('Error showing PDF preview:', error);
      this.toastService.error('خطا در نمایش پیش‌نمایش PDF');
    }
  }
  private async showFileSelectionModal(files: any[]): Promise<any> {
    return new Promise((resolve) => {
      // ایجاد modal با Bootstrap
      const modalHtml = `
      <div class="modal fade" id="fileSelectionModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">انتخاب فایل PDF</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="mb-3">چند فایل PDF برای این مصوبه موجود است. لطفاً یکی را انتخاب کنید:</p>
              <div class="list-group" id="fileList">
                ${files.map((file, index) => `
                  <button type="button" class="list-group-item list-group-item-action" data-index="${index}">
                    <i class="fas fa-file-pdf text-danger me-2"></i>
                    ${file.fileName || `فایل ${index + 1}`}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

      const modalElement = document.createElement('div');
      modalElement.innerHTML = modalHtml;
      document.body.appendChild(modalElement.firstElementChild as HTMLElement);

      const modal = new Modal(document.getElementById('fileSelectionModal')!);
      modal.show();

      document.getElementById('fileList')?.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button[data-index]') as HTMLButtonElement;
        if (button) {
          const index = parseInt(button.dataset['index'] || '0');
          modal.hide();
          setTimeout(() => {
            document.getElementById('fileSelectionModal')?.remove();
            resolve(files[index]);
          }, 300);
        }
      });

      document.getElementById('fileSelectionModal')?.addEventListener('hidden.bs.modal', () => {
        setTimeout(() => {
          document.getElementById('fileSelectionModal')?.remove();
          resolve(files[0]); // اگر کاربر بدون انتخاب بسته باشد
        }, 300);
      });
    });
  }

  // متد helper برای لاگ اطلاعات دیباگ
  private logFileDebugInfo(files: any, stage: string): void {
    console.group(`🔍 Debug Info - ${stage}`);
    console.log('Raw response:', files);
    console.log('Is Array:', Array.isArray(files));
    console.log('Type:', typeof files);

    if (files) {
      if (Array.isArray(files)) {
        console.log('Length:', files.length);
        files.forEach((file, index) => {
          console.log(`File ${index}:`, {
            fileName: file?.fileName,
            contentType: file?.contentType,
            mimeType: file?.mimeType,
            hasContent: !!(file?.file || file?.content || file?.data),
            size: file?.size
          });
        });
      } else if (typeof files === 'object') {
        console.log('Object keys:', Object.keys(files));
        console.log('Object values:', Object.values(files));
      }
    }
    console.groupEnd();
  }

  // متد helper برای بررسی خالی بودن response
  private isEmptyResponse(data: any): boolean {
    if (!data) return true;
    if (Array.isArray(data)) return data.length === 0;
    if (typeof data === 'object') return Object.keys(data).length === 0;
    return false;
  }

  // متد helper برای تبدیل response به آرایه
  private normalizeFilesResponse(files: any): any[] {
    if (this.isEmptyResponse(files)) return [];

    let filesArray: any[] = Array.isArray(files) ? files : [files];

    // فیلتر کردن آیتم‌های خالی و نامعتبر
    return filesArray.filter(file =>
      file &&
      file.fileName &&
      (file.file || file.content || file.data)
    );
  }

  // متد helper برای فیلتر فایل‌های PDF
  private filterPDFFiles(files: any[]): any[] {
    return files.filter((file: any) =>
      file.contentType === 'application/pdf' ||
      file.mimeType === 'application/pdf' ||
      file.fileName?.toLowerCase().endsWith('.pdf')
    );
  }

  private isPdfMeta(meta: any): boolean {
    const ct = (meta?.contentType ?? meta?.mimeType ?? '').toString().toLowerCase();
    const name =
      (meta?.originalFileName ?? meta?.fileName ?? meta?.name ?? '').toString().toLowerCase();

    if (ct === 'application/pdf') return true;
    if (name.endsWith('.pdf')) return true;

    return false;
  }
  private extractFileGuids(files: any): string[] {
    if (!files) return [];

    const arr = Array.isArray(files) ? files : [files];

    return arr
      .map((x: any) => (x?.fileGuid ?? x?.guid ?? x?.fileGUID ?? '').toString())
      .map((g: string) => g.trim())
      .filter((g: string) => g && g !== '00000000-0000-0000-0000-000000000000');
  }

  private async getResolutionPdfCandidates(resolutionId: number): Promise<Array<{ guid: string; name: string; url: string }>> {
    const files = await firstValueFrom(this.fileMeetingService.getFiles(resolutionId, 'Resolution'));
    const guids = this.extractFileGuids(files);

    if (guids.length === 0) return [];

    const metas = await this.tusUploadService.getMetas(guids);

    const candidates = (metas || [])
      .filter((m: any) => m?.guid && m?.path) // بدون path عملاً لینک نداریم
      .map((m: any) => {
        const name = m.originalFileName || m.fileName || m.name || 'فایل';
        const url = this.tusUploadService.buildFileUrl(m.path);
        return { guid: m.guid, name, url };
      })
      .filter((x: any) => this.isPdfMeta({ ...x, originalFileName: x.name })); // PDF

    // اگر contentType نیامد ولی فایل‌ها PDF بودند و isPdfMeta رد کرد، می‌تونی این فیلتر را برداری
    return candidates;
  }

  private async viewBoardResolutionPDF(resolution: any): Promise<void> {
    try {
      this._loadingFiles.update(set => {
        const s = new Set(set);
        s.add(resolution.id);
        return s;
      });

      const candidates = await this.getResolutionPdfCandidates(resolution.id);

      if (candidates.length === 0) {
        this.toastService.warning('فایل PDF برای این مصوبه وجود ندارد');
        return;
      }

      let selected = candidates[0];
      if (candidates.length > 1) {
        selected = await this.showFileSelectionModalFromMetas(candidates);
      }

      const newWindow = window.open(selected.url, '_blank', 'width=1200,height=800');
      if (!newWindow) {
        this.toastService.error('لطفاً popup blocker را غیرفعال کنید');
        return;
      }

      // اگر هدف چاپ است:
      this.toastService.success('PDF باز شد. برای چاپ از Ctrl+P استفاده کنید');
    } catch (error) {
      console.error('Error loading PDF via metas:', error);
      this.toastService.error('خطا در بارگذاری فایل PDF');
    } finally {
      this._loadingFiles.update(set => {
        const s = new Set(set);
        s.delete(resolution.id);
        return s;
      });
    }
  }
  private async showFileSelectionModalFromMetas(
    files: Array<{ guid: string; name: string; url: string }>
  ): Promise<{ guid: string; name: string; url: string }> {
    return new Promise((resolve) => {
      const modalHtml = `
      <div class="modal fade" id="fileSelectionModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">انتخاب فایل PDF</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="mb-3">چند فایل PDF موجود است، یکی را انتخاب کنید:</p>
              <div class="list-group" id="fileList">
                ${files.map((f, i) => `
                  <button type="button" class="list-group-item list-group-item-action" data-index="${i}">
                    <i class="fas fa-file-pdf text-danger me-2"></i>
                    ${f.name}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

      const wrapper = document.createElement('div');
      wrapper.innerHTML = modalHtml;
      document.body.appendChild(wrapper.firstElementChild as HTMLElement);

      const modal = new Modal(document.getElementById('fileSelectionModal')!);
      modal.show();

      document.getElementById('fileList')?.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const btn = target.closest('button[data-index]') as HTMLButtonElement;
        if (!btn) return;

        const idx = parseInt(btn.dataset['index'] || '0', 10);
        modal.hide();

        setTimeout(() => {
          document.getElementById('fileSelectionModal')?.remove();
          resolve(files[idx] ?? files[0]);
        }, 300);
      });

      document.getElementById('fileSelectionModal')?.addEventListener('hidden.bs.modal', () => {
        setTimeout(() => {
          document.getElementById('fileSelectionModal')?.remove();
          resolve(files[0]);
        }, 300);
      });
    });
  }

}
