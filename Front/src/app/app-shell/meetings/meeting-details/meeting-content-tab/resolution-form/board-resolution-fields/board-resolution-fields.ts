import { Component, inject, input, output } from '@angular/core';
import { ControlContainer, ReactiveFormsModule } from '@angular/forms';

import { CustomInputComponent } from '../../../../../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../../../../../shared/custom-controls/custom-select';
import { ComboBase } from '../../../../../../shared/combo-base';

/**
 * فیلدهای اصلی مصوبه هیئت مدیره (موضوع، مستندات، جلسه/مصوبه پیرو، کمیسیون معاملات و ...).
 * باید داخل <form [formGroup]="boardResolutionForm"> والد قرار گیرد؛
 * ControlContainer والد از طریق viewProviders در اختیار formControlName ها قرار می‌گیرد.
 */
@Component({
  selector: 'app-board-resolution-fields',
  standalone: true,
  imports: [ReactiveFormsModule, CustomInputComponent, CustomSelectComponent],
  viewProviders: [
    { provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) },
  ],
  templateUrl: './board-resolution-fields.html',
  styleUrl: './board-resolution-fields.css',
})
export class BoardResolutionFieldsComponent {
  // ═══════════════════════════════════════════════════════════
  // Inputs
  // ═══════════════════════════════════════════════════════════
  readonly isEditing = input<boolean>(false);
  readonly previousMeetings = input<ComboBase[]>([]);
  readonly previousResolutions = input<ComboBase[] | null>(null);
  readonly previousCommitteMeetings = input<ComboBase[]>([]);
  readonly previousCommitteResolutions = input<ComboBase[] | null>(null);

  // ═══════════════════════════════════════════════════════════
  // Outputs
  // ═══════════════════════════════════════════════════════════
  readonly parentMeetingChange = output<any>();
  readonly committeeMeetingChange = output<any>();
}
