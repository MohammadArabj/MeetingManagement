import { Component, input } from '@angular/core';
import { RoomConflictMeeting } from '../../../../core/types/conflict-result';

/**
 * مودال نمایش جلسه‌ای که مکان را در بازه زمانی انتخاب‌شده رزرو کرده است.
 * باز شدن مودال توسط کامپوننت والد (با id = roomConflictModal) انجام می‌شود.
 */
@Component({
  selector: 'app-room-conflict-modal',
  standalone: true,
  templateUrl: './room-conflict-modal.html'
})
export class RoomConflictModalComponent {
  readonly meeting = input<RoomConflictMeeting | null>(null);
}
