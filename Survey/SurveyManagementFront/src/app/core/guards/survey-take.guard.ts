// import { Injectable, inject } from '@angular/core';
// import {
//   CanActivate,
//   ActivatedRouteSnapshot,
//   RouterStateSnapshot,
//   Router,
// } from '@angular/router';
// import { CodeFlowService } from '../../services/framework-services/code-flow.service';
// import { LocalStorageService } from '../../services/framework-services/local.storage.service';
// import { SurveyService } from '../../services/survey.service';
// import {
//   ACCESS_TOKEN_NAME,
//   USER_ID_NAME,
//   POSITION_ID,
//   PERMISSIONS_NAME,
//   USER_CURRENT_ACTIVE_SESSION_NAME,
//   Main_USER_ID,
//   IsDeletage,
//   ROLE_TOKEN_NAME,
//   POSITION_NAME,
// } from '../../core/types/configuration';
// import { PermissionService } from '../../services/permission.service';
// import { UserService } from '../../services/user.service';
// import { firstValueFrom } from 'rxjs';

// /**
//  * ============================================================
//  * Guard هوشمند برای صفحه شرکت در نظرسنجی
//  * ============================================================
//  *
//  * فلو:
//  * 1. آیا کاربر لاگین هست؟ → ادامه ✅
//  * 2. Silent SSO Check → آیا session فعال در SSO داره؟
//  *    2a. بله → Auto-login → ادامه ✅
//  *    2b. نه → آیا نظرسنجی Anonymous قبول میکنه؟
//  *        - بله → ادامه (بدون لاگین) ✅
//  *        - نه → ریدایرکت به SSO Login
//  *
//  * ============================================================
//  */
// @Injectable({ providedIn: 'root' })
// export class SurveyTakeGuard implements CanActivate {
//   private readonly codeFlowService = inject(CodeFlowService);
//   private readonly localStorageService = inject(LocalStorageService);
//   private readonly surveyService = inject(SurveyService);
//   private readonly permissionService = inject(PermissionService);
//   private readonly userService = inject(UserService);
//   private readonly router = inject(Router);

//   async canActivate(
//     route: ActivatedRouteSnapshot,
//     state: RouterStateSnapshot
//   ): Promise<boolean> {
//     const surveyGuid = route.paramMap.get('surveyGuid');

//     if (!surveyGuid) {
//       this.router.navigate(['/dashboard']);
//       return false;
//     }

//     // ===== مرحله ۱: آیا کاربر الان لاگین هست؟ =====
//     if (this.isAuthenticated()) {
//       // کاربر لاگین هست — مستقیم ادامه بده
//       return true;
//     }

//     // ===== مرحله ۲: Silent SSO Check =====
//     // شاید کاربر در سامانه دیگه‌ای لاگین باشه
//     const silentLoginSuccess = await this.trySilentLogin();
//     if (silentLoginSuccess) {
//       // لاگین خودکار موفق بود ✅
//       return true;
//     }

//     // ===== مرحله ۳: بررسی نظرسنجی — آیا Anonymous قبول میکنه؟ =====
//     try {
//       const surveyInfo = await firstValueFrom(
//         this.surveyService.getPublicSurveyInfo(surveyGuid)
//       );

//       if (surveyInfo?.allowAnonymous) {
//         // نظرسنجی ناشناس قبول میکنه — ادامه بدون لاگین ✅
//         // یک فلگ ست میکنیم تا کامپوننت بفهمه ناشناس هست
//         sessionStorage.setItem('survey_anonymous_mode', 'true');
//         return true;
//       }

//       if (!surveyInfo?.requireLogin) {
//         // لاگین اجباری نیست — ادامه بدون لاگین
//         sessionStorage.setItem('survey_anonymous_mode', 'true');
//         return true;
//       }
//     } catch (error) {
//       console.warn('Could not check survey info, attempting login redirect:', error);
//     }

//     // ===== مرحله ۴: باید لاگین کنه — ریدایرکت به SSO =====
//     // URL فعلی رو ذخیره کن تا بعد از لاگین برگرده
//     sessionStorage.setItem('survey_return_url', state.url);
//     //this.codeFlowService.login();
//     return false;
//   }

//   // ==================== Helper Methods ====================

//   /**
//    * بررسی آیا کاربر لاگین هست
//    */
//   private isAuthenticated(): boolean {
//     const token = this.localStorageService.getItem(ACCESS_TOKEN_NAME);
//     const userId = this.localStorageService.getItem(USER_ID_NAME);
//     return !!token && !!userId;
//   }

//   /**
//    * تلاش برای لاگین خودکار از طریق SSO Session
//    * اگه کاربر در سامانه دیگه‌ای لاگین باشه، بدون نمایش صفحه لاگین وارد میشه
//    */
//   private async trySilentLogin(): Promise<boolean> {
//     try {
//       // signinSilent از oidc-client — یک iframe مخفی باز میکنه
//       // و بررسی میکنه آیا SSO session فعال داره
//       const user = await this.codeFlowService.signinSilent();

//       if (!user?.access_token) {
//         return false;
//       }

//       // ذخیره اطلاعات کاربر (مشابه ChallengeComponent)
//       this.localStorageService.setItem(USER_ID_NAME, user.profile['id'] ?? '');
//       this.localStorageService.setItem(POSITION_ID, user.profile['activatedPosition']);
//       this.localStorageService.setItem(POSITION_NAME, user.profile['positionTitle']);
//       this.localStorageService.setItem(ROLE_TOKEN_NAME, user.profile['position']);
//       this.localStorageService.setItem(ACCESS_TOKEN_NAME, user.access_token);
//       this.localStorageService.setItem(Main_USER_ID, user.profile['id'] ?? '');
//       this.localStorageService.setItem(IsDeletage, user.profile['isDelegate'] ?? '');

//       // دریافت session و پرمیشن‌ها
//       try {
//         const sessionData = await firstValueFrom(this.userService.getCurrentSession());
//         if (sessionData?.sessionGuid) {
//           this.localStorageService.setItem(USER_CURRENT_ACTIVE_SESSION_NAME, sessionData.sessionGuid);
//         }

//         const positionGuid = this.localStorageService.getItem(POSITION_ID);
//         if (positionGuid) {
//           const permissions = await firstValueFrom(
//             this.permissionService.getPositionPermissions(positionGuid)
//           );
//           this.localStorageService.removeItem(PERMISSIONS_NAME);
//           this.localStorageService.setItem(PERMISSIONS_NAME, permissions);
//         }
//       } catch (e) {
//         // اگه session/permission فِیل شد، باز هم لاگین موفقه
//         console.warn('Silent login: session/permissions load failed:', e);
//       }

//       return true;
//     } catch (error) {
//       // Silent login فِیل شد — SSO session نداره
//       console.info('Silent SSO login failed (no active session):', error);
//       return false;
//     }
//   }
// }
