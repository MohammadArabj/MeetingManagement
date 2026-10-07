import { readIsMeetingAdmin } from '../../../../core/auth/session.store';
// ===============================================================
// File: meeting-content-tab.component.ts
// ===============================================================

import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

import { MeetingDetails, MeetingMember } from '../../../../core/models/Meeting';
import { Resolution } from '../../../../core/models/Resolution';
import { ComboBase } from '../../../../shared/combo-base';
import { SystemUser } from '../../../../core/models/User';

import { MeetingService } from '../../../../services/meeting.service';
import { ResolutionService } from '../../../../services/resolution.service';
import { UserService } from '../../../../services/user.service';
import { FileMeetingService } from '../../../../services/file-meeting.service';
import { AssignmentService } from '../../../../services/assignment.service';
import { LocalStorageService } from '../../../../services/framework-services/local.storage.service';
import { ToastService } from '../../../../services/framework-services/toast.service';
import { PasswordFlowService } from '../../../../services/framework-services/password-flow.service';
import { MeetingBehaviorService } from '../meeting-behavior-service';

import { getClientSettings } from '../../../../services/framework-services/code-flow.service';
import { IsDeletage, ReportMode, toggleBootstrapModal } from '../../../../core/types/configuration';

// Child components
import { MeetingDescriptionComponent } from './meeting-description/meeting-description';
import { ResolutionListComponent } from './resolution-list/resolution-list';
import { ResolutionFormComponent } from './resolution-form/resolution-form';
import { AssignmentModalComponent } from './assignment-modal/assignment-modal';
import { FileManagementModalComponent } from './file-management-modal/file-management-modal';
import { BoardResolutionList } from './board-resolution-list/board-resolution-list';
import { ResolutionActionsReportComponent } from './resolution-actions-report/resolution-actions-report';
import { MeetingPrintService } from '../../../../services/meeting-print.service';
import { MeetingRoles } from '../../../../core/meeting-access/meeting-roles';

// Local helpers

declare const Swal: any;

