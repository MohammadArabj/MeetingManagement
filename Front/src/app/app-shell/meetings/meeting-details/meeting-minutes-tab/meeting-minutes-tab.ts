import { HelpButtonComponent } from '../../../../shared/help-button/help-button.component';
import { readIsMeetingAdmin } from '../../../../core/auth/session.store';
// meeting-minutes-tab.component.ts

import {
  Component,
  ElementRef,
  NgZone,
  ViewChild,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  input,
  output,
  DestroyRef
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Modal } from 'bootstrap';
import { ActivatedRoute } from '@angular/router';
import { MeetingDetails, MeetingMember } from '../../../../core/models/Meeting';
import { MeetingService } from '../../../../services/meeting.service';
import { CommonModule } from '@angular/common';
import { LocalStorageService } from '../../../../services/framework-services/local.storage.service';
import { Main_USER_ID, USER_ID_NAME, IsDeletage } from '../../../../core/types/configuration';
import { Resolution } from '../../../../core/models/Resolution';
import { MeetingMemberService } from '../../../../services/meeting-member.service';
import { FileMeetingService } from '../../../../services/file-meeting.service';
import { FileService } from '../../../../services/file.service';
import { CustomInputComponent } from "../../../../shared/custom-controls/custom-input";
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';
import { PasswordFlowService } from '../../../../services/framework-services/password-flow.service';
import { UserService } from '../../../../services/user.service';
import { MeetingBehaviorService } from '../meeting-behavior-service';
import { FileItem } from '../../../../core/models/file';

// ✅ جایگزینی import
import { TusUploadService } from '../../../../services/framework-services/tus-upload.service';
import { ToastService } from '../../../../services/framework-services/toast.service';
import { FileManagerModalComponent } from '../../../../shared/file-manager/file-manger-modal.component';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';
import { PrintService } from '../../../../core/print/print.service';
import { signatureImageUrl } from '../../../../core/media/media-token';
import { toRichHtml } from '../../../../core/rich-text/rich-text';
import { RichTextViewComponent } from '../../../../shared/rich-text-editor/rich-text-view.component';

declare var $: any;
declare var Swal: any;

interface FormattedAssignment {
  followerName: string;
  actionerNames: string;
  dueDate: string;
  type: string;
}

