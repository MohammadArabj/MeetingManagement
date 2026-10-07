// meeting-details-tab.component.ts

import { NgClass, CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { environment } from '../../../../../environments/environment';
import {  MeetingMember } from '../../../../core/models/Meeting';
import { BoardMember } from '../../../../core/models/BoardMember';
import { SystemUser } from '../../../../core/models/User';
import { IsDeletage, POSITION_ID, USER_ID_NAME } from '../../../../core/types/configuration';

import { CategoryService } from '../../../../services/category.service';
import { FileService } from '../../../../services/file.service';
import { BoardMemberService } from '../../../../services/board-member.service';
import { CodeFlowService } from '../../../../services/framework-services/code-flow.service';
import { LocalStorageService } from '../../../../services/framework-services/local.storage.service';
import { ToastService } from '../../../../services/framework-services/toast.service';
import { TusUploadService } from '../../../../services/framework-services/tus-upload.service';
import { MeetingMemberService } from '../../../../services/meeting-member.service';
import { MeetingService } from '../../../../services/meeting.service';
import { PasswordFlowService } from '../../../../services/framework-services/password-flow.service';
import { RoomService } from '../../../../services/room.service';
import { UserService } from '../../../../services/user.service';

import { ComboBase } from '../../../../shared/combo-base';
import { CustomInputComponent } from '../../../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../../../shared/custom-controls/custom-select';

import { MeetingBehaviorService } from '../meeting-behavior-service';
import { getClientSettings } from '../../../../services/framework-services/code-flow.service';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';

declare var $: any;
declare var Swal: any;

type FileType = 'image' | 'pdf' | 'text' | 'other';

/** نوع کلی که در modal انتخاب می‌شود */
type AddMemberMode = 'member' | 'guest';
/** نوع مهمان */
type GuestType = 'external' | 'internal';

/** نقش‌های مجاز برای افزودن عضو (نه مهمان) */
const ALLOWED_MEMBER_ROLES = [
  { id: 2, title: 'دبیر غیر عضو' },
  { id: 4, title: 'ناظر' },
  { id: 5, title: 'عضو عادی' },
];

@Component({
  selector: 'app-meeting-details-tab',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    CustomInputComponent,
    CustomSelectComponent,
    NgClass,
  ],
  templateUrl: './meeting-details-tab.html',
  styleUrl: './meeting-details-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingDetailsTabComponent {
  /** رجیستری نقش‌ها برای استفاده در قالب (به‌جای roleId های ثابت) */
  protected readonly meetingRoles = MeetingRoles;


  // ─────────────────────── DI ───────────────────────
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly roomService = inject(RoomService);
  private readonly categoryService = inject(CategoryService);
  private readonly meetingService = inject(MeetingService);
  private readonly toast = inject(ToastService);
  private readonly localStorage = inject(LocalStorageService);
  private readonly fileService = inject(FileService);
  private readonly codeFlowService = inject(CodeFlowService);
  private readonly memberService = inject(MeetingMemberService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly userService = inject(UserService);
  private readonly boardMemberService = inject(BoardMemberService);
  private readonly tusUploadService = inject(TusUploadService);
  private readonly destroyRef = inject(DestroyRef);

  // ─────────────────────── Inputs / Outputs ───────────────────────
  meetingGuid = input<string>('');
  currentTab = input<string>('details');

  tabChanged = output<string>();
  memberUpdated = output<MeetingMember>();
  agendaUpdated = output<string>();

  @ViewChild('memberScrollContainer') memberScrollContainer?: ElementRef<HTMLElement>;

  // ─────────────────────── UI state ───────────────────────
  readonly isEditingAgenda = signal<boolean>(false);
  readonly agendaText = signal<string | null>(null);
  readonly agendaFile = signal<File | null>(null);
  readonly statusId = signal<number | null>(null);
  readonly roleId = signal<number | null>(null);
  readonly downloadUrl = signal<string>('');
  readonly isDelegate = signal<boolean>(false);
  readonly isFollowUpChecked = signal<boolean>(false);

  // File viewer
  readonly fileUrl = signal<string>('');
  readonly fileContent = signal<string>('');
  readonly fileType = signal<FileType>('other');
  readonly fileName = signal<string>('');

  // Combo data
  readonly categories = signal<ComboBase[]>([]);
  readonly rooms = signal<ComboBase[]>([]);
  private readonly _meetings = signal<ComboBase[]>([]);
  readonly meetings = this._meetings.asReadonly();

  readonly locationTypes = signal([
    { guid: 'internal', title: 'حضوری درون شرکت' },
    { guid: 'external', title: 'بیرون از شرکت' },
    { guid: 'online', title: 'آنلاین' },
  ]);

  // ─────────────────────── Add Member Modal state ───────────────────────
  /** حالت modal: عضو یا مهمان */
  readonly addMemberMode = signal<AddMemberMode>('member');
  /** نوع مهمان */
  readonly addGuestType = signal<GuestType>('external');
  /** در حال ارسال درخواست ذخیره */
  readonly isSavingMember = signal<boolean>(false);

  /** لیست کاربران برای جستجو */
  private readonly _allUsers = signal<SystemUser[]>([]);
  private readonly _boardMembers = signal<BoardMember[]>([]);
  /** متن جستجو برای عضو / مهمان داخلی */
  readonly memberSearchQuery = signal<string>('');
  readonly memberDropdownVisible = signal<boolean>(false);
  /** کاربر انتخاب‌شده (عضو یا مهمان داخلی) */
  readonly selectedAddUser = signal<SystemUser | null>(null);
  /** نقش انتخاب‌شده برای عضو جدید */
  readonly selectedAddRole = signal<number>(5);

  /** نقش‌های مجاز (فقط برای حالت عضو) */
  readonly allowedMemberRoles = ALLOWED_MEMBER_ROLES;

  /** نتایج فیلتر‌شده لیست کاربران */
  readonly filteredUsers = computed(() => {
    const q = this.memberSearchQuery().toLowerCase().trim();
    const all = this._allUsers();
    if (!q) return all.slice(0, 30);           // max 30 بدون جستجو
    return all.filter(u =>
      `${u.name} ${u.userName ?? ''} ${u.position ?? ''}`.toLowerCase().includes(q)
    ).slice(0, 30);
  });

  // ─────────────────────── Computed from behavior service ───────────────────────
  readonly currentMember = computed(() => this.meetingBehaviorService.currentMember());
  readonly meeting = computed(() => this.meetingBehaviorService.meeting());

  readonly members = computed(() => {
    const src = this.meetingBehaviorService.members() ?? [];
    const rolePriority: Record<number, number> = { 6: 1, 3: 2, 1: 3, 2: 4, 4: 5, 5: 6 };
    const sorted = [...src].sort(
      (a, b) => (rolePriority[a.roleId] ?? 99) - (rolePriority[b.roleId] ?? 99)
    );
    return sorted.map(m => {
      let substitute = m.substitute;
      if (m.replacementUserGuid) {
        const rep = src.find(x => x.userGuid === m.replacementUserGuid);
        substitute = rep?.name ?? '';
      }
      return { ...m, substitute };
    });
  });

  readonly hasChairmanSigned = computed(() => {
    const chairman = this.members().find(m => MeetingRoles.isChairman(m.roleId));
    return chairman?.isSign === true;
  });

  readonly canEditMeeting = computed(() => {
    const meeting = this.meeting();
    const currentMember = this.currentMember();
    const chairmanSigned = this.hasChairmanSigned();
    const isUnsignedChairman = MeetingRoles.isChairman(meeting?.roleId) && !chairmanSigned;
    const normalEditConditions =
      MeetingRoles.isManager(meeting?.roleId ?? 0) &&
      !currentMember?.isDelegate &&
      meeting?.statusId !== 4 &&
      meeting?.statusId !== 6;
    return isUnsignedChairman || normalEditConditions;
  });

  readonly canChangeAttendance = computed(() => {
    const rId = this.roleId();
    const sId = this.statusId();
    const chairmanSigned = this.hasChairmanSigned();
    const isUnsignedChairman = rId === 3 && !chairmanSigned;
    const normalConditions = MeetingRoles.isManager(rId ?? 0) && sId === 3;
    return isUnsignedChairman || normalConditions;
  });

  /** آیا کاربر جاری اجازه افزودن عضو/مهمان دارد */
  readonly canAddMember = computed(() => {
    const meeting = this.meeting();
    const chairmanSigned = this.hasChairmanSigned();
    const isUnsignedChairman = MeetingRoles.isChairman(meeting?.roleId) && !chairmanSigned;
    const normalConditions =
      MeetingRoles.isManager(meeting?.roleId ?? 0) &&
      meeting?.statusId !== 4 &&
      meeting?.statusId !== 6;
    return isUnsignedChairman || normalConditions;
  });

  readonly fileManagementUrl = computed(() => {
    const info = this.currentMember();
    const userName = (info as any)?.userName;
    const photoUrl = encodeURIComponent(`photo/${userName}.jpg`);
    return userName
      ? `${environment.fileManagementEndpoint}/api/Image?url=${photoUrl}&w=48&q=75`
      : '/img/default-avatar.png';
  });

  // ─────────────────────── Forms ───────────────────────
  meetingForm: FormGroup = this.fb.group({
    title: ['', Validators.required],
    categoryGuid: ['', Validators.required],
    locationType: ['', Validators.required],
    roomGuid: [''],
    roomName: [''],
    roomLink: [''],
    date: ['', Validators.required],
    startTime: ['', Validators.required],
    endTime: ['', Validators.required],
    isFollowUp: [false],
    followGuid: [''],
  });

  agendaForm: FormGroup = this.fb.group({ text: [''], file: [''] });

  /** فرم مهمان خارجی */
  externalGuestForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    mobile: ['', [Validators.required, Validators.pattern(/^09\d{9}$/)]],
    email: ['', Validators.email],
    organization: ['', Validators.required],
    gender: ['Male', Validators.required],
  });

  // ─────────────────────── Constructor ───────────────────────
  constructor() {
    this.isDelegate.set(this.localStorage.getItem(IsDeletage) === 'true');

    effect(() => {
      const meeting = this.meeting();
      if (!meeting) return;
      this.agendaText.set(meeting.agenda ?? null);
      this.statusId.set(meeting.statusId ?? null);
      this.roleId.set(meeting.roleId ?? null);
      this.downloadUrl.set(
        meeting.agendaFileGuid
          ? `${this.fileService.baseUrl}/Download/${meeting.agendaFileGuid}`
          : ''
      );
    });

    effect(() => {
      const guid = this.meetingGuid();
      if (!guid) return;
      this.refreshMembersList();
    });
  }

  // ─────────────────────── Helpers ───────────────────────
  private getPositionGuid(): string | null { return this.localStorage.getItem(POSITION_ID); }
  private getUserGuid(): string | null { return this.localStorage.getItem(USER_ID_NAME); }

  private getMemberScrollTop(): number {
    return this.memberScrollContainer?.nativeElement?.scrollTop ?? 0;
  }
  private setMemberScrollTop(value: number): void {
    if (this.memberScrollContainer?.nativeElement)
      this.memberScrollContainer.nativeElement.scrollTop = value;
  }

  private hideModal(selector: string): void {
    try { $(selector).modal('hide'); } catch { /* ignore */ }
  }

  // ─────────────────────── Combos ───────────────────────
  getRooms(): void {
    this.roomService.getForCombo<ComboBase[]>()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: d => this.rooms.set(d ?? []), error: () => this.rooms.set([]) });
  }

  getCategories(): void {
    this.categoryService.getForCombo<ComboBase[]>()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: d => this.categories.set(d ?? []), error: () => this.categories.set([]) });
  }

  private async loadMeetingsList(): Promise<void> {
    try {
      const userGuid = this.getUserGuid();
      const positionGuid = this.getPositionGuid();
      const hasPermission = await this.passwordFlowService.checkPermission('MT_Meetings_ViewAllMeetings');
      const filter = { userGuid, positionGuid, filterType: 'All', canViewAll: hasPermission };
      const meetings = ((await this.meetingService.getMeetings(filter).toPromise()) as any[]) ?? [];
      const list = meetings
        .filter(m => m.guid !== this.meetingGuid())
        .map(m => ({ guid: m.guid, title: `${m.number} - ${m.title}` }));
      this._meetings.set(list);
    } catch { this._meetings.set([]); }
  }

  // ─────────────────────── Attendance ───────────────────────
  setAllPresence(isPresent: boolean): void {
    const scrollTop = this.getMemberScrollTop();
    this.memberService.setGroupAttendance({ meetingGuid: this.meetingGuid(), isPresent })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.refreshMembersList(() => this.setMemberScrollTop(scrollTop)),
        error: () => this.toast.error('خطا در ثبت حضور/غیاب گروهی'),
      });
  }

  togglePresence(member: MeetingMember, status: boolean): void {
    const scrollTop = this.getMemberScrollTop();
    this.memberService.attendance({ id: member.id, isPresent: status })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.refreshMembersList(() => this.setMemberScrollTop(scrollTop)); this.memberUpdated.emit(member); },
        error: () => this.toast.error('خطا در ثبت حضور/غیاب'),
      });
  }

  private refreshMembersList(after?: () => void): void {
    const positionGuid = this.getPositionGuid();
    const meetingGuid = this.meetingGuid();
    if (!meetingGuid) return;

    this.memberService.getUserList(meetingGuid, positionGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (userList: MeetingMember[]) => {
          const list = userList ?? [];
          await Promise.all([this.loadAllUsersForAdd(), this.loadBoardMembers()]);
          const processed = await this.processExistingMembers(list);
          this.meetingBehaviorService.setMembers(processed ?? []);
          after?.();
        },
        error: () => this.meetingBehaviorService.setMembers([]),
      });
  }

  // ─────────────────────── Edit Meeting Modal ───────────────────────
  async openEditModal(): Promise<void> {
    const guid = this.meetingGuid();
    if (!guid) return;
    this.meetingService.getForEdit(guid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (data: any) => {
          const locationType = data?.roomGuid ? 'internal'
            : (data?.roomName ?? '').trim() ? 'external' : 'online';
          this.meetingForm.patchValue({
            title: data?.title ?? '',
            categoryGuid: data?.categoryGuid ?? '',
            locationType,
            roomGuid: data?.roomGuid ?? '',
            roomName: data?.roomName ?? '',
            roomLink: data?.roomLink ?? '',
            date: data?.date ?? '',
            startTime: data?.startTime ?? '',
            endTime: data?.endTime ?? '',
            isFollowUp: !!data?.followGuid,
            followGuid: data?.followGuid ?? '',
          });
          this.isFollowUpChecked.set(!!data?.followGuid);
          this.getCategories();
          this.getRooms();
          await this.loadMeetingsList();
          $('#editModal').modal('show');
        },
        error: () => this.toast.error('خطا در بارگذاری اطلاعات جهت ویرایش'),
      });
  }

  onLocationTypeChange(): void {
    this.meetingForm.patchValue({ roomGuid: '', roomName: '', roomLink: '' });
  }

  onCheckboxChange(event: any): void {
    const checked = !!event?.target?.checked;
    this.isFollowUpChecked.set(checked);
    if (!checked) this.meetingForm.patchValue({ followGuid: '' });
  }

  saveMeeting(): void {
    if (this.meetingForm.invalid) {
      this.meetingForm.markAllAsTouched();
      this.toast.warning('اطلاعات فرم را کامل کنید');
      return;
    }
    const payload = { ...this.meetingForm.getRawValue(), guid: this.meetingGuid() };
    this.meetingService.edit(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resp: any) => {
        const data = resp?.data ?? resp?.result ?? resp;
        const categoryTitle = this.categories().find(x => x.guid === payload.categoryGuid)?.title;
        const followTitle = this.meetings().find(x => x.guid === payload.followGuid)?.title;
        this.meetingBehaviorService.updateMeeting({
          title: payload.title,
          startTime: payload.startTime,
          endTime: payload.endTime,
          mtDate: payload.date,
          categoryGuid: payload.categoryGuid,
          category: categoryTitle ?? this.meeting()?.category,
          followGuid: payload.followGuid,
          followMeeting: followTitle,
          roomGuid: payload.roomGuid,
          roomName: payload.roomName,
          roomLink: payload.roomLink,
          locationType: payload.locationType,
        } as any);
        if (data && typeof data === 'object') {
          const looksLikeMeeting =
            'guid' in data || 'number' in data || 'title' in data ||
            'mtDate' in data || 'followGuid' in data;
          if (looksLikeMeeting) this.meetingBehaviorService.updateMeeting(data);
        }
        this.hideModal('#editModal');
      },
      error: () => this.toast.error('خطا در ذخیره جلسه'),
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ Add Member / Guest Modal
  // ═══════════════════════════════════════════════════════════

  /** باز کردن modal افزودن عضو و لود لیست کاربران */
  async openAddMemberModal(): Promise<void> {
    // reset وضعیت
    this.addMemberMode.set('member');
    this.addGuestType.set('external');
    this.selectedAddUser.set(null);
    this.selectedAddRole.set(5);
    this.memberSearchQuery.set('');
    this.memberDropdownVisible.set(false);
    this.externalGuestForm.reset({ gender: 'Male' });

    // لود کاربران اگر هنوز لود نشده
    if (this._allUsers().length === 0) {
      await this.loadAllUsersForAdd();
    }

    $('#addMemberModal').modal('show');
  }

  /** لود همه کاربران برای جستجو */
  private async loadAllUsersForAdd(): Promise<void> {
    try {
      const clientId = getClientSettings().client_id ?? '';
      const users = await this.userService.getAllByClientId<SystemUser[]>(clientId).toPromise() ?? [];
      // flatten multi-position
      const flattened = users.flatMap((u: SystemUser) => {
        if (u.positions && u.positions.length > 0) {
          return u.positions.map((pos: any) => ({
            ...u,
            guid: `${u.guid}_${pos.positionGuid}`,
            positionGuid: pos.positionGuid,
            position: pos.positionTitle,
            baseUserGuid: u.guid,
            image: u.userName
              ? `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${u.userName}.jpg`)}&w=48&q=75`
              : '/img/default-avatar.png',
          }));
        }
        return [{
          ...u,
          baseUserGuid: u.guid,
          image: u.userName
            ? `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${u.userName}.jpg`)}&w=48&q=75`
            : '/img/default-avatar.png',
        }];
      });
      this._allUsers.set(flattened);
    } catch {
      this._allUsers.set([]);
    }
  }

  private async loadBoardMembers(): Promise<void> {
    if (this._boardMembers().length > 0) return;
    try {
      const boardMembers = await this.boardMemberService.getList<BoardMember[]>().toPromise() ?? [];
      this._boardMembers.set(boardMembers);
    } catch {
      this._boardMembers.set([]);
    }
  }

  private buildAllUsersIndexes(allUsers: SystemUser[]) {
    const byBaseGuid = new Map<string, SystemUser[]>();
    const positionTitleByGuid = new Map<string, string>();

    for (const u of allUsers) {
      const base = (u as any).baseUserGuid || u.guid;
      if (!byBaseGuid.has(base)) byBaseGuid.set(base, []);
      byBaseGuid.get(base)!.push(u);

      if (u.positionGuid && u.position) {
        if (!positionTitleByGuid.has(u.positionGuid)) {
          positionTitleByGuid.set(u.positionGuid, u.position);
        }
      }
    }

    return { byBaseGuid, positionTitleByGuid };
  }

  private pickPreferredEntry(entries: SystemUser[]): SystemUser {
    return entries[0];
  }

  private resolveMeetingPositionTitle(
    member: MeetingMember,
    positionTitleByGuid: Map<string, string>
  ): string {
    if (member.position && member.position.trim() !== '') return member.position;
    if (member.positionGuid) {
      const t = positionTitleByGuid.get(member.positionGuid);
      if (t && t.trim() !== '') return t;
    }
    return 'سمت نامشخص';
  }

  private getDefaultMemberImage(member: MeetingMember): string {
    if (member.boardMemberGuid) {
      return 'img/default-avatar.png';
    }
    if (member.userName) {
      return `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${member.userName}.jpg`)}&w=48&q=75`;
    }
    return 'img/default-avatar.png';
  }

  private getSystemUserImage(user: SystemUser): string {
    if (user.userName && user.userName.trim() !== '') {
      return `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${user.userName}.jpg`)}&w=48&q=75`;
    }
    return 'img/default-avatar.png';
  }

  private async processExistingMembers(members: MeetingMember[]): Promise<MeetingMember[]> {
    const processedMembers: MeetingMember[] = [];
    const allUsers = this._allUsers();
    const boardMembers = this._boardMembers();

    const { byBaseGuid, positionTitleByGuid } = this.buildAllUsersIndexes(allUsers);

    const imageGuidsToLoad: string[] = [];
    for (const member of members) {
      if (member.profileGuid) imageGuidsToLoad.push(member.profileGuid);
      if (member.boardMemberGuid) {
        const bm = boardMembers.find(x => x.guid === member.boardMemberGuid || x.id === member.boardMemberGuid);
        if (bm?.profileImageGuid) imageGuidsToLoad.push(bm.profileImageGuid);
      }
    }

    const imageUrlMap = imageGuidsToLoad.length > 0
      ? await this.tusUploadService.getFilePreviewUrls(imageGuidsToLoad)
      : new Map<string, string>();

    for (const member of members) {
      const m: any = { ...member };

      if (member.boardMemberGuid) {
        const bm = boardMembers.find(x => x.guid === member.boardMemberGuid || x.id === member.boardMemberGuid);
        if (bm) {
          m.name = bm.fullName;
          m.position = bm.position || m.position || 'سمت نامشخص';

          if (bm.profileImageGuid) {
            const img = imageUrlMap.get(bm.profileImageGuid.toLowerCase());
            m.image = img || 'img/default-avatar.png';
          } else {
            m.image = 'img/default-avatar.png';
          }
        }

        if (member.replacementUserGuid) {
          m.substitute = members.find(x => x.userGuid === member.replacementUserGuid)?.name || '';
        }

        processedMembers.push(m);
        continue;
      }

      if (member.userGuid && !member.isExternal) {
        const entries = byBaseGuid.get(member.userGuid) || [];
        const meetingPositionTitle = this.resolveMeetingPositionTitle(member, positionTitleByGuid);

        const exact = member.positionGuid
          ? entries.find(u => u.positionGuid === member.positionGuid)
          : undefined;

        if (exact) {
          m.guid = exact.guid;
          m.positionGuid = exact.positionGuid;
          m.position = meetingPositionTitle;
          m.currentPosition = exact.position || '';
          m.currentPositionGuid = exact.positionGuid || '';
          m.positionChanged = false;
          m.userIsActive = (exact as any).userIsActive ?? true;
        } else if (entries.length > 0) {
          const preferred = this.pickPreferredEntry(entries);
          m.guid = preferred.guid;
          m.positionGuid = member.positionGuid || '';
          m.position = meetingPositionTitle;
          m.currentPosition = preferred.position || '';
          m.currentPositionGuid = preferred.positionGuid || '';
          m.positionChanged = !!member.positionGuid;
          m.userIsActive = (preferred as any).userIsActive ?? true;
        } else {
          m.position = meetingPositionTitle;
          m.positionGuid = member.positionGuid || '';
          m.userMissingInAllUsers = true;
        }

        if (member.profileGuid) {
          const img = imageUrlMap.get(member.profileGuid.toLowerCase());
          m.image = img || this.getDefaultMemberImage(member);
        } else {
          const fallbackUser = entries.length > 0 ? this.pickPreferredEntry(entries) : null;
          m.image = fallbackUser ? this.getSystemUserImage(fallbackUser) : this.getDefaultMemberImage(member);
        }

        if (member.replacementUserGuid) {
          m.substitute = members.find(x => x.userGuid === member.replacementUserGuid)?.name || '';
        }

        processedMembers.push(m);
        continue;
      }

      if (member.isExternal) {
        m.position = m.position || member.organization || 'مهمان';

        if (member.profileGuid) {
          const img = imageUrlMap.get(member.profileGuid.toLowerCase());
          m.image = img || 'img/default-avatar.png';
        } else {
          m.image = 'img/default-avatar.png';
        }

        if (member.replacementUserGuid) {
          m.substitute = members.find(x => x.userGuid === member.replacementUserGuid)?.name || '';
        }

        processedMembers.push(m);
        continue;
      }

      m.position = m.position || 'سمت نامشخص';
      m.image = m.image || 'img/default-avatar.png';

      if (member.replacementUserGuid) {
        m.substitute = members.find(x => x.userGuid === member.replacementUserGuid)?.name || '';
      }

      processedMembers.push(m);
    }

    return processedMembers;
  }

  /** تغییر حالت modal بین عضو و مهمان */
  onAddMemberModeChange(mode: AddMemberMode): void {
    this.addMemberMode.set(mode);
    this.selectedAddUser.set(null);
    this.memberSearchQuery.set('');
    this.memberDropdownVisible.set(false);
    if (mode === 'member') this.selectedAddRole.set(5);
    this.externalGuestForm.reset({ gender: 'Male' });
  }

  /** تغییر نوع مهمان */
  onAddGuestTypeChange(type: GuestType): void {
    this.addGuestType.set(type);
    this.selectedAddUser.set(null);
    this.memberSearchQuery.set('');
    this.memberDropdownVisible.set(false);
    this.externalGuestForm.reset({ gender: 'Male' });
  }

  /** جستجوی کاربر در input */
  onMemberSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.memberSearchQuery.set(val);
    this.memberDropdownVisible.set(true);
  }

  /** نمایش dropdown */
  showMemberDropdown(): void { this.memberDropdownVisible.set(true); }

  /** پنهان کردن dropdown با تاخیر (برای کلیک روی آیتم) */
  hideMemberDropdown(): void {
    setTimeout(() => this.memberDropdownVisible.set(false), 200);
  }

  /** انتخاب کاربر از dropdown */
  selectUserForAdd(user: SystemUser): void {
    this.selectedAddUser.set(user);
    this.memberSearchQuery.set(user.name);
    this.memberDropdownVisible.set(false);
  }

  /** ذخیره عضو / مهمان جدید */
  saveNewMember(): void {
    const mode = this.addMemberMode();
    const mGuid = this.meetingGuid();
    if (!mGuid) return;

    if (mode === 'member' || (mode === 'guest' && this.addGuestType() === 'internal')) {
      // نیاز به کاربر انتخاب‌شده
      const user = this.selectedAddUser();
      if (!user) {
        this.toast.warning('لطفاً یک کاربر انتخاب کنید');
        return;
      }
      const roleId = mode === 'member' ? this.selectedAddRole() : 6;
      const payload = {
        meetingGuid: mGuid,
        userGuid: (user as any).baseUserGuid ?? user.guid,
        positionGuid: user.positionGuid ?? null,
        name: user.name,
        persNo: user.userName ?? null,
        roleId,
        isExternal: false,
        isRemoved: false,
      };
      this.submitNewMember(payload);

    } else {
      // مهمان خارجی
      if (this.externalGuestForm.invalid) {
        this.externalGuestForm.markAllAsTouched();
        this.toast.warning('اطلاعات فرم را کامل کنید');
        return;
      }
      const fv = this.externalGuestForm.getRawValue();
      const payload = {
        meetingGuid: mGuid,
        name: fv.name,
        mobile: fv.mobile,
        email: fv.email || null,
        organization: fv.organization,
        gender: fv.gender,
        roleId: MeetingRoles.guest,
        isExternal: true,
        isRemoved: false,
      };
      this.submitNewMember(payload);
    }
  }

  private submitNewMember(payload: any): void {
    this.isSavingMember.set(true);
    this.memberService.createOrEdit(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.hideModal('#addMemberModal');
          this.refreshMembersList();
          this.isSavingMember.set(false);
        },
        error: () => {
          this.toast.error('خطا در افزودن عضو/مهمان');
          this.isSavingMember.set(false);
        },
      });
  }

  // ─────────────────────── Agenda ───────────────────────
  toggleEditAgenda(): void {
    if (!this.isEditingAgenda()) {
      this.agendaForm = this.fb.group({ text: [this.agendaText() ?? ''], file: [''] });
    }
    this.isEditingAgenda.update(v => !v);
    this.agendaUpdated.emit(this.agendaText() ?? '');
  }

  removeAgendaItem(): void {
    this.agendaText.set(null);
    this.agendaFile.set(null);
    this.isEditingAgenda.set(false);
    this.agendaForm.reset();
    this.agendaUpdated.emit('');
  }

  onFileChange(event: any): void {
    const file: File | undefined = event?.target?.files?.[0];
    if (!file) return;
    this.agendaForm.patchValue({ file });
    this.agendaFile.set(file);
  }

  // ─────────────────────── File Viewer ───────────────────────
  viewFile(fileGuid?: string): void {
    if (!fileGuid) return;
    this.fileService.getFileDetails(fileGuid).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: file => {
        this.fileName.set(file.fileName);
        this.downloadUrl.set(`${this.fileService.baseUrl}/Download/${fileGuid}`);
        const ab = this.base64ToArrayBuffer(file.file);
        const blob = new Blob([ab], { type: file.contentType });
        this.fileUrl.set(URL.createObjectURL(blob));
        if (file.contentType?.startsWith('image')) this.fileType.set('image');
        else if (file.contentType === 'application/pdf') this.fileType.set('pdf');
        else if (file.contentType?.startsWith('text')) { this.fileType.set('text'); this.readTextFile(blob); }
        else this.fileType.set('other');
        this.showModal();
      },
      error: () => this.toast.error('خطا در دریافت فایل'),
    });
  }

  download(fileGuid?: string): void {
    if (!fileGuid) return;
    const token = this.codeFlowService.getToken();
    fetch(`${this.fileService.baseUrl}/Download/${fileGuid}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = '';
        document.body.appendChild(a); a.click(); a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => { });
  }

  readTextFile(blob: Blob): void {
    const reader = new FileReader();
    reader.onload = () => this.fileContent.set((reader.result as string) ?? '');
    reader.readAsText(blob);
  }

  showModal(): void {
    try { $('#fileViewerModal').modal('toggle'); } catch { /* ignore */ }
  }

  showImageModal(imageUrl: string): void {
    Swal.fire({ imageUrl, imageAlt: 'فایل پیوست', showConfirmButton: false, showCloseButton: true });
  }

  confirmDeleteFile(): void {
    Swal.fire({
      title: 'حذف فایل پیوست', text: 'آیا از حذف این فایل اطمینان دارید؟',
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'بله، حذف شود', cancelButtonText: 'خیر',
    }).then((result: { isConfirmed: boolean }) => {
      if (result.isConfirmed) this.deleteFile();
    });
  }

  deleteFile(): void {
    const meeting = this.meeting();
    if (!meeting?.agendaFileGuid) return;
    this.fileService.delete(meeting.agendaFileGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.meetingBehaviorService.updateMeeting({ agendaFileGuid: undefined } as any),
        error: () => this.toast.error('خطا در حذف فایل.'),
      });
  }

  // ─────────────────────── Utils ───────────────────────
  base64ToArrayBuffer(base64: string): ArrayBuffer {
    if (!base64) return new ArrayBuffer(0);
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
  }
}
