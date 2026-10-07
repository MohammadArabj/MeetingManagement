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
import { Main_USER_ID, USER_ID_NAME, IsDeletage, ISSP } from '../../../../core/types/configuration';
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
  imports: [
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
  private readonly toastService = inject(ToastService);          // ✅ اضافه شد

  // Inputs
  readonly meetingGuid = input<string>('');
  readonly canEdit = input<boolean>(false);
  readonly canDelete = input<boolean>(false);

  // Outputs
  readonly meetingUpdated = output<MeetingDetails>();
  readonly memberUpdated = output<MeetingMember>();
  readonly fileUploaded = output<string[]>();  // ✅ تغییر تایپ به string[] (GUIDs)
  readonly signatureCompleted = output<{ memberId: number; isSign: boolean; comment: string }>();

  // ViewChild references
  @ViewChild('signModal') signModal!: ElementRef;
  @ViewChild('printSection') printSection!: ElementRef;
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

  readonly signedMembers = computed(() => {
    const isDelegate = this.localStorageService.getItem(IsDeletage) === 'true';

    return this.members().filter(m => m.isSign).map(m => {
      let name = m.name;
      let userName = m.userName;

      if (isDelegate && m.signer !== m.userGuid) {
        name = 'از طرف ' + m.signerName;
        userName = m.signerUserName ?? '';
      }

      return {
        name: name,
        signature: `${environment.fileManagementEndpoint}/EpcSignature/${userName}.jpg`
      };
    });
  });

  // Permission computed signals
  readonly isDelegate = computed(() =>
    this.localStorageService.getItem(IsDeletage) === 'true'
  );

  readonly isSuperAdmin = computed(() =>
    this.localStorageService.getItem(ISSP) === 'true'
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

  readonly canSign = computed(() => {
    const meetingData = this.meeting();
    const member = this.currentMember();

    if (!meetingData || !member) return false;

    const isStatusValid = meetingData.statusId === 4;
    const isNotDelegate = !member.isDelegate;
    const isNotSigned = !member.isSign;

    const chairmanMember = this.members().find(m => MeetingRoles.isChairman(m.roleId)&&m.isPresent==true);
    const hasChairmanSigned = chairmanMember?.isSign ?? false;
    const isCurrentUserChairman = MeetingRoles.isChairman(member.roleId);
    const canSignBasedOnChairman = isCurrentUserChairman || hasChairmanSigned;

    if (this.isDelegate()) {
      return isStatusValid && isNotDelegate &&
        this.hasPermission('MT_Meetings_CommentAndSign') &&
        isNotSigned &&
        canSignBasedOnChairman;
    }

    return isStatusValid &&
      isNotSigned &&
      canSignBasedOnChairman;
  });

  readonly canPrintFinal = computed(() => {
    const meetingData = this.meeting();
    if (![4, 6].includes(meetingData?.statusId)) return false;

    return this.members().some(member => MeetingRoles.isChairman(member.roleId) && member.isSign);
  });

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
          this._signatureImage.set(
            `${environment.fileManagementEndpoint}/EpcSignature/${user.userName}.jpg`
          );
        });
      }
    } else {
      this._signatureImage.set(
        `${environment.fileManagementEndpoint}/EpcSignature/${member.userName}.jpg`
      );
    }
  }

  // Permission check method
  hasPermission(permission: string): boolean {
    const permissions = this.passwordFlowService.getPermissions();
    return permissions?.includes(permission) || false;
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
      isSign: formValue.sign,
      comment: formValue.comment,
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
        comment: payload.comment
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

  // Print methods
  printMeeting(): void {
    const printContent = document.getElementById("meeting-Minute")?.innerHTML;
    if (!printContent) return;

    this.openPrintWindow(printContent, "چاپ صورتجلسه", this.getFinalPrintStyles());
  }

  printDraftMeeting(): void {
    const printContent = this.printSection?.nativeElement?.innerHTML;
    if (!printContent) return;

    this.openPrintWindow(printContent, "چاپ پیش نویس صورتجلسه", this.getDraftPrintStyles());
  }

  private openPrintWindow(content: string, title: string, styles: string): void {
    const newWin = window.open("", "_blank", "width=900,height=700");
    if (!newWin) return;

    newWin.document.open();
    newWin.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>${styles}</style>
          <link rel="stylesheet" href="${this.siteUrl()}/css/custom.css" />
        </head>
        <body>
          ${content}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 100);
            };
          </script>
        </body>
      </html>
    `);
   // newWin.document.close();
  }

  private getFinalPrintStyles(): string {
    return `
      body {
    direction: rtl;
    background-color: #f8f9fa;
    padding: 0;
}

.containter {
    max-width: 26cm;
    margin: 0 auto;
    background-color: #fff;
    padding: 20px;
    border-radius: 15px;
}

header {
    display: flex;
}

header .right-side {
    width: 85%;
    margin-left: 5px;
}

.name-of-god {
    text-align: center;
    margin-right: 25px;
    font-size: 18px;
}