@Component({
  selector: 'app-meeting-minutes-tab',
  standalone: true,
  imports: [RichTextViewComponent, HelpButtonComponent, 
    CommonModule,
    CustomInputComponent,
    ReactiveFormsModule,
    FileManagerModalComponent  // ✅ جایگزین FileUploaderComponent
  ],
  templateUrl: './meeting-minutes-tab.html',
  styleUrl: './meeting-minutes-tab.css'
})
export class MeetingMinutesTabComponent implements OnInit, OnDestroy {
  // Injected services
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly meetingService = inject(MeetingService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly fileMeetingService = inject(FileMeetingService);
  private readonly fileService = inject(FileService);
  private readonly memberService = inject(MeetingMemberService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly route = inject(ActivatedRoute);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly userService = inject(UserService);
  private readonly toastService = inject(ToastService);
  private readonly printService = inject(PrintService);

  // Inputs
  readonly meetingGuid = input<string>('');
  readonly canEdit = input<boolean>(false);
  readonly canDelete = input<boolean>(false);

  // Outputs
  readonly meetingUpdated = output<MeetingDetails>();
  readonly memberUpdated = output<MeetingMember>();
  readonly fileUploaded = output<string[]>();  // ✅ تغییر تایپ به string[] (GUIDs)
  readonly signatureCompleted = output<{ memberId: number; isSign: boolean; comment: string | null }>();

  // ViewChild references
  @ViewChild('signModal') signModal!: ElementRef;
  @ViewChild('fileManagerModal') fileManagerModal!: FileManagerModalComponent;  // ✅ اضافه شد

  // Signals for component state
  private readonly _signForm = signal<FormGroup>(this.createSignForm());
  private readonly _signatureImage = signal<string>('');
  private readonly _mainUser = signal<string>('');

  // ✅ سیگنال‌های جدید برای مدیریت فایل
  private readonly _existingFileGuids = signal<string[]>([]);
  private readonly _isLoadingFiles = signal<boolean>(false);

  // Readonly signals for template access
  readonly signForm = this._signForm.asReadonly();
  readonly signatureImage = this._signatureImage.asReadonly();
  readonly mainUser = this._mainUser.asReadonly();
  readonly existingFileGuids = this._existingFileGuids.asReadonly();
  readonly isLoadingFiles = this._isLoadingFiles.asReadonly();

  // Computed signals from behavior service
  readonly meeting = this.meetingBehaviorService.meeting;
  readonly members = this.meetingBehaviorService.members;
  readonly currentMember = this.meetingBehaviorService.currentMember;
  readonly resolutions = this.meetingBehaviorService.resolutions;

  // Local computed signals
  readonly meetingId = computed(() => this.meeting()?.id);

  // ✅ تعداد فایل‌ها از سیگنال جدید
  readonly fileCount = computed(() => this._existingFileGuids().length);

  readonly formattedAssignments = computed<FormattedAssignment[][]>(() => {
    const resolutionsList = this.resolutions();
    if (!resolutionsList) return [];

    return resolutionsList.map((res: Resolution) => {
      const assignments = res.assignments || [];

      if (assignments.length === 0) {
        return [];
      }

      const groups = new Map<string, { actionerNames: Set<string>; followerName: string; dueDate: string; type: string }>();

      assignments.forEach(a => {
        const type = a.type || '';
        const followerName = a.followerName || '';
        const dueDate = a.dueDate || '';
        const actorName = a.actorName || '';

        const key = `${type}__${followerName}__${dueDate}`;

        if (!groups.has(key)) {
          groups.set(key, {
            actionerNames: new Set(actorName ? [actorName] : []),
            followerName,
            dueDate,
            type
          });
        } else if (actorName) {
          groups.get(key)!.actionerNames.add(actorName);
        }
      });

      return Array.from(groups.values()).map(g => ({
        actionerNames: Array.from(g.actionerNames).join('<br/> '),
        followerName: g.followerName,
        dueDate: g.dueDate,
        type: g.type
      }));
    });
  });
  readonly guestTitles = computed(() => {
    const rolePriority: { [key: number]: number } = {
      6: 1, 3: 2, 1: 3, 2: 4, 4: 5, 5: 6
    };

    return [...this.members()]   // کپی برای جلوگیری از mutation
      .sort((a, b) => (rolePriority[a.roleId ?? 999] ?? 999) - (rolePriority[b.roleId ?? 999] ?? 999))
      .filter(m => m.isExternal || MeetingRoles.isGuest(m.roleId))
      .map(m => m.name)
      .join(', ');
  });

  readonly internalTitles = computed(() =>
    this.members().filter(m => MeetingRoles.countsAsMember(m.roleId)).map(m => m.name).join(', ')
  );

  readonly absentedTitles = computed(() =>
    this.members().filter(m => !m.isPresent && MeetingRoles.countsAsMember(m.roleId)).map(m => m.name).join(', ')
  );

  readonly memberDescriptions = computed(() =>
    this.members()
      .filter(m => m.comment)
      .map(m => ({ name: m.name, comment: m.comment || '' }))
  );

  /** امضاهای ثبت‌شده؛ امضای رئیس جلسه همیشه اول (سایرین پس از او امضا می‌کنند) */
  readonly signedMembers = computed(() => {
    const isDelegate = this.localStorageService.getItem(IsDeletage) === 'true';

    return this.members()
      .filter(m => m.isSign)
      .sort((a, b) => Number(MeetingRoles.isChairman(b.roleId)) - Number(MeetingRoles.isChairman(a.roleId)))
      .map(m => {
        let name = m.name;
        let signatureUrl = m.signatureUrl;

        if (isDelegate && m.signer && m.signer !== m.userGuid) {
          name = 'از طرف ' + m.signerName;
          signatureUrl = m.signerSignatureUrl;
        }

        return {
          name,
          role: m.role ?? '',
          signature: signatureImageUrl(signatureUrl),
        };
      });
  });

  // Permission computed signals
  readonly isDelegate = computed(() =>
    this.localStorageService.getItem(IsDeletage) === 'true'
  );

  readonly isSuperAdmin = computed(() =>
    readIsMeetingAdmin()
  );

  // ✅ دسترسی آپلود فایل
  readonly canUploadFile = computed(() => {
    const member = this.currentMember();
    return !member?.isDelegate &&
      (MeetingRoles.can(member?.roleId, 'WriteMinutes') || this.isSuperAdmin());
  });

  // ✅ دسترسی حذف فایل
  readonly canDeleteFile = computed(() => {
    const member = this.currentMember();
    return !member?.isDelegate &&
      (MeetingRoles.can(member?.roleId, 'WriteMinutes') || this.isSuperAdmin());
  });

  /** رئیس جلسه امضا کرده است؟ (امضای معتبر صورتجلسه = امضای رئیس؛ امضای دبیر غیرعضو اهمیتی ندارد) */
  readonly chairmanSigned = computed(() =>
    this.members().some(m => MeetingRoles.isChairman(m.roleId) && m.isSign === true)
  );

  readonly isCurrentChairman = computed(() => MeetingRoles.isChairman(this.currentMember()?.roleId));

  /** نظر/امضا فقط در وضعیت «ثبت نهایی»، برای عضو حاضر و (در حالت تفویض) با مجوز */
  private readonly minutesOpenForMe = computed(() => {
    const meetingData = this.meeting();
    const member = this.currentMember();
    if (!meetingData || !member || meetingData.statusId !== 4) return false;
    if (member.isDelegate) return false;
    if (this.isDelegate() && !this.hasPermission('MT_Meetings_CommentAndSign')) return false;
    return true;
  });

  readonly canComment = computed(() =>
    this.minutesOpenForMe() && MeetingRoles.can(this.currentMember()?.roleId, 'CommentOnMinutes')
  );

  /** امضای جدید: رئیس هر زمان؛ سایرین فقط پس از امضای رئیس */
  readonly canSignNow = computed(() => {
    const member = this.currentMember();
    return this.minutesOpenForMe()
      && !member?.isSign
      && MeetingRoles.can(member?.roleId, 'SignMinutes')
      && (this.isCurrentChairman() || this.chairmanSigned());
  });

  /** برداشتن امضا: امضای رئیس قطعی است */
  readonly canUnsign = computed(() =>
    this.minutesOpenForMe() && this.currentMember()?.isSign === true && !this.isCurrentChairman()
  );

  /** دکمه «امضا و ثبت نظر» */
  readonly canSign = computed(() => this.canComment() || this.canSignNow() || this.canUnsign());

  /** در فرم امضا، کلیک روی کادر امضا مجاز است؟ */
  canToggleSign(): boolean {
    return this.signForm().get('sign')?.value ? this.canUnsign() || this.canSignNow() : this.canSignNow();
  }

  readonly waitingForChairman = computed(() =>
    this.minutesOpenForMe() && !this.isCurrentChairman() && !this.chairmanSigned()
    && MeetingRoles.can(this.currentMember()?.roleId, 'SignMinutes')
  );

  readonly canPrintFinal = computed(() =>
    [4, 6].includes(this.meeting()?.statusId) && this.chairmanSigned()
  );

  readonly canPrintDraft = computed(() => !this.canPrintFinal());

  readonly canAccessFiles = computed(() => {
    if (this.isDelegate()) {
      return this.hasPermission('MT_Meetings_ViewFiles');
    }
    return true;
  });

  readonly siteUrl = computed(() => environment.selfEndpoint);

  // ✅ مسیر فولدر برای آپلود فایل‌های جلسه
  readonly uploadFolderPath = computed(() => {
    const meeting = this.meeting();
    if (!meeting) return 'Meetings/Files';
    return `Meeting${meeting.number}/Files`;
  });

  constructor() {
    this.setupEffects();
  }

  ngOnInit(): void {
    this.subscribeToRouteParams();
    this.loadMeetingDetails();
  }

  ngOnDestroy(): void {
    // cleanup if needed
  }

  // Effects setup
  private setupEffects(): void {
    effect(() => {
      const member = this.currentMember();
      if (member) {
        this.handleSignatureImage(member);
      }
    });

    // ✅ لود فایل‌ها وقتی meeting تغییر می‌کند
    effect(() => {
      const meetingIdValue = this.meetingId();
      if (meetingIdValue) {
        this.loadAttachments();
      }
    });

    effect(() => {
      const guid = this.meetingGuid();
      if (guid) {
        this.loadMeetingDetails();
      }
    });
  }

  // Form creation
  private createSignForm(): FormGroup {
    return this.fb.group({
      memberId: [null],
      comment: [''],
      sign: [false]
    });
  }

  // Route subscription
  private subscribeToRouteParams(): void {
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      const guid = params.get('guid') || this.meetingGuid();
      if (guid) {
        this.loadMeetingDetails();
      }
    });
  }

