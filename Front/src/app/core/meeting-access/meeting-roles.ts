/**
 * رجیستری نقش‌های جلسه در فرانت.
 * ─────────────────────────────────────────────────────────────────────────
 * جایگزین ده‌ها «roleId === 3» و «[1, 2, 3].includes(roleId)».
 * پیکربندی (کلید سیستمی + توانایی‌های هر نقش) هنگام شروع برنامه از
 * GET api/MeetingAccess/RoleConfig بارگذاری می‌شود و از صفحه «تنظیمات › نقش‌ها و دسترسی‌ها»
 * قابل تغییر است؛ پس با تغییر نقش‌ها نیازی به تغییر کد نیست.
 *
 * چون در قالب‌ها (HTML) هم استفاده می‌شود، به‌صورت یک شیء ثابت (static) پیاده شده است.
 */

export type MeetingRoleKey =
  | 'Custom' | 'Secretary' | 'NonMemberSecretary' | 'Chairman' | 'Observer' | 'Member' | 'Guest';

export type MeetingCapability =
  | 'ViewMeeting' | 'ViewAgenda' | 'ViewResolutions' | 'ViewMinutes' | 'ViewFiles' | 'ViewFollowUps'
  | 'EditMeeting' | 'ManageMembers' | 'ManageAgenda' | 'ManageAttendance' | 'ChangeStatus' | 'CancelMeeting' | 'UploadFiles'
  | 'ManageResolutions' | 'ManageAssignments' | 'DeleteResolutions'
  | 'WriteMinutes' | 'SignMinutes' | 'FinalApprove' | 'CommentOnMinutes'
  | 'AppointSubstitute' | 'Print' | 'ReceiveNotifications';

export interface RoleDefinition {
  roleId: number;
  title?: string;
  color?: string;
  isActive?: boolean;
  key: MeetingRoleKey;
  capabilities: MeetingCapability[];
  isUnique: boolean;
  countsAsMember: boolean;
  requiredSigner: boolean;
  order: number;
}

export interface CapabilityInfo { name: MeetingCapability; title: string; group: string; }
export interface RoleKeyInfo { value: number; name: MeetingRoleKey; title: string; }
export interface RoleConfig { roles: RoleDefinition[]; capabilities: CapabilityInfo[]; keys: RoleKeyInfo[]; }

const ALL_MANAGE: MeetingCapability[] = [
  'ViewMeeting', 'ViewAgenda', 'ViewResolutions', 'ViewMinutes', 'ViewFiles', 'ViewFollowUps',
  'EditMeeting', 'ManageMembers', 'ManageAgenda', 'ManageAttendance', 'ChangeStatus', 'CancelMeeting', 'UploadFiles',
  'ManageResolutions', 'ManageAssignments', 'DeleteResolutions', 'WriteMinutes', 'SignMinutes', 'CommentOnMinutes',
  'AppointSubstitute', 'Print', 'ReceiveNotifications',
];
const VIEW_ALL: MeetingCapability[] = ['ViewMeeting', 'ViewAgenda', 'ViewResolutions', 'ViewMinutes', 'ViewFiles', 'ViewFollowUps'];

/** پیش‌فرض = قرارداد قبلی پروژه؛ فقط تا وقتی پیکربندی سرور بارگذاری شود استفاده می‌شود. */
const DEFAULT_ROLES: RoleDefinition[] = [
  { roleId: 3, key: 'Chairman', capabilities: [...ALL_MANAGE, 'FinalApprove'], isUnique: true, countsAsMember: true, requiredSigner: true, order: 1 },
  { roleId: 1, key: 'Secretary', capabilities: ALL_MANAGE, isUnique: true, countsAsMember: true, requiredSigner: true, order: 2 },
  { roleId: 2, key: 'NonMemberSecretary', capabilities: ALL_MANAGE, isUnique: true, countsAsMember: false, requiredSigner: true, order: 3 },
  { roleId: 4, key: 'Observer', capabilities: [...VIEW_ALL, 'CommentOnMinutes', 'Print', 'ReceiveNotifications'], isUnique: false, countsAsMember: true, requiredSigner: false, order: 4 },
  { roleId: 5, key: 'Member', capabilities: [...VIEW_ALL, 'SignMinutes', 'CommentOnMinutes', 'AppointSubstitute', 'Print', 'ReceiveNotifications'], isUnique: false, countsAsMember: true, requiredSigner: false, order: 5 },
  { roleId: 6, key: 'Guest', capabilities: ['ViewMeeting', 'ViewAgenda', 'ReceiveNotifications'], isUnique: false, countsAsMember: false, requiredSigner: false, order: 6 },
];

