import { PasswordFlowService } from './../../../services/framework-services/password-flow.service';
import {
  Component,
  input,
  signal,
  computed,
  effect,
  inject,
  DestroyRef,
  output,
  OnInit,
  untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormGroup,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  FormsModule
} from '@angular/forms';
import { map, debounceTime, distinctUntilChanged, Subject, merge } from 'rxjs';
import { CommonModule, NgClass } from '@angular/common';

import { MeetingMember } from '../../../core/models/Meeting';
import { SystemUser } from '../../../core/models/User';
import { BoardMember } from '../../../core/models/BoardMember';
import { ComboBase } from '../../../shared/combo-base';
import { ConflictResult, RoomConflictMeeting, SuggestedSlot } from '../../../core/types/conflict-result';
import { CreatType } from '../../../core/types/enums';

import { CategoryService } from '../../../services/category.service';
import { MeetingService } from '../../../services/meeting.service';
import { RoomService } from '../../../services/room.service';
import { UserService } from '../../../services/user.service';
import { BoardMemberService } from '../../../services/board-member.service';
import { MeetingMemberService } from '../../../services/meeting-member.service';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { SwalService } from '../../../services/framework-services/swal.service';
import { ToastService } from '../../../services/framework-services/toast.service';

import { CustomSelectComponent } from "../../../shared/custom-controls/custom-select";
import { CustomInputComponent } from '../../../shared/custom-controls/custom-input';
import { ActivatedRoute, Router } from '@angular/router';
import { MeetingBehaviorService } from '../meeting-details/meeting-behavior-service';
import { MeetingParticipantsComponent } from './meeting-participants/meeting-participants';
import { MeetingAgendasComponent } from './meeting-agendas/meeting-agendas';
import { RoomConflictModalComponent } from './room-conflict-modal/room-conflict-modal';
import { MeetingOpsActionsComponent } from './meeting-ops-actions/meeting-ops-actions';

import {
  POSITION_ID,
  USER_ID_NAME
} from '../../../core/types/configuration';
import { getClientSettings } from '../../../services/framework-services/code-flow.service';
import { environment } from '../../../../environments/environment';
import { AppSettings } from '../../../services/system-setting.service';
import { MeetingRoles } from '../../../core/meeting-access/meeting-roles';

import { LOCATION_TYPES, LoadedMeetingData, MemberFileStorage } from './meeting-ops.models';
import {
  buildConflictCheckMembers,
  buildConflictKey,
  buildMeetingDto,
  buildSubmissionSuccessMessage,
  buildSuggestedSlotMembers,
  computeSlotDurationMinutes,
  filterConflictsForMembers,
  hasBlockingConflicts,
  hasMembershipChanged,
  processUsersForMultiPosition
} from './meeting-ops.helpers';
import {
  applyBoardNumberValidator,
  applyLocationTypeValidators,
  applyNumberDuplicateError,
  applyRoomConflictError,
  buildMeetingForm,
  createAgendaGroup,
  createTemplateAgendaGroup,
  markInvalidAgendas,
  patchCloneForm,
  patchMeetingForm,
  replaceFormArrayControls
} from './meeting-ops-form.helpers';
import { MeetingOpsMembersService } from './meeting-ops-members.service';

