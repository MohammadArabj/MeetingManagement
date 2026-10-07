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
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Collapse } from 'bootstrap';

import { MeetingMember } from './../../../../core/models/Meeting';
import { SystemUser } from '../../../../core/models/User';
import { ConflictItem } from '../../../../core/types/conflict-result';
import { ComboBase } from '../../../../shared/combo-base';
import { BoardMember } from '../../../../core/models/BoardMember';
import { CreatType } from '../../../../core/types/enums';

import { RoleService } from '../../../../services/role.service';
import { FileService } from '../../../../services/file.service';
import { environment } from '../../../../../environments/environment';
import { base64ToArrayBuffer, generateGuid } from '../../../../core/types/configuration';
import { FileDetails } from '../../../../core/types/file';
import { TusUploadService, UploadStatus } from '../../../../services/framework-services/tus-upload.service';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';

// به‌روزرسانی interface MemberIdentity
interface MemberIdentity {
  id: string;
  type: 'system' | 'board' | 'external';
  sourceId: string; // composite برای validate/uniqueness
  userKey: string; // baseUserGuid یا boardGuid برای duplicate/conflict
  displayName: string;
  position: string;
  positionGuid?: string;
  image?: string;
  isSystem?: boolean;
}

interface ProcessedMember extends MeetingMember {
  identity: MemberIdentity;
  isValidated: boolean; // آیا با منبع اصلی sync شده
}

@Component({
  selector: 'app-meeting-participants',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule
  ],
  standalone: true,
  templateUrl: './meeting-participants.html',
  styleUrls: ['./meeting-participants.css']
})
export class MeetingParticipantsComponent implements OnInit, OnDestroy {
  /** رجیستری نقش‌ها برای استفاده در قالب (به‌جای roleId های ثابت) */
  protected readonly meetingRoles = MeetingRoles;


  // ===== DEPENDENCY INJECTION =====
  private readonly fb = inject(FormBuilder);
  private readonly roleService = inject(RoleService);
  private readonly fileService = inject(FileService);
  private readonly tusUploadService = inject(TusUploadService); // ✅ اضافه شده
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

  // ===== PRIVATE SIGNALS =====
  private readonly _processedMembers = signal<ProcessedMember[]>([]);
  private readonly _roles = signal<ComboBase[]>([]);
  private readonly _searchQuery = signal<string>('');
  private readonly _dropdownVisible = signal<boolean>(false);
  private readonly _previewImage = signal<string | null>(null);
  private readonly _fileStorage = signal<{ [key: string]: { profile?: File; signature?: File } }>({});
  private readonly _fileUrls = signal<Map<string, string>>(new Map());
  private readonly _isInitialized = signal<boolean>(false);
  readonly roles = this._roles.asReadonly();
  readonly previewImage = this._previewImage.asReadonly();
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
  // Guest form specific signals
  private readonly _selectedInternalMember = signal<SystemUser | null>(null);
  private readonly _internalMemberSearchQuery = signal<string>('');
  private readonly _internalMemberDropdownVisible = signal<boolean>(false);
  readonly selectedInternalMember = this._selectedInternalMember.asReadonly();

  // ===== DEPENDENCY INJECTION =====

  // ===== Guest File Upload State =====
  private readonly _profileFileGuid = signal<string | null>(null);
  private readonly _signatureFileGuid = signal<string | null>(null);
  private readonly _profileUploadProgress = signal<number>(0);
  private readonly _signatureUploadProgress = signal<number>(0);
  private readonly _isProfileUploading = signal<boolean>(false);
  private readonly _isSignatureUploading = signal<boolean>(false);

  // Public readonly
  readonly profileFileGuid = this._profileFileGuid.asReadonly();
  readonly signatureFileGuid = this._signatureFileGuid.asReadonly();
  readonly profileUploadProgress = this._profileUploadProgress.asReadonly();
  readonly signatureUploadProgress = this._signatureUploadProgress.asReadonly();
  readonly isProfileUploading = this._isProfileUploading.asReadonly();
  readonly isSignatureUploading = this._isSignatureUploading.asReadonly();

