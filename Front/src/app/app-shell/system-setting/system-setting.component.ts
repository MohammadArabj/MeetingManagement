import { Component, OnInit, OnDestroy, inject, signal, computed, viewChild, ElementRef } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// AG Grid
import { AgGridAngular } from 'ag-grid-angular';
import { SystemUser } from '../../core/models/User';
import { CategoryService } from '../../services/category.service';
import { BreadcrumbService } from '../../services/framework-services/breadcrumb.service';
import { getClientSettings } from '../../services/framework-services/code-flow.service';
import { PositionService } from '../../services/position.service';
import { SettingJsonModel, SystemSettingService } from '../../services/system-setting.service';
import { UserService } from '../../services/user.service';
import { AgGridBaseComponent } from '../../shared/ag-grid-base/ag-grid-base';
import { ComboBase } from '../../shared/combo-base';
import { CustomInputComponent } from '../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../shared/custom-controls/custom-select';

declare var bootstrap: any;

// ═══════════════════════════════════════════════════════════
// تعریف نوع GUID و منبع داده آن
// ═══════════════════════════════════════════════════════════
type GuidSourceType = 'category' | 'position' | 'user' | 'none';

interface GuidFieldConfig {
  keyName: string;
  source: GuidSourceType;
  label: string;
}

// تنظیم منبع داده برای هر کلید GUID
const GUID_FIELD_CONFIGS: GuidFieldConfig[] = [
  { keyName: 'BoardCategoryGuid', source: 'category', label: 'دسته‌بندی' },
  { keyName: 'CommitteeCategoryGuid', source: 'category', label: 'دسته‌بندی' },
  { keyName: 'BoardPositionGuid', source: 'position', label: 'سمت' },
  { keyName: 'DefaultFollowerPositionGuid', source: 'position', label: 'سمت' },
  { keyName: 'BoardSecretaryUserGuid', source: 'user', label: 'کاربر' },
  { keyName: 'DefaultFollowerGuid', source: 'user', label: 'کاربر' },
  { keyName: 'SystemGuid', source: 'none', label: 'شناسه سیستم' },
];

@Component({
  selector: 'app-setting-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AgGridAngular,
    CustomInputComponent,
    CustomSelectComponent
],
  templateUrl: './system-setting.component.html',
  styleUrl: './system-setting.component.css'
})
export class SystemSettingListComponent extends AgGridBaseComponent implements OnInit, OnDestroy {

  // ═══════════════════════════════════════════════════════════
  // Injected Services
  // ═══════════════════════════════════════════════════════════
  private readonly fb = inject(FormBuilder);
  private readonly systemSettingService = inject(SystemSettingService);
  private readonly categoryService = inject(CategoryService);
  private readonly positionService = inject(PositionService);
  private readonly userService = inject(UserService);
  private readonly breadcrumbService = inject(BreadcrumbService);

  // ═══════════════════════════════════════════════════════════
  // Destroy Subject
  // ═══════════════════════════════════════════════════════════
  private destroy$ = new Subject<void>();

  // ═══════════════════════════════════════════════════════════
  // ViewChild
  // ═══════════════════════════════════════════════════════════
  readonly editModal = viewChild<ElementRef>('editModal');

  // ═══════════════════════════════════════════════════════════
  // Signals
  // ═══════════════════════════════════════════════════════════
  readonly settings = signal<SettingJsonModel[]>([]);
  readonly filteredSettings = signal<SettingJsonModel[]>([]);
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly selectedSetting = signal<SettingJsonModel | null>(null);
  readonly selectedCategory = signal<number | null>(null);

  // ═══════════════════════════════════════════════════════════
  // Dropdown Data Signals
  // ═══════════════════════════════════════════════════════════
  readonly categories = signal<ComboBase[]>([]);
  readonly positions = signal<ComboBase[]>([]);
  readonly users = signal<ComboBase[]>([]);        // ✅ برای dropdown
  readonly systemUsers = signal<SystemUser[]>([]); // ✅ داده اصلی کاربران
  readonly dataLoading = signal<boolean>(false);

  // ═══════════════════════════════════════════════════════════
  // Form
  // ═══════════════════════════════════════════════════════════
  editForm!: FormGroup;
  private modalInstance: any = null;

  // ═══════════════════════════════════════════════════════════
  // Static Lists
  // ═══════════════════════════════════════════════════════════
  readonly settingCategories = [
    { guid: '', title: 'همه دسته‌ها' },
    { guid: '1', title: 'عمومی' },
    { guid: '2', title: 'جلسات' },
    { guid: '3', title: 'هیئت مدیره' },
    { guid: '4', title: 'نوتیفیکیشن' },
    { guid: '5', title: 'مدیریت فایل' }
  ];

