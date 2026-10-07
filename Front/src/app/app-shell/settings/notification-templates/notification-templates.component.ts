import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { debounceTime, distinctUntilChanged, firstValueFrom, Subject, switchMap, catchError, of } from 'rxjs';
import { NotificationCenterService, NotificationEvent, NotificationTemplate, TemplatePreview } from '../../../services/notification-center.service';
import { ToastService } from '../../../services/framework-services/toast.service';
import { SwalService } from '../../../services/framework-services/swal.service';

interface Draft { id: number | null; title: string; content: string; }

/**
 * ویرایشگر قالب پیام‌ها: درج متغیر در محل مکان‌نما، پیش‌نمایش زنده با داده نمونه،
 * شمارش کاراکتر و تعداد بخش پیامک، و تشخیص متغیرهای ناشناخته.
 */
@Component({
  selector: 'app-notification-templates',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-templates.component.html',
  styleUrl: './notification-templates.component.css',
})
export class NotificationTemplatesComponent implements OnInit {
  private readonly api = inject(NotificationCenterService);
  private readonly toast = inject(ToastService);
  private readonly swal = inject(SwalService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly events = signal<NotificationEvent[]>([]);
  readonly placeholders = signal<{ key: string; title: string }[]>([]);
  readonly selectedCode = signal<string | null>(null);
  readonly draft = signal<Draft>({ id: null, title: '', content: '' });
  readonly preview = signal<TemplatePreview | null>(null);

  readonly selectedEvent = computed(() => this.events().find(e => e.code === this.selectedCode()) ?? null);
  readonly templates = computed<NotificationTemplate[]>(() => this.selectedEvent()?.templates ?? []);
  readonly isActive = computed(() => !!this.draft().id && this.selectedEvent()?.templateId === this.draft().id);
  readonly canSave = computed(() => !!this.selectedCode() && this.draft().title.trim() !== '' && this.draft().content.trim() !== ''
    && (this.preview()?.unknownPlaceholders.length ?? 0) === 0);

  private readonly content$ = new Subject<string>();

  constructor() {
    this.content$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(content => content.trim() ? this.api.preview(content).pipe(catchError(() => of(null))) : of(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(p => this.preview.set(p));
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [events, placeholders] = await Promise.all([
        firstValueFrom(this.api.getEvents()),
        firstValueFrom(this.api.getPlaceholders()),
      ]);
      this.events.set(events ?? []);
      this.placeholders.set(Object.entries(placeholders ?? {}).map(([key, title]) => ({ key, title })));

      const requested = this.route.snapshot.queryParamMap.get('event');
      const first = this.events().find(e => e.code === requested) ?? this.events()[0];
      if (first) this.selectEvent(first.code);
    } finally {
      this.loading.set(false);
    }
  }

  selectEvent(code: string): void {
    this.selectedCode.set(code);
    const event = this.events().find(e => e.code === code);
    const active = event?.templates.find(t => t.id === event.templateId) ?? event?.templates[0];
    if (active) this.edit(active);
    else this.newTemplate();
  }

  edit(t: NotificationTemplate): void {
    this.draft.set({ id: t.id, title: t.title, content: t.content });
    this.content$.next(t.content);
  }

  newTemplate(): void {
    const ev = this.selectedEvent();
    this.draft.set({ id: null, title: ev ? `قالب جدید - ${ev.title}` : '', content: ev?.defaultTemplate ?? '' });
    this.content$.next(this.draft().content);
  }

  setTitle(title: string): void { this.draft.update(d => ({ ...d, title })); }

  setContent(content: string): void {
    this.draft.update(d => ({ ...d, content }));
    this.content$.next(content);
  }

  /** درج متغیر در محل مکان‌نما */
  insert(key: string): void {
    const el = this.editor()?.nativeElement;
    const token = `{${key}}`;
    const content = this.draft().content;
    if (!el) { this.setContent(content + token); return; }

    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + token + content.slice(end);
    this.setContent(next);
    queueMicrotask(() => { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; });
  }

  async save(setActive: boolean): Promise<void> {
    const code = this.selectedCode();
    if (!code || !this.canSave() || this.saving()) return;

    this.saving.set(true);
    try {
      const d = this.draft();
      const id = await firstValueFrom(this.api.saveTemplate({ id: d.id, eventCode: code, title: d.title.trim(), content: d.content.trim(), setActive }));
      await this.reload(code);
      const saved = this.templates().find(t => t.id === id);
      if (saved) this.edit(saved);
    } catch {
      // پیام خطا نمایش داده شده
    } finally {
      this.saving.set(false);
    }
  }

  async remove(t: NotificationTemplate): Promise<void> {
    const result = await this.swal.fireSwal(`قالب «${t.title}» حذف شود؟`);
    if (!result.isConfirmed) return;
    try {
      await firstValueFrom(this.api.deleteTemplate(t.id));
      await this.reload(this.selectedCode()!);
      this.selectEvent(this.selectedCode()!);
    } catch { /* پیام نمایش داده شده */ }
  }

  partsClass(): string {
    const parts = this.preview()?.smsParts ?? 0;
    return parts <= 1 ? 'text-success' : parts <= 2 ? 'text-warning' : 'text-danger';
  }

  private async reload(code: string): Promise<void> {
    this.events.set(await firstValueFrom(this.api.getEvents()) ?? []);
    this.selectedCode.set(code);
  }
}
