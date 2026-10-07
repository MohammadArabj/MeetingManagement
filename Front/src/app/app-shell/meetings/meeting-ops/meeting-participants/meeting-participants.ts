import {
  Component,
  ElementRef,
  input,
  signal,
  computed,
  effect,
  inject,
  DestroyRef,
  viewChild,
  output,
  OnInit,
  OnDestroy,
  untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Collapse } from 'bootstrap';

import { MeetingMember } from './../../../../core/models/Meeting';
import { SystemUser } from '../../../../core/models/User';
import { ConflictItem } from '../../../../core/types/conflict-result';
import { ComboBase } from '../../../../shared/combo-base';
import { BoardMember } from '../../../../core/models/BoardMember';
import { CreatType } from '../../../../core/types/enums';

import { RoleService } from '../../../../services/role.service';
import { generateGuid } from '../../../../core/types/configuration';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';

import { DEFAULT_AVATAR, MemberConflictType, MemberIdentity, ProcessedMember } from './meeting-participants.models';
import {
  areMembersEqual,
  createMemberIdentity,
  createNewMemberFromUser,
  filterSelectableUsers,
  findMemberConflict,
  getActiveSourceIds,
  getDefaultRoles,
  getRoleColor,
  getRoleTitle,
  getSystemUserImage,
  getUserCompositeKey,
  hasDataChanged,
  hasMemberConflict,
  hasRealMemberChanges,
  sortMembers,
  toPlainMembers
} from './meeting-participants.helpers';
import { ParticipantMemberCardComponent } from './participant-member-card/participant-member-card';
import { ParticipantGuestModalComponent } from './participant-guest-modal/participant-guest-modal';
import { ConflictDetailModalComponent } from './conflict-detail-modal/conflict-detail-modal';
import { MemberImagesService } from './member-images.service';

@Component({
  selector: 'app-meeting-participants',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    ParticipantMemberCardComponent,
    ParticipantGuestModalComponent,
    ConflictDetailModalComponent
  ],
  providers: [MemberImagesService],
  standalone: true,
  templateUrl: './meeting-participants.html',
  styleUrls: ['./meeting-participants.css']
})
export class MeetingParticipantsComponent implements OnInit, OnDestroy {
  /** رجیستری نقش‌ها برای استفاده در قالب (به‌جای roleId های ثابت) */
  protected readonly meetingRoles = MeetingRoles;


  // ===== DEPENDENCY INJECTION =====
  private readonly roleService = inject(RoleService);
  /** لود و cache تصاویر اعضا (TUS) */
  private readonly images = inject(MemberImagesService);
  private readonly destroyRef = inject(DestroyRef);

  // ===== INPUT SIGNALS =====
  readonly selectedMembers = input<MeetingMember[]>([]);
  readonly conflictedUsers = input<ConflictItem[]>([]);
  readonly availableSystemUsers = input<SystemUser[]>([]);
  readonly allUsesrs = input<SystemUser[]>([]);
  readonly availableBoardMembers = input<BoardMember[]>([]);
  readonly isBoardMeeting = input<boolean>(false);
  readonly operationMode = input<CreatType>(CreatType.Create);
  readonly allSystemUsers = input<SystemUser[]>([]);
  // ===== OUTPUT SIGNALS =====
  readonly membersUpdated = output<MeetingMember[]>();
  readonly conflictCheckRequested = output<string>();
  readonly fileStorageUpdated = output<any>();

  // ===== VIEW CHILD SIGNALS =====
  readonly searchBox = viewChild<ElementRef>('searchBox');
  /** مودال افزودن/ویرایش مهمان */
  private readonly guestModal = viewChild(ParticipantGuestModalComponent);

