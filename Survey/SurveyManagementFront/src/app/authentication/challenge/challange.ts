import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';
import { safeReturnUrl } from '../../services/framework-services/auth-utils';
@Component({ selector: 'app-challenge', standalone: true, templateUrl: './challenge.html' })
export class ChallengeComponent implements OnInit {
  constructor(private readonly router: Router, private readonly auth: CodeFlowService) { }
  async ngOnInit(): Promise<void> {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('code') || params.has('error') || params.has('state')) await this.auth.completeAuthentication();
      else if (!(await this.auth.isLoggedIn())) throw new Error('callback');
      const returnUrl = safeReturnUrl(sessionStorage.getItem('survey_return_url'));
      sessionStorage.removeItem('survey_return_url');
      await this.router.navigateByUrl(returnUrl, { replaceUrl: true });
    } catch {
      // Remove code/state even when the callback fails; do not log them.
      await this.router.navigate(['/auth-error'], { queryParams: { reason: 'callback' }, replaceUrl: true });
    }
  }
}