.meeting-title {
    border: 2px solid #6d8dab;
    padding: 10px;
    margin-top: 5px;
    border-radius: 20px;
    height: 50px;
    font-weight: 700 !important;
    font-size: 17px;
    background: linear-gradient(to left, #e1d4cd, #f7ddd0, #e0e9f3);
}

.main {
    margin-top: 10px;
}

.metting-information table {
    border-collapse: collapse;
    min-height: 300px;
}

table {
    border-collapse: collapse;
}

.metting-information th {
    width: 10%;
    border: 1px solid black;
    border-top: 1px solid white;
    padding: 5px;
    font-size: 15px;
    font-weight: 800;
}

th:first-child {
    border-right: none !important;
    border-top: none !important
}

th:last-child {
    border-left: none !important;
    border-top: none !important
}

td:first-child {
    border-right: none !important;
}

td:last-child {
    border-left: none !important;
}

.metting-information {
    border-style: double;
    border-radius: 15px;
}

.metting-information td {
    border: 1px solid black;
}

.metting-information tbody tr {
    height: 20%;
    border-top: 2px solid black;
    border-bottom: 1px solid black;
}


.metting-information tbody tr:last-child {
    border-bottom: none !important;
}

.metting-information tbody tr:last-child td {
    border-bottom: none !important;
}

.type {
    text-align: center;
    font-weight: 700;
}

.metting-summary {
    margin: 15px 0;
    border: 2px solid #6e6e6e;
    display: flex;
}

.metting-summary .right-side {
    border-left: 1px solid black;
    background: #d9d9d9;
}

.label {
    border-top: 1px solid #0000004f;
}
.space-preline{
   white-space: pre-line;
}
.metting-summary .right-side span {
    transform: rotate(270deg);
    display: table-caption;
    padding: 0;
    width: 74px;
    font-size: 15px;
    text-align: center;
    margin: 31px 0;
    padding: 12px 0px;
    font-weight: 700 !important;
}

.metting-summary .main {
    width: 90%;
    margin: 13px;
    font-size: 13px;
    text-align:justify;
    white-space: pre-line;
}


.metting-directives .main {
    border: 2px solid black;
    border-bottom: 1px solid black;
}


.metting-directives .main .label {
    text-align: center;
    background: #fbe5d5;
    padding: 8px 0;
}

.metting-directives table {
    border: 1px solid black;
}

.metting-directives table th {
    width: 7%;
    border: 1px solid black;
    padding: 7px;
    font-size: 14px;
}

.metting-directives table th:first-child {
    border-right: 1px solid white;
    font-size: 15px;
    font-weight: 900;
}


.metting-directives table th:last-child {
    border-left: 1px solid white;
    font-size: 15px;
    font-weight: 900;
}

.metting-directives table th:nth-child(1) {
    width: 3%;
    font-size: 15px;
    font-weight: 900;
}

.metting-directives table th:nth-child(2) {
    width: 30%;
    font-size: 15px;
    font-weight: 900;
}

.metting-directives table th:nth-child(3) {
    width: 4%;
    font-size: 15px;
    font-weight: 900;
}

.metting-description table th:nth-child(1) {
    width: 1%;
    font-size: 15px;
    font-weight: 900;
}

.metting-description table th:nth-child(2) {
    width: 4%;
    font-size: 15px;
    font-weight: 900;
}

.metting-description table th:nth-child(3) {
    width: 27%;
    font-size: 15px;
    font-weight: 900;
}

.metting-directives table tbody td {
    border: 1px solid black;
    text-align: center;
    padding: 7px 10px;
    font-size: 13px;
    overflow-wrap: anywhere;
}

.metting-directives table tbody td:first-child {
    border-right: 1px solid white !important;
}

.metting-directives table tbody td:last-child {
    border-left: 1px solid white !important;
}

.metting-directives table tbody tr:last-child td {
    border-bottom: 1px solid white !important;
}

.metting-description .main .label {
    background: #d9d9d9;
}

.metting-directives {
    margin-bottom: 20px;
}

.meeting-signatures {
    margin: 15px 0;
    border: 1px solid black;
    min-height: 85px;
}

.meeting-signatures .top {
    background: #d9d9d9;
    text-align: center;
    padding: 8px;
    border-bottom: 1px solid black;
}

.meeting-signatures {
    min-height: 130px;
    page-break-before: auto;
    page-break-after: auto;
    page-break-inside: avoid;
}

.meeting-signatures .top {
    background: #fbe5d5;
}

.top,
.label {
    font-weight: 700;
}

td {
    font-size: 14px;
    padding-right: 5px;
}

.meeting-information td {
    text-align: center;
}

* {
    -webkit-print-color-adjust: exact !important;
    /* Chrome, Safari, Edge */
    color-adjust: exact !important;
    /*Firefox*/
}

.meeting-signatures .main img {
    margin: 0 5px;
    width:125px;
    height:65px
}

.meeting-signatures .main {
    display: flex;
}

.meeting-signatures .main div {
    display: flex;
    flex-direction: column;
}

.meeting-signatures .main div span {
    font-size: 9px;
    margin: 0 5px;
    background: #fbe5d5;
        width:125px;

}
    `;
  }

  private getDraftPrintStyles(): string {
    return `
      body {
    direction: rtl;
    background-color: #f8f9fa;
    padding: 0;
}

.containter {
    max-width: 26cm;
    margin: 0 auto;
    background-color: #fff;
    padding: 20px;
    border-radius: 15px;
}

header {
    display: flex;
}

header .right-side {
    width: 100%;
    margin-left: 5px;
}

.name-of-god {
    text-align: center;
    margin-right: 25px;
    font-size: 18px;
}

.meeting-title {
    border: 2px solid #6d8dab;
    padding: 10px;
    margin-top: 5px;
    border-radius: 20px;
    height: 50px;
    font-weight: 700 !important;
    font-size: 17px;
    background: linear-gradient(to left, #e1d4cd, #f7ddd0, #e0e9f3);
}

.main {
    margin-top: 10px;
}

.metting-information table {
    border-collapse: collapse;
    min-height: 300px;
}

table {
    border-collapse: collapse;
}

.metting-information th {
    width: 10%;
    border: 1px solid black;
    border-top: 1px solid white;
    padding: 5px;
    font-size: 15px;
    font-weight: 800;
}

th:first-child {
    border-right: none !important;
    border-top: none !important
}

th:last-child {
    border-left: none !important;
    border-top: none !important
}

td:first-child {
    border-right: none !important;
}

td:last-child {
    border-left: none !important;
}

.metting-information {
    border-style: double;
    border-radius: 15px;
}

.metting-information td {
    border: 1px solid black;
}

.metting-information tbody tr {
    height: 20%;
    border-top: 2px solid black;
    border-bottom: 1px solid black;
}


.metting-information tbody tr:last-child {
    border-bottom: none !important;
}

.metting-information tbody tr:last-child td {
    border-bottom: none !important;
}

.type {
    text-align: center;
    font-weight: 700;
}

.metting-summary {
    margin: 15px 0;
    border: 2px solid #6e6e6e;
    display: flex;
}

.metting-summary .right-side {
    border-left: 1px solid black;
    background: #d9d9d9;
}

.label {
    border-top: 1px solid #0000004f;
}

.metting-summary .right-side span {
    transform: rotate(270deg);
    display: table-caption;
    padding: 0;
    width: 74px;
    font-size: 15px;
    text-align: center;
    margin: 31px 0;
    padding: 12px 0px;
    font-weight: 700 !important;
}

.metting-summary .main {
    width: 90%;
    margin: 13px;
    font-size: 13px;
    text-align:justify;
    white-space: pre-line;
}


.metting-directives .main {
    border: 2px solid black;
    border-bottom: 1px solid black;
}


.metting-directives .main .label {
    text-align: center;
    background: #fbe5d5;
    padding: 8px 0;
}

.metting-directives table {
    border: 1px solid black;
}

.metting-directives table th {
    width: 7%;
    border: 1px solid black;
    padding: 7px;
    font-size: 14px;
}

.metting-directives table th:first-child {
    border-right: 1px solid white;
    font-size: 15px;
    font-weight: 900;
}


.metting-directives table th:last-child {
    border-left: 1px solid white;
    font-size: 15px;
    font-weight: 900;
}

.metting-directives table th:nth-child(1) {
    width: 3%;
    font-size: 15px;
    font-weight: 900;
}

.metting-directives table th:nth-child(2) {
    width: 30%;
    font-size: 15px;
    font-weight: 900;
}

.metting-directives table th:nth-child(3) {
    width: 4%;
    font-size: 15px;
    font-weight: 900;
}

.metting-description table th:nth-child(1) {
    width: 1%;
    font-size: 15px;
    font-weight: 900;
}

.metting-description table th:nth-child(2) {
    width: 4%;
    font-size: 15px;
    font-weight: 900;
}

.metting-description table th:nth-child(3) {
    width: 27%;
    font-size: 15px;
    font-weight: 900;
}

.metting-directives table tbody td {
    border: 1px solid black;
    text-align: center;
    padding: 7px 10px;
    font-size: 13px;
}

.metting-directives table tbody td:first-child {
    border-right: 1px solid white !important;
}

.metting-directives table tbody td:last-child {
    border-left: 1px solid white !important;
}

.metting-directives table tbody tr:last-child td {
    border-bottom: 1px solid white !important;
}

.metting-description .main .label {
    background: #d9d9d9;
}

.metting-directives {
    margin-bottom: 20px;
}
.space-preline{
   white-space: pre-line;
}
.top,
.label {
    font-weight: 700;
}

td {
    font-size: 14px;
    padding-right: 5px;
}

.meeting-information td {
    text-align: center;
}

* {
    -webkit-print-color-adjust: exact !important;
    /* Chrome, Safari, Edge */
    color-adjust: exact !important;
    /*Firefox*/
}
    `;
  }
  // Signal-based utility methods
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