const NONE = -1;

class MeetingRolesRegistry {
  private roles: RoleDefinition[] = DEFAULT_ROLES;
  private byId = new Map<number, RoleDefinition>();
  private capsById = new Map<number, Set<MeetingCapability>>();

  constructor() { this.load(DEFAULT_ROLES); }

  load(roles: RoleDefinition[] | null | undefined): void {
    this.roles = roles?.length ? roles : DEFAULT_ROLES;
    this.byId = new Map(this.roles.map(r => [r.roleId, r]));
    this.capsById = new Map(this.roles.map(r => [r.roleId, new Set(r.capabilities)]));
  }

  get all(): readonly RoleDefinition[] { return this.roles; }

  idOf(key: MeetingRoleKey): number { return this.roles.find(r => r.key === key)?.roleId ?? NONE; }
  get(roleId: number | null | undefined): RoleDefinition | undefined { return roleId == null ? undefined : this.byId.get(Number(roleId)); }
  keyOf(roleId: number | null | undefined): MeetingRoleKey { return this.get(roleId)?.key ?? 'Custom'; }

  // ── شناسه‌ها (برای مقداردهی فرم‌ها) ──────────────────────────
  get chairman(): number { return this.idOf('Chairman'); }
  get secretary(): number { return this.idOf('Secretary'); }
  get nonMemberSecretary(): number { return this.idOf('NonMemberSecretary'); }
  get observer(): number { return this.idOf('Observer'); }
  get member(): number { return this.idOf('Member'); }
  get guest(): number { return this.idOf('Guest'); }

  // ── پرسش‌های معنایی ────────────────────────────────────────
  is(roleId: number | null | undefined, key: MeetingRoleKey): boolean {
    return roleId != null && roleId !== NONE && this.idOf(key) === Number(roleId);
  }
  isChairman(roleId: number | null | undefined): boolean { return this.is(roleId, 'Chairman'); }
  isSecretary(roleId: number | null | undefined): boolean { return this.is(roleId, 'Secretary'); }
  isNonMemberSecretary(roleId: number | null | undefined): boolean { return this.is(roleId, 'NonMemberSecretary'); }
  isAnySecretary(roleId: number | null | undefined): boolean { return this.isSecretary(roleId) || this.isNonMemberSecretary(roleId); }
  isGuest(roleId: number | null | undefined): boolean { return this.is(roleId, 'Guest'); }
  isObserver(roleId: number | null | undefined): boolean { return this.is(roleId, 'Observer'); }

  /** دارای توانایی مشخص */
  can(roleId: number | null | undefined, capability: MeetingCapability): boolean {
    return roleId != null && (this.capsById.get(Number(roleId))?.has(capability) ?? false);
  }

  /** نقش‌های کلیدی جلسه: رئیس، دبیر، دبیر غیرعضو */
  isKeyRole(roleId: number | null | undefined): boolean { return this.isChairman(roleId) || this.isAnySecretary(roleId); }

  /** «مدیر جلسه» (رئیس/دبیرها به‌طور پیش‌فرض) = دارنده توانایی ویرایش جلسه */
  isManager(roleId: number | null | undefined): boolean { return this.can(roleId, 'EditMeeting'); }

  /** در هر جلسه فقط یک نفر می‌تواند این نقش را داشته باشد */
  isUnique(roleId: number | null | undefined): boolean { return this.get(roleId)?.isUnique ?? false; }

  /** در فهرست اعضای صورتجلسه/حد نصاب شمرده می‌شود (مهمان و دبیر غیرعضو: خیر) */
  countsAsMember(roleId: number | null | undefined): boolean { return this.get(roleId)?.countsAsMember ?? false; }

  isRequiredSigner(roleId: number | null | undefined): boolean { return this.get(roleId)?.requiredSigner ?? false; }

  /** عضو جلسه هست (شناسه نقش معتبر؛ 0 = عضو نیست، 999 = بیننده با دسترسی کل) */
  isMember(roleId: number | null | undefined): boolean { return this.get(roleId) !== undefined; }
}

export const MeetingRoles = new MeetingRolesRegistry();