@Component({
  selector: 'app-meeting-ops',
  templateUrl: './meeting-ops.html',
  imports: [
    CustomSelectComponent,
    ReactiveFormsModule,
    FormsModule,
    CustomInputComponent,
    CommonModule,
    MeetingParticipantsComponent,
    MeetingAgendasComponent,
    RoomConflictModalComponent,
    MeetingOpsActionsComponent,
    NgClass
  ],
  providers: [MeetingOpsMembersService],
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
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly swalService = inject(SwalService);
  private readonly toastService = inject(ToastService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly membersService = inject(MeetingOpsMembersService);
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
  private readonly _fileStorage = signal<MemberFileStorage>({});
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
  // بررسی تکراری بودن شماره جلسه
  private readonly _isNumberDuplicate = signal<boolean>(false);
  private readonly _duplicateMeetingTitle = signal<string>('');
  private readonly numberCheck$ = new Subject<string>();

  readonly isNumberDuplicate = this._isNumberDuplicate.asReadonly();
  readonly duplicateMeetingTitle = this._duplicateMeetingTitle.asReadonly();


  // ═══════════════════════════════════════════════════════════
  // ✅ hasConflicts computed
  // تداخل‌های نوع "GuestInfo" صرفاً اطلاع‌رسانی هستند و مانع ثبت نمی‌شوند
  // (جزئیات در hasBlockingConflicts)
  // ═══════════════════════════════════════════════════════════
  readonly hasConflicts = computed(() => {
    const conflicts = this._conflictedUsers();
    const roomConflict = this.meetingForm?.get('roomGuid')?.hasError('conflict');

    return hasBlockingConflicts(conflicts, this._selectedMembers(), !!roomConflict);
  });


  // ===== اصلاح onMembersUpdated =====
  onMembersUpdated(updatedMembers: MeetingMember[], skipConflictCheck: boolean = false): void {
    const previousMembers = this._selectedMembers();
    this._selectedMembers.set(updatedMembers);

    // ✅ حذف کاربران حذف شده از لیست تداخل‌ها
    const currentConflicts = this._conflictedUsers();
    if (currentConflicts.length > 0) {
      this._conflictedUsers.set(filterConflictsForMembers(currentConflicts, updatedMembers));
    }

    // ✅ فقط اگر skipConflictCheck نباشد و عضویت واقعی تغییر کرده باشد
    if (!skipConflictCheck && !this.isBoardMeetingCategory()) {
      const membersChanged = hasMembershipChanged(previousMembers, updatedMembers);
      if (membersChanged) {
        setTimeout(() => {
          this.triggerConflictCheck();
        }, 100);
      }
    }

    this.membersUpdated.emit(updatedMembers);
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
  readonly locationTypes = LOCATION_TYPES.map(type => ({ ...type }));

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

  // متد چک شماره
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
          applyNumberDuplicateError(this.meetingForm.get('number'), result.isDuplicate);
        },
        error: (error) => {
          console.error('Error checking meeting number:', error);
        }
      });
  }

  // event handler تغییر شماره جلسه
  onNumberChange(): void {
    const number = this.meetingForm.get('number')?.value;
    if (this._isBoardMeetingCategory() && number) {
      this.numberCheck$.next(number);
    } else {
      this._isNumberDuplicate.set(false);
      this._duplicateMeetingTitle.set('');
    }
  }

  // canSubmit computed
  readonly canSubmit = computed(() => {
    return this.meetingForm?.valid &&
      !this.hasConflicts() &&
      !this._isLoading() &&
      !this._isNumberDuplicate();  // اضافه شد
  });

  // ===== INITIALIZATION METHODS =====
  private initializeBreadcrumbs(): void {
    // داخل صفحه‌ی جزئیات جلسه (ویرایش)، مسیر را خود صفحه‌ی جزئیات تعیین می‌کند
    if (this.router.url.includes('/meetings/details/')) return;
    this.breadcrumbService.setItems([
      { label: 'جلسات', routerLink: '/meetings/list' },
      { label: 'ثبت جلسه', routerLink: '/meetings/create' }
    ]);
  }

  private initializeForm(): void {
    this.meetingForm = buildMeetingForm(this.fb);

    this.agendas = this.meetingForm.get('agendas') as FormArray;

    // ✅ اعمال ولیدیشن‌های مکان روی تغییر locationType
    this.meetingForm.get('locationType')?.valueChanges.subscribe(type => {
      applyLocationTypeValidators(this.meetingForm, type);
    });

    // ✅ اعمال اولیه بر اساس مقدار پیش‌فرض (internal) در لحظه ساخت فرم
    applyLocationTypeValidators(this.meetingForm, this.meetingForm.get('locationType')?.value);
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

  // ===== DATA LOADING =====
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

      const processedUsers = processUsersForMultiPosition(users)

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

      const processedUsers = processUsersForMultiPosition(users);

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

  // ===== MEMBERS PREPARATION =====
  private async setupAvailableUsersForMeeting(isBoardCategory: boolean, categoryGuid: string): Promise<void> {
    if (isBoardCategory) {
      try {
        // برای جلسات هیئت مدیره: ترکیب اعضای هیئت مدیره و کاربران مجاز
        const [authorizedUsers] = await Promise.all([
          this.membersService.loadAuthorizedUsers(categoryGuid)
        ]);

        // ترکیب کاربران سیستم با کاربران مجاز (بدون تکرار)
        const combinedUsers = this.membersService.mergeSystemAndAuthorizedUsers(this._boardMembers(), authorizedUsers);
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
      return this.membersService.updateMembersForClone(members, {
        systemUsers: this._systemUsers(),
        boardMembers: this._boardMembers(),
        isBoardMeeting: this._isBoardMeetingCategory(),
        allSystemUsers: this._allUsers()
      });
    } else {
      // در حالت ویرایش: پردازش عادی اعضا
      return this.membersService.processExistingMembers(members, {
        allUsers: this._allUsers(),
        boardMembers: this._boardMembers(),
        getSelectedMembers: () => this._selectedMembers(),
        isBoardMeeting: () => this._isBoardMeetingCategory()
      });
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
    applyBoardNumberValidator(this.meetingForm, isBoardCategory);

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
    const autoSelectedMembers = await this.membersService.buildAutoSelectedBoardMembers(
      this._availableUsers(),
      this._boardMembers()
    );
    if (!autoSelectedMembers) return;

    this._selectedMembers.set(autoSelectedMembers);
  }

  // ===== AGENDAS =====
  private loadMeetingAgendas(agendas: any[], isCloneOperation: boolean): void {
    this.agendas.clear();

    if (!isCloneOperation && agendas && agendas.length > 0) {
      agendas.forEach((agenda: any) => {
        this.agendas.push(createAgendaGroup(this.fb, agenda));
      });
    }
  }

  onFileStorageUpdated(updatedData: any): void {
    this._fileStorage.set(updatedData);
  }

  onAgendasUpdate(agendas: FormArray): void {
    const agendasControl = this.meetingForm.get('agendas');
    if (agendasControl instanceof FormArray) {
      replaceFormArrayControls(agendasControl, agendas);
    }
    const agendasControl1 = this.agendas;
    if (agendasControl1 instanceof FormArray) {
      replaceFormArrayControls(agendasControl1, agendas);
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
      this.agendas.push(createTemplateAgendaGroup(this.fb, agenda));
    });
  }

  // ===== CONFLICT CHECKING =====
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
    const members = buildConflictCheckMembers(this._selectedMembers());

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
    // ✅ خطای conflict روی کنترل مکان (بدون دست زدن به بقیه خطاها)
    applyRoomConflictError(this.meetingForm.get('roomGuid'), result);

    this._conflictedUsers.set([]);
    this._roomConflictMeeting.set(null);

    if (result.roomConflict && result.roomConflictMeeting) {
      this._roomConflictMeeting.set(result.roomConflictMeeting);
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

    const durationMinutes = computeSlotDurationMinutes(form.startTime as string, form.endTime as string);

    const members = buildSuggestedSlotMembers(this._selectedMembers());

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

  // ===== SUBMISSION =====
  submitMeeting(status: number): void {
    if (!this.validateMeeting()) {
      return;
    }

    this._isLoading.set(true);

    // ✅ ساخت DTO به جای FormData
    const meetingDto = buildMeetingDto({
      status,
      formValue: this.meetingForm.value,
      agendaValues: this.agendas.controls.map(agenda => agenda.value),
      members: this._selectedMembers(),
      isEdit: this.createType() === CreatType.Edit,
      isBoardMeeting: this._isBoardMeetingCategory(),
      creatorPositionGuid: this.localStorageService.getItem(POSITION_ID)
    });

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

    if (markInvalidAgendas(this.meetingForm)) {
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

    const { title, text } = buildSubmissionSuccessMessage(isEdit, response);

    this.swalService.fireSucceddedSwal(title, text);
    this.router.navigateByUrl('/meetings/list');
  }
  // ===== setupEffects =====
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

  // ===== processMeetingData =====
  private async processMeetingData(data: LoadedMeetingData): Promise<void> {
    const { meeting, members, agendas } = data;
    const isBoardCategory = meeting.categoryGuid === AppSettings.boardCategoryGuid;
    const isCloneOperation = this.router.url.includes('/clone/');

    // تنظیم نوع دسته‌بندی
    this._isBoardMeetingCategory.set(isBoardCategory);

    // آماده‌سازی کاربران در دسترس بر اساس نوع جلسه
    await this.setupAvailableUsersForMeeting(isBoardCategory, meeting.categoryGuid);

    // تنظیم فرم
    if (this.createType() === CreatType.Edit) {
      patchMeetingForm(this.meetingForm, meeting);
    }
    else if (isCloneOperation) {
      patchCloneForm(this.meetingForm, meeting);

      // تنظیم مجدد وضعیت پیگیری
      this._isFollowUp.set(false);
      this._isFollowUpChecked.set(false);
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

  // ===== triggerConflictCheck =====
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
      const conflictKey = buildConflictKey(form, this._selectedMembers().length);
      this.conflictCheck$.next(conflictKey);
    }
  }

  // ===== onCategoryChange =====
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
}
