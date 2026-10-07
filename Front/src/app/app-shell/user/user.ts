// users/user.component.ts

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
import { AgGridAngular } from 'ag-grid-angular';
import { catchError, of } from 'rxjs';

import { SystemUser } from '../../core/models/User';
import { USER_ID_NAME, POSITION_ID } from '../../core/types/configuration';
import { BreadcrumbService } from '../../services/framework-services/breadcrumb.service';
import { CodeFlowService, getClientSettings } from '../../services/framework-services/code-flow.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { SwalService } from '../../services/framework-services/swal.service';
import { UserService } from '../../services/user.service';
import { AgGridBaseComponent } from '../../shared/ag-grid-base/ag-grid-base';
import { LabelButtonComponent } from '../../shared/custom-buttons/label-button';
import { environment } from '../../../environments/environment';
import { ImpersonationService, ImpersonationTarget } from '../../services/framework-services/impersonation.service';
import { IMPERSONATE_PERMISSION, SessionStore } from '../../core/auth/session.store';
import { UserActionsCellComponent } from './user-actions-cell.component';

import { userPhotoUrl } from '../../core/media/media-token';
// Cell Renderer Component

interface GridState {
  page: number;
  filters: any;
}

interface ExpandedUser extends SystemUser {
  positionGuid: string;
  position: string;
  personalNo?: string;
}

