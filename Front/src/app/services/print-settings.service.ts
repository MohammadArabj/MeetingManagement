import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ServiceBase } from './framework-services/service.base';
import { RequestConfig } from './framework-services/http.service';

/** سربرگ ثابت همه‌ی چاپ‌ها (از «تنظیمات › چاپ و قالب‌ها») */
export interface PrintBranding {
  companyName?: string | null;
  subtitle?: string | null;
  logoGuid?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  footerText?: string | null;
  primaryColor?: string | null;
  fontFamily?: string | null;
  showPrintDate: boolean;
  showPrintedBy: boolean;
  watermark?: string | null;
}

export interface PrintSettingsModel {
  branding: PrintBranding;
  /** کلید قالب ← شناسه فایل JSON قالب در سامانه مدیریت فایل */
  templates: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class PrintSettingsApiService extends ServiceBase {
  constructor() {
    super('PrintSettings');
  }

  getSettings(): Observable<PrintSettingsModel> {
    return this.httpService.get<PrintSettingsModel>(this.baseUrl);
  }

  saveBranding(branding: PrintBranding): Observable<boolean> {
    return this.httpService.post<boolean>(`${this.baseUrl}/Branding`, branding);
  }

  /** fileGuid = null یعنی بازگشت به قالب پیش‌فرض */
  setTemplate(key: string, fileGuid: string | null): Observable<boolean> {
    return this.httpService.post<boolean>(
      `${this.baseUrl}/Template/${encodeURIComponent(key)}`,
      { fileGuid },
      new RequestConfig({ noValidate: true }),
    );
  }
}
