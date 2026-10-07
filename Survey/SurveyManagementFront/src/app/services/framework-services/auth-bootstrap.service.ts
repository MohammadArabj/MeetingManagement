import { Injectable } from '@angular/core';
import { firstValueFrom, forkJoin, timeout } from 'rxjs';
import { UserService } from '../user.service';
import { CodeFlowService, getClientSettings } from './code-flow.service';
import { LocalStorageService } from './local.storage.service';
import { USER_CURRENT_ACTIVE_SESSION_NAME } from '../../core/types/configuration';

@Injectable({ providedIn: 'root' })
export class AuthBootstrapService {
  private pending?: Promise<void>;
  constructor(private readonly users: UserService, private readonly auth: CodeFlowService,
              private readonly storage: LocalStorageService) {}
  ensureReady(): Promise<void> {
    // Share concurrent calls only; do not cache positive authorization decisions.
    if (!this.pending) this.pending = this.load().finally(() => { this.pending = undefined; });
    return this.pending;
  }
  private async load(): Promise<void> {
    this.storage.removeItem(USER_CURRENT_ACTIVE_SESSION_NAME);
    const user = await this.auth.getCurrentUser();
    if (!user || user.expired) throw new Error('session');
    // 'id' is the application's UM GUID claim; do not silently substitute OIDC sub.
    if (typeof user.profile['id'] !== 'string' || !user.profile['id']) throw new Error('profile');
    const data = await firstValueFrom(forkJoin({
      session: this.users.getCurrentSession(),
      access: this.users.hasClientAccess(getClientSettings().client_id)
    }).pipe(timeout(30000)));
    if (data.access?.hasAccess !== true) throw new Error('access');
    const sessionGuid = data.session?.sessionGuid;
    if (typeof sessionGuid !== 'string' || !sessionGuid || sessionGuid === '00000000-0000-0000-0000-000000000000') throw new Error('session');
    const active = await firstValueFrom(this.users.hasActiveSession({ sessionGuid }).pipe(timeout(30000)));
    if (active?.isActive !== true) throw new Error('session');
    // Check identity again before committing after slow HTTP requests.
    const current = await this.auth.getCurrentUser();
    if (!current || current.expired || current.profile.sub !== user.profile.sub || current.profile['id'] !== user.profile['id'] || current.profile['um_session_guid'] !== user.profile['um_session_guid']) throw new Error('session');
    this.storage.setItem(USER_CURRENT_ACTIVE_SESSION_NAME, sessionGuid);
  }
}
