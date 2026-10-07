import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NgSelectComponent } from '@ng-select/ng-select';
import { firstValueFrom } from 'rxjs';
import { getClientSettings } from '../../../core/auth/auth.config';
import { SystemUser } from '../../../core/models/User';
import { CategoryService } from '../../../services/category.service';
import { ToastService } from '../../../services/framework-services/toast.service';
import { PositionService } from '../../../services/position.service';
import { SettingJsonModel, SettingValueType, SystemSettingService } from '../../../services/system-setting.service';
import { UserService } from '../../../services/user.service';
import { ComboBase } from '../../../shared/combo-base';

type Source = 'category' | 'position' | 'user' | null;

/** منبع داده انتخاب‌گر برای کلیدهای GUID */
const GUID_SOURCES: Record<string, Source> = {
  BoardCategoryGuid: 'category',
  CommitteeCategoryGuid: 'category',
  BoardPositionGuid: 'position',
  DefaultFollowerPositionGuid: 'position',
  BoardSecretaryUserGuid: 'user',
  DefaultFollowerGuid: 'user',
};

interface FieldState {
  setting: SettingJsonModel;
  value: string;
  original: string;
  source: Source;
}

/**
 * فرم تنظیمات بر اساس دسته (Category) — داده‌محور:
 * هر تنظیم جدیدی که در سرور با این دسته Seed شود، بدون تغییر کد اینجا ظاهر می‌شود.
 * دسته‌ها از data مسیر خوانده می‌شوند:  data: { categories: [2, 7], title: '...' }
 */
@Component({
  selector: 'app-settings-form',
  imports: [FormsModule, NgSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-form.component.html',
  styleUrl: './settings-form.component.css',
})
export class SettingsFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly settingService = inject(SystemSettingService);
  private readonly categoryService = inject(CategoryService);
  private readonly positionService = inject(PositionService);
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);

  protected readonly Type = SettingValueType;

  readonly title = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly fields = signal<FieldState[]>([]);
  readonly categories = signal<ComboBase[]>([]);
  readonly positions = signal<ComboBase[]>([]);
  readonly users = signal<ComboBase[]>([]);

  readonly dirtyCount = computed(() => this.fields().filter(f => f.value !== f.original).length);
  readonly invalidKeys = computed(() => new Set(this.fields().filter(f => this.validate(f) !== null).map(f => f.setting.keyName)));

  /** برای استفاده به‌صورت تعبیه‌شده (بدون route data) */
  readonly categoriesInput = input<number[] | null>(null, { alias: 'categories' });
  readonly titleInput = input<string | null>(null, { alias: 'heading' });

  private categoryIds: number[] = [];

  ngOnInit(): void {
    const embedded = this.categoriesInput();
    if (embedded) {
      this.categoryIds = embedded;
      this.title.set(this.titleInput() ?? 'تنظیمات');
      void this.load();
      return;
    }
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.categoryIds = data['categories'] ?? [];
      this.title.set(data['title'] ?? 'تنظیمات');
      void this.load();
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const all = (await firstValueFrom(this.settingService.getAll())) as unknown as SettingJsonModel[] ?? [];
      const fields = all
        .filter(s => this.categoryIds.includes(s.category) && s.valueType !== SettingValueType.Json)
        .sort((a, b) => a.category - b.category || a.key - b.key)
        .map<FieldState>(s => ({ setting: s, value: s.value ?? '', original: s.value ?? '', source: GUID_SOURCES[s.keyName] ?? null }));
      this.fields.set(fields);
      await this.loadSources(fields);
    } finally {
      this.loading.set(false);
    }
  }

  setValue(field: FieldState, value: unknown): void {
    const text = value === null || value === undefined ? '' : String(value);
    this.fields.update(list => list.map(f => f === field ? { ...f, value: text } : f));
  }

  reset(): void {
    this.fields.update(list => list.map(f => ({ ...f, value: f.original })));
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    if (this.invalidKeys().size > 0) {
      this.toast.error('برخی مقادیر نامعتبر هستند.');
      return;
    }
    const changed = this.fields().filter(f => f.value !== f.original);
    if (changed.length === 0) return;

    this.saving.set(true);
    try {
      await firstValueFrom(this.settingService.bulkUpdate({
        settings: changed.map(f => ({ key: f.setting.key, value: f.value.trim() })),
      }));
      this.fields.update(list => list.map(f => ({ ...f, original: f.value })));
      await this.settingService.refreshSettings();
      this.toast.success('تنظیمات ذخیره شد.');
    } catch {
      // پیام خطا توسط HttpService نمایش داده شده است
    } finally {
      this.saving.set(false);
    }
  }

  options(field: FieldState): ComboBase[] {
    switch (field.source) {
      case 'category': return this.categories();
      case 'position': return this.positions();
      case 'user': return this.users();
      default: return [];
    }
  }

  validate(field: FieldState): string | null {
    const v = field.value.trim();
    switch (field.setting.valueType) {
      case SettingValueType.Integer: return /^\d+$/.test(v) ? null : 'عدد صحیح نامنفی وارد کنید';
      case SettingValueType.Decimal: return v !== '' && !isNaN(Number(v)) ? null : 'عدد وارد کنید';
      case SettingValueType.Time: return v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? null : 'قالب HH:mm';
      case SettingValueType.Guid:
        return v === '' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? null : 'شناسه نامعتبر';
      default: return v.length > 1000 ? 'حداکثر ۱۰۰۰ کاراکتر' : null;
    }
  }

  categoryTitle(category: number): string {
    return ({ 1: 'عمومی', 2: 'جلسات', 3: 'هیئت مدیره', 4: 'اطلاع‌رسانی', 5: 'مدیریت فایل', 6: 'نقش‌ها', 7: 'مصوبات و ارجاع' } as Record<number, string>)[category] ?? '';
  }

  trackKey = (_: number, f: FieldState) => f.setting.key;

  private async loadSources(fields: FieldState[]): Promise<void> {
    const needed = new Set(fields.map(f => f.source).filter(Boolean));
    const tasks: Promise<void>[] = [];

    if (needed.has('category')) tasks.push(firstValueFrom(this.categoryService.getForCombo<ComboBase[]>())
      .then(x => this.categories.set(x ?? [])).catch(() => this.categories.set([])));

    if (needed.has('position')) tasks.push(firstValueFrom(this.positionService.getForCombo<ComboBase[]>())
      .then(x => this.positions.set(x ?? [])).catch(() => this.positions.set([])));

    if (needed.has('user')) tasks.push(firstValueFrom(this.userService.getAllByClientId<SystemUser[]>(getClientSettings().client_id))
      .then(users => this.users.set((users ?? []).map(u => ({ guid: u.guid, title: u.name + (u.position ? ` (${u.position})` : '') }) as ComboBase)))
      .catch(() => this.users.set([])));

    await Promise.all(tasks);
  }
}
