import { Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { SURVEY_ADMIN } from '../guards/permission.guard';

/**
 * نمایش بخشی از قالب فقط در صورت داشتن دسترسی (یکی از موارد کافی است؛ SV_Admin همه را دارد).
 * ✅ قبلاً «viewContainer.clear» بدون پرانتز صدا زده می‌شد و با هر تغییر ورودی نمای تکراری ساخته می‌شد.
 */
@Directive({ selector: '[hasPermission]', standalone: true })
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly auth = inject(PasswordFlowService);
  private shown = false;
  private version = 0;

  @Input()
  set hasPermission(value: string | string[] | null | undefined) {
    void this.updateView(value, ++this.version);
  }

  private async updateView(value: string | string[] | null | undefined, version: number): Promise<void> {
    const needed = Array.isArray(value) ? value : value ? [value] : [];
    const allowed = !needed.length || await this.auth.checkPermission([SURVEY_ADMIN, ...needed]);
    if (version !== this.version) return; // پاسخ قدیمی‌تر
    if (allowed && !this.shown) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.shown = true;
    } else if (!allowed && this.shown) {
      this.viewContainer.clear();
      this.shown = false;
    }
  }
}