  // Signature image handling
  private handleSignatureImage(member: MeetingMember): void {
    if (this.isDelegate()) {
      const userGuid = this.localStorageService.getItem(Main_USER_ID);
      if (userGuid) {
        this.userService.getUserInformation(userGuid).pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe(user => {
          this._mainUser.set(user.fullname);
        });
      }
    }
    // ردیف خود کاربر (در تفویض: ردیف شخص اصلی) آدرس موقت امضا را از سرور دارد
    this._signatureImage.set(signatureImageUrl(member.signatureUrl));
  }

  // Permission check method
  hasPermission(permission: string): boolean {
    return this.passwordFlowService.hasPermission(permission);
  }

  // Data loading methods
  loadMeetingDetails(): void {
    if (this.meeting()) {
      this.loadAttachments();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ لود فایل‌های موجود - اصلاح شده
  // ═══════════════════════════════════════════════════════════

  private loadAttachments(): void {
    const meetingIdValue = this.meetingId();
    if (!meetingIdValue) return;

    this._isLoadingFiles.set(true);

    this.fileMeetingService.getFiles(meetingIdValue).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (files: any) => {
        // ✅ استخراج GUIDs از فایل‌ها
        const guids = (files || [])
          .map((f: any) => f.fileGuid || f.guid)
          .filter((guid: string) => guid && guid !== '00000000-0000-0000-0000-000000000000');

        this._existingFileGuids.set(guids);
        this._isLoadingFiles.set(false);
      },
      error: (error) => {
        console.error('Error loading attachments:', error);
        this._existingFileGuids.set([]);
        this._isLoadingFiles.set(false);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ باز کردن مودال مدیریت فایل
  // ═══════════════════════════════════════════════════════════

  openFileManagerModal(): void {
    if (!this.canAccessFiles()) {
      this.toastService.warning('شما دسترسی به فایل‌ها ندارید');
      return;
    }

    // ✅ باز کردن مودال با فایل‌های موجود
    this.fileManagerModal.open(this._existingFileGuids());
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ هندل کردن تأیید مودال - ذخیره فایل‌های جدید
  // ═══════════════════════════════════════════════════════════

  onFilesConfirmed(guids: string[]): void {
    const meetingGuid = this.meetingGuid() || this.route.snapshot.params['guid'];
    if (!meetingGuid) {
      this.toastService.error('شناسه جلسه یافت نشد');
      return;
    }

    // ✅ پیدا کردن فایل‌های جدید (که قبلاً نبودند)
    const existingGuids = new Set(this._existingFileGuids().map(g => g.toLowerCase()));
    const newGuids = guids.filter(g => !existingGuids.has(g.toLowerCase()));

    // ✅ پیدا کردن فایل‌های حذف شده
    const currentGuids = new Set(guids.map(g => g.toLowerCase()));
    const deletedGuids = this._existingFileGuids().filter(g => !currentGuids.has(g.toLowerCase()));

    // ✅ ذخیره فایل‌های جدید در دیتابیس جلسه
    if (newGuids.length > 0) {
      this.saveNewFilesToMeeting(meetingGuid, newGuids);
    }

    // ✅ حذف فایل‌های حذف شده از دیتابیس جلسه
    if (deletedGuids.length > 0) {
      this.deleteFilesFromMeeting(deletedGuids);
    }

    // ✅ آپدیت لیست فایل‌ها
    this._existingFileGuids.set(guids);

    // ✅ emit کردن event
    this.fileUploaded.emit(guids);
  }

  // ✅ ذخیره فایل‌های جدید در جلسه
  private saveNewFilesToMeeting(meetingGuid: string, fileGuids: string[]): void {
    // ارسال به API برای ثبت در دیتابیس جلسه
    const payload = {
      meetingGuid: meetingGuid,
      files: fileGuids
    };

    this.meetingService.saveFiles(payload).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
      },
      error: (error) => {
        console.error('Error saving files to meeting:', error);
        this.toastService.error('خطا در ذخیره فایل‌ها');
      }
    });
  }

  // ✅ حذف فایل‌ها از جلسه
  private deleteFilesFromMeeting(fileGuids: string[]): void {
    fileGuids.forEach(guid => {
      this.fileService.delete(guid).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        error: (error) => {
          console.error('Error deleting file from meeting:', error);
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ هندل کردن لغو مودال
  // ═══════════════════════════════════════════════════════════

  onFilesCancelled(): void {
    // در صورت نیاز می‌توان کارهای اضافی انجام داد
    console.log('File manager cancelled');
  }

  // Form handling methods
  toggleSign(): void {
    if (!this.canToggleSign()) return;
    const form = this._signForm();
    const currentValue = form.get('sign')?.value;
    form.get('sign')?.setValue(!currentValue);
  }

  saveComment(): void {
    const form = this._signForm();
    if (!form.valid) return;

    const formValue = form.value;
    const userGuid = this.localStorageService.getItem(Main_USER_ID);

    const payload = {
      memberId: formValue.memberId,
      isSign: !!formValue.sign,
      // بدون توانایی «نظر»، متن نظر ارسال نمی‌شود (null = بدون تغییر)
      comment: this.canComment() ? (formValue.comment ?? '') : null,
      signer: userGuid
    };

    this.memberService.setComment(payload).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.updateMembersAfterComment(payload);
      this.hideModal(this.signModal);
      this.signatureCompleted.emit(payload);
    });
  }

  private updateMembersAfterComment(payload: any): void {
    const members = this.meetingBehaviorService.getMembersValue();
    const memberIndex = members.findIndex(member => member.id === payload.memberId);

    if (memberIndex !== -1) {
      const updatedMembers = [...members];
      updatedMembers[memberIndex] = {
        ...updatedMembers[memberIndex],
        isSign: payload.isSign,
        comment: payload.comment ?? updatedMembers[memberIndex].comment
      };

      this.meetingBehaviorService.updateMembers(updatedMembers);
      this.memberUpdated.emit(updatedMembers[memberIndex]);
    }
  }

  // Modal handling methods
  showModal(modalRef: ElementRef): void {
    if (!modalRef?.nativeElement) {
      console.error("Modal reference is invalid", modalRef);
      return;
    }

    const modalInstance = Modal.getInstance(modalRef.nativeElement) ||
      new Modal(modalRef.nativeElement);

    modalInstance.show();
  }

  private hideModal(modalRef: ElementRef): void {
    if (!modalRef?.nativeElement) return;

    const modalInstance = Modal.getInstance(modalRef.nativeElement);
    if (modalInstance) {
      modalInstance.hide();
    }
  }

  showSignModal(): void {
    const member = this.currentMember();
    if (!member?.isPresent) {
      Swal.fire({
        title: "خطا",
        text: "حضور شما در جلسه ثبت نشده است و امکان امضای جلسه را ندارید.",
        icon: "error",
        confirmButtonText: "باشه",
      });
      return;
    }

    this.populateSignForm();
    this.showModal(this.signModal);
  }

  private populateSignForm(): void {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    const member = this.members().find(c => c.userGuid === userGuid);

    if (member) {
      const form = this._signForm();
      form.patchValue({
        memberId: member.id,
        comment: member.comment,
        sign: member.isSign
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // چاپ صورتجلسه (قالب «minutes» از «تنظیمات › چاپ و قالب‌ها»)
  // ═══════════════════════════════════════════════════════════
  printMeeting(): void {
    this.printMinutes(false);
  }

  printDraftMeeting(): void {
    this.printMinutes(true);
  }

  private printMinutes(isDraft: boolean): void {
    const meeting = this.meeting();
    if (!meeting) return;

    // پنجره همزمان با کلیک باز می‌شود تا مسدودکننده‌ی پاپ‌آپ جلوی آن را نگیرد
    const target = this.printService.openWindow();
    if (!target) {
      this.toastService.error('پنجره‌ی چاپ باز نشد؛ لطفاً اجازه‌ی باز شدن پنجره‌ی جدید (Pop-up) را بدهید.');
      return;
    }

    const title = `${isDraft ? 'پیش‌نویس صورتجلسه' : 'صورتجلسه'} - ${meeting.title ?? ''}`;
    this.printService
      .print('minutes', this.buildMinutesData(meeting, isDraft), {
        title,
        target,
        watermark: isDraft ? 'پیش‌نویس' : undefined,
      })
      .catch((e: any) => this.toastService.error(e?.message || 'خطا در آماده‌سازی چاپ'));
  }

  private buildMinutesData(meeting: any, isDraft: boolean): Record<string, unknown> {
    const members = this.members();
    const groups = this.formattedAssignments();

    return {
      isDraft,
      meeting: {
        title: meeting.title ?? '',
        number: meeting.number ?? '',
        date: meeting.mtDate ?? '',
        startTime: meeting.startTime ?? '',
        endTime: meeting.endTime ?? '',
        location: meeting.location ?? '',
        category: meeting.categoryTitle ?? '',
        chairman: meeting.chairman ?? '',
        secretary: meeting.secretary ?? '',
      },
      agendas: (meeting.agendas ?? []).map((a: any) => ({ text: a.text ?? a.title ?? '' })),
      attachmentsCount: this.fileCount(),
      members: members
        .filter(m => MeetingRoles.countsAsMember(m.roleId) || MeetingRoles.isNonMemberSecretary(m.roleId))
        .map(m => ({ name: m.name, role: m.role ?? '', isPresent: m.isPresent === true, substitute: m.substitute ?? '' })),
      guests: members
        .filter(m => m.isExternal || MeetingRoles.isGuest(m.roleId))
        .map(m => ({ name: m.name, organization: m.organization ?? '' })),
      description: toRichHtml(meeting.description),
      rider: toRichHtml(meeting.rider),
      resolutions: (this.resolutions() ?? []).map((r: Resolution, i: number) => ({
        number: i + 1,
        text: toRichHtml(r.text || (r as any).description || ''),
        assignments: (groups[i] ?? []).map(g => ({
          actor: g.actionerNames.split('<br/> ').join('، '),
          type: g.type,
          follower: g.followerName,
          dueDate: g.dueDate,
        })),
      })),
      comments: this.memberDescriptions(),
      // پیش‌نویس امضا ندارد؛ در نسخه‌ی نهایی فقط امضاهای ثبت‌شده (رئیس اول) چاپ می‌شوند
      signers: isDraft ? [] : this.signedMembers().map(s => ({ name: s.name, role: s.role, signatureUrl: s.signature })),
    };
  }

  updateSignFormValue(field: string, value: any): void {
    const form = this._signForm();
    form.get(field)?.setValue(value);
  }

  getSignFormValue(field: string): any {
    const form = this._signForm();
    return form.get(field)?.value;
  }

  // Reactive helpers for template
  trackByMemberGuid(index: number, member: MeetingMember): string {
    return member.userGuid ?? '';
  }

  trackByResolutionId(index: number, resolution: Resolution): number {
    return resolution.id;
  }
}
