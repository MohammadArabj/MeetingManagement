// ============================================================
// completion-effect.component.ts
// رندرکننده‌ی قابل استفاده‌ی مجدد جلوه‌های صفحه‌ی تشکر
// (confetti | fireworks | balloons | stars | hearts | ribbons | none)
//
// نمونه‌ی استفاده (تمام‌صفحه، یک‌بار پخش):
//   <app-completion-effect [effect]="survey.completionEffect" [play]="done()" [duration]="5000" />
// پیش‌نمایش داخل یک کادر (تکرارشونده):
//   <app-completion-effect effect="hearts" [contained]="true" [loop]="true" [density]="0.5" />
// پخش مجدد: مقدار ورودی [trigger] را تغییر دهید (مثلاً یک شمارنده).
//
// - Canvas محور، بدون کتابخانه‌ی خارجی
// - pointer-events: none و aria-hidden
// - در prefers-reduced-motion فقط یک فریم ثابت نمایش داده می‌شود
// - پس از پایان یا Destroy همه‌چیز پاک‌سازی می‌شود
// ============================================================

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import {
  CompletionEffectKind,
  EffectBounds,
  EffectSim,
  computeBounds,
  createEffectSim,
  toEffectKind,
} from './completion-effect.engine';

export { toEffectKind } from './completion-effect.engine';
export type { CompletionEffectKind } from './completion-effect.engine';

@Component({
  selector: 'app-completion-effect',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #cv></canvas>`,
  host: {
    'aria-hidden': 'true',
    '[class.contained]': 'contained()',
  },
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      z-index: 10000;
      pointer-events: none;
      display: block;
      overflow: hidden;
    }
    :host(.contained) {
      position: absolute;
      z-index: auto;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
  `],
})
export class CompletionEffectComponent {
  /** نوع جلوه؛ null/نامعتبر => confetti */
  readonly effect = input<string | null | undefined>('confetti');
  /** وقتی true شود پخش آغاز می‌شود؛ false => توقف و پاک‌سازی */
  readonly play = input<boolean>(true);
  /** هر تغییر در این مقدار، پخش را از نو آغاز می‌کند */
  readonly trigger = input<unknown>(undefined);
  /** مدت زمان تولید ذرات (میلی‌ثانیه)؛ ذرات موجود پس از آن به‌طور طبیعی خارج می‌شوند */
  readonly duration = input<number>(4500);
  /** تکرار بی‌پایان (برای پیش‌نمایش) */
  readonly loop = input<boolean>(false);
  /** داخل والد (position:absolute) به‌جای تمام‌صفحه */
  readonly contained = input<boolean>(false);
  /** ضریب تراکم ذرات (۰٫۱ تا ۳) */
  readonly density = input<number>(1);
  /** پالت رنگ دلخواه */
  readonly colors = input<string[] | null>(null);

  /** پس از پایان کامل پخش (غیرتکراری) */
  readonly finished = output<void>();

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('cv');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private ctx: CanvasRenderingContext2D | null = null;
  private sim: EffectSim | null = null;
  private bounds: EffectBounds = computeBounds(0, 0);
  private dpr = 1;
  private raf = 0;
  private startTs = 0;
  private lastTs = 0;
  private durationMs = 4500;
  private looping = false;
  private ro: ResizeObserver | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const kind = toEffectKind(this.effect());
      const play = this.play();
      this.trigger();
      const duration = this.duration();
      const loop = this.loop();
      const density = this.density();
      const colors = this.colors();
      if (!canvas) return;
      untracked(() => this.restart(canvas, kind, play, duration, loop, density, colors));
    });

    inject(DestroyRef).onDestroy(() => {
      this.stop();
      this.ro?.disconnect();
      this.ro = null;
    });
  }

  // ------------------------------------------------------------
  private restart(
    canvas: HTMLCanvasElement,
    kind: CompletionEffectKind,
    play: boolean,
    duration: number,
    loop: boolean,
    density: number,
    colors: string[] | null,
  ): void {
    this.stop();
    if (typeof window === 'undefined') return;

    this.ctx = canvas.getContext('2d');
    this.ensureResizeObserver(canvas);
    this.measure(canvas);

    if (!play || kind === 'none' || !this.ctx) return;

    this.sim = createEffectSim(kind, this.bounds, colors ?? undefined, density);
    if (!this.sim) return;

    this.durationMs = Math.max(300, duration || 0);
    this.looping = loop;

    if (this.prefersReducedMotion()) {
      // فقط یک فریم ثابت (بدون حرکت)
      for (let i = 0; i < 45; i++) this.sim.step(1 / 30, true);
      this.render();
      if (!loop) {
        this.stopTimer = setTimeout(() => { this.stop(); this.finished.emit(); }, this.durationMs);
      }
      return;
    }

    this.startTs = 0;
    this.lastTs = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  private readonly tick = (ts: number): void => {
    if (!this.sim) return;
    if (!this.startTs) { this.startTs = ts; this.lastTs = ts; }
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    const elapsed = ts - this.startTs;
    const spawning = this.looping || elapsed < this.durationMs;

    this.sim.step(dt, spawning);
    this.render();

    // پایان طبیعی یا سقف ایمنی
    if (!this.looping && (elapsed > this.durationMs + 8000 || (!spawning && this.sim.isEmpty()))) {
      this.stop();
      this.finished.emit();
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private render(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sim) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.bounds.w, this.bounds.h);
    this.sim.draw(ctx);
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = null;
    this.sim = null;
    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }
  }

  private ensureResizeObserver(canvas: HTMLCanvasElement): void {
    if (this.ro || typeof ResizeObserver === 'undefined') return;
    this.ro = new ResizeObserver(() => {
      this.measure(canvas);
      // در حالت reduced-motion یا بعد از تغییر اندازه، فریم جاری را دوباره رسم کن
      if (this.sim && !this.raf) this.render();
    });
    this.ro.observe(this.host.nativeElement);
  }

  private measure(canvas: HTMLCanvasElement): void {
    const rect = this.host.nativeElement.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || window.innerWidth));
    const h = Math.max(1, Math.round(rect.height || window.innerHeight));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(w * this.dpr), ph = Math.round(h * this.dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    computeBounds(w, h, this.bounds);
  }

  private prefersReducedMotion(): boolean {
    try {
      return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }
}
