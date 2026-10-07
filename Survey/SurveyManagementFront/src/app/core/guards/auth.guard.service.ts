import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';
import { AuthBootstrapService } from '../../services/framework-services/auth-bootstrap.service';
import { errorKind, safeReturnUrl } from '../../services/framework-services/auth-utils';
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(CodeFlowService);
  const bootstrap = inject(AuthBootstrapService);
  const router = inject(Router);
  try {
    if (!(await auth.isLoggedIn())) {
      sessionStorage.setItem('survey_return_url', safeReturnUrl(state.url));
      await auth.startAuthentication();
      return false;
    }
    await bootstrap.ensureReady();
    return true;
  } catch (error) {
    sessionStorage.setItem('survey_return_url', safeReturnUrl(state.url));
    return router.createUrlTree(['/auth-error'], { queryParams: { reason: errorKind(error) } });
  }
};
