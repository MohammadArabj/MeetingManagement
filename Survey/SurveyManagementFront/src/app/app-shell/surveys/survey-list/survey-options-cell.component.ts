import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { NgClass } from '@angular/common';
import {
  Component,
  DestroyRef,
  TemplateRef,
  ViewContainerRef,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';
import { AgGridParams, MenuItem, SurveyData } from '../../../core/models/menuDtos';



@Component({
  selector: 'app-survey-options-cell',
  standalone: true,
  imports: [NgClass],
  template: `
    <button
      type="button"
      class="actBtn"
      (click)="toggleMenu($event)"
      [attr.aria-expanded]="overlayRef() ? 'true' : 'false'"
      aria-label="عملیات">
      <i class="fa fa-ellipsis-v"></i>
    </button>

    <ng-template #menuTemplate>
      <div
        class="actMenu"
        role="menu"
        (keydown)="onMenuKeydown($event)"
        (click)="$event.stopPropagation()">

        <div class="actHead">
          <div class="actHead__title">عملیات</div>

          <div class="actHead__meta">
            @if (currentData()?.status) {
              <span class="chip chip--muted">{{ currentData()!.status }}</span>
            }
            @if (currentData()?.totalQuestions !== undefined) {
              <span class="chip chip--info">
                {{ currentData()!.totalQuestions }} سوال
              </span>
            }
          </div>
        </div>

        <div class="actList">
          @for (item of visibleMenuItems(); track item.id) {
            <button
              type="button"
              class="actItem"
              role="menuitem"
              [class.is-danger]="item.danger"
              [class.is-highlight]="item.highlight"
              (click)="run(item)">
              <span class="actItem__ic" [ngClass]="toneClass(item.tone)">
                <i class="{{ item.icon }}"></i>
              </span>

              <span class="actItem__txt">{{ item.label }}</span>

              <span class="actItem__chev">
                <i class="fa fa-angle-left"></i>
              </span>
            </button>
          }

          @if (visibleMenuItems().length === 0) {
            <div class="actEmpty">
              <i class="fa fa-info-circle"></i>
              <span>گزینه‌ای برای نمایش وجود ندارد</span>
            </div>
          }
        </div>

        <div class="actFoot">
          <span class="hint">
            <i class="fa fa-keyboard"></i>
            Esc بستن • Enter انتخاب
          </span>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    :host{
      --p: var(--primary, #1d4ed8);
      --a: var(--accent, #ff4d6d);
      --ink: var(--ink, #0f172a);
      --muted: var(--muted, #64748b);
      --line: var(--line, rgba(148,163,184,.35));
      --sahel: var(--font-sahel, "Sahel","Vazirmatn","IRANSans",system-ui,-apple-system,"Segoe UI",Arial);
      display:inline-flex;
      align-items:center;
      justify-content:center;
    }

    /* ===== Button (grid action) ===== */
    .actBtn{
      width: 34px;
      height: 34px;
      border-radius: 12px;
      border: 1px solid rgba(148,163,184,.28);
      background: rgba(255,255,255,.70);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease;
      color: var(--ink);
      user-select:none;
    }
    .actBtn:hover{
      transform: translateY(-1px);
      background: rgba(255,255,255,.92);
      border-color: rgba(29,78,216,.35);
      box-shadow: 0 10px 25px rgba(15,23,42,.10);
    }
    .actBtn:active{ transform: translateY(0); }
    .actBtn:focus{
      outline:none;
      box-shadow: 0 0 0 4px rgba(29,78,216,.14);
      border-color: rgba(29,78,216,.45);
    }
    .actBtn i{ font-size: 14px; }

    /* ===== Backdrop for Overlay ===== */
    :global(.actBackdrop){
      background: rgba(15,23,42,.10);
      backdrop-filter: blur(2px);
    }

    /* ===== Menu container ===== */
    .actMenu{
      width: 280px;
      border-radius: 18px;
      border: 1px solid rgba(148,163,184,.30);
      background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(255,255,255,.78));
      box-shadow: 0 18px 55px rgba(15,23,42,.18);
      overflow: hidden;
      direction: rtl;
      animation: pop .12s ease-out;
    }
    @keyframes pop{
      from{ transform: translateY(6px) scale(.98); opacity:.0; }
      to{ transform: translateY(0) scale(1); opacity:1; }
    }

    /* Sahel فقط برای متن‌های منو */
    .actMenu,
    .actMenu button,
    .actMenu span,
    .actMenu div{
      font-family: var(--sahel) !important;
    }
    /* آیکون‌ها را خراب نکن */
    .actMenu i.fa, .actMenu i.fas, .actMenu i.far, .actMenu i.fab,
    .actMenu i[class^="fa"], .actMenu i[class*=" fa-"]{
      font-family: var(--fa-style-family, "Font Awesome 6 Free","Font Awesome 5 Free","FontAwesome") !important;
    }

    .actHead{
      padding: 12px 14px;
      border-bottom: 1px solid rgba(148,163,184,.22);
      backdrop-filter: blur(10px);
    }
    .actHead__title{
      font-weight: 950;
      color: var(--ink);
      font-size: 14px;
      line-height: 1.1;
    }
    .actHead__meta{ margin-top: 8px; display:flex; gap:8px; align-items:center; }

    .chip{
      display:inline-flex;
      align-items:center;
      gap:6px;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 900;
      border: 1px solid rgba(148,163,184,.25);
      background: rgba(100,116,139,.10);
      color: #334155;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chip--muted{ background: rgba(100,116,139,.10); }
    .chip--info{ background: rgba(59,130,246,.10); color: #1d4ed8; border-color: rgba(59,130,246,.25); }

    .actList{
      padding: 10px;
      display: grid;
      gap: 8px;
    }

    .actItem{
      width: 100%;
      border: 1px solid rgba(148,163,184,.18);
      background: rgba(255,255,255,.68);
      border-radius: 14px;
      padding: 10px 10px;
      display: grid;
      grid-template-columns: 40px 1fr 18px;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      transition: transform .15s ease, border-color .15s ease, background .15s ease, box-shadow .15s ease;
      color: var(--ink);
      text-align: right;
      user-select:none;
    }
    .actItem:hover{
      background: rgba(29,78,216,.06);
      border-color: rgba(29,78,216,.26);
      transform: translateY(-1px);
      box-shadow: 0 10px 24px rgba(15,23,42,.08);
    }
    .actItem:active{ transform: translateY(0); }
    .actItem:focus{
      outline:none;
      box-shadow: 0 0 0 4px rgba(29,78,216,.12);
      border-color: rgba(29,78,216,.40);
    }

    .actItem__ic{
      width: 40px;
      height: 40px;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(148,163,184,.12);
      border: 1px solid rgba(148,163,184,.20);
    }
    .actItem__ic i{ font-size: 15px; }

    .actItem__txt{
      font-weight: 950;
      font-size: 13px;
      color: var(--ink);
      line-height: 1.2;
    }
    .actItem__chev{
      color: rgba(100,116,139,.85);
      display:flex;
      justify-content:flex-start;
    }

    /* Danger item */
    .actItem.is-danger{
      border-color: rgba(239,68,68,.22);
      background: rgba(239,68,68,.05);
    }
    .actItem.is-danger:hover{
      background: rgba(239,68,68,.08);
      border-color: rgba(239,68,68,.35);
    }

    /* Highlight item (برای آیتم‌های مهم مثل "افزودن سوالات") */
    .actItem.is-highlight{
      border-color: rgba(245,158,11,.28);
      background: rgba(245,158,11,.08);
    }
    .actItem.is-highlight:hover{
      background: rgba(245,158,11,.12);
      border-color: rgba(245,158,11,.40);
    }
    .actItem.is-highlight .actItem__ic{
      background: rgba(245,158,11,.15);
      border-color: rgba(245,158,11,.30);
    }

    /* tones */
    .tone-primary{ color:#1d4ed8; }
    .tone-info{ color:#0ea5e9; }
    .tone-success{ color:#22c55e; }
    .tone-warning{ color:#f59e0b; }
    .tone-danger{ color:#ef4444; }
    .tone-muted{ color:#64748b; }

    .actEmpty{
      display:flex;
      align-items:center;
      gap:10px;
      padding: 12px 12px;
      border-radius: 14px;
      border: 1px dashed rgba(148,163,184,.35);
      background: rgba(255,255,255,.55);
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
    }

    .actFoot{
      padding: 10px 14px;
      border-top: 1px solid rgba(148,163,184,.18);
      background: rgba(255,255,255,.62);
    }
    .hint{
      display:flex;
      align-items:center;
      gap:8px;
      color: var(--muted);
      font-size: 11.5px;
      font-weight: 800;
    }
  `]
})
export class SurveyOptionsCellComponent {
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly destroyRef = inject(DestroyRef);

