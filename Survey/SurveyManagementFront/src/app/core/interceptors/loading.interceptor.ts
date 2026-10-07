import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../loading/loading.service';

/**
 * نمایش نوار بارگذاری. ✅ با finalize: در موفقیت، خطا و «لغو» درخواست هم پایان می‌یابد.
 * هدر داخلی «loading» قبل از ارسال حذف می‌شود.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const show = req.headers.get('loading') === 'true';
  const clean = req.headers.has('loading') ? req.clone({ headers: req.headers.delete('loading') }) : req;
  if (!show) return next(clean);

  const loading = inject(LoadingService);
  loading.start();
  return next(clean).pipe(finalize(() => loading.stop()));
};
