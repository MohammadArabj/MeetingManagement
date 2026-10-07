export interface SettingsNavItem { path: string; title: string; icon: string; hint: string; perms: string[]; group: string; }

/** منوی تنظیمات (ترتیب = ترتیب نمایش؛ اولین مورد مجاز، صفحه‌ی پیش‌فرض است) */
export const SETTINGS_NAV: SettingsNavItem[] = [
  { group: 'پایه', path: 'general', title: 'عمومی', icon: 'fa-sliders', hint: 'نام سامانه، آدرس، فایل‌ها', perms: ['MT_Settings'] },
  { group: 'پایه', path: 'meetings', title: 'جلسات و مصوبات', icon: 'fa-people-group', hint: 'اتمام خودکار، ارجاع', perms: ['MT_Settings'] },
  { group: 'پایه', path: 'board', title: 'هیئت مدیره', icon: 'fa-landmark', hint: 'دسته‌بندی، دبیر هیئت مدیره', perms: ['MT_Settings'] },
  { group: 'چاپ', path: 'print', title: 'چاپ و قالب‌ها', icon: 'fa-print', hint: 'سربرگ، لوگو، طراحی قالب‌ها', perms: ['MT_PrintTemplates', 'MT_Settings'] },
  { group: 'اطلاع‌رسانی', path: 'notifications', title: 'رویدادها', icon: 'fa-bell', hint: 'چه پیامی، برای چه کسی', perms: ['MT_Settings'] },
  { group: 'اطلاع‌رسانی', path: 'templates', title: 'قالب پیام‌ها', icon: 'fa-pen-to-square', hint: 'متن پیامک و اعلان', perms: ['MT_Settings'] },
  { group: 'اطلاع‌رسانی', path: 'sms', title: 'پیامک و زمان‌بندی', icon: 'fa-comment-sms', hint: 'پنل، ساعات سکوت، یادآوری', perms: ['MT_Settings'] },
  { group: 'اطلاع‌رسانی', path: 'logs', title: 'گزارش ارسال', icon: 'fa-list-check', hint: 'وضعیت و ارسال مجدد', perms: ['MT_Settings'] },
  { group: 'دسترسی', path: 'roles', title: 'نقش‌ها و دسترسی‌ها', icon: 'fa-user-shield', hint: 'توانایی هر نقش در جلسه', perms: ['MT_UserRoles', 'MT_Settings'] },
  { group: 'پیشرفته', path: 'advanced', title: 'همه تنظیمات', icon: 'fa-table-list', hint: 'جدول کامل کلیدها', perms: ['MT_Settings'] },
];
