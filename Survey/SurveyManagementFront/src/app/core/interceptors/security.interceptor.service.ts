import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CodeFlowService, getClientSettings } from '../../services/framework-services/code-flow.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { LocalStorageService, DELEGATION_ID } from '../../services/framework-services/local.storage.service';
import { SKIP_AUTH } from '../../services/framework-services/http.service';
import { POSITION_ID } from '../types/configuration';
import { isTrustedApi } from './auth-api-roots';
@Injectable()
export class SecurityInterceptor implements HttpInterceptor {
  constructor(private readonly password: PasswordFlowService,
    private readonly code: CodeFlowService, private readonly storage: LocalStorageService) { }
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const skip = request.context.get(SKIP_AUTH) || request.headers.has('skip');
    request = request.clone({ headers: request.headers.delete('skip') });
    if (skip || !isTrustedApi(request.url, window.location.href)) return next.handle(request);
    const token = environment.ssoAuthenticationFlow === 'code' ? this.code.getToken() : this.password.getToken();
    if (!token) return next.handle(request);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`, 'Client-Id': getClientSettings().client_id
    };
    const position = this.storage.getItem(POSITION_ID);
    if (position) headers['X-Position-Id'] = position;
    const delegation = this.storage.getItem(DELEGATION_ID);
    if (delegation && delegation !== '0') headers['X-Delegation-Id'] = delegation;
    // These headers are untrusted selectors. Every API must resolve them against the actor.
    // Preserve 401/403/network errors for caller; never terminate central SSO here.
    return next.handle(request.clone({ setHeaders: headers }));
  }
}
