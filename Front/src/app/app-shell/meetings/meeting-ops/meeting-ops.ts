import { PasswordFlowService } from './../../../services/framework-services/password-flow.service';
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
  untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormGroup,
  FormArray,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
  ReactiveFormsModule,
  FormsModule
} from '@angular/forms';
import { map, debounceTime, distinctUntilChanged, Subject, merge } from 'rxjs';
import { CommonModule, NgClass } from '@angular/common';

import { AgendaItem, MeetingMember } from '../../../core/models/Meeting';
import { Position, SystemUser } from '../../../core/models/User';
import { BoardMember } from '../../../core/models/BoardMember';
import { ComboBase } from '../../../shared/combo-base';
import { ConflictResult, RoomConflictMeeting, SuggestedSlot } from '../../../core/types/conflict-result';
import { CreatType } from '../../../core/types/enums';

import { CategoryService } from '../../../services/category.service';
import { FileService } from '../../../services/file.service';
import { MeetingService } from '../../../services/meeting.service';
import { RoomService } from '../../../services/room.service';
import { UserService } from '../../../services/user.service';
import { BoardMemberService } from '../../../services/board-member.service';
import { MeetingMemberService } from '../../../services/meeting-member.service';
import { CategoryPermissionService } from '../../../services/category-permission.service';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { SwalService } from '../../../services/framework-services/swal.service';
import { ToastService } from '../../../services/framework-services/toast.service';

import { CustomSelectComponent } from "../../../shared/custom-controls/custom-select";
import { CustomInputComponent } from '../../../shared/custom-controls/custom-input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MeetingBehaviorService } from '../meeting-details/meeting-behavior-service';
import { MeetingParticipantsComponent } from './meeting-participants/meeting-participants';
import { AgendaFileDto, MeetingAgendasComponent } from './meeting-agendas/meeting-agendas';

import {
  base64ToArrayBuffer,
  generateGuid,
  POSITION_ID,
  USER_ID_NAME
} from '../../../core/types/configuration';
import { getClientSettings } from '../../../services/framework-services/code-flow.service';
import { environment } from '../../../../environments/environment';
import { TusUploadService } from '../../../services/framework-services/tus-upload.service';
import { AppSettings } from '../../../services/system-setting.service';
import { MeetingRoles } from '../../../core/meeting-access/meeting-roles';

interface CreateMeetingDto {
  guid?: string;
  title: string;
  categoryGuid?: string;
  roomGuid?: string;
  roomName?: string;
  roomLink?: string;
  number?: string;
  date: string;
  startTime: string;
  endTime: string;
  followGuid?: string;
  notAllowReplacement: boolean;
  statusId: number;
  sendNotification: boolean;
  isBoardMeeting: boolean;
  creatorPositionGuid?: string;
  agendas: AgendaItem[];
  members: MeetingMemberDto[];
}

interface MeetingMemberDto {
  id: number;
  name: string;
  isExternal: boolean;
  isRemoved: boolean;
  roleId: number;
  userGuid?: string;
  positionGuid?: string;
  persNo?: string;
  boardMemberGuid?: string;
  mobile?: string;
  email?: string;
  organization?: string;
  gender?: string;
  profileGuid?: string;   // ✅ GUID فایل
  signatureGuid?: string; // ✅ GUID فایل
}
// ===== INTERFACES =====
interface MeetingFormData {
  guid: string;
  title: string;
  categoryGuid: string;
  roomGuid: string;
  roomName: string;
  roomLink: string;
  number: string;
  locationType: string;
  date: string;
  startTime: string;
  endTime: string;
  followGuid: string;
  notAllowReplacement: boolean;
}

interface LoadedMeetingData {
  meeting: any;
  members: MeetingMember[];
  agendas: any[];
}

@Component({
  selector: 'app-meeting-ops',
  templateUrl: './meeting-ops.html',
  imports: [
    CustomSelectComponent,
    ReactiveFormsModule,
    FormsModule,
    CustomInputComponent,
    RouterLink,
    CommonModule,
    MeetingParticipantsComponent,
    MeetingAgendasComponent,
    NgClass
  ],
  standalone: true,
  styleUrls: ['./meeting-ops.css']
})
export class MeetingOpsComponent implements OnInit {