  readonly menuTemplate = viewChild.required<TemplateRef<any>>('menuTemplate');

  params = signal<AgGridParams | null>(null);

  private readonly _permissions = signal<Set<string>>(new Set());
  private readonly _overlayRef = signal<OverlayRef | null>(null);
  private _lastTriggerEl: HTMLElement | null = null;

  readonly overlayRef = computed(() => this._overlayRef());
  readonly currentData = computed(() => this.params()?.data);
  readonly contextParent = computed(() => this.params()?.context?.componentParent);

  // فقط یکی از منوها باز باشد
  static activeOverlayRef: OverlayRef | null = null;

  // کش پرمیشن‌ها برای اینکه روی هر ردیف دوباره چک نشود
  private static permissionsCache: Set<string> | null = null;
  private static permissionsPromise: Promise<Set<string>> | null = null;

  readonly menuItems = computed<MenuItem[]>(() => {
    const data = this.currentData();
    if (!data) return [];

    const totalQuestions = data.totalQuestions ?? 0;
    const hasNoQuestions = totalQuestions === 0;

    return [
      {
        id: 'edit',
        // ویرایش: مدیر سامانه همیشه؛ مالک فقط پیش از انتشار (سرور canEdit را تعیین می‌کند)
        label: (data as any).canEdit === false ? 'مشاهده' : 'ویرایش',
        icon: (data as any).canEdit === false ? 'fa fa-eye' : 'fa fa-edit scaleX-n1-rtl',
        tone: 'primary',
        visible: () => true,
        action: () => this.viewDetails()
      },

      // ⭐ گزینه مدیریت سوالات
      {
        id: 'questions',
        label: this.getQuestionsLabel(data),
        icon: 'fa fa-list-ol scaleX-n1-rtl',
        tone: hasNoQuestions ? 'warning' : 'primary',
        highlight: hasNoQuestions, // ⭐ هایلایت اگر سوالی نداشته باشد
        visible: () => this.hasPermission('SV_Questions'),
        action: () => this.manageQuestions()
      },

      {
        id: 'publish',
        label: 'انتشار',
        icon: 'fa fa-paper-plane scaleX-n1-rtl',
        tone: 'success',
        visible: () => this.hasPermission('SV_Surveys_Publish') && data.statusEnum === 1,
        action: () => this.changeStatus('publish')
      },
      {
        id: 'activate',
        label: 'فعال‌سازی',
        icon: 'fa fa-play scaleX-n1-rtl',
        tone: 'info',
        visible: () => this.hasPermission('SV_Surveys_Activate') && data.statusEnum === 3,
        action: () => this.changeStatus('activate')
      },
      // {
      //   id: 'pause',
      //   label: 'متوقف کردن',
      //   icon: 'fa fa-pause scaleX-n1-rtl',
      //   tone: 'warning',
      //   visible: () => this.hasPermission('SV_Surveys_Pause') && data.statusEnum === 2,
      //   action: () => this.changeStatus('pause')
      // },
      {
        id: 'close',
        label: 'بستن',
        icon: 'fa fa-stop scaleX-n1-rtl',
        tone: 'danger',
        visible: () => this.hasPermission('SV_Surveys_Close') && data.statusEnum === 2,
        action: () => this.changeStatus('close')
      },
      {
        id: 'archive',
        label: 'آرشیو',
        icon: 'fa fa-archive scaleX-n1-rtl',
        tone: 'muted',
        visible: () => this.hasPermission('SV_Surveys_Archive') && data.statusEnum === 4,
        action: () => this.changeStatus('archive')
      },
      {
        id: 'stats',
        label: 'مشاهده آمار',
        icon: 'fa fa-chart-bar scaleX-n1-rtl',
        tone: 'info',
        visible: () => this.hasPermission('SV_Surveys_ViewStatistics'),
        action: () => this.viewStatistics()
      },
      {
        id: 'responses',
        label: 'مشاهده پاسخ‌ها',
        icon: 'fa fa-list scaleX-n1-rtl',
        tone: 'primary',
        visible: () => this.hasPermission('SV_Surveys_ViewResponses'),
        action: () => this.viewResponses()
      },
      {
        id: 'responses',
        label: 'انتشار نظرسنجی',
        icon: 'fa fa-paper-plane scaleX-n1-rtl',
        tone: 'primary',
        visible: () => this.hasPermission('SV_Surveys_Archive') && data.statusEnum === 2,
        action: () => this.viewPublishResult()
      },
      {
        id: 'delete',
        label: 'حذف',
        icon: 'fa fa-trash scaleX-n1-rtl',
        tone: 'danger',
        danger: true,
        visible: () => this.hasPermission('SV_Surveys_Delete') && data.statusEnum === 1,
        action: () => this.deleteSurvey()
      }
    ];
  });

