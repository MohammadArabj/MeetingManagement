import { Component, Input, input, output } from '@angular/core';
import { NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ConflictItem } from '../../../../../core/types/conflict-result';
import { ComboBase } from '../../../../../shared/combo-base';
import { MeetingRoles } from '../../../../../core/meeting-access/meeting-roles';
import { MemberConflictType, ProcessedMember } from '../meeting-participants.models';
import { findMemberConflict, getRoleColor, hasMemberConflict } from '../meeting-participants.helpers';

/**
 * کارت نمایش یک عضو انتخاب‌شده جلسه (تصویر، سمت، جانشین، تداخل‌ها، نقش و دکمه‌ها).
 * تغییرات از طریق خروجی‌ها به کامپوننت والد اطلاع داده می‌شود.
 */
@Component({
  selector: 'app-participant-member-card',
  standalone: true,
  imports: [FormsModule, NgStyle],
  templateUrl: './participant-member-card.html',
  styleUrls: ['./participant-member-card.css']
})
export class ParticipantMemberCardComponent {
  /** رجیستری نقش‌ها برای استفاده در قالب (به‌جای roleId های ثابت) */
  protected readonly meetingRoles = MeetingRoles;

  /**
   * عضو به صورت مرجع (reference) دریافت می‌شود؛ ngModel نقش مستقیماً روی همین object
   * اعمال می‌شود (مانند رفتار قبلی در قالب والد).
   */
  @Input({ required: true }) member!: ProcessedMember;
  readonly roles = input<ComboBase[]>([]);
  readonly conflicts = input<ConflictItem[]>([]);

  /** رویداد change انتخاب نقش */
  readonly roleChange = output<Event>();
  readonly edit = output<void>();
  readonly remove = output<void>();
  readonly conflictDetails = output<ConflictItem>();

  getRoleColor(roleId: number): string {
    return getRoleColor(this.roles(), roleId);
  }

  hasConflict(conflictType: MemberConflictType): boolean {
    return hasMemberConflict(this.conflicts(), this.member, conflictType);
  }

  getConflictDetails(conflictType: MemberConflictType): ConflictItem | undefined {
    return findMemberConflict(this.conflicts(), this.member, conflictType);
  }
}
