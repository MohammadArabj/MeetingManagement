import { Injectable } from '@angular/core';

declare const Swal: any;

export type SwalResult = { isDenied?: boolean; isConfirmed?: boolean; value?: any; dismiss?: any };

export interface DeleteSwalOptions {
    title?: string;
    text?: string;
    html?: string;
    confirmText?: string;
    cancelText?: string;
    showLoaderOnConfirm?: boolean;
    confirmButtonClass?: string;
    cancelButtonClass?: string;
}

export interface DeleteSucceededSwalOptions {
    title?: string;
    text?: string;
    html?: string;
    confirmText?: string;
}

/**
 * تایپ عمومی برای تمام گزینه‌های SweetAlert2
 */
export interface SwalFireOptions {
    title?: string;
    text?: string;
    html?: string;
    icon?: 'success' | 'error' | 'warning' | 'info' | 'question';

    showCancelButton?: boolean;
    showConfirmButton?: boolean;
    showDenyButton?: boolean;

    confirmButtonText?: string;
    cancelButtonText?: string;
    denyButtonText?: string;

    confirmButtonColor?: string;
    cancelButtonColor?: string;
    denyButtonColor?: string;

    confirmButtonClass?: string;
    cancelButtonClass?: string;
    denyButtonClass?: string;

    customClass?: {
        container?: string;
        popup?: string;
        header?: string;
        title?: string;
        closeButton?: string;
        icon?: string;
        image?: string;
        content?: string;
        htmlContainer?: string;
        input?: string;
        inputLabel?: string;
        validationMessage?: string;
        actions?: string;
        confirmButton?: string;
        denyButton?: string;
        cancelButton?: string;
        loader?: string;
        footer?: string;
    };

    buttonsStyling?: boolean;
    reverseButtons?: boolean;
    focusConfirm?: boolean;
    focusCancel?: boolean;
    focusDeny?: boolean;

    allowOutsideClick?: boolean | ((result?: any) => boolean);
    allowEscapeKey?: boolean;
    allowEnterKey?: boolean;

    showLoaderOnConfirm?: boolean;
    showLoaderOnDeny?: boolean;

    backdrop?: boolean | string;
    position?: 'top' | 'top-start' | 'top-end' | 'center' | 'center-start' | 'center-end' | 'bottom' | 'bottom-start' | 'bottom-end';

    timer?: number;
    timerProgressBar?: boolean;

    width?: string | number;
    padding?: string | number;

    background?: string;

    // برای input
    input?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'range' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'url';
    inputLabel?: string;
    inputPlaceholder?: string;
    inputValue?: any;
    inputOptions?: { [key: string]: string } | Promise<{ [key: string]: string }>;
    inputAttributes?: { [key: string]: string };
    inputValidator?: (value: any) => Promise<string | null> | string | null;

    // Callbacks
    willOpen?: (popup: HTMLElement) => void;
    didOpen?: (popup: HTMLElement) => void;
    willClose?: (popup: HTMLElement) => void;
    didClose?: () => void;
    didRender?: (popup: HTMLElement) => void;

    // Progressive enhancement
    grow?: 'row' | 'column' | 'fullscreen' | false;

    // Footer
    footer?: string;

    // Image
    imageUrl?: string;
    imageWidth?: number;
    imageHeight?: number;
    imageAlt?: string;

    // Toast mode
    toast?: boolean;

