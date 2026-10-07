// calendar/calendar.ts
import {
  Component,
  viewChild,
  inject,
  DestroyRef,
  signal,
  computed,
  effect,
  OnInit,
  AfterViewInit
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { FullCalendarModule } from '@fullcalendar/angular';
import timeGridPlugin from '@fullcalendar/timegrid';
import faLocale from '@fullcalendar/core/locales/fa';
import { Modal, Tooltip } from 'bootstrap';
import moment from 'jalali-moment';
import Swal from 'sweetalert2';

import { MeetingService } from '../../services/meeting.service';
import {
  BlockedTimeService,
  BlockedTimeDto,
  CreateBlockedTimeDto,
  UpdateBlockedTimeDto
} from '../../services/blocked-time.service';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { POSITION_ID, USER_ID_NAME } from '../../core/types/configuration';
import { BreadcrumbService } from '../../services/framework-services/breadcrumb.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { ToastService } from '../../services/framework-services/toast.service';
import { UserService } from '../../services/user.service';

interface CalendarEvent {
  id?: string;
  title: string;
  start: string;
  end?: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  url?: string;
  display?: string;
  extendedProps?: {
    type: 'Meeting' | 'BlockedTime';
    guid?: string;
    description?: string;
  };
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [FormsModule, FullCalendarModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css'
})
export class CalendarComponent implements OnInit, AfterViewInit {
  // Injected services
  private readonly meetingService = inject(MeetingService);
  private readonly blockedTimeService = inject(BlockedTimeService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly toastService = inject(ToastService);
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  // ViewChild
  readonly calendarComponent = viewChild<any>('fullcalendar');

  // ====== State ======
  private readonly _events = signal<CalendarEvent[]>([]);
  private readonly _blockedTimes = signal<BlockedTimeDto[]>([]);
  private readonly _selectedDate = signal<string>('');
  private readonly _isPermitted = signal<boolean>(false);
  private readonly _calendarOptions = signal<CalendarOptions>({} as CalendarOptions);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _currentUser = signal<any>(null);
  private readonly _dataLoaded = signal<boolean>(false);
  private readonly _visibleStart = signal<string>('');
  private readonly _visibleEnd = signal<string>('');
  // ====== Modal/Form State ======
  private readonly _isEditMode = signal<boolean>(false);
  private readonly _editingBlockedTime = signal<BlockedTimeDto | null>(null);
  private readonly _isSaving = signal<boolean>(false);

  private readonly _formDate = signal<string>('');
  private readonly _formStartTime = signal<string>('08:00');
  private readonly _formEndTime = signal<string>('17:00');
  private readonly _formDescription = signal<string>('');

  // Public readonly signals
  readonly events = this._events.asReadonly();
  readonly blockedTimes = this._blockedTimes.asReadonly();
  readonly selectedDate = this._selectedDate.asReadonly();
  readonly isPermitted = this._isPermitted.asReadonly();
  readonly calendarOptions = this._calendarOptions.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly isEditMode = this._isEditMode.asReadonly();
  readonly editingBlockedTime = this._editingBlockedTime.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly formDate = this._formDate.asReadonly();
  readonly formStartTime = this._formStartTime.asReadonly();
  readonly formEndTime = this._formEndTime.asReadonly();
  readonly formDescription = this._formDescription.asReadonly();
  readonly dataLoaded = this._dataLoaded.asReadonly();

  // Computed
  readonly blockedTimeCount = computed(() => this._blockedTimes().length);

  // جلوگیری از ثبت/ویرایش برای تاریخ گذشته
  readonly isPastFormDate = computed(() => {
    const d = this._formDate();
    return !!d && this.isPastJalaliDate(d);
  });

  readonly canSave = computed(() => {
    const date = this._formDate();
    const start = this._formStartTime();
    const end = this._formEndTime();

    if (!date || !start || !end) return false;
    if (start >= end) return false;
    if (this.isPastJalaliDate(date)) return false; // اینجا قانون اصلی

    return true;
  });

  // Modal instance
  private blockedTimeModalInstance: Modal | null = null;

  constructor() {
    this.setupBreadcrumb();
    this.initializeCalendarOptions();
    this.setupEffects();
  }

  // =========================
  // Init
  // =========================

  private setupBreadcrumb(): void {
    this.breadcrumbService.setItems([{ label: 'تقویم', routerLink: '/calendar' }]);
  }

  private setupEffects(): void {
    effect(() => {
      const currentEvents = this._events();
      const calendarApi = this.calendarComponent()?.getApi();

      if (!calendarApi) return;

      calendarApi.removeAllEvents();
      (currentEvents || []).forEach(e => calendarApi.addEvent(e));
    });
  }

 
  private initializeCalendarOptions(): void {
    const baseOptions: CalendarOptions = {
      direction: 'rtl',
      selectable: true,
      initialView: 'dayGridMonth',
      plugins: [dayGridPlugin, interactionPlugin, timeGridPlugin],
      locales: [faLocale],
      locale: 'fa',
      timeZone: 'Asia/Tehran',
      events: [],
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      dayMaxEvents: true,
      eventDidMount: (info) => this.handleEventMount(info),
      dateClick: (info) => this.handleDateClick(info),
      eventClick: (info) => this.handleEventClick(info),
      // ✅ اضافه شد: هر بار بازه دید تقویم عوض بشه (تغییر ماه/هفته)، دوباره لود کن
      datesSet: (info) => {
        this._visibleStart.set(info.startStr.slice(0, 10));
        this._visibleEnd.set(info.endStr.slice(0, 10));
        if (this._currentUser()) {
          this.loadAllEvents();
        }
      }
    };

    this._calendarOptions.set(baseOptions);
  }
  async ngOnInit(): Promise<void> {
    await this.checkPermissions();
    if (this._isPermitted()) {
      this.loadCurrentUser();
    }
  }

  ngAfterViewInit(): void {
    this.initializeModal();
  }

  private initializeModal(): void {
    setTimeout(() => {
      const modalElement = document.getElementById('blockedTimeModal');
      if (modalElement) this.blockedTimeModalInstance = new Modal(modalElement);
    }, 50);
  }

  private async checkPermissions(): Promise<void> {
    try {
      const ok = await this.passwordFlowService.checkPermission('MT_Meetings_Search');
      this._isPermitted.set(ok);
      if (!ok) this.toastService.error('شما مجوز مشاهده این صفحه را ندارید');
    } catch (e) {
      console.error(e);
      this._isPermitted.set(false);
    }
  }

  private loadCurrentUser(): void {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    if (!userGuid) {
      console.warn('User GUID not found');
      return;
    }

    this.userService
      .getBy(userGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (userData: any) => {
          this._currentUser.set(userData);
          this.loadAllEvents();
        },
        error: (err) => {
          console.error(err);
          this.toastService.error('خطا در بارگذاری اطلاعات کاربر');
        }
      });
  }

  // =========================
  // Load Events
  // =========================

  private loadAllEvents(): void {
    this._isLoading.set(true);
    this._dataLoaded.set(false);

    this.loadCalendarMeetings();
    this.loadBlockedTimes();
  }

  private loadCalendarMeetings(): void {
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    const user = this._currentUser();
    // ✅ بازه‌ی زمانی واقعی نمایش داده‌شده در تقویم
    const start = this._visibleStart() || moment().startOf('month').format('YYYY-MM-DD');
    const end = this._visibleEnd() || moment().endOf('month').format('YYYY-MM-DD');
    if (!user || !positionGuid) {
      this._isLoading.set(false);
      this._dataLoaded.set(true);
      return;
    }

    this.meetingService
      .getCalendarMeetings(positionGuid, user.username, start, end)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          const meetings = response?.data || response || [];
          if (Array.isArray(meetings)) {
            const meetingEvents: CalendarEvent[] = meetings.map((m: any) => ({
              id: `meeting-${m.guid}`,
              title: m.title || 'جلسه',
              start: m.start,
              end: m.end,
              backgroundColor: '#f0bd05',
              borderColor: '#d4a505',
              textColor: '#000',
              url: `/#/meetings/details/${m.guid}`,
              extendedProps: { type: 'Meeting', guid: m.guid }
            }));
            this.mergeEvents(meetingEvents, 'Meeting');
          }
          this._isLoading.set(false);
          this._dataLoaded.set(true);
        },
        error: (err) => {
          console.error(err);
          this._isLoading.set(false);
          this._dataLoaded.set(true);
        }
      });
  }

  private loadBlockedTimes(): void {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    if (!userGuid) return;

    this.blockedTimeService
      .getForCalendar(userGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          const data = response || [];
          if (Array.isArray(data)) {
            this._blockedTimes.set(data);

            const blockedEvents: CalendarEvent[] = data.map((bt: BlockedTimeDto) => ({
              id: `blocked-${bt.guid}`,
              title: `🚫 ${bt.description || 'عدم حضور'}`,
              start: `${bt.date}T${bt.startTime}`,
              end: `${bt.date}T${bt.endTime}`,
              backgroundColor: '#dc3545',
              borderColor: '#bb2d3b',
              textColor: '#fff',
              extendedProps: {
                type: 'BlockedTime',
                guid: bt.guid,
                description: bt.description
              }
            }));

            this.mergeEvents(blockedEvents, 'BlockedTime');
          }
        },
        error: (err) => {
          console.error(err);
        }
      });
  }

  private mergeEvents(newEvents: CalendarEvent[], type: string): void {
    const current = this._events();
    const kept = current.filter(e => e.extendedProps?.type !== type);
    this._events.set([...kept, ...newEvents]);
  }

  // =========================
  // Event handlers
  // =========================

  private handleEventMount(info: any): void {
    const type = info.event.extendedProps['type'] as 'Meeting' | 'BlockedTime';

    if (type === 'BlockedTime') info.el.classList.add('event-blocked');
    if (type === 'Meeting') info.el.classList.add('event-meeting');

    new Tooltip(info.el, {
      title: info.event.title,
      placement: 'top',
      trigger: 'hover',
      container: 'body'
    });
  }

  private handleDateClick(info: any): void {
    const gregorianDate = info.dateStr; // YYYY-MM-DD

    // قانون: تاریخ‌های قبل از امروز ممنوع
    if (this.isPastGregorianDate(gregorianDate)) {
      this.toastService.error('امکان ثبت عدم حضور برای روزهای قبل از امروز وجود ندارد');
      return;
    }

    const jalaliDate = moment(gregorianDate, 'YYYY-MM-DD').format('jYYYY/jMM/jDD');
    this._selectedDate.set(jalaliDate);

    this.openBlockedTimeModal(gregorianDate);
  }

  private handleEventClick(info: any): void {
    const type = info.event.extendedProps['type'] as 'Meeting' | 'BlockedTime';
    const guid = info.event.extendedProps['guid'] as string | undefined;

    if (type === 'BlockedTime' && guid) {
      info.jsEvent.preventDefault();
      this.showBlockedTimeOptions(guid);
    }
    // Meeting: اجازه بده لینک کار کند
  }

  // =========================
  // Modal Management
  // =========================

  openBlockedTimeModal(date?: string): void {
    // اگر از جای دیگری صدا زده شد، باز هم تاریخ گذشته ممنوع
    if (date && this.isPastGregorianDate(date)) {
      this.toastService.error('امکان ثبت عدم حضور برای روزهای قبل از امروز وجود ندارد');
      return;
    }

    this._isEditMode.set(false);
    this._editingBlockedTime.set(null);

    const baseGregorian = date ? date : moment().format('YYYY-MM-DD');
    const jalaliDate = moment(baseGregorian, 'YYYY-MM-DD').format('jYYYY/jMM/jDD');

    this._formDate.set(jalaliDate);
    this._formStartTime.set('08:00');
    this._formEndTime.set('17:00');
    this._formDescription.set('');

    this.blockedTimeModalInstance?.show();
  }

  openEditBlockedTimeModal(blockedTime: BlockedTimeDto): void {
    // ویرایش برای تاریخ‌های گذشته ممنوع
    if (this.isPastGregorianDate(blockedTime.date)) {
      this.toastService.error('ویرایش عدم حضور برای روزهای گذشته مجاز نیست');
      return;
    }

    this._isEditMode.set(true);
    this._editingBlockedTime.set(blockedTime);

    const jalaliDate = moment(blockedTime.date, 'YYYY-MM-DD').format('jYYYY/jMM/jDD');
    this._formDate.set(jalaliDate);
    this._formStartTime.set(blockedTime.startTime);
    this._formEndTime.set(blockedTime.endTime);
    this._formDescription.set(blockedTime.description || '');

    this.blockedTimeModalInstance?.show();
  }

  closeBlockedTimeModal(): void {
    this.blockedTimeModalInstance?.hide();
    this.resetForm();
  }

  private resetForm(): void {
    this._formDate.set('');
    this._formStartTime.set('08:00');
    this._formEndTime.set('17:00');
    this._formDescription.set('');
    this._isEditMode.set(false);
    this._editingBlockedTime.set(null);
    this._isSaving.set(false);
  }

  // =========================
  // Form update
  // =========================

  updateFormDate(value: string): void {
    this._formDate.set(value);

    if (value && this.isPastJalaliDate(value)) {
      this._formDate.set('');
      this.toastService.error('امکان ثبت عدم حضور برای روزهای قبل از امروز وجود ندارد');
    }
  }

  updateFormStartTime(value: string): void {
    this._formStartTime.set(value);
  }

  updateFormEndTime(value: string): void {
    this._formEndTime.set(value);
  }

  updateFormDescription(value: string): void {
    this._formDescription.set(value);
  }

  // =========================
  // Save/Delete
  // =========================

  saveBlockedTime(): void {
    const dateJ = this._formDate();
    const startTime = this._formStartTime();
    const endTime = this._formEndTime();
    const description = this._formDescription();
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);

    if (!dateJ || !startTime || !endTime) {
      this.toastService.error('لطفاً تمام فیلدهای الزامی را پر کنید');
      return;
    }

    if (startTime >= endTime) {
      this.toastService.error('ساعت شروع باید قبل از ساعت پایان باشد');
      return;
    }

    if (!userGuid) {
      this.toastService.error('خطا در شناسایی کاربر');
      return;
    }

    // قانون: تاریخ‌های قبل از امروز ممنوع
    const fixedJalali = this.fixPersianDigits(dateJ);
    const gregorianDate = moment(fixedJalali, 'jYYYY/jMM/jDD', true).format('YYYY-MM-DD');

    if (!gregorianDate || gregorianDate === 'Invalid date') {
      this.toastService.error('تاریخ وارد شده معتبر نیست');
      return;
    }

    if (this.isPastGregorianDate(gregorianDate)) {
      this.toastService.error('امکان ثبت/ویرایش عدم حضور برای روزهای قبل از امروز وجود ندارد');
      return;
    }

    this._isSaving.set(true);

    if (this._isEditMode()) {
      const editing = this._editingBlockedTime();
      if (!editing) {
        this.toastService.error('رکورد برای ویرایش یافت نشد');
        this._isSaving.set(false);
        return;
      }

      const updateDto: UpdateBlockedTimeDto = {
        guid: editing.guid,
        date: gregorianDate,
        userGuid,
        startTime,
        endTime,
        description: description || undefined
      };

      this.blockedTimeService
        .updateBlockedTime(updateDto)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.toastService.success('ویرایش با موفقیت انجام شد');
            this.closeBlockedTimeModal();
            this.loadBlockedTimes();
            this._isSaving.set(false);
          },
          error: (err) => {
            console.error(err);
            this.toastService.error('خطا در ویرایش زمان عدم حضور');
            this._isSaving.set(false);
          }
        });
    } else {
      const createDto: CreateBlockedTimeDto = {
        date: gregorianDate,
        startTime,
        endTime,
        userGuid,
        description: description || undefined
      };

      this.blockedTimeService
        .createBlockedTime(createDto)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.toastService.success('ثبت با موفقیت انجام شد');
            this.closeBlockedTimeModal();
            this.loadBlockedTimes();
            this._isSaving.set(false);
          },
          error: (err) => {
            console.error(err);
            this.toastService.error('خطا در ثبت زمان عدم حضور');
            this._isSaving.set(false);
          }
        });
    }
  }

  private async showBlockedTimeOptions(guid: string): Promise<void> {
    const blockedTime = this._blockedTimes().find(bt => bt.guid === guid);
    if (!blockedTime) return;

    const jalaliDate = moment(blockedTime.date, 'YYYY-MM-DD').format('jYYYY/jMM/jDD');
    const isPast = this.isPastGregorianDate(blockedTime.date);

    const result = await Swal.fire({
      title: 'زمان عدم حضور',
      html: `
        <div class="text-start" dir="rtl">
          <p><strong>تاریخ:</strong> ${jalaliDate}</p>
          <p><strong>از ساعت:</strong> ${blockedTime.startTime}</p>
          <p><strong>تا ساعت:</strong> ${blockedTime.endTime}</p>
          ${blockedTime.description ? `<p><strong>توضیحات:</strong> ${blockedTime.description}</p>` : ''}
          ${isPast ? `<p style="margin-top:8px;color:#dc3545"><strong>توجه:</strong> این مورد مربوط به روزهای گذشته است و قابل ویرایش نیست.</p>` : ''}
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: '<i class="fas fa-edit"></i> ویرایش',
      denyButtonText: '<i class="fas fa-trash"></i> حذف',
      cancelButtonText: 'بستن',
      confirmButtonColor: '#f0bd05',
      denyButtonColor: '#dc3545'
    });

    if (result.isConfirmed) {
      if (isPast) {
        this.toastService.error('ویرایش عدم حضور برای روزهای گذشته مجاز نیست');
        return;
      }
      this.openEditBlockedTimeModal(blockedTime);
    } else if (result.isDenied) {
      this.confirmDeleteBlockedTime(guid);
    }
  }

  async confirmDeleteBlockedTime(guid: string): Promise<void> {
    const confirm = await Swal.fire({
      title: 'آیا مطمئن هستید؟',
      text: 'این زمان عدم حضور حذف خواهد شد',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف کن',
      cancelButtonText: 'انصراف',
      confirmButtonColor: '#dc3545'
    });

    if (confirm.isConfirmed) {
      this.deleteBlockedTime(guid);
    }
  }

  deleteBlockedTime(guid: string): void {
    this.blockedTimeService
      .deleteBlockedTime(guid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.success('زمان عدم حضور با موفقیت حذف شد');
          this.loadBlockedTimes();
        },
        error: (err) => {
          console.error(err);
          this.toastService.error('خطا در حذف زمان عدم حضور');
        }
      });
  }

  // =========================
  // Search/Helpers
  // =========================

  fixPersianDigits(input: string): string {
    return (input || '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  }

  highlightDate(date: string): void {
    if (!date) return;

    const fixedDate = this.fixPersianDigits(date);
    const georgianDate = moment(fixedDate, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');

    const calendarApi = this.calendarComponent()?.getApi();
    if (calendarApi) {
      calendarApi.gotoDate(georgianDate);
    }
  }

  refreshCalendar(): void {
    if (this._isPermitted() && this._currentUser()) {
      this.loadAllEvents();
    }
  }

  formatDateToJalali(date: string): string {
    if (!date) return '';
    return moment(date, 'YYYY-MM-DD').format('jYYYY/jMM/jDD');
  }

  // ====== تاریخ‌های گذشته (public برای HTML) ======

  isPastBlockedDate(date: string): boolean {
    return this.isPastGregorianDate(date);
  }

  // ====== Private date guards ======

  private todayStart(): moment.Moment {
    return moment().startOf('day');
  }

  private isPastGregorianDate(dateStr: string): boolean {
    const m = moment(dateStr, 'YYYY-MM-DD', true);
    if (!m.isValid()) return false;
    return m.startOf('day').isBefore(this.todayStart());
  }

  private isPastJalaliDate(jalaliDate: string): boolean {
    const fixed = this.fixPersianDigits(jalaliDate || '');
    const m = moment(fixed, 'jYYYY/jMM/jDD', true);
    if (!m.isValid()) return false;
    return m.startOf('day').isBefore(this.todayStart());
  }
}


