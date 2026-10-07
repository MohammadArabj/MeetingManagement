import { Component, OnInit } from '@angular/core';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';
@Component({ standalone: true, selector: 'app-silent-renew', template: '' })
export class SilentRenewComponent implements OnInit {
  constructor(private readonly auth: CodeFlowService) {}
  async ngOnInit(): Promise<void> {
    try { await this.auth.completeSilentAuthentication(); }
    catch { console.warn('[Auth] Silent callback failed'); }
  }
}
