import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { MeetingAccessService } from './meeting-access.service';
import { MeetingCapability } from './meeting-roles';

/**
 * نمایش شرطی بر اساس توانایی کاربر در جلسه جاری:
 *    <button *meetingCan="'ManageResolutions'">ثبت مصوبه</button>
 *    <div *meetingCan="['EditMeeting','ManageMembers']">...</div>   (حداقل یکی)
 */
@Directive({ selector: '[meetingCan]', standalone: true })
export class MeetingCanDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly access = inject(MeetingAccessService);

  readonly meetingCan = input.required<MeetingCapability | MeetingCapability[]>();
  private rendered = false;

  constructor() {
    effect(() => {
      const needed = this.meetingCan();
      const list = Array.isArray(needed) ? needed : [needed];
      const allowed = list.some(c => this.access.can(c));
      if (allowed && !this.rendered) { this.vcr.createEmbeddedView(this.templateRef); this.rendered = true; }
      else if (!allowed && this.rendered) { this.vcr.clear(); this.rendered = false; }
    });
  }
}
