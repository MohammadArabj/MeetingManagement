import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MeetingSummary } from './meeting-members.models';

/** کارت‌های آمار اعضای جلسه */
@Component({
  selector: 'app-member-stats-bar',
  standalone: true,
  templateUrl: './member-stats-bar.component.html',
  styleUrls: ['./member-stats-bar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberStatsBarComponent {
  readonly summary = input.required<MeetingSummary>();
}