  readonly visibleMenuItems = computed(() => this.menuItems().filter(x => x.visible()));

  async agInit(params: AgGridParams): Promise<void> {
    this.params.set(params);
    await this.ensurePermissionsLoaded();
  }

  refresh(): boolean {
    return true;
  }

  private async ensurePermissionsLoaded(): Promise<void> {
    if (SurveyOptionsCellComponent.permissionsCache) {
      this._permissions.set(SurveyOptionsCellComponent.permissionsCache);
      return;
    }

    if (!SurveyOptionsCellComponent.permissionsPromise) {
      const permissionsToCheck = [
        'SV_Surveys_Create',
        'SV_Surveys_Edit',
        'SV_Surveys_Delete',
        'SV_Surveys_Publish',
        'SV_Surveys_Activate',
        'SV_Surveys_Pause',
        'SV_Surveys_Close',
        'SV_Surveys_Archive',
        'SV_Surveys_ViewStatistics',
        'SV_Surveys_ViewResponses',
        'SV_Questions'  // ⭐ پرمیشن جدید
      ];

      SurveyOptionsCellComponent.permissionsPromise = (async () => {
        const set = new Set<string>();
        const results = await Promise.allSettled(
          permissionsToCheck.map(async (perm) => {
            const ok = await this.passwordFlowService.checkPermission(perm);
            return { perm, ok };
          })
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value.ok) set.add(r.value.perm);
        }
        return set;
      })();
    }

