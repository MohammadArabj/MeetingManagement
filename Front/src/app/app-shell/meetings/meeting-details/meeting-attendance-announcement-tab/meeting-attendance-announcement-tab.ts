import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LocalStorageService } from '../../../../services/framework-services/local.storage.service';
import { SwalService } from '../../../../services/framework-services/swal.service';
import { MeetingMemberService } from '../../../../services/meeting-member.service';
import { MeetingService } from '../../../../services/meeting.service';
import { RoleService } from '../../../../services/role.service';
import { UserService } from '../../../../services/user.service';
import { MeetingBehaviorService } from '../meeting-behavior-service';
import { MeetingDetails, MeetingMember } from '../../../../core/models/Meeting';
import { Position, SystemUser } from '../../../../core/models/User';
import { USER_ID_NAME } from '../../../../core/types/configuration';
import { ComboBase } from '../../../../shared/combo-base';
import { CustomSelectComponent } from '../../../../shared/custom-controls/custom-select';
import { getClientSettings } from '../../../../services/framework-services/code-flow.service';
import { environment } from '../../../../../environments/environment';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';

@Component({
  selector: 'app-meeting-attendance-announcement-tab',
  imports: [CustomSelectComponent, ReactiveFormsModule],
  templateUrl: './meeting-attendance-announcement-tab.html',
  styleUrl: './meeting-attendance-announcement-tab.css'
})
export class MeetingAttendanceAnnouncementTabComponent {
  // ═══════════════════════════════════════════════════════════════
  // Injected Services
  // ═══════════════════════════════════════════════════════════════
  private readonly meetingMemberService = inject(MeetingMemberService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly route = inject(ActivatedRoute);
  private readonly meetingService = inject(MeetingService);
  private readonly userService = inject(UserService);
  private readonly fb = inject(FormBuilder);
  private readonly swalService = inject(SwalService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly roleService = inject(RoleService);

  // ═══════════════════════════════════════════════════════════════
  // Signals - Reactive State
  // ═══════════════════════════════════════════════════════════════
  readonly meetingGuid = signal<string>('');
  readonly meeting = signal<any>(null);
  readonly members = signal<MeetingMember[]>([]);
  readonly currentMember = signal<MeetingMember | null>(null);
  readonly users = signal<ComboBase[]>([]);
  readonly userList = signal<SystemUser[]>([]);
  readonly isSubstitute = signal<boolean>(false);
  readonly substituteName = signal<string>('');
  readonly attendance = signal<string | null>(null);
  readonly substitute = signal<string | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // Computed Properties
  // ═══════════════════════════════════════════════════════════════

  /** آیا گزینه جانشین فعال است */
  readonly substituteEnabled = computed(() => this.attendance() === 'notAttending');

  /** شناسه کاربر جاری */
  readonly currentUserGuid = computed(() =>
    this.localStorageService.getItem(USER_ID_NAME)
  );

  /** عضوی که کاربر جاری جانشین آن است */
  readonly replacementMember = computed(() => {
    const members = this.members();
    const userGuid = this.currentUserGuid();
    return members.find(member => member.replacementUserGuid === userGuid);
  });

  /**
   * ✅ لیست کاربران مجاز برای انتخاب به عنوان جانشین
   * 
   * فیلترها:
   * 1. خود کاربر فعلی نباید در لیست باشد
   * 2. کاربرانی که در حال حاضر جانشین کس دیگری هستند نباید در لیست باشند
   * 3. دبیر و رئیس جلسه نباید در لیست باشند (roleId = 1, 2, 3)
   */
/**
 * ✅ لیست کاربران مجاز برای انتخاب به عنوان جانشین
 */
readonly filteredUsers = computed(() => {
    const members = this.members();
    const currentUserGuid = this.currentUserGuid();
    const currentMember = this.currentMember();
    const allUsers = this.userList();

    if (!currentMember || !allUsers.length) {
        return [];
    }

    // مرحله 1: پیدا کردن کاربرانی که در حال حاضر جانشین کسی هستند
  // مرحله 1: پیدا کردن کاربرانی که در حال حاضر جانشین کسی هستند
  // ✅ اما نه جانشین خود عضو فعلی، چون باید در dropdown نمایش داده شود
  const usersWhoAreAlreadySubstitutes = new Set(
    members
      .filter(member =>
        member.replacementUserGuid !== null &&
        member.replacementUserGuid !== undefined &&
        member.userGuid !== currentMember.userGuid  // ✅ استثنا: خودم
      )
      .map(member => member.replacementUserGuid)
  );
    // مرحله 2: پیدا کردن اعضایی که دبیر یا رئیس جلسه هستند
    const secretaryAndChairGuids = new Set(
        members
            .filter(member => MeetingRoles.isKeyRole(member.roleId))
            .map(member => member.userGuid)
    );

    // مرحله 3: فیلتر کردن کاربران
    const eligibleUsers = allUsers.filter(user => {
        const baseUserGuid = (user as any).baseUserGuid || user.guid;

        // ❌ خود کاربر فعلی نباشد
        if (baseUserGuid === currentUserGuid) {
            return false;
        }

        // ❌ کاربرانی که در حال حاضر جانشین کس دیگری هستند
        if (usersWhoAreAlreadySubstitutes.has(baseUserGuid)) {
            return false;
        }

        // ❌ دبیر یا رئیس جلسه نباشند
        if (secretaryAndChairGuids.has(baseUserGuid)) {
            return false;
        }

        return true;
    });

    // ═══════════════════════════════════════════════════════════════
    // ✅ مرحله 4: تبدیل به فرمت ComboBase با حفظ اطلاعات اضافی
    // ═══════════════════════════════════════════════════════════════
    return eligibleUsers.map(user => ({
        guid: user.guid,                                    // guid ترکیبی (userGuid_positionGuid)
        title: `${user.name}${(user as any).position ? ' - ' + (user as any).position : ''}`,
        // ✅ اطلاعات اضافی برای استفاده در submit
        baseUserGuid: (user as any).baseUserGuid || user.guid,
        positionGuid: (user as any).positionGuid || '',
        persNo: (user as any).userName || ''
    }));
});

  // ═══════════════════════════════════════════════════════════════
  // Form
  // ═══════════════════════════════════════════════════════════════
  readonly replacementForm = this.fb.group({
    attendance: [''],
    replacementUserGuid: ['']
  });

  // ═══════════════════════════════════════════════════════════════
  // Constructor & Effects
  // ═══════════════════════════════════════════════════════════════
  constructor() {
    this.setupRouteEffect();
    this.setupMeetingDataEffect();
    this.setupFormUpdateEffect();
    this.loadUsers();
    this.setupUsersListEffect();
    this.setupFormControlStateEffect();
  }

  /** Effect برای هندل کردن تغییرات route parameter */
  private setupRouteEffect(): void {
    effect(() => {
      this.route.paramMap.subscribe(params => {
        const guid = params.get('guid') || '';
        this.meetingGuid.set(guid);
      });
    });
  }

  /** Effect برای همگام‌سازی با meeting behavior service */
  private setupMeetingDataEffect(): void {
    effect(() => {
      // همگام‌سازی داده‌های جلسه
      this.meeting.set(this.meetingBehaviorService.meeting());

      // همگام‌سازی داده‌های اعضا
      const members = this.meetingBehaviorService.members();
      this.members.set(members);

      // به‌روزرسانی عضو فعلی
      const userGuid = this.currentUserGuid();
      const currentMember = members.find(member => member.userGuid === userGuid);
      this.currentMember.set(currentMember || null);
    });
  }
  private setupFormUpdateEffect(): void {
    effect(() => {
      const currentMember = this.currentMember();
      const replacementMember = this.replacementMember();
      const userList = this.userList(); // ✅ باید اینجا خوانده شود تا dependency track شود

      if (currentMember && userList.length > 0) { // ✅ صبر برای لود شدن لیست
        const attendanceValue = currentMember.isAttendance === true
          ? 'attending'
          : currentMember.isAttendance === false
            ? 'notAttending'
            : '';

        const user = userList.find(u =>
          (u as any).baseUserGuid === currentMember.replacementUserGuid
        );

        this.replacementForm.patchValue({
          attendance: attendanceValue,
          replacementUserGuid: (user as any)?.baseUserGuid || ''
        }, { emitEvent: false });

        const amISubstitute = replacementMember !== null && replacementMember !== undefined;
        this.isSubstitute.set(amISubstitute);
        this.substituteName.set(amISubstitute ? replacementMember?.name || '' : '');
        this.attendance.set(
          currentMember.isAttendance === true ? 'attending' :
            currentMember.isAttendance === false ? 'notAttending' : null
        );
      }
    });
  }


  /** Effect برای به‌روزرسانی لیست کاربران dropdown */
  private setupUsersListEffect(): void {
    effect(() => {
      this.users.set(this.filteredUsers().map(user => ({ title:user.title, guid: user.baseUserGuid })));
      
    });
  }

  /** Effect برای کنترل وضعیت enable/disable فرم */
  private setupFormControlStateEffect(): void {
    effect(() => {
      const meeting = this.meeting();
      const control = this.replacementForm.get('replacementUserGuid');

      if (meeting?.statusId === 2) {
        control?.enable({ emitEvent: false });
      } else {
        control?.disable({ emitEvent: false });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Event Handlers
  // ═══════════════════════════════════════════════════════════════

  /** تغییر وضعیت حضور */
  onAttendanceChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.attendance.set(target.value);

    // اگر حضور دارد، جانشین را پاک کن
    if (target.value === 'attending') {
      this.substitute.set(null);
      this.replacementForm.get('replacementUserGuid')?.setValue(null);
    }
  }

  /** تغییر جانشین انتخاب شده */
  onReplacementUserChange(selectedUserGuid: string): void {
    if (!selectedUserGuid) return;

    const members = this.members();
    const userList = this.userList();

    // پیدا کردن کاربر انتخاب شده
    const selectedUser = userList.find(user => user.guid === selectedUserGuid);

    if (!selectedUser) return;

    const baseUserGuid = (selectedUser as any).baseUserGuid || selectedUser.guid;

    // ❌ بررسی: آیا این کاربر عضو جلسه است و roleId خاصی دارد؟
    const memberRecord = members.find(m => m.userGuid === baseUserGuid);

    if (memberRecord) {
      // ❌ بررسی: آیا دبیر یا رئیس جلسه است؟
      if (MeetingRoles.isKeyRole(memberRecord.roleId)) {
        this.swalService.fireDangeredSwal(
          'انتخاب جانشین',
          'دبیر یا رئیس جلسه نمی‌توانند به عنوان جانشین انتخاب شوند'
        );
        this.replacementForm.get('replacementUserGuid')?.setValue(null);
        return;
      }

      // ❌ بررسی: آیا این کاربر قبلاً جانشین کسی است؟
      if (memberRecord.replacementUserGuid) {
        this.swalService.fireDangeredSwal(
          'انتخاب جانشین',
          'این کاربر قبلاً جانشین انتخاب شده است'
        );
        this.replacementForm.get('replacementUserGuid')?.setValue(null);
        return;
      }
    }

    // ❌ بررسی: آیا این کاربر جانشین کس دیگری است؟
    const isAlreadySubstitute = members.some(
      member => member.replacementUserGuid === baseUserGuid
    );

    if (isAlreadySubstitute) {
      this.swalService.fireDangeredSwal(
        'انتخاب جانشین',
        'این کاربر در حال حاضر جانشین یکی از اعضا است'
      );
      this.replacementForm.get('replacementUserGuid')?.setValue(null);
    }
  }
  // ═══════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════

  private processUsersForMultiPosition(users: SystemUser[]): SystemUser[] {
    return users.flatMap(user => {
      const userIsActive = (user as any).isActive ?? true; // اگر فیلد دارید، مستقیم user.isActive

      if (user.positions && user.positions.length > 0) {
        return user.positions.map((position: Position) => ({
          guid: `${user.guid}_${position.positionGuid}`,
          name: user.name,
          userName: user.userName,
          positions: [position],
          positionGuid: position.positionGuid,
          position: position.positionTitle,
          image: user.userName
            ? `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${user.userName}.jpg`)}&w=48&q=75`
            : 'img/default-avatar.png',
          isSystem: true,
          baseUserGuid: user.guid,
          // ✅ اضافه
          userIsActive
        } as any));
      }

      // بدون سمت
      return [{
        ...user,
        guid: user.guid,
        positionGuid: '',
        position: 'بدون سمت',
        image: user.userName
          ? `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${user.userName}.jpg`)}&w=48&q=75`
          : 'img/default-avatar.png',
        isSystem: true,
        baseUserGuid: user.guid,
        // ✅ اضافه
        userIsActive
      } as any];
    });
  }


  private async loadUsers(): Promise<void> {
    try {
      const clientId = getClientSettings().client_id ?? '';
      const users = await this.userService.getAllByClientId<SystemUser[]>(clientId).toPromise() || [];

      const processedUsers = this.processUsersForMultiPosition(users);

      this.userList.set(processedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      this.userList.set([]);
    }
  }
  /** ثبت وضعیت حضور */


  submitAttendance(): void {
    const currentMember = this.currentMember();
    const userList = this.userList();

    if (!currentMember) {
      this.swalService.fireDangeredSwal('خطا', 'اطلاعات عضو یافت نشد');
      return;
    }

    const isAttending = this.attendance() === 'attending';
    const replacementUserGuid = this.replacementForm.value.replacementUserGuid;

    // ✅ اگر کاربر اعلام می‌کند که حضور پیدا می‌کند، بررسی کن آیا تداخلی برایش وجود دارد یا نه
    // در صورت وجود تداخل، فقط هشدار بده (نه مسدودسازی) و اجازه ویرایش بده
    if (isAttending) {
      this.meetingService.checkConflicts({
        meetingGuid: this.meeting()?.guid || '',
        date: this.meeting()?.date || this.meeting()?.mtDate,
        startTime: this.meeting()?.startTime,
        endTime: this.meeting()?.endTime,
        members: [{
          userGuid: currentMember.userGuid,
          userName: currentMember.userName || '',
          positionGuid: currentMember.positionGuid || null,
          boardMemberId: null
        }],
        roomGuid: '',
        isBoardMeeting: false
      }).subscribe({
        next: (result: any) => {
          const hasRealConflict = (result?.usersWithConflict || [])
            .some((c: any) => c.guid === currentMember.userGuid && c.type === 'Meeting');

          if (hasRealConflict) {
            this.swalService.fireDangeredSwal(
              'هشدار تداخل',
              'با حضور شما در این جلسه، تداخل با جلسه دیگری ایجاد می‌شود. لطفاً این تداخل را بررسی و رفع کنید. (ثبت همچنان امکان‌پذیر است)'
            );
          }

          this.proceedSubmitAttendance(currentMember, isAttending, replacementUserGuid, userList);
        },
        error: () => {
          // در صورت خطا در بررسی تداخل، اجازه ادامه ثبت بده
          this.proceedSubmitAttendance(currentMember, isAttending, replacementUserGuid, userList);
        }
      });
      return;
    }

    this.proceedSubmitAttendance(currentMember, isAttending, replacementUserGuid, userList);
  }

  private proceedSubmitAttendance(
    currentMember: MeetingMember,
    isAttending: boolean,
    replacementUserGuid: any,
    userList: SystemUser[]
  ): void {
    const body: {
      id: number;
      userGuid?: string;
      isAttendance: boolean;
      replacementUserGuid?: string;
      replacementPositionGuid?: string;
      persNo?: string;
    } = {
      id: currentMember.id ?? 0,
      userGuid: currentMember.userGuid,
      isAttendance: isAttending
    };

    if (!isAttending && replacementUserGuid) {
      const replacementUser = userList.find(user => user.baseUserGuid === replacementUserGuid);

      if (replacementUser) {
        const baseUserGuid = (replacementUser as any).baseUserGuid || replacementUser.guid;
        body.replacementUserGuid = baseUserGuid;
        body.replacementPositionGuid = (replacementUser as any).positionGuid || null;
        body.persNo = (replacementUser as any).userName || null;
      }
    }

    this.meetingMemberService.setSubstitute(body).subscribe({
      next: () => {
        location.reload();
      },
      error: (error) => {
        console.error('Error submitting attendance:', error);
        this.swalService.fireDangeredSwal('خطا', 'خطا در ثبت وضعیت حضور');
      }
    });
  }
}