  // ===== DEPENDENCY INJECTION =====
  private readonly fb = inject(FormBuilder);
  private readonly meetingService = inject(MeetingService);
  private readonly roomService = inject(RoomService);
  private readonly categoryService = inject(CategoryService);
  private readonly userService = inject(UserService);
  private readonly boardMemberService = inject(BoardMemberService);
  private readonly memberService = inject(MeetingMemberService);
  private readonly categoryPermissionService = inject(CategoryPermissionService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly fileService = inject(FileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly swalService = inject(SwalService);
  private readonly toastService = inject(ToastService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly destroyRef = inject(DestroyRef);

  // ===== INPUT SIGNALS =====
  readonly createType = input<CreatType>(CreatType.Create);

  // ===== OUTPUT SIGNALS =====
  readonly membersUpdated = output<MeetingMember[]>();

  // ===== PRIVATE SIGNALS =====
  private readonly _meetingGuid = signal<string>('');
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isBoardMeetingCategory = signal<boolean>(false);

  // Data signals
  private readonly _categories = signal<ComboBase[]>([]);
  private readonly _rooms = signal<ComboBase[]>([]);
  private readonly _systemUsers = signal<SystemUser[]>([]);
  private readonly _boardMembers = signal<BoardMember[]>([]);
  private readonly _availableUsers = signal<SystemUser[]>([]);
  private readonly _allUsers = signal<SystemUser[]>([]);
  private readonly _meetings = signal<ComboBase[]>([]);
  private readonly _selectedMembers = signal<MeetingMember[]>([]);
  private readonly _conflictedUsers = signal<any[]>([]);
  private readonly _fileStorage = signal<{ [key: string]: { profile?: File; signature?: File } }>({});
  private readonly _suggestedSlots = signal<SuggestedSlot[]>([]);
  private readonly _isSuggestedSlotsLoading = signal<boolean>(false);
  private readonly _roomConflictMeeting = signal<RoomConflictMeeting | null>(null);

  readonly suggestedSlots = this._suggestedSlots.asReadonly();
  readonly isSuggestedSlotsLoading = this._isSuggestedSlotsLoading.asReadonly();
  readonly roomConflictMeeting = this._roomConflictMeeting.asReadonly();
  public meetingNumber = signal<string>('');
  public creator = signal<string>('');
  // Form state signals
  private readonly _isFollowUp = signal<boolean>(false);
  private readonly _isFollowUpChecked = signal<boolean>(false);

  // ===== PUBLIC COMPUTED SIGNALS =====
  readonly categories = this._categories.asReadonly();
  readonly rooms = this._rooms.asReadonly();
  readonly systemUsers = this._systemUsers.asReadonly();
  readonly boardMembers = this._boardMembers.asReadonly();
  readonly availableUsers = this._availableUsers.asReadonly();
  readonly meetings = this._meetings.asReadonly();
  readonly selectedMembers = this._selectedMembers.asReadonly();
  readonly conflictedUsers = this._conflictedUsers.asReadonly();
  readonly fileStorage = this._fileStorage.asReadonly();
  readonly meetingGuid = this._meetingGuid.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isBoardMeetingCategory = this._isBoardMeetingCategory.asReadonly();
  readonly isFollowUp = this._isFollowUp.asReadonly();
  readonly isFollowUpChecked = this._isFollowUpChecked.asReadonly();
  readonly allUsers = this._allUsers.asReadonly();
  // MeetingOpsComponent.ts
  private readonly _isNumberDuplicate = signal<boolean>(false);
  private readonly _duplicateMeetingTitle = signal<string>('');
  private readonly numberCheck$ = new Subject<string>();

  readonly isNumberDuplicate = this._isNumberDuplicate.asReadonly();
  readonly duplicateMeetingTitle = this._duplicateMeetingTitle.asReadonly();


  // ═══════════════════════════════════════════════════════════
  // ✅ اصلاح hasConflicts computed
  //
  // نکته جدید: تداخل‌هایی از نوع "GuestInfo" (یعنی کاربر فقط به
  // عنوان "مهمان" در یک جلسه دیگر حضور دارد) صرفاً اطلاع‌رسانی هستند
  // و نباید مانع ثبت/ویرایش جلسه شوند. بنابراین این نوع از
  // محاسبه hasConflicts کنار گذاشته می‌شود.
  // ═══════════════════════════════════════════════════════════
  readonly hasConflicts = computed(() => {
    const conflicts = this._conflictedUsers();
    const roomConflict = this.meetingForm?.get('roomGuid')?.hasError('conflict');

    const activeMembers = this._selectedMembers().filter(m => !m.isRemoved);
    const activeUserGuids = activeMembers
      .map(m => m.userGuid)
      .filter(guid => guid);

    // ✅ از conflict.guid استفاده کن (نه conflict.userGuid)
    // و نوع GuestInfo را که فقط جنبه اطلاع‌رسانی دارد، نادیده بگیر
    const activeConflicts = conflicts.filter(conflict =>
      activeUserGuids.includes(conflict.guid) && conflict.type !== 'GuestInfo'
    );

    return activeConflicts.length > 0 || !!roomConflict;
  });


  // ===== اصلاح onMembersUpdated =====
  onMembersUpdated(updatedMembers: MeetingMember[], skipConflictCheck: boolean = false): void {
    const previousMembers = this._selectedMembers();
    this._selectedMembers.set(updatedMembers);

    // ✅ حذف کاربران حذف شده از لیست تداخل‌ها
    const currentConflicts = this._conflictedUsers();
    if (currentConflicts.length > 0) {
      const activeUserGuids = updatedMembers
        .filter(m => !m.isRemoved)
        .map(m => m.userGuid)
        .filter(guid => guid);

      // ✅ اصلاح: از conflict.guid استفاده کن
      const filteredConflicts = currentConflicts.filter(conflict =>
        activeUserGuids.includes(conflict.guid)
      );

      this._conflictedUsers.set(filteredConflicts);
    }

    // ✅ فقط اگر skipConflictCheck نباشد و عضویت واقعی تغییر کرده باشد
    if (!skipConflictCheck && !this.isBoardMeetingCategory()) {
      const membersChanged = this.hasMembershipChanged(previousMembers, updatedMembers);
      if (membersChanged) {
        setTimeout(() => {
          this.triggerConflictCheck();
        }, 100);
      }
    }

    this.membersUpdated.emit(updatedMembers);
  }

  // ✅ متد جدید برای بررسی تغییر عضویت (نه تغییر نقش)
  private hasMembershipChanged(previous: MeetingMember[], current: MeetingMember[]): boolean {
    const prevActiveGuids = new Set(
      previous.filter(m => !m.isRemoved).map(m => m.userGuid || m.guid)
    );
    const currActiveGuids = new Set(
      current.filter(m => !m.isRemoved).map(m => m.userGuid || m.guid)
    );

    // اگر تعداد متفاوت باشد
    if (prevActiveGuids.size !== currActiveGuids.size) return true;

    // اگر عضو جدیدی اضافه شده یا حذف شده
    for (const guid of currActiveGuids) {
      if (!prevActiveGuids.has(guid)) return true;
    }

    return false;
  }


  readonly hasSecretary = computed(() => {
    return this._selectedMembers().some(member =>
      MeetingRoles.isAnySecretary(member.roleId) && !member.isRemoved
    );
  });

  readonly hasChairman = computed(() => {
    return this._selectedMembers().some(member =>
      MeetingRoles.isChairman(member.roleId) && !member.isRemoved
    );
  });

  // ===== FORM MANAGEMENT =====
  meetingForm!: FormGroup;
  agendas!: FormArray;

  // ===== CONSTANTS =====
  readonly locationTypes = [
    { guid: 'internal', title: 'حضوری درون شرکت' },
    { guid: 'external', title: 'بیرون از شرکت' },
    { guid: 'online', title: 'آنلاین' },
  ];

  // ===== REACTIVE SUBJECTS =====
  private readonly conflictCheck$ = new Subject<string>();
  // ===== LIFECYCLE METHODS =====
  constructor() {
    this.initializeBreadcrumbs();
    this.initializeForm();
    this.setupConflictChecking();
    this.setupNumberChecking();  // اضافه شد
    this.setupConflictTriggers(); // ✅ اضافه شد
    this.setupEffects();
  }

  ngOnInit(): void {
    this.loadInitialData();
    this.subscribeToRouteParams();
    this.loadMeetingsList();
  }
  private setupNumberChecking(): void {
    this.numberCheck$
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((number) => this.performNumberCheck(number));
  }

  // اضافه کردن متد چک شماره
  private performNumberCheck(number: string): void {
    if (!number || !this._isBoardMeetingCategory()) {
      this._isNumberDuplicate.set(false);
      this._duplicateMeetingTitle.set('');
      return;
    }

    const categoryGuid = this.meetingForm.get('categoryGuid')?.value;
    const meetingGuid = this._meetingGuid() || undefined;

    if (!categoryGuid) return;

    this.meetingService.checkMeetingNumber({
      number: number,
      categoryGuid: categoryGuid,
      meetingGuid: meetingGuid
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: any) => {
          this._isNumberDuplicate.set(result.isDuplicate);
          this._duplicateMeetingTitle.set(result.existingMeetingTitle || '');

          // تنظیم خطای فرم
          const numberControl = this.meetingForm.get('number');
          if (result.isDuplicate) {
            numberControl?.setErrors({ duplicate: true });
          } else {
            // فقط خطای duplicate را پاک کن
            if (numberControl?.hasError('duplicate')) {
              const errors = { ...numberControl.errors };
              delete errors['duplicate'];
              numberControl.setErrors(Object.keys(errors).length ? errors : null);
            }
          }
        },
        error: (error) => {
          console.error('Error checking meeting number:', error);
        }
      });
  }

  // اضافه کردن event handler
  onNumberChange(): void {
    const number = this.meetingForm.get('number')?.value;
    if (this._isBoardMeetingCategory() && number) {
      this.numberCheck$.next(number);
    } else {
      this._isNumberDuplicate.set(false);
      this._duplicateMeetingTitle.set('');
    }
  }

  // اصلاح canSubmit computed
  readonly canSubmit = computed(() => {
    return this.meetingForm?.valid &&
      !this.hasConflicts() &&
      !this._isLoading() &&
      !this._isNumberDuplicate();  // اضافه شد
  });

  // ===== INITIALIZATION METHODS =====
  private initializeBreadcrumbs(): void {
    this.breadcrumbService.setItems([
      { label: 'جلسات', routerLink: '/meetings/list' },
      { label: 'ثبت جلسه', routerLink: '/meetings/ops' }
    ]);
  }

  private initializeForm(): void {
    this.meetingForm = this.fb.group({
      guid: [''],
      title: ['', Validators.required],
      categoryGuid: [undefined],
      roomGuid: [undefined, Validators.required],
      roomName: [''],
      roomLink: [''],
      number: [''],
      locationType: ['internal'],
      date: ['', Validators.required],
      startTime: ['', this.timeFormatValidator()],
      endTime: ['', this.timeFormatValidator()],
      followGuid: [''],
      notAllowReplacement: [false],
      agendas: this.fb.array([])
    }, { validators: this.timeRangeValidator });

    this.agendas = this.meetingForm.get('agendas') as FormArray;

    // ✅ اعمال ولیدیشن‌های مکان روی تغییر locationType
    this.meetingForm.get('locationType')?.valueChanges.subscribe(type => {
      this.applyLocationTypeValidators(type);
    });

    // ✅ اعمال اولیه بر اساس مقدار پیش‌فرض (internal) در لحظه ساخت فرم
    this.applyLocationTypeValidators(this.meetingForm.get('locationType')?.value);
  }

  // ✅ متد مجزا - نکته کلیدی: روی هر سه کنترل updateValueAndValidity صدا زده میشه
  private applyLocationTypeValidators(type: string): void {
    const roomNameCtrl = this.meetingForm.get('roomName');
    const roomGuidCtrl = this.meetingForm.get('roomGuid');
    const roomLinkCtrl = this.meetingForm.get('roomLink');

    if (type === 'external') {
      roomGuidCtrl?.clearValidators();
      roomLinkCtrl?.clearValidators();
      roomNameCtrl?.setValidators([Validators.required]);
    } else if (type === 'internal') {
      roomNameCtrl?.clearValidators();
      roomLinkCtrl?.clearValidators();
      roomGuidCtrl?.setValidators([Validators.required]);
    } else {
      // online
      roomNameCtrl?.clearValidators();
      roomGuidCtrl?.clearValidators();
      roomLinkCtrl?.setValidators([Validators.required]);
    }

    // ✅ باگ قبلی اینجا بود: فقط روی roomNameCtrl صدا زده می‌شد.
    // setValidators/clearValidators تا وقتی updateValueAndValidity روی
    // خودِ همون کنترل صدا زده نشه، هیچ اثری روی وضعیت VALID/INVALID نداره.
    roomNameCtrl?.updateValueAndValidity({ emitEvent: false });
    roomGuidCtrl?.updateValueAndValidity({ emitEvent: false });
    roomLinkCtrl?.updateValueAndValidity({ emitEvent: false });
  }


  private setupConflictChecking(): void {
    this.conflictCheck$
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.performConflictCheck());
  }
  operationMode = this.createType;
  // private setupEffects(): void {
  //   // Effect برای تغییرات route parameters
  //   effect(() => {
  //     const paramMap = this.route.snapshot.paramMap;
  //     const guid = paramMap.get('guid') || '';

  //     if (guid !== this._meetingGuid()) {
  //       this._meetingGuid.set(guid);
  //       if (guid) {

  //         untracked(() => this.loadMeeting());
  //       }
  //     }
  //   });

  //   // Effect برای تغییرات category
  //   effect(() => {
  //     const selectedCategoryId = this.meetingForm?.get('categoryGuid')?.value;
  //     if (selectedCategoryId) {
  //       this.handleCategoryChange(selectedCategoryId);
  //     }
  //   });
  // }

  private subscribeToRouteParams(): void {
    this.route.paramMap
      .pipe(
        map(params => params.get('guid') || ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(guid => {
        this._meetingGuid.set(guid);
        if (guid) {
          this.loadMeeting();
        }
      });
  }
  // meeting-ops.component.ts

  // اضافه کردن inject
  private readonly tusUploadService = inject(TusUploadService);

  private async loadInitialData(): Promise<void> {
    //this._isLoading.set(true);

    try {
      await Promise.all([
        this.loadRooms(),
        this.loadCategories(),
        this.loadSystemUsers(),
        this.loadBoardMembers(),
        this.loadAllUsers()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.toastService.error('خطا در بارگذاری اطلاعات اولیه');
    } finally {
      // this._isLoading.set(false);
    }
  }

  private async loadRooms(): Promise<void> {
    try {
      const rooms = await this.roomService.getForCombo<ComboBase[]>().toPromise() || [];
      this._rooms.set(rooms);
    } catch (error) {
      console.error('Error loading rooms:', error);
      this._rooms.set([]);
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      const hasPermission = await this.passwordFlowService.checkPermission('MT_Meetings_ViewAllMeetings');
      const categories = await this.categoryService.getForComboByCondition<ComboBase[]>(hasPermission).toPromise() || [];
      this._categories.set(categories);
    } catch (error) {
      console.error('Error loading categories:', error);
      this._categories.set([]);
    }
  }
  private async loadAllUsers(): Promise<void> {
    try {
      const users = await this.userService.getAll<SystemUser[]>().toPromise() || [];

      const processedUsers = this.processUsersForMultiPosition(users)

      this._allUsers.set(processedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      this._systemUsers.set([]);
    }
  }
  private async loadSystemUsers(): Promise<void> {
    try {
      const clientId = getClientSettings().client_id ?? '';
      const users = await this.userService.getAllByClientId<SystemUser[]>(clientId).toPromise() || [];

      const processedUsers = this.processUsersForMultiPosition(users);

      this._systemUsers.set(processedUsers);
      this.updateAvailableUsers();
    } catch (error) {
      console.error('Error loading users:', error);
      this._systemUsers.set([]);
    }
  }


  private async loadBoardMembers(): Promise<void> {
    try {
      const boardMembers = await this.boardMemberService.getList<BoardMember[]>().toPromise() || [];
      this._boardMembers.set(boardMembers);
    } catch (error) {
      console.error('Error loading board members:', error);
      this._boardMembers.set([]);
    }
  }

  private async loadMeetingsList(): Promise<void> {
    try {
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      const positionGuid = this.localStorageService.getItem(POSITION_ID);
      const hasPermission = await this.passwordFlowService.checkPermission('MT_Meetings_ViewAllMeetings');

      const filter = {
        userGuid,
        positionGuid,
        filterType: 'All',
        canViewAll: hasPermission
      };

      const meetings = (await this.meetingService.getMeetings(filter).toPromise()) as any[] || [];
      const processedMeetings = meetings
        .filter((meeting: any) => meeting.guid !== this._meetingGuid())
        .map((meeting: any) => ({
          guid: meeting.guid,
          title: `${meeting.number} - ${meeting.title}`
        }));

      this._meetings.set(processedMeetings);
    } catch (error) {
      console.error('Error loading meetings list:', error);
      this._meetings.set([]);
    }
  }

  private async loadMeeting(): Promise<void> {
    if (this._isLoading()) return;

    const meetingGuid = this._meetingGuid();
    if (!meetingGuid) return;

    this._isLoading.set(true);

    try {
      const meetingData = await this.loadMeetingData(meetingGuid);
      if (meetingData) {
        setTimeout(() => {
          const user = this.allUsers().find(x => x.baseUserGuid === meetingData.meeting.createdBy);
          this.creator.set(user?.name || '');
        }, 100);

        this.meetingNumber.set(meetingData.meeting.number);
        await this.processMeetingData(meetingData);
      }
    } catch (error) {
      console.error('Error loading meeting:', error);
      this.toastService.error('خطا در بارگذاری جلسه');
    } finally {
      this._isLoading.set(false);
    }
  }

  private async loadMeetingData(meetingGuid: string): Promise<LoadedMeetingData | null> {
    try {
      const meeting = await this.meetingService.getForEdit<any>(meetingGuid).toPromise();
      if (!meeting) return null;

      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      let members: MeetingMember[] = [];

      // بارگذاری اعضا بر اساس حالت عملیات
      const isCloneOperation = this.router.url.includes('/clone/');

      if (this.createType() === CreatType.Edit) {
        // برای ویرایش: بارگذاری اعضای واقعی جلسه
        members = this.meetingBehaviorService.members() || [];
        // members = await this.memberService.getUserList(meetingGuid, userGuid).toPromise() || [];

      } else if (isCloneOperation) {
        // برای کپی: بارگذاری اعضا برای کپی کردن
        members = await this.memberService.getUserList(meetingGuid, userGuid).toPromise() || [];
      }

      return {
        meeting,
        members,
        agendas: meeting?.agendas
      };
    } catch (error) {
      console.error('Error loading meeting data:', error);
      return null;
    }
  }

  private async loadAuthorizedUsers(categoryId: string): Promise<SystemUser[]> {
    try {
      const permissions = await this.categoryPermissionService.getByCategoryGuid(categoryId).toPromise();
      if (!permissions || permissions.length === 0) {
        return [];
      }
      const clientId = getClientSettings()?.client_id ?? '';
      const allUsers = await this.userService.getAllByClientId(clientId).toPromise() || [];
      if (!allUsers) {
        return [];
      }
      const processedUsers = this.processUsersForMultiPosition(allUsers);

      const authorizedPositionGuids = permissions.map(p => p.positionGuid);
      const authorizedUsers = processedUsers.filter(user => {
        const userPositionGuid = user.positionGuid ? user.positionGuid.toLowerCase() : '';
        const isAuthorized = authorizedPositionGuids
          .filter(posGuid => !!posGuid)
          .map(posGuid => posGuid.toLowerCase())
          .includes(userPositionGuid);
        return isAuthorized;
      });
      // Process به composite
      return authorizedUsers;
    } catch (error) {
      console.error('خطا در بارگذاری کاربران مجاز:', error);
      return [];
    }
  }

  private async mergeSystemAndAuthorizedUsers(authorizedUsers: SystemUser[]): Promise<SystemUser[]> {
    const boardMembers = this._boardMembers();

    // ✅ جمع‌آوری همه profileGuid ها
    const profileGuidsToLoad: string[] = [];
    for (const bm of boardMembers) {
      if (bm.profileImageGuid) {
        profileGuidsToLoad.push(bm.profileImageGuid);
      }
    }

    // ✅ Batch load تصاویر
    const profileUrlMap = profileGuidsToLoad.length > 0
      ? await this.tusUploadService.getFilePreviewUrls(profileGuidsToLoad)
      : new Map<string, string>();

    // ✅ ساخت boardAsUsers با تصاویر از TUS
    const boardAsUsers: SystemUser[] = boardMembers.map(bm => {
      let imageUrl = 'img/default-avatar.png';
      if (bm.profileImageGuid) {
        const url = profileUrlMap.get(bm.profileImageGuid.toLowerCase());
        imageUrl = url || 'img/default-avatar.png';
      }

      return {
        guid: bm.guid || bm.id || generateGuid(),
        name: bm.fullName,
        userName: '',
        position: bm.position || '',
        positionGuid: '',
        image: imageUrl,
        isSystem: false,
        baseUserGuid: undefined
      };
    });

    // ترکیب: unique بر اساس guid
    const allUsers = [...boardAsUsers, ...authorizedUsers];
    const uniqueUsers = new Map<string, SystemUser>();

    allUsers.forEach(user => {
      if (!uniqueUsers.has(user.guid)) {
        uniqueUsers.set(user.guid, { ...user });
      } else {
        const existing = uniqueUsers.get(user.guid)!;
        uniqueUsers.set(user.guid, { ...existing, image: user.image || existing.image });
      }
    });

    return Array.from(uniqueUsers.values()).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ اصلاح processExistingMembers - کامل‌تر با پشتیبانی Board Members
  // ═══════════════════════════════════════════════════════════
  // MeetingOpsComponent.ts
  // هدف: وقتی member.userGuid + member.positionGuid ذخیره شده ولی کاربر سمتش عوض شده،
  // دیگر matchingEntry undefined نشود و «سمت زمان جلسه» درست نمایش داده شود.
  // همچنین اگر کاربر غیرفعال (isActive=0) باشد، در خروجی مشخص شود.

  // نکته: برای اینکه وضعیت فعال/غیرفعال را داشته باشید، بهتر است در processUsersForMultiPosition
  // این فیلد را هم وارد کنید (اگر در SystemUser موجود است).

  // -----------------------------------------------------------------------------
  // 1) پیشنهاد: processUsersForMultiPosition را کمی غنی‌تر کنید
  // -----------------------------------------------------------------------------

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

  // -----------------------------------------------------------------------------
  // 2) ایندکس‌ها برای lookup سریع و استخراج عنوان سمت حتی اگر کاربر سمتش را عوض کرده باشد
  // -----------------------------------------------------------------------------

  private buildAllUsersIndexes(allUsers: SystemUser[]) {
    // همه رکوردهای composite یک نفر
    const byBaseGuid = new Map<string, SystemUser[]>();

    // مپ عنوان سمت برای هر positionGuid (از کل سازمان)
    const positionTitleByGuid = new Map<string, string>();

    for (const u of allUsers) {
      const base = (u as any).baseUserGuid || u.guid;
      if (!byBaseGuid.has(base)) byBaseGuid.set(base, []);
      byBaseGuid.get(base)!.push(u);

      if (u.positionGuid && u.position) {
        // اگر یک positionGuid چندبار آمد، اولین عنوان کافی است
        if (!positionTitleByGuid.has(u.positionGuid)) {
          positionTitleByGuid.set(u.positionGuid, u.position);
        }
      }
    }

    return { byBaseGuid, positionTitleByGuid };
  }

  private pickPreferredEntry(entries: SystemUser[]): SystemUser {
    // اگر منطق اولویت دارید (مثلاً اصلی‌ترین سمت)، اینجا اعمال کنید.
    // فعلاً همان اولین رکورد را برمی‌گردانیم.
    return entries[0];
  }

  private resolveMeetingPositionTitle(
    member: MeetingMember,
    positionTitleByGuid: Map<string, string>
  ): string {
    // 1) اگر بک‌اند عنوان سمت زمان جلسه را داده، همان را نگه دارید
    if (member.position && member.position.trim() !== '') return member.position;

    // 2) اگر فقط positionGuid داریم، عنوان سمت را از مپ کل سمت‌ها پیدا می‌کنیم
    if (member.positionGuid) {
      const t = positionTitleByGuid.get(member.positionGuid);
      if (t && t.trim() !== '') return t;
    }

    // 3) fallback
    return 'سمت نامشخص';
  }

  //
  // 3) بازنویسی کامل proces-----------------------------------------------------------------------------sExistingMembers
  // -----------------------------------------------------------------------------

  private async processExistingMembers(members: MeetingMember[]): Promise<MeetingMember[]> {
    const processedMembers: MeetingMember[] = [];
    const allUsers = this._allUsers();
    const boardMembers = this._boardMembers();

    // ✅ ایندکس‌ها
    const { byBaseGuid, positionTitleByGuid } = this.buildAllUsersIndexes(allUsers);

    // ✅ جمع‌آوری GUID تصاویر (هم members و هم board members)
    const imageGuidsToLoad: string[] = [];
    for (const member of members) {
      if (member.profileGuid) imageGuidsToLoad.push(member.profileGuid);

      if (member.boardMemberGuid) {
        const bm = boardMembers.find(x => x.guid === member.boardMemberGuid || x.id === member.boardMemberGuid);
        if (bm?.profileImageGuid) imageGuidsToLoad.push(bm.profileImageGuid);
      }
    }

    // ✅ Batch load URL های تصاویر
    const imageUrlMap = imageGuidsToLoad.length > 0
      ? await this.tusUploadService.getFilePreviewUrls(imageGuidsToLoad)
      : new Map<string, string>();

    for (const member of members) {
      // any فقط برای فیلدهای کمکی جهت UI (اختیاری)
      const m: any = { ...member };

      // -------------------------------------------------------------------------
      // Board Members
      // -------------------------------------------------------------------------
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

        // substitute (اختیاری)
        if (member.replacementUserGuid) {
          const selectedMembers = this._selectedMembers();
          m.substitute = selectedMembers.find(x => x.userGuid === member.replacementUserGuid)?.name || '';
        }

        processedMembers.push(m);
        continue;
      }

      // -------------------------------------------------------------------------
      // System Users
      // -------------------------------------------------------------------------
      if (member.userGuid && !member.isExternal) {
        const entries = byBaseGuid.get(member.userGuid) || [];

        // عنوان سمت زمان جلسه (حتی اگر سمت عوض شده باشد)
        const meetingPositionTitle = this.resolveMeetingPositionTitle(member, positionTitleByGuid);

        // 1) match دقیق: همان positionGuid ذخیره‌شده در جلسه
        const exact = member.positionGuid
          ? entries.find(u => u.positionGuid === member.positionGuid)
          : undefined;

        if (exact) {
          // سمت هنوز همان است
          m.guid = exact.guid;
          m.positionGuid = exact.positionGuid; // همان سمت جلسه
          m.position = meetingPositionTitle;   // نمایش سمت زمان جلسه
          m.currentPosition = exact.position || '';
          m.currentPositionGuid = exact.positionGuid || '';
          m.positionChanged = false;
          m.userIsActive = (exact as any).userIsActive ?? true;
        } else if (entries.length > 0) {
          // سمت تغییر کرده (کاربر هست ولی positionGuid قدیمی دیگر در رکوردهای current نیست)
          const preferred = this.pickPreferredEntry(entries);

          m.guid = preferred.guid; // برای اینکه در UI selectable باشد

          // مهم: positionGuid زمان جلسه را نگه داریم تا بتوانیم تاریخچه/سمت زمان جلسه را نمایش دهیم
          m.positionGuid = member.positionGuid || '';
          m.position = meetingPositionTitle; // نمایش سمت زمان جلسه

          // سمت فعلی را هم برای UI نگه می‌داریم
          m.currentPosition = preferred.position || '';
          m.currentPositionGuid = preferred.positionGuid || '';

          // فلگ‌ها
          m.positionChanged = !!member.positionGuid; // اگر قبلاً سمت داشته و الان exact پیدا نشده => تغییر کرده
          m.userIsActive = (preferred as any).userIsActive ?? true;
        } else {
          // حالت نادر: allUsers شما این کاربر را برنگردانده (مثلاً API فقط activeها را داده)
          // با این حال ما سمت زمان جلسه را با map یا snapshot نشان می‌دهیم تا undefined نشود.
          m.position = meetingPositionTitle;
          m.positionGuid = member.positionGuid || '';
          m.userMissingInAllUsers = true;
        }

        // تصویر
        if (member.profileGuid) {
          const img = imageUrlMap.get(member.profileGuid.toLowerCase());
          m.image = img || this.getDefaultMemberImage(member);
        } else {
          // اگر userName داشته باشیم می‌توانیم عکس سیستم را نشان دهیم
          const fallbackUser = entries.length > 0 ? this.pickPreferredEntry(entries) : null;
          m.image = fallbackUser ? this.getSystemUserImage(fallbackUser) : this.getDefaultMemberImage(member);
        }

        // substitute
        if (member.replacementUserGuid) {
          const selectedMembers = this._selectedMembers();
          m.substitute = selectedMembers.find(x => x.userGuid === member.replacementUserGuid)?.name || '';
        }

        processedMembers.push(m);
        continue;
      }

      // -------------------------------------------------------------------------
      // External Guests
      // -------------------------------------------------------------------------
      if (member.isExternal) {
        m.position = m.position || member.organization || 'مهمان';

        if (member.profileGuid) {
          const img = imageUrlMap.get(member.profileGuid.toLowerCase());
          m.image = img || 'img/default-avatar.png';
        } else {
          m.image = 'img/default-avatar.png';
        }

        // substitute
        if (member.replacementUserGuid) {
          const selectedMembers = this._selectedMembers();
          m.substitute = selectedMembers.find(x => x.userGuid === member.replacementUserGuid)?.name || '';
        }

        processedMembers.push(m);
        continue;
      }

      // -------------------------------------------------------------------------
      // Fallback
      // -------------------------------------------------------------------------
      m.position = m.position || 'سمت نامشخص';
      m.image = m.image || 'img/default-avatar.png';

      if (member.replacementUserGuid) {
        const selectedMembers = this._selectedMembers();
        m.substitute = selectedMembers.find(x => x.userGuid === member.replacementUserGuid)?.name || '';
      }

      processedMembers.push(m);
    }

    return processedMembers;
  }

  // -----------------------------------------------------------------------------
  // 4) نکته کلیدی برای سناریوی شما (isActive=0)
  // -----------------------------------------------------------------------------
  // اگر API شما در userService.getAll() فقط کاربران فعال را برمی‌گرداند، entries برای کاربر غیرفعال
  // خالی می‌شود و وارد شاخه userMissingInAllUsers می‌روید.
  // پس باید مطمئن شوید getAll() «کاربران غیرفعال» را هم برگرداند یا یک endpoint جدا برای includeInactive داشته باشید.


  // ═══════════════════════════════════════════════════════════
  // ✅ اصلاح updateSingleMemberForClone - استفاده از TUS
  // ═══════════════════════════════════════════════════════════

  private async updateSingleMemberForClone(
    originalMember: MeetingMember,
    systemUsers: SystemUser[],
    boardMembers: BoardMember[],
    allSystemUsers: SystemUser[],
    isBoardMeeting: boolean
  ): Promise<MeetingMember | null> {
    let updatedMember: MeetingMember = {
      ...originalMember,
      id: 0,
      guid: generateGuid()
    };

    if (isBoardMeeting && originalMember.boardMemberGuid) {
      // عضو هیئت مدیره
      const currentBoardMember = boardMembers.find(bm =>
        bm.id === originalMember.boardMemberGuid || bm.guid === originalMember.boardMemberGuid
      );

      if (currentBoardMember) {
        updatedMember = {
          ...updatedMember,
          name: currentBoardMember.fullName,
          position: currentBoardMember.position || '',
          boardMemberGuid: currentBoardMember.id || currentBoardMember.guid
        };

        // ✅ بارگذاری تصویر از TUS
        if (currentBoardMember.profileImageGuid) {
          const imageUrl = await this.tusUploadService.getFilePreviewUrl(currentBoardMember.profileImageGuid);
          updatedMember.image = imageUrl || 'img/default-avatar.png';
        } else {
          updatedMember.image = 'img/default-avatar.png';
        }
      } else {
        console.warn(`Board member not found: ${originalMember.name}`);
        return null;
      }
    } else if (originalMember.userGuid && !originalMember.isExternal) {
      // کاربر سیستم
      let currentUser = systemUsers.find(u => u.baseUserGuid === originalMember.userGuid);

      if (!currentUser) {
        currentUser = allSystemUsers.find(u => u.baseUserGuid === originalMember.userGuid);
      }

      if (currentUser) {
        updatedMember = {
          ...updatedMember,
          name: currentUser.name,
          position: currentUser.position || '',
          positionGuid: currentUser.positionGuid || '',
          userName: currentUser.userName,
          userGuid: currentUser.baseUserGuid,
          image: this.getSystemUserImage(currentUser)
        };
      } else {
        console.warn(`User not found, converting to external guest: ${originalMember.name}`);
        return await this.createFallbackExternalMember(originalMember);
      }
    } else if (originalMember.isExternal) {
      // مهمان خارجی - تصویر از TUS اگر profileGuid دارد
      if (originalMember.profileGuid) {
        const imageUrl = await this.tusUploadService.getFilePreviewUrl(originalMember.profileGuid);
        updatedMember.image = imageUrl || 'img/default-avatar.png';
      } else if (!updatedMember.image || updatedMember.image === '') {
        updatedMember.image = 'img/default-avatar.png';
      }
    }

    return updatedMember;
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ اصلاح updateMembersForClone - Batch load تصاویر
  // ═══════════════════════════════════════════════════════════

  private async updateMembersForClone(originalMembers: MeetingMember[]): Promise<MeetingMember[]> {
    const systemUsers = this._systemUsers();
    const boardMembers = this._boardMembers();
    const isBoardMeeting = this._isBoardMeetingCategory();
    const allSystemUsers = this._allUsers();

    // ✅ جمع‌آوری همه GUID های تصاویر برای batch load
    const imageGuidsToLoad: string[] = [];

    for (const member of originalMembers) {
      if (member.profileGuid) {
        imageGuidsToLoad.push(member.profileGuid);
      }
      if (isBoardMeeting && member.boardMemberGuid) {
        const boardMember = boardMembers.find(bm =>
          bm.id === member.boardMemberGuid || bm.guid === member.boardMemberGuid
        );
        if (boardMember?.profileImageGuid) {
          imageGuidsToLoad.push(boardMember.profileImageGuid);
        }
      }
    }

    // ✅ Batch load تصاویر
    const imageUrlMap = imageGuidsToLoad.length > 0
      ? await this.tusUploadService.getFilePreviewUrls(imageGuidsToLoad)
      : new Map<string, string>();

    const updatedMembers: MeetingMember[] = [];

    for (const originalMember of originalMembers) {
      try {
        const updatedMember = await this.updateSingleMemberForCloneWithCache(
          originalMember,
          systemUsers,
          boardMembers,
          allSystemUsers,
          isBoardMeeting,
          imageUrlMap
        );

        if (updatedMember) {
          updatedMembers.push(updatedMember);
        }
      } catch (error) {
        console.warn(`Failed to update member ${originalMember.name}:`, error);
        const fallbackMember = await this.createFallbackExternalMember(originalMember);
        if (fallbackMember) {
          updatedMembers.push(fallbackMember);
        }
      }
    }

    return updatedMembers;
  }

  // ✅ متد جدید با استفاده از cache
  private async updateSingleMemberForCloneWithCache(
    originalMember: MeetingMember,
    systemUsers: SystemUser[],
    boardMembers: BoardMember[],
    allSystemUsers: SystemUser[],
    isBoardMeeting: boolean,
    imageUrlMap: Map<string, string>
  ): Promise<MeetingMember | null> {
    let updatedMember: MeetingMember = {
      ...originalMember,
      id: 0,
      guid: generateGuid()
    };

    if (isBoardMeeting && originalMember.boardMemberGuid) {
      const currentBoardMember = boardMembers.find(bm =>
        bm.id === originalMember.boardMemberGuid || bm.guid === originalMember.boardMemberGuid
      );

      if (currentBoardMember) {
        updatedMember = {
          ...updatedMember,
          name: currentBoardMember.fullName,
          position: currentBoardMember.position || '',
          boardMemberGuid: currentBoardMember.id || currentBoardMember.guid
        };

        // ✅ تصویر از cache
        if (currentBoardMember.profileImageGuid) {
          const imageUrl = imageUrlMap.get(currentBoardMember.profileImageGuid.toLowerCase());
          updatedMember.image = imageUrl || 'img/default-avatar.png';
        } else {
          updatedMember.image = 'img/default-avatar.png';
        }
      } else {
        return null;
      }
    } else if (originalMember.userGuid && !originalMember.isExternal) {
      let currentUser = systemUsers.find(u => u.baseUserGuid === originalMember.userGuid);

      if (!currentUser) {
        currentUser = allSystemUsers.find(u => u.baseUserGuid === originalMember.userGuid);
      }

      if (currentUser) {
        updatedMember = {
          ...updatedMember,
          name: currentUser.name,
          position: currentUser.position || '',
          positionGuid: currentUser.positionGuid || '',
          userName: currentUser.userName,
          userGuid: currentUser.baseUserGuid,
          image: this.getSystemUserImage(currentUser)
        };
      } else {
        return await this.createFallbackExternalMember(originalMember);
      }
    } else if (originalMember.isExternal) {
      // ✅ تصویر مهمان از cache
      if (originalMember.profileGuid) {
        const imageUrl = imageUrlMap.get(originalMember.profileGuid.toLowerCase());
        updatedMember.image = imageUrl || 'img/default-avatar.png';
      } else if (!updatedMember.image) {
        updatedMember.image = 'img/default-avatar.png';
      }
    }

    return updatedMember;
  }


  private async setupAvailableUsersForMeeting(isBoardCategory: boolean, categoryGuid: string): Promise<void> {
    if (isBoardCategory) {
      try {
        // برای جلسات هیئت مدیره: ترکیب اعضای هیئت مدیره و کاربران مجاز
        const [authorizedUsers] = await Promise.all([
          this.loadAuthorizedUsers(categoryGuid)
        ]);

        // ترکیب کاربران سیستم با کاربران مجاز (بدون تکرار)
        const combinedUsers = this.mergeSystemAndAuthorizedUsers(authorizedUsers);
        this._availableUsers.set(await combinedUsers);
      } catch (error) {
        console.error('Error setting up board meeting users:', error);
        this._availableUsers.set([...this._systemUsers()]);
      }
    } else {
      // برای جلسات عادی: همه کاربران سیستم
      this._availableUsers.set(this._systemUsers().map(user => ({
        ...user,
        image: user.userName ? `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${user.userName}.jpg`)}&w=48&q=75` : 'img/default-avatar.png',
        isSystem: true
      })));
    }
  }

  private async processMembersData(members: MeetingMember[], isCloneMode: boolean): Promise<MeetingMember[]> {
    if (isCloneMode) {
      // در حالت کپی: به‌روزرسانی اطلاعات اعضا با داده‌های فعلی
      return this.updateMembersForClone(members);
    } else {
      // در حالت ویرایش: پردازش عادی اعضا
      return this.processExistingMembers(members);
    }
  }
  // ===== CATEGORY HANDLING =====
  private async handleCategoryChange(selectedCategoryId: string): Promise<void> {
    const prevIsBoard = this._isBoardMeetingCategory();
    const isBoardCategory = selectedCategoryId === AppSettings.boardCategoryGuid;

    this._isBoardMeetingCategory.set(isBoardCategory);
    this._availableUsers.set([]);
    await this.updateAvailableUsers();

    // ✅ شماره جلسه فقط برای هیئت‌مدیره required باشد
    this.applyBoardNumberValidator(isBoardCategory);

    const isCreateNew = this.createType() === CreatType.Create && !this._meetingGuid();

    if (isBoardCategory && isCreateNew) {
      // فقط وقتی از غیرهیئت -> هیئت می‌رویم اعضا را پاک/اتو انتخاب کن
      if (!prevIsBoard) this._selectedMembers.set([]);
      await this.autoSelectBoardMembers();
      return;
    }

    // اگر از هیئت -> عادی برگشتیم، اعضای خودکار هیئت را پاک کن
    if (!isBoardCategory && prevIsBoard) {
      this._selectedMembers.set([]);
    }

    // ✅ اگر عادی -> عادی تغییر کرد، اعضا حفظ شوند (هیچ کاری نکن)
  }

  private applyBoardNumberValidator(isBoard: boolean): void {
    const numberCtrl = this.meetingForm.get('number');
    if (!numberCtrl) return;

    if (isBoard) {
      numberCtrl.setValidators([Validators.required]);
    } else {
      numberCtrl.clearValidators();
      numberCtrl.setValue('', { emitEvent: false });
    }
    numberCtrl.updateValueAndValidity({ emitEvent: false });
  }
  private async updateAvailableUsers(): Promise<void> {
    const isBoardCategory = this._isBoardMeetingCategory();
    const selectedCategoryId = this.meetingForm?.get('categoryGuid')?.value;
    this._availableUsers.set([]);

    if (isBoardCategory && selectedCategoryId) {
      await this.setupAvailableUsersForMeeting(true, selectedCategoryId);
    } else {
      this._availableUsers.set([...this._systemUsers()]);
    }
  }


  private async autoSelectBoardMembers(): Promise<void> {
    const boardMembers = this._availableUsers();
    if (boardMembers.length === 0) return;

    // ✅ جمع‌آوری همه profileGuid های اعضای هیئت مدیره
    const boardMembersData = this._boardMembers();
    const profileGuidsToLoad: string[] = [];
    const guidToMemberMap = new Map<string, BoardMember>();

    for (const availableUser of boardMembers) {
      // فقط برای اعضای هیئت مدیره (غیر سیستمی)
      if (availableUser.isSystem === false) {
        const boardMember = boardMembersData.find(bm =>
          bm.guid === availableUser.guid
        );
        if (boardMember?.profileImageGuid) {
          profileGuidsToLoad.push(boardMember.profileImageGuid);
          guidToMemberMap.set(boardMember.profileImageGuid.toLowerCase(), boardMember);
        }
      }
    }

    // ✅ Batch load تصاویر
    const profileUrlMap = profileGuidsToLoad.length > 0
      ? await this.tusUploadService.getFilePreviewUrls(profileGuidsToLoad)
      : new Map<string, string>();

    const autoSelectedMembers: MeetingMember[] = [];

    for (const boardMember of boardMembers) {
      let memberImage = 'img/default-avatar.png';

      // ✅ تنظیم تصویر
      if (boardMember.isSystem === false) {
        // عضو هیئت مدیره
        const originalBoardMember = boardMembersData.find(bm =>
          bm.guid === boardMember.guid
        );
        if (originalBoardMember?.profileImageGuid) {
          const url = profileUrlMap.get(originalBoardMember.profileImageGuid.toLowerCase());
          memberImage = url || 'img/default-avatar.png';
        }
      } else if (boardMember.isSystem === true) {
        // کاربر سیستم
        memberImage = boardMember.image || this.getSystemUserImage(boardMember as SystemUser);
      }

      const memberData: MeetingMember = {
        id: 0,
        guid: generateGuid(),
        boardMemberGuid: boardMember.isSystem === false ? boardMember.guid : null,
        userGuid: boardMember.isSystem === true ? boardMember.baseUserGuid : undefined,
        positionGuid: boardMember.isSystem === true ? boardMember.positionGuid : null,
        name: boardMember.name,
        position: boardMember.position || '',
        roleId: MeetingRoles.member, // عضو عادی
        isExternal: false,
        isRemoved: false,
        image: memberImage,
        isSystem: boardMember.isSystem
      };

      autoSelectedMembers.push(memberData);
    }

    this._selectedMembers.set(autoSelectedMembers);
  }

  private getDefaultMemberImage(member: MeetingMember): string {
    if (this._isBoardMeetingCategory() && member.boardMemberGuid) {
      return 'img/default-avatar.png';
    }

    if (member.userName) {
      return `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${member.userName}.jpg`)}&w=48&q=75`;
    }

    return 'img/default-avatar.png';
  }

  // ===== FORM PATCHING METHODS =====
  private patchMeetingForm(meeting: any, formatTime: (time: string) => string): void {
    this.meetingForm.patchValue({
      guid: meeting.guid,
      title: meeting.title,
      categoryGuid: meeting.categoryGuid,
      roomGuid: meeting.roomGuid,
      roomName: meeting.roomName,
      roomLink: meeting.roomLink,
      locationType: meeting.roomGuid ? 'internal' : meeting.roomLink ? 'online' : 'external',
      followGuid: meeting.followGuid,
      date: meeting.date,
      number: meeting.number,
      notAllowReplacement: meeting.notAllowReplacement,
      startTime: formatTime(meeting.startTime),
      endTime: formatTime(meeting.endTime)
    });
  }

  private loadMeetingAgendas(agendas: any[], isCloneOperation: boolean): void {
    this.agendas.clear();

    if (!isCloneOperation && agendas && agendas.length > 0) {
      agendas.forEach((agenda: any) => {
        // تبدیل files از backend به فرمت جدید
        const files: AgendaFileDto[] = (agenda.files || []).map((f: any) => ({
          id: f.id || 0,
          isRemoved: f.isRemoved || false,
          fileGuid: f.fileGuid || f.guid || ''
        }));

        const agendaGroup = this.fb.group({
          id: [agenda.id],
          text: [agenda.text, Validators.required],
          files: [files],
          isRemoved: [false]
        });
        this.agendas.push(agendaGroup);
      });
    }
  }

  onFileStorageUpdated(updatedData: any): void {
    this._fileStorage.set(updatedData);
  }

  onAgendasUpdate(agendas: FormArray): void {
    const agendasControl = this.meetingForm.get('agendas');
    if (agendasControl instanceof FormArray) {
      while (agendasControl.length) {
        agendasControl.removeAt(0);
      }
      agendas.controls.forEach(control => {
        agendasControl.push(control);
      });
    }
    const agendasControl1 = this.agendas;
    if (agendasControl1 instanceof FormArray) {
      while (agendasControl1.length) {
        agendasControl1.removeAt(0);
      }
      agendas.controls.forEach(control => {
        agendasControl1.push(control);
      });
    }
  }

  onCheckboxChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this._isFollowUpChecked.set(target.checked);

    if (!target.checked) {
      this.meetingForm.get('followGuid')?.setValue('');
    }
  }

  onTemplateSelect(event: Event): void {
    const templateId = (event.target as HTMLSelectElement).value;
    if (!templateId) return;

    this.meetingService.getBy(templateId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (template: any) => {
          this.applyTemplate(template);
        },
        error: (error) => {
          console.error('Error loading template:', error);
          this.toastService.error('خطا در بارگذاری قالب');
        }
      });
  }

  private applyTemplate(template: any): void {
    this.meetingForm.patchValue(template);
    this._selectedMembers.set(template.members || []);

    this.agendas.clear();
    (template.agendas || []).forEach((agenda: any) => {
      const agendaGroup = this.fb.group({
        id: [agenda.id ?? 0],
        description: [agenda.description, Validators.required],
        fileUrl: [agenda.fileUrl]
      });
      this.agendas.push(agendaGroup);
    });
  }
  private setupConflictTriggers(): void {
    const fields = ['date', 'startTime', 'endTime', 'roomGuid'];

    merge(
      ...fields.map(field =>
        this.meetingForm.get(field)!.valueChanges
      )
    )
      .pipe(
        debounceTime(600),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.triggerConflictCheck();
      });
  }

  private performConflictCheck(): void {
    const form = this.meetingForm.value;
    const { date, startTime, endTime, roomGuid } = form;

    // ✅ چک وجود مقدار
    if (!date || !startTime || !endTime) return;

    // ✅ چک validity کنترل‌ها
    const startCtrl = this.meetingForm.get('startTime');
    const endCtrl = this.meetingForm.get('endTime');

    if (startCtrl?.invalid || endCtrl?.invalid) return;

    // ✅ چک خطای timeInvalid روی group
    if (this.meetingForm.hasError('timeInvalid')) return;

    if (this.isBoardMeetingCategory()) return;

    // آماده‌سازی لیست اعضا برای بررسی کانفلیکت - شامل positionGuid
    const members = this._selectedMembers()
      .filter(m => !m.isRemoved && MeetingRoles.countsAsMember(m.roleId))
      .map<any>(m => {
        return {
          userGuid: m.userGuid,
          userName: m.userName || '',
          positionGuid: m.positionGuid || null, // ✅ اضافه شد
          boardMemberId: null
        };
      })
      .filter(m => m.userGuid);

    const conflictData = {
      meetingGuid: this._meetingGuid() || '',
      date,
      startTime,
      endTime,
      members,
      roomGuid: roomGuid || '',
      isBoardMeeting: this._isBoardMeetingCategory()
    };

    this.meetingService.checkConflicts(conflictData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: ConflictResult) => {
          this.handleConflictResult(result);
        },
        error: (error) => {
          console.error('Error checking conflicts:', error);
          this.handleConflictResult({ roomConflict: false, usersWithConflict: [] });
        }
      });
  }
  // meeting-participants.component.ts


  // بهبود فراخوانی conflict check در event handlerها
  onLocationTypeChange(event: Event): void {
    this.meetingForm.patchValue({
      roomGuid: '',
      roomName: '',
      roomLink: '',
    });

    // تاخیر کوتاه برای اطمینان از به‌روزرسانی فرم
    setTimeout(() => {
      this.triggerConflictCheck();
    }, 100);
  }

  onRoomChange(): void {
    setTimeout(() => {
      this.triggerConflictCheck();
    }, 100);
  }

  onDateChange(): void {
    setTimeout(() => {
      this.triggerConflictCheck();
    }, 100);
  }

  onTimeChange(): void {
    this.meetingForm.updateValueAndValidity();
    setTimeout(() => {
      this.triggerConflictCheck();
    }, 100);
  }
  private handleConflictResult(result: ConflictResult): void {
    const roomGuidCtrl = this.meetingForm.get('roomGuid');

    // ✅ فقط خطای conflict رو حذف کن، بقیه خطاها (مثل required) دست نخوره
    if (roomGuidCtrl?.hasError('conflict')) {
      const errors = { ...roomGuidCtrl.errors };
      delete errors['conflict'];
      roomGuidCtrl.setErrors(Object.keys(errors).length ? errors : null);
    }

    this._conflictedUsers.set([]);
    this._roomConflictMeeting.set(null);

    if (result.roomConflict) {
      // ✅ خطای conflict رو به بقیه خطاهای موجود اضافه کن، جایگزین نکن
      const currentErrors = roomGuidCtrl?.errors || {};
      roomGuidCtrl?.setErrors({ ...currentErrors, conflict: true });
      if (result.roomConflictMeeting) {
        this._roomConflictMeeting.set(result.roomConflictMeeting);
      }
    } else {
      // ✅ اگر تداخلی نبود، بذار validatorهای عادی (مثل required) دوباره خودشون رو چک کنن
      roomGuidCtrl?.updateValueAndValidity({ emitEvent: false });
    }

    this._conflictedUsers.set(result.usersWithConflict || []);

    if (this.hasConflicts()) {
      this.loadSuggestedSlots();
    } else {
      this._suggestedSlots.set([]);
    }
  }
  // ──── ساعت‌های پیشنهادی ────

  private loadSuggestedSlots(): void {
    const form = this.meetingForm.value;
    if (!form.date || !form.startTime || !form.endTime) return;

    const [sh, sm] = (form.startTime as string).split(':').map(Number);
    const [eh, em] = (form.endTime as string).split(':').map(Number);
    const durationMinutes = Math.min(Math.max((eh * 60 + em) - (sh * 60 + sm), 60), 120);

    const members = this._selectedMembers()
      .filter(m => !m.isRemoved && MeetingRoles.countsAsMember(m.roleId) && m.userGuid)
      .map(m => ({ userGuid: m.userGuid, userName: m.userName || '', positionGuid: m.positionGuid || null }));

    this._isSuggestedSlotsLoading.set(true);
    this._suggestedSlots.set([]);

    this.meetingService.getSuggestedSlots({
      date: form.date,
      members,
      roomGuid: form.roomGuid || null,
      meetingGuid: this._meetingGuid() || null,
      slotDurationMinutes: durationMinutes
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (slots: SuggestedSlot[]) => {
          this._suggestedSlots.set(slots.slice(0, 8));
          this._isSuggestedSlotsLoading.set(false);
        },
        error: () => {
          this._suggestedSlots.set([]);
          this._isSuggestedSlotsLoading.set(false);
        }
      });
  }

  applySuggestedSlot(slot: SuggestedSlot): void {
    this.meetingForm.patchValue({ startTime: slot.startTime, endTime: slot.endTime });
    this._suggestedSlots.set([]);
    // conflict check مجدد
    setTimeout(() => this.triggerConflictCheck(), 100);
  }

  showRoomConflictModal(): void {
    try {
      const el = document.getElementById('roomConflictModal');
      if (el) new (window as any).bootstrap.Modal(el).show();
    } catch (e) { console.error(e); }
  }
  // ===== FORM VALIDATION =====
  private timeFormatValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
      return timePattern.test(control.value) ? null : { invalidTimeFormat: true };
    };
  }

  private timeRangeValidator(group: AbstractControl): ValidationErrors | null {
    const startTime = group.get('startTime')?.value;
    const endTime = group.get('endTime')?.value;

    if (!startTime || !endTime) return null;

    return startTime >= endTime ? { timeInvalid: true } : null;
  }

  submitMeeting(status: number): void {
    if (!this.validateMeeting()) {
      return;
    }

    this._isLoading.set(true);

    // ✅ ساخت DTO به جای FormData
    const meetingDto = this.buildMeetingDto(status);

    this.meetingService.create(meetingDto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          this.handleSubmissionSuccess(response);
        },
        error: (error: any) => {
          console.error('Error submitting meeting:', error);
          this.toastService.error('خطا در ثبت جلسه');
        },
        complete: () => {
          this._isLoading.set(false);
        }
      });
  }

