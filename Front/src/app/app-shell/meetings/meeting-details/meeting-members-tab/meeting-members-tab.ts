import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  ViewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { of, catchError } from 'rxjs';

import { AgGridBaseComponent } from '../../../../shared/ag-grid-base/ag-grid-base';
import { MeetingMemberService } from '../../../../services/meeting-member.service';
import { MeetingService } from '../../../../services/meeting.service';
import { UserService } from '../../../../services/user.service';
import { SwalService } from '../../../../services/framework-services/swal.service';
import { BreadcrumbService } from '../../../../services/framework-services/breadcrumb.service';
import { TusUploadService } from '../../../../services/framework-services/tus-upload.service';
import { getClientSettings } from '../../../../services/framework-services/code-flow.service';
import { MeetingDetails } from '../../../../core/models/Meeting';
import { SystemUser } from '../../../../core/models/User';
import { ComboBase } from '../../../../shared/combo-base';
import { POSITION_ID, USER_ID_NAME, Main_USER_ID } from '../../../../core/types/configuration';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';
import { MeetingStatus } from '../../../../core/meeting-access/meeting-status';

import {
  AddGuestSaveEvent,
  AddMemberSaveEvent,
  MeetingSummary,
  MemberListItem,
  ROLES,
  SignatureSaveEvent,
  SubstituteSaveEvent
} from './meeting-members.models';
import {
  computeMeetingSummary,
  isChairmanSigned,
  patchMember,
  processMembers,
  processUsersForMultiPosition
} from './meeting-members.helpers';
import { configureMembersGrid } from './meeting-members-grid';
import { MemberStatsBarComponent } from './member-stats-bar.component';
import { AddMemberModalComponent } from './add-member-modal.component';
import { AddGuestModalComponent } from './add-guest-modal.component';
import { SubstituteModalComponent } from './substitute-modal.component';
import { SignatureModalComponent } from './signature-modal.component';