  // ═══════════════════════════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════════════════════════
  readonly settingsCount = computed(() => this.filteredSettings().length);

  readonly selectedValueType = computed(() => {
    const setting = this.selectedSetting();
    return setting?.valueType || 1;
  });

  readonly isBoolean = computed(() => this.selectedValueType() === 3);
  readonly isNumber = computed(() => this.selectedValueType() === 2 || this.selectedValueType() === 5);
  readonly isGuid = computed(() => this.selectedValueType() === 4);

  /** نوع منبع داده برای فیلد GUID فعلی */
  readonly currentGuidSource = computed((): GuidSourceType => {
    const setting = this.selectedSetting();
    if (!setting || setting.valueType !== 4) return 'none';

    const config = GUID_FIELD_CONFIGS.find(c => c.keyName === setting.keyName);
    return config?.source || 'none';
  });

  /** آیا فیلد GUID فعلی dropdown دارد؟ */
  readonly hasGuidDropdown = computed(() => {
    return this.currentGuidSource() !== 'none';
  });

  /** گزینه‌های dropdown برای فیلد GUID فعلی */
  readonly currentGuidOptions = computed((): ComboBase[] => {
    const source = this.currentGuidSource();
    switch (source) {
      case 'category':
        return this.categories();
      case 'position':
        return this.positions();
      case 'user':
        return this.users();
      default:
        return [];
    }
  });

  /** لیبل فیلد GUID فعلی */
  readonly currentGuidLabel = computed((): string => {
    const setting = this.selectedSetting();
    if (!setting) return 'مقدار';

    const config = GUID_FIELD_CONFIGS.find(c => c.keyName === setting.keyName);
    return config?.label || 'مقدار';
  });

