import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgOptionComponent, NgSelectComponent } from '@ng-select/ng-select';

import { CustomInputComponent } from '../../../../../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../../../../../shared/custom-controls/custom-select';

import { ACTION_STATUS_LIST, ASSIGNMENT_RESULT_LIST, UserWithPosition } from '../resolution-form.models';
import { getUserInitials, getUserPhotoUrl } from '../resolution-form.utils';

/**
 * ویرایشگر تخصیص‌های مصوبه هیئت مدیره (اقدام کنندگان، سررسید، وضعیت و نتیجه).
 * FormArray از والد دریافت می‌شود و همه تغییرات ساختاری (افزودن/حذف/تغییر اقدام کننده) به والد سپرده می‌شود.
 */
@Component({
  selector: 'app-board-assignments-editor',
  standalone: true,
  imports: [ReactiveFormsModule, CustomInputComponent, CustomSelectComponent, NgSelectComponent, NgOptionComponent],
  templateUrl: './board-assignments-editor.html',
  styleUrls: ['../assignment-editor-shared.css', './board-assignments-editor.css'],
})
export class BoardAssignmentsEditorComponent {
  // ═══════════════════════════════════════════════════════════
  // Inputs
  // ═══════════════════════════════════════════════════════════
  readonly assignments = input.required<FormArray>();
  readonly users = input<UserWithPosition[]>([]);

  // ═══════════════════════════════════════════════════════════
  // Outputs
  // ═══════════════════════════════════════════════════════════
  readonly add = output<void>();
  readonly remove = output<number>();
  readonly actorsChange = output<{ index: number; items: any[] }>();

  // ViewChildren
  readonly assignmentsContainer = viewChild<ElementRef>('assignmentsContainer');

  // ═══════════════════════════════════════════════════════════
  // UI lists
  // ═══════════════════════════════════════════════════════════
  readonly actionStatusList = ACTION_STATUS_LIST;
  readonly assignmentResultList = ASSIGNMENT_RESULT_LIST;

  readonly getUserPhotoUrl = getUserPhotoUrl;
  readonly getUserInitials = getUserInitials;

  get controls() {
    return (this.assignments()?.controls as FormGroup[]) || [];
  }

  /** اسکرول به ابتدای لیست (تخصیص جدید در ابتدای لیست درج می‌شود) */
  scrollToLatestAssignment(): void {
    const el = this.assignmentsContainer()?.nativeElement;
    if (!el) return;
    setTimeout(() => { el.scrollTop = 0; }, 50);
  }
}
