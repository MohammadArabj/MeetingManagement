import { Component, inject, input, output } from '@angular/core';
import { ControlContainer, FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgOptionComponent, NgSelectComponent } from '@ng-select/ng-select';
import { SlicePipe } from '@angular/common';

import { CustomInputComponent } from '../../../../../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../../../../../shared/custom-controls/custom-select';
import { ComboBase } from '../../../../../../shared/combo-base';

import { UserWithPosition } from '../resolution-form.models';
import { getUserInitials, getUserPhotoUrl } from '../resolution-form.utils';

/**
 * ویرایشگر تخصیص‌های مصوبه جلسه عادی (تخصیص یافته به، نوع، مسئول پیگیری، سررسید).
 * باید داخل <form [formGroup]="regularResolutionForm"> والد قرار گیرد تا formArrayName="regularAssignments"
 * از طریق ControlContainer والد (viewProviders) resolve شود.
 */
@Component({
  selector: 'app-regular-assignments-editor',
  standalone: true,
  imports: [ReactiveFormsModule, CustomInputComponent, CustomSelectComponent, NgSelectComponent, NgOptionComponent, SlicePipe],
  viewProviders: [
    { provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) },
  ],
  templateUrl: './regular-assignments-editor.html',
  styleUrls: ['../assignment-editor-shared.css', './regular-assignments-editor.css'],
})
export class RegularAssignmentsEditorComponent {
  // ═══════════════════════════════════════════════════════════
  // Inputs
  // ═══════════════════════════════════════════════════════════
  readonly assignments = input.required<FormArray>();
  /** کنترل‌های جداگانه ng-select «تخصیص یافته به» (به ازای هر ردیف یک کنترل) */
  readonly actorControls = input<FormControl[]>([]);
  readonly users = input<UserWithPosition[]>([]);
  readonly assignmentTypes = input<ComboBase[]>([]);

  // ═══════════════════════════════════════════════════════════
  // Outputs
  // ═══════════════════════════════════════════════════════════
  readonly add = output<void>();
  readonly remove = output<number>();
  readonly actorsChange = output<{ index: number; items: any[] }>();
  readonly followerChange = output<{ index: number; item: any }>();
  readonly selectAllMembers = output<number>();

  readonly getUserPhotoUrl = getUserPhotoUrl;
  readonly getUserInitials = getUserInitials;
}
