import { NgClass } from '@angular/common';
import { Component, ElementRef, ViewChild, computed, effect, inject, signal, viewChild } from '@angular/core';
import { CustomInputComponent } from "../../../../shared/custom-controls/custom-input";
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FileService } from '../../../../services/file.service';
import { LocalStorageService } from '../../../../services/framework-services/local.storage.service';
import { AgendaService } from '../../../../services/agenda.service';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Resolution } from '../../../../core/models/Resolution';
import { Modal } from 'bootstrap';
import { AgendaItem, MeetingMember } from '../../../../core/models/Meeting';
import { IsDeletage, ISSP } from '../../../../core/types/configuration';
import { PasswordFlowService } from '../../../../services/framework-services/password-flow.service';
import { MeetingBehaviorService } from '../meeting-behavior-service';
import { FileManagerModalComponent } from "../../../../shared/file-manager/file-manger-modal.component";
import { TusUploadService } from '../../../../services/framework-services/tus-upload.service';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';

declare var $: any;
declare var Swal: any;

// ═══════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════

interface AgendaFileDto {
  id: number;
  isRemoved: boolean;
  fileGuid: string;
}

interface AgendaDto {
  id: string;
  text: string;
  meetingGuid: string;
  files: AgendaFileDto[];
}


import { PrintService } from '../../../../core/print/print.service';
import { ToastService } from '../../../../services/framework-services/toast.service';
@Component({
  selector: 'app-meeting-agenda-tab',
  imports: [
    NgClass,
    ReactiveFormsModule,
    CdkDropList,
    CdkDrag,
    CustomInputComponent,
    FileManagerModalComponent
  ],
  templateUrl: './meeting-agenda-tab.html',
  styleUrl: './meeting-agenda-tab.css'
})
export class MeetingAgendaTabComponent {

  // ═══════════════════════════════════════════════════════════
  // ViewChild References
  // ═══════════════════════════════════════════════════════════
  @ViewChild('fileManagerEdit') fileManagerEdit!: FileManagerModalComponent;
  @ViewChild('fileManagerView') fileManagerView!: FileManagerModalComponent;
  readonly fileViewerModal = viewChild.required<ElementRef>('fileViewerModal');

  // ═══════════════════════════════════════════════════════════
  // Injected Services
  // ═══════════════════════════════════════════════════════════
  private readonly fb = inject(FormBuilder);
  private readonly fileService = inject(FileService);
  private readonly route = inject(ActivatedRoute);
  private readonly agendaService = inject(AgendaService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly tus = inject(TusUploadService);
  private readonly printService = inject(PrintService);
  private readonly toast = inject(ToastService);
  // ═══════════════════════════════════════════════════════════
  // Signals - State Management
  // ═══════════════════════════════════════════════════════════
  readonly permissions = signal<Set<string>>(new Set());
  readonly isSuperAdmin = signal<boolean>(false);
  readonly isDelegate = signal<boolean>(false);
  readonly isBoardMeeting = signal<boolean>(false);
  readonly meeting = signal<any>(null);
  readonly currentMember = signal<MeetingMember | null>(null);
  readonly agendas = signal<AgendaItem[]>([]);
  readonly meetingGuid = signal<string>('');
  readonly isEditingAgenda = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);



  // ... بقیه کد‌های قبلی همانند قبل ...

  // ═══════════════════════════════════════════════════════════
  // ✅ Lifecycle - Cleanup on Destroy
  // ═══════════════════════════════════════════════════════════

