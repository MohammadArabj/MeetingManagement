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

import { MeetingService } from '../../../services/meeting.service';
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

import { POSITION_ID } from '../../../core/types/configuration';
import { AppSettings } from '../../../services/system-setting.service';
import { MeetingRoles } from '../../../core/meeting-access/meeting-roles';

import { LOCATION_TYPES, LoadedMeetingData, MemberFileStorage } from './meeting-ops.models';
import {
  buildConflictCheckRequest,
  buildConflictKey,
  buildMeetingDto,
  buildSubmissionSuccessMessage,
  buildSuggestedSlotsRequest,
  hasActiveMemberWithRole,
  filterConflictsForMembers,
  hasBlockingConflicts,
  hasMembershipChanged,
  withSystemUserImages
} from './meeting-ops.helpers';
import {
  applyBoardNumberValidator,
  applyLocationTypeValidators,
  applyNumberDuplicateError,
  applyRoomConflictError,
  buildMeetingForm,
  createAgendaGroup,
  createTemplateAgendaGroup,
  isScheduleReadyForConflictCheck,
  patchCloneForm,
  patchMeetingForm,
  replaceFormArrayControls,
  validateMeetingForSubmit
} from './meeting-ops-form.helpers';
import { MeetingOpsMembersService } from './meeting-ops-members.service';
import { MeetingOpsDataService } from './meeting-ops-data.service';

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
  providers: [MeetingOpsMembersService, MeetingOpsDataService],
  standalone: true,
  styleUrls: ['./meeting-ops.css']
})
export class MeetingOpsComponent implements OnInit {

  // ===== DEPENDENCY INJECTION =====
  private readonly fb = inject(FormBuilder);
  private readonly meetingService = inject(MeetingService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly swalService = inject(SwalService);
  private readonly toastService = inject(ToastService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly membersService = inject(MeetingOpsMembersService);
  private readonly dataService = inject(MeetingOpsDataService);
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
        this.scheduleConflictCheck(100);
      }
    }

    this.membersUpdated.emit(updatedMembers);
  }

  readonly hasSecretary = computed(() =>
    hasActiveMemberWithRole(this._selectedMembers(), roleId => MeetingRoles.isAnySecretary(roleId))
  );

  readonly hasChairman = computed(() =>
    hasActiveMemberWithRole(this._selectedMembers(), roleId => MeetingRoles.isChairman(roleId))
  );

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
      this.resetNumberDuplicate();
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
      this.resetNumberDuplicate();
    }
  }

  private resetNumberDuplicate(): void {
    this._isNumberDuplicate.set(false);
    this._duplicateMeetingTitle.set('');
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
    this._rooms.set(await this.dataService.loadRooms());
  }

  private async loadCategories(): Promise<void> {
    this._categories.set(await this.dataService.loadCategories());
  }

  private async loadAllUsers(): Promise<void> {
    const users = await this.dataService.loadAllUsers();
    if (users) {
      this._allUsers.set(users);
    } else {
      // رفتار قبلی حفظ شده: در صورت خطا لیست کاربران سیستم خالی می‌شود
      this._systemUsers.set([]);
    }
  }

  private async loadSystemUsers(): Promise<void> {
    const users = await this.dataService.loadSystemUsers();
    if (users) {
      this._systemUsers.set(users);
      this.updateAvailableUsers();
    } else {
      this._systemUsers.set([]);
    }
  }

  private async loadBoardMembers(): Promise<void> {
    this._boardMembers.set(await this.dataService.loadBoardMembers());
  }

  private async loadMeetingsList(): Promise<void> {
    this._meetings.set(await this.dataService.loadMeetingsList(() => this._meetingGuid()));
  }

  private async loadMeeting(): Promise<void> {
    if (this._isLoading()) return;

    const meetingGuid = this._meetingGuid();
    if (!meetingGuid) return;

    this._isLoading.set(true);

    try {
      const meetingData = await this.dataService.loadMeetingData(
        meetingGuid,
        () => this.createType() === CreatType.Edit,
        () => this.router.url.includes('/clone/'),
        () => this.meetingBehaviorService.members()
      );
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

  // ===== MEMBERS PREPARATION =====
  private async setupAvailableUsersForMeeting(isBoardCategory: boolean, categoryGuid: string): Promise<void> {
    if (isBoardCategory) {
      // برای جلسات هیئت مدیره: ترکیب اعضای هیئت مدیره و کاربران مجاز
      this._availableUsers.set(await this.membersService.buildBoardMeetingUsers(
        categoryGuid, () => this._boardMembers(), () => this._systemUsers()
      ));
    } else {
      // برای جلسات عادی: همه کاربران سیستم
      this._availableUsers.set(withSystemUserImages(this._systemUsers()));
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
    // ✅ چک وجود مقدار، validity کنترل‌ها و خطای timeInvalid روی group
    if (!isScheduleReadyForConflictCheck(this.meetingForm)) return;

    if (this.isBoardMeetingCategory()) return;

    // آماده‌سازی درخواست بررسی کانفلیکت - اعضا شامل positionGuid
    const conflictData = buildConflictCheckRequest(
      this.meetingForm.value, this._selectedMembers(), this._meetingGuid(), this._isBoardMeetingCategory()
    );

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
    this.scheduleConflictCheck(100);
  }

  onRoomChange(): void {
    this.scheduleConflictCheck(100);
  }

  onDateChange(): void {
    this.scheduleConflictCheck(100);
  }

  onTimeChange(): void {
    this.meetingForm.updateValueAndValidity();
    this.scheduleConflictCheck(100);
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

    const request = buildSuggestedSlotsRequest(form, this._selectedMembers(), this._meetingGuid());

    this._isSuggestedSlotsLoading.set(true);
    this._suggestedSlots.set([]);

    this.meetingService.getSuggestedSlots(request)
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
    this.scheduleConflictCheck(100);
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
    const { valid, message } = validateMeetingForSubmit(this.meetingForm, {
      isBoardMeeting: this._isBoardMeetingCategory(),
      isNumberDuplicate: this._isNumberDuplicate(),
      hasConflicts: this.hasConflicts(),
      hasSecretary: this.hasSecretary(),
      hasChairman: this.hasChairman()
    });

    if (message) {
      this.toastService.error(message);
    }
    return valid;
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
      this.scheduleConflictCheck(500);
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

  /** اجرای triggerConflictCheck با تاخیر (برای اطمینان از به‌روزرسانی فرم) */
  private scheduleConflictCheck(delayMs: number): void {
    setTimeout(() => {
      this.triggerConflictCheck();
    }, delayMs);
  }

  // ===== onCategoryChange =====
  async onCategoryChange(): Promise<void> {
    const selectedCategoryId = this.meetingForm.get('categoryGuid')?.value;
    if (selectedCategoryId) {
      await this.handleCategoryChange(selectedCategoryId);

      // بعد از تغییر category، conflict check انجام بده
      // فقط اگر جلسه هیئت مدیره نباشد
      if (!this.isBoardMeetingCategory()) {
        this.scheduleConflictCheck(200);
      }
    }
  }
}
