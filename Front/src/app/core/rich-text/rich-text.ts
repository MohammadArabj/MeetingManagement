import { escapeHtml } from '../print/template-engine';
import { sanitizeRichHtml } from '../print/html-sanitizer';

/**
 * متن‌های قالب‌بندی‌شده (ویرایشگر) و سازگاری با متن‌های ساده‌ی قدیمی.
 * داده‌های ثبت‌شده پیش از ویرایشگر متن ساده با خط جدید هستند؛ این توابع هر دو را یکسان نمایش/چاپ می‌کنند.
 */

const HTML_PATTERN = /<\/?(p|br|ul|ol|li|strong|b|em|i|u|s|h[1-6]|blockquote|mark|a|span|div|hr)\b[^>]*>/i;

export function isRichHtml(value: string | null | undefined): boolean {
  return !!value && HTML_PATTERN.test(value);
}

/** متن ساده (با خط جدید) → HTML پاراگراف‌بندی‌شده */
export function plainTextToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** هر مقدار (HTML ویرایشگر یا متن ساده‌ی قدیمی) → HTML امن برای نمایش/چاپ */
export function toRichHtml(value: string | null | undefined): string {
  if (!value || !value.trim()) return '';
  return isRichHtml(value) ? sanitizeRichHtml(value) : plainTextToHtml(value);
}

/** HTML → متن ساده (برای پیش‌نمایش در جدول‌ها و شمارش کاراکتر) */
export function richTextToPlain(value: string | null | undefined): string {
  if (!value) return '';
  if (!isRichHtml(value)) return value;
  const doc = new DOMParser().parseFromString(
    value.replace(/<\/(p|li|h[1-6]|blockquote|div)>/gi, '$&\n').replace(/<br\s*\/?>/gi, '\n'), 'text/html');
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** خالی بودن واقعی محتوا (ویرایشگر خالی «<p></p>» تولید می‌کند) */
export function isRichTextEmpty(value: string | null | undefined): boolean {
  return !richTextToPlain(value).trim();
}

/**
 * سلول جدول (ag-grid) برای متن طولانی/قالب‌بندی‌شده: متن ساده‌ی کوتاه‌شده با tooltip کامل.
 * خروجی عنصر DOM است (نه رشته‌ی HTML) تا محتوای کاربر هرگز به‌صورت HTML اجرا نشود.
 */
export function plainTextCell(max: number) {
  return (params: { value?: unknown }): HTMLElement => {
    const text = richTextToPlain(params.value == null ? '' : String(params.value)).replace(/\s+/g, ' ').trim();
    const span = document.createElement('span');
    span.title = text;
    span.textContent = text.length > max ? text.slice(0, max) + '…' : text;
    return span;
  };
}