@Component({
  selector: 'app-meeting-content-tab',
  standalone: true,
  imports: [
    MeetingDescriptionComponent,
    ResolutionListComponent,
    ResolutionFormComponent,
    AssignmentModalComponent,
    FileManagementModalComponent,
    BoardResolutionList,
    ResolutionActionsReportComponent,
  ],
  templateUrl: './meeting-content-tab.html',
  styleUrl: './meeting-content-tab.css',
})
export class MeetingContentTabComponent implements AfterViewInit {
  // Services
  private readonly route = inject(ActivatedRoute);
  private readonly meetingService = inject(MeetingService);
  private readonly resolutionService = inject(ResolutionService);
  private readonly userService = inject(UserService);
  private readonly fileMeetingService = inject(FileMeetingService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly assignmentService = inject(AssignmentService);
  private readonly toastService = inject(ToastService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly printService = inject(MeetingPrintService);

  // -----------------------------
  // ViewChild refs (Bootstrap modals)
  // -----------------------------
  readonly addResolutionModal = viewChild<ElementRef>('addResolutionModal');
  readonly assignModal = viewChild<ElementRef>('assignModal');
  readonly fileModal = viewChild<ElementRef>('fileModal');
  readonly fileViewerModal = viewChild<ElementRef>('fileViewerModal');
  readonly actionsReportModal = viewChild<ElementRef>('actionsReportModal');
  readonly meetingDate = signal<string>('');
  // Child component ref
  @ViewChild(BoardResolutionList) boardResolutionList!: BoardResolutionList;

  // -----------------------------
  // Signals: meeting state
  // -----------------------------
  readonly meetingGuid = signal<string>('');
  readonly meeting = signal<MeetingDetails | null>(null);
  readonly isBoardMeeting = signal<boolean>(false);

  readonly description = signal<string>('');
  readonly resolutions = signal<Resolution[]>([]);
  readonly previousResolutions = signal<any[]>([]);
  readonly attachments = signal<any[]>([]);
  readonly fileCount = signal<number>(0);

  readonly roleId = signal<number | null>(null);
  readonly statusId = signal<number | null>(null);
  readonly currentMember = signal<MeetingMember | null>(null);

  // -----------------------------
  // Signals: auth/permissions
  // -----------------------------
  readonly isSuperAdmin = signal<boolean>(false);
  readonly isDelegate = signal<boolean>(false);
  readonly permissions = signal<Set<string>>(new Set());
  private readonly _resolutionNumber = signal<number>(0);
  readonly resolutionNumber = this._resolutionNumber.asReadonly();
  // -----------------------------
  // Signals: data
  // -----------------------------
  readonly allUsers = signal<ComboBase[]>([]);
  readonly userList = signal<SystemUser[]>([]);
  readonly assignmentTypes = signal([
    { guid: 'FollowUp', title: 'جهت پیگیری' },
    { guid: 'Expert', title: 'جهت کارشناسی' },
    { guid: 'ReportPreparation', title: 'تهیه گزارش' },
    { guid: 'Notification', title: 'استحضار' },
    { guid: 'Information', title: 'اطلاع' },
    { guid: 'Action', title: 'اقدام' },
  ]);

  // -----------------------------
  // Signals: modals/forms state
  // -----------------------------
  readonly isEditingResolution = signal<boolean>(false);
  readonly selectedResolutionForEdit = signal<Resolution | null>(null);
  /** افزایش در هر بار باز شدن مودال مصوبه → فرم همیشه از حالت تمیز شروع می‌شود */
  readonly resolutionFormOpenToken = signal(0);

  readonly selectedResolutionForAssign = signal<Resolution | null>(null);
  readonly selectedAssignmentForEdit = signal<any>(null);

  readonly selectedResolutionForFiles = signal<number | null>(null);
  readonly selectedFileForViewer = signal<
    | { guid?: string; url?: string; type?: string; name?: string; content?: string }
    | null
  >(null);

  // Actions report
  readonly showActionsReportModal = signal<boolean>(false);
  readonly actionsReportMode = signal<ReportMode>('all-resolutions');
  readonly actionsReportResolutionId = signal<number | null>(null);
  readonly actionsReportAssignmentId = signal<number | null>(null);

  // -----------------------------
  // Computeds
  // -----------------------------
  readonly meetingInfoForReport = computed(() => {
    const mt = this.meeting();
    return {
      number: mt?.number || '',
      title: mt?.title || '',
      date: mt?.mtDate || '',
      category: mt?.category || '',
      isBoardMeeting: this.isBoardMeeting(),
    };
  });

  readonly hasChairmanSigned = computed(() => {
    const members = this.meetingBehaviorService.members();
    const chairman = members.find((m) => MeetingRoles.isChairman(m.roleId));
    return chairman?.isSign === true;
  });
  onDescriptionEditCanceled() { // No action needed here, child component handles its state
  }
  private readonly isUnsignedChairman = computed(() => {
    return MeetingRoles.isChairman(this.roleId()) && !this.hasChairmanSigned();
  });

  readonly canShowActionsReport = computed(() => {
    const statusId = this.statusId();
    const members = this.meetingBehaviorService.members();

    const isMeetingFinished = statusId === 6;
    const hasChairSigned = members.some((m) => MeetingRoles.isChairman(m.roleId) && m.isSign === true);

    return isMeetingFinished || hasChairSigned;
  });

  readonly canEditDescription = computed(() => {
    const roleId = this.roleId() ?? 0;
    const statusId = this.statusId() ?? 0;
    const currentMember = this.currentMember();

    if (this.isUnsignedChairman()) return true;

    // هیئت مدیره: همیشه اجازه ویرایش (طبق منطق قبلی شما)
    if (this.isBoardMeeting()) return true;

    // دسترسی مبتنی بر نقش + وضعیت
    const roleBased =
      // !this.isDelegate() &&
      MeetingRoles.can(roleId, 'ManageResolutions') &&
      !currentMember?.isDelegate &&
      ![4, 6].includes(statusId);

    return roleBased || this.permissions().has('MT_Descriptions_Edit');
  });

  readonly canAddResolution = computed(() => {
    const roleId = this.roleId() ?? 0;
    const statusId = this.statusId() ?? 0;
    const currentMember = this.currentMember();
    const hasAddPermission = this.permissions().has('MT_Resolutions_Add');

    if (this.isUnsignedChairman()) return true;
    if (this.isBoardMeeting()) return true;

    const roleBased =
      //!this.isDelegate() &&
      MeetingRoles.can(roleId, 'ManageResolutions') &&
      !currentMember?.isDelegate &&
      ![4, 6].includes(statusId);

    return roleBased || hasAddPermission;
  });

  readonly canEditResolution = computed(() => {
    const roleId = this.roleId() ?? 0;
    const statusId = this.statusId() ?? 0;

    if (this.isUnsignedChairman()) return true;
    if (this.isBoardMeeting()) return true;

    return (
      this.permissions().has('MT_Resolutions_Edit') ||
      (MeetingRoles.can(roleId, 'ManageResolutions') && ![4, 6].includes(statusId))
    );
  });
  readonly canPrint = computed(() => {
    const statusId = this.statusId();
    const members = this.meetingBehaviorService.members();

    const isMeetingFinished = statusId === 6;
    const hasChairSigned = members.some((m) => MeetingRoles.isChairman(m.roleId) && m.isSign === true);

    return isMeetingFinished || hasChairSigned;
  });
  readonly canDeleteResolution = computed(() => {
    const roleId = this.roleId() ?? 0;
    const statusId = this.statusId() ?? 0;

    if (this.isUnsignedChairman()) return true;
    if (this.isBoardMeeting()) return true;

    return (
      this.permissions().has('MT_Resolutions_Delete') ||
      (MeetingRoles.can(roleId, 'ManageResolutions') && ![4, 6].includes(statusId))
    );
  });

  readonly canAddAssignment = computed(() => {
    const roleId = this.roleId() ?? 0;
    const statusId = this.statusId() ?? 0;

    if (this.isUnsignedChairman()) return true;
    if (this.isBoardMeeting()) return true;

    return (
      this.permissions().has('MT_Resolutions_Assign') ||
      (MeetingRoles.can(roleId, 'ManageResolutions') && ![4, 6].includes(statusId))
    );
  });

  readonly canDragResolutions = computed(() => {
    const roleId = this.roleId() ?? 0;
    const statusId = this.statusId() ?? 0;

    if (this.isUnsignedChairman()) return true;
    if (this.isBoardMeeting()) return true;

    const hasGeneral = this.permissions().has('MT_Resolutions') || MeetingRoles.can(roleId, 'ManageResolutions');
    const statusOk = ![4, 6].includes(statusId) || this.permissions().has('MT_Resolutions');

    return hasGeneral && statusOk;
  });

  readonly canUploadFileForResolution = computed(() => {
    const roleId = this.roleId() ?? 0;
    const currentMember = this.currentMember();

    if (this.isUnsignedChairman()) return true;
    if (this.isBoardMeeting()) return true;

    return !currentMember?.isDelegate && (MeetingRoles.can(roleId, 'ManageResolutions') || this.isSuperAdmin());
  });

  readonly canViewFiles = computed(() => this.permissions().has('MT_Resolutions_ViewFiles'));

  // -----------------------------
  // Lifecycle
  // -----------------------------
  constructor() {
    this.isSuperAdmin.set(readIsMeetingAdmin());
    this.isDelegate.set(this.localStorageService.getItem(IsDeletage) === 'true');

    // Route -> meetingGuid
    effect((onCleanup) => {
      const sub = this.route.paramMap.subscribe((params) => {
        const guid = params.get('guid');
        if (guid) this.meetingGuid.set(guid);
      });
      onCleanup(() => sub.unsubscribe());
    });

    // Behavior service -> currentMember
    effect(() => {
      this.currentMember.set(this.meetingBehaviorService.currentMember());
      this.meetingDate.set(this.meetingBehaviorService.meeting()?.mtDate ?? '');
    });

    // Behavior service -> meeting snapshot
    effect(() => {
      const mt = this.meetingBehaviorService.meeting();
      if (!mt) return;

      this.isBoardMeeting.set(this.meetingBehaviorService.isBoardMeeting());
      this.resolutions.set(this.meetingBehaviorService.resolutions());
      this.meeting.set(mt);

      this.roleId.set((mt as any)?.roleId ?? null);
      this.statusId.set((mt as any)?.statusId ?? null);
      this.description.set(mt.description ?? '');
    });

    // meetingGuid -> load users + previous resolutions (board)
    effect(() => {
      const guid = this.meetingGuid();
      if (!guid) return;

      this.loadUsers();
      if (this.isBoardMeeting()) this.loadPreviousResolutions();
    });

    // Permissions
    void this.loadPermissions();
  }

  ngAfterViewInit(): void {
    // no-op
  }
  onResolutionFormModalClosed() {
    // Any cleanup if needed when the modal is closed
  }
  // -----------------------------
  // Actions Report
  // -----------------------------
  onShowActionsReport(event: { resolutionId?: number; assignmentId?: number; mode: ReportMode }): void {
    this.actionsReportMode.set(event.mode);
    this.actionsReportResolutionId.set(event.resolutionId ?? null);
    this.actionsReportAssignmentId.set(event.assignmentId ?? null);
    this.showActionsReportModal.set(true);
    toggleBootstrapModal(this.actionsReportModal());
  }

  onActionsReportClosed(): void {
    this.showActionsReportModal.set(false);
    this.actionsReportResolutionId.set(null);
    this.actionsReportAssignmentId.set(null);
  }

  // -----------------------------
  // Description
  // -----------------------------
  onDescriptionSaved(newDescription: string): void {
    this.meetingService.updateDescription(this.meetingGuid(), newDescription).subscribe({
      next: () => this.meetingBehaviorService.updateMeeting({ description: newDescription }),
      error: (err) => {
        console.error('Error saving description:', err);
        this.toastService.error('خطا در ذخیره شرح جلسه.');
      },
    });
  }

  // -----------------------------
  // Resolutions CRUD
  // -----------------------------
  onResolutionDropped(event: CdkDragDrop<Resolution[]>): void {
    const list = [...this.resolutions()];
    const moved = list[event.previousIndex];
    list.splice(event.previousIndex, 1);
    list.splice(event.currentIndex, 0, moved);

    this.resolutionService.updateResolutionOrder(list).subscribe({
      next: () => this.meetingBehaviorService.updateResolutions(list),
      error: (err) => {
        console.error('Error updating resolution order:', err);
        this.toastService.error('خطا در به‌روزرسانی ترتیب مصوبات.');
      },
    });
  }

  openAddResolutionModal(): void {

    // ✅ reset edit mode
    this.isEditingResolution.set(false);
    this.selectedResolutionForEdit.set(null);

    if (this.isBoardMeeting()) {
      const mg = this.meetingGuid();

      if (mg) {
        this.resolutionService.getResolutionNumber(mg).subscribe({
          next: (res: any) => {
            this._resolutionNumber.set(res ?? 1);
          },
          error: () => this._resolutionNumber.set(1),
        });
      }
    }

    this.resolutionFormOpenToken.update(n => n + 1);
    toggleBootstrapModal(this.addResolutionModal());
  }
  onEditResolution(resolution: Resolution): void {
    this.isEditingResolution.set(true);
    this.selectedResolutionForEdit.set({ ...(resolution as any), _refreshToken: Date.now() });
    this.resolutionFormOpenToken.update(n => n + 1);
    toggleBootstrapModal(this.addResolutionModal());
  }

  onDeleteResolution(resolution: Resolution): void {
    Swal.fire({
      title: 'آیا از حذف مصوبه اطمینان دارید؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، اطمینان دارم.',
      cancelButtonText: 'خیر',
      confirmButtonClass: 'btn btn-success mx-2',
      cancelButtonClass: 'btn btn-danger',
      buttonsStyling: false,
    }).then((result: any) => {
      if (!result.isConfirmed) return;
      this.resolutionService.delete(resolution.id).subscribe({
        next: () => this.updateResolutionsList(),
        error: (err) => {
          console.error('Error deleting resolution:', err);
          this.toastService.error('خطا در حذف مصوبه.');
        },
      });
    });
  }

  onResolutionSaved(): void {
    // toggle برای بستن
    toggleBootstrapModal(this.addResolutionModal());
    this.updateResolutionsList();

    // اگر ویرایش بود، فایل‌ها را refresh کن
    const editedId = this.selectedResolutionForEdit()?.id;
    if (this.isEditingResolution() && editedId) {
      setTimeout(() => this.boardResolutionList?.refreshFiles(editedId), 500);
    }
  }

  forceRefreshResolutionFiles(resolutionId: number): void {
    this.boardResolutionList?.refreshFiles(resolutionId);
  }

  // -----------------------------
  // Assignments
  // -----------------------------
  onAssignResolution(resolution: Resolution): void {
    this.selectedResolutionForAssign.set(resolution);
    this.selectedAssignmentForEdit.set(null);
    toggleBootstrapModal(this.assignModal());
  }

  onEditAssignment(assignmentId: number): void {
    this.assignmentService.getBy(assignmentId).subscribe({
      next: (data: any) => {
        this.selectedAssignmentForEdit.set(data);
        const res = this.resolutions().find((r) => r.id === data.resolutionId) || null;
        this.selectedResolutionForAssign.set(res);
        toggleBootstrapModal(this.assignModal());
      },
      error: (err) => {
        console.error('Error fetching assignment:', err);
        this.toastService.error('خطا در بارگذاری اطلاعات تخصیص.');
      },
    });
  }

  onAssignmentSaved(): void {
    this.updateResolutionsList();
    toggleBootstrapModal(this.assignModal());
  }

  onAssignmentModalClosed(): void {
    this.selectedResolutionForAssign.set(null);
    this.selectedAssignmentForEdit.set(null);
  }

  onDeleteAssignment(assign: any): void {
    Swal.fire({
      title: 'آیا از حذف تخصیص اطمینان دارید؟',
      text: 'درصورت حذف دیگر قادر به بازیابی تخصیص فوق نخواهید بود.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، اطمینان دارم.',
      cancelButtonText: 'خیر',
      confirmButtonClass: 'btn btn-success mx-2',
      cancelButtonClass: 'btn btn-danger',
      buttonsStyling: false,
    }).then((result: any) => {
      if (!result.isConfirmed) return;

      this.assignmentService.delete(assign.id).subscribe({
        next: () => {
          this.resolutionService.getListBy(this.meetingGuid()).subscribe((res) => {
            this.meetingBehaviorService.setResolutions(res as any);
          });
          this.updateResolutionsList();
        },
        error: (err) => {
          console.error('Error deleting assignment:', err);
          this.toastService.error('خطا در حذف تخصیص.');
        },
      });
    });
  }

  // -----------------------------
  // Files
  // -----------------------------
  onShowFiles(resolutionId: number): void {
    this.selectedResolutionForFiles.set(resolutionId);

    this.fileMeetingService.getFiles(resolutionId, 'Resolution').subscribe({
      next: (files) => {
        this.attachments.set((files as any[]) || []);
        toggleBootstrapModal(this.fileModal());
      },
      error: (err) => {
        console.error('Error fetching files:', err);
        this.attachments.set([]);
        this.toastService.error('خطا در بارگذاری فایل‌ها.');
      },
    });
  }

  onFileViewed(fileData: { guid?: string; url?: string; type?: string; name?: string; content?: string }): void {
    this.selectedFileForViewer.set(fileData);
    toggleBootstrapModal(this.fileViewerModal());
  }

  onFileViewerModalClosed(): void {
    this.selectedFileForViewer.set(null);
  }

  onFileDeleted(fileGuid: string): void {
    this.fileMeetingService.deleteFile(fileGuid).subscribe({
      next: () => {
        const resolutionId = this.selectedResolutionForFiles();
        if (resolutionId) this.onShowFiles(resolutionId);
      },
      error: (err) => {
        console.error('Error deleting file:', err);
        this.toastService.error('خطا در حذف فایل.');
      },
    });
  }

  onFileManagementModalClosed(): void {
    this.selectedResolutionForFiles.set(null);
    this.attachments.set([]);
  }

  onFilesUploaded(files: any[]): void {
    this.fileCount.set((files?.length || 0) + (this.attachments()?.length || 0));
  }

  // -----------------------------
  // Printing
  // -----------------------------
  onPrintResolution(resolution: Resolution, index: number): void {
    const mt = this.meeting();
    if (!mt) return;

    this.printService.printSingle({
      resolution,
      index,
      meeting: mt,
      isBoardMeeting: this.isBoardMeeting(),
    });
  }

  onPrintAllResolutions(): void {
    const mt = this.meeting();
    const list = this.resolutions();

    if (!mt || !list?.length) {
      this.toastService.warning('هیچ مصوبه‌ای برای چاپ وجود ندارد.');
      return;
    }

    this.printService.printAll({
      meeting: mt,
      resolutions: list,
      isBoardMeeting: this.isBoardMeeting(),
    });
  }

  // -----------------------------
  // Data loading
  // -----------------------------
  private loadUsers(): void {
    const clientId = getClientSettings().client_id ?? '';
    this.userService.getAllByClientId<SystemUser[]>(clientId).subscribe({
      next: (data) => {
        this.userList.set(data);
        this.allUsers.set(
          data.map((u) => ({
            guid: u.guid,
            title: u.name,
            other: (u as any).positionGuid,
            personalNo: (u as any).userName,
          }))
        );
      },
      error: (err) => {
        console.error('Error loading users:', err);
      },
    });
  }

  private loadPreviousResolutions(): void {
    this.resolutionService.getListBy(this.meetingGuid()).subscribe({
      next: (data) => this.previousResolutions.set(data as any[]),
      error: (err) => console.error('Error loading previous resolutions:', err),
    });
  }

  private updateResolutionsList(): void {
    this.resolutionService.getListBy(this.meetingGuid()).subscribe({
      next: (data) => this.meetingBehaviorService.updateResolutions(data as any),
      error: (err) => console.error('Error refreshing resolutions:', err),
    });
  }

  private async loadPermissions(): Promise<void> {
    const perms = [
      'MT_Resolutions_Add',
      'MT_Resolutions_Edit',
      'MT_Resolutions_Delete',
      'MT_Resolutions_Assign',
      'MT_Resolutions_ViewFiles',
      'MT_Resolutions_DeleteFiles',
      'MT_Descriptions_Edit',
      'MT_Resolutions',
    ] as const;

    // سوپرادمین: همه دسترسی‌ها
    if (this.isSuperAdmin()) {
      this.permissions.set(new Set(perms));
      return;
    }

    // const set = new Set<string>();
    // for (const p of perms) {
    //   const has = await this.passwordFlowService.checkPermission(p);
    //   if (has) set.add(p);
    // }
    // this.permissions.set(set);
  }
}


