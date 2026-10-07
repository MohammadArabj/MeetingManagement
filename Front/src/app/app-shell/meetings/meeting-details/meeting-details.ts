import { readIsMeetingAdmin } from '../../../core/auth/session.store';
import { PasswordFlowService } from './../../../services/framework-services/password-flow.service';
import {
  Component,
  OnInit,
  signal,
  computed,
  effect,
  inject,
  DestroyRef
} from '@angular/core';
import { ParamMap, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MeetingService } from '../../../services/meeting.service';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { Location } from '@angular/common';
import { CreatType } from '../../../core/types/enums';
import { MeetingMemberService } from '../../../services/meeting-member.service';
import { MeetingMember } from '../../../core/models/Meeting';
import { forkJoin } from 'rxjs/internal/observable/forkJoin';
import { ResolutionService } from '../../../services/resolution.service';
import { environment } from '../../../../environments/environment';
import { SwalService } from '../../../services/framework-services/swal.service';
import { ToastService } from '../../../services/framework-services/toast.service';
import { MeetingOpsComponent } from '../meeting-ops/meeting-ops';
import { MeetingBehaviorService } from './meeting-behavior-service';
import { MeetingDetailsTabComponent } from './meeting-details-tab/meeting-details-tab';
import { MeetingMembersTabComponent } from './meeting-members-tab/meeting-members-tab';
import { MeetingMinutesTabComponent } from './meeting-minutes-tab/meeting-minutes-tab';
import { MeetingContentTabComponent } from './meeting-content-tab/meeting-content-tab';
import { MeetingAttendanceAnnouncementTabComponent } from './meeting-attendance-announcement-tab/meeting-attendance-announcement-tab';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeetingAgendaTabComponent } from './meeting-agenda-tab/meeting-agenda-tab.component';
import { TusUploadService } from '../../../services/framework-services/tus-upload.service';
import { USER_ID_NAME, POSITION_ID } from '../../../core/types/configuration';
import { AppSettings } from '../../../services/system-setting.service';
import { MeetingFollowupTabComponent } from "./meeting-followup-tab/meeting-followup-tab";
import { NavigationService } from '../../../services/framework-services/navigation.service';
import { MeetingRoles } from '../../../core/meeting-access/meeting-roles';
import { MeetingStatus, MeetingStatuses } from '../../../core/meeting-access/meeting-status';
import { MeetingAccessService } from '../../../core/meeting-access/meeting-access.service';

declare var $: any;
declare var Swal: any;

@Component({
  selector: 'app-meeting-details',
  templateUrl: './meeting-details.html',
  styleUrls: ['./meeting-details.css'],
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MeetingContentTabComponent,
    MeetingMinutesTabComponent,
    MeetingOpsComponent,
    MeetingAgendaTabComponent,
    MeetingDetailsTabComponent,
    MeetingAttendanceAnnouncementTabComponent,
    MeetingMembersTabComponent,
    MeetingFollowupTabComponent
  ]
})
export class MeetingDetailsComponent implements OnInit {

