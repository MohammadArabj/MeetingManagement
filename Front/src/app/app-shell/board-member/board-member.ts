import {
  Component,
  OnInit,
  AfterViewInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  ElementRef,
  viewChild
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

// AG Grid
import { AgGridAngular } from 'ag-grid-angular';

// Base & Services
import { AgGridBaseComponent } from '../../shared/ag-grid-base/ag-grid-base';
import { BoardMember } from '../../core/models/BoardMember';
import { BoardMemberService } from '../../services/board-member.service';
import { FileService } from '../../services/file.service';
import { BreadcrumbService } from '../../services/framework-services/breadcrumb.service';
import { SwalService } from '../../services/framework-services/swal.service';
import { TusUploadService, UploadStatus } from '../../services/framework-services/tus-upload.service';

// Components
import { ModalConfig } from '../../shared/modal/modal.config';
import { CustomInputComponent } from '../../shared/custom-controls/custom-input';
import { LabelButtonComponent } from '../../shared/custom-buttons/label-button';

declare var bootstrap: any;

@Component({
  selector: 'app-board-member',
  templateUrl: './board-member.html',
  styleUrls: ['./board-member.css'],
  standalone: true,
  imports: [
    LabelButtonComponent,
    CustomInputComponent,
    ReactiveFormsModule,
    AgGridAngular
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoardMemberComponent extends AgGridBaseComponent implements OnInit, AfterViewInit {

  // ═══════════════════════════════════════════════════════════
  // ViewChild
  // ═══════════════════════════════════════════════════════════
  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  // ═══════════════════════════════════════════════════════════
  // Injected Services
  // ═══════════════════════════════════════════════════════════
  private readonly fb = inject(FormBuilder);
  private readonly boardMemberService = inject(BoardMemberService);
  private readonly fileService = inject(FileService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly swalService = inject(SwalService);
  private readonly tusUploadService = inject(TusUploadService);

  // ═══════════════════════════════════════════════════════════
  // Signals
  // ═══════════════════════════════════════════════════════════
  readonly records = signal<BoardMember[]>([]);
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly selectedRecord = signal<BoardMember | null>(null);
  readonly isEditing = signal<boolean>(false);
  readonly quickFilterText = signal<string>('');
  readonly modalConfig = signal<ModalConfig>(new ModalConfig());
  readonly form = signal<any>(null);
  readonly previewUrl = signal<string | null>(null);
  readonly selectedFile = signal<File | null>(null);
  // ═══ اضافه کردن signals برای TUS ═══
  private readonly _profileImageGuid = signal<string | null>(null);
  private readonly _isImageUploading = signal<boolean>(false);
  private readonly _imageUploadProgress = signal<number>(0);

  readonly profileImageGuid = this._profileImageGuid.asReadonly();
  readonly isImageUploading = this._isImageUploading.asReadonly();
  readonly imageUploadProgress = this._imageUploadProgress.asReadonly();
  private readonly _imageUrlMap = signal<Map<string, string>>(new Map());
  readonly imageUrlMap = this._imageUrlMap.asReadonly();

  // ═══════════════════════════════════════════════════════════
  // Image Handling - TUS Based
  // ═══════════════════════════════════════════════════════════

  triggerFileInput(): void {
    this.fileInput()?.nativeElement?.click();
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      this.toastService.error('حجم فایل نباید بیشتر از 2 مگابایت باشد');
      input.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.toastService.error('فقط فایل‌های تصویری مجاز هستند');
      input.value = '';
      return;
    }

    // ✅ نمایش پیش‌نمایش فوری
    const reader = new FileReader();
    reader.onload = (e) => this.previewUrl.set(e.target?.result as string);
    reader.readAsDataURL(file);

    this._isImageUploading.set(true);
    this._imageUploadProgress.set(0);

    try {
      const added = this.tusUploadService.addFiles([file], {
        maxSizeMB: 2,
        acceptedTypes: ['image/*'],
        localPreview: false,
      });

      if (!added.length) throw new Error('فایل به صف آپلود اضافه نشد');

      const tusItem = added[0];

      const progressTimer = setInterval(() => {
        const current = this.tusUploadService.filesMap().get(tusItem.id);
        if (!current) return;
        this._imageUploadProgress.set(current.progress);
        if (current.status === UploadStatus.Completed || current.status === UploadStatus.Failed) {
          clearInterval(progressTimer);
        }
      }, 100);

      const guid = await this.tusUploadService.uploadFile(tusItem.id, {
        folderPath: 'BoardMembers{{Folder}}Profiles',
        description: 'تصویر پروفایل عضو هیئت مدیره',
      });

      clearInterval(progressTimer);

      if (!guid) throw new Error('آپلود ناموفق بود');

      // ✅ حذف تصویر قدیمی اگر وجود داشت
      const oldGuid = this._profileImageGuid();
      if (oldGuid) {
        try { await this.tusUploadService.deleteAttachment(oldGuid); } catch { }
      }

      this._profileImageGuid.set(guid);
      this._imageUploadProgress.set(100);
      this.toastService.success('تصویر با موفقیت آپلود شد');

    } catch (e: any) {
      this.previewUrl.set(null);
      this._profileImageGuid.set(null);
      this.toastService.error(`خطا در آپلود تصویر: ${e?.message || 'نامشخص'}`);
    } finally {
      this._isImageUploading.set(false);
      input.value = '';
    }
  }

  async removeImage(): Promise<void> {
    const guid = this._profileImageGuid();
    if (guid) {
      try { await this.tusUploadService.deleteAttachment(guid); } catch { }
    }
    this.previewUrl.set(null);
    this._profileImageGuid.set(null);
    this._imageUploadProgress.set(0);
  }

  // ═══════════════════════════════════════════════════════════
  // Submit - ارسال JSON به جای FormData
  // ═══════════════════════════════════════════════════════════

  submit(): void {
    if (this.form().invalid) {
      this.form().markAllAsTouched();
      this.toastService.warning('لطفاً فیلدهای الزامی را تکمیل کنید');
      return;
    }

    if (this._isImageUploading()) {
      this.toastService.warning('لطفاً صبر کنید تا آپلود تصویر تمام شود');
      return;
    }

    this.saving.set(true);

    const formValue = this.form().value;

    // ✅ ارسال JSON با profileImageGuid به جای FormData
    const dto = {
      guid: formValue.guid || undefined,
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      mobile: formValue.mobile || '',
      position: formValue.position,
      startDate: formValue.startDate || '',
      endDate: formValue.endDate || '',
      company: formValue.company || '',
      profileImageGuid: this._profileImageGuid() || undefined,
    };

    if (this.isEditing()) {
      this.updateMember(dto);
    } else {
      this.createMember(dto);
    }
  }

  private createMember(dto: any): void {
    this.boardMemberService.create(dto)   // ✅ متد JSON به جای createWithFile
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          this.toastService.error('خطا در ثبت عضو');
          this.saving.set(false);
          return of(null);
        })
      )
      .subscribe(result => {
        this.saving.set(false);
        if (result) {
          this.toastService.success('عضو با موفقیت ثبت شد');
          this.closeModal();
          this.getRecords();
        }
      });
  }




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
      { label: 'اعضای هیئت مدیره', routerLink: '/settings/board-members' },
    ]);
  }

  private setupModalConfig(): void {
    const config = this.modalConfig();
    config.size = "large";
    config.modalTitle = "ثبت/ویرایش عضو هیئت مدیره";
    this.modalConfig.set(config);
  }

  private initializeForm(): void {
    const formGroup = this.fb.group({
      guid: [''],
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      mobile: ['', [Validators.minLength(11), Validators.maxLength(11)]],
      position: ['', [Validators.required, Validators.maxLength(200)]],
      startDate: [''],
      endDate: [''],
      company: [''],
      profileImage: [null]
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
    // restore state if needed
  }



  // ═══════════════════════════════════════════════════════════
  // Data Operations - اضافه کردن batch load تصاویر
  // ═══════════════════════════════════════════════════════════

  private async getRecords(): Promise<void> {
    this.loading.set(true);

    try {
      this.boardMemberService.getList<BoardMember[]>()
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(error => {
            console.error('Error loading board members:', error);
            this.toastService.error('خطا در بارگذاری اعضای هیئت مدیره');
            return of([]);
          })
        )
        .subscribe(async (data: any) => {
          const records: BoardMember[] = data || [];
          this.records.set(records);
          this.loading.set(false);

          // ✅ batch load تصاویر - مثل meeting-participants
          await this.loadMemberImages(records);

          // ✅ رفرش گرید بعد از لود تصاویر
          this.gridApi()?.refreshCells({ force: true });
        });

    } catch (error) {
      console.error('Error in getRecords:', error);
      this.loading.set(false);
    }
  }

  private async loadMemberImages(records: BoardMember[]): Promise<void> {
    // جمع‌آوری تمام guid های معتبر
    const guids = records
      .map(r => r.profileImageGuid)
      .filter((g): g is string => !!g && g !== '00000000-0000-0000-0000-000000000000');

    if (!guids.length) return;

    try {
      // ✅ دقیقاً مثل meeting-participants و resolution-form
      const urlMap = await this.tusUploadService.getFilePreviewUrls(guids);
      this._imageUrlMap.set(urlMap);
    } catch (err) {
      console.warn('Failed to load member images:', err);
    }
  }
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
        headerName: 'تصویر',
        field: 'profileImageGuid',
        width: 100,
        sortable: false,
        filter: false,
        floatingFilter: false,
        cellRenderer: this.imageCellRenderer.bind(this),
        cellStyle: { textAlign: 'center', padding: '5px' }
      },
      {
        headerName: 'نام',
        field: 'firstName',
        flex: 1,
        minWidth: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        filterParams: {
          filterOptions: ['contains', 'startsWith'],
          defaultOption: 'contains'
        },
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        headerName: 'نام خانوادگی',
        field: 'lastName',
        flex: 1,
        minWidth: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        headerName: 'سمت',
        field: 'position',
        flex: 1.5,
        minWidth: 300,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        cellStyle: { fontWeight: '600', 'font-family': 'Sahel' }
      },
      {
        headerName: 'شرکت',
        field: 'company',
        flex: 1,
        minWidth: 250,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        headerName: 'موبایل',
        field: 'mobile',
        width: 130,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        cellStyle: { direction: 'ltr', textAlign: 'center', 'font-family': 'Sahel' }
      },
      {
        headerName: 'تاریخ شروع',
        field: 'startDate',
        width: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },
      {
        headerName: 'تاریخ پایان',
        field: 'endDate',
        width: 120,
        filter: 'agTextColumnFilter',
        floatingFilter: true,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },
      {
        headerName: 'تاریخ ایجاد',
        field: 'createdDate',
        width: 120,
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
        width: 180,
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

    // Row class برای اعضای غیرفعال
    options.rowClassRules = {
      'inactive-row': (params: any) => params.data?.isActive !== 1
    };

    // کلیک روی سلول
    options.onCellClicked = (event: any) => {
      this.onCellClicked(event);
    };


  }

  // ═══════════════════════════════════════════════════════════
  // Cell Renderers
  // ═══════════════════════════════════════════════════════════

  // ✅ قبلاً: buildFileUrl(guid) — اشتباه، guid نیست path
  // ✅ الان: از imageUrlMap که از getMetas پر شده استفاده می‌کنیم

  private imageCellRenderer(params: any): string {
    const guid = params.value;

    if (!guid) {
      return `<div class="avatar-placeholder"><i class="fas fa-user"></i></div>`;
    }

    // ✅ از map از پیش بارگذاری شده بخوان
    const imageUrl = this._imageUrlMap().get((guid as string).toLowerCase());

    if (!imageUrl) {
      return `<div class="avatar-placeholder"><i class="fas fa-user"></i></div>`;
    }

    return `
    <div class="avatar-container">
      <img src="${imageUrl}"
           alt="تصویر"
           class="avatar-img"
            style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid #ccfbf1;flex-shrink:0"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <div class="avatar-placeholder" style="display:none;">
        <i class="fas fa-user"></i>
      </div>
    </div>
  `;
  }

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
  public onFirstDataRendered(event: any): void {
    setTimeout(() => {
      this.autoSizeAllColumns();
    }, 700);
  }

  override onGridReady(params: any): void {
    super.onGridReady(params);
    setTimeout(() => {
      this.autoSizeAllColumns();
    }, 500);
  }
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
      fileName: `اعضای-هیئت-مدیره-${new Date().toLocaleDateString('fa-IR')}.xlsx`,
      sheetName: 'اعضا'
    });
  }



  // ═══════════════════════════════════════════════════════════
  // Data Operations
  // ═══════════════════════════════════════════════════════════


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
    this.previewUrl.set(null);
    this.selectedFile.set(null);
    this.form().reset();

    const config = this.modalConfig();
    config.modalTitle = "ثبت عضو جدید هیئت مدیره";
    this.modalConfig.set(config);

    this.showModal();
  }

  openEditModal(guid: string): void {
    this.loading.set(true);

    this.boardMemberService.getForEdit<BoardMember>(guid)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          this.toastService.error('خطا در بارگذاری اطلاعات');
          this.loading.set(false);
          return of(null);
        })
      )
      .subscribe(async (data: any) => {
        if (data) {
          this.isEditing.set(true);
          this.selectedRecord.set(data);
          this._profileImageGuid.set(data.profileImageGuid || null);

          this.form().patchValue({
            guid: data.guid,
            firstName: data.firstName,
            lastName: data.lastName,
            mobile: data.mobile,
            position: data.position,
            startDate: data.startDate,
            endDate: data.endDate,
            company: data.company,
          });

          // ✅ لود تصویر از map اگه وجود داره، وگرنه از سرور
          if (data.profileImageGuid) {
            const cached = this._imageUrlMap().get(
              (data.profileImageGuid as string).toLowerCase()
            );

            if (cached) {
              // ✅ از cache بخون - مثل meeting-participants
              this.previewUrl.set(cached);
            } else {
              // ✅ اگه در cache نبود، مستقیم getMetas بزن
              try {
                const metas = await this.tusUploadService.getMetas([data.profileImageGuid]);
                const meta = metas[0];
                if (meta?.path) {
                  const url = this.tusUploadService.buildFileUrl(meta.path);
                  this.previewUrl.set(url);

                  // ✅ ذخیره در map برای استفاده بعدی
                  this._imageUrlMap.update(map => {
                    const newMap = new Map(map);
                    newMap.set((data.profileImageGuid as string).toLowerCase(), url);
                    return newMap;
                  });
                }
              } catch {
                this.previewUrl.set(null);
              }
            }
          } else {
            this.previewUrl.set(null);
          }

          this.showModal();
        }
        this.loading.set(false);
      });
  }

  async askForDelete(guid: string): Promise<void> {
    try {
      const result = await this.swalService.fireSwal('آیا از حذف این عضو اطمینان دارید؟');
      if (result.value === true) {
        this.boardMemberService.delete(guid)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(error => {
              this.toastService.error('خطا در حذف عضو');
              return of(null);
            })
          )
          .subscribe(() => {
            this.toastService.success('عضو با موفقیت حذف شد');
            this.getRecords();
          });
      }
    } catch (error) {
      console.error('Error in delete operation:', error);
    }
  }

  async activate(guid: string): Promise<void> {
    try {
      const result = await this.swalService.fireSwal('آیا از فعال‌سازی این عضو اطمینان دارید؟');
      if (result.value === true) {
        this.boardMemberService.activate(guid)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(() => {
              this.toastService.error('خطا در فعال‌سازی عضو');
              return of(null);
            })
          )
          .subscribe(() => {
            this.toastService.success('عضو با موفقیت فعال شد');
            this.getRecords();
          });
      }
    } catch (error) {
      console.error('Error activating member:', error);
    }
  }

  async deactivate(guid: string): Promise<void> {
    try {
      const result = await this.swalService.fireSwal('آیا از غیرفعال کردن این عضو اطمینان دارید؟');
      if (result.value === true) {
        this.boardMemberService.deactivate(guid)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(() => {
              this.toastService.error('خطا در غیرفعال کردن عضو');
              return of(null);
            })
          )
          .subscribe(() => {
            this.toastService.success('عضو با موفقیت غیرفعال شد');
            this.getRecords();
          });
      }
    } catch (error) {
      console.error('Error deactivating member:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Image Handling
  // ═══════════════════════════════════════════════════════════



  // ═══════════════════════════════════════════════════════════
  // Modal Operations
  // ═══════════════════════════════════════════════════════════

  private showModal(): void {
    const modalEl = document.getElementById('boardMemberModal');
    if (modalEl) {
      this.modalInstance = new bootstrap.Modal(modalEl);
      this.modalInstance.show();
    }
  }

  async closeModal(): Promise<void> {
    // ✅ اگر در حالت create بود و تصویر آپلود شده ولی فرم کنسل شد
    if (!this.isEditing() && this._profileImageGuid()) {
      try { await this.tusUploadService.deleteAttachment(this._profileImageGuid()!); } catch { }
    }

    if (this.modalInstance) this.modalInstance.hide();

    this.selectedRecord.set(null);
    this.isEditing.set(false);
    this.previewUrl.set(null);
    this._profileImageGuid.set(null);
    this._imageUploadProgress.set(0);
    this.form().reset();
  }



  private updateMember(dto: any): void {
    this.boardMemberService.edit(dto)     // ✅ متد JSON به جای editWithFile
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          this.toastService.error('خطا در ویرایش عضو');
          this.saving.set(false);
          return of(null);
        })
      )
      .subscribe(result => {
        this.saving.set(false);
        if (result) {
          this.toastService.success('عضو با موفقیت ویرایش شد');
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

    if (field.errors['required']) return 'این فیلد الزامی است';
    if (field.errors['minlength']) return `حداقل ${field.errors['minlength'].requiredLength} کاراکتر وارد کنید`;
    if (field.errors['maxlength']) return `حداکثر ${field.errors['maxlength'].requiredLength} کاراکتر مجاز است`;

    return 'خطا در اعتبارسنجی';
  }
}
