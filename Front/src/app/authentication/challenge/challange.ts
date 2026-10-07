import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/**
 * پردازش بازگشت از SSO اکنون در APP_INITIALIZER (AuthService.init) انجام می‌شود.
 * این صفحه فقط برای لینک‌های قدیمی «#/challenge» باقی مانده و کاربر را به مقصد می‌برد.
 */
@Component({
  selector: 'app-challenge',
  templateUrl: './challenge.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChallengeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) this.router.navigateByUrl('/dashboard', { replaceUrl: true });
    else this.auth.login('/dashboard');
  }
}