  // Injected services
  private readonly route = inject(ActivatedRoute);
  private readonly meetingService = inject(MeetingService);
  /** دسترسی سمت سرور روی جلسه (منبع حقیقت برای *meetingCan و MeetingAccessService.can) */
  private readonly meetingAccess = inject(MeetingAccessService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly memberService = inject(MeetingMemberService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly resolutionService = inject(ResolutionService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly swalService = inject(SwalService);
  private readonly tusUploadService = inject(TusUploadService);
  private readonly toastService = inject(ToastService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly navigationService = inject(NavigationService);
  private readonly destroyRef = inject(DestroyRef);


  // Private writable signals for internal state
  private readonly _meetingGuid = signal<string>('');
  private readonly _meetingTitle = signal<string>('');
  private readonly _activeTab = signal<string>('navs-meetingDetails');
  private readonly _permissions = signal<Set<string>>(new Set());
  private readonly _isDelegate = signal<boolean>(false);
  private readonly _buttonText = signal<string>('');
  private readonly _showButton = signal<boolean>(false);
  private readonly _buttonStatus = signal<number>(0);
  private readonly _checkChairman = signal<any>(null);
  private readonly _isSubstitute = signal<boolean>(false);
  readonly _loaded = signal(false);

  // Public readonly signals
  readonly meetingGuid = this._meetingGuid.asReadonly();
  readonly meetingTitle = this._meetingTitle.asReadonly();
  readonly activeTab = this._activeTab.asReadonly();
  readonly permissions = this._permissions.asReadonly();
  readonly isDelegate = this._isDelegate.asReadonly();
  readonly buttonText = this._buttonText.asReadonly();
  readonly showButton = this._showButton.asReadonly();
  readonly buttonStatus = this._buttonStatus.asReadonly();
  readonly checkChairman = this._checkChairman.asReadonly();
  readonly isSubstitute = this._isSubstitute.asReadonly();

  // Computed signals from behavior service
  readonly meeting = computed(() => this.meetingBehaviorService.meeting());
  readonly currentMember = computed(() => this.meetingBehaviorService.currentMember());
  readonly members = computed(() => this.meetingBehaviorService.members());
  readonly resolutions = computed(() => this.meetingBehaviorService.resolutions());
  readonly isBoardMeeting = computed(() => this.meetingBehaviorService.isBoardMeeting());

  readonly statusId = computed(() => this.meeting()?.statusId);
  readonly roleId = computed(() => this.meeting()?.roleId);

  // Constants
  readonly createType = CreatType.Edit;

  readonly steps = [
    { id: 2, label: 'ثبت اولیه', icon: '' },
    { id: 3, label: 'برگزار شده', icon: '' },
    { id: 4, label: 'ثبت نهایی', icon: '' },
    { id: 6, label: 'اتمام یافته', icon: '' }
  ];
  readonly boardMeetingsteps = [
    { id: 2, label: 'ثبت اولیه', icon: '' },
    { id: 3, label: 'برگزار شده', icon: '' },
    { id: 6, label: 'اتمام یافته', icon: '' }
  ];
  // Computed properties for UI logic
  readonly visibleMainTab = computed((): 'ops' | 'details' | null => {
    const isSuperAdmin = readIsMeetingAdmin();
    const currentMember = this.currentMember();
    const isDelegate = currentMember?.isDelegate ?? false;
    const statusId = this.statusId();
    const roleId = this.roleId();

    if (isSuperAdmin) {
      return 'ops';
    }

    // ویرایش اطلاعات جلسه فقط پیش از برگزاری (پیش‌نویس، ثبت اولیه، تعیین تکلیف نشده) — هم‌راستا با سرور
    const canShowMeetingOps =
      MeetingStatuses.is(statusId, MeetingStatus.Draft, MeetingStatus.Registered, MeetingStatus.Undetermined) &&
      MeetingRoles.isManager(roleId) &&
      !isDelegate;

    if (canShowMeetingOps) {
      return 'ops';
    }

    const canShowMeetingDetails =
      (MeetingStatuses.is(statusId, MeetingStatus.Draft, MeetingStatus.Registered, MeetingStatus.Cancelled, MeetingStatus.Held, MeetingStatus.Undetermined) && (roleId === 0 || (MeetingRoles.isMember(roleId) && !MeetingRoles.isManager(roleId) && !MeetingRoles.isGuest(roleId) && !MeetingRoles.isObserver(roleId)))) ||
      (statusId !== MeetingStatus.Draft && (roleId === 0 || (MeetingRoles.isMember(roleId) && !MeetingRoles.isGuest(roleId)))) ||
      (MeetingRoles.isManager(roleId) && isDelegate);

    if (canShowMeetingDetails) {
      return 'details';
    }

    return null;
  });

  readonly showMainTab = computed(() => this.visibleMainTab() !== null);

  constructor() {
    this.setupEffects();
  }

  private setupEffects(): void {
    //Effect to handle meeting GUID from input or route
    // effect(() => {
    //   const inputGuid = this.meetingGuidInput();
    //   if (inputGuid) {
    //     this._meetingGuid.set(inputGuid);
    //     this.getMeetingDetails();
    //   }
    // });

    // // Effect to update button configuration when meeting or members change
    effect(() => {
      const meeting = this.meeting();
      const currentMember = this.currentMember();
      const statusId = this.statusId();
      const roleId = this.roleId();

      if (meeting && statusId && roleId !== undefined) {
        this.updateButtonConfiguration();
      }
    });

    // // Effect to handle delegate status
    // effect(() => {
    //   const delegateStatus = this.localStorageService.getItem(IsDeletage) === 'true';
    //   this._isDelegate.set(delegateStatus);
    // });
  }

  ngOnInit(): void {
    // Only subscribe to route if no input is provided
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params: ParamMap) => {
        const guid = params.get('guid');
        if (guid) {
          this._meetingGuid.set(guid);
          this.getMeetingDetails();
        }
      });

    this.loadPermissions();
  }

  private async loadPermissions(): Promise<void> {
    const permissionsToCheck = [
      'MT_Resolutions_Add',
      'MT_Resolutions_Edit',
      'MT_Resolutions_Delete',
      'MT_Resolutions_Assign',
      'MT_Resolutions_ViewFiles',
      'MT_Resolutions_DeleteFiles',
      'MT_Descriptions_Edit',
      'MT_Meetings_Hold',
      'MT_Meetings_FinalRegister',
      'MT_Meetings_Finalize'
    ];

    const newPermissions = new Set<string>();
    const isDelegateValue = this._isDelegate();

    for (const perm of permissionsToCheck) {
      const hasPermission = await this.passwordFlowService.checkPermission(perm);
      if (hasPermission && isDelegateValue) {
        newPermissions.add(perm);
      }
    }

    this._permissions.set(newPermissions);
  }

  goBack(): void {
    const prevUrl = this.navigationService.getPreviousUrl() ?? '';

    if (prevUrl.includes('challenge') || prevUrl === '') {
      this.router.navigate(['/meetings/list']);
    } else {
      this.location.back();
    }
  }
  // اضافه کردن computed signal جدید
  readonly hasChairmanSigned = computed(() => {
    const members = this.members();
    const chairman = members.find(m => MeetingRoles.isChairman(m.roleId));
    return chairman?.isSign === true;
  });

  // تغییر متد hasAccessToTab
  hasAccessToTab(tab: string): boolean {
    const isSuperAdmin = readIsMeetingAdmin();
    const currentMember = this.currentMember();
    const isDelegate = currentMember?.isDelegate;
    const isBoardMeeting = this.isBoardMeeting();
    const statusId = this.statusId();
    const roleId = this.roleId();
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر کاربر رئیس جلسه است و هنوز امضا نکرده
    const isUnsignedChairman = (MeetingRoles.isChairman(roleId) && !hasChairmanSigned);

    const S = MeetingStatus;
    // ادمین مدیریت جلسات بدون عضویت هم همه‌ی تب‌ها را می‌بیند
    const canSeeAsMember = roleId != 0 || isSuperAdmin;
    const accessRules: { [key: string]: () => boolean } = {
      meetingDetails: () => statusId >= S.Draft && statusId <= S.Undetermined,
      adminAttendance: () => isSuperAdmin && MeetingStatuses.isHeldOrLater(statusId),
      agendas: () => MeetingStatuses.is(statusId, S.Registered, S.Held, S.Finalized, S.Completed, S.Undetermined) && canSeeAsMember,
      attendance: () => MeetingStatuses.is(statusId, S.Registered, S.Undetermined) && !isBoardMeeting && canSeeAsMember,
      content: () => (MeetingStatuses.isHeldOrLater(statusId) && canSeeAsMember) || (isBoardMeeting && statusId === S.Registered),
      minutes: () => MeetingStatuses.isHeldOrLater(statusId) && canSeeAsMember && !isBoardMeeting,
      followup: () => (hasChairmanSigned && !isBoardMeeting) || (isBoardMeeting && statusId === S.Completed)
    };

    return accessRules[tab]?.() ?? false;
  }

  // تغییر متد updateButtonConfiguration
  private updateButtonConfiguration(): void {
    const statusId = this.statusId();
    const roleId = this.roleId();
    const isDelegateValue = this._isDelegate();
    const permissions = this._permissions();
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر رئیس جلسه است و هنوز امضا نکرده، همه دکمه‌ها فعال باشند
    const isUnsignedChairman = (MeetingRoles.isChairman(roleId) && !hasChairmanSigned);

    const S = MeetingStatus;
    const isManager = MeetingRoles.isManager(roleId) && !isDelegateValue;
    // مرحله‌ی بعدی هر وضعیت و دسترسی لازم برای آن (هیئت مدیره صورتجلسه ندارد: برگزار شده ← اتمام)
    const next: { text: string; status: number; permission: string } | null =
      statusId === S.Draft ? { text: 'ثبت اولیه', status: S.Registered, permission: 'MT_Meetings_InitialRegister' }
        : statusId === S.Registered || statusId === S.Undetermined ? { text: 'برگزاری جلسه', status: S.Held, permission: 'MT_Meetings_Hold' }
          : statusId === S.Held && this.isBoardMeeting() ? { text: 'اتمام جلسه', status: S.Completed, permission: 'MT_Meetings_Finalize' }
            : statusId === S.Held ? { text: 'ثبت نهایی', status: S.Finalized, permission: 'MT_Meetings_FinalRegister' }
              : statusId === S.Finalized ? { text: 'اتمام جلسه', status: S.Completed, permission: 'MT_Meetings_Finalize' }
                : null;

    if (!next) {
      this._buttonText.set('');
      this._showButton.set(false);
      return;
    }

    this._buttonText.set(next.text);
    this._buttonStatus.set(next.status);
    this._showButton.set(isUnsignedChairman || isManager || (isDelegateValue && permissions.has(next.permission)));
  }

  private hasPermission(permission: string): boolean {
    return this._permissions().has(permission);
  }

  getTabVisibility(tab: string): boolean {
    const currentMember = this.currentMember();
    const isDelegate = !!currentMember?.isDelegate;
    const isSuperAdmin = readIsMeetingAdmin();
    const isBoardMeeting = this.isBoardMeeting();
    const statusId = this.statusId();
    const hasChairmanSigned = this.hasChairmanSigned();

    const S = MeetingStatus;
    const visibilityRules: Record<string, () => boolean> = {
      main: () => statusId >= S.Draft && statusId <= S.Undetermined,
      adminAttendance: () => isSuperAdmin && MeetingStatuses.isHeldOrLater(statusId),
      attendance: () => MeetingStatuses.is(statusId, S.Registered, S.Undetermined),
      agenda: () => !MeetingStatuses.is(statusId, S.Cancelled),
      content: () => MeetingStatuses.isHeldOrLater(statusId) || (isBoardMeeting && statusId === S.Registered),
      minutes: () => MeetingStatuses.isHeldOrLater(statusId) && !isBoardMeeting,
      followup: () => (hasChairmanSigned && !isBoardMeeting) || (isBoardMeeting && statusId === S.Completed)
    };

    return visibilityRules[tab]?.() ?? false;
  }



  changeStatus(status: number): void {
    const meetingGuid = this._meetingGuid();

    // ✅ بررسی برگزاری جلسه (status = 3)
    if (status === MeetingStatus.Held) {
      if (!this.meetingBehaviorService.canHoldMeeting()) {
        const meetingDate = this.meetingBehaviorService.getMeetingDate();
        Swal.fire({
          title: "خطا",
          text: `تاریخ جلسه (${meetingDate}) هنوز فرا نرسیده است. امکان برگزاری جلسه وجود ندارد.`,
          icon: "error",
          confirmButtonText: "باشه",
        });
        return;
      }
    }

    // ✅ بررسی ثبت نهایی جلسه (status = 4)
    if (status === MeetingStatus.Finalized) {
      // بررسی رئیس و دبیر
      const validation = this.meetingBehaviorService.canFinalizeRegistration();
      if (!validation.canFinalize) {
        Swal.fire({
          title: "خطا",
          html: validation.errors.map(e => `• ${e}`).join('<br>'),
          icon: "error",
          confirmButtonText: "باشه",
        });
        return;
      }

      // بررسی‌های قبلی
      this.meetingService.checkMeeting(meetingGuid)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((data) => {
          if (data.existResolution === false) {
            Swal.fire({
              title: "خطا",
              text: "بدون شرح جلسه یا ثبت مصوبه امکان ثبت نهایی جلسه وجود ندارد",
              icon: "error",
              confirmButtonText: "باشه",
            });
            return;
          }
          else if (data.attendance === false) {
            Swal.fire({
              title: "خطا",
              text: 'بدون ثبت حضور وغیاب اعضای جلسه امکان ثبت نهایی جلسه وجود ندارد',
              icon: "error",
              confirmButtonText: "باشه",
            });
            return;
          }
          this.performStatusChange(status);
        });
      return;
    }

    // بررسی اتمام جلسه (status = 6)
    if (status === MeetingStatus.Completed && !this.isBoardMeeting()) {
      this.meetingService.checkSign(meetingGuid)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((data) => {
          if (data === false) {
            Swal.fire({
              title: "خطا",
              text: "اتمام جلسه پس از امضای صورتجلسه توسط رئیس جلسه امکان‌پذیر است.",
              icon: "error",
              confirmButtonText: "باشه",
            });
            return;
          }
          this.performStatusChange(status);
        });
      return;
    }

    this.performStatusChange(status);
  }

  private performStatusChange(status: number): void {
    this.swalService.fireSwal('آیا از انجام عملیات اطمینان دارید؟').then((result: any) => {
      if (result.value === true) {
        const meetingGuid = this._meetingGuid();
        this.meetingService.changeStatus(meetingGuid, status)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              location.reload();
            },
            error: () => {
              this.toastService.error('خطا در تغییر وضعیت جلسه.');
            }
          });
      } else {
        this.swalService.dismissSwal(result);
      }
    });
  }

  getMeetingDetails(): void {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    const isSuperAdmin = readIsMeetingAdmin();
    const meetingGuid = this._meetingGuid();

    if (!meetingGuid) return;

    const resolutions = this.resolutionService.getListBy(meetingGuid);
    const meetingRequest = this.meetingService.getUserMeeting(meetingGuid, userGuid, positionGuid, isSuperAdmin);
    //    const membersRequest = this.memberService.getUserList(meetingGuid, userGuid);

    void this.meetingAccess.load(meetingGuid);
    forkJoin([meetingRequest, resolutions])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([meetingData, resolutions]: [any, any]) => {
        this.meetingBehaviorService.setMeeting(meetingData);

        this._meetingTitle.set(meetingData.title);
        this.breadcrumbService.setItems([
          { label: 'جلسات', routerLink: '/meetings/list' },
          { label: `جلسه ${meetingData.title}`, routerLink: `/meetings/details/${meetingGuid}` },
        ]);
        this.meetingBehaviorService.setBoardMeetingResult(meetingData.categoryGuid === AppSettings.boardCategoryGuid)
        this.meetingBehaviorService.setResolutions(resolutions);
        this.loadMembers(meetingGuid, userGuid);
      });
  }

  private loadMembers(meetingGuid: string, userGuid: string): void {
    this.memberService.getUserList(meetingGuid, userGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (membersData: MeetingMember[]) => {

        // Sort members by role priority
        const rolePriority: { [key: number]: number } = { 3: 1, 1: 2, 2: 3, 4: 4, 5: 5, 6: 6 };
        membersData = membersData.slice().sort((a: MeetingMember, b: MeetingMember) => {
          const aPriority = rolePriority[a.roleId] ?? 99;
          const bPriority = rolePriority[b.roleId] ?? 99;
          return aPriority - bPriority;
        });

        // ✅ پردازش substitute ها
        membersData.forEach(member => {
          if (member.replacementUserGuid) {
            member.substitute = membersData.find(m => m.userGuid === member.replacementUserGuid)?.name || '';
          }
        });

        // ✅ جمع‌آوری همه profileGuid ها برای batch load
        const profileGuidsToLoad: { memberIndex: number; profileGuid: string }[] = [];

        membersData.forEach((member, index) => {
          if (member.profileGuid) {
            profileGuidsToLoad.push({
              memberIndex: index,
              profileGuid: member.profileGuid
            });
          } else {
            const photoUrl = encodeURIComponent(`photo/${member.userName}.jpg`);
            // تصویر پیش‌فرض برای کاربران بدون profileGuid
            member.image = member.userName
              ? `${environment.fileManagementEndpoint}/api/Image?url=${photoUrl}&w=48&q=75`
              : 'img/default-avatar.png';
          }
        });

        // ✅ Batch load تصاویر پروفایل با TUS
        if (profileGuidsToLoad.length > 0) {
          try {
            const guids = profileGuidsToLoad.map(g => g.profileGuid);
            const urlMap = await this.tusUploadService.getFilePreviewUrls(guids);

            // اختصاص URL ها به members
            for (const { memberIndex, profileGuid } of profileGuidsToLoad) {
              const url = urlMap.get(profileGuid.toLowerCase());


              if (url) {
                membersData[memberIndex].image = url;
              } else {
                // Fallback به تصویر پیش‌فرض
                const member = membersData[memberIndex];
                const photoUrl = encodeURIComponent(`photo/${member.userName}.jpg`);
                membersData[memberIndex].image = member.userName
                  ? `${environment.fileManagementEndpoint}/api/Image?url=${photoUrl}&w=48&q=75`
                  : 'img/default-avatar.png';
              }
            }
          } catch (error) {
            console.warn('Error loading profile images:', error);
            // در صورت خطا، از تصاویر پیش‌فرض استفاده کن
            for (const { memberIndex } of profileGuidsToLoad) {
              const member = membersData[memberIndex];
              const photoUrl = encodeURIComponent(`photo/${member.userName}.jpg`);
              membersData[memberIndex].image = member.userName
                ? `${environment.fileManagementEndpoint}/api/Image?url=${photoUrl}&w=48&q=75`
                : 'img/default-avatar.png';
            }
          }
        }

        // ✅ تنظیم members در behavior service
        this.meetingBehaviorService.setMembers(membersData);

        // ✅ تنظیم current member
        const currentMember = membersData.find(m => m.userGuid === userGuid);
        if (currentMember) {
          currentMember.isDelegate = membersData.some(m => m.replacementUserGuid === currentMember.userGuid);
          this.meetingBehaviorService.setCurrentMember(currentMember);
        }

        this._loaded.set(true);
      });
  }
  adminGoBack(): void {
    const prev = this.prevStatus();
    if (!prev) return;

    this.swalService.fireSwal(`آیا از بازگشت به وضعیت قبلی اطمینان دارید؟`).then((result: any) => {
      if (result.value === true) {
        const meetingGuid = this._meetingGuid();
        this.meetingService.changeStatus(meetingGuid, prev)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => location.reload(),
            error: () => this.toastService.error('خطا در تغییر وضعیت جلسه.')
          });
      }
    });
  }
  // در بخش computed signals
  readonly isSuperAdmin = computed(() =>
    readIsMeetingAdmin()
  );

  readonly statusFlow = [1, 2, 3, 4, 6]; // ترتیب وضعیت‌ها

  readonly canGoForward = computed(() => {
    const statusId = this.statusId();
    const idx = this.statusFlow.indexOf(statusId);
    return idx !== -1 && idx < this.statusFlow.length - 1;
  });

  readonly canGoBack = computed(() => {
    const statusId = this.statusId();
    const idx = this.statusFlow.indexOf(statusId);
    return idx > 0;
  });

  readonly nextStatus = computed(() => {
    const idx = this.statusFlow.indexOf(this.statusId());
    return idx !== -1 && idx < this.statusFlow.length - 1
      ? this.statusFlow[idx + 1]
      : null;
  });

  readonly prevStatus = computed(() => {
    const idx = this.statusFlow.indexOf(this.statusId());
    return idx > 0 ? this.statusFlow[idx - 1] : null;
  });
  // Method to update active tab
  setActiveTab(tab: string): void {
    this._activeTab.set(tab);
  }
}
