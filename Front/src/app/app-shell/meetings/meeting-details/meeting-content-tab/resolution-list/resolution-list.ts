import { Component, input, output, signal, computed, effect, inject, DestroyRef } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Collapse } from 'bootstrap';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeetingDetails } from '../../../../../core/models/Meeting';
import { Resolution } from '../../../../../core/models/Resolution';
import { NgClass } from '@angular/common';
import { ReportMode } from '../../../../../core/types/configuration';
import { RichTextViewComponent } from '../../../../../shared/rich-text-editor/rich-text-view.component';

@Component({
  selector: 'app-resolution-list',
  standalone: true,
  imports: [CdkDropList, CdkDrag, NgbDropdownModule, NgClass, RichTextViewComponent],
  templateUrl: './resolution-list.html',
  styleUrl: './resolution-list.css',
})
export class ResolutionListComponent {
  private destroyRef = inject(DestroyRef);

  // ═══════════════════════════════════════════════════════════════════════════════
  // Input signals
  // ═══════════════════════════════════════════════════════════════════════════════
  resolutions = input<Resolution[]>([]);
  canDrag = input<boolean>(false);
  canEditResolution = input<boolean>(false);
  canAddResolution = input<boolean>(false);
  canPrint = input<boolean>(false);
  canDeleteResolution = input<boolean>(false);
  canAddAssignment = input<boolean>(false);
  canViewFiles = input<boolean>(false);
  roleId = input<any>();
  statusId = input<any>();
  meeting = input.required<MeetingDetails | null>();

  /**
   * ✅ جدید: آیا دکمه‌های گزارش اقدامات نمایش داده شوند؟
   * این مقدار از parent می‌آید و بر اساس وضعیت جلسه و امضای رئیس تعیین می‌شود
   * شرط: statusId === 6 || members.some(m => m.roleId === 3 && m.isSign === true)
   */
  canShowActionsReport = input<boolean>(false);

  // ═══════════════════════════════════════════════════════════════════════════════
  // Output signals
  // ═══════════════════════════════════════════════════════════════════════════════
  resolutionDropped = output<CdkDragDrop<Resolution[]>>();
  addResolution = output<void>();
  editResolution = output<Resolution>();
  deleteResolution = output<Resolution>();
  assignResolution = output<Resolution>();
  showFiles = output<number>();
  printResolution = output<{ resolution: Resolution; index: number }>();
  editAssignment = output<number>();
  deleteAssignment = output<any>();
  printAllResolutions = output<void>();

  /**
   * ✅ Output برای نمایش گزارش اقدامات
   */
  readonly showActionsReport = output<{ resolutionId?: number; assignmentId?: number; mode: ReportMode }>();

  // ═══════════════════════════════════════════════════════════════════════════════
  // Internal signals
  // ═══════════════════════════════════════════════════════════════════════════════
  private collapseStates = signal<Map<number, boolean>>(new Map());

  /**
   * ✅ جدید: کنترل نمایش banner راهنما
   */
  readonly showHelpBanner = signal<boolean>(true);

  // ═══════════════════════════════════════════════════════════════════════════════
  // Computed signals
  // ═══════════════════════════════════════════════════════════════════════════════
  hasResolutions = computed(() => this.resolutions().length > 0);
  dragEnabled = computed(() => this.canDrag() && this.hasResolutions());

  canPerformActions = computed(() => ({
    edit: this.canEditResolution(),
    delete: this.canDeleteResolution(),
    assign: this.canAddAssignment(),
    viewFiles: this.canViewFiles(),
    showReport: this.canShowActionsReport(),  // ✅ جدید
    print: this.canPrint(),  // ✅ جدید
  }));

  // ═══════════════════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════════════════
  constructor() {
    // بررسی آیا قبلاً راهنما بسته شده
    const helpDismissed = localStorage.getItem('resolution-report-help-dismissed');
    if (helpDismissed === 'true') {
      this.showHelpBanner.set(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ✅ متدهای گزارش اقدامات
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * بستن banner راهنما و ذخیره در localStorage
   */
  dismissHelpBanner(): void {
    this.showHelpBanner.set(false);
    localStorage.setItem('resolution-report-help-dismissed', 'true');
  }

  /**
   * نمایش گزارش اقدامات یک مصوبه
   */
  showResolutionReport(resolution: Resolution): void {
    this.showActionsReport.emit({
      resolutionId: resolution.id,
      mode: 'single-resolution'
    });
  }

  /**
   * نمایش گزارش اقدامات یک تخصیص
   */
  showAssignmentReport(assignmentId: number): void {
    this.showActionsReport.emit({
      assignmentId: assignmentId,
      mode: 'single-assignment'
    });
  }

  /**
   * نمایش گزارش کلی همه مصوبات
   */
  showAllResolutionsReport(): void {
    this.showActionsReport.emit({
      mode: 'all-resolutions'
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // سایر متدها (بدون تغییر)
  // ═══════════════════════════════════════════════════════════════════════════════

  printAllResolutionsClicked() {
    this.printAllResolutions.emit();
  }

  onDrop(event: CdkDragDrop<Resolution[]>) {
    this.resolutionDropped.emit(event);
  }

  openAddResolutionModal() {
    this.addResolution.emit();
  }

  openEditResolutionModal(resolution: Resolution) {
    this.editResolution.emit(resolution);
  }

  deleteResolutionClicked(resolution: Resolution) {
    this.deleteResolution.emit(resolution);
  }

  assignResolutionClicked(resolution: Resolution) {
    this.assignResolution.emit(resolution);
  }

  showFilesClicked(resolutionId: number) {
    this.showFiles.emit(resolutionId);
  }

  printResolutionClicked(resolution: Resolution, index: number) {
    this.printResolution.emit({ resolution, index });
  }

  toggleCollapse(id: number) {
    const collapseElement = document.getElementById(`assignments-${id}`);
    if (collapseElement) {
      const bsCollapse = new Collapse(collapseElement, {
        toggle: false,
      });

      const isCurrentlyOpen = collapseElement.classList.contains('show');

      this.collapseStates.update(states => {
        const newStates = new Map(states);
        newStates.set(id, !isCurrentlyOpen);
        return newStates;
      });

      if (isCurrentlyOpen) {
        bsCollapse.hide();
      } else {
        bsCollapse.show();
      }
    }
  }

  isCollapsed(id: number): boolean {
    return this.collapseStates().get(id) ?? false;
  }

  trackByFn(index: number, item: Resolution): any {
    return item.id ?? index;
  }

  editAssignmentClicked(assignId: number) {
    this.editAssignment.emit(assignId);
  }

  deleteAssignmentClicked(assign: any) {
    this.deleteAssignment.emit(assign);
  }

  getResolutionByIndex(index: number): Resolution | undefined {
    return this.resolutions()[index];
  }
}
