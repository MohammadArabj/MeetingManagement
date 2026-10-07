import {
  Component,
  OnInit,
  AfterViewInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

// AG Grid
import { AgGridAngular } from 'ag-grid-angular';

// Base & Services
import { AgGridBaseComponent } from '../../../shared/ag-grid-base/ag-grid-base';
import { Room } from '../../../core/models/Room';
import { RoomService } from '../../../services/room.service';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { SwalService } from '../../../services/framework-services/swal.service';

// Components
import { ModalConfig } from '../../../shared/modal/modal.config';
import { CustomInputComponent } from "../../../shared/custom-controls/custom-input";
import { LabelButtonComponent } from "../../../shared/custom-buttons/label-button";

declare var bootstrap: any;

@Component({
  selector: 'app-room',
  templateUrl: './room.html',
  styleUrls: ['./room.css'],
  standalone: true,
  imports: [
    CustomInputComponent,
    ReactiveFormsModule,
    LabelButtonComponent,
    AgGridAngular
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomComponent extends AgGridBaseComponent implements OnInit, AfterViewInit {

  // ═══════════════════════════════════════════════════════════
  // Injected Services
  // ═══════════════════════════════════════════════════════════
  private readonly fb = inject(FormBuilder);
  private readonly roomService = inject(RoomService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly swalService = inject(SwalService);

  // ═══════════════════════════════════════════════════════════
  // Signals
  // ═══════════════════════════════════════════════════════════
  readonly records = signal<Room[]>([]);
  readonly loading = signal<boolean>(false);
  readonly selectedRecord = signal<Room | null>(null);
  readonly isEditing = signal<boolean>(false);
  readonly quickFilterText = signal<string>('');
  readonly modalConfig = signal<ModalConfig>(new ModalConfig());
  readonly form = signal<any>(null);

  // ═══════════════════════════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════════════════════════
  readonly hasRecords = computed(() => this.records().length > 0);
  readonly totalRecords = computed(() => this.records()?.length || 0);
  readonly activeRecords = computed(() =>
    this.records()?.filter(r => r.isActive === 1).length || 0
  );

  // ═══════════════════════════════════════════════════════════
  // Modal Instance
  // ═══════════════════════════════════════════════════════════
  private modalInstance: any = null;

  // ═══════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════
  constructor() {
    super();
    this.setupBreadcrumb();
    this.setupModalConfig();
    this.initializeForm();
  }

  private setupBreadcrumb(): void {
    this.breadcrumbService.setItems([
      { label: 'تنظیمات', routerLink: '/settings' },
      { label: 'مکان‌های برگزاری جلسات', routerLink: '/settings/rooms' },
    ]);
  }

  private setupModalConfig(): void {
    const config = this.modalConfig();
    config.size = "large";
    config.modalTitle = "ثبت/ویرایش مکان جلسه";
    this.modalConfig.set(config);
  }

  private initializeForm(): void {
    const formGroup = this.fb.group({
      guid: [''],
      title: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(100)
      ]],
      address: [''],
      capacity: [1, [Validators.required, Validators.min(1)]]
    });

    this.form.set(formGroup);
  }

  // ═══════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    this.setupGridColumns();
    await this.getRecords();
  }

  ngAfterViewInit(): void {
    // اگر نیاز به restore state بود
  }

  // ═══════════════════════════════════════════════════════════
  // Grid Setup
  // ═══════════════════════════════════════════════════════════

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.columnDefs = [
      {
        headerName: 'ردیف',
        valueGetter: 'node.rowIndex + 1',
        width: 70,
        pinned: 'right',
        sortable: false,
        filter: false,
        floatingFilter: false,
        cellStyle: { textAlign: 'center', fontWeight: 'bold', 'font-family': 'Sahel' }
      },
      {
        headerName: 'عنوان',
        field: 'title',
        flex: 2,
        minWidth: 150,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        filterParams: {
          filterOptions: ['contains', 'startsWith'],
          defaultOption: 'contains'
        },
        cellStyle: { fontWeight: '600', 'font-family': 'Sahel' }
      },
      {
        headerName: 'ظرفیت',
        field: 'capacity',
        width: 120,
        filter: 'agNumberColumnFilter',
        floatingFilter: true,
        cellRenderer: this.capacityCellRenderer,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },
      {
        headerName: 'آدرس',
        field: 'address',
        flex: 2,
        minWidth: 200,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        cellRenderer: (params: any) => {
          return params.value
            ? `<span class="text-muted">${params.value}</span>`
            : '<span class="text-muted">--</span>';
        },
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        headerName: 'تاریخ ایجاد',
        field: 'created',
        width: 130,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },
      {
        headerName: 'وضعیت',
        field: 'isActive',
        width: 110,
        filter: 'agSetColumnFilter',
        floatingFilter: true,
        filterParams: {
          values: [1, 0],
          valueFormatter: (params: any) => params.value === 1 ? 'فعال' : 'غیرفعال'
        },
        cellRenderer: this.statusCellRenderer,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },
      {
        headerName: 'عملیات',
        field: 'guid',
        width: 160,
        pinned: 'left',
        sortable: false,
        filter: false,
        floatingFilter: false,
        cellRenderer: this.actionsCellRenderer.bind(this),
        cellStyle: { textAlign: 'center', overflow: 'unset', 'font-family': 'Sahel' }
      }
    ];

    // تنظیمات pagination
    options.pagination = true;
    options.paginationPageSize = 10;
    options.paginationPageSizeSelector = [10, 20, 50, 100];
    options.paginationAutoPageSize = false;
    options.domLayout = 'normal';

    // شناسه یکتا
    options.getRowNodeId = (data: any) => data.guid;

    // تنظیمات ردیف
    options.rowStyle = { cursor: 'pointer' };

    // کلیک روی سلول
    options.onCellClicked = (event: any) => {
      this.onCellClicked(event);
    };

    // پس از آماده شدن گرید
    options.onGridReady = (params: any) => {
      setTimeout(() => {
        this.autoSizeColumns();
      }, 500);
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Cell Renderers
  // ═══════════════════════════════════════════════════════════

  private capacityCellRenderer = (params: any): string => {
    const capacity = params.value || 0;
    let badgeClass = 'bg-primary';

    if (capacity >= 50) {
      badgeClass = 'bg-success';
    } else if (capacity >= 20) {
      badgeClass = 'bg-info';
    } else if (capacity >= 10) {
      badgeClass = 'bg-primary';
    } else {
      badgeClass = 'bg-secondary';
    }

    return `<span class="badge ${badgeClass}" style="font-family: Sahel;">
      <i class="fas fa-users me-1"></i>${capacity} نفر
    </span>`;
  };

  private statusCellRenderer = (params: any): string => {
    const isActive = params.value === 1;
    const badgeClass = isActive ? 'bg-success' : 'bg-danger';
    const text = isActive ? 'فعال' : 'غیرفعال';
    const icon = isActive ? 'fa-check-circle' : 'fa-times-circle';

    return `<span class="badge ${badgeClass}" style="font-family: Sahel;">
      <i class="fas ${icon} me-1"></i>${text}
    </span>`;
  };

  private actionsCellRenderer = (params: any): string => {
    const guid = params.value;
    const isActive = params.data?.isActive === 1;

    let buttons = '';

    if (isActive) {
      buttons = `
        <button class="btn btn-sm btn-primary me-1 action-btn" data-action="edit" data-guid="${guid}" title="ویرایش">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-warning me-1 action-btn" data-action="deactivate" data-guid="${guid}" title="غیرفعال">
          <i class="fas fa-pause"></i>
        </button>
      `;
    } else {
      buttons = `
        <button class="btn btn-sm btn-success me-1 action-btn" data-action="activate" data-guid="${guid}" title="فعال‌سازی">
          <i class="fas fa-play"></i>
        </button>
      `;
    }

    buttons += `
      <button class="btn btn-sm btn-danger action-btn" data-action="delete" data-guid="${guid}" title="حذف">
        <i class="fas fa-trash"></i>
      </button>
    `;

    return `<div class="btn-group btn-group-sm">${buttons}</div>`;
  };

  // ═══════════════════════════════════════════════════════════
  // Grid Events
  // ═══════════════════════════════════════════════════════════

  onCellClicked(event: any): void {
    const target = event.event?.target as HTMLElement;
    const actionBtn = target.closest('.action-btn') as HTMLElement;

    if (!actionBtn) return;

    const action = actionBtn.dataset['action'];
    const guid = actionBtn.dataset['guid'];

    if (!guid) return;

    switch (action) {
      case 'edit':
        this.openEditModal(guid);
        break;
      case 'delete':
        this.askForDelete(guid);
        break;
      case 'activate':
        this.activate(guid);
        break;
      case 'deactivate':
        this.deactivate(guid);
        break;
    }
  }

  onQuickFilterChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.quickFilterText.set(value);
    this.gridApi()?.setGridOption('quickFilterText', value);
  }

  clearFilters(): void {
    this.gridApi()?.setFilterModel(null);
    this.quickFilterText.set('');
    this.gridApi()?.setGridOption('quickFilterText', '');
  }

  exportToExcel(): void {
    this.gridApi()?.exportDataAsExcel({
      fileName: `مکان‌های-جلسه-${new Date().toLocaleDateString('fa-IR')}.xlsx`,
      sheetName: 'مکان‌ها'
    });
  }

  private autoSizeColumns(): void {
    const api = this.gridApi();
    if (!api) return;

    const allColumnIds = api.getColumnDefs()
      ?.map((col: any) => col.field)
      .filter((id: string) => id && id !== 'guid') || [];

    if (allColumnIds.length) {
      api.autoSizeColumns(allColumnIds, true);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Data Operations
  // ═══════════════════════════════════════════════════════════

  private async getRecords(): Promise<void> {
    this.loading.set(true);

    try {
      this.roomService.getList<Room[]>()
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(error => {
            console.error('Error loading rooms:', error);
            this.toastService.error('خطا در بارگذاری مکان‌ها');
            return of([]);
          })
        )
        .subscribe((data: any) => {
          this.records.set(data || []);
          this.loading.set(false);
        });

    } catch (error) {
      console.error('Error in getRecords:', error);
      this.loading.set(false);
    }
  }

  refreshGrid(): void {
    this.getRecords();
    this.toastService.success('لیست به‌روزرسانی شد');
  }

  // ═══════════════════════════════════════════════════════════
  // CRUD Operations
  // ═══════════════════════════════════════════════════════════

  openCreateModal(): void {
    this.isEditing.set(false);
    this.selectedRecord.set(null);
    this.form().reset({ capacity: 1 });

    const config = this.modalConfig();
    config.modalTitle = "ثبت مکان جدید";
    this.modalConfig.set(config);

    this.showModal();
  }

  openEditModal(guid: string): void {
    this.loading.set(true);

    this.roomService.getBy<Room>(guid)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error loading room:', error);
          this.toastService.error('خطا در بارگذاری اطلاعات');
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe((data: any) => {
        if (data) {
          this.isEditing.set(true);
          this.selectedRecord.set(data);

          this.form().patchValue({
            guid: data.guid,
            title: data.title,
            address: data.address,
            capacity: data.capacity
          });

          const config = this.modalConfig();
          config.modalTitle = "ویرایش مکان";
          this.modalConfig.set(config);

          this.showModal();
        }
        this.loading.set(false);
      });
  }

  async askForDelete(guid: string): Promise<void> {
    try {
      const result = await this.swalService.fireSwal('آیا از حذف این مکان اطمینان دارید؟');
      if (result.value === true) {
        this.roomService.delete(guid)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(error => {
              this.toastService.error('خطا در حذف مکان');
              return of(null);
            })
          )
          .subscribe(() => {
            this.toastService.success('مکان با موفقیت حذف شد');
            this.getRecords();
          });
      }
    } catch (error) {
      console.error('Error in delete operation:', error);
    }
  }

  async activate(guid: string): Promise<void> {
    try {
      const result = await this.swalService.fireSwal('آیا از فعال‌سازی این مکان اطمینان دارید؟');
      if (result.value === true) {
        this.roomService.activate(guid)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(() => {
              this.toastService.error('خطا در فعال‌سازی مکان');
              return of(null);
            })
          )
          .subscribe(() => {
            this.toastService.success('مکان با موفقیت فعال شد');
            this.getRecords();
          });
      }
    } catch (error) {
      console.error('Error activating room:', error);
    }
  }

  async deactivate(guid: string): Promise<void> {
    try {
      const result = await this.swalService.fireSwal('آیا از غیرفعال کردن این مکان اطمینان دارید؟');
      if (result.value === true) {
        this.roomService.deactivate(guid)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(() => {
              this.toastService.error('خطا در غیرفعال کردن مکان');
              return of(null);
            })
          )
          .subscribe(() => {
            this.toastService.success('مکان با موفقیت غیرفعال شد');
            this.getRecords();
          });
      }
    } catch (error) {
      console.error('Error deactivating room:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Modal Operations
  // ═══════════════════════════════════════════════════════════

  private showModal(): void {
    const modalEl = document.getElementById('roomModal');
    if (modalEl) {
      this.modalInstance = new bootstrap.Modal(modalEl);
      this.modalInstance.show();
    }
  }

  closeModal(): void {
    if (this.modalInstance) {
      this.modalInstance.hide();
    }
    this.selectedRecord.set(null);
    this.isEditing.set(false);
    this.form().reset({ capacity: 1 });
  }

  submit(): void {
    if (this.form().invalid) {
      this.form().markAllAsTouched();
      this.toastService.warning('لطفاً فیلدهای الزامی را تکمیل کنید');
      return;
    }

    const formValue = this.form().value;

    if (this.isEditing()) {
      this.updateRoom(formValue);
    } else {
      this.createRoom(formValue);
    }
  }

  private createRoom(data: any): void {
    this.roomService.create(data)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          this.toastService.error('خطا در ثبت مکان');
          return of(null);
        })
      )
      .subscribe((result: any) => {
        if (result) {
          this.toastService.success('مکان با موفقیت ثبت شد');
          this.closeModal();
          this.getRecords();
        }
      });
  }

  private updateRoom(data: any): void {
    this.roomService.edit(data)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          this.toastService.error('خطا در ویرایش مکان');
          return of(null);
        })
      )
      .subscribe((result: any) => {
        if (result) {
          this.toastService.success('مکان با موفقیت ویرایش شد');
          this.closeModal();
          this.getRecords();
        }
      });
  }

  // ═══════════════════════════════════════════════════════════
  // Validation Helpers
  // ═══════════════════════════════════════════════════════════

  isFormValid(): boolean {
    return this.form()?.valid ?? false;
  }

  public isFieldInvalid(fieldName: string): boolean {
    const currentForm = this.form();
    if (!currentForm) return false;

    const field = currentForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  public getFieldError(fieldName: string): string {
    const currentForm = this.form();
    if (!currentForm) return '';

    const field = currentForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return `این فیلد الزامی است`;
    if (field.errors['minlength']) return `حداقل ${field.errors['minlength'].requiredLength} کاراکتر وارد کنید`;
    if (field.errors['maxlength']) return `حداکثر ${field.errors['maxlength'].requiredLength} کاراکتر مجاز است`;
    if (field.errors['min']) return `مقدار نمی‌تواند کمتر از ${field.errors['min'].min} باشد`;

    return 'خطا در اعتبارسنجی';
  }
}