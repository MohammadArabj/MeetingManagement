// ============================================================
// survey-wizard.guard.ts
// ✅ W7: جلوگیری از ازدست‌رفتن تغییرات هنگام خروج از ویزارد در داخل برنامه
//
// اتصال در routes:
//   { path: 'wizard', component: SurveyWizardComponent, canDeactivate: [surveyWizardCanDeactivateGuard] }
//   { path: 'wizard/:guid', component: SurveyWizardComponent, canDeactivate: [surveyWizardCanDeactivateGuard] }
// ============================================================

import { CanDeactivateFn } from '@angular/router';

/** هر کامپوننتی که این قرارداد را پیاده کند با این گارد محافظت می‌شود */
export interface WizardUnsavedChangesAware {
  hasUnsavedChanges(): boolean;
  /** در صورت وجود تغییرات، از کاربر تأیید می‌گیرد؛ true یعنی اجازه‌ی خروج */
  confirmLeave(): Promise<boolean>;
}

export const surveyWizardCanDeactivateGuard: CanDeactivateFn<WizardUnsavedChangesAware> = (component) => {
  if (!component || typeof component.hasUnsavedChanges !== 'function') return true;
  if (!component.hasUnsavedChanges()) return true;
  return component.confirmLeave();
};
