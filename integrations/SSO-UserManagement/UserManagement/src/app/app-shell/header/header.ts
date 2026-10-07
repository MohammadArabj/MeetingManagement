import { Component, OnInit } from '@angular/core';
import { environment } from '../../../environments/environment';
import { userPhotoUrl } from '../../core/media/media-token';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';
import {
  USER_COMPANY_ID_NAME,
  USER_ORGANIZATION_CHART_ID_NAME,
  USER_CLASSIFICATION_LEVEL_ID_NAME,
  USER_ID_NAME
} from '../../core/types/configuration';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { UserService } from '../../services/user.service';
import { NgIf, AsyncPipe } from '@angular/common';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { SidebarService } from '../../services/framework-services/sidebar.service';
import { interval, map, startWith } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
  standalone: true,
  imports: [ NgbDropdownModule, AsyncPipe]
})
export class HeaderComponent implements OnInit {
  information = {
    fullname: '',
    companyTitle: '',
    organizationChartTitle: '',
    classificationLevel: '',
    needChangePassword: false,
    companyGuid: '',
    organizationChartGuid: '',
    userName: ''
  };

  fileManagementUrl!: string;

  roles = [
    { id: 1, title: 'کارشناس آموزش' },
    { id: 2, title: 'مدیر آموزش' }
  ];
  selectedRole = this.roles[0];

  // اگر جای دیگری از این‌ها استفاده نمی‌کنی، می‌تونی حذف‌شان کنی
  currentDate: string = '';
  currentTime: string = '';
  currentDay: string = '';
  fullDateTime: string = '';

  // استریم تاریخ/ساعت برای استفاده با async pipe
  dateTime$ = interval(1000).pipe(
    startWith(0),
    map(() => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };

      const date = now.toLocaleDateString('fa-IR');
      const time = now.toLocaleTimeString('fa-IR');
      const day = now.toLocaleDateString('fa-IR', { weekday: 'long' });
      const full = now.toLocaleString('fa-IR', options) + ' - ' + time;

      // اگر جایی دیگر از پراپرتی‌ها استفاده می‌کنی، همین‌جا ست‌شان می‌کنیم
      this.currentDate = date;
      this.currentTime = time;
      this.currentDay = day;
      this.fullDateTime = full;

      return { date, time, day, full };
    })
  );

  constructor(
    private readonly passwordFlowService: PasswordFlowService,
    private readonly codeFlowService: CodeFlowService,
    private readonly localStorageService: LocalStorageService,
    private readonly userService: UserService,
    private readonly sidebarService: SidebarService
  ) { }

  toggle() {
    this.sidebarService.toggleSidebar();
  }

  changeRole(role: any) {
    this.selectedRole = role;
    // بقیه لاجیک تغییر نقش...
  }

  ngOnInit(): void {
    // دیگه اینجا setInterval و updateDateTime لازم نیست
    this.userInformation();
  }

  userInformation() {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    this.userService.getUserInformation(userGuid).subscribe({
      next: (result) => {
        this.information = result;
        // عکس پرسنلی با توکن کوتاه‌مدت (سامانه‌ی مدیریت فایل عکس‌ها را بدون ورود نمی‌دهد)
        void userPhotoUrl(result.userName, 40).then(url => (this.fileManagementUrl = url));

        this.localStorageService.setItem(USER_COMPANY_ID_NAME, result.companyGuid);
        this.localStorageService.setItem(
          USER_ORGANIZATION_CHART_ID_NAME,
          result.organizationChartGuid
        );
        this.localStorageService.setItem(
          USER_CLASSIFICATION_LEVEL_ID_NAME,
          result.classificationLevelGuid
        );
        // ❌ دیگه this.cdr.detectChanges() لازم نیست
      },
      complete: () => { }
    });
  }

  logout() {
    if (environment.ssoAuthenticationFlow == 'code') {
      this.codeFlowService.logout();
    } else {
      this.passwordFlowService.logout();
    }
  }

  redirectToGrants() {
    window.location.href = `${environment.identityEndpoint}/grants`;
  }
}