  // ===== PRIVATE SIGNALS =====
  private readonly _processedMembers = signal<ProcessedMember[]>([]);
  private readonly _roles = signal<ComboBase[]>([]);
  private readonly _searchQuery = signal<string>('');
  private readonly _dropdownVisible = signal<boolean>(false);
  private readonly _fileStorage = signal<{ [key: string]: { profile?: File; signature?: File } }>({});
  private readonly _isInitialized = signal<boolean>(false);
  readonly roles = this._roles.asReadonly();
  // ─── conflict detail ───
  private readonly _selectedConflictItem = signal<ConflictItem | null>(null);
  readonly selectedConflictItem = this._selectedConflictItem.asReadonly();

  // ─── substitute modal ───
  private readonly _substituteModalMemberGuid = signal<string | null>(null);
  private readonly _substituteSearchQuery = signal<string>('');
  private readonly _selectedSubstitute = signal<SystemUser | null>(null);
  private readonly _substituteDropdownVisible = signal<boolean>(false);

  readonly substituteModalMemberGuid = this._substituteModalMemberGuid.asReadonly();
  readonly selectedSubstitute = this._selectedSubstitute.asReadonly();
  readonly substituteDropdownVisible = this._substituteDropdownVisible.asReadonly();
  readonly substituteSearchQuery = this._substituteSearchQuery.asReadonly();

  // ===== PUBLIC COMPUTED SIGNALS =====
  readonly activeMembers = computed(() => {
    const members = this._processedMembers();
    const mode = this.operationMode();

    if (mode === CreatType.Create) {
      // در حالت ایجاد، فقط اعضای غیر حذف شده
      return members;
    } else {
      // در حالت ویرایش، همه اعضا (برای نمایش تاریخچه)
      return members.filter(m => !m.isRemoved);
    }
  });

  /** sourceId اعضای فعال (composite) - برای فیلتر نتایج جستجو در مودال مهمان */
  readonly activeSourceIds = computed(() => getActiveSourceIds(this._processedMembers()));

  readonly filteredSubstitutes = computed(() => {
    const query = this._substituteSearchQuery().toLowerCase().trim();
    const systemUsers = this.allSystemUsers();
    const processed = this._processedMembers();

    if (!systemUsers?.length) return [];

    const activeIds = getActiveSourceIds(processed);

    return systemUsers
      .filter(user => {
        const key = getUserCompositeKey(user);
        const fullText = `${user.name} ${user.position}`.toLowerCase();
        return !activeIds.has(key) && (!query || fullText.includes(query));
      })
      .slice(0, 20);
  });
  // ─── نمایش جزئیات تداخل ───
  showConflictDetails(conflict: ConflictItem): void {
    this._selectedConflictItem.set(conflict);
    try {
      const el = document.getElementById('conflictDetailModal');
      if (el) new (window as any).bootstrap.Modal(el).show();
    } catch (e) { console.error(e); }
  }

  // ─── جانشین ───
  openSubstituteModal(memberGuid: string): void {
    this._substituteModalMemberGuid.set(memberGuid);
    this._substituteSearchQuery.set('');
    this._selectedSubstitute.set(null);
    try {
      const el = document.getElementById('substituteModal');
      if (el) new (window as any).bootstrap.Modal(el).show();
    } catch (e) { console.error(e); }
  }

  onSubstituteSearch(event: Event): void {
    this._substituteSearchQuery.set((event.target as HTMLInputElement).value);
    this._substituteDropdownVisible.set(true);
  }

  showSubstituteDropdown(): void { this._substituteDropdownVisible.set(true); }
  hideSubstituteDropdown(): void {
    setTimeout(() => this._substituteDropdownVisible.set(false), 200);
  }

  selectSubstituteUser(user: SystemUser): void {
    this._selectedSubstitute.set(user);
    this._substituteSearchQuery.set(user.name);
    this._substituteDropdownVisible.set(false);
  }

  assignSubstitute(): void {
    const memberGuid = this._substituteModalMemberGuid();
    const substitute = this._selectedSubstitute();
    if (!memberGuid || !substitute) return;

    const current = this._processedMembers();
    const idx = current.findIndex(m => m.guid === memberGuid);
    if (idx === -1) return;

    const updated = [...current];
    updated[idx] = {
      ...updated[idx],
      replacementUserGuid: substitute.baseUserGuid ?? substitute.guid,
      substitute: substitute.name
    };

    this._processedMembers.set(updated);
    this.emitMembersUpdated();
    this.hideSubstituteModal_();
  }

