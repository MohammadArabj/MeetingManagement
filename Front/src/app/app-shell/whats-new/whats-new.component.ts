import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';

// ═══════════════════════════════════════════════════════════════════════════════
// What's New Component - نسخه 3
// ═══════════════════════════════════════════════════════════════════════════════

interface Feature {
  id: string;
  icon: string;
  title: string;
  description: string;
  details: string[];
  category: 'new' | 'improved' | 'fixed';
  date: string;
}

interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  features: Feature[];
}

@Component({
  selector: 'app-whats-new',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './whats-new.component.html',
  styleUrls: ['./whats-new.component.css'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px) scale(0.97)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ])
    ])
  ]
})
export class WhatsNewComponent implements OnInit {

  private readonly STORAGE_KEY = 'whats-new-seen-version';
  private readonly CURRENT_VERSION = '1.5.0';

  readonly isVisible = signal<boolean>(false);
  readonly activeCategory = signal<'all' | 'new' | 'improved' | 'fixed'>('all');
  readonly expandedFeature = signal<string | null>(null);
  readonly selectedFeature = signal<Feature | null>(null);

  readonly releaseNotes: ReleaseNote = {
    version: '1.5.0',
    date: '۱۴۰۴/۱۰/۰۸',
    title: '',
    features: [
      // ═══════════════════════════════════════════════════════════════════════════════
      // ویژگی‌های جدید
      // ═══════════════════════════════════════════════════════════════════════════════
      {
        id: 'chairman-edit',
        icon: 'fa fa-user-edit',
        title: 'ویرایش جلسه توسط رئیس',
        description: 'رئیس جلسه تا قبل از امضای خود، امکان ویرایش اطلاعات جلسه را دارد',
        details: [
          'رئیس جلسه می‌تواند قبل از امضا، جلسه را ویرایش کند',
          'پس از امضای رئیس، امکان ویرایش غیرفعال می‌شود',
          'این قابلیت فقط برای رئیس جلسه فعال است',
          'سایر اعضا بدون تغییر به کار خود ادامه می‌دهند'
        ],
        category: 'new',
        date: '۱۴۰۴/۱۰/۰۸'
      },
      {
        id: 'actions-report',
        icon: 'fa fa-chart-bar',
        title: 'گزارش اقدامات مصوبات',
        description: 'مشاهده گزارش کامل اقدامات انجام شده روی مصوبات جلسات',
        details: [
          'گزارش کلی همه مصوبات یک جلسه',
          'گزارش تفکیکی هر مصوبه',
          'گزارش جزئی هر تخصیص',
          'نمایش وضعیت پیشرفت و نتیجه اقدامات',
          'امکان چاپ گزارشات',
          'نمایش تعداد پیوست‌های هر اقدام'
        ],
        category: 'new',
        date: '۱۴۰۴/۱۰/۰۸'
      },
      {
        id: 'blocked-time',
        icon: 'fa fa-user-clock',
        title: 'زمان‌های عدم حضور',
        description: 'ثبت و مدیریت زمان‌های عدم حضور اعضای جلسات',
        details: [
          'ثبت زمان‌های عدم حضور در تقویم',
          'نمایش زمان‌های عدم حضور در تقویم جلسات',
          'تشخیص خودکار تداخل با جلسات',
          'هشدار هنگام دعوت اعضای غیرحاضر',
          'امکان ویرایش و حذف زمان‌های عدم حضور'
        ],
        category: 'new',
        date: '۱۴۰۴/۱۰/۰۷'
      },
      {
        id: 'undetermined-meetings',
        icon: 'fa fa-question-circle',
        title: 'جلسات تعیین تکلیف نشده در داشبورد',
        description: 'نمایش جلساتی که وضعیت آن‌ها هنوز مشخص نشده است',
        details: [
          'نمایش در داشبورد مدیریتی',
          'دسترسی سریع به جلسات تعیین تکلیف نشده(ثبت شده،برگزار شده)',
          'شمارش تعداد جلسات تکلیف نشده'
        ],
        category: 'new',
        date: '۱۴۰۴/۱۰/۰۳'
      },
      {
        id: 'print-resolution',
        icon: 'fa fa-print',
        title: 'چاپ مصوبات',
        description: 'امکان چاپ مصوبات جلسات با فرمت PDF',
        details: [
          'چاپ تکی هر مصوبه',
          'چاپ همه مصوبات یک جلسه',
          'فرمت PDF با طراحی رسمی',
          'پشتیبانی از جلسات هیئت مدیره'
        ],
        category: 'new',
        date: '۱۴۰۴/۱۰/۰۴'
      },

      // ═══════════════════════════════════════════════════════════════════════════════
      // بهبودها
      // ═══════════════════════════════════════════════════════════════════════════════
      {
        id: 'report-pagination',
        icon: 'fa fa-table',
        title: 'بهبود گزارش مصوبات',
        description: 'صفحه‌بندی و فیلترهای پیشرفته برای گزارش مصوبات',
        details: [
          'صفحه‌بندی داده‌ها',
          'فیلتر وضعیت اقدام (در انتظار/درحال انجام/پایان یافته)',
          'فیلتر نتیجه (انجام شده/انجام نشده)',
          'نمایش تعداد کل اقدامات'
        ],
        category: 'improved',
        date: '۱۴۰۴/۱۰/۰۶'
      },
      {
        id: 'grid-state',
        icon: 'fa fa-th-list',
        title: 'ذخیره وضعیت جدول',
        description: 'حفظ وضعیت انتخاب ردیف‌ها در لیست جلسات',
        details: [
          'هایلایت ردیف انتخاب شده',
          'حفظ وضعیت پس از بازگشت از جزئیات',
          'تجربه کاربری روان‌تر'
        ],
        category: 'improved',
        date: '۱۴۰۴/۱۰/۰۳'
      },
      {
        id: 'meeting-validation',
        icon: 'fa fa-check-double',
        title: 'اعتبارسنجی شماره جلسه',
        description: 'جلوگیری از ثبت شماره تکراری برای جلسات هیئت مدیره',
        details: [
          'بررسی خودکار تکراری بودن شماره',
          'نمایش هشدار قبل از ذخیره',
          'اختصاصی جلسات هیئت مدیره'
        ],
        category: 'improved',
        date: '۱۴۰۴/۱۰/۰۴'
      },

      // ═══════════════════════════════════════════════════════════════════════════════
      // رفع اشکالات
      // ═══════════════════════════════════════════════════════════════════════════════
      {
        id: 'calendar-date-fix',
        icon: 'fa fa-bug',
        title: 'رفع مشکل انتخاب تاریخ',
        description: 'رفع مشکل عدم نمایش تاریخ در فیلد جستجو',
        details: [
          'نمایش صحیح تاریخ انتخابی',
          'تبدیل درست تاریخ شمسی',
          'همگام‌سازی تقویم و فیلد ورودی'
        ],
        category: 'fixed',
        date: '۱۴۰۴/۱۰/۰۷'
      },
      {
        id: 'conflict-detection-fix',
        icon: 'fa fa-bug',
        title: 'رفع مشکل تشخیص تداخل',
        description: 'رفع مشکل پاک شدن هشدار تداخل هنگام تغییر نقش عضو',
        details: [
          'حفظ هشدار تداخل پس از تغییر نقش',
          'بهبود مدیریت سیگنال‌ها',
          'نمایش صحیح وضعیت اعضا'
        ],
        category: 'fixed',
        date: '۱۴۰۴/۱۰/۰۸'
      }
    ]
  };