  // ═══════════════════════════════════════════════════════════
  // Build DTO Method - جایگزین buildFormData
  // ═══════════════════════════════════════════════════════════

  private buildMeetingDto(status: number): CreateMeetingDto {
    const formValue = this.meetingForm.value;
    const positionGuid = this.localStorageService.getItem(POSITION_ID);

    // تعیین status و notification
    let statusId = status;
    let sendNotification = false;

    if (status === 3) {
      sendNotification = true;
      statusId = 2;
    }

    // ✅ ساخت آرایه agendas
    const agendas: AgendaItem[] = this.agendas.controls.map(agenda => {
      const agendaValue = agenda.value;
      return {
        id: agendaValue.id ?? 0,
        text: agendaValue.text || '',
        isRemoved: agendaValue.isRemoved ?? false,
        files: (agendaValue.files || []).map((file: AgendaFileDto) => ({
          id: file.id ?? 0,
          isRemoved: file.isRemoved ?? false,
          fileGuid: file.fileGuid || ''
        }))
      };
    });

    // ✅ ساخت آرایه members
    const members: MeetingMemberDto[] = this._selectedMembers().map(member => {
      const memberDto: MeetingMemberDto = {
        id: member.id ? (this.createType() === CreatType.Edit ? member.id : 0) : 0,
        name: member.name,
        isExternal: member.isExternal,
        isRemoved: member.isRemoved ?? false,
        roleId: member.roleId
      };

      // User-specific info
      if (!member.isExternal && member.userGuid) {
        memberDto.userGuid = member.userGuid;
        memberDto.positionGuid = member.positionGuid || undefined;
        memberDto.persNo = member.userName || undefined;
      }

      // Board member specific info
      if (this._isBoardMeetingCategory() && member.boardMemberGuid) {
        memberDto.boardMemberGuid = member.boardMemberGuid;
      }

      // External guest info
      if (member.isExternal) {
        memberDto.mobile = member.mobile || undefined;
        memberDto.email = member.email || undefined;
        memberDto.organization = member.organization || undefined;
        memberDto.gender = member.gender || undefined;
      }

      // ✅ File GUIDs
      if (member.profileGuid) {
        memberDto.profileGuid = member.profileGuid;
      }
      if (member.signatureGuid) {
        memberDto.signatureGuid = member.signatureGuid;
      }

      return memberDto;
    });

    // ✅ ساخت DTO نهایی
    const dto: CreateMeetingDto = {
      guid: formValue.guid || undefined,
      title: this.sanitizeTitle(formValue.title),
      categoryGuid: formValue.categoryGuid || undefined,
      roomGuid: formValue.roomGuid || undefined,
      roomName: formValue.roomName || undefined,
      roomLink: formValue.roomLink || undefined,
      number: formValue.number || undefined,
      date: formValue.date,
      startTime: formValue.startTime,
      endTime: formValue.endTime,
      followGuid: formValue.followGuid || undefined,
      notAllowReplacement: formValue.notAllowReplacement ?? false,
      statusId: statusId,
      sendNotification: sendNotification,
      isBoardMeeting: this._isBoardMeetingCategory(),
      creatorPositionGuid: positionGuid || undefined,
      agendas: agendas,
      members: members
    };

    return dto;
  }
  private sanitizeTitle(value: string): string {
    if (!value) return '';
    // حذف کاراکترهای خاص: " ' ` ^ ~ < > { } [ ] | \ و ...
    return value.replace(/["'`^~<>{}[\]|\\]/g, '').trim();
  }
  private validateMeeting(): boolean {

    if (this._isBoardMeetingCategory() && this._isNumberDuplicate()) {
      this.toastService.error('شماره جلسه تکراری است. لطفاً شماره دیگری وارد کنید.');
      return false;
    }


    if (this.hasConflicts()) {
      this.toastService.error('ثبت جلسه به دلیل وجود تداخل امکان پذیر نیست.');
      return false;
    }

    if (this.meetingForm.invalid) {
      this.meetingForm.markAllAsTouched(); // ✅ این roomName رو هم touched میکنه

      // پیام خاص برای آدرس
      const locationType = this.meetingForm.get('locationType')?.value;
      if (locationType === 'external' && this.meetingForm.get('roomName')?.invalid) {
        this.toastService.error('لطفاً آدرس مکان برگزاری را وارد کنید.');
      }
      return false;
    }

    const agendasFormArray = this.meetingForm.get('agendas') as FormArray;
    const allControls = agendasFormArray?.controls ?? [];

    const activeAgendas = allControls.filter(
      agenda => !agenda.get('isRemoved')?.value
    );

    const hasInvalidAgenda = activeAgendas.some(
      agenda => !agenda.get('text')?.value?.trim()
    );

    if (hasInvalidAgenda) {
      activeAgendas.forEach(agenda => {
        if (!agenda.get('text')?.value?.trim()) {
          agenda.get('text')?.markAsTouched();
        }
      });
      this.toastService.error('لطفاً متن همه دستور جلسات را وارد کنید.');
      return false;
    }



    // Validate required roles
    if (!this.hasSecretary()) {
      this.toastService.error("لطفا دبیر جلسه را مشخص کنید.");
      return false;
    }

    if (!this.hasChairman()) {
      this.toastService.error("لطفا رئیس جلسه را مشخص کنید.");
      return false;
    }

    return true;
  }


  private handleSubmissionSuccess(response: any): void {
    const meetingGuid = this.meetingForm.get('guid')?.value;
    const isEdit = !!meetingGuid;

    const title = isEdit ? "ویرایش جلسه" : "ثبت جلسه";
    const text = isEdit
      ? "جلسه با موفقیت ویرایش شد"
      : `جلسه با موفقیت ثبت گردید<br>شماره جلسه:<a href="/#/meetings/details/${response.guid}" target="_blank">${response.number}</a>`;

    this.swalService.fireSucceddedSwal(title, text);
    this.router.navigateByUrl('/meetings/list');
  }
  // ===== اصلاحات برای متد setupEffects =====
  private setupEffects(): void {
    // Effect برای تغییرات route parameters
    effect(() => {
      const paramMap = this.route.snapshot.paramMap;
      const guid = paramMap.get('guid') || '';

      if (guid !== this._meetingGuid()) {
        this._meetingGuid.set(guid);
        if (guid) {
          untracked(() => this.loadMeeting());
        }
      }
    });

    // Effect برای تغییرات category
    effect(() => {
      const selectedCategoryId = this.meetingForm?.get('categoryGuid')?.value;
      if (selectedCategoryId) {
        untracked(() => this.handleCategoryChange(selectedCategoryId));
      }
    });


  }

  // ===== اصلاح متد processMeetingData =====
  private async processMeetingData(data: LoadedMeetingData): Promise<void> {
    const { meeting, members, agendas } = data;
    const formatTime = (time: string) => time ? time.slice(0, 5) : '';
    const isBoardCategory = meeting.categoryGuid === AppSettings.boardCategoryGuid;
    const isCloneOperation = this.router.url.includes('/clone/');

    // تنظیم نوع دسته‌بندی
    this._isBoardMeetingCategory.set(isBoardCategory);

    // آماده‌سازی کاربران در دسترس بر اساس نوع جلسه
    await this.setupAvailableUsersForMeeting(isBoardCategory, meeting.categoryGuid);

    // تنظیم فرم
    if (this.createType() === CreatType.Edit) {
      this.patchMeetingForm(meeting, formatTime);
    }
    else if (isCloneOperation) {
      this.patchCloneForm(meeting);
    }

    // پردازش اعضا - برای clone operation اعضا را به روزرسانی کن
    if (members && members.length > 0) {
      const processedMembers = await this.processMembersData(members, isCloneOperation);
      this._selectedMembers.set(processedMembers);
    }

    // پردازش دستور جلسات - برای clone عدم کپی agendas
    if (!isCloneOperation) {
      this.loadMeetingAgendas(agendas, false);
    }

    // تنظیم وضعیت پیگیری
    const isFollowUp = !!(meeting.followGuid);
    this._isFollowUp.set(isFollowUp);
    this._isFollowUpChecked.set(isFollowUp);

    // بررسی conflict بعد از لود کامل داده‌ها
    // فقط برای جلسات غیر هیئت مدیره
    if (!isBoardCategory) {
      setTimeout(() => {
        this.triggerConflictCheck();
      }, 500);
    }
  }

  // ===== متد جدید برای ایجاد عضو fallback =====
  private async createFallbackExternalMember(originalMember: MeetingMember): Promise<MeetingMember> {
    return {
      ...originalMember,
      id: 0,
      guid: generateGuid(),
      isExternal: true,
      userGuid: undefined,
      boardMemberGuid: undefined,
      positionGuid: '',
      userName: undefined,
      roleId: MeetingRoles.guest, // مهمان
      organization: originalMember.position || originalMember.organization || 'سازمان نامشخص',
      image: originalMember.image || 'img/default-avatar.png'
    };
  }

  // ===== اصلاح متد patchCloneForm =====
  private patchCloneForm(meeting: any): void {
    this.meetingForm.patchValue({
      title: '', // خالی برای clone
      categoryGuid: meeting.categoryGuid,
      roomGuid: '', // خالی برای clone - کاربر باید مجدداً انتخاب کند
      roomName: '', // خالی
      roomLink: '', // خالی
      locationType: 'internal', // مقدار پیش‌فرض
      followGuid: '', // خالی برای clone
      date: '', // خالی - کاربر باید وارد کند
      startTime: '', // خالی
      endTime: '', // خالی
      number: '', // خالی برای جلسات هیئت مدیره
      notAllowReplacement: false // پیش‌فرض
    });

    // تنظیم مجدد وضعیت پیگیری
    this._isFollowUp.set(false);
    this._isFollowUpChecked.set(false);
  }

  // ===== اصلاح متد triggerConflictCheck =====
  public triggerConflictCheck(): void {
    // فقط برای جلسات غیر هیئت مدیره conflict check انجام بده
    if (this.isBoardMeetingCategory()) {
      console.log('Conflict check skipped for board meetings');
      return;
    }

    // بررسی اینکه آیا اطلاعات کافی برای بررسی موجود است
    const form = this.meetingForm?.value;
    if (form && form.date && form.startTime && form.endTime) {
      // ایجاد یک key منحصر به فرد برای distinctUntilChanged
      const conflictKey = `${form.date}-${form.startTime}-${form.endTime}-${form.roomGuid || ''}-${this._selectedMembers().length}`;
      this.conflictCheck$.next(conflictKey);
    }
  }

  // ===== اصلاح متد onCategoryChange =====
  async onCategoryChange(): Promise<void> {
    const selectedCategoryId = this.meetingForm.get('categoryGuid')?.value;
    if (selectedCategoryId) {
      await this.handleCategoryChange(selectedCategoryId);

      // بعد از تغییر category، conflict check انجام بده
      // فقط اگر جلسه هیئت مدیره نباشد
      if (!this.isBoardMeetingCategory()) {
        setTimeout(() => {
          this.triggerConflictCheck();
        }, 200);
      }
    }
  }




  // ===== اصلاح متد getSystemUserImage =====
  private getSystemUserImage(user: SystemUser): string {
    if (user.userName && user.userName.trim() !== '') {
      return `${environment.fileManagementEndpoint}/api/Image?url=${encodeURIComponent(`photo/${user.userName}.jpg`)}&w=48&q=75`;
    }
    return 'img/default-avatar.png';
  }
}