@Component({
  selector: 'app-meeting-members-tab',
  standalone: true,
  imports: [
    CommonModule,
    AgGridAngular,
    MemberStatsBarComponent,
    AddMemberModalComponent,
    AddGuestModalComponent,
    SubstituteModalComponent,
    SignatureModalComponent,
  ],
  templateUrl: './meeting-members-tab.html',
  styleUrls: ['./meeting-members-tab.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingMembersTabComponent extends AgGridBaseComponent implements OnInit {

  // ═══════════════════════════════════════════════════════════════
  // Injected Services
  // ═══════════════════════════════════════════════════════════════
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly meetingService = inject(MeetingService);
  private readonly meetingMemberService = inject(MeetingMemberService);
  private readonly userService = inject(UserService);
  private readonly swalService = inject(SwalService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly tusUploadService = inject(TusUploadService);

  // ═══════════════════════════════════════════════════════════════
  // ViewChild - Modals (child components expose open()/hide())
  // ═══════════════════════════════════════════════════════════════
  @ViewChild(AddMemberModalComponent) addMemberModal!: AddMemberModalComponent;
  @ViewChild(AddGuestModalComponent) addGuestModal!: AddGuestModalComponent;
  @ViewChild(SubstituteModalComponent) substituteModal!: SubstituteModalComponent;
  @ViewChild(SignatureModalComponent) signatureModal!: SignatureModalComponent;

  // ═══════════════════════════════════════════════════════════════
  // Signals - Data
  // ═══════════════════════════════════════════════════════════════
  readonly meetingGuid = signal<string>('');
  readonly meeting = signal<MeetingDetails | null>(null);
  readonly members = signal<MemberListItem[]>([]);
  readonly roles = signal<ComboBase[]>(ROLES);
  readonly allUsers = signal<SystemUser[]>([]);
  readonly loading = signal<boolean>(false);

  // ═══════════════════════════════════════════════════════════════
  // Computed
  // ═══════════════════════════════════════════════════════════════
  readonly summary = computed<MeetingSummary>(() => computeMeetingSummary(this.members()));

  readonly hasRecords = computed(() => this.members().filter(m => !m.isRemoved).length > 0);

  /** آیا رئیس جلسه امضا کرده است (قانون: ابتدا رئیس امضا می‌کند) */
  readonly chairmanSigned = computed(() => isChairmanSigned(this.members()));

  // ═══════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════
  constructor() {
    super();
    this.setupBreadcrumb();
    this.setupRouteEffect();
  }

  // ═══════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════
  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    this.setupGridColumns();
    await this.loadUsers();
  }

  // ═══════════════════════════════════════════════════════════════
  // Setup Methods
  // ═══════════════════════════════════════════════════════════════

  private setupBreadcrumb(): void {
    // به‌عنوان تب صفحه‌ی جزئیات جلسه، مسیر صفحه را تغییر نمی‌دهد
    if (this.router.url.includes('/meetings/details/')) return;
    this.breadcrumbService.setItems([
      { label: 'جلسات', routerLink: '/meetings/list' },
      { label: 'مدیریت اعضا',routerLink: '' }
    ]);
  }

  private setupRouteEffect(): void {
    effect(() => {
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(params => {
          const guid = params.get('guid');
          if (guid) {
            this.meetingGuid.set(guid);
            this.loadMeetingData();
          }
        });
    });
  }

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    configureMembersGrid(options, {
      onDelete: member => this.askForDelete(member),
      onSubstitute: member => this.openSubstituteModal(member),
      onSign: member => this.openSignatureModal(member),
      canSign: member => this.isOwnRow(member),
      onRemoveSubstitute: member => this.removeSubstitute(member),
      onPresenceChange: (member, isPresent) => this.togglePresence(member, isPresent)
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Data Loading
  // ═══════════════════════════════════════════════════════════════

  private async loadMeetingData(): Promise<void> {
    const guid = this.meetingGuid();
    if (!guid) return;

    this.loading.set(true);

    try {
      // Load meeting details
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      const positionGuid = this.localStorageService.getItem(POSITION_ID);

      this.meetingService.getUserMeeting<MeetingDetails>(guid, userGuid, positionGuid, true)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(error => {
            console.error('Error loading meeting:', error);
            this.toastService.error('خطا در بارگذاری اطلاعات جلسه');
            return of(null);
          })
        )
        .subscribe(meeting => {
          if (meeting) {
            this.meeting.set(meeting);
            this.loadMembers();
          }
        });

    } catch (error) {
      console.error('Error in loadMeetingData:', error);
      this.loading.set(false);
    }
  }

  private loadMembers(): void {
    const guid = this.meetingGuid();
    const positionGuid = this.localStorageService.getItem(POSITION_ID);

    if (!guid) return;

    this.meetingMemberService.getUserList(guid, positionGuid)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error loading members:', error);
          this.toastService.error('خطا در بارگذاری لیست اعضا');
          return of([]);
        })
      )
      .subscribe((members: any[]) => {
        // Process members - add images and substitute names
        const processed = processMembers(members, member => this.loadMemberImage(member));
        this.members.set(processed);
        this.loading.set(false);
      });
  }

  private async loadMemberImage(member: MemberListItem): Promise<void> {
    if (!member.profileGuid) return;

    try {
      const url = await this.tusUploadService.getFilePreviewUrl(member.profileGuid);
      if (url) {
        const updated = patchMember(this.members(), member.id, { image: url });
        if (updated) this.members.set(updated);
      }
    } catch (error) {
      console.warn('Error loading member image:', error);
    }
  }

  private async loadUsers(): Promise<void> {
    const clientId = getClientSettings().client_id ?? '';

    this.userService.getAllByClientId<SystemUser[]>(clientId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error loading users:', error);
          return of([]);
        })
      )
      .subscribe((users: SystemUser[]) => {
        const processed = processUsersForMultiPosition(users);
        this.allUsers.set(processed);
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // Add Member
  // ═══════════════════════════════════════════════════════════════

  openAddMemberModal(): void {
    this.addMemberModal?.open();
  }

  saveMember(event: AddMemberSaveEvent): void {
    const selectedUser = event.selectedUser;

    const body = {
      meetingGuid: this.meetingGuid(),
      userGuid: selectedUser.baseUserGuid || selectedUser.guid,
      positionGuid: selectedUser.positionGuid,
      roleId: event.roleId,
      isExternal: false,
      persNo: (selectedUser as any).persNo || null
    };

    this.meetingMemberService.createMember(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.addMemberModal?.hide();
          this.loadMembers();
        },
        error: (error) => {
          console.error('Error adding member:', error);
          this.toastService.error('خطا در افزودن عضو');
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // Add Guest
  // ═══════════════════════════════════════════════════════════════

  openAddGuestModal(): void {
    this.addGuestModal?.open();
  }

  saveGuest(event: AddGuestSaveEvent): void {
    const body: any = {
      meetingGuid: this.meetingGuid(),
      ...event
    };

    this.meetingMemberService.createOrEdit(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.addGuestModal?.hide();
          this.loadMembers();
        },
        error: (error) => {
          console.error('Error adding guest:', error);
          this.toastService.error('خطا در افزودن مهمان');
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // Substitute Management
  // ═══════════════════════════════════════════════════════════════

  openSubstituteModal(member: MemberListItem): void {
    // مهمان جانشین ندارد
    if (MeetingRoles.isGuest(member.roleId)) {
      this.toastService.warning('مهمان نمی‌تواند جانشین داشته باشد');
      return;
    }

    this.substituteModal?.open(member);
  }

  saveSubstitute(event: SubstituteSaveEvent): void {
    const { member, selectedUser } = event;

    const body = {
      id: member.id,
      userGuid: member.userGuid,
      isAttendance: member.isAttendance ?? false,
      replacementUserGuid: selectedUser.baseUserGuid || selectedUser.guid,
      replacementPositionGuid: selectedUser.positionGuid,
      persNo: (selectedUser as any).persNo || null
    };

    this.meetingMemberService.setSubstitute(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.substituteModal?.hide();
          this.loadMembers();
        },
        error: (error) => {
          console.error('Error setting substitute:', error);
          this.toastService.error('خطا در ثبت جانشین');
        }
      });
  }

  async removeSubstitute(member: MemberListItem): Promise<void> {
    const result = await this.swalService.fireSwal('آیا از حذف جانشین این عضو اطمینان دارید؟');

    if (result.value !== true) return;

    const body = {
      id: member.id,
      userGuid: member.userGuid,
      isAttendance: member.isAttendance ?? false,
      replacementUserGuid: null,
      replacementPositionGuid: null,
      persNo: null
    };

    this.meetingMemberService.setSubstitute(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadMembers();
        },
        error: (error) => {
          console.error('Error removing substitute:', error);
          this.toastService.error('خطا در حذف جانشین');
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // Presence Management
  // ═══════════════════════════════════════════════════════════════

  togglePresence(member: MemberListItem, isPresent: boolean): void {
    const body = {
      id: member.id,
      userGuid: member.userGuid,
      isPresent
    };

    this.meetingMemberService.attendance(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Update local state
          const updated = patchMember(this.members(), member.id, { isPresent });
          if (updated) this.members.set(updated);
        },
        error: (error) => {
          console.error('Error updating presence:', error);
          this.toastService.error('خطا در ثبت حضور');
        }
      });
  }

  async setGroupAttendance(isPresent: boolean): Promise<void> {
    const body = {
      meetingGuid: this.meetingGuid(),
      isPresent
    };

    this.meetingMemberService.setGroupAttendance(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadMembers();
        },
        error: (error) => {
          console.error('Error setting group attendance:', error);
          this.toastService.error('خطا در ثبت حضور گروهی');
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // Signature Management
  // ═══════════════════════════════════════════════════════════════

  /** هر عضو فقط صورتجلسه را به نام خودش امضا می‌کند (سرور هم همین را کنترل می‌کند) */
  isOwnRow(member: MemberListItem): boolean {
    const userGuid = (this.localStorageService.getItem(USER_ID_NAME) || '').toLowerCase();
    return !!userGuid && (member.userGuid || '').toLowerCase() === userGuid;
  }

  openSignatureModal(member: MemberListItem): void {
    // مهمان امضا ندارد
    if (member.isExternal) {
      this.toastService.warning('مهمان امکان امضا ندارد');
      return;
    }
    if (!this.isOwnRow(member)) {
      this.toastService.warning('هر عضو فقط می‌تواند صورتجلسه را به نام خودش امضا کند.');
      return;
    }
    if (this.meeting()?.statusId !== MeetingStatus.Finalized) {
      this.toastService.warning('نظر و امضا فقط پس از ثبت نهایی جلسه امکان‌پذیر است.');
      return;
    }
    const chairmanSigned = this.chairmanSigned();
    if (!member.isSign && !MeetingRoles.isChairman(member.roleId) && !chairmanSigned) {
      this.toastService.warning('ابتدا رئیس جلسه باید صورتجلسه را امضا کند.');
    }
    if (member.isSign && MeetingRoles.isChairman(member.roleId)) {
      this.toastService.info('امضای رئیس جلسه قطعی است؛ فقط نظر قابل ویرایش است.');
    }

    // toggleSign (قوانین تغییر امضا) در SignatureModalComponent است
    this.signatureModal?.open(member);
  }

  saveSignature(event: SignatureSaveEvent): void {
    const { member, isSign, comment } = event;
    const signerGuid = this.localStorageService.getItem(Main_USER_ID);

    const body = {
      memberId: member.id,
      isSign,
      comment,
      signer: signerGuid
    };

    this.meetingMemberService.setComment(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.signatureModal?.hide();

          // Update local state
          const updated = patchMember(this.members(), member.id, { isSign, comment });
          if (updated) this.members.set(updated);
        },
        error: (error) => {
          console.error('Error saving signature:', error);
          this.toastService.error('خطا در ثبت نظر و امضا');
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // Delete Member
  // ═══════════════════════════════════════════════════════════════

  async askForDelete(member: MemberListItem): Promise<void> {
    const result = await this.swalService.fireSwal(
      `آیا از حذف "${member.name}" از جلسه اطمینان دارید؟`
    );

    if (result.value !== true) return;

    this.meetingMemberService.delete(member.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadMembers();
        },
        error: (error) => {
          console.error('Error deleting member:', error);
          this.toastService.error('خطا در حذف عضو');
        }
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // Navigation
  // ═══════════════════════════════════════════════════════════════

  goBack(): void {
    this.router.navigate(['/meetings/details', this.meetingGuid()]);
  }
}