  removeSubstitute(memberGuid: string): void {
    const current = this._processedMembers();
    const idx = current.findIndex(m => m.guid === memberGuid);
    if (idx === -1) return;

    const updated = [...current];
    updated[idx] = { ...updated[idx], replacementUserGuid: undefined, substitute: undefined };
    this._processedMembers.set(updated);
    this.emitMembersUpdated();
  }

  private hideSubstituteModal_(): void {
    try {
      const el = document.getElementById('substituteModal');
      if (el) (window as any).bootstrap.Modal.getInstance(el)?.hide();
    } catch (e) { console.error(e); }
  }
  // به‌روزرسانی availableMembers computed (activeIds بر اساس sourceId composite)
  readonly availableMembers = computed(() => {
    const query = this._searchQuery().toLowerCase().trim();
    const isVisible = this._dropdownVisible();
    const systemUsers = this.availableSystemUsers(); // processed
    const boardMembers = this.availableBoardMembers();
    const isBoardMeeting = this.isBoardMeeting();
    const processedMembers = this._processedMembers();

    if (!isVisible) return [];

    // activeIds بر اساس sourceId (composite برای جلوگیری از duplicate سمت)
    const activeIds = getActiveSourceIds(processedMembers);

    let availableUsers: SystemUser[] = [];
    availableUsers = systemUsers;

    return filterSelectableUsers(availableUsers, activeIds, query, user => `${user.guid || ''}`);
  });

  private addMemberToList(newMember: ProcessedMember): void {
    const currentMembers = this._processedMembers();

    // بررسی تکراری بر اساس sourceId (composite برای اجازه انتخاب سمت‌های مختلف)
    const existingIndex = currentMembers.findIndex(m =>
      m.identity.sourceId === newMember.identity.sourceId
    );

    if (existingIndex !== -1) {
      const existingMember = currentMembers[existingIndex];
      if (existingMember.isRemoved) {
        // بازگردانی عضو حذف شده: حذف از موقعیت فعلی و اضافه کردن به انتها
        const updatedMembers = [...currentMembers];
        updatedMembers.splice(existingIndex, 1);
        const restoredMember = { ...existingMember, isRemoved: false };
        updatedMembers.push(restoredMember);
        sortMembers(updatedMembers);
        this._processedMembers.set(updatedMembers);
      }
      else {
        if (MeetingRoles.isGuest(newMember.roleId)) {
          const currentMembers = [...this._processedMembers()];
          var currentMember = currentMembers[existingIndex];
          newMember.id = currentMember.id;
          currentMembers[existingIndex] = newMember;
          sortMembers(currentMembers);
          this._processedMembers.set(currentMembers);
          this.emitMembersUpdated();
        }
        else return;
      }
    } else {
      // اضافه کردن عضو جدید
      const updatedMembers = [...currentMembers, newMember];
      sortMembers(updatedMembers);
      this._processedMembers.set(updatedMembers);
    }

    this.emitMembersUpdated();
  }

  // بقیه متدها unchanged، چون منطق conflict و userGuid اصلی حفظ می‌شه (emit از userKey base، hasConflict از userGuid اصلی)

  // ===== LIFECYCLE METHODS =====
  constructor() {
    this.images.bind(this._processedMembers, () => this.availableBoardMembers());
    this.loadRoles();
    this.setupEffects();
  }

  ngOnInit(): void {
    this._isInitialized.set(true);
    this.syncWithInputMembers();
  }

  ngOnDestroy(): void {
    this.images.cleanupBlobUrls();
  }

