// ============================================================
// completion-effect.engine.ts
// موتور سبک (بدون کتابخانه‌ی خارجی) برای جلوه‌های صفحه‌ی تشکر.
// هر جلوه یک «شبیه‌ساز» است که روی Canvas دوبعدی رسم می‌شود.
// ============================================================

export type CompletionEffectKind =
  | 'confetti' | 'fireworks' | 'balloons' | 'stars' | 'hearts' | 'ribbons' | 'none';

export const COMPLETION_EFFECT_KINDS: CompletionEffectKind[] =
  ['confetti', 'fireworks', 'balloons', 'stars', 'hearts', 'ribbons', 'none'];

/** null / ناشناخته => confetti (مطابق پیش‌فرض بک‌اند) */
export function toEffectKind(v: unknown): CompletionEffectKind {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return (COMPLETION_EFFECT_KINDS as string[]).includes(s) ? (s as CompletionEffectKind) : 'confetti';
}

export const DEFAULT_EFFECT_PALETTE = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6',
];

/** ابعاد زنده‌ی بوم (با تغییر اندازه به‌روز می‌شود) */
export interface EffectBounds {
  w: number;
  h: number;
  /** ضریب مقیاس اندازه‌ی ذرات نسبت به یک صفحه‌ی معمولی */
  s: number;
  /** ضریب تعداد ذرات بر اساس عرض بوم */
  area: number;
}

export interface EffectSim {
  /** dt بر حسب ثانیه */
  step(dt: number, spawning: boolean): void;
  draw(ctx: CanvasRenderingContext2D): void;
  isEmpty(): boolean;
}

export function computeBounds(w: number, h: number, b?: EffectBounds): EffectBounds {
  const out = b ?? { w: 0, h: 0, s: 1, area: 1 };
  out.w = w;
  out.h = h;
  out.s = clamp(Math.min(w, h) / 560, 0.28, 1.25);
  out.area = clamp(w / 900, 0.18, 2);
  return out;
}

// ------------------------------------------------------------
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

/** نرخ تولید پیوسته: انباشته‌ی کسری را نگه می‌دارد */
class Spawner {
  private acc = 0;
  constructor(private perSecond: () => number) {}
  count(dt: number): number {
    this.acc += this.perSecond() * dt;
    const n = Math.floor(this.acc);
    this.acc -= n;
    return n;
  }
}

function hexToRgba(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ============================================================
// Confetti — قطعات کاغذ رنگی که با چرخش و تاب‌خوردن می‌افتند
// ============================================================
interface ConfettiP {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; rot: number; vr: number;
  tilt: number; vt: number; sway: number; phase: number;
  color: string; shape: 0 | 1 | 2;
}

class ConfettiSim implements EffectSim {
  private ps: ConfettiP[] = [];
  private spawner: Spawner;
  private burstDone = false;

  constructor(private b: EffectBounds, private colors: string[], density: number) {
    this.spawner = new Spawner(() => 70 * density * this.b.area);
  }

  private add(fromBurst: boolean) {
    const s = this.b.s;
    const size = rand(6, 11) * s;
    this.ps.push({
      x: rand(0, this.b.w),
      y: fromBurst ? rand(-this.b.h * 0.35, -10) : rand(-30, -10) * s,
      vx: rand(-30, 30) * s,
      vy: rand(60, 140) * s,
      w: size, h: size * rand(0.45, 0.7),
      rot: rand(0, Math.PI * 2), vr: rand(-6, 6),
      tilt: rand(0, Math.PI * 2), vt: rand(4, 10),
      sway: rand(12, 30) * s, phase: rand(0, Math.PI * 2),
      color: pick(this.colors),
      shape: pick([0, 0, 0, 1, 2]) as 0 | 1 | 2,
    });
  }

  step(dt: number, spawning: boolean) {
    if (spawning && !this.burstDone) {
      this.burstDone = true;
      const n = Math.round(60 * this.b.area);
      for (let i = 0; i < n; i++) this.add(true);
    }
    if (spawning) for (let i = this.spawner.count(dt); i > 0; i--) this.add(false);

    const g = 140 * this.b.s;
    const term = 210 * this.b.s;
    for (const p of this.ps) {
      p.vy = Math.min(p.vy + g * dt, term);
      p.phase += dt * 3;
      p.x += (p.vx + Math.sin(p.phase) * p.sway) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.tilt += p.vt * dt;
    }
    this.ps = this.ps.filter(p => p.y < this.b.h + 30);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.ps) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      const flip = Math.abs(Math.cos(p.tilt));
      if (p.shape === 1) {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.w * 0.45, p.w * 0.45 * Math.max(flip, 0.2), 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 2) {
        ctx.fillRect(-p.w * 0.9, -p.h * 0.18 * Math.max(flip, 0.25), p.w * 1.8, p.h * 0.36 * Math.max(flip, 0.25));
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2 * Math.max(flip, 0.15), p.w, p.h * Math.max(flip, 0.15));
      }
      ctx.restore();
    }
  }

  isEmpty() { return this.ps.length === 0; }
}

