import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MeetingAccessService } from '../../../core/meeting-access/meeting-access.service';
import { CapabilityInfo, MeetingCapability, MeetingRoleKey, MeetingRoles, RoleConfig, RoleDefinition } from '../../../core/meeting-access/meeting-roles';
import { ToastService } from '../../../services/framework-services/toast.service';
import { SwalService } from '../../../services/framework-services/swal.service';

/**
 * ماتریس «نقش × توانایی».
 * ─────────────────────────────────────────────────────────────────────────
 * جایگزین هاردکد بودن رئیس/دبیر/ناظر/عضو/مهمان در کد: هر نقش یک «کلید سیستمی» دارد
 * (برای منطق‌هایی مثل امضای رئیس) و مجموعه‌ای از توانایی‌ها که مستقیماً در سرور
 * (IMeetingAccessService) و فرانت (MeetingRoles / *meetingCan) اعمال می‌شود.
 */
@Component({
  selector: 'app-role-capabilities',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-capabilities.component.html',
  styleUrl: './role-capabilities.component.css',
})
export class RoleCapabilitiesComponent implements OnInit {
  private readonly access = inject(MeetingAccessService);
  private readonly toast = inject(ToastService);
  private readonly swal = inject(SwalService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly config = signal<RoleConfig | null>(null);
  readonly roles = signal<RoleDefinition[]>([]);
  private original = '';

  readonly dirty = computed(() => JSON.stringify(this.roles()) !== this.original);

  readonly groups = computed(() => {
    const caps = this.config()?.capabilities ?? [];
    const names = Array.from(new Set(caps.map(c => c.group)));
    return names.map(name => ({ name, items: caps.filter(c => c.group === name) }));
  });

  readonly keys = computed(() => this.config()?.keys ?? []);

  /** هشدارهای منطقی پیکربندی (پیش از ذخیره) */
  readonly warnings = computed(() => {
    const list = this.roles();
    const w: string[] = [];
    const has = (key: MeetingRoleKey) => list.some(r => r.key === key);
    if (!has('Chairman')) w.push('هیچ نقشی به‌عنوان «رئیس» تعیین نشده است.');
    if (!has('Secretary') && !has('NonMemberSecretary')) w.push('هیچ نقشی به‌عنوان «دبیر» تعیین نشده است.');
    const dupKeys = list.filter(r => r.key !== 'Custom').map(r => r.key).filter((k, i, a) => a.indexOf(k) !== i);
    if (dupKeys.length) w.push('یک کلید سیستمی به بیش از یک نقش داده شده است.');
    if (!list.some(r => r.capabilities.includes('ManageResolutions'))) w.push('هیچ نقشی امکان ثبت مصوبه ندارد.');
    return w;
  });

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      await this.access.loadRoleConfig();
      const config = this.access.roleConfig();
      this.config.set(config);
      const roles = structuredClone(config?.roles ?? []).sort((a, b) => a.order - b.order);
      this.roles.set(roles);
      this.original = JSON.stringify(roles);
    } finally {
      this.loading.set(false);
    }
  }

  has(role: RoleDefinition, cap: MeetingCapability): boolean {
    return role.capabilities.includes(cap);
  }

  toggle(role: RoleDefinition, cap: MeetingCapability): void {
    this.patch(role, r => ({
      ...r,
      capabilities: r.capabilities.includes(cap) ? r.capabilities.filter(c => c !== cap) : [...r.capabilities, cap],
    }));
  }

  toggleGroup(role: RoleDefinition, items: CapabilityInfo[]): void {
    const all = items.every(i => role.capabilities.includes(i.name));
    this.patch(role, r => ({
      ...r,
      capabilities: all
        ? r.capabilities.filter(c => !items.some(i => i.name === c))
        : Array.from(new Set([...r.capabilities, ...items.map(i => i.name)])),
    }));
  }

  setFlag(role: RoleDefinition, flag: 'isUnique' | 'countsAsMember', value: boolean): void {
    this.patch(role, r => ({ ...r, [flag]: value }));
  }

  setKey(role: RoleDefinition, key: MeetingRoleKey): void {
    this.patch(role, r => ({ ...r, key }));
  }

  move(role: RoleDefinition, delta: -1 | 1): void {
    const list = [...this.roles()];
    const i = list.findIndex(r => r.roleId === role.roleId);
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.roles.set(list.map((r, idx) => ({ ...r, order: idx + 1 })));
  }

  discard(): void {
    this.roles.set(JSON.parse(this.original));
  }

  async save(): Promise<void> {
    if (this.saving() || !this.dirty()) return;
    if (this.warnings().length) {
      const confirm = await this.swal.fireSwal(this.warnings().join(' '), 'با وجود هشدارها ذخیره شود؟');
      if (!confirm.isConfirmed) return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.access.saveRoleConfig(this.roles()));
      this.original = JSON.stringify(this.roles());
      MeetingRoles.load(this.roles());
    } catch {
      // پیام خطا (اعتبارسنجی سرور) نمایش داده شده
    } finally {
      this.saving.set(false);
    }
  }

  async resetRole(role: RoleDefinition): Promise<void> {
    const confirm = await this.swal.fireSwal(`توانایی‌های نقش «${role.title}» به پیش‌فرض کلید سیستمی آن بازگردد؟`);
    if (!confirm.isConfirmed) return;
    try {
      await firstValueFrom(this.access.resetRole(role.roleId));
      await this.load();
    } catch { /* پیام نمایش داده شده */ }
  }

  private patch(role: RoleDefinition, fn: (r: RoleDefinition) => RoleDefinition): void {
    this.roles.update(list => list.map(r => r.roleId === role.roleId ? fn(r) : r));
  }
}
