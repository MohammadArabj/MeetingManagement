import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { HelpService } from '../../core/help/help.service';

/**
 * دکمه‌ی کوچک «؟» برای باز کردن راهنمای یک بخش مشخص.
 *   <app-help-button topic="minutes" />
 */
@Component({
  selector: 'app-help-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="help-btn" (click)="help.open(topic())" [title]="label()" [attr.aria-label]="label()">
      <i class="fa fa-question"></i>
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }
    .help-btn {
      width: 28px; height: 28px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid var(--mm-primary-100); background: var(--mm-primary-50); color: var(--mm-primary);
      font-size: .78rem; cursor: pointer;
      transition: background .15s var(--mm-ease), transform .15s var(--mm-ease);
    }
    .help-btn:hover { background: var(--mm-primary); color: #fff; transform: scale(1.06); }
  `],
})
export class HelpButtonComponent {
  readonly help = inject(HelpService);
  readonly topic = input.required<string>();
  readonly label = input('راهنمای این بخش');
}
