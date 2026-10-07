import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { toRichHtml } from '../../core/rich-text/rich-text';

/** نمایش متن ویرایشگر (یا متن ساده‌ی قدیمی) با تایپوگرافی یکسان؛ HTML پاک‌سازی و سپس با DomSanitizer انگولار درج می‌شود */
@Component({
  selector: 'app-rich-text-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (html()) {
      <div class="mm-rich" [innerHTML]="html()"></div>
    } @else if (emptyText()) {
      <span class="text-muted">{{ emptyText() }}</span>
    }
  `,
})
export class RichTextViewComponent {
  readonly value = input<string | null | undefined>('');
  readonly emptyText = input('');
  readonly html = computed(() => toRichHtml(this.value()));
}
