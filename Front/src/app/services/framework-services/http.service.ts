import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ToastService } from './toast.service';
import { Result } from '../../core/types/result';

export class RequestConfig {
  noValidate?: boolean;
  loading?: boolean;
  formId?: string;
  /** درخواست حاصل submit فرم است (برای ValidationInterceptor) */
  submitted?: boolean;

  constructor({ noValidate = false, loading = true, formId = 'submitForm', submitted = false }: Partial<RequestConfig> = {}) {
    this.noValidate = noValidate;
    this.loading = loading;
    this.formId = formId;
    this.submitted = submitted;
  }
}

/**
 * خطای منطقی API (Result.isSuccess = false) یا خطای HTTP.
 * ✅ قبلاً پاسخ ناموفق به‌عنوان «داده» به next() برمی‌گشت؛ کامپوننت‌ها فکر می‌کردند عملیات
 * موفق بوده، مودال را می‌بستند و فرم را ریست می‌کردند (داده کاربر از دست می‌رفت).
 * حالا پاسخ ناموفق وارد شاخه error می‌شود.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status: number = 200, readonly data: unknown = null) {
    super(message);
    this.name = 'ApiError';
  }
}

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  constructor(
    private readonly http: HttpClient,
    private readonly toastService: ToastService
  ) { }

  private setHeaders(config: RequestConfig): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json',
      'loading': (config.loading ?? true).toString(),
      'noValidate': (config.noValidate ?? false).toString(),
      'formId': config.formId ?? ''
    });
    if (config.submitted) headers = headers.set('X-Form-Submitted', 'true');
    return headers;
  }

  private setHeadersForFile(config: RequestConfig): HttpHeaders {
    let headers = new HttpHeaders({
      'loading': (config.loading ?? true).toString(),
      'noValidate': (config.noValidate ?? false).toString(),
      'formId': config.formId ?? ''
    });
    if (config.submitted) headers = headers.set('X-Form-Submitted', 'true');
    return headers;
  }

  private handleResponse<T>(response: any, showToast: boolean): T {
    if (response && typeof response === 'object' && 'isSuccess' in response) {
      if (response.isSuccess) {
        if (showToast && response.message) this.toastService.success(response.message);
        return response.data as T;
      }
      // پیام خطای منطقی همیشه نمایش داده می‌شود (قبلاً در GET ها پنهان می‌ماند)
      const message = response.message || 'عملیات انجام نشد.';
      this.toastService.error(message);
      throw new ApiError(message, 200, response.data);
    }
    return response as T;
  }

  private handleError(error: unknown) {
    if (error instanceof ApiError) return throwError(() => error);
    if (error instanceof HttpErrorResponse) {
      const message = typeof error.error === 'string' ? error.error
        : error.error?.message ?? 'مشکلی رخ داده است.';
      return throwError(() => new ApiError(message, error.status, error.error));
    }
    return throwError(() => error);
  }

  getAll<T>(path: string, config = new RequestConfig({ noValidate: true }), showToast: boolean = false): Observable<T> {
    return this.http.get<Result<T>>(path, { headers: this.setHeaders(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error))
    );
  }

  get<T>(path: string, id: any = '', config = new RequestConfig({ noValidate: true }), showToast: boolean = false): Observable<T> {
    const mainPath = id !== '' && id !== null && id !== undefined ? `${path}/${id}` : path;
    return this.http.get<Result<T>>(mainPath, { headers: this.setHeaders(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error))
    );
  }

  getBlob<T>(path: string, id: any = '', config = new RequestConfig({ noValidate: true }), showToast: boolean = false) {
    return this.http.get<Result<T>>(`${path}/${id}`, { headers: this.setHeaders(config), responseType: 'blob' as 'json' }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error))
    );
  }

  getWithParams<T>(path: string, params: any = {}, config = new RequestConfig({ noValidate: true }), showToast: boolean = false) {
    return this.http.get<Result<T>>(`${path}`, { headers: this.setHeaders(config), params: cleanParams(params) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error))
    );
  }

  post<T>(path: string, body: any = {}, config = new RequestConfig({ submitted: true }), showToast: boolean = true): Observable<T> {
    return this.http.post<Result<T>>(path, body, { headers: this.setHeaders(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error))
    );
  }

  put<T>(path: string, body: any = {}, config = new RequestConfig({ submitted: true }), showToast: boolean = true): Observable<T> {
    return this.http.put<Result<T>>(path, body, { headers: this.setHeaders(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error))
    );
  }

  postFormData<T>(path: string, formData: FormData, config = new RequestConfig({ submitted: true }), showToast: boolean = true) {
    return this.http.post<Result<T>>(path, formData, { headers: this.setHeadersForFile(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error))
    );
  }

  putFormData<T>(path: string, formData: any, config = new RequestConfig({ submitted: true }), showToast: boolean = true) {
    return this.http.put<Result<T>>(path, formData, { headers: this.setHeadersForFile(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error))
    );
  }

  delete<T>(path: string, config = new RequestConfig({ noValidate: true }), showToast: boolean = true): Observable<T> {
    return this.http.delete<Result<T>>(path, { headers: this.setHeaders(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error))
    );
  }

  identityGet(ajax_url: string, path: string) {
    return this.http.get<string>(`${ajax_url}${path}`, { headers: this.setHeaders(new RequestConfig({ noValidate: true })) }).pipe(
      catchError(error => this.handleError(error))
    );
  }
}

/** حذف پارامترهای null/undefined از query string (قبلاً به‌صورت "null" ارسال می‌شدند) */
function cleanParams(params: any): any {
  if (!params || typeof params !== 'object') return params ?? {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}
