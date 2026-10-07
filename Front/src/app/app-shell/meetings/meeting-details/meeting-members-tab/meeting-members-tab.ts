import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { forkJoin, of, catchError } from 'rxjs';
import { Modal } from 'bootstrap';

import { AgGridBaseComponent } from '../../../../shared/ag-grid-base/ag-grid-base';
import { MeetingMemberService } from '../../../../services/meeting-member.service';
import { MeetingService } from '../../../../services/meeting.service';
import { UserService } from '../../../../services/user.service';
import { RoleService } from '../../../../services/role.service';
import { FileService } from '../../../../services/file.service';
import { SwalService } from '../../../../services/framework-services/swal.service';
import { BreadcrumbService } from '../../../../services/framework-services/breadcrumb.service';
import { TusUploadService, UploadStatus } from '../../../../services/framework-services/tus-upload.service';
import { getClientSettings } from '../../../../services/framework-services/code-flow.service';
import { environment } from '../../../../../environments/environment';
import { MeetingDetails, MeetingMember } from '../../../../core/models/Meeting';
import { SystemUser, Position } from '../../../../core/models/User';
import { ComboBase } from '../../../../shared/combo-base';
import { generateGuid, POSITION_ID, USER_ID_NAME, Main_USER_ID } from '../../../../core/types/configuration';
import { LabelButtonComponent } from '../../../../shared/custom-buttons/label-button';
import { CustomSelectComponent } from '../../../../shared/custom-controls/custom-select';
import { CustomInputComponent } from '../../../../shared/custom-controls/custom-input';
import { MemberActionsCellComponent } from './member-actions-cell.component';
import { MemberPhotoCellComponent } from './member-photo-cell.component';
import { MemberPresenceCellComponent } from './member-presence-cell.component';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';
import { MeetingStatus } from '../../../../core/meeting-access/meeting-status';

// Cell Renderers

declare var Swal: any;

// ═══════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════

interface MemberListItem {
  id: number;
  guid?: string;
  name: string;
  userGuid?: string;
  boardMemberGuid?: string;
  positionGuid?: string;
  userName?: string;
  position?: string;
  roleId: number;
  role?: string;
  roleColor?: string;
  isExternal: boolean;
  isPresent?: boolean | null;
  isAttendance?: boolean | null;
  isSign: boolean;
  comment?: string;
  email?: string;
  mobile?: string;
  organization?: string;
  gender?: string;
  replacementUserGuid?: string;
  replacementName?: string;
  profileGuid?: string;
  signatureGuid?: string;
  signer?: string;
  signerName?: string;
  signerUserName?: string;
  image?: string;
  isRemoved: boolean;
}

interface MemberFormData {
  userGuid: string;
  positionGuid: string;
  roleId: number;
  persNo?: string;
}

interface GuestFormData {
  guestType: 'internal' | 'external';
  // Internal
  selectedUserGuid?: string;
  selectedPositionGuid?: string;
  // External
  name?: string;
  mobile?: string;
  email?: string;
  organization?: string;
  gender?: 'Male' | 'Female';
  profileGuid?: string;
  signatureGuid?: string;
}

interface SubstituteFormData {
  memberId: number;
  memberName: string;
  replacementUserGuid: string;
  replacementPositionGuid?: string;
  persNo?: string;
}

interface SignatureFormData {
  memberId: number;
  memberName: string;
  comment: string;
  isSign: boolean;
  signatureImage?: string;
}

interface MeetingSummary {
  total: number;
  internal: number;
  external: number;
  present: number;
  absent: number;
  unknown: number;
  signed: number;
  announced: number;
  withSubstitute: number;
}

// ═══════════════════════════════════════════════════════════════
// Role Configuration
// ═══════════════════════════════════════════════════════════════

const ROLES: ComboBase[] = [
  { id: 1, guid: '1', title: 'دبیر', other: '#0d6362' },
  { id: 2, guid: '2', title: 'دبیر غیر عضو', other: '#3edb1f' },
  { id: 3, guid: '3', title: 'رئیس', other: '#5c3028' },
  { id: 4, guid: '4', title: 'ناظر', other: '#835dbb' },
  { id: 5, guid: '5', title: 'عضو عادی', other: '#c27114' },
  { id: 6, guid: '6', title: 'مهمان', other: '#533cc8' },
];

