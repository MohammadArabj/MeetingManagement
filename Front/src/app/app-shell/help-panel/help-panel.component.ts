import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

import { HelpService } from '../../core/help/help.service';
import { findHelpTopic, getHelpTopic, HELP_TOPICS, HelpTopic, refineHelpTopic } from '../../core/help/help-content';

/**
 * پنل راهنمای درون‌برنامه‌ای (کشوی کناری).
 *   • به‌صورت پیش‌فرض راهنمای صفحه‌ی جاری را نشان می‌دهد
 *   • جستجو در همه‌ی موضوعات، فهرست موضوعات و موضوعات مرتبط
 *   • F1 باز/بسته، Esc بسته
 */
@Component({
  selector: 'app-help-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (help.isOpen()) {
      <div class="hp-backdrop" (click)="help.close()"></div>
    }
    <aside class="hp" [class.open]="help.isOpen()" role="dialog" aria-label="راهنما" [attr.aria-hidden]="!help.isOpen()">
      <header class="hp-head">
        <div class="hp-title">
          <span class="hp-logo"><i class="fa fa-life-ring"></i></span>
          <div>
            <strong>راهنمای سامانه</strong>
            <small>F1 برای باز و بسته کردن</small>
          </div>
        </div>
        <button type="button" class="hp-close" (click)="help.close()" aria-label="بستن راهنما"><i class="fa fa-times"></i></button>
      </header>

      <div class="hp-search">
        <i class="fa fa-search"></i>
        <input #searchBox type="search" placeholder="جستجو در راهنما… (مثلاً امضا، ارجاع، چاپ)"
          [value]="query()" (input)="query.set($any($event.target).value)">
      </div>

      <nav class="hp-tabs">
        <button type="button" [class.active]="view() === 'topic'" (click)="showCurrent()">
          <i class="fa fa-location-dot"></i> این صفحه
        </button>
        <button type="button" [class.active]="view() === 'index'" (click)="view.set('index'); query.set('')">
          <i class="fa fa-list"></i> همه موضوعات
        </button>
      </nav>

      <div class="hp-body">
        @if (query().trim()) {
          <div class="hp-results">
            <div class="hp-muted">{{ results().length }} نتیجه برای «{{ query().trim() }}»</div>
            @for (r of results(); track r.topic.key) {
              <button type="button" class="hp-result" (click)="open(r.topic.key)">
                <span class="hp-ico"><i class="fa {{ r.topic.icon }}"></i></span>
                <span>
                  <strong>{{ r.topic.title }}</strong>
                  <small>{{ r.snippet }}</small>
                </span>
              </button>
            } @empty {
              <div class="hp-empty"><i class="fa fa-search"></i>موردی یافت نشد؛ عبارت دیگری را امتحان کنید.</div>
            }
          </div>
        } @else if (view() === 'index') {
          @for (group of groups; track group.name) {
            <div class="hp-group">{{ group.name }}</div>
            <div class="hp-grid">
              @for (t of group.items; track t.key) {
                <button type="button" class="hp-card" [class.current]="t.key === currentTopic().key" (click)="open(t.key)">
                  <span class="hp-ico"><i class="fa {{ t.icon }}"></i></span>
                  <span>{{ t.title }}</span>
                </button>
              }
            </div>
          }
        } @else {
          @let t = topic();
          <article class="hp-topic">
            <div class="hp-topic-head">
              <span class="hp-ico lg"><i class="fa {{ t.icon }}"></i></span>
              <div>
                <span class="hp-chip">{{ t.group }}</span>
                <h5>{{ t.title }}</h5>
              </div>
            </div>
            <p class="hp-summary">{{ t.summary }}</p>

            @for (s of t.sections; track s.title) {
              <section class="hp-section">
                <h6>{{ s.title }}</h6>
                @if (s.text) { <p>{{ s.text }}</p> }
                @if (s.items?.length) {
                  @if (s.steps) {
                    <ol class="hp-steps">@for (i of s.items; track $index) { <li>{{ i }}</li> }</ol>
                  } @else {
                    <ul class="hp-list">@for (i of s.items; track $index) { <li>{{ i }}</li> }</ul>
                  }
                }
              </section>
            }

            @if (related().length) {
              <div class="hp-related">
                <span class="hp-muted">موضوعات مرتبط:</span>
                @for (r of related(); track r.key) {
                  <button type="button" class="hp-pill" (click)="open(r.key)"><i class="fa {{ r.icon }}"></i>{{ r.title }}</button>
                }
              </div>
            }
          </article>
        }
      </div>

      <footer class="hp-foot">
        <button type="button" class="hp-link" (click)="open('faq')"><i class="fa fa-circle-question"></i> پرسش‌های پرتکرار</button>
        <button type="button" class="hp-link" (click)="open('shortcuts')"><i class="fa fa-keyboard"></i> میان‌برها</button>
      </footer>
    </aside>
  `,
  styleUrl: './help-panel.component.css',
})
export class HelpPanelComponent {
  readonly help = inject(HelpService);
  private readonly router = inject(Router);
  private readonly searchBox = viewChild<ElementRef<HTMLInputElement>>('searchBox');

  readonly view = signal<'topic' | 'index'>('topic');
  readonly query = signal('');
  private readonly selectedKey = signal<string | null>(null);

  private readonly url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(e => (e as NavigationEnd).urlAfterRedirects)),
    { initialValue: this.router.url },
  );

  readonly currentTopic = computed(() => findHelpTopic(this.url()));
  readonly topic = computed<HelpTopic>(() => {
    const key = this.selectedKey();
    return (key && getHelpTopic(key)) || this.currentTopic();
  });
  readonly related = computed(() => (this.topic().related ?? []).map(k => getHelpTopic(k)).filter((t): t is HelpTopic => !!t));

  readonly groups = Array.from(new Set(HELP_TOPICS.map(t => t.group))).map(name => ({
    name,
    items: HELP_TOPICS.filter(t => t.group === name),
  }));

  /** جستجوی ساده در عنوان، خلاصه و متن بخش‌ها (حساس به ی/ک عربی نیست) */
  readonly results = computed(() => {
    const terms = normalize(this.query()).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return HELP_TOPICS
      .map(topic => {
        const parts = [topic.title, topic.summary, ...topic.sections.flatMap(s => [s.title, s.text ?? '', ...(s.items ?? [])])];
        const haystack = normalize(parts.join(' '));
        if (!terms.every(t => haystack.includes(t))) return null;
        const score = terms.reduce((acc, t) => acc + (normalize(topic.title).includes(t) ? 5 : 0) + (normalize(topic.summary).includes(t) ? 2 : 0), 0);
        const hit = parts.find(p => terms.some(t => normalize(p).includes(t)) && p !== topic.title) ?? topic.summary;
        return { topic, score, snippet: hit.length > 120 ? hit.slice(0, 117) + '…' : hit };
      })
      .filter((r): r is { topic: HelpTopic; score: number; snippet: string } => !!r)
      .sort((a, b) => b.score - a.score);
  });

  constructor() {
    // درخواست موضوع مشخص از بیرون (help.open('minutes'))
    effect(() => {
      if (!this.help.isOpen()) return;
      // موضوع درخواستی، یا موضوع بخش فعال صفحه (مثلاً تب «صورتجلسه» در جزئیات جلسه)
      const requested = this.help.topic() ?? refineHelpTopic(this.currentTopic()).key;
      this.selectedKey.set(requested === this.currentTopic().key ? null : requested);
      this.view.set('topic');
      queueMicrotask(() => this.searchBox()?.nativeElement.focus({ preventScroll: true }));
    });
    // با تغییر صفحه، راهنمای صفحه‌ی جدید نشان داده شود
    effect(() => {
      this.url();
      this.selectedKey.set(null);
    });
  }

  open(key: string): void {
    this.selectedKey.set(key);
    this.query.set('');
    this.view.set('topic');
  }

  showCurrent(): void {
    this.selectedKey.set(null);
    this.query.set('');
    this.view.set('topic');
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'F1') {
      event.preventDefault();
      this.help.toggle();
    } else if (event.key === 'Escape' && this.help.isOpen()) {
      this.help.close();
    }
  }
}

function normalize(text: string): string {
  return (text || '').toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ');
}