  // ===== INITIALIZATION METHODS =====
  private loadRoles(): void {
    this.roleService.getForCombo<ComboBase[]>()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this._roles.set(data || getDefaultRoles());
        },
        error: (error) => {
          console.error('Error loading roles:', error);
          this._roles.set(getDefaultRoles());
        }
      });
  }

  // ===== EFFECTS SETUP =====
  private setupEffects(): void {
    // Sync with input changes
    effect(() => {
      const inputMembers = this.selectedMembers();
      if (this._isInitialized() && inputMembers) {
        untracked(() => this.syncWithInputMembers());
      }
    });
    // Update when available members change
    effect(() => {
      const systemUsers = this.availableSystemUsers();
      const boardMembers = this.availableBoardMembers();

      if (this._isInitialized() && (systemUsers.length > 0 || boardMembers.length > 0)) {
        this.validateAndUpdateMembers();
      }
    });
  }

  removeMember(memberGuid: string): void {
    const currentMembers = this._processedMembers();
    const memberIndex = currentMembers.findIndex(m => m.guid === memberGuid);

    if (memberIndex === -1) return;

    const operationMode = this.operationMode();

    if (operationMode === CreatType.Create) {
      // در حالت ایجاد: حذف کامل
      const updatedMembers = currentMembers.filter((_, index) => index !== memberIndex);
      this._processedMembers.set(updatedMembers);
    } else {
      // در حالت ویرایش: علامت‌گذاری برای حذف
      const updatedMembers = [...currentMembers];
      updatedMembers[memberIndex] = {
        ...updatedMembers[memberIndex],
        isRemoved: true
      };
      this._processedMembers.set(updatedMembers);
    }

    this.emitMembersUpdated();
  }

  changeRole(member: ProcessedMember, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const selectedRole = parseInt(target.value, 10);

    if (isNaN(selectedRole)) return;

    const currentMembers = this._processedMembers();
    const memberIndex = currentMembers.findIndex(m => m.guid === member.guid);

    if (memberIndex === -1) return;

    const updatedMembers = [...currentMembers];

    // تغییر نقش
    updatedMembers[memberIndex] = {
      ...updatedMembers[memberIndex],
      roleId: selectedRole
    };

    // مدیریت تداخلات نقش‌های منحصر به فرد
    if (MeetingRoles.isUnique(selectedRole)) {
      updatedMembers.forEach((m, index) => {
        if (index !== memberIndex && m.roleId === selectedRole && !m.isRemoved) {
          updatedMembers[index] = { ...m, roleId: MeetingRoles.member }; // تبدیل به عضو عادی
        }
      });
    }

    sortMembers(updatedMembers);
    this._processedMembers.set(updatedMembers);
    this.emitMembersUpdated();
  }

  // ===== GUEST MANAGEMENT (مودال در ParticipantGuestModalComponent) =====

  /** مهمان جدید/ویرایش‌شده از مودال مهمان */
  protected onGuestSaved(newGuest: ProcessedMember): void {
    this.addMemberToList(newGuest);
  }

  editMember(member: ProcessedMember): void {
    if (!MeetingRoles.isGuest(member.roleId)) return;

    this.guestModal()?.editGuest(member);
  }

  showGuestModal(): void {
    this.guestModal()?.show();
  }

  // ===== SEARCH FUNCTIONALITY =====
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this._searchQuery.set(input.value);
    this._dropdownVisible.set(true);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const filtered = this.availableMembers();
      if (filtered.length > 0) {
        this.selectMember(filtered[0]);
      }
    }
  }

  private clearSearch(): void {
    this._searchQuery.set('');
    this._dropdownVisible.set(false);
    const searchBoxRef = this.searchBox();
    if (searchBoxRef?.nativeElement) {
      searchBoxRef.nativeElement.value = '';
    }
  }

  private emitMembersUpdated(): void {
    // حذف identity از object قبل از emit (چون parent component نیازی نداره)
    this.membersUpdated.emit(toPlainMembers(this._processedMembers()));
  }

  // ===== DROPDOWN MANAGEMENT =====
  showDropdown(): void {
    this._dropdownVisible.set(true);
  }

  hideDropdown(): void {
    setTimeout(() => this._dropdownVisible.set(false), 200);
  }

  shouldShowDropdown(): boolean {
    return this._dropdownVisible();
  }

  // ===== ROLE MANAGEMENT =====
  getRoleColor(roleId: number): string {
    return getRoleColor(this._roles(), roleId);
  }

  getRoleTitle(roleId: number): string {
    return getRoleTitle(this._roles(), roleId);
  }

  // ===== UI UTILITIES =====
  toggleCollapse(id: string): void {
    const collapseElement = document.getElementById(`collapse-${id}`);
    if (collapseElement) {
      try {
        const bsCollapse = new Collapse(collapseElement, { toggle: false });

        if (collapseElement.classList.contains('show')) {
          bsCollapse.hide();
        } else {
          bsCollapse.show();
        }
      } catch (error) {
        console.error('Error toggling collapse:', error);
      }
    }
  }

  hasGuestMembers(): boolean {
    return this.activeMembers().some(member => MeetingRoles.isGuest(member.roleId));
  }

  trackByMemberGuid(index: number, member: ProcessedMember): string {
    return `${member.guid}_${member.roleId}`;
  }

  // ===== PUBLIC API FOR PARENT COMPONENT =====

  /**
   * متد عمومی برای اعتبارسنجی یکپارچگی اعضا
   */
  validateMembersIntegrity(): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
    invalidMembers: ProcessedMember[];
  } {
    const members = this._processedMembers();
    const warnings: string[] = [];
    const errors: string[] = [];
    const invalidMembers: ProcessedMember[] = [];

    members.forEach(member => {
      if (member.isRemoved) return;

      if (!member.isValidated) {
        invalidMembers.push(member);

        if (member.identity.type === 'system') {
          errors.push(`کاربر "${member.name}" در سیستم یافت نشد`);
        } else if (member.identity.type === 'board') {
          errors.push(`عضو هیئت مدیره "${member.name}" در سیستم یافت نشد`);
        }
      }

      // بررسی تغییرات احتمالی (برای حالت کپی یا ویرایش طولانی مدت)
      const currentData = this.getCurrentMemberData(member);
      if (currentData && hasDataChanged(member, currentData)) {
        warnings.push(`اطلاعات "${member.name}" تغییر کرده است`);
      }
    });

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      invalidMembers
    };
  }

  private getCurrentMemberData(member: ProcessedMember): any {
    const { identity } = member;

    if (identity.type === 'system') {
      return this.availableSystemUsers().find(u => u.guid === identity.sourceId);
    } else if (identity.type === 'board') {
      return this.availableBoardMembers().find(bm =>
        bm.guid === identity.sourceId
      );
    }

    return null;
  }

  /**
   * متد عمومی برای دریافت خلاصه وضعیت اعضا
   */
  getMembersSummary(): {
    total: number;
    active: number;
    removed: number;
    byRole: { [roleId: number]: number };
    hasChairman: boolean;
    hasSecretary: number;
  } {
    const members = this._processedMembers();
    const activeMembers = members.filter(m => !m.isRemoved);

    const byRole: { [roleId: number]: number } = {};
    activeMembers.forEach(member => {
      byRole[member.roleId] = (byRole[member.roleId] || 0) + 1;
    });

    return {
      total: members.length,
      active: activeMembers.length,
      removed: members.filter(m => m.isRemoved).length,
      byRole,
      hasChairman: (byRole[3] || 0) > 0,
      hasSecretary: (byRole[1] || 0) + (byRole[2] || 0)
    };
  }

  /**
   * متد عمومی برای بازیابی همه اعضای حذف شده (در حالت ویرایش)
   */
  restoreAllRemovedMembers(): void {
    const members = this._processedMembers();
    let hasChanges = false;

    const restoredMembers = members.map(member => {
      if (member.isRemoved) {
        hasChanges = true;
        return { ...member, isRemoved: false };
      }
      return member;
    });

    if (hasChanges) {
      sortMembers(restoredMembers);
      this._processedMembers.set(restoredMembers);
      this.emitMembersUpdated();
    }
  }

  /**
   * متد عمومی برای پاک کردن همه اعضا
   */
  clearAllMembers(): void {
    this._processedMembers.set([]);
    this.emitMembersUpdated();
  }

  // به‌روزرسانی selectMember (emit base)
  async selectMember(member: SystemUser): Promise<void> {
    const identity = await this.createMemberIdentityFromUser(member);
    const newMember = createNewMemberFromUser(member, identity);
    this.addMemberToList(newMember);
    this.clearSearch();
    this.conflictCheckRequested.emit(identity.userKey); // baseUserGuid اصلی
  }

  // ═══════════════════════════════════════════════════════════
  // اصلاح createProcessedMember برای لود تصویر مهمان‌های موجود
  // ═══════════════════════════════════════════════════════════

  private createProcessedMember(member: MeetingMember): ProcessedMember {
    const identity = createMemberIdentity(member);

    const processed: ProcessedMember = {
      ...member,
      identity,
      isValidated: false,
      guid: member.guid || generateGuid()
    };

    // ✅ اگر مهمان خارجی با profileGuid هست، تصویر رو async لود کن
    if (member.isExternal && member.profileGuid) {
      this.images.loadAndSetMemberImage(processed.guid, member.profileGuid);
    }

    return processed;
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ اصلاح syncWithInputMembers - لود همه تصاویر با batch
  // ═══════════════════════════════════════════════════════════

  private async syncWithInputMembers(): Promise<void> {
    const inputMembers = this.selectedMembers();
    if (!inputMembers || inputMembers.length === 0) {
      if (this._processedMembers().length > 0) {
        this._processedMembers.set([]);
      }
      return;
    }

    const processedMembers = inputMembers.map(m => this.createProcessedMember(m));
    sortMembers(processedMembers);
    const hasRealChanges = hasRealMemberChanges(this._processedMembers(), processedMembers);

    if (hasRealChanges) {
      this._processedMembers.set(processedMembers);

      this.validateAndUpdateMembers();

      // ✅ لود batch تصاویر - هم مهمان‌های خارجی و هم board members
      await Promise.all([
        this.images.loadExternalGuestImages(processedMembers),
        this.images.loadBoardMemberImages(processedMembers)
      ]);
    }
  }
  hasConflict(member: ProcessedMember, conflictType: MemberConflictType): boolean {
    return hasMemberConflict(this.conflictedUsers(), member, conflictType);
  }

  // متد جدید برای گرفتن جزئیات تداخل
  getConflictDetails(member: ProcessedMember, conflictType: MemberConflictType): ConflictItem | undefined {
    return findMemberConflict(this.conflictedUsers(), member, conflictType);
  }
  // ═══════════════════════════════════════════════════════════
  // ✅ اصلاح validateSingleMember - استفاده از TUS برای board members
  // ═══════════════════════════════════════════════════════════

  private validateSingleMember(
    member: ProcessedMember,
    systemUsers: SystemUser[],
    boardMembers: BoardMember[]
  ): ProcessedMember {
    const { identity } = member;
    let isValidated = true;
    let updatedMember = { ...member };

    switch (identity.type) {
      case 'system':
        const [baseGuid, posGuid] = identity.sourceId.split('_');
        const systemUser = systemUsers.find(u =>
          (u.baseUserGuid === baseGuid || u.guid === baseGuid) &&
          (posGuid ? u.positionGuid === posGuid : !u.positionGuid || u.positionGuid === '')
        );

        if (systemUser) {
          updatedMember = {
            ...updatedMember,
            name: systemUser.name,
            position: systemUser.position || member.position,
            userName: systemUser.userName,
            positionGuid: systemUser.positionGuid || posGuid || '',
            userGuid: systemUser.baseUserGuid || systemUser.guid || baseGuid,
            image: getSystemUserImage(systemUser),
            identity: {
              ...identity,
              displayName: systemUser.name,
              position: (systemUser.position || member.position) ?? ''
            }
          };
        } else {
          isValidated = false;
          updatedMember = {
            ...updatedMember,
            position: member.position
          };
        }
        break;

      case 'board':
        const boardMember = boardMembers.find(bm =>
          bm.guid === identity.sourceId || bm.id === parseInt(identity.sourceId)
        );

        if (boardMember) {
          updatedMember = {
            ...updatedMember,
            name: boardMember.fullName,
            position: boardMember.position || member.position,
            boardMemberGuid: boardMember.guid || boardMember.id,
            identity: {
              ...identity,
              displayName: boardMember.fullName,
              position: boardMember.position || member.position || ''
            }
          };

          // ✅ تصویر از cache یا trigger async load
          if (boardMember.profileImageGuid) {
            const cachedUrl = this.images.getCachedUrl(boardMember.profileImageGuid);
            if (cachedUrl) {
              updatedMember.image = cachedUrl;
            } else {
              // تصویر async لود میشه
              updatedMember.image = DEFAULT_AVATAR;
              this.images.loadBoardMemberImageAsync(boardMember.profileImageGuid);
            }
          } else {
            updatedMember.image = DEFAULT_AVATAR;
          }
        } else {
          isValidated = false;
          updatedMember = {
            ...updatedMember,
            position: member.position
          };
        }
        break;

      case 'external':
        isValidated = true;
        // تصویر مهمان خارجی در loadExternalGuestImages لود میشه
        break;
    }

    updatedMember.isValidated = isValidated;
    return updatedMember;
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ اصلاح validateAndUpdateMembers - trigger batch load
  // ═══════════════════════════════════════════════════════════

  private validateAndUpdateMembers(): void {
    const processedMembers = this._processedMembers();
    const systemUsers = this.availableSystemUsers();
    const boardMembers = this.availableBoardMembers();

    let hasUpdates = false;

    const updatedMembers = processedMembers.map(member => {
      const updatedMember = this.validateSingleMember(member, systemUsers, boardMembers);

      if (!areMembersEqual(member, updatedMember)) {
        hasUpdates = true;
      }

      return updatedMember;
    });

    if (hasUpdates) {
      sortMembers(updatedMembers);
      this._processedMembers.set(updatedMembers);
      this.emitMembersUpdated();

      // ✅ Trigger batch load برای تصاویر board members
      this.images.loadBoardMemberImages(updatedMembers);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ اصلاح createMemberIdentityFromUser - استفاده از TUS برای board member image
  // ═══════════════════════════════════════════════════════════

  private async createMemberIdentityFromUser(user: SystemUser): Promise<MemberIdentity> {
    const isBoardMeeting = this.isBoardMeeting();
    const boardMembers = this.availableBoardMembers();
    const matchingBoardMember = boardMembers.find(bm => bm.guid === user.guid);

    if (isBoardMeeting && matchingBoardMember) {
      // ✅ تصویر board member از cache یا async load
      let imageUrl = DEFAULT_AVATAR;
      if (matchingBoardMember.profileImageGuid) {
        const cachedUrl = this.images.getCachedUrl(matchingBoardMember.profileImageGuid);
        if (cachedUrl) {
          imageUrl = cachedUrl;
        } else {
          // Trigger async load
          this.images.loadBoardMemberImageAsync(matchingBoardMember.profileImageGuid);
        }
      }

      return {
        id: generateGuid(),
        type: 'board',
        sourceId: matchingBoardMember.guid || matchingBoardMember.id,
        userKey: matchingBoardMember.guid || matchingBoardMember.id,
        displayName: matchingBoardMember.fullName,
        position: matchingBoardMember.position || '',
        image: imageUrl,
        isSystem: false
      };
    }

    const compositeSourceId = `${user.guid}_${user.positionGuid || ''}`;
    return {
      id: generateGuid(),
      type: 'system',
      sourceId: compositeSourceId,
      userKey: user.baseUserGuid ?? user.guid,
      displayName: user.name,
      position: user.position,
      image: getSystemUserImage(user),
      isSystem: true
    };
  }

}