    const resolved = await SurveyOptionsCellComponent.permissionsPromise;
    SurveyOptionsCellComponent.permissionsCache = resolved;
    this._permissions.set(resolved);
  }

  private hasPermission(permission: string): boolean {
    return this._permissions().has(permission);
  }

  /**
   * ⭐ تولید label هوشمند برای گزینه سوالات
   */
  private getQuestionsLabel(data: SurveyData): string {
    const total = data.totalQuestions ?? 0;

    if (total === 0) {
      return '⚠️ افزودن سوالات';
    } else if (total === 1) {
      return 'مدیریت سوالات (۱ سوال)';
    } else {
      // تبدیل اعداد انگلیسی به فارسی
      const persianNumber = this.toPersianNumber(total);
      return `مدیریت سوالات (${persianNumber} سوال)`;
    }
  }

  /**
   * Helper: تبدیل عدد انگلیسی به فارسی
   */
  private toPersianNumber(num: number): string {
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().replace(/\d/g, (d) => persianDigits[+d]);
  }

  toneClass(tone: MenuItem['tone']): string {
    return {
      primary: 'tone-primary',
      info: 'tone-info',
      success: 'tone-success',
      warning: 'tone-warning',
      danger: 'tone-danger',
      muted: 'tone-muted'
    }[tone];
  }

  toggleMenu(event: MouseEvent): void {
    const trigger = event.currentTarget as HTMLElement;
    this._lastTriggerEl = trigger;

    // بستن منوی قبلی (اگر باز است)
    if (SurveyOptionsCellComponent.activeOverlayRef) {
      SurveyOptionsCellComponent.activeOverlayRef.dispose();
      SurveyOptionsCellComponent.activeOverlayRef = null;
    }

    // اگر همین منو باز بود، ببند
    if (this._overlayRef()) {
      this.closeMenu();
      return;
    }

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(trigger)
      .withFlexibleDimensions(false)
      .withPush(true)
      .withViewportMargin(8)
      .withPositions([
        { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
        { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' }
      ]);

    const ref = this.overlay.create({
      positionStrategy,
      hasBackdrop: true,
      backdropClass: 'actBackdrop',
      scrollStrategy: this.overlay.scrollStrategies.reposition()
    });

    ref.backdropClick().subscribe(() => this.closeMenu());
    ref.keydownEvents().subscribe((e) => {
      if (e.key === 'Escape') this.closeMenu();
    });

    const portal = new TemplatePortal(this.menuTemplate(), this.viewContainerRef);
    ref.attach(portal);

    this._overlayRef.set(ref);
    SurveyOptionsCellComponent.activeOverlayRef = ref;

    // فوکوس روی اولین آیتم
    queueMicrotask(() => this.focusFirstItem(ref));
  }

  private focusFirstItem(ref: OverlayRef): void {
    const first = ref.overlayElement.querySelector<HTMLElement>('.actItem');
    first?.focus();
  }

  closeMenu(): void {
    const ref = this._overlayRef();
    if (ref) {
      ref.dispose();
      this._overlayRef.set(null);
      if (SurveyOptionsCellComponent.activeOverlayRef === ref) {
        SurveyOptionsCellComponent.activeOverlayRef = null;
      }
    }
    // بازگرداندن فوکوس به دکمه
    this._lastTriggerEl?.focus();
  }

  onMenuKeydown(ev: KeyboardEvent): void {
    const ref = this._overlayRef();
    if (!ref) return;

    const items = Array.from(ref.overlayElement.querySelectorAll<HTMLElement>('.actItem'));
    if (!items.length) return;

    const idx = Math.max(0, items.indexOf(document.activeElement as HTMLElement));

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (ev.key === 'Home') {
      ev.preventDefault();
      items[0].focus();
    } else if (ev.key === 'End') {
      ev.preventDefault();
      items[items.length - 1].focus();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      this.closeMenu();
    }
  }

  run(item: MenuItem): void {
    item.action();
    this.closeMenu();
  }

  private viewDetails(): void {
    const data = this.currentData();
    const parent = this.contextParent();
    if (parent && data) parent.goToSurveyDetails(data.guid);
  }

  private changeStatus(action: string): void {
    const data = this.currentData();
    const parent = this.contextParent();
    if (parent && data) parent.changeStatus(data.guid, action);
  }

  private deleteSurvey(): void {
    const data = this.currentData();
    const parent = this.contextParent();
    if (parent && data) parent.askForDelete(data.guid);
  }

  private viewStatistics(): void {
    const data = this.currentData();
    const parent = this.contextParent();
    if (parent && data) parent.viewStatistics(data.guid);
  }

  private viewResponses(): void {
    const data = this.currentData();
    const parent = this.contextParent();
    if (parent && data) parent.viewResponses(data.guid);
  }
  private viewPublishResult(): void {
    const data = this.currentData();
    const parent = this.contextParent();
    if (parent && data) parent.viewPublishResult(data.guid);
  }
  /**
   * ⭐ مدیریت سوالات نظرسنجی
   */
  private manageQuestions(): void {
    const data = this.currentData();
    const parent = this.contextParent();
    if (parent && data) parent.manageQuestions(data.guid);
  }

  ngOnDestroy(): void {
    this.closeMenu();
  }
}