  readonly filteredFeatures = computed(() => {
    const category = this.activeCategory();
    if (category === 'all') {
      return this.releaseNotes.features;
    }
    return this.releaseNotes.features.filter(f => f.category === category);
  });

  readonly categoryCounts = computed(() => ({
    all: this.releaseNotes.features.length,
    new: this.releaseNotes.features.filter(f => f.category === 'new').length,
    improved: this.releaseNotes.features.filter(f => f.category === 'improved').length,
    fixed: this.releaseNotes.features.filter(f => f.category === 'fixed').length
  }));

  ngOnInit(): void {
    this.checkIfShouldShow();
  }

  private checkIfShouldShow(): void {
    const seenVersion = localStorage.getItem(this.STORAGE_KEY);
    if (seenVersion !== this.CURRENT_VERSION) {
      setTimeout(() => {
        this.isVisible.set(true);
      }, 500);
    }
  }

  close(): void {
    this.isVisible.set(false);
    localStorage.setItem(this.STORAGE_KEY, this.CURRENT_VERSION);
  }

  setCategory(category: 'all' | 'new' | 'improved' | 'fixed'): void {
    this.activeCategory.set(category);
  }

  toggleFeature(id: string): void {
    // در تب "همه" پاپ‌آپ جزئیات را باز کن
    if (this.activeCategory() === 'all') {
      const feature = this.releaseNotes.features.find(f => f.id === id);
      if (feature) {
        this.selectedFeature.set(feature);
      }
    } else {
      // در سایر تب‌ها، expand/collapse کن
      if (this.expandedFeature() === id) {
        this.expandedFeature.set(null);
      } else {
        this.expandedFeature.set(id);
      }
    }
  }

  closeDetail(): void {
    this.selectedFeature.set(null);
  }

  isExpanded(id: string): boolean {
    return this.expandedFeature() === id;
  }

  getCategoryLabel(category: string): string {
    switch (category) {
      case 'new': return 'جدید';
      case 'improved': return 'بهبود';
      case 'fixed': return 'رفع اشکال';
      default: return '';
    }
  }

  getCategoryClass(category: string): string {
    switch (category) {
      case 'new': return 'badge-new';
      case 'improved': return 'badge-improved';
      case 'fixed': return 'badge-fixed';
      default: return '';
    }
  }

  getFeaturesByCategory(category: 'new' | 'improved' | 'fixed'): Feature[] {
    return this.releaseNotes.features.filter(f => f.category === category);
  }

  show(): void {
    this.isVisible.set(true);
  }

  resetSeen(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