  // ═══════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════
  constructor() {
    super();
    this.initForm();
    this.setupBreadcrumb();
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    this.setupGridColumns();
    await this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════
  // Setup
  // ═══════════════════════════════════════════════════════════

  private setupBreadcrumb(): void {
    this.breadcrumbService.setItems([
      { label: 'تنظیمات سیستم', routerLink: '/settings' }
    ]);
  }

  private initForm(): void {
    this.editForm = this.fb.group({
      id: [0],
      key: [0],
      keyName: [''],
      value: ['', Validators.required],
      displayName: ['', Validators.required],
      description: [''],
      isPublic: [true]
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Data Loading
  // ═══════════════════════════════════════════════════════════

  private async loadInitialData(): Promise<void> {
    this.loading.set(true);
    this.dataLoading.set(true);

    try {
      await Promise.all([
        this.loadSettings(),
        this.loadCategories(),
        this.loadPositions(),
        this.loadUsers()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.toastService.error('خطا در بارگذاری اطلاعات');
    } finally {
      this.loading.set(false);
      this.dataLoading.set(false);
    }
  }

  // ✅ لود دسته‌بندی‌ها
  private async loadCategories(): Promise<void> {
    try {
      const categories = await this.categoryService.getForCombo<ComboBase[]>().toPromise() || [];
      this.categories.set(categories);
    } catch (error) {
      console.error('Error loading categories:', error);
      this.categories.set([]);
    }
  }

  // ✅ لود سمت‌ها
  private async loadPositions(): Promise<void> {
    try {
      const positions = await this.positionService.getForCombo<ComboBase[]>().toPromise() || [];
      this.positions.set(positions);
    } catch (error) {
      console.error('Error loading positions:', error);
      this.positions.set([]);
    }
  }

  // ✅ لود کاربران با getAllByClientId (مثل meeting-ops)
  private async loadUsers(): Promise<void> {
    try {
      const clientId = getClientSettings()?.client_id ?? '';
      const users = await this.userService.getAllByClientId<SystemUser[]>(clientId).toPromise() || [];

      this.systemUsers.set(users);

      // ✅ تبدیل به ComboBase برای dropdown
      const usersCombo: ComboBase[] = users.map(user => ({
        guid: user.guid,
        title: user.name + (user.position ? ` (${user.position})` : '')
      }));

      this.users.set(usersCombo);
    } catch (error) {
      console.error('Error loading users:', error);
      this.systemUsers.set([]);
      this.users.set([]);
    }
  }

  async loadSettings(): Promise<void> {
    try {
      const result = await this.systemSettingService.getAll().toPromise();

      if (result) {
        this.settings.set(result);
        this.applyFilter();
      } else {
        this.toastService.error('خطا در دریافت تنظیمات');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.toastService.error('خطا در دریافت تنظیمات');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Grid Setup
  // ═══════════════════════════════════════════════════════════

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.defaultColDef = {
      ...options.defaultColDef,
      sortable: true,
      resizable: true,
      filter: true
    };

    options.columnDefs = [
      {
        headerName: 'عملیات',
        width: 100,
        pinned: 'right',
        sortable: false,
        filter: false,
        cellRenderer: this.actionsCellRenderer,
        cellStyle: { textAlign: 'center' }
      },
      {
        field: 'categoryName',
        headerName: 'دسته‌بندی',
        width: 130,
        cellRenderer: this.categoryCellRenderer,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },
      {
        field: 'displayName',
        headerName: 'عنوان',
        flex: 1,
        minWidth: 200,
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel', fontWeight: '500' }
      },
      {
        field: 'value',
        headerName: 'مقدار',
        flex: 1,
        minWidth: 250,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: any) => this.valueCellRendererWithLookup(params),
        cellStyle: { 'font-family': 'Sahel', direction: 'ltr', textAlign: 'left' }
      },
      {
        field: 'valueTypeName',
        headerName: 'نوع',
        width: 120,
        cellRenderer: this.valueTypeCellRenderer,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },
      {
        field: 'isPublic',
        headerName: 'عمومی',
        width: 100,
        cellRenderer: this.publicCellRenderer,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      }
    
    ];

    options.pagination = true;
    options.paginationPageSize = 20;
    options.paginationPageSizeSelector = [10, 20, 50, 100];
    options.domLayout = 'normal';

    options.onRowDoubleClicked = (event: any) => {
      if (event.data) {
        this.openEditModal(event.data);
      }
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Cell Renderers
  // ═══════════════════════════════════════════════════════════

  private categoryCellRenderer = (params: any): string => {
    const category = params.value || '-';
    const categoryMap: Record<string, string> = {
      'General': 'عمومی',
      'Meeting': 'جلسات',
      'BoardMeeting': 'هیئت مدیره',
      'Notification': 'نوتیفیکیشن',
      'FileManagement': 'مدیریت فایل'
    };

    const colorMap: Record<string, string> = {
      'General': 'bg-secondary',
      'Meeting': 'bg-primary',
      'BoardMeeting': 'bg-success',
      'Notification': 'bg-warning',
      'FileManagement': 'bg-info'
    };

    const text = categoryMap[category] || category;
    const badgeClass = colorMap[category] || 'bg-secondary';

    return `<span class="badge ${badgeClass}" style="font-size: 11px;">${text}</span>`;
  };

  /**
   * نمایش مقدار GUID با lookup به نام
   */
  private valueCellRendererWithLookup = (params: any): string => {
    const value = params.value || '';
    const valueType = params.data?.valueType;
    const keyName = params.data?.keyName;

    // Boolean
    if (valueType === 3) {
      const isTrue = value.toLowerCase() === 'true';
      const icon = isTrue ? 'fa-check-circle text-success' : 'fa-times-circle text-danger';
      const text = isTrue ? 'بله' : 'خیر';
      return `<i class="fas ${icon} me-1"></i> ${text}`;
    }

    // GUID - تلاش برای نمایش نام به جای GUID
    if (valueType === 4 && value) {
      const displayName = this.lookupGuidValue(keyName, value);
      if (displayName && displayName !== value) {
        return `<span title="${value}" style="cursor: help;">
          <i class="fas fa-link text-primary me-1"></i>${displayName}
        </span>`;
      }

      // اگر نام پیدا نشد، GUID کوتاه شده نمایش بده
      if (value.length > 20) {
        return `<span title="${value}" style="cursor: help;">${value.substring(0, 8)}...${value.substring(value.length - 4)}</span>`;
      }
    }

    // متن طولانی
    if (value.length > 50) {
      return `<span title="${value}" style="cursor: help;">${value.substring(0, 50)}...</span>`;
    }

    return value;
  };

  /**
   * lookup GUID به نام
   */
  private lookupGuidValue(keyName: string, guid: string): string {
    const config = GUID_FIELD_CONFIGS.find(c => c.keyName === keyName);
    if (!config) return guid;

    const guidLower = guid.toLowerCase();
    let item: ComboBase | undefined;

    switch (config.source) {
      case 'category':
        item = this.categories().find(c => c.guid?.toLowerCase() === guidLower);
        break;
      case 'position':
        item = this.positions().find(p => p.guid?.toLowerCase() === guidLower);
        break;
      case 'user':
        item = this.users().find(u => u.guid?.toLowerCase() === guidLower);
        break;
    }

    return item?.title || guid;
  }

  private valueTypeCellRenderer = (params: any): string => {
    const type = params.value || '-';
    const typeMap: Record<string, { text: string; class: string }> = {
      'String': { text: 'متن', class: 'bg-light text-dark' },
      'Integer': { text: 'عدد', class: 'bg-info' },
      'Boolean': { text: 'بولین', class: 'bg-warning' },
      'Guid': { text: 'GUID', class: 'bg-secondary' },
      'Decimal': { text: 'اعشاری', class: 'bg-info' }
    };

    const config = typeMap[type] || { text: type, class: 'bg-light text-dark' };
    return `<span class="badge ${config.class}" style="font-size: 10px;">${config.text}</span>`;
  };

  private publicCellRenderer = (params: any): string => {
    const isPublic = params.value === true;
    if (isPublic) {
      return '<i class="fas fa-globe text-success" title="عمومی"></i>';
    }
    return '<i class="fas fa-lock text-muted" title="خصوصی"></i>';
  };

  private actionsCellRenderer = (params: any): string => {
    return `
      <button class="btn btn-sm btn-outline-primary edit-btn" title="ویرایش">
        <i class="fas fa-edit"></i>
      </button>
    `;
  };

  // ═══════════════════════════════════════════════════════════
  // Grid Events
  // ═══════════════════════════════════════════════════════════

  override onGridReady(params: any): void {
    super.onGridReady(params);

    params.api.addEventListener('cellClicked', (event: any) => {
      if (event.column.getColId() === '0' && event.event.target.closest('.edit-btn')) {
        this.openEditModal(event.data);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Filter
  // ═══════════════════════════════════════════════════════════

  onCategoryFilterChange(event: any): void {
    const value = event?.target?.value || event?.guid || event;
    this.selectedCategory.set(value ? parseInt(value) : null);
    this.applyFilter();
  }

  private applyFilter(): void {
    const category = this.selectedCategory();
    let filtered = this.settings();

    if (category) {
      filtered = filtered.filter(s => s.category === category);
    }

    this.filteredSettings.set(filtered);
  }

  clearFilters(): void {
    this.selectedCategory.set(null);
    this.applyFilter();
    this.removeAllFilters();
  }

  // ═══════════════════════════════════════════════════════════
  // Modal Operations
  // ═══════════════════════════════════════════════════════════

  openEditModal(setting: SettingJsonModel): void {
    this.selectedSetting.set(setting);

    this.editForm.patchValue({
      id: setting.id,
      key: setting.key,
      keyName: setting.keyName,
      value: setting.value,
      displayName: setting.displayName,
      description: setting.description || '',
      isPublic: setting.isPublic
    });

    const modalEl = this.editModal()?.nativeElement;
    if (modalEl) {
      this.modalInstance = new bootstrap.Modal(modalEl);
      this.modalInstance.show();
    }
  }

  closeModal(): void {
    if (this.modalInstance) {
      this.modalInstance.hide();
    }
    this.selectedSetting.set(null);
    this.editForm.reset();
  }

  // ═══════════════════════════════════════════════════════════
  // Value Change Handler
  // ═══════════════════════════════════════════════════════════

  onGuidValueChange(selectedItem: any): void {
    const value = selectedItem?.guid || selectedItem;
    this.editForm.patchValue({ value: value });
  }

  // ═══════════════════════════════════════════════════════════
  // Save
  // ═══════════════════════════════════════════════════════════

  async saveSetting(): Promise<void> {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.toastService.warning('لطفاً مقادیر الزامی را وارد کنید');
      return;
    }

    if (this.saving()) return;
    this.saving.set(true);

    try {
      const formValue = this.editForm.value;

      const result = await this.systemSettingService.edit({
        id: formValue.id,
        value: formValue.value,
        displayName: formValue.displayName,
        description: formValue.description,
        isPublic: formValue.isPublic
      }).toPromise();

      this.closeModal();
      await this.loadSettings();

      // Refresh public settings
      await this.systemSettingService.initializePublicSettings();
    } catch (error) {
      console.error('Error saving setting:', error);
      this.toastService.error('خطا در ذخیره تنظیم');
    } finally {
      this.saving.set(false);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════

  getCategoryName(category: number): string {
    const map: Record<number, string> = {
      1: 'عمومی',
      2: 'جلسات',
      3: 'هیئت مدیره',
      4: 'نوتیفیکیشن',
      5: 'مدیریت فایل',
      6: 'نقش‌ها و دسترسی‌ها',
      7: 'مصوبات و پیگیری'
    };
    return map[category] || '-';
  }

  getValueTypeName(valueType: number): string {
    const map: Record<number, string> = {
      1: 'متن',
      2: 'عدد صحیح',
      3: 'بولین',
      4: 'GUID',
      5: 'اعشاری',
      6: 'JSON',
      7: 'ساعت'
    };
    return map[valueType] || '-';
  }

  copyToClipboard(value: string): void {
    navigator.clipboard.writeText(value).then(() => {
      this.toastService.success('مقدار کپی شد');
    }).catch(() => {
      this.toastService.error('خطا در کپی');
    });
  }

  async refresh(): Promise<void> {
    await this.loadInitialData();
    this.toastService.success('لیست به‌روزرسانی شد');
  }
}