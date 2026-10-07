import { Injectable, signal } from '@angular/core';
import { Observable, tap, firstValueFrom } from 'rxjs';
import { ServiceBase } from './framework-services/service.base';
// ═══════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════

export interface SettingJsonModel {
    id: number;
    key: number;
    keyName: string;
    value: string;
    valueType: number;
    valueTypeName: string;
    category: number;
    categoryName: string;
    displayName: string;
    description?: string;
    isPublic: boolean;
    modifiedAt?: string;
}

export interface SettingPublicModel {
    key: string;
    value: string;
    valueType: number;
}

export interface EditSettingDto {
    id: number;
    value: string;
    displayName: string;
    description?: string;
    isPublic: boolean;
}

export interface UpdateSettingValueDto {
    key: number;
    value: string;
}

export interface BulkUpdateSettingsDto {
    settings: UpdateSettingValueDto[];
}

export enum SettingCategory {
    General = 1,
    Meeting = 2,
    BoardMeeting = 3,
    Notification = 4,
    FileManagement = 5,
    Roles = 6,
    Resolution = 7
}

export enum SettingValueType {
    String = 1,
    Integer = 2,
    Boolean = 3,
    Guid = 4,
    Decimal = 5,
    Json = 6,
    Time = 7
}

// ═══════════════════════════════════════════════════════════
// Static Settings
// ═══════════════════════════════════════════════════════════

export class AppSettings {
    private static _settings = new Map<string, string>();
    private static _initialized = false;

    static initialize(settings: SettingPublicModel[]): void {
        this._settings.clear();
        settings.forEach(s => this._settings.set(s.key, s.value));
        this._initialized = true;
        console.log('✅ AppSettings initialized with', settings.length, 'settings');
    }

    static get isInitialized(): boolean {
        return this._initialized;
    }

    // ═══════════════════════════════════════════════════════════
    // Typed Getters (با default values)
    // ═══════════════════════════════════════════════════════════

    static get boardCategoryGuid(): string {
        return this._settings.get('BoardCategoryGuid') ?? '';
    }

    static get boardPositionGuid(): string {
        return this._settings.get('BoardPositionGuid') ?? '';
    }

    static get boardSecretaryUserGuid(): string {
        return this._settings.get('BoardSecretaryUserGuid') ?? '';
    }

    static get committeeCategoryGuid(): string {
        return this._settings.get('CommitteeCategoryGuid') ?? '';
    }


    static get systemGuid(): string {
        return this._settings.get('SystemGuid') ?? '';
    }

    static get meetingAutoCloseMinutes(): number {
        return this.getNumber('MeetingAutoCloseMinutes', 30);
    }

    static get smsEnabled(): boolean {
        return this.getBoolean('SmsEnabled', true);
    }


    // ═══════════════════════════════════════════════════════════
    // Generic Getters
    // ═══════════════════════════════════════════════════════════

    static get(key: string, defaultValue: string = ''): string {
        return this._settings.get(key) ?? defaultValue;
    }

    static getNumber(key: string, defaultValue: number = 0): number {
        const val = this._settings.get(key);
        if (!val) return defaultValue;
        const num = parseInt(val);
        return isNaN(num) ? defaultValue : num;
    }

    static getBoolean(key: string, defaultValue: boolean = false): boolean {
        const val = this._settings.get(key);
        if (!val) return defaultValue;
        return val.toLowerCase() === 'true';
    }

    static getDecimal(key: string, defaultValue: number = 0): number {
        const val = this._settings.get(key);
        if (!val) return defaultValue;
        const num = parseFloat(val);
        return isNaN(num) ? defaultValue : num;
    }


    /**
     * حداکثر تعداد فایل برای آپلود
     */
    static get maxResolutionAttachments(): number {
        return this.getNumber('MaxResolutionAttachments', 10);
    }

    /**
     * حداکثر سایز فایل (مگابایت)
     */
    static get maxAttachmentSizeMB(): number {
        return this.getNumber('MaxAttachmentSizeMB', 50);
    }

    /**
     * فرمت‌های مجاز آپلود (جدا شده با کاما)
     * مثال: ".pdf,.jpg,.png,.doc,.docx,.xls,.xlsx"
     */
    static get allowedFileExtensions(): string {
        return this.get('AllowedFileExtensions', '.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar');
    }

    /**
     * فرمت‌های مجاز به صورت آرایه
     */
    static get allowedFileExtensionsArray(): string[] {
        return this.allowedFileExtensions
            .split(',')
            .map(ext => ext.trim().toLowerCase())
            .filter(ext => ext.length > 0);
    }

    /**
     * فرمت‌های مجاز برای نمایش کاربر (بدون نقطه)
     */
    static get allowedFileExtensionsDisplay(): string[] {
        return this.allowedFileExtensionsArray
            .map(ext => ext.replace('.', '').toUpperCase());
    }

    /**
     * MIME types مجاز برای input accept
     */
    static get acceptedMimeTypes(): string {
        const extToMime: Record<string, string> = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.zip': 'application/zip',
            '.rar': 'application/x-rar-compressed',
            '.txt': 'text/plain',
            '.csv': 'text/csv',
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg',
        };

