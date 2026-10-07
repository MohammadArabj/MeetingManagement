import { inject, Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastService } from '../../services/framework-services/toast.service';
declare var $: any;

@Injectable()
export class ExceptionInterceptor implements HttpInterceptor {
  constructor(private readonly toastService: ToastService) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(catchError((error) => this.handleError(error)));
  }

  private handleError = (error: HttpErrorResponse) => {
    if (error.error instanceof ErrorEvent) {
      // خطای سمت کلاینت
    } else {
      if (error.status === 400) {
        if (error.error?.error === "invalid_client") {
          this.toastService.error(error.error.error_description, "خطای ورود");
          $("#loginBtn").attr("disabled", false);
          $("#loginBtnSpinner").addClass("d-none");
        } else {
          this.toastService.error("اطلاعات فرم به درستی وارد نشده است", "خطا فرم");
        }
      } else if (error.status === 500) {
        this.toastService.error("خطایی رخ داده است. لطفا با مدیر سیستم تماس بگیرید.", "خطا سرور");
      } else if (error.status === 410) {
        this.toastService.error(error.error);
      }
    }

    // خطای واقعی را برمی‌گردانیم تا caller (مثلاً یک guard) بتواند
    // status code و جزئیات را ببیند، بجای یک رشته‌ی generic که همه‌چیز را گم می‌کند.
    return throwError(() => error);
  }
}