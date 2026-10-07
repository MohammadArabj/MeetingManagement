import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { SessionStore } from '../auth/session.store';

/**
 * نمایش شرطی بر اساس دسترسی:  *hasPermission="['MT_Settings','MT_UserRoles']"
 * ✅ واکنشی: با تغییر سمت/تفویض (و بارگذاری دسترسی‌ها) خودکار به‌روز می‌شود.
 * ✅ قبلاً هر نمونه، رشته‌ی دسترسی‌ها را با PapaParse پارس می‌کرد (صدها بار در هر صفحه).
 */
@Directive({
  selector: '[hasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly session = inject(SessionStore);

  readonly hasPermission = input<string | string[] | null | undefined>(null);

  private rendered = false;

  constructor() {
    effect(() => {
      const needed = this.hasPermission();
      const allowed = (this.session.hasPermissionsLoaded() || this.session.isSuperAdmin())
        && this.session.hasAnyPermission(needed);

      if (allowed && !this.rendered) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.viewContainer.clear();
        this.rendered = false;
      }
    });
  }
}