        return this.allowedFileExtensionsArray
            .map(ext => extToMime[ext] || ext)
            .join(',');
    }

    // ═══════════════════════════════════════════════════════════
    // ✅ دسته‌بندی فرمت‌ها برای نمایش زیباتر
    // ═══════════════════════════════════════════════════════════

    static get fileTypeCategories(): { category: string; icon: string; extensions: string[] }[] {
        const allExts = this.allowedFileExtensionsArray;

        const categories = [
            {
                category: 'تصاویر',
                icon: 'fa-image',
                extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']
            },
            {
                category: 'اسناد',
                icon: 'fa-file-word',
                extensions: ['.pdf', '.doc', '.docx', '.txt', '.rtf']
            },
            {
                category: 'صفحه گسترده',
                icon: 'fa-file-excel',
                extensions: ['.xls', '.xlsx', '.csv']
            },
            {
                category: 'ارائه',
                icon: 'fa-file-powerpoint',
                extensions: ['.ppt', '.pptx']
            },
            {
                category: 'فشرده',
                icon: 'fa-file-archive',
                extensions: ['.zip', '.rar', '.7z', '.tar', '.gz']
            },
            {
                category: 'ویدیو',
                icon: 'fa-video',
                extensions: ['.mp4', '.avi', '.mkv', '.mov', '.wmv']
            },
            {
                category: 'صوت',
                icon: 'fa-music',
                extensions: ['.mp3', '.wav', '.ogg', '.m4a']
            },
        ];

        // فقط دسته‌هایی که حداقل یک فرمت مجاز دارند
        return categories
            .map(cat => ({
                ...cat,
                extensions: cat.extensions.filter(ext => allExts.includes(ext))
            }))
            .filter(cat => cat.extensions.length > 0);
    }

}

// ═══════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class SystemSettingService extends ServiceBase {

    // Signals
    private readonly _settings = signal<SettingJsonModel[]>([]);
    private readonly _publicSettings = signal<SettingPublicModel[]>([]);
    private readonly _loading = signal(false);
    private readonly _initialized = signal(false);

    // ✅ جلوگیری از اجرای همزمان
    private initPromise: Promise<void> | null = null;

    readonly settings = this._settings.asReadonly();
    readonly publicSettings = this._publicSettings.asReadonly();
    readonly loading = this._loading.asReadonly();
    readonly initialized = this._initialized.asReadonly();

    constructor() {
        super("SystemSetting");
    }

    // ═══════════════════════════════════════════════════════════
    // ✅ Initialization - با fetch (بدون HttpClient)
    // ═══════════════════════════════════════════════════════════

    async initializePublicSettings(): Promise<void> {
        // اگر قبلاً initialize شده
        if (this._initialized()) {
            console.log('⏭️ Settings already initialized');
            return;
        }

        // اگر در حال لود است، منتظر بمان
        if (this.initPromise) {
            console.log('⏳ Waiting for existing initialization...');
            return this.initPromise;
        }

        this.initPromise = this.doInitialize();
        return this.initPromise;
    }

    private async doInitialize(): Promise<void> {
        this._loading.set(true);

        try {
            // ✅ استفاده از fetch به جای HttpClient
            // این کار مشکلات interceptor و circular dependency را حل می‌کند
            const apiUrl = `${this.baseUrl}/GetPublic`;

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result && Array.isArray(result.data) && result.data.length > 0) {
                this._publicSettings.set(result.data);
                AppSettings.initialize(result.data);
                this._initialized.set(true);
            } else {
                this.loadDefaults();
            }
        } catch (error) {
            // ✅ مهم: خطا را throw نکن، از defaults استفاده کن
            this.loadDefaults();
        } finally {
            this._loading.set(false);
            this.initPromise = null;
        }
    }

    private loadDefaults(): void {
        const defaults: SettingPublicModel[] = [
            { key: 'MeetingAutoCloseMinutes', value: '30', valueType: 2 },
            { key: 'MaxResolutionAttachments', value: '10', valueType: 2 },
            { key: 'MaxAttachmentSizeMB', value: '50', valueType: 2 },
            { key: 'AllowedFileExtensions', value: '.pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar', valueType: 1 },
            { key: 'SmsEnabled', value: 'true', valueType: 3 },
        ];

        this._publicSettings.set(defaults);
        AppSettings.initialize(defaults);
        this._initialized.set(true);
    }
    // ✅ متد برای اطمینان از لود شدن
    async ensureInitialized(): Promise<void> {
        if (!this._initialized()) {
            await this.initializePublicSettings();
        }
    }

    // ═══════════════════════════════════════════════════════════
    // API Methods (با HttpClient برای استفاده عادی)
    // ═══════════════════════════════════════════════════════════

    getAll(): Observable<any> {
        return this.httpService.get<any>(`${this.baseUrl}/GetAll`).pipe(
            tap(result => {
                if (result) {
                    this._settings.set(result || []);
                }
            })
        );
    }

    getPublicSettings(): Observable<any> {
        return this.httpService.get<any>(`${this.baseUrl}/GetPublic`);
    }

    getById(id: number): Observable<{ isSuccess: boolean; data: SettingJsonModel }> {
        return this.httpService.get<any>(`${this.baseUrl}/GetById/${id}`);
    }

    getByCategory(category: number): Observable<{ isSuccess: boolean; data: SettingJsonModel[] }> {
        return this.httpService.get<any>(`${this.baseUrl}/GetByCategory/${category}`);
    }

    override edit(dto: EditSettingDto): Observable<{ isSuccess: boolean; message?: string }> {
        return this.httpService.post<any>(`${this.baseUrl}/Edit`, dto);
    }

    updateValue(dto: UpdateSettingValueDto): Observable<{ isSuccess: boolean }> {
        return this.httpService.post<any>(`${this.baseUrl}/UpdateValue`, dto);
    }

    bulkUpdate(dto: BulkUpdateSettingsDto): Observable<{ isSuccess: boolean }> {
        return this.httpService.post<any>(`${this.baseUrl}/BulkUpdate`, dto);
    }

    // ✅ Refresh settings (بعد از ویرایش)
    async refreshSettings(): Promise<void> {
        this._initialized.set(false);
        this.initPromise = null;
        await this.initializePublicSettings();
    }
}