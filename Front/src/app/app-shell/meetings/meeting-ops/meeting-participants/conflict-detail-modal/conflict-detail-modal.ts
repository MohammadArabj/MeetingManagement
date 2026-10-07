import { Component, input } from '@angular/core';
import { ConflictItem } from '../../../../../core/types/conflict-result';

/**
 * مودال نمایش جزئیات جلسه تداخل‌دار یک شخص.
 * باز شدن مودال توسط کامپوننت والد (با id = conflictDetailModal) انجام می‌شود.
 */
@Component({
  selector: 'app-conflict-detail-modal',
  standalone: true,
  templateUrl: './conflict-detail-modal.html'
})
export class ConflictDetailModalComponent {
  readonly conflict = input<ConflictItem | null>(null);
}