    // و سایر options...
    [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class SwalService {

    /**
     * متد عمومی برای نمایش SweetAlert2 با هر نوع تنظیمات
     * 
     * @example
     * // استفاده ساده
     * this.swalService.fire({
     *   icon: 'success',
     *   title: 'موفق!',
     *   text: 'عملیات با موفقیت انجام شد'
     * });
     * 
     * @example
     * // با دکمه‌های سفارشی
     * const result = await this.swalService.fire({
     *   title: 'مطمئنید؟',
     *   text: 'این عملیات قابل بازگشت نیست',
     *   icon: 'warning',
     *   showCancelButton: true,
     *   confirmButtonText: 'بله، ادامه بده',
     *   cancelButtonText: 'خیر، انصراف',
     *   confirmButtonColor: '#1d4ed8',
     *   cancelButtonColor: '#64748b',
     *   reverseButtons: true,
     *   customClass: {
     *     confirmButton: 'swal-btn-primary',
     *     cancelButton: 'swal-btn-ghost'
     *   }
     * });
     * 
     * if (result.isConfirmed) {
     *   // انجام عملیات
     * }
     */
    fire(options: SwalFireOptions): Promise<SwalResult> {
        return Swal.fire(options);
    }

    /**
     * دیالوگ تأیید حذف (Promise برگشت می‌دهد)
     * استفاده:
     * const res = await swalService.fireDeleteSwal({ text: 'حذف شود؟' });
     * if (res.isConfirmed) { ... }
     */
    fireDeleteSwal(options: DeleteSwalOptions = {}): Promise<SwalResult> {
        const {
            title = 'حذف',
            text = 'آیا از حذف این مورد اطمینان دارید؟ این عملیات قابل بازگشت نیست.',
            html = '',
            confirmText = 'بله، حذف شود',
            cancelText = 'خیر',
            showLoaderOnConfirm = false,
            confirmButtonClass = 'btn btn-danger mt-2',
            cancelButtonClass = 'btn btn-secondary ml-2 mt-2'
        } = options;

        return Swal.fire({
            title,
            text: html ? undefined : text,
            html: html || undefined,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: cancelText,
            confirmButtonClass,
            cancelButtonClass,
            buttonsStyling: false,
            focusCancel: true,
            reverseButtons: true,
            showLoaderOnConfirm
        });
    }

    /**
     * پیام موفقیت حذف
     * استفاده:
     * this.swalService.fireDeleteSucceededSwal({ title: 'حذف شد', text: '...' });
     */
    fireDeleteSucceededSwal(options: DeleteSucceededSwalOptions = {} as any): Promise<SwalResult> {
        const {
            title = 'حذف با موفقیت انجام شد',
            text = 'مورد انتخابی با موفقیت حذف شد.',
            html = '',
            confirmText = 'باشه'
        } = options || {};

        return Swal.fire({
            title,
            text: html ? undefined : text,
            html: html || undefined,
            icon: 'success',
            confirmButtonText: confirmText
        });
    }

    /**
     * دیالوگ عمومی تایید/انصراف (همان کد شما، کمی تمیزتر)
     */
    fireSwal(text = '', title = ''): Promise<SwalResult> {
        return Swal.fire({
            title,
            text,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'بله، اطمینان دارم.',
            cancelButtonText: 'خیر',
            confirmButtonClass: 'btn btn-success mt-2',
            cancelButtonClass: 'btn btn-danger ml-2 mt-2',
            buttonsStyling: false
        });
    }

    /**
     * پیام موفقیت عمومی
     */
    fireSucceddedSwal(title: string, text: string): Promise<SwalResult> {
        return Swal.fire({
            title,
            icon: 'success',
            html: text,
            confirmButtonText: 'باشه'
        });
    }

    /**
     * پیام هشدار
     */
    fireDangeredSwal(title: string, text: string): Promise<SwalResult> {
        return Swal.fire({
            title,
            icon: 'warning',
            html: text,
            confirmButtonText: 'باشه'
        });
    }

    /**
     * Helper: نتیجه‌ی SweetAlert2 را به boolean تبدیل می‌کند (برای استفاده سریع)
     */
    isConfirmed(result: SwalResult | null | undefined): boolean {
        return !!result && (result.isConfirmed === true || result.value === true);
    }

    /**
     * Helper قبلی شما (به‌صورت درست‌تر)
     */
    dismissSwal(t: { value?: boolean; dismiss?: any }): boolean {
        return t?.dismiss === Swal.DismissReason.cancel;
    }
}