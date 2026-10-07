import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { ToastService } from '../../services/framework-services/toast.service';
import { isValidNationalCode } from '../../shared/constants';

const INTERNAL_HEADERS = ['formId', 'noValidate', 'X-Form-Submitted'];
const MOBILE_REGEX = /^(0|0098|\+98)9(0[1-5]|[1 3]\d|2[0-2]|98)\d{7}$/;
const DATE_REGEX = /^[12]\d{3}\/(0[1-9]|1[012])\/(0[1-9]|[12]\d|3[01])$/;

/**
 * اعتبارسنجی فرم‌های template-driven قدیمی (HTML5 validity) پیش از ارسال.
 * ─────────────────────────────────────────────────────────────────────────
 * ✅ علت اصلی «گاهی ثبت نمی‌شود و باید رفرش کرد»:
 *    نسخه قبلی هر POST را با «اولین» المان #submitForm صفحه اعتبارسنجی می‌کرد. فرم ویرایش جلسه
 *    (meeting-ops) همیشه داخل صفحه جزئیات جلسه با همین id بود؛ پس ثبت مصوبه با فرم دیگری سنجیده
 *    و رد می‌شد. حالا فقط فرمی بررسی می‌شود که «دکمه ارسال داخل آن است» یا تنها فرم قابل‌مشاهده است.
 * ✅ listener ها فقط یک بار اضافه می‌شوند (قبلاً با هر submit تکرار و انباشته می‌شدند).
 * ✅ input بدون label دیگر خطای JS نمی‌دهد. ✅ به‌جای throw همزمان، throwError برمی‌گردد.
 * ✅ هدرهای داخلی قبل از ارسال به سرور حذف می‌شوند.
 * فرم‌های Reactive باید RequestConfig({ noValidate: true }) بفرستند.
 */
export const validationInterceptor: HttpInterceptorFn = (req, next) => {
  const formId = req.headers.get('formId');
  const shouldValidate = (req.method === 'POST' || req.method === 'PUT')
    && req.headers.has('X-Form-Submitted')
    && req.headers.get('noValidate') !== 'true'
    && !!formId;

  let headers = req.headers;
  INTERNAL_HEADERS.forEach(h => { if (headers.has(h)) headers = headers.delete(h); });
  const clean = req.clone({ headers });

  if (!shouldValidate) return next(clean);

  const form = resolveForm(formId!);
  if (!form) return next(clean);

  form.classList.add('was-validated');
  const errors = collectErrors(form);

  if (form.checkValidity() && errors.length === 0) {
    form.classList.remove('was-validated');
    return next(clean);
  }

  inject(ToastService).error(errors.length
    ? `لطفا «${errors.join('»، «')}» را به درستی وارد کنید.`
    : 'لطفا فیلدهای الزامی را تکمیل کنید.');
  return throwError(() => new Error('FORM_INVALID'));
};

/** انتخاب فرم درست بین چند المان هم‌نام */
function resolveForm(id: string): HTMLFormElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[id="${CSS.escape(id)}"]`))
    .filter((el): el is HTMLFormElement => el instanceof HTMLFormElement);
  if (candidates.length === 0) return null;

  const active = document.activeElement;
  const byFocus = candidates.find(f => active && f.contains(active));
  if (byFocus) return byFocus;

  const visible = candidates.filter(isVisible);
  const inOpenModal = visible.filter(f => f.closest('.modal.show'));
  if (inOpenModal.length === 1) return inOpenModal[0];
  if (inOpenModal.length === 0 && visible.length === 1) return visible[0];

  // ابهام: بهتر است اعتبارسنجی نشود تا اینکه فرم اشتباهی بررسی شود (سرور هم اعتبارسنجی می‌کند)
  return null;
}

function isVisible(el: HTMLElement): boolean {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

const wired = new WeakSet<Element>();

function collectErrors(form: HTMLFormElement): string[] {
  const errors = new Set<string>();
  const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'));

  for (const item of inputs) {
    if (item.disabled || !isVisible(item)) continue;

    const ds = (item as HTMLElement).dataset;
    const check = () => {
      const value = String(item.value ?? '').trim();
      let ok = true;
      if ('date' in ds) ok = value === '' || DATE_REGEX.test(toEnglishDigits(value));
      else if ('mobile' in ds) ok = value === '' || MOBILE_REGEX.test(toEnglishDigits(value));
      else if ('nationalCode' in ds) ok = value === '' || isValidNationalCode(value) || value.length === 11;
      (item as HTMLInputElement).setCustomValidity(ok ? '' : 'invalid');
    };

    if ('date' in ds || 'mobile' in ds || 'nationalCode' in ds) {
      check();
      if (!wired.has(item)) {
        wired.add(item);
        item.addEventListener('input', check);
        item.addEventListener('change', check); // datepicker ها input event نمی‌فرستند
      }
    }

    if (!item.validity.valid) errors.add(labelOf(item));
  }
  return Array.from(errors);
}

function labelOf(item: HTMLElement): string {
  const id = item.getAttribute('id');
  const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : item.closest('label');
  const text = (label?.textContent ?? item.getAttribute('placeholder') ?? item.getAttribute('name') ?? 'فیلد')
    .replace('*', '').trim();
  return text || 'فیلد';
}

function toEnglishDigits(value: string): string {
  return value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}