  ngOnDestroy(): void {
    // پاکسازی فایل‌های جدید آپلود شده که ذخیره نشده‌اند
    this.cleanupNewUploadedFiles();
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ Cleanup Methods
  // ═══════════════════════════════════════════════════════════

  /**
   * حذف فایل‌های جدید آپلود شده که هنوز ذخیره نشده‌اند
   */
  private async cleanupNewUploadedFiles(): Promise<void> {
    // فایل‌های جدید = id === 0 و isRemoved === false
    const newFiles = this.editFiles.filter(f => f.id === 0 && !f.isRemoved);

    if (newFiles.length === 0) return;

    const guids = newFiles.map(f => f.fileGuid);

    try {
      await this.tus.deleteAttachments(guids);
      console.log(`Cleanup: Deleted ${guids.length} new uploaded files`);
    } catch (e) {
      console.warn('Failed to cleanup new uploaded files:', e);
    }
  }

  /**
   * ✅ متد کنسل کردن مودال - با cleanup فایل‌ها
   */
  async cancelAgendaModal(): Promise<void> {
    // حذف فایل‌های جدید آپلود شده
    await this.cleanupNewUploadedFiles();

    // بستن مودال
    $("#addAgendaModal").modal("hide");

    // ریست فرم
    this.resetForm();
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ اصلاح resetForm - بدون cleanup (چون بعد از save صدا زده می‌شود)
  // ═══════════════════════════════════════════════════════════

  private resetForm(): void {
    this.agendaForm.reset({
      id: '0',
      text: '',
      meetingGuid: this.meetingGuid()
    });
    this.editFiles = [];
    this.originalFiles = [];
    this.isEditingAgenda.set(false);
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ اصلاح openAddAgendaModal - با cleanup قبلی
  // ═══════════════════════════════════════════════════════════

  async openAddAgendaModal(): Promise<void> {
    // اول cleanup فایل‌های قبلی (اگر وجود دارد)
    await this.cleanupNewUploadedFiles();

    this.resetForm();
    this.isEditingAgenda.set(false);
    $("#addAgendaModal").modal("show");
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ اصلاح openEditModal - با cleanup قبلی
  // ═══════════════════════════════════════════════════════════

  async openEditModal(agenda: AgendaItem): Promise<void> {
    // اول cleanup فایل‌های قبلی (اگر وجود دارد)
    await this.cleanupNewUploadedFiles();

    // پر کردن فرم با داده‌های موجود
    this.agendaForm.patchValue({
      id: agenda.id,
      text: agenda.text,
      meetingGuid: this.meetingGuid()
    });

    // تبدیل فایل‌های موجود به فرمت داخلی
    this.originalFiles = (agenda.files || [])
      .filter(f => !f.isRemoved)
      .map(f => ({
        id: f.id,
        isRemoved: false,
        fileGuid: f.fileGuid
      }));

    // کپی برای ویرایش
    this.editFiles = this.originalFiles.map(f => ({ ...f }));

    this.isEditingAgenda.set(true);
    $("#addAgendaModal").modal("show");
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ اصلاح onEditFilesCancelled - با cleanup
  // ═══════════════════════════════════════════════════════════

  async onEditFilesCancelled(): Promise<void> {
    console.log('File manager edit cancelled');

    // ✅ فایل‌های جدیدی که در file manager اضافه شده ولی تایید نشده حذف شوند
    // این کار توسط FileManagerModalComponent انجام می‌شود
    // اما اگر نیاز به cleanup اضافی بود:

    // برگرداندن editFiles به حالت اولیه (قبل از باز کردن file manager)
    // چون ممکن است کاربر فایل جدید اضافه کرده باشد
    const activeOriginalGuids = this.originalFiles
      .filter(f => !f.isRemoved)
      .map(f => f.fileGuid.toLowerCase());

    // فایل‌هایی که جدید بودند و در originalFiles نیستند
    const newFilesInEdit = this.editFiles.filter(f =>
      f.id === 0 &&
      !f.isRemoved &&
      !activeOriginalGuids.includes(f.fileGuid.toLowerCase())
    );

    if (newFilesInEdit.length > 0) {
      try {
        await this.tus.deleteAttachments(newFilesInEdit.map(f => f.fileGuid));
        console.log(`Deleted ${newFilesInEdit.length} new files on file manager cancel`);
      } catch (e) {
        console.warn('Failed to delete new files on cancel:', e);
      }
    }

    // برگرداندن editFiles به original
    this.editFiles = this.originalFiles.map(f => ({ ...f }));
  }

  // ═══════════════════════════════════════════════════════════
  // ✅ Constructor - اضافه کردن event listener برای بسته شدن مودال
  // ═══════════════════════════════════════════════════════════

  constructor() {
    this.isSuperAdmin.set(this.localStorageService.getItem(ISSP) === 'true');
    this.isDelegate.set(this.localStorageService.getItem(IsDeletage) === 'true');

    effect(() => {
      this.meeting.set(this.meetingBehaviorService.meeting());
      if (this.meeting()) {
        this.isBoardMeeting.set(this.meetingBehaviorService.isBoardMeeting());
      }
      this.currentMember.set(this.meetingBehaviorService.currentMember());
    });

    effect(() => {
      this.route.paramMap.subscribe(params => {
        const guid = params.get('guid') || '';
        this.meetingGuid.set(guid);
        if (guid) {
          this.loadAgendas();
        }
      });
    });

    this.loadPermissions();

    // ✅ اضافه کردن event listener برای بسته شدن مودال با دکمه X یا کلیک بیرون
    this.setupModalCloseListener();
  }

  /**
   * ✅ تنظیم listener برای بسته شدن مودال
   */
  private setupModalCloseListener(): void {
    // صبر کن تا DOM آماده شود
    setTimeout(() => {
      const modalElement = document.getElementById('addAgendaModal');
      if (modalElement) {
        modalElement.addEventListener('hidden.bs.modal', () => {
          // وقتی مودال بسته شد، cleanup کن
          this.cleanupNewUploadedFiles();
        });
      }
    }, 100);
  }
  // ═══════════════════════════════════════════════════════════
  // File Manager State
  // ═══════════════════════════════════════════════════════════

  /** فایل‌های فعلی برای ویرایش/افزودن */
  editFiles: AgendaFileDto[] = [];

  /** فایل‌های اولیه (برای مقایسه و تشخیص حذف شده‌ها در حالت ویرایش) */
  private originalFiles: AgendaFileDto[] = [];

  /** برای حالت فقط مشاهده */
  viewFileGuids: string[] = [];

  // ═══════════════════════════════════════════════════════════
  // Form
  // ═══════════════════════════════════════════════════════════
  readonly agendaForm = this.fb.group({
    id: ['0'],
    text: ['', [Validators.required, Validators.maxLength(500)]],
    meetingGuid: ['']
  });

  // ═══════════════════════════════════════════════════════════
  // Computed Properties
  // ═══════════════════════════════════════════════════════════

  readonly uploadFolderPath = computed(() => {
    const guid = this.meetingGuid();
    return `Meeting{{Folder}}Agenda{{Folder}}${guid}`;
  });

  readonly hasChairmanSigned = computed(() => {
    const members = this.meetingBehaviorService.members();
    const chairman = members.find(m => MeetingRoles.isChairman(m.roleId));
    return chairman?.isSign === true;
  });

  readonly canAddAgenda = computed(() => {
    const meeting = this.meeting();
    const member = this.currentMember();
    const hasEditPermission = this.permissions().has('MT_Meetings_Edit');
    const hasChairmanSigned = this.hasChairmanSigned();

    const isUnsignedChairman = (MeetingRoles.isChairman(meeting?.roleId) && !hasChairmanSigned);

    return isUnsignedChairman ||
      (((MeetingRoles.can(meeting?.roleId, 'ManageAgenda') || hasEditPermission) && !member?.isDelegate) &&
        (![4, 3, 6].includes(meeting?.statusId) || hasEditPermission)) ||
      this.isBoardMeeting();
  });

  readonly canDragAgendas = computed(() => {
    const meeting = this.meeting();
    const hasEditPermission = this.permissions().has('MT_Meetings_Edit');
    const hasChairmanSigned = this.hasChairmanSigned();

    const isUnsignedChairman = (MeetingRoles.isChairman(meeting?.roleId) && !hasChairmanSigned);

    return isUnsignedChairman ||
      ((hasEditPermission || (MeetingRoles.can(meeting?.roleId ?? 0, 'ManageAgenda'))) &&
        (![4, 6].includes(meeting?.statusId ?? 0) || hasEditPermission)) ||
      this.isBoardMeeting();
  });

  readonly canEditOrDeleteAgenda = computed(() => {
    const meeting = this.meeting();
    const member = this.currentMember();
    const hasEditPermission = this.permissions().has('MT_Meetings_Edit');
    const hasChairmanSigned = this.hasChairmanSigned();

    const isUnsignedChairman = (MeetingRoles.isChairman(meeting?.roleId) && !hasChairmanSigned);

    return isUnsignedChairman ||
      ((hasEditPermission || MeetingRoles.can(meeting?.roleId, 'ManageAgenda')) &&
        !member?.isDelegate &&
        ![4, 6].includes(meeting?.statusId ?? 0)) ||
      this.isBoardMeeting();
  });

  readonly canUploadFile = computed(() => {
    const member = this.currentMember();
    const meeting = this.meeting();
    const isSuperAdmin = this.isSuperAdmin();
    return (!member?.isDelegate && (MeetingRoles.can(meeting?.roleId, 'ManageAgenda') || isSuperAdmin)) || this.isBoardMeeting();
  });

  readonly canShowEmptyMessage = computed(() => {
    return this.agendas().length === 0;
  });

  /** تعداد فایل‌های فعال (غیر حذف شده) در حالت ویرایش */
  readonly activeEditFilesCount = computed(() => {
    return this.editFiles.filter(f => !f.isRemoved).length;
  });

  /**
   * وقتی کاربر فایل‌ها رو در file manager تایید کرد
   * @param guids لیست GUID های نهایی (موجود + جدید)
   */
  onEditFilesConfirmed(guids: string[]): void {
    const newEditFiles: AgendaFileDto[] = [];
    const receivedGuids = new Set(guids.map(g => g.toLowerCase()));

    // 1️⃣ بررسی فایل‌های اولیه
    for (const original of this.originalFiles) {
      const guidLower = original.fileGuid.toLowerCase();

      if (receivedGuids.has(guidLower)) {
        // فایل هنوز وجود داره → بدون تغییر
        newEditFiles.push({
          id: original.id,
          isRemoved: false,
          fileGuid: original.fileGuid
        });
      } else {
        // فایل حذف شده
        newEditFiles.push({
          id: original.id,
          isRemoved: true,
          fileGuid: original.fileGuid
        });
      }
    }

    // 2️⃣ فایل‌های جدید (در guids هست ولی در original نیست)
    const originalGuids = new Set(this.originalFiles.map(f => f.fileGuid.toLowerCase()));

    for (const guid of guids) {
      if (!originalGuids.has(guid.toLowerCase())) {
        // فایل جدید
        newEditFiles.push({
          id: 0,
          isRemoved: false,
          fileGuid: guid
        });
      }
    }

    this.editFiles = newEditFiles;
  }

  onViewFilesClosed(): void {
    // وقتی مدال مشاهده بسته شد
    this.viewFileGuids = [];
  }

  // ═══════════════════════════════════════════════════════════
  // File Manager Operations
  // ═══════════════════════════════════════════════════════════

  openFileManagerForEdit(): void {
    // فقط فایل‌هایی که حذف نشدند رو بفرست
    const activeGuids = this.editFiles
      .filter(f => !f.isRemoved)
      .map(f => f.fileGuid);

    setTimeout(() => {
      this.fileManagerEdit.open(activeGuids);
    }, 100);
  }

  openFileViewer(files: AgendaFileDto[]): void {
    // فقط فایل‌های غیر حذف شده
    this.viewFileGuids = (files || [])
      .filter(f => !f.isRemoved)
      .map(f => f.fileGuid);

    setTimeout(() => {
      this.fileManagerView.open(this.viewFileGuids);
    }, 100);
  }

  // ═══════════════════════════════════════════════════════════
  // CRUD Operations
  // ═══════════════════════════════════════════════════════════

  saveAgenda(): void {
    if (this.agendaForm.invalid) {
      this.agendaForm.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'خطا',
        text: 'لطفاً متن دستور جلسه را وارد کنید'
      });
      return;
    }

    if (this.isSaving()) return;
    this.isSaving.set(true);

    // ساخت DTO با فرمت جدید
    const formData: AgendaDto = {
      id: this.agendaForm.value.id || '0',
      text: this.agendaForm.value.text || '',
      meetingGuid: this.meetingGuid(),
      files: this.editFiles
    };

    this.agendaService.createOrEdit(formData).subscribe({
      next: () => {
        $("#addAgendaModal").modal("hide");
        this.loadAgendas();
        this.resetForm();
      },
      error: (error: any) => {
        console.error('Error saving agenda:', error);
        Swal.fire({
          icon: 'error',
          title: 'خطا',
          text: 'خطا در ذخیره دستور جلسه'
        });
      },
      complete: () => {
        this.isSaving.set(false);
      }
    });
  }

  deleteAgenda(agenda: AgendaItem): void {
    Swal.fire({
      title: "آیا از حذف دستور جلسه اطمینان دارید؟",
      text: "درصورت حذف دیگر قادر به بازیابی دستور جلسه فوق نخواهید بود.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، اطمینان دارم.",
      cancelButtonText: "خیر",
      confirmButtonClass: "btn btn-success mx-2",
      cancelButtonClass: "btn btn-danger",
      buttonsStyling: false,
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.agendaService.delete(agenda.id).subscribe({
          next: () => {
            this.loadAgendas();
            Swal.fire({
              icon: 'success',
              title: 'حذف شد',
              text: 'دستور جلسه با موفقیت حذف شد',
              timer: 2000,
              showConfirmButton: false
            });
          },
          error: () => {
            Swal.fire({
              icon: 'error',
              title: 'خطا',
              text: 'خطا در حذف دستور جلسه'
            });
          }
        });
      }
    });
  }

  loadAgendas(): void {
    this.agendaService.getListBy(this.meetingGuid()).subscribe({
      next: (data: AgendaItem[]) => {
        this.agendas.set(data || []);
      },
      error: (error) => {
        console.error('Error loading agendas:', error);
        this.agendas.set([]);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // Drag & Drop
  // ═══════════════════════════════════════════════════════════

  onDrop(event: CdkDragDrop<AgendaItem[]>): void {
    const currentAgendas = [...this.agendas()];
    moveItemInArray(currentAgendas, event.previousIndex, event.currentIndex);
    this.agendas.set(currentAgendas);
    this.agendaService.updateAgendaOrder(currentAgendas).subscribe();
  }

  // ═══════════════════════════════════════════════════════════
  // Print
  // ═══════════════════════════════════════════════════════════

  print(): void {
    const meeting = this.meeting();
    if (!meeting) return;

    void this.printService
      .print('agenda', {
        meeting: {
          title: meeting.title ?? '',
          number: meeting.number ?? '',
          date: meeting.mtDate ?? '',
          startTime: meeting.startTime ?? '',
          location: meeting.location ?? '',
          chairman: meeting.chairman ?? '',
          secretary: meeting.secretary ?? '',
        },
        agendas: this.agendas().map(a => ({ text: a.text ?? '', files: this.getFileCount(a) })),
      }, { title: 'دستور جلسه' })
      .catch((e: any) => this.toast.error(e?.message || 'خطا در آماده‌سازی چاپ'));
  }

  private hasPermission(permission: string): boolean {
    return this.permissions().has(permission);
  }

  private async loadPermissions(): Promise<void> {
    const permissionsToCheck = ['MT_Meetings_Edit'];
    const newPermissions = new Set<string>();

    for (const perm of permissionsToCheck) {
      const has = await this.passwordFlowService.checkPermission(perm);
      if (has && (this.isSuperAdmin())) {
        newPermissions.add(perm);
      }
    }
    this.permissions.set(newPermissions);
  }

  showModal(): void {
    const fileViewerModal = this.fileViewerModal();
    if (fileViewerModal) {
      const modalInstance = Modal.getInstance(fileViewerModal.nativeElement) ||
        new Modal(fileViewerModal.nativeElement);
      modalInstance.show();
    }
  }

  /**
   * تعداد فایل‌های فعال (غیر حذف شده) برای یک دستور جلسه
   */
  getFileCount(agenda: AgendaItem): number {
    return (agenda?.files || []).filter(f => !f.isRemoved).length;
  }

  /**
   * گرفتن GUID های فعال برای نمایش در بخش چاپ
   */
  getActiveFileGuids(agenda: AgendaItem): string[] {
    return (agenda?.files || [])
      .filter(f => !f.isRemoved)
      .map(f => f.fileGuid);
  }

  /**
   * تعداد فایل‌های فعال در حالت ویرایش
   */
  getEditFilesCount(): number {
    return this.editFiles.filter(f => !f.isRemoved).length;
  }

  showImageModal(imageUrl: string): void {
    Swal.fire({
      imageUrl: imageUrl,
      imageAlt: "فایل پیوست",
      showConfirmButton: false,
      showCloseButton: true
    });
  }
}
