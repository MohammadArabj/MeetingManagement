import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { NgClass, NgStyle } from '@angular/common';
import {
  Component,
  TemplateRef,
  ViewContainerRef,
  signal,
  computed,
  inject,
  viewChild,
  OnDestroy
} from '@angular/core';
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';

interface MenuItem {
  label: string;
  icon: string;
  iconClass: string;
  visible: () => boolean;
  action: () => void;
}

@Component({
  selector: 'app-question-options-cell',
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
    .action-icon { margin-left: 10px; }
    .text-primary { color: #007bff; }
    .text-danger { color: #dc3545; }
    .text-info { color: #17a2b8; }
    .btn-action { padding: 0.25rem 0.5rem; font-size: 0.875rem; }
    .dropdown-menu { min-width: 180px; z-index: 1060; }
    .dropdown-item { padding: 0.5rem 1rem; cursor: pointer; }
    .dropdown-item:hover { background-color: #f8f9fa; }
  `]
})
export class QuestionOptionsCellComponent implements OnDestroy {
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly passwordFlowService = inject(PasswordFlowService);

  readonly menuTemplate = viewChild.required<TemplateRef<any>>('menuTemplate');
  
  params = signal<any>(null);
  private readonly _permissions = signal<Set<string>>(new Set());
  private readonly _overlayRef = signal<OverlayRef | null>(null);
  private readonly _menuStyle = signal<any>({});
  private readonly _initialized = signal<boolean>(false);

  readonly currentData = computed(() => this.params()?.data);
  readonly contextParent = computed(() => this.params()?.context?.componentParent);
  readonly menuStyle = computed(() => this._menuStyle());

  readonly menuItems = computed(() => {
    const data = this.currentData();
    if (!data || !this._initialized()) return [];

    return [
      {
        label: 'ویرایش',
        icon: 'fa fa-edit scaleX-n1-rtl',
        iconClass: 'text-primary',
        visible: () => this.hasPermission('SV_Questions_Edit'),
        action: () => this.editQuestion()
      },
      {
        label: 'مشاهده آمار',
        icon: 'fa fa-chart-bar scaleX-n1-rtl',
        iconClass: 'text-info',
        visible: () => this.hasPermission('SV_Questions_ViewStatistics'),
        action: () => this.viewStatistics()
      },
      {
        label: 'حذف',
        icon: 'fa fa-trash scaleX-n1-rtl',
        iconClass: 'text-danger',
        visible: () => this.hasPermission('SV_Questions_Delete'),
        action: () => this.deleteQuestion()
      }
    ] as MenuItem[];
  });

  readonly visibleMenuItems = computed(() =>
    this.menuItems().filter(item => item.visible())
  );

  static activeOverlayRef: OverlayRef | null = null;

  async agInit(params: any): Promise<void> {
    this.params.set(params);
    await this.loadPermissions();
    this._initialized.set(true);
  }

  private async loadPermissions(): Promise<void> {
    const permissionsToCheck = [
      'SV_Questions_Edit',
      'SV_Questions_Delete',
      'SV_Questions_ViewStatistics'
    ];

    const newPermissions = new Set<string>();
    const results = await Promise.allSettled(
      permissionsToCheck.map(async (perm) => {
        const hasPermission = await this.passwordFlowService.checkPermission(perm);
        return { perm, hasPermission };
      })
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.hasPermission) {
        newPermissions.add(result.value.perm);
      }
    });

    this._permissions.set(newPermissions);
  }

  private hasPermission(permission: string): boolean {
    return this._permissions().has(permission);
  }

  toggleMenu(event: MouseEvent): void {
    if (QuestionOptionsCellComponent.activeOverlayRef) {
      QuestionOptionsCellComponent.activeOverlayRef.dispose();
      QuestionOptionsCellComponent.activeOverlayRef = null;
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
    QuestionOptionsCellComponent.activeOverlayRef = newOverlayRef;

    document.addEventListener('click', this.handleClickOutside, true);
  }

  closeMenu(): void {
    const overlay = this._overlayRef();
    if (overlay) {
      overlay.dispose();
      this._overlayRef.set(null);
      QuestionOptionsCellComponent.activeOverlayRef = null;
      document.removeEventListener('click', this.handleClickOutside, true);
    }
  }

  private handleClickOutside = (event: Event): void => {
    const overlay = this._overlayRef();
    if (overlay && !overlay.overlayElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  };

  editQuestion(): void {
    const data = this.currentData();
    const parent = this.contextParent();
    if (parent && data) {
      parent.editQuestion(data.guid);
    }
    this.closeMenu();
  }

  deleteQuestion(): void {
    const data = this.currentData();
    const parent = this.contextParent();
    if (parent && data) {
      parent.askForDelete(data.guid);
    }
    this.closeMenu();
  }

  viewStatistics(): void {
    const data = this.currentData();
    const parent = this.contextParent();
    if (parent && data) {
      parent.viewStatistics(data.guid);
    }
    this.closeMenu();
  }

  ngOnDestroy(): void {
    this.closeMenu();
  }
}