  // ===== Computed for upload folder =====
  readonly guestUploadFolder = computed(() => {
    return 'Meeting{{Folder}}Guests{{Folder}}Temp';
  });
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
  readonly filteredSubstitutes = computed(() => {
    const query = this._substituteSearchQuery().toLowerCase().trim();
    const systemUsers = this.allSystemUsers();
    const processed = this._processedMembers();

    if (!systemUsers?.length) return [];

    const activeIds = new Set(
      processed.filter(m => !m.isRemoved).map(m => m.identity.sourceId)
    );

    return systemUsers
      .filter(user => {
        const key = this.getUserCompositeKey(user);
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
    const activeIds = new Set(
      processedMembers
        .filter(m => !m.isRemoved)
        .map(m => m.identity.sourceId)
    );

    let availableUsers: SystemUser[] = [];
    availableUsers = systemUsers;

    return availableUsers.filter(user => {
      const fullText = `${user.name} ${user.userName || ''} ${user.position}`.toLowerCase();
      const compositeKey = `${user.guid || ''}`;
      const isNotSelected = !activeIds.has(compositeKey); // composite
      const matchesQuery = !query || fullText.includes(query);

      return isNotSelected && matchesQuery;
    });
  });

  // به‌روزرسانی filteredInternalMembers (activeIds بر اساس sourceId composite، فیلتر بر اساس compositeKey)
  readonly filteredInternalMembers = computed(() => {
    const query = this._internalMemberSearchQuery().toLowerCase().trim();
    const isVisible = this._internalMemberDropdownVisible();
    const systemUsers = this.allUsesrs(); // raw
    const processedMembers = this._processedMembers();

    if (!isVisible || !systemUsers?.length) return [];

    // activeIds بر اساس sourceId (composite)
    const activeIds = new Set(
      processedMembers
        .filter(m => !m.isRemoved)
        .map(m => m.identity.sourceId)
    );

    return systemUsers.filter(user => {
      const fullText = `${user.name} ${user.userName || ''} ${user.position}`.toLowerCase();
      const compositeKey = this.getUserCompositeKey(user); // composite برای فیلتر
      const isNotSelected = !activeIds.has(compositeKey);
      const matchesQuery = !query || fullText.includes(query);

      return isNotSelected && matchesQuery;
    });
  });
  readonly filteredAllUserInternalMembers = computed(() => {
    const query = this._internalMemberSearchQuery().toLowerCase().trim();
    const isVisible = this._internalMemberDropdownVisible();
    const systemUsers = this.allSystemUsers(); // raw
    const processedMembers = this._processedMembers();

    if (!isVisible || !systemUsers?.length) return [];

    // activeIds بر اساس sourceId (composite)
    const activeIds = new Set(
      processedMembers
        .filter(m => !m.isRemoved)
        .map(m => m.identity.sourceId)
    );

    return systemUsers.filter(user => {
      const fullText = `${user.name} ${user.userName || ''} ${user.position}`.toLowerCase();
      const compositeKey = this.getUserCompositeKey(user); // composite برای فیلتر
      const isNotSelected = !activeIds.has(compositeKey);
      const matchesQuery = !query || fullText.includes(query);

      return isNotSelected && matchesQuery;
    });
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
        this.sortMembers(updatedMembers);
        this._processedMembers.set(updatedMembers);
      }
      else {
        if (MeetingRoles.isGuest(newMember.roleId)) {
          const currentMembers = [...this._processedMembers()];
          var currentMember = currentMembers[existingIndex];
          newMember.id = currentMember.id;
          currentMembers[existingIndex] = newMember;
          this.sortMembers(currentMembers);
          this._processedMembers.set(currentMembers);
          this.emitMembersUpdated();
        }
        else return;
      }
    } else {
      // اضافه کردن عضو جدید
      const updatedMembers = [...currentMembers, newMember];
      this.sortMembers(updatedMembers);
      this._processedMembers.set(updatedMembers);
    }

    this.emitMembersUpdated();
  }

  // بقیه متدها unchanged، چون منطق conflict و userGuid اصلی حفظ می‌شه (emit از userKey base، hasConflict از userGuid اصلی)

  // بقیه متدها (مثل createMemberIdentityFromUser، selectMember) unchanged، چون userKey base set می‌شه و فیلتر حالا بر اساس base کار می‌کنه

  // ===== FORM MANAGEMENT =====
  participantsForm!: FormGroup;

  get guestForm(): FormGroup {
    return this.participantsForm.get('guestForm') as FormGroup;
  }

  // ===== LIFECYCLE METHODS =====
  constructor() {
    this.initializeForm();
    this.loadRoles();
    this.setupEffects();
  }

  ngOnInit(): void {
    this._isInitialized.set(true);
    this.syncWithInputMembers();
  }

  ngOnDestroy(): void {
    this.cleanupBlobUrls();
  }

  // ===== INITIALIZATION METHODS =====
  private initializeForm(): void {
    this.participantsForm = this.fb.group({
      guestForm: this.fb.group({
        guid: [generateGuid()],
        guestType: ['external', Validators.required],
        selectedMember: [''],
        memberSearch: [''],
        name: [''],
        mobile: [''],
        email: ['', [Validators.email]],
        organization: [''],
        gender: ['Male']
      })
    });

    this.setupDynamicValidators();
  }

  private setupDynamicValidators(): void {
    const guestTypeControl = this.guestForm.get('guestType');

    guestTypeControl?.valueChanges.subscribe(guestType => {
      this.updateValidators(guestType);
    });

    this.updateValidators(guestTypeControl?.value);
  }

  private updateValidators(guestType: string): void {
    const controls = {
      name: this.guestForm.get('name'),
      mobile: this.guestForm.get('mobile'),
      organization: this.guestForm.get('organization'),
      selectedMember: this.guestForm.get('selectedMember'),
      gender: this.guestForm.get('gender') // اضافه شده
    };

    // پاک کردن validators قبلی
    Object.values(controls).forEach(control => control?.clearValidators());

    if (guestType === 'external') {
      controls.name?.setValidators([Validators.required, Validators.minLength(2)]);
      controls.mobile?.setValidators([Validators.required, Validators.pattern(/^09\d{9}$/)]);
      controls.organization?.setValidators([Validators.required]);
      controls.gender?.setValidators([Validators.required]); // اضافه شده

    } else if (guestType === 'internal') {
      controls.selectedMember?.setValidators([Validators.required]);
    }

    // بروزرسانی وضعیت validation
    Object.values(controls).forEach(control => control?.updateValueAndValidity());
  }

  private loadRoles(): void {
    this.roleService.getForCombo<ComboBase[]>()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this._roles.set(data || this.getDefaultRoles());
        },
        error: (error) => {
          console.error('Error loading roles:', error);
          this._roles.set(this.getDefaultRoles());
        }
      });
  }

  private getDefaultRoles(): ComboBase[] {
    return [
      { id: 1, title: 'رئیس جلسه', other: '#dc3545' },
      { id: 2, title: 'دبیر', other: '#0d6efd' },
      { id: 3, title: 'عضو', other: '#198754' },
      { id: 4, title: 'ناظر', other: '#fd7e14' },
      { id: 5, title: 'مشاور', other: '#6f42c1' },
      { id: 6, title: 'مهمان', other: '#6c757d' }
    ];
  }

  // ===== EFFECTS SETUP =====
  private setupEffects(): void {
    // Sync with input changes
    // effect(() => {
    //   const inputMembers = this.selectedMembers();
    //   if (this._isInitialized() && inputMembers) {
    //     this.syncWithInputMembers();

    //   }
    // });
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

    this.sortMembers(updatedMembers);
    this._processedMembers.set(updatedMembers);
    this.emitMembersUpdated();
  }


  addGuest(): void {
    if (!this.isGuestFormValid()) {
      this.markFormGroupTouched(this.guestForm);
      return;
    }

    // بررسی آپلود در حال انجام
    if (this._isProfileUploading() || this._isSignatureUploading()) {
      alert('لطفاً صبر کنید تا آپلود فایل‌ها تمام شود');
      return;
    }

    const guestFormValue = this.guestForm.value;
    const guestType = guestFormValue.guestType;
    const newGuest = this.createGuestMember(guestType, guestFormValue);

    this.addMemberToList(newGuest);

    // ✅ بعد از اضافه شدن موفق، فقط reset کن (فایل‌ها نباید حذف شوند چون به member اضافه شدند)
    this._profileFileGuid.set(null);
    this._signatureFileGuid.set(null);
    this._profileUploadProgress.set(0);
    this._signatureUploadProgress.set(0);
    this._previewImage.set(null);

    this.guestForm.reset({
      guid: generateGuid(),
      guestType: 'external',
      gender: 'Male'
    });
    this._selectedInternalMember.set(null);
    this._internalMemberSearchQuery.set('');

    this.hideGuestModal();
  }


  editMember(member: ProcessedMember): void {
    if (!MeetingRoles.isGuest(member.roleId)) return;

    const guestType = member.isExternal ? 'external' : 'internal';

    this.guestForm.patchValue({
      guid: member.guid,
      guestType: guestType
    });

    if (guestType === 'external') {
      this.guestForm.patchValue({
        name: member.name,
        mobile: member.mobile || '',
        email: member.email || '',
        organization: member.organization || member.position,
        gender: member.gender || 'Male' // اضافه شده
      });
      this._previewImage.set(member.image || null);
    } else {
      const systemUsers = this.availableSystemUsers();
      const internalMember = systemUsers.find(u => u.guid === member.identity.sourceId);
      if (internalMember) {
        this._selectedInternalMember.set(internalMember);
        this.guestForm.patchValue({
          selectedMember: internalMember.guid,
          memberSearch: internalMember.name
        });
      }
    }

    this.showGuestModal();
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

  onInternalMemberSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this._internalMemberSearchQuery.set(input.value);
    this._internalMemberDropdownVisible.set(true);
  }

  selectInternalMember(member: SystemUser): void {
    this._selectedInternalMember.set(member);
    this.guestForm.patchValue({
      selectedMember: member.guid,
      memberSearch: member.name
    });
    this._internalMemberDropdownVisible.set(false);
  }

  private clearSearch(): void {
    this._searchQuery.set('');
    this._dropdownVisible.set(false);
    const searchBoxRef = this.searchBox();
    if (searchBoxRef?.nativeElement) {
      searchBoxRef.nativeElement.value = '';
    }
  }



  private getSystemUserImage(user: SystemUser): string {
    return user.userName
      ? `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${user.userName}.jpg`)}&w=48&q=75`
      : 'img/default-avatar.png';
  }
  private getBoardMemberImage(boardMember: BoardMember): string {
    if (boardMember.profileImageGuid) {
      const fileUrls = this._fileUrls();
      if (fileUrls.has(boardMember.profileImageGuid)) {
        return fileUrls.get(boardMember.profileImageGuid)!;
      }

      // شروع بارگذاری تصویر
      this.loadBoardMemberImage(boardMember.profileImageGuid);
    }

    return 'img/default-avatar.png';
  }

  private loadBoardMemberImage(profileImageGuid: string): void {
    this.fileService.getFileDetails(profileImageGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fileDetails: FileDetails) => {
          const blob = new Blob([base64ToArrayBuffer(fileDetails.file)], {
            type: fileDetails.contentType
          });
          const url = URL.createObjectURL(blob);

          const currentUrls = this._fileUrls();
          const newUrls = new Map(currentUrls);
          newUrls.set(profileImageGuid, url);
          this._fileUrls.set(newUrls);
        },
        error: (error) => {
          console.error('خطا در بارگذاری تصویر:', error);
        }
      });
  }

  private sortMembers(members: ProcessedMember[]): void {
    const rolePriority: { [key: number]: number } = {
      6: 1, 3: 2, 1: 3, 2: 4, 4: 5, 5: 6
    };

    // members.sort((a, b) => {
    //   const priorityA = rolePriority[a.roleId] || 999;
    //   const priorityB = rolePriority[b.roleId] || 999;

    //   if (priorityA !== priorityB) {
    //     return priorityA - priorityB;
    //   }

    //   return a.name.localeCompare(b.name, 'fa');
    // });
    members.sort((a, b) => rolePriority[a.roleId || 999] - rolePriority[b.roleId || 999]);
  }

  private areMembersEqual(member1: ProcessedMember, member2: ProcessedMember): boolean {
    return member1.name === member2.name &&
      member1.position === member2.position &&
      member1.roleId === member2.roleId &&
      member1.isRemoved === member2.isRemoved &&
      member1.identity.sourceId === member2.identity.sourceId;
  }

  private emitMembersUpdated(): void {
    const membersToEmit = this._processedMembers().map(member => {
      // حذف identity از object قبل از emit (چون parent component نیازی نداره)
      const { identity, isValidated, ...memberData } = member;
      return memberData;
    });

    this.membersUpdated.emit(membersToEmit);
  }

  private resetGuestForm(): void {
    this.guestForm.reset({
      guid: generateGuid(),
      guestType: 'external',
      gender: 'Male'
    });

    // Reset file states (بدون حذف - فقط reset)
    this._profileFileGuid.set(null);
    this._signatureFileGuid.set(null);
    this._profileUploadProgress.set(0);
    this._signatureUploadProgress.set(0);
    this._previewImage.set(null);
    this._selectedInternalMember.set(null);
    this._internalMemberSearchQuery.set('');

    // Clear file inputs
    const profileInput = document.getElementById('profile') as HTMLInputElement;
    const signatureInput = document.getElementById('signature') as HTMLInputElement;
    if (profileInput) profileInput.value = '';
    if (signatureInput) signatureInput.value = '';
  }


  private isGuestFormValid(): boolean {
    const guestType = this.guestForm.get('guestType')?.value;

    if (guestType === 'external') {
      return this.guestForm.valid;
    } else if (guestType === 'internal') {
      return !!(this.guestForm.get('guestType')?.valid &&
        this.guestForm.get('selectedMember')?.valid);
    }

    return false;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control) {
        control.markAsTouched();
        if (control instanceof FormGroup) {
          this.markFormGroupTouched(control);
        }
      }
    });
  }

  // ===== MODAL MANAGEMENT =====
  showGuestModal(): void {
    try {
      const modalElement = document.getElementById('guestModal');
      if (modalElement) {
        const modal = new (window as any).bootstrap.Modal(modalElement);
        modal.show();
      }
    } catch (error) {
      console.error('Error showing guest modal:', error);
    }
  }

  private hideGuestModal(): void {
    try {
      const modalElement = document.getElementById('guestModal');
      if (modalElement) {
        const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      }
    } catch (error) {
      console.error('Error hiding guest modal:', error);
    }
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

  showInternalMemberDropdown(): void {
    this._internalMemberDropdownVisible.set(true);
  }

  hideInternalMemberDropdown(): void {
    setTimeout(() => this._internalMemberDropdownVisible.set(false), 200);
  }

  shouldShowInternalMemberDropdown(): boolean {
    return this._internalMemberDropdownVisible() &&
      this.guestForm.get('guestType')?.value === 'internal';
  }

  // ═══════════════════════════════════════════════════════════
  // File Upload Methods - TUS Based
  // ═══════════════════════════════════════════════════════════

  async onFileSelected(event: Event, fileType: 'profile' | 'signature'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validation
    if (!file.type.startsWith('image/')) {
      alert('لطفاً فقط فایل تصویری انتخاب کنید');
      input.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('حجم فایل نباید از 2 مگابایت بیشتر باشد');
      input.value = '';
      return;
    }

    // Set uploading state
    if (fileType === 'profile') {
      this._isProfileUploading.set(true);
      this._profileUploadProgress.set(0);
    } else {
      this._isSignatureUploading.set(true);
      this._signatureUploadProgress.set(0);
    }

    try {
      // Add file to TUS service
      const added = this.tusUploadService.addFiles([file], {
        maxSizeMB: 2,
        acceptedTypes: ['image/*'],
        localPreview: true
      });

      if (added.length === 0) {
        throw new Error('فایل اضافه نشد');
      }

      const fileItem = added[0];

      // Set preview immediately
      if (fileType === 'profile' && fileItem.previewUrl) {
        this._previewImage.set(fileItem.previewUrl);
      }

      // Subscribe to progress
      const progressInterval = setInterval(() => {
        const current = this.tusUploadService.filesMap().get(fileItem.id);
        if (current) {
          if (fileType === 'profile') {
            this._profileUploadProgress.set(current.progress);
          } else {
            this._signatureUploadProgress.set(current.progress);
          }

          if (current.status === UploadStatus.Completed || current.status === UploadStatus.Failed) {
            clearInterval(progressInterval);
          }
        }
      }, 100);

      // Upload file
      const guid = await this.tusUploadService.uploadFile(fileItem.id, {
        folderPath: this.guestUploadFolder(),
        description: fileType === 'profile' ? 'تصویر پروفایل مهمان' : 'تصویر امضای مهمان'
      });

      clearInterval(progressInterval);

      if (guid) {
        if (fileType === 'profile') {
          // حذف فایل قبلی اگر وجود داشت
          await this.deleteOldFile(this._profileFileGuid());
          this._profileFileGuid.set(guid);
          this._profileUploadProgress.set(100);
        } else {
          await this.deleteOldFile(this._signatureFileGuid());
          this._signatureFileGuid.set(guid);
          this._signatureUploadProgress.set(100);
        }
      } else {
        throw new Error('آپلود ناموفق بود');
      }

    } catch (error: any) {
      console.error(`Error uploading ${fileType}:`, error);
      alert(`خطا در آپلود فایل: ${error?.message || 'خطای نامشخص'}`);

      if (fileType === 'profile') {
        this._profileFileGuid.set(null);
        this._previewImage.set(null);
      } else {
        this._signatureFileGuid.set(null);
      }
    } finally {
      if (fileType === 'profile') {
        this._isProfileUploading.set(false);
      } else {
        this._isSignatureUploading.set(false);
      }
      input.value = '';
    }
  }


  // ═══════════════════════════════════════════════════════════
  // اصلاح onGuestTypeChange
  // ═══════════════════════════════════════════════════════════

  async onGuestTypeChange(guestType: string): Promise<void> {
    // حذف فایل‌های آپلود شده قبلی
    const guidsToDelete = [this._profileFileGuid(), this._signatureFileGuid()].filter(Boolean) as string[];
    if (guidsToDelete.length > 0) {
      try {
        await this.tusUploadService.deleteAttachments(guidsToDelete);
      } catch (e) {
        console.warn('Failed to delete files on guest type change:', e);
      }
    }

    this.guestForm.patchValue({
      name: '',
      mobile: '',
      email: '',
      organization: '',
      selectedMember: '',
      memberSearch: '',
      gender: 'Male'
    });

    this._selectedInternalMember.set(null);
    this._internalMemberSearchQuery.set('');
    this._previewImage.set(null);
    this._profileFileGuid.set(null);
    this._signatureFileGuid.set(null);
    this._profileUploadProgress.set(0);
    this._signatureUploadProgress.set(0);

    const profileInput = document.getElementById('profile') as HTMLInputElement;
    const signatureInput = document.getElementById('signature') as HTMLInputElement;
    if (profileInput) profileInput.value = '';
    if (signatureInput) signatureInput.value = '';
  }

  // ===== ROLE MANAGEMENT =====
  getRoleColor(roleId: number): string {
    const roles = this._roles();
    return roles.find(role => role.id === roleId)?.other || '#6c757d';
  }

  getRoleTitle(roleId: number): string {
    const roles = this._roles();
    return roles.find(role => role.id === roleId)?.title || 'نامشخص';
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

  // ===== FORM VALIDATION HELPERS =====
  isFormFieldInvalid(fieldName: string): boolean {
    const field = this.guestForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldErrorMessage(fieldName: string): string {
    const field = this.guestForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} الزامی است`;
      if (field.errors['email']) return 'فرمت ایمیل صحیح نیست';
      if (field.errors['pattern']) return 'فرمت شماره موبایل صحیح نیست';
      if (field.errors['minlength']) return `حداقل ${field.errors['minlength'].requiredLength} کاراکتر مجاز است`;
    }
    return '';
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
      if (currentData && this.hasDataChanged(member, currentData)) {
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

  private hasDataChanged(member: ProcessedMember, currentData: any): boolean {
    if (member.identity.type === 'system') {
      return member.name !== currentData.name ||
        member.position !== currentData.position;
    } else if (member.identity.type === 'board') {
      return member.name !== currentData.fullName ||
        member.position !== (currentData.position || '');
    }

    return false;
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
      this.sortMembers(restoredMembers);
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






  // به‌روزرسانی createNewMemberFromUser
  private createNewMemberFromUser(user: SystemUser, identity: MemberIdentity): ProcessedMember {
    const baseMember: MeetingMember = {
      id: 0,
      guid: identity.id,
      name: identity.displayName,
      position: identity.position,
      roleId: MeetingRoles.member,
      isExternal: false,
      isRemoved: false,
      image: identity.image ?? 'img/default-avatar.png',
      userGuid: identity.userKey, // اصلی! (baseUserGuid)
      positionGuid: user.positionGuid,
      userName: user.userName
    };
    if (identity.type === 'board') {
      baseMember.boardMemberGuid = identity.sourceId;
      delete baseMember.userGuid;
    }
    return {
      ...baseMember,
      identity,
      isValidated: true
    };
  }

  // به‌روزرسانی selectMember (emit base)
  async selectMember(member: SystemUser): Promise<void> {
    const identity = await this.createMemberIdentityFromUser(member);
    const newMember = this.createNewMemberFromUser(member, identity);
    this.addMemberToList(newMember);
    this.clearSearch();
    this.conflictCheckRequested.emit(identity.userKey); // baseUserGuid اصلی
  }


  private createGuestMember(guestType: string, formValue: any): ProcessedMember {
    const guestGuid = formValue.guid || generateGuid();

    if (guestType === 'internal') {
      // ... کد قبلی بدون تغییر ...
      const selectedMember = this._selectedInternalMember();
      if (!selectedMember) throw new Error('No internal member selected');

      const compositeKey = this.getUserCompositeKey(selectedMember);
      const relevantPos = selectedMember.positions?.find((p: any) =>
        p.positionGuid === selectedMember.positionGuid) || selectedMember.positions?.[0];
      const positionTitle = relevantPos ? relevantPos.positionTitle : selectedMember.position;
      const positionGuid = relevantPos ? relevantPos.positionGuid : selectedMember.positionGuid || '';

      const identity: MemberIdentity = {
        id: guestGuid,
        type: 'system',
        sourceId: compositeKey,
        userKey: selectedMember.guid,
        displayName: selectedMember.name,
        position: positionTitle
      };

      return {
        id: 0,
        guid: guestGuid,
        userGuid: selectedMember.baseUserGuid,
        positionGuid: positionGuid,
        name: selectedMember.name,
        position: positionTitle,
        userName: selectedMember.userName,
        roleId: MeetingRoles.guest,
        isExternal: false,
        isRemoved: false,
        image: this.getSystemUserImage(selectedMember),
        identity,
        isValidated: true
      };
    } else {
      // External guest - ✅ استفاده از GUID های آپلود شده
      const identity: MemberIdentity = {
        id: guestGuid,
        type: 'external',
        sourceId: guestGuid,
        userKey: guestGuid,
        displayName: formValue.name,
        position: formValue.organization
      };

      // ✅ گرفتن GUID های فایل آپلود شده
      const profileGuid = this._profileFileGuid();
      const signatureGuid = this._signatureFileGuid();

      return {
        id: 0,
        guid: guestGuid,
        name: formValue.name,
        position: formValue.organization,
        mobile: formValue.mobile,
        email: formValue.email,
        organization: formValue.organization,
        gender: formValue.gender,
        roleId: MeetingRoles.guest,
        isExternal: true,
        isRemoved: false,
        image: this._previewImage() || 'img/default-avatar.png',
        // ✅ GUID های فایل
        profileGuid: profileGuid || undefined,
        signatureGuid: signatureGuid || undefined,
        identity,
        isValidated: true
      };
    }
  }


  // اصلاح createMemberIdentity برای حفظ بهتر اطلاعات
  private createMemberIdentity(member: MeetingMember): MemberIdentity {
    if (member.isExternal) {
      return {
        id: member.guid || generateGuid(),
        type: 'external',
        sourceId: member.guid || generateGuid(),
        userKey: member.guid || generateGuid(), // برای external همان guid
        displayName: member.name,
        position: member.organization || member.position || ''
      };
    }

    if (member.boardMemberGuid) {
      return {
        id: member.guid || generateGuid(),
        type: 'board',
        sourceId: member.boardMemberGuid,
        userKey: member.boardMemberGuid, // board key همان guid
        displayName: member.name,
        position: member.position || ''
      };
    }

    // System user - ساخت composite key دقیق
    const baseGuid = member.userGuid || member.guid || generateGuid();
    const posGuid = member.positionGuid || '';

    return {
      id: member.guid || generateGuid(),
      type: 'system',
      sourceId: posGuid ? `${baseGuid}_${posGuid}` : baseGuid, // composite فقط اگر سمت داشته باشد
      userKey: baseGuid, // اصلی
      displayName: member.name,
      position: member.position || '',
      positionGuid: posGuid
    };
  }


  // متد کمکی برای تشخیص تغییرات واقعی
  private hasRealMemberChanges(oldMembers: ProcessedMember[], newMembers: ProcessedMember[]): boolean {
    if (oldMembers.length !== newMembers.length) {
      return true;
    }

    for (let i = 0; i < oldMembers.length; i++) {
      const oldMember = oldMembers[i];
      const newMember = newMembers[i];

      // بررسی فیلدهای کلیدی
      if (oldMember.guid !== newMember.guid ||
        oldMember.name !== newMember.name ||
        oldMember.position !== newMember.position ||
        oldMember.roleId !== newMember.roleId ||
        oldMember.isRemoved !== newMember.isRemoved ||
        oldMember.identity.sourceId !== newMember.identity.sourceId) {
        return true;
      }
    }

    return false;
  }

  // بهبود getUserCompositeKey برای سازگاری بیشتر
  private getUserCompositeKey(user: SystemUser): string {
    // اگر کاربر positionGuid مستقیم دارد
    if (user.positionGuid) {
      return `${user.guid}_${user.positionGuid}`;
    }

    // اگر در positions دارد
    if (user.positions && user.positions.length > 0) {
      const firstPosition = user.positions[0];
      return firstPosition.positionGuid
        ? `${user.guid}_${firstPosition.positionGuid}`
        : user.guid;
    }

    // اگر هیچ سمتی ندارد
    return user.guid;
  }


  // در کلاس MeetingParticipantsComponent:





  // حذف فایل قدیمی
  private async deleteOldFile(guid: string | null): Promise<void> {
    if (guid) {
      try {
        await this.tusUploadService.deleteAttachment(guid);
      } catch (e) {
        console.warn('Failed to delete old file:', e);
      }
    }
  }

  // حذف فایل‌های آپلود شده در صورت کنسل
  async cancelGuestForm(): Promise<void> {
    // حذف فایل‌های آپلود شده
    const profileGuid = this._profileFileGuid();
    const signatureGuid = this._signatureFileGuid();

    const guidsToDelete = [profileGuid, signatureGuid].filter(Boolean) as string[];

    if (guidsToDelete.length > 0) {
      try {
        await this.tusUploadService.deleteAttachments(guidsToDelete);
      } catch (e) {
        console.warn('Failed to delete uploaded files on cancel:', e);
      }
    }

    this.resetGuestForm();
    this.hideGuestModal();
  }

  // حذف دستی فایل توسط کاربر
  async removeUploadedFile(fileType: 'profile' | 'signature'): Promise<void> {
    if (fileType === 'profile') {
      const guid = this._profileFileGuid();
      if (guid) {
        await this.tusUploadService.deleteAttachment(guid);
      }
      this._profileFileGuid.set(null);
      this._previewImage.set(null);
      this._profileUploadProgress.set(0);
    } else {
      const guid = this._signatureFileGuid();
      if (guid) {
        await this.tusUploadService.deleteAttachment(guid);
      }
      this._signatureFileGuid.set(null);
      this._signatureUploadProgress.set(0);
    }
  }

  // meeting-participants.component.ts

  // ═══════════════════════════════════════════════════════════
  // اضافه کردن متد برای لود تصویر پروفایل مهمان با TUS
  // ═══════════════════════════════════════════════════════════

  /**
   * لود URL تصویر پروفایل با استفاده از TusUploadService
   */
  private async loadGuestProfileImage(profileGuid: string): Promise<string> {
    if (!profileGuid) return 'img/default-avatar.png';

    try {
      const url = await this.tusUploadService.getFilePreviewUrl(profileGuid);
      return url || 'img/default-avatar.png';
    } catch (error) {
      console.warn('Failed to load guest profile image:', error);
      return 'img/default-avatar.png';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // اصلاح createProcessedMember برای لود تصویر مهمان‌های موجود
  // ═══════════════════════════════════════════════════════════

  private createProcessedMember(member: MeetingMember): ProcessedMember {
    const identity = this.createMemberIdentity(member);

    const processed: ProcessedMember = {
      ...member,
      identity,
      isValidated: false,
      guid: member.guid || generateGuid()
    };

    // ✅ اگر مهمان خارجی با profileGuid هست، تصویر رو async لود کن
    if (member.isExternal && member.profileGuid) {
      this.loadAndSetMemberImage(processed.guid, member.profileGuid);
    }

    return processed;
  }

  /**
   * لود async تصویر و آپدیت کردن member
   */
  private async loadAndSetMemberImage(memberGuid: string, profileGuid: string): Promise<void> {
    try {
      const imageUrl = await this.loadGuestProfileImage(profileGuid);

      // پیدا کردن و آپدیت کردن member
      const currentMembers = this._processedMembers();
      const memberIndex = currentMembers.findIndex(m => m.guid === memberGuid);

      if (memberIndex !== -1) {
        const updatedMembers = [...currentMembers];
        updatedMembers[memberIndex] = {
          ...updatedMembers[memberIndex],
          image: imageUrl
        };
        this._processedMembers.set(updatedMembers);
      }
    } catch (error) {
      console.warn('Failed to load member image:', error);
    }
  }


  /**
   * لود batch تصاویر پروفایل مهمان‌های خارجی
   */
  private async loadExternalGuestImages(members: ProcessedMember[]): Promise<void> {
    // جمع‌آوری همه profileGuid های مهمان‌های خارجی
    const guestProfileGuids: { memberGuid: string; profileGuid: string }[] = [];

    for (const member of members) {
      if (member.isExternal && member.profileGuid && !member.image?.startsWith('http')) {
        guestProfileGuids.push({
          memberGuid: member.guid,
          profileGuid: member.profileGuid
        });
      }
    }

    if (guestProfileGuids.length === 0) return;

    // گرفتن URL ها به صورت batch
    const guids = guestProfileGuids.map(g => g.profileGuid);
    const urlMap = await this.tusUploadService.getFilePreviewUrls(guids);

    // آپدیت کردن members با URL های جدید
    const currentMembers = [...this._processedMembers()];
    let hasUpdates = false;

    for (const { memberGuid, profileGuid } of guestProfileGuids) {
      const url = urlMap.get(profileGuid.toLowerCase());
      if (url) {
        const memberIndex = currentMembers.findIndex(m => m.guid === memberGuid);
        if (memberIndex !== -1 && currentMembers[memberIndex].image !== url) {
          currentMembers[memberIndex] = {
            ...currentMembers[memberIndex],
            image: url
          };
          hasUpdates = true;
        }
      }
    }

    if (hasUpdates) {
      this._processedMembers.set(currentMembers);
    }
  }


  // ═══════════════════════════════════════════════════════════
  // ✅ جایگزین loadBoardMemberImage - استفاده از TUS
  // ═══════════════════════════════════════════════════════════

  private async loadBoardMemberImageAsync(profileImageGuid: string): Promise<void> {
    if (!profileImageGuid) return;

    const normalizedGuid = profileImageGuid.toLowerCase();

    // اگر قبلاً در حال لود است، return کن
    const currentUrls = this._fileUrls();
    if (currentUrls.has(normalizedGuid)) return;

    try {
      const url = await this.tusUploadService.getFilePreviewUrl(profileImageGuid);

      if (url) {
        const newUrls = new Map(this._fileUrls());
        newUrls.set(normalizedGuid, url);
        this._fileUrls.set(newUrls);

        // آپدیت کردن members که این تصویر را دارند
        this.updateMembersWithImage(profileImageGuid, url);
      }
    } catch (error) {
      console.warn('خطا در بارگذاری تصویر:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ متد جدید برای آپدیت members بعد از لود تصویر
  // ═══════════════════════════════════════════════════════════

  private updateMembersWithImage(profileImageGuid: string, imageUrl: string): void {
    const currentMembers = this._processedMembers();
    const boardMembers = this.availableBoardMembers();

    let hasUpdates = false;
    const updatedMembers = currentMembers.map(member => {
      // پیدا کردن board member مربوطه
      if (member.boardMemberGuid) {
        const boardMember = boardMembers.find(bm =>
          bm.guid === member.boardMemberGuid || bm.id === member.boardMemberGuid
        );

        if (boardMember?.profileImageGuid?.toLowerCase() === profileImageGuid.toLowerCase()) {
          if (member.image !== imageUrl) {
            hasUpdates = true;
            return { ...member, image: imageUrl };
          }
        }
      }
      return member;
    });

    if (hasUpdates) {
      this._processedMembers.set(updatedMembers);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ Batch load تصاویر Board Members
  // ═══════════════════════════════════════════════════════════

  private async loadBoardMemberImages(members: ProcessedMember[]): Promise<void> {
    const boardMembers = this.availableBoardMembers();

    // جمع‌آوری همه profileGuid های board members
    const imageGuidsToLoad: { memberGuid: string; profileGuid: string }[] = [];

    for (const member of members) {
      if (member.boardMemberGuid) {
        const boardMember = boardMembers.find(bm =>
          bm.guid === member.boardMemberGuid || bm.id === member.boardMemberGuid
        );

        if (boardMember?.profileImageGuid) {
          const normalizedGuid = boardMember.profileImageGuid.toLowerCase();
          // فقط اگر در cache نیست
          if (!this._fileUrls().has(normalizedGuid)) {
            imageGuidsToLoad.push({
              memberGuid: member.guid,
              profileGuid: boardMember.profileImageGuid
            });
          }
        }
      }
    }

    if (imageGuidsToLoad.length === 0) return;

    // Batch load
    const guids = imageGuidsToLoad.map(g => g.profileGuid);
    const urlMap = await this.tusUploadService.getFilePreviewUrls(guids);

    // آپدیت cache
    const newFileUrls = new Map(this._fileUrls());
    urlMap.forEach((url, guid) => {
      newFileUrls.set(guid.toLowerCase(), url);
    });
    this._fileUrls.set(newFileUrls);

    // آپدیت members
    const currentMembers = [...this._processedMembers()];
    let hasUpdates = false;

    for (const { memberGuid, profileGuid } of imageGuidsToLoad) {
      const url = urlMap.get(profileGuid.toLowerCase());
      if (url) {
        const memberIndex = currentMembers.findIndex(m => m.guid === memberGuid);
        if (memberIndex !== -1 && currentMembers[memberIndex].image !== url) {
          currentMembers[memberIndex] = {
            ...currentMembers[memberIndex],
            image: url
          };
          hasUpdates = true;
        }
      }
    }

    if (hasUpdates) {
      this._processedMembers.set(currentMembers);
    }
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
    this.sortMembers(processedMembers);
    const hasRealChanges = this.hasRealMemberChanges(this._processedMembers(), processedMembers);

    if (hasRealChanges) {
      this._processedMembers.set(processedMembers);

      this.validateAndUpdateMembers();

      // ✅ لود batch تصاویر - هم مهمان‌های خارجی و هم board members
      await Promise.all([
        this.loadExternalGuestImages(processedMembers),
        this.loadBoardMemberImages(processedMembers)
      ]);
    }
  }
  hasConflict(member: ProcessedMember, conflictType: 'Meeting' | 'Leave' | 'BlockedTime' | 'GuestInfo'): boolean {
    const conflicts = this.conflictedUsers();
    const memberId = member.identity.type === 'system' ? member.userGuid :
      member.identity.type === 'board' ? member.boardMemberGuid : null;
    return memberId ? conflicts.some(conflict =>
      conflict.guid === memberId && conflict.type === conflictType
    ) : false;
  }

  // متد جدید برای گرفتن جزئیات تداخل
  getConflictDetails(member: ProcessedMember, conflictType: 'Meeting' | 'Leave' | 'BlockedTime' | 'GuestInfo'): ConflictItem | undefined {
    const conflicts = this.conflictedUsers();
    const memberId = member.identity.type === 'system' ? member.userGuid :
      member.identity.type === 'board' ? member.boardMemberGuid : null;

    return memberId ? conflicts.find(conflict =>
      conflict.guid === memberId && conflict.type === conflictType
    ) : undefined;
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
            image: this.getSystemUserImage(systemUser),
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
            const cachedUrl = this._fileUrls().get(boardMember.profileImageGuid.toLowerCase());
            if (cachedUrl) {
              updatedMember.image = cachedUrl;
            } else {
              // تصویر async لود میشه
              updatedMember.image = 'img/default-avatar.png';
              this.loadBoardMemberImageAsync(boardMember.profileImageGuid);
            }
          } else {
            updatedMember.image = 'img/default-avatar.png';
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

      if (!this.areMembersEqual(member, updatedMember)) {
        hasUpdates = true;
      }

      return updatedMember;
    });

    if (hasUpdates) {
      this.sortMembers(updatedMembers);
      this._processedMembers.set(updatedMembers);
      this.emitMembersUpdated();

      // ✅ Trigger batch load برای تصاویر board members
      this.loadBoardMemberImages(updatedMembers);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ اصلاح cleanupBlobUrls - فقط blob URLs را پاک کن
  // ═══════════════════════════════════════════════════════════

  private cleanupBlobUrls(): void {
    const fileUrls = this._fileUrls();
    fileUrls.forEach(url => {
      // ✅ فقط blob URLs را revoke کن (TUS URLs نباید revoke بشن)
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    const members = this._processedMembers();
    members.forEach(member => {
      if (member.image && member.image.startsWith('blob:')) {
        URL.revokeObjectURL(member.image);
      }
    });
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
      let imageUrl = 'img/default-avatar.png';
      if (matchingBoardMember.profileImageGuid) {
        const cachedUrl = this._fileUrls().get(matchingBoardMember.profileImageGuid.toLowerCase());
        if (cachedUrl) {
          imageUrl = cachedUrl;
        } else {
          // Trigger async load
          this.loadBoardMemberImageAsync(matchingBoardMember.profileImageGuid);
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
      image: this.getSystemUserImage(user),
      isSystem: true
    };
  }

}