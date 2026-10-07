import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { LoadingService } from './loading.service';

/** نوار پیشرفت باریک بالای صفحه (غیرمسدودکننده). با ۲۰۰ms تأخیر ظاهر می‌شود تا چشمک نزند. */
@Component({
  selector: 'app-loading-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="app-loading-bar" role="progressbar" aria-label="در حال بارگذاری"><span></span></div>
    }
  `,
  styles: [`
    .app-loading-bar { position: fixed; inset: 0 0 auto 0; height: 3px; z-index: 2000; overflow: hidden;
      background: color-mix(in srgb, var(--bs-primary, #0d6efd) 20%, transparent); }
    .app-loading-bar span { position: absolute; inset: 0 auto 0 0; width: 40%;
      background: var(--bs-primary, #0d6efd); animation: app-loading 1.1s ease-in-out infinite; }
    @keyframes app-loading { 0% { right: -40%; } 100% { right: 100%; } }
  `],
})
export class LoadingBarComponent {
  private readonly loading = inject(LoadingService);
  private readonly delayed = signal(false);
  readonly visible = computed(() => this.loading.isLoading() && this.delayed());

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const active = this.loading.isLoading();
      clearTimeout(timer);
      if (active) timer = setTimeout(() => this.delayed.set(true), 200);
      else this.delayed.set(false);
    });
  }
}
