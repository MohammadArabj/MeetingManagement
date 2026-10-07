import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import {
  ACCESS_TOKEN_NAME,
} from '../types/configuration';

/**
 * فقط چک می‌کنه توکن در localStorage هست یا نه
 * اگر هست → رد کن (کاربر قبلاً از challenge عبور کرده)
 * اگر نیست → به dashboard برگردون تا از نو لاگین کنه
 */
export const surveyAuthGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const localStorageService = inject(LocalStorageService);
  const router = inject(Router);

  const token = localStorageService.getItem(ACCESS_TOKEN_NAME);

  if (token) {
    return true; // ✅ توکن هست، مستقیم وارد شو
  }

  // ─── توکن نیست → ذخیره مقصد و برگشت به dashboard ────────────────────────
  sessionStorage.setItem('survey_return_url', state.url);
  return router.createUrlTree(['/dashboard']);
};