@Component({
  selector: 'app-user',
  templateUrl: './user.html',
  styleUrls: ['./user.css'],
  standalone: true,
  imports: [AgGridAngular, LabelButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserList extends AgGridBaseComponent implements OnInit, AfterViewInit {

  // ═══════════════════════════════════════════════════════════════
  // Injected Services
  // ═══════════════════════════════════════════════════════════════
  private readonly renderer = inject(Renderer2);
  private readonly userService = inject(UserService);
  public readonly router = inject(Router);
  private readonly swalService = inject(SwalService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly route = inject(ActivatedRoute);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly codeFlowService = inject(CodeFlowService);
  private readonly impersonationService = inject(ImpersonationService);

  // ═══════════════════════════════════════════════════════════════
  // Signals
  // ═══════════════════════════════════════════════════════════════
  public records = signal<ExpandedUser[]>([]);
  public loading = signal<boolean>(false);
  public gridState = signal<GridState>({ page: 0, filters: {} });
  public isPermitted = signal<boolean>(false);
  public isImpersonating = this.impersonationService.isImpersonating;
  private readonly sessionStore = inject(SessionStore);
  /** «ورود به جای کاربر» فقط برای مدیر کل، ادمین مدیریت جلسات یا دارنده‌ی MT_Impersonate (سرور هم بررسی می‌کند) */
  readonly canImpersonate = computed(() => this.sessionStore.isSuperAdmin() || this.sessionStore.hasPermission(IMPERSONATE_PERMISSION));

  // ═══════════════════════════════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════════════════════════════
  public hasRecords = computed(() => this.records().length > 0);

  constructor() {
    super();
    this.setupBreadcrumb();
    this.setupRouteEffects();
  }

  private setupBreadcrumb(): void {
    this.breadcrumbService.setItems([
      { label: 'مدیریت کاربران', routerLink: '/users/list' },
    ]);
  }

  private setupRouteEffects(): void {
    effect(() => {
      this.route.queryParams
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(params => {
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
      this.getRecords();
    }
  }

  private async checkPermissions(): Promise<void> {
    try {
      // بررسی مجوز مشاهده لیست کاربران
      const checkPermission = await this.passwordFlowService.checkPermission('MT_User_ViewAll');
      if (!checkPermission) {
        this.toastService.error('شما مجوز مشاهده این صفحه را ندارید');
        return;
      }
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
    const pageStr = sessionStorage.getItem('userGridPage');
    if (pageStr) {
      const page = parseInt(pageStr, 10);
      setTimeout(() => {
        const api = this.gridApi();
        api?.paginationGoToPage(page);
      }, 100);
      sessionStorage.removeItem('userGridPage');
    }

    const savedFilters = sessionStorage.getItem('userGridFilters');
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        setTimeout(() => {
          const api = this.gridApi();
          api?.setFilterModel(filters);
        }, 200);
        sessionStorage.removeItem('userGridFilters');
      } catch (error) {
        console.error('خطا در بازگردانی فیلترها:', error);
      }
    }
  }

  override onGridReady(params: any): void {
    super.onGridReady(params);
    setTimeout(() => {
      const api = this.gridApi();
      api?.redrawRows();
      this.autoSizeAllColumns();
    }, 20);
  }

  // ═══════════════════════════════════════════════════════════════
  // Grid Setup
  // ═══════════════════════════════════════════════════════════════

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.columnDefs = [
      {
        field: 'image',
        headerName: 'تصویر',
        filter: false,
        sortable: false,
        width: 80,
        cellRenderer: this.imageCellRenderer,
        cellStyle: { textAlign: 'center' }
      },
      {
        field: 'name',
        headerName: 'نام کاربر',
        filter: 'agTextColumnFilter',
        minWidth: 150,
        flex: 1,
        cellStyle: { fontFamily: 'Sahel' }
      },
      {
        field: 'userName',
        headerName: 'نام کاربری',
        filter: 'agTextColumnFilter',
        width: 150,
        cellStyle: { fontFamily: 'Sahel' }
      },
      {
        field: 'position',
        headerName: 'سمت',
        filter: 'agTextColumnFilter',
        minWidth: 200,
        flex: 1,
        cellStyle: { fontFamily: 'Sahel' }
      },
      {
        field: 'persNo',
        headerName: 'شماره پرسنلی',
        filter: 'agTextColumnFilter',
        width: 130,
        cellStyle: { fontFamily: 'Sahel', textAlign: 'center' }
      },
      {
        colId: 'actions',
        headerName: 'عملیات',
        filter: false,
        sortable: false,
        width: 180,
        cellRenderer: UserActionsCellComponent,
        cellRendererParams: {
          onImpersonate: (user: ExpandedUser) => this.impersonateUser(user),
          isImpersonating: () => this.isImpersonating(),
          canImpersonate: () => this.canImpersonate()
        },
        cellStyle: { textAlign: 'center', overflow: 'visible' }
      }
    ];

    // تنظیمات pagination
    options.pagination = true;
    options.paginationPageSize = 20;
    options.getRowId = (params: any) => `${params.data.guid}_${params.data.positionGuid}`;

    this.setupGridInteractions(options);
  }

  private imageCellRenderer = (params: any): string => {
    const userName = params.data?.userName;
    if (!userName) return '<i class="fa fa-user text-muted"></i>';

    const imageUrl = userPhotoUrl(userName);
    return `
      <div class="user-avatar-cell">
        <img src="${imageUrl}"
             alt="${params.data?.name || ''}"
             onerror="this.src='img/default-avatar.png'"
             style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
      </div>
    `;
  };

  private setupGridInteractions(options: any): void {
    options.rowStyle = { cursor: 'default' };
    options.rowClassRules = {
      'user-row': () => true
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Data Loading
  // ═══════════════════════════════════════════════════════════════

  public async getRecords(): Promise<void> {
    this.loading.set(true);

    try {
      const clientId = getClientSettings().client_id ?? '';

      this.userService.getAllByClientId<SystemUser[]>(clientId)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(error => {
            console.error('Error loading users:', error);
            this.toastService.error('خطا در بارگذاری کاربران');
            return of([]);
          })
        )
        .subscribe((data: SystemUser[]) => {
          // گسترش کاربران با چند position
          const expandedRecords: ExpandedUser[] = [];

          data.forEach(user => {
            if (user.positions && user.positions.length >= 1) {
              user.positions.forEach(pos => {
                expandedRecords.push({
                  ...user,
                  positionGuid: pos.positionGuid,
                  position: pos.positionTitle
                } as ExpandedUser);
              });
            } else {
              expandedRecords.push({
                ...user,
                positionGuid: '',
                position: 'بدون سمت'
              } as ExpandedUser);
            }
          });

          // فیلتر کردن کاربر فعلی (ادمین خودش نباید بتواند به خودش impersonate کند)
          const currentUserGuid = this.localStorageService.getItem(USER_ID_NAME);
          const currentPositionGuid = this.localStorageService.getItem(POSITION_ID);

          const filtered = expandedRecords.filter(user =>
            !(user.guid === currentUserGuid && user.positionGuid === currentPositionGuid)
          );

          this.records.set(filtered);
          this.loading.set(false);
        });
    } catch (error) {
      console.error('Error in getRecords:', error);
      this.loading.set(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Impersonation
  // ═══════════════════════════════════════════════════════════════

  // در متد impersonateUser

  async impersonateUser(user: ExpandedUser): Promise<void> {
    if (this.isImpersonating()) {
      this.toastService.warning('ابتدا از حساب فعلی خارج شوید');
      return;
    }

    if (!user.position || user.position === 'بدون سمت') {
      this.toastService.error('این کاربر سمت مشخصی ندارد');
      return;
    }

    try {
      const result = await this.swalService.fireSwal(
        `آیا می‌خواهید به عنوان "${user.name}" با سمت "${user.position}" وارد شوید؟`,
        'warning'
      );

      if (result.value !== true) return;

      const target: ImpersonationTarget = {
        userGuid: user.guid!,
        positionGuid: user.positionGuid,
        userName: user.name!,
        positionName: user.position,
        persNo: user.userName
      };

      // پس از موفقیت، برنامه خودکار با هویت کاربر هدف روی داشبورد بارگذاری می‌شود
      this.impersonationService.impersonate(target)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();

    } catch (error) {
      console.error('Error in impersonateUser:', error);
      this.toastService.error('خطا در فرآیند ورود');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Grid Controls
  // ═══════════════════════════════════════════════════════════════

  saveGridState(): void {
    const api = this.gridApi();
    if (api) {
      const currentPage = api.paginationGetCurrentPage();
      sessionStorage.setItem('userGridPage', currentPage.toString());
    }
  }

  override removeAllFilters(): void {
    const api = this.gridApi();
    api?.setFilterModel(null);
  }

  override onExportExcel(): void {
    const api = this.gridApi();
    if (api) {
      api.exportDataAsExcel({
        fileName: 'users-list.xlsx',
        sheetName: 'کاربران'
      });
    }
  }
}
