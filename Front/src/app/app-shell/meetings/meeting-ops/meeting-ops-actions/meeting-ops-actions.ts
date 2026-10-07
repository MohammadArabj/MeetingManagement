import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CreatType } from '../../../../core/types/enums';

/**
 * نوار دکمه‌های ثبت جلسه (پیش‌نویس، ثبت، ثبت و ارسال پیامک، انصراف).
 * وضعیت انتخاب‌شده از طریق خروجی submitted به والد ارسال می‌شود.
 */
@Component({
  selector: 'app-meeting-ops-actions',
  standalone: true,
  imports: [NgClass, RouterLink],
  templateUrl: './meeting-ops-actions.html',
  styleUrls: ['./meeting-ops-actions.css']
})
export class MeetingOpsActionsComponent {
  readonly createType = input<CreatType>(CreatType.Create);
  readonly isBoardMeeting = input<boolean>(false);

  /** وضعیت ثبت: 1 = پیش‌نویس، 2 = ثبت/ویرایش، 3 = ثبت و ارسال پیامک */
  readonly submitted = output<number>();
}
