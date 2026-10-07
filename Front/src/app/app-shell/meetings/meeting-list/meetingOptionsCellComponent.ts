import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { NgClass, NgStyle } from '@angular/common';
import {
  Component,
  TemplateRef,
  ViewContainerRef,
  signal,
  computed,
  effect,
  inject,
  DestroyRef,
  viewChild,
  input,
  OnDestroy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { IsDeletage, ISSP } from '../../../core/types/configuration';
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';
import { MeetingRoles } from '../../../core/meeting-access/meeting-roles';
import { MeetingStatus, MeetingStatuses } from '../../../core/meeting-access/meeting-status';
import { AppSettings } from '../../../services/system-setting.service';

interface MenuItem {
  label: string;
  icon: string;
  iconClass: string;
  visible: () => boolean;
  action: () => void;
}

interface MeetingData {
  guid: string;
  roleId: number;
  statusId: number;
}

interface AgGridParams {
  data: MeetingData;
  context: {
    componentParent: {
      viewMeetingDetails: (guid: string, roleId: number, statusId: number) => void;
      changeStatus: (guid: string, status: number) => void;
      askForDelete: (guid: string) => void;
      clone: (guid: string) => void;
    };
  };
}

@Component({
  selector: 'app-meeting-options-cell',
  standalone: true,
  imports: [NgStyle, NgClass],
  template: `
    <button
      type="button"
      class="btn btn-sm btn-action dropdown-toggle"
      (click)="toggleMenu($event)">
      <i class="fa fa-cog me-1"></i>
    </button>

    <ng-template #menuTemplate>
      <ul class="dropdown-menu show" [ngStyle]="menuStyle()">
        @for (item of visibleMenuItems(); track $index) {
          <li>
            <a (click)="item.action()" class="dropdown-item d-flex align-items-center">
              <i class="{{item.icon}} action-icon" [ngClass]="item.iconClass"></i>
              {{ item.label }}
            </a>
          </li>
        }
      </ul>
    </ng-template>
  `,
  styles: [`
    .action-icon {
      margin-left: 10px;
    }
    .text-info { color: #17a2b8; }
    .text-danger { color: #dc3545; }
    .text-success { color: #28a745; }
    .text-warning { color: #ffc107; }
    .text-brown { color: #8B4513; }
  `]
})
export class MeetingOptionsCellComponent implements OnDestroy {
  // Injected services using modern inject()
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly destroyRef = inject(DestroyRef);

  // ViewChild using signal-based approach
  readonly menuTemplate = viewChild.required<TemplateRef<any>>('menuTemplate');

  // Input signals
  params = signal<any>(null);

  // Private writable signals for internal state
  private readonly _isDelegate = signal<boolean>(false);
  private readonly _isSuperAdmin = signal<boolean>(false);
  private readonly _permissions = signal<Set<string>>(new Set());
  private readonly _overlayRef = signal<OverlayRef | null>(null);
  private readonly _menuStyle = signal<any>({});
  private readonly _initialized = signal<boolean>(false);

  // Public readonly computed signals
  readonly isDelegate = computed(() => this._isDelegate());
  readonly isSuperAdmin = computed(() => this._isSuperAdmin());
  readonly permissions = computed(() => this._permissions());
  readonly overlayRef = computed(() => this._overlayRef());
  readonly menuStyle = computed(() => this._menuStyle());
  readonly initialized = computed(() => this._initialized());

  // Computed signals for data access
  readonly currentData = computed(() => this.params()?.data);
  readonly contextParent = computed(() => this.params()?.context?.componentParent);

  // Computed menu items
  readonly menuItems = computed(() => {
    const data = this.currentData();
    const isDelegate = this._isDelegate();
    const permissions = this._permissions();

    if (!data || !this._initialized()) return [];

    const status = data.statusId;
    const isBoard = this.isBoardMeeting(data);
    const can = (to: number) => MeetingStatuses.canTransition(status, to as any);

    return [
      {
        label: (status === MeetingStatus.Registered && MeetingRoles.isManager(data.roleId)) ? 'ویرایش' : 'مشاهده',
        icon: (status === MeetingStatus.Registered && MeetingRoles.isManager(data.roleId)) ?
          'fa fa-edit scaleX-n1-rtl' : 'fa fa-eye scaleX-n1-rtl',
        iconClass: '',
        visible: () => true,
        action: () => this.viewMeeting()
      },
      {
        label: 'کپی کردن',
        icon: 'fa fa-copy scaleX-n1-rtl',
        iconClass: 'text-brown',
        visible: () => true,
        action: () => this.clone()
      },
      {
        label: 'ثبت اولیه جلسه',
        icon: 'fa fa-play scaleX-n1-rtl',
        iconClass: 'text-info',
        visible: () => this.isSpecialMember('MT_Meetings_InitialRegister') && status === MeetingStatus.Draft,
        action: () => this.changeStatus(MeetingStatus.Registered)
      },
      {
        label: 'برگزاری جلسه',
        icon: 'fa fa-play scaleX-n1-rtl',
        iconClass: 'text-info',
        visible: () => this.isSpecialMember('MT_Meetings_Hold') && can(MeetingStatus.Held) && status !== MeetingStatus.Finalized,
        action: () => this.changeStatus(MeetingStatus.Held)
      },
      {
        label: 'تعیین تکلیف نشده',
        icon: 'fa fa-hourglass-half scaleX-n1-rtl',
        iconClass: 'text-secondary',
        visible: () => this.isSpecialMember('MT_Meetings_Hold') && can(MeetingStatus.Undetermined),
        action: () => this.changeStatus(MeetingStatus.Undetermined)
      },
      {
        label: 'لغو جلسه',
        icon: 'fa fa-cancel scaleX-n1-rtl',
        iconClass: 'text-warning',
        visible: () => this.isSpecialMember('MT_Meetings_Cancel') && can(MeetingStatus.Cancelled),
        action: () => this.changeStatus(MeetingStatus.Cancelled)
      },
      {
        label: 'ثبت نهایی جلسه',
        icon: 'fa fa-save scaleX-n1-rtl',
        iconClass: 'text-success',
        visible: () => !isBoard && !isDelegate && this.checkStatus('MT_Meetings_FinalRegister') && status === MeetingStatus.Held,
        action: () => this.changeStatus(MeetingStatus.Finalized)
      },
      {
        label: 'حذف جلسه',
        icon: 'fa fa-trash scaleX-n1-rtl',
        iconClass: 'text-danger',
        visible: () => this.isSpecialMember('MT_Meetings_Delete') && MeetingStatuses.is(status, MeetingStatus.Draft, MeetingStatus.Registered),
        action: () => this.deleteMeeting()
      },
      {
        label: 'فعال کردن مجدد',
        icon: 'fa fa-toggle-on scaleX-n1-rtl',
        iconClass: 'text-danger',
        visible: () => this.isSpecialMember('MT_Meetings_Cancel') && status === MeetingStatus.Cancelled,
        action: () => this.changeStatus(MeetingStatus.Registered)
      },
      {
        label: 'اتمام جلسه',
        icon: 'fa fa-paper-plane scaleX-n1-rtl',
        iconClass: 'text-success',
        // جلسه‌ی عادی پس از ثبت نهایی (و امضای رئیس)؛ هیئت مدیره (بدون صورتجلسه) پس از برگزاری
        visible: () => this.isSpecialMember('MT_Meetings_Finalize') &&
          (isBoard ? MeetingStatuses.is(status, MeetingStatus.Registered, MeetingStatus.Held) : status === MeetingStatus.Finalized),
        action: () => this.changeStatus(MeetingStatus.Completed)
      }
    ] as MenuItem[];
  });

  readonly visibleMenuItems = computed(() =>
    this.menuItems().filter(item => item.visible())
  );

  // Static property for tracking active overlay
  static activeOverlayRef: OverlayRef | null = null;

  constructor() {
    this.setupEffects();
  }

  private setupEffects(): void {
    // Effect to initialize when params change
    effect(() => {
      const params = this.params();
      if (params && !this._initialized()) {
        this.initializeComponent();
      }
    });

    // Effect to handle cleanup when component is destroyed
    effect((onCleanup) => {
      onCleanup(() => {
        this.cleanup();
      });
    });
  }

  // AG Grid lifecycle method (kept for compatibility)
  async agInit(params: AgGridParams): Promise<void> {
    // The actual initialization will happen through the effect when params signal is set
    // This method is kept for AG Grid compatibility
    this.params.set(params);
  }

  private async initializeComponent(): Promise<void> {
    const params = this.params();
    if (!params) return;

    try {
      // Set delegate and super admin status
      this._isDelegate.set(this.localStorageService.getItem(IsDeletage) === 'true');
      this._isSuperAdmin.set(this.localStorageService.getItem(ISSP) === 'true');

      // Load permissions
      await this.loadPermissions();

      // Mark as initialized
      this._initialized.set(true);
    } catch (error) {
      console.error('Error initializing component:', error);
    }
  }

  private async loadPermissions(): Promise<void> {
    const permissionsToCheck = [
      'MT_Meetings_InitialRegister',
      'MT_Meetings_Hold',
      'MT_Meetings_Cancel',
      'MT_Meetings_FinalRegister',
      'MT_Meetings_Delete',
      'MT_Meetings_Finalize'
    ];

    const newPermissions = new Set<string>();
    const isDelegate = this._isDelegate();
    const isSuperAdmin = this._isSuperAdmin();

    // Use Promise.allSettled for better error handling
    const results = await Promise.allSettled(
      permissionsToCheck.map(async (perm) => {
        const hasPermission = await this.passwordFlowService.checkPermission(perm);
        return { perm, hasPermission };
      })
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { perm, hasPermission } = result.value;
        if (hasPermission && (isSuperAdmin || isDelegate)) {
          newPermissions.add(perm);
        }
      } else {
        console.error(`Error checking permission:`, result.reason);
      }
    });

    this._permissions.set(newPermissions);
  }

  private hasPermission(permission: string): boolean {
    return this._permissions().has(permission);
  }

  private isSpecialMember(permission: string): boolean {
    const data = this.currentData();
    if (!data) return false;

    const isDelegate = this._isDelegate();
    return this.hasPermission(permission) ||
      (MeetingRoles.isManager(data.roleId) && !isDelegate);
  }

  private isBoardMeeting(data: MeetingData): boolean {
    const category = `${(data as any).categoryGuid ?? (data as any).meetingCategoryGuid ?? ''}`.toLowerCase();
    return !!category && category === AppSettings.boardCategoryGuid.toLowerCase();
  }

  private checkStatus(permission: string): boolean {
    const data = this.currentData();
    if (!data) return false;

    return this.hasPermission(permission) ||
      (MeetingRoles.isManager(data.roleId) && data.statusId === MeetingStatus.Held);
  }

  toggleMenu(event: MouseEvent): void {
    // Close any existing active overlay
    if (MeetingOptionsCellComponent.activeOverlayRef) {
      MeetingOptionsCellComponent.activeOverlayRef.dispose();
      MeetingOptionsCellComponent.activeOverlayRef = null;
    }

    const currentOverlay = this._overlayRef();
    if (currentOverlay) {
      this.closeMenu();
      return;
    }

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(event.target as HTMLElement)
      .withPositions([
        { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' }
      ]);

    const newOverlayRef = this.overlay.create({ positionStrategy });
    const portal = new TemplatePortal(this.menuTemplate(), this.viewContainerRef);

    newOverlayRef.attach(portal);
    this._overlayRef.set(newOverlayRef);
    MeetingOptionsCellComponent.activeOverlayRef = newOverlayRef;

    // Add click outside listener
    document.addEventListener('click', this.handleClickOutside, true);
  }

  closeMenu(): void {
    const overlay = this._overlayRef();
    if (overlay) {
      overlay.dispose();
      this._overlayRef.set(null);
      MeetingOptionsCellComponent.activeOverlayRef = null;
      document.removeEventListener('click', this.handleClickOutside, true);
    }
  }

  // Use arrow function to maintain 'this' context
  private handleClickOutside = (event: Event): void => {
    const overlay = this._overlayRef();
    if (overlay && !overlay.overlayElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  };

  viewMeeting(): void {
    const data = this.currentData();
    const parent = this.contextParent();

    if (parent && data) {
      parent.viewMeetingDetails(data.guid, data.roleId, data.statusId);
    }
    this.closeMenu();
  }

  changeStatus(status: number): void {
    const data = this.currentData();
    const parent = this.contextParent();

    if (parent && data) {
      parent.changeStatus(data.guid, status);
    }
    this.closeMenu();
  }

  deleteMeeting(): void {
    const data = this.currentData();
    const parent = this.contextParent();

    if (parent && data) {
      parent.askForDelete(data.guid);
    }
    this.closeMenu();
  }

  clone(): void {
    const data = this.currentData();
    const parent = this.contextParent();

    if (parent && data) {
      parent.clone(data.guid);
    }
    this.closeMenu();
  }

  private cleanup(): void {
    this.closeMenu();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