// نقش‌های یکتا (فقط یکی مجاز)

@Component({
  selector: 'app-meeting-members-tab',
  standalone: true,
  imports: [
    CommonModule,
    AgGridAngular,
    ReactiveFormsModule,
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
  private readonly fb = inject(FormBuilder);
  private readonly meetingService = inject(MeetingService);
  private readonly meetingMemberService = inject(MeetingMemberService);
  private readonly userService = inject(UserService);
  private readonly swalService = inject(SwalService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly tusUploadService = inject(TusUploadService);

  // ═══════════════════════════════════════════════════════════════
  // ViewChild
  // ═══════════════════════════════════════════════════════════════
  @ViewChild('addMemberModal') addMemberModalRef!: ElementRef;
  @ViewChild('addGuestModal') addGuestModalRef!: ElementRef;
  @ViewChild('substituteModal') substituteModalRef!: ElementRef;
  @ViewChild('signatureModal') signatureModalRef!: ElementRef;

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
  // Signals - Modals State
  // ═══════════════════════════════════════════════════════════════
  readonly isAddMemberModalOpen = signal<boolean>(false);
  readonly isAddGuestModalOpen = signal<boolean>(false);
  readonly isSubstituteModalOpen = signal<boolean>(false);
  readonly isSignatureModalOpen = signal<boolean>(false);

  // ═══════════════════════════════════════════════════════════════
  // Signals - Guest Upload
  // ═══════════════════════════════════════════════════════════════
  readonly profileFileGuid = signal<string | null>(null);
  readonly signatureFileGuid = signal<string | null>(null);
  readonly profileUploadProgress = signal<number>(0);
  readonly signatureUploadProgress = signal<number>(0);
  readonly isProfileUploading = signal<boolean>(false);
  readonly isSignatureUploading = signal<boolean>(false);
  readonly previewImage = signal<string | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // Signals - Selected Items
  // ═══════════════════════════════════════════════════════════════
  readonly selectedMemberForSubstitute = signal<MemberListItem | null>(null);
  readonly selectedMemberForSignature = signal<MemberListItem | null>(null);
  readonly signatureImage = signal<string>('');

  // ═══════════════════════════════════════════════════════════════
  // Signals - Search
  // ═══════════════════════════════════════════════════════════════
  readonly memberSearchQuery = signal<string>('');
  readonly memberDropdownVisible = signal<boolean>(false);
  readonly guestSearchQuery = signal<string>('');
  readonly guestDropdownVisible = signal<boolean>(false);
  readonly substituteSearchQuery = signal<string>('');
  readonly substituteDropdownVisible = signal<boolean>(false);
  readonly selectedInternalUser = signal<SystemUser | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // Forms
  // ═══════════════════════════════════════════════════════════════
  readonly addMemberForm: FormGroup;
  readonly addGuestForm: FormGroup;
  readonly substituteForm: FormGroup;
  readonly signatureForm: FormGroup;

  // ═══════════════════════════════════════════════════════════════
  // Computed - Statistics
  // ═══════════════════════════════════════════════════════════════
  readonly summary = computed<MeetingSummary>(() => {
    const list = this.members();
    const activeMembers = list.filter(m => !m.isRemoved);

    return {
      total: activeMembers.length,
      internal: activeMembers.filter(m => !m.isExternal).length,
      external: activeMembers.filter(m => m.isExternal).length,
      present: activeMembers.filter(m => m.isPresent === true).length,
      absent: activeMembers.filter(m => m.isPresent === false).length,
      unknown: activeMembers.filter(m => m.isPresent === null || m.isPresent === undefined).length,
      signed: activeMembers.filter(m => m.isSign).length,
      announced: activeMembers.filter(m => m.isAttendance === true).length,
      withSubstitute: activeMembers.filter(m => !!m.replacementUserGuid).length
    };
  });

  readonly hasRecords = computed(() => this.members().filter(m => !m.isRemoved).length > 0);

  // ═══════════════════════════════════════════════════════════════
  // Computed - Filtered Users
  // ═══════════════════════════════════════════════════════════════

  /** کاربران مجاز برای افزودن به عنوان عضو */
  readonly availableUsersForMember = computed(() => {
    const query = this.memberSearchQuery().toLowerCase().trim();
    const isVisible = this.memberDropdownVisible();
    const users = this.allUsers();
    const currentMembers = this.members();

    if (!isVisible || !users.length) return [];

    // userGuid های اعضای فعلی
    const memberUserGuids = new Set(
      currentMembers
        .filter(m => !m.isRemoved && m.userGuid)
        .map(m => m.userGuid!.toLowerCase())
    );

    return users.filter(user => {
      const baseGuid = (user.baseUserGuid || user.guid || '').toLowerCase();
      const isNotMember = !memberUserGuids.has(baseGuid);
      const fullText = `${user.name} ${user.userName || ''} ${user.position || ''}`.toLowerCase();
      const matchesQuery = !query || fullText.includes(query);

      return isNotMember && matchesQuery;
    });
  });

  /** کاربران مجاز برای افزودن به عنوان مهمان داخلی */
  readonly availableUsersForGuest = computed(() => {
    const query = this.guestSearchQuery().toLowerCase().trim();
    const isVisible = this.guestDropdownVisible();
    const users = this.allUsers();
    const currentMembers = this.members();

    if (!isVisible || !users.length) return [];

    const memberUserGuids = new Set(
      currentMembers
        .filter(m => !m.isRemoved && m.userGuid)
        .map(m => m.userGuid!.toLowerCase())
    );

    return users.filter(user => {
      const baseGuid = (user.baseUserGuid || user.guid || '').toLowerCase();
      const isNotMember = !memberUserGuids.has(baseGuid);
      const fullText = `${user.name} ${user.userName || ''} ${user.position || ''}`.toLowerCase();
      const matchesQuery = !query || fullText.includes(query);

      return isNotMember && matchesQuery;
    });
  });

  /** کاربران مجاز برای انتخاب به عنوان جانشین */
  readonly availableUsersForSubstitute = computed(() => {
    const query = this.substituteSearchQuery().toLowerCase().trim();
    const isVisible = this.substituteDropdownVisible();
    const users = this.allUsers();
    const currentMembers = this.members();
    const selectedMember = this.selectedMemberForSubstitute();

    if (!isVisible || !users.length || !selectedMember) return [];

    // کاربرانی که الان جانشین کسی هستند
    const alreadySubstituteGuids = new Set(
      currentMembers
        .filter(m => !m.isRemoved && m.replacementUserGuid)
        .map(m => m.replacementUserGuid!.toLowerCase())
    );

    // خود عضو نباید در لیست باشد
    const selfGuid = (selectedMember.userGuid || '').toLowerCase();

    return users.filter(user => {
      const baseGuid = (user.baseUserGuid || user.guid || '').toLowerCase();
      const isNotSelf = baseGuid !== selfGuid;
      const isNotAlreadySubstitute = !alreadySubstituteGuids.has(baseGuid);
      const fullText = `${user.name} ${user.userName || ''} ${user.position || ''}`.toLowerCase();
      const matchesQuery = !query || fullText.includes(query);

      return isNotSelf && isNotAlreadySubstitute && matchesQuery;
    });
  });

  /** نقش‌های مجاز برای افزودن (بررسی یکتایی) */
  readonly availableRoles = computed(() => {
    const currentMembers = this.members();
    const allRoles = this.roles();

    // نقش‌های یکتای موجود
    const existingUniqueRoles = new Set(
      currentMembers
        .filter(m => !m.isRemoved && MeetingRoles.isUnique(m.roleId))
        .map(m => m.roleId)
    );

    return allRoles.filter(role => {
      // مهمان رو از لیست حذف کن (برای افزودن عضو)
      if (role.id === 6) return false;
      // اگر نقش یکتا هست و قبلاً اضافه شده، نشون نده
      if (MeetingRoles.isUnique(role.id!) && existingUniqueRoles.has(role.id!)) return false;
      return true;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════
  constructor() {
    super();

    // Initialize Forms
    this.addMemberForm = this.fb.group({
      selectedUser: [null, Validators.required],
      roleId: [5, Validators.required]
    });

    this.addGuestForm = this.fb.group({
      guestType: ['external', Validators.required],
      // Internal
      selectedUser: [null],
      // External
      name: [''],
      mobile: [''],
      email: ['', Validators.email],
      organization: [''],
      gender: ['Male']
    });

    this.substituteForm = this.fb.group({
      selectedUser: [null, Validators.required]
    });

    this.signatureForm = this.fb.group({
      comment: [''],
      isSign: [false]
    });

    this.setupBreadcrumb();
    this.setupRouteEffect();
    this.setupGuestFormValidators();
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

  private setupGuestFormValidators(): void {
    this.addGuestForm.get('guestType')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(guestType => {
        const controls = this.addGuestForm.controls;

        // Reset validators
        Object.keys(controls).forEach(key => {
          if (key !== 'guestType') {
            controls[key].clearValidators();
            controls[key].updateValueAndValidity();
          }
        });

        if (guestType === 'external') {
          controls['name'].setValidators([Validators.required, Validators.minLength(2)]);
          controls['mobile'].setValidators([Validators.required, Validators.pattern(/^09\d{9}$/)]);
          controls['organization'].setValidators([Validators.required]);
        } else {
          controls['selectedUser'].setValidators([Validators.required]);
        }

        Object.keys(controls).forEach(key => controls[key].updateValueAndValidity());
      });
  }

  // ═══════════════════════════════════════════════════════════════
  // Grid Setup
  // ═══════════════════════════════════════════════════════════════

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.columnDefs = [
      {
        field: 'actions',
        headerName: 'عملیات',
        filter: false,
        sortable: false,
        width: 180,
        minWidth: 180,
        maxWidth: 200,
        pinned: 'right',
        cellRenderer: MemberActionsCellComponent,
        cellRendererParams: {
          onDelete: (member: MemberListItem) => this.askForDelete(member),
          onSubstitute: (member: MemberListItem) => this.openSubstituteModal(member),
          onSign: (member: MemberListItem) => this.openSignatureModal(member),
          canSign: (member: MemberListItem) => this.isOwnRow(member),
          onRemoveSubstitute: (member: MemberListItem) => this.removeSubstitute(member)
        },
        cellStyle: { textAlign: 'center', overflow: 'visible' }
      },
      {
        field: 'image',
        headerName: '',
        filter: false,
        sortable: false,
        width: 60,
        minWidth: 60,
        maxWidth: 60,
        cellRenderer: MemberPhotoCellComponent,
        cellStyle: { padding: '4px' }
      },
      {
        field: 'name',
        headerName: 'نام',
        filter: 'agTextColumnFilter',
        minWidth: 150,
        flex: 1,
        cellRenderer: (params: any) => this.nameCellRenderer(params),
        cellStyle: { fontFamily: 'Sahel' }
      },
      {
        field: 'role',
        headerName: 'نقش',
        filter: 'agSetColumnFilter',
        width: 120,
        cellRenderer: (params: any) => this.roleCellRenderer(params),
        cellStyle: { textAlign: 'center' }
      },
      // {
      //   field: 'position',
      //   headerName: 'سمت',
      //   filter: 'agTextColumnFilter',
      //   minWidth: 150,
      //   flex: 1,
      //   cellStyle: { fontFamily: 'Sahel' }
      // },
      {
        field: 'isAttendance',
        headerName: 'اعلام حضور',
        filter: 'agSetColumnFilter',
        width: 120,
        cellRenderer: (params: any) => this.attendanceCellRenderer(params),
        cellStyle: { textAlign: 'center' }
      },
      {
        field: 'isPresent',
        headerName: 'حضور',
        filter: 'agSetColumnFilter',
        width: 140,
        cellRenderer: MemberPresenceCellComponent,
        cellRendererParams: {
          onPresenceChange: (member: MemberListItem, isPresent: boolean) =>
            this.togglePresence(member, isPresent)
        },
        cellStyle: { textAlign: 'center', overflow: 'visible' }
      },
      {
        field: 'isSign',
        headerName: 'امضا',
        filter: 'agSetColumnFilter',
        width: 80,
        cellRenderer: (params: any) => this.signCellRenderer(params),
        cellStyle: { textAlign: 'center' }
      },
      {
        field: 'replacementName',
        headerName: 'جانشین',
        filter: 'agTextColumnFilter',
        width: 150,
        cellStyle: { fontFamily: 'Sahel' },
        valueGetter: (params: any) => params.data?.replacementName || '-'
      },
      {
        field: 'comment',
        headerName: 'نظر',
        filter: 'agTextColumnFilter',
        minWidth: 200,
        flex: 1,
        cellStyle: { fontFamily: 'Sahel' }
      }
    ];

    options.rowClassRules = {
      'member-row-external': (params: any) => params.data?.isExternal,
      'member-row-signed': (params: any) => params.data?.isSign,
      'member-row-absent': (params: any) => params.data?.isPresent === false,
      'member-row-has-substitute': (params: any) => !!params.data?.replacementUserGuid
    };

    options.pagination = true;
    options.paginationPageSize = 20;
    options.getRowId = (params: any) => params.data.id.toString();
  }

  // ═══════════════════════════════════════════════════════════════
  // Cell Renderers
  // ═══════════════════════════════════════════════════════════════

  private nameCellRenderer(params: any): string {
    const data = params.data;
    if (!data) return '';

    let html = `<div class="member-name-cell">`;
    html += `<span class="member-name">${data.name}</span>`;

    if (data.isExternal) {
      html += `<span class="badge bg-info ms-2">مهمان</span>`;
    }

    if (data.replacementUserGuid) {
      html += `<i class="fas fa-user-friends ms-2 text-warning" title="دارای جانشین"></i>`;
    }

    html += `</div>`;
    return html;
  }

  private roleCellRenderer(params: any): string {
    const data = params.data;
    if (!data) return '';

    const color = data.roleColor || '#6c757d';
    return `<span class="role-badge" style="color: ${color};">${data.role || ''}</span>`;
  }

  private attendanceCellRenderer(params: any): string {
    const value = params.value;
    if (value === true) {
      return `<i class="fas fa-check-circle text-success fs-5" title="اعلام حضور کرده"></i>`;
    } else if (value === false) {
      return `<i class="fas fa-times-circle text-danger fs-5" title="اعلام عدم حضور کرده"></i>`;
    }
    return `<i class="fas fa-question-circle text-muted fs-5" title="اعلام نکرده"></i>`;
  }

  private signCellRenderer(params: any): string {
    const value = params.value;
    if (value === true) {
      return `<i class="fas fa-signature text-success fs-5" title="امضا کرده"></i>`;
    }
    return `<i class="fas fa-signature text-muted fs-5" title="امضا نکرده"></i>`;
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
        const processed = this.processMembers(members);
        this.members.set(processed);
        this.loading.set(false);
      });
  }

  private processMembers(members: MemberListItem[]): MemberListItem[] {
    return members.map(member => {
      // Set image
      if (member.profileGuid) {
        // Will be loaded async
        this.loadMemberImage(member);
      } else if (member.userName) {
        member.image = `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${member.userName}.jpg`)}&w=48&q=75`;
      } else {
        member.image = 'img/default-avatar.png';
      }

      // Find substitute name
      if (member.replacementUserGuid) {
        const substitute = members.find(m => m.userGuid === member.replacementUserGuid);
        member.replacementName = substitute?.name || '';
      }

      return member;
    });
  }

  private async loadMemberImage(member: MemberListItem): Promise<void> {
    if (!member.profileGuid) return;

    try {
      const url = await this.tusUploadService.getFilePreviewUrl(member.profileGuid);
      if (url) {
        const currentMembers = this.members();
        const index = currentMembers.findIndex(m => m.id === member.id);
        if (index !== -1) {
          const updated = [...currentMembers];
          updated[index] = { ...updated[index], image: url };
          this.members.set(updated);
        }
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
        const processed = this.processUsersForMultiPosition(users);
        this.allUsers.set(processed);
      });
  }

  private processUsersForMultiPosition(users: SystemUser[]): SystemUser[] {
    return users.flatMap(user => {
      if (user.positions && user.positions.length > 0) {
        return user.positions.map((position: Position) => ({
          ...user,
          guid: `${user.guid}_${position.positionGuid}`,
          baseUserGuid: user.guid,
          positionGuid: position.positionGuid,
          position: position.positionTitle,
          image: user.userName
            ? `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${user.userName}.jpg`)}&w=48&q=75`
            : 'img/default-avatar.png'
        }));
      }

      return [{
        ...user,
        baseUserGuid: user.guid,
        positionGuid: '',
        position: 'بدون سمت',
        image: user.userName
          ? `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${user.userName}.jpg`)}&w=48&q=75`
          : 'img/default-avatar.png'
      }];
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Add Member
  // ═══════════════════════════════════════════════════════════════

  openAddMemberModal(): void {
    this.addMemberForm.reset({ roleId: MeetingRoles.member });
    this.memberSearchQuery.set('');
    this.memberDropdownVisible.set(false);
    this.showModal(this.addMemberModalRef);
  }

  onMemberSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.memberSearchQuery.set(input.value);
    this.memberDropdownVisible.set(true);
  }

  selectMemberUser(user: SystemUser): void {
    this.addMemberForm.patchValue({ selectedUser: user });
    this.memberDropdownVisible.set(false);
  }

  async saveMember(): Promise<void> {
    if (this.addMemberForm.invalid) {
      this.markFormTouched(this.addMemberForm);
      return;
    }

    const formValue = this.addMemberForm.value;
    const selectedUser: SystemUser = formValue.selectedUser;

    const body = {
      meetingGuid: this.meetingGuid(),
      userGuid: selectedUser.baseUserGuid || selectedUser.guid,
      positionGuid: selectedUser.positionGuid,
      roleId: formValue.roleId,
      isExternal: false,
      persNo: (selectedUser as any).persNo || null
    };

    this.meetingMemberService.createMember(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.hideModal(this.addMemberModalRef);
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
    this.addGuestForm.reset({ guestType: 'external', gender: 'Male' });
    this.guestSearchQuery.set('');
    this.guestDropdownVisible.set(false);
    this.selectedInternalUser.set(null);
    this.profileFileGuid.set(null);
    this.signatureFileGuid.set(null);
    this.previewImage.set(null);
    this.showModal(this.addGuestModalRef);
  }

  onGuestTypeChange(guestType: string): void {
    // Reset related fields
    this.addGuestForm.patchValue({
      name: '',
      mobile: '',
      email: '',
      organization: '',
      selectedUser: null
    });
    this.selectedInternalUser.set(null);
    this.guestSearchQuery.set('');
    this.profileFileGuid.set(null);
    this.signatureFileGuid.set(null);
    this.previewImage.set(null);
  }

  onGuestSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.guestSearchQuery.set(input.value);
    this.guestDropdownVisible.set(true);
  }

  selectGuestUser(user: SystemUser): void {
    this.selectedInternalUser.set(user);
    this.addGuestForm.patchValue({ selectedUser: user });
    this.guestDropdownVisible.set(false);
  }

  async onGuestFileSelected(event: Event, fileType: 'profile' | 'signature'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validation
    if (!file.type.startsWith('image/')) {
      this.toastService.error('لطفاً فقط فایل تصویری انتخاب کنید');
      input.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.toastService.error('حجم فایل نباید از 2 مگابایت بیشتر باشد');
      input.value = '';
      return;
    }

    if (fileType === 'profile') {
      this.isProfileUploading.set(true);
      this.profileUploadProgress.set(0);
    } else {
      this.isSignatureUploading.set(true);
      this.signatureUploadProgress.set(0);
    }

    try {
      const added = this.tusUploadService.addFiles([file], {
        maxSizeMB: 2,
        acceptedTypes: ['image/*'],
        localPreview: true
      });

      if (added.length === 0) throw new Error('فایل اضافه نشد');

      const fileItem = added[0];

      if (fileType === 'profile' && fileItem.previewUrl) {
        this.previewImage.set(fileItem.previewUrl);
      }

      const guid = await this.tusUploadService.uploadFile(fileItem.id, {
        folderPath: 'Meeting{{Folder}}Guests{{Folder}}Temp',
        description: fileType === 'profile' ? 'تصویر پروفایل مهمان' : 'تصویر امضای مهمان'
      });

      if (guid) {
        if (fileType === 'profile') {
          this.profileFileGuid.set(guid);
          this.profileUploadProgress.set(100);
        } else {
          this.signatureFileGuid.set(guid);
          this.signatureUploadProgress.set(100);
        }
      }

    } catch (error: any) {
      console.error(`Error uploading ${fileType}:`, error);
      this.toastService.error(`خطا در آپلود فایل: ${error?.message || 'خطای نامشخص'}`);

      if (fileType === 'profile') {
        this.profileFileGuid.set(null);
        this.previewImage.set(null);
      } else {
        this.signatureFileGuid.set(null);
      }
    } finally {
      if (fileType === 'profile') {
        this.isProfileUploading.set(false);
      } else {
        this.isSignatureUploading.set(false);
      }
      input.value = '';
    }
  }

  async removeGuestFile(fileType: 'profile' | 'signature'): Promise<void> {
    const guid = fileType === 'profile' ? this.profileFileGuid() : this.signatureFileGuid();

    if (guid) {
      try {
        await this.tusUploadService.deleteAttachment(guid);
      } catch (e) {
        console.warn('Failed to delete file:', e);
      }
    }

    if (fileType === 'profile') {
      this.profileFileGuid.set(null);
      this.previewImage.set(null);
    } else {
      this.signatureFileGuid.set(null);
    }
  }

  async saveGuest(): Promise<void> {
    if (this.addGuestForm.invalid) {
      this.markFormTouched(this.addGuestForm);
      return;
    }

    if (this.isProfileUploading() || this.isSignatureUploading()) {
      this.toastService.warning('لطفاً صبر کنید تا آپلود فایل‌ها تمام شود');
      return;
    }

    const formValue = this.addGuestForm.value;
    const guestType = formValue.guestType;

    let body: any = {
      meetingGuid: this.meetingGuid(),
      roleId: MeetingRoles.guest, // مهمان
      isExternal: guestType === 'external'
    };

    if (guestType === 'internal') {
      const user = this.selectedInternalUser();
      if (!user) return;

      body.userGuid = user.baseUserGuid || user.guid;
      body.positionGuid = user.positionGuid;
      body.name = user.name;
      body.persNo = (user as any).persNo;
    } else {
      body.name = formValue.name;
      body.mobile = formValue.mobile;
      body.email = formValue.email;
      body.organization = formValue.organization;
      body.gender = formValue.gender;
      body.profileGuid = this.profileFileGuid();
      body.signatureGuid = this.signatureFileGuid();
    }

    this.meetingMemberService.createOrEdit(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.hideModal(this.addGuestModalRef);
          this.loadMembers();
        },
        error: (error) => {
          console.error('Error adding guest:', error);
          this.toastService.error('خطا در افزودن مهمان');
        }
      });
  }

  async cancelGuestModal(): Promise<void> {
    // Delete uploaded files
    const guidsToDelete = [this.profileFileGuid(), this.signatureFileGuid()].filter(Boolean) as string[];

    if (guidsToDelete.length > 0) {
      try {
        await this.tusUploadService.deleteAttachments(guidsToDelete);
      } catch (e) {
        console.warn('Failed to delete uploaded files:', e);
      }
    }

    this.hideModal(this.addGuestModalRef);
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

    this.selectedMemberForSubstitute.set(member);
    this.substituteForm.reset();
    this.substituteSearchQuery.set('');
    this.substituteDropdownVisible.set(false);
    this.showModal(this.substituteModalRef);
  }

  onSubstituteSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.substituteSearchQuery.set(input.value);
    this.substituteDropdownVisible.set(true);
  }

  selectSubstituteUser(user: SystemUser): void {
    this.substituteForm.patchValue({ selectedUser: user });
    this.substituteDropdownVisible.set(false);
  }

  async saveSubstitute(): Promise<void> {
    if (this.substituteForm.invalid) {
      this.markFormTouched(this.substituteForm);
      return;
    }

    const member = this.selectedMemberForSubstitute();
    if (!member) return;

    const selectedUser: SystemUser = this.substituteForm.value.selectedUser;

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
          this.hideModal(this.substituteModalRef);
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
          const currentMembers = this.members();
          const index = currentMembers.findIndex(m => m.id === member.id);
          if (index !== -1) {
            const updated = [...currentMembers];
            updated[index] = { ...updated[index], isPresent };
            this.members.set(updated);
          }
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
    const chairmanSigned = this.members().some(m => MeetingRoles.isChairman(m.roleId) && m.isSign);
    if (!member.isSign && !MeetingRoles.isChairman(member.roleId) && !chairmanSigned) {
      this.toastService.warning('ابتدا رئیس جلسه باید صورتجلسه را امضا کند.');
    }
    if (member.isSign && MeetingRoles.isChairman(member.roleId)) {
      this.toastService.info('امضای رئیس جلسه قطعی است؛ فقط نظر قابل ویرایش است.');
    }

    this.selectedMemberForSignature.set(member);
    this.signatureForm.patchValue({
      comment: member.comment || '',
      isSign: member.isSign
    });

    // Load signature image
    if (member.userName) {
      this.signatureImage.set(
        `${environment.fileManagementEndpoint}/EpcSignature/${member.userName}.jpg`
      );
    }

    this.showModal(this.signatureModalRef);
  }

  toggleSign(): void {
    const member = this.selectedMemberForSignature();
    if (!member) return;
    const current = this.signatureForm.get('isSign')?.value;
    const isChairman = MeetingRoles.isChairman(member.roleId);
    const chairmanSigned = this.members().some(m => MeetingRoles.isChairman(m.roleId) && m.isSign);
    if (current && isChairman && member.isSign) return;          // امضای رئیس قطعی است
    if (!current && !isChairman && !chairmanSigned) return;      // پیش از امضای رئیس

    this.signatureForm.patchValue({ isSign: !current });
  }

  async saveSignature(): Promise<void> {
    const member = this.selectedMemberForSignature();
    if (!member) return;

    const formValue = this.signatureForm.value;
    const signerGuid = this.localStorageService.getItem(Main_USER_ID);

    const body = {
      memberId: member.id,
      isSign: formValue.isSign,
      comment: formValue.comment,
      signer: signerGuid
    };

    this.meetingMemberService.setComment(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.hideModal(this.signatureModalRef);

          // Update local state
          const currentMembers = this.members();
          const index = currentMembers.findIndex(m => m.id === member.id);
          if (index !== -1) {
            const updated = [...currentMembers];
            updated[index] = {
              ...updated[index],
              isSign: formValue.isSign,
              comment: formValue.comment
            };
            this.members.set(updated);
          }
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
  // Modal Helpers
  // ═══════════════════════════════════════════════════════════════

  private showModal(modalRef: ElementRef): void {
    if (modalRef?.nativeElement) {
      const modal = new Modal(modalRef.nativeElement);
      modal.show();
    }
  }

  private hideModal(modalRef: ElementRef): void {
    if (modalRef?.nativeElement) {
      const modal = Modal.getInstance(modalRef.nativeElement);
      modal?.hide();
    }
  }

  private markFormTouched(form: FormGroup): void {
    Object.keys(form.controls).forEach(key => {
      form.get(key)?.markAsTouched();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Navigation
  // ═══════════════════════════════════════════════════════════════

  goBack(): void {
    this.router.navigate(['/meetings/details', this.meetingGuid()]);
  }

  // ═══════════════════════════════════════════════════════════════
  // Dropdown Helpers
  // ═══════════════════════════════════════════════════════════════

  showMemberDropdown(): void { this.memberDropdownVisible.set(true); }
  hideMemberDropdown(): void { setTimeout(() => this.memberDropdownVisible.set(false), 200); }

  showGuestDropdown(): void { this.guestDropdownVisible.set(true); }
  hideGuestDropdown(): void { setTimeout(() => this.guestDropdownVisible.set(false), 200); }

  showSubstituteDropdown(): void { this.substituteDropdownVisible.set(true); }
  hideSubstituteDropdown(): void { setTimeout(() => this.substituteDropdownVisible.set(false), 200); }
}