// ============================================================
// Fireworks — موشک‌هایی که بالا می‌روند و منفجر می‌شوند
// ============================================================
interface Rocket { x: number; y: number; vy: number; color: string; }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; }

class FireworksSim implements EffectSim {
  private rockets: Rocket[] = [];
  private sparks: Spark[] = [];
  private spawner: Spawner;
  private first = true;

  constructor(private b: EffectBounds, private colors: string[], private density: number) {
    this.spawner = new Spawner(() => 1.8 * density * clamp(this.b.area * 1.5, 0.7, 2.2));
  }

  private launch() {
    const g = this.gravity();
    const targetY = rand(this.b.h * 0.12, this.b.h * 0.45);
    this.rockets.push({
      x: rand(this.b.w * 0.12, this.b.w * 0.88),
      y: this.b.h + 4,
      vy: -Math.sqrt(2 * g * (this.b.h + 4 - targetY)),
      color: pick(this.colors),
    });
  }

  private gravity() { return 320 * this.b.s; }

  private explode(r: Rocket) {
    const n = Math.round(rand(36, 56) * clamp(this.density, 0.4, 2));
    const speed = rand(120, 190) * this.b.s;
    const second = Math.random() < 0.5 ? pick(this.colors) : r.color;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.08, 0.08);
      const sp = speed * rand(0.55, 1);
      const max = rand(0.9, 1.5);
      this.sparks.push({
        x: r.x, y: r.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: max, max,
        color: i % 3 === 0 ? second : r.color,
        r: rand(1.4, 2.4) * this.b.s + 0.6,
      });
    }
  }

  step(dt: number, spawning: boolean) {
    if (spawning && this.first) { this.first = false; this.launch(); this.launch(); }
    if (spawning) for (let i = this.spawner.count(dt); i > 0; i--) this.launch();

    const g = this.gravity();
    for (const r of this.rockets) {
      r.vy += g * dt;
      r.y += r.vy * dt;
    }
    const exploding = this.rockets.filter(r => r.vy >= 0);
    exploding.forEach(r => this.explode(r));
    this.rockets = this.rockets.filter(r => r.vy < 0);

    const drag = Math.pow(0.35, dt);
    const sg = 70 * this.b.s;
    for (const p of this.sparks) {
      p.vx *= drag;
      p.vy = p.vy * drag + sg * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.sparks = this.sparks.filter(p => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.lineCap = 'round';
    for (const r of this.rockets) {
      ctx.strokeStyle = hexToRgba(r.color, 0.9);
      ctx.lineWidth = 2 * this.b.s + 0.5;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x, r.y - r.vy * 0.05);
      ctx.stroke();
    }
    for (const p of this.sparks) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.strokeStyle = hexToRgba(p.color, a);
      ctx.lineWidth = p.r;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
      ctx.stroke();
      if (a > 0.6) {
        ctx.fillStyle = hexToRgba('#ffffff', (a - 0.6) * 1.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  isEmpty() { return this.rockets.length === 0 && this.sparks.length === 0; }
}

// ============================================================
// Balloons — بادکنک‌هایی که با تاب ملایم بالا می‌روند
// ============================================================
interface Balloon { x: number; y: number; vy: number; r: number; sway: number; phase: number; freq: number; color: string; }

class BalloonsSim implements EffectSim {
  private ps: Balloon[] = [];
  private spawner: Spawner;
  private first = true;

  constructor(private b: EffectBounds, private colors: string[], density: number) {
    this.spawner = new Spawner(() => 4 * density * clamp(this.b.area * 1.3, 0.5, 2.4));
  }

  private add(y?: number) {
    const s = this.b.s;
    const r = rand(18, 30) * s;
    this.ps.push({
      x: rand(r, this.b.w - r), y: y ?? this.b.h + r * 1.3,
      vy: -rand(70, 120) * s, r,
      sway: rand(8, 22) * s, phase: rand(0, Math.PI * 2), freq: rand(1, 2),
      color: pick(this.colors),
    });
  }

  step(dt: number, spawning: boolean) {
    if (spawning && this.first) {
      this.first = false;
      const n = Math.max(2, Math.round(5 * this.b.area));
      for (let i = 0; i < n; i++) this.add(this.b.h + rand(10, this.b.h * 0.4));
    }
    if (spawning) for (let i = this.spawner.count(dt); i > 0; i--) this.add();
    for (const p of this.ps) {
      p.phase += dt * p.freq;
      p.y += p.vy * dt;
    }
    this.ps = this.ps.filter(p => p.y > -p.r * 5);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.ps) {
      const x = p.x + Math.sin(p.phase) * p.sway;
      const y = p.y;
      const rx = p.r, ry = p.r * 1.2;
      // نخ
      ctx.strokeStyle = 'rgba(100,116,139,0.55)';
      ctx.lineWidth = Math.max(0.6, this.b.s);
      ctx.beginPath();
      ctx.moveTo(x, y + ry);
      const len = ry * 2.2;
      const tilt = Math.cos(p.phase) * p.sway * 0.6;
      ctx.bezierCurveTo(x - tilt, y + ry + len * 0.33, x + tilt, y + ry + len * 0.66, x - tilt * 0.5, y + ry + len);
      ctx.stroke();
      // گره
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(x, y + ry - 1);
      ctx.lineTo(x - rx * 0.16, y + ry + rx * 0.2);
      ctx.lineTo(x + rx * 0.16, y + ry + rx * 0.2);
      ctx.closePath();
      ctx.fill();
      // بدنه با براق‌شدگی
      const grad = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.4, rx * 0.1, x, y, ry);
      grad.addColorStop(0, hexToRgba('#ffffff', 0.85));
      grad.addColorStop(0.25, p.color);
      grad.addColorStop(1, p.color);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  isEmpty() { return this.ps.length === 0; }
}

// ============================================================
// Stars — ستاره‌های چشمک‌زن که ظاهر و محو می‌شوند
// ============================================================
interface StarP { x: number; y: number; size: number; life: number; max: number; rot: number; vr: number; color: string; points: 4 | 5; vy: number; }

const STAR_COLORS = ['#fbbf24', '#fde68a', '#f59e0b', '#ffffff', '#a5b4fc'];

class StarsSim implements EffectSim {
  private ps: StarP[] = [];
  private spawner: Spawner;
  private first = true;

  constructor(private b: EffectBounds, private colors: string[], density: number) {
    this.spawner = new Spawner(() => 14 * density * clamp(this.b.area * 1.4, 0.45, 2.4));
  }

  private add() {
    const max = rand(1.1, 2.1);
    this.ps.push({
      x: rand(0, this.b.w), y: rand(0, this.b.h),
      size: rand(6, 16) * this.b.s + 1.5,
      life: max, max,
      rot: rand(0, Math.PI), vr: rand(-1.2, 1.2),
      color: Math.random() < 0.7 ? pick(STAR_COLORS) : pick(this.colors),
      points: Math.random() < 0.65 ? 5 : 4,
      vy: -rand(4, 16) * this.b.s,
    });
  }

  step(dt: number, spawning: boolean) {
    if (spawning && this.first) {
      this.first = false;
      const n = Math.round(10 * clamp(this.b.area * 1.4, 0.45, 2.4));
      for (let i = 0; i < n; i++) { this.add(); this.ps[this.ps.length - 1].life *= Math.random(); }
    }
    if (spawning) for (let i = this.spawner.count(dt); i > 0; i--) this.add();
    for (const p of this.ps) {
      p.life -= dt;
      p.rot += p.vr * dt;
      p.y += p.vy * dt;
    }
    this.ps = this.ps.filter(p => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.ps) {
      const t = 1 - p.life / p.max;               // 0 → 1
      const k = Math.sin(Math.PI * t);             // بزرگ و کوچک شدن
      const twinkle = 0.75 + 0.25 * Math.sin(t * Math.PI * 6);
      const size = p.size * k * twinkle;
      if (size <= 0.2) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      // هاله
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.8);
      halo.addColorStop(0, hexToRgba(p.color.startsWith('#') ? p.color : '#ffffff', 0.35 * k));
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.8, 0, Math.PI * 2);
      ctx.fill();
      // ستاره
      ctx.globalAlpha = clamp(k * 1.2, 0, 1);
      ctx.fillStyle = p.color;
      starPath(ctx, p.points, size, p.points === 5 ? size * 0.45 : size * 0.22);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  isEmpty() { return this.ps.length === 0; }
}

function starPath(ctx: CanvasRenderingContext2D, points: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / points - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ============================================================
// Hearts — قلب‌هایی که از پایین شناور می‌شوند و محو می‌شوند
// ============================================================
interface HeartP { x: number; y: number; vy: number; size: number; sway: number; phase: number; color: string; startY: number; }

const HEART_COLORS = ['#ef4444', '#ec4899', '#f43f5e', '#fb7185', '#f472b6', '#e11d48'];

class HeartsSim implements EffectSim {
  private ps: HeartP[] = [];
  private spawner: Spawner;
  private first = true;

  constructor(private b: EffectBounds, private colors: string[], density: number) {
    this.spawner = new Spawner(() => 7 * density * clamp(this.b.area * 1.4, 0.5, 2.4));
  }

  private add(y?: number) {
    const s = this.b.s;
    const startY = y ?? this.b.h + 20 * s;
    this.ps.push({
      x: rand(0, this.b.w), y: startY, startY,
      vy: -rand(60, 120) * s,
      size: rand(10, 22) * s + 2,
      sway: rand(8, 24) * s, phase: rand(0, Math.PI * 2),
      color: Math.random() < 0.75 ? pick(HEART_COLORS) : pick(this.colors),
    });
  }

  step(dt: number, spawning: boolean) {
    if (spawning && this.first) {
      this.first = false;
      const n = Math.max(2, Math.round(6 * this.b.area));
      for (let i = 0; i < n; i++) this.add(this.b.h + rand(0, this.b.h * 0.3));
    }
    if (spawning) for (let i = this.spawner.count(dt); i > 0; i--) this.add();
    for (const p of this.ps) {
      p.phase += dt * 2;
      p.y += p.vy * dt;
    }
    this.ps = this.ps.filter(p => p.y > -p.size * 2 && this.alpha(p) > 0.01);
  }

  private alpha(p: HeartP) {
    const travelled = (p.startY - p.y) / Math.max(1, this.b.h);
    return clamp(1 - travelled * 0.95, 0, 1) * clamp((p.startY - p.y) / (p.size * 2) + 0.3, 0, 1);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.ps) {
      const x = p.x + Math.sin(p.phase) * p.sway;
      ctx.save();
      ctx.globalAlpha = this.alpha(p);
      ctx.translate(x, p.y);
      ctx.rotate(Math.sin(p.phase) * 0.25);
      ctx.fillStyle = p.color;
      heartPath(ctx, p.size);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(-p.size * 0.28, -p.size * 0.22, p.size * 0.12, p.size * 0.07, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  isEmpty() { return this.ps.length === 0; }
}

function heartPath(ctx: CanvasRenderingContext2D, size: number) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.9);
  ctx.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.8, -s * 1.15, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 0.8, -s * 1.15, s * 1.4, -s * 0.1, 0, s * 0.9);
  ctx.closePath();
}

// ============================================================
// Ribbons — نوارهای پیچ‌دار (استریمر) که موج‌زنان می‌افتند
// ============================================================
interface RibbonP { x: number; y: number; vx: number; vy: number; len: number; width: number; amp: number; phase: number; speed: number; angle: number; color: string; }

class RibbonsSim implements EffectSim {
  private ps: RibbonP[] = [];
  private spawner: Spawner;
  private first = true;

  constructor(private b: EffectBounds, private colors: string[], density: number) {
    this.spawner = new Spawner(() => 11 * density * clamp(this.b.area * 1.3, 0.4, 2.4));
  }

  private add(burst = false) {
    const s = this.b.s;
    const len = rand(45, 90) * s + 8;
    this.ps.push({
      x: rand(0, this.b.w), y: burst ? rand(-this.b.h * 0.5, -len) : -len,
      vx: rand(-20, 20) * s, vy: rand(70, 130) * s,
      len, width: rand(3, 6) * s + 1,
      amp: rand(4, 9) * s + 1, phase: rand(0, Math.PI * 2), speed: rand(5, 9),
      angle: rand(-0.35, 0.35),
      color: pick(this.colors),
    });
  }

  step(dt: number, spawning: boolean) {
    if (spawning && this.first) {
      this.first = false;
      const n = Math.round(14 * clamp(this.b.area * 1.3, 0.4, 2.4));
      for (let i = 0; i < n; i++) this.add(true);
    }
    if (spawning) for (let i = this.spawner.count(dt); i > 0; i--) this.add();
    for (const p of this.ps) {
      p.phase += p.speed * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += Math.sin(p.phase * 0.3) * 0.2 * dt;
    }
    this.ps = this.ps.filter(p => p.y - p.len < this.b.h + 10);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const segs = 14;
    for (const p of this.ps) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width;
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const yy = -t * p.len;
        const xx = Math.sin(p.phase + t * 7) * p.amp;
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      // سایه‌ی روشن برای حس پیچ‌خوردگی
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(0.6, p.width * 0.35);
      ctx.beginPath();
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const yy = -t * p.len;
        const xx = Math.sin(p.phase + t * 7) * p.amp - p.width * 0.2;
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  isEmpty() { return this.ps.length === 0; }
}

// ============================================================
export function createEffectSim(
  kind: CompletionEffectKind,
  bounds: EffectBounds,
  colors: string[] = DEFAULT_EFFECT_PALETTE,
  density = 1,
): EffectSim | null {
  const palette = colors?.length ? colors : DEFAULT_EFFECT_PALETTE;
  const d = clamp(density, 0.1, 3);
  switch (kind) {
    case 'confetti': return new ConfettiSim(bounds, palette, d);
    case 'fireworks': return new FireworksSim(bounds, palette, d);
    case 'balloons': return new BalloonsSim(bounds, palette, d);
    case 'stars': return new StarsSim(bounds, palette, d);
    case 'hearts': return new HeartsSim(bounds, palette, d);
    case 'ribbons': return new RibbonsSim(bounds, palette, d);
    default: return null;
  }
}
