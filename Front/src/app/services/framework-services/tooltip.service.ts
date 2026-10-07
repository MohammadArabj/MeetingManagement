import { Injectable, NgZone } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FlyTooltipService {
    private el: HTMLDivElement | null = null;
    private contentEl: HTMLDivElement | null = null;
    private titleEl: HTMLDivElement | null = null;

    private isOverTarget = false;
    private isOverTooltip = false;
    private hideTimer: any = null;

    constructor(private zone: NgZone) {
        // ✅ اضافه شده: مخفی کردن tooltip هنگام navigation
        this.zone.runOutsideAngular(() => {
            // مخفی کردن tooltip هنگام کلیک در هر جای صفحه
            document.addEventListener('click', () => this.hide(true), true);

            // مخفی کردن tooltip هنگام فشردن Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.hide(true);
            });
        });
    }

    show(opts: { target: HTMLElement; title: string; content: string }) {
        const { target, title, content } = opts;
        if (!content?.trim()) return;

        this.ensureElement();
        if (!this.el || !this.contentEl || !this.titleEl) return;

        this.isOverTarget = true;
        this.isOverTooltip = false;

        this.titleEl.textContent = title || 'محتوا';
        this.contentEl.textContent = content;

        this.el.style.display = 'block';
        this.positionToTarget(target);

        this.zone.runOutsideAngular(() => {
            const onScroll = () => this.positionToTarget(target);
            const onResize = () => this.positionToTarget(target);

            window.addEventListener('scroll', onScroll, true);
            window.addEventListener('resize', onResize);

            (this.el as any).__cleanup = () => {
                window.removeEventListener('scroll', onScroll, true);
                window.removeEventListener('resize', onResize);
            };
        });

        this.cancelHide();
    }

    targetEnter() {
        this.isOverTarget = true;
        this.cancelHide();
    }

    targetLeave() {
        this.isOverTarget = false;
        this.scheduleHide();
    }

    hide(force = false) {
        if (!this.el) return;

        if (!force && (this.isOverTarget || this.isOverTooltip)) return;

        this.cancelHide();

        // ✅ ریست کردن state ها
        this.isOverTarget = false;
        this.isOverTooltip = false;

        this.el.style.display = 'none';

        const cleanup = (this.el as any).__cleanup as (() => void) | undefined;
        if (cleanup) cleanup();
        (this.el as any).__cleanup = null;
    }

    // ✅ اضافه شده: متد عمومی برای مخفی کردن فوری
    forceHide() {
        this.hide(true);
    }

    private scheduleHide() {
        this.cancelHide();
        this.hideTimer = setTimeout(() => {
            if (!this.isOverTarget && !this.isOverTooltip) this.hide(true);
        }, 120);
    }

    private cancelHide() {
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
    }

    private ensureElement() {
        if (this.el) return;

        const root = document.createElement('div');
        root.className = 'fly-tooltip';
        root.style.display = 'none';

        const header = document.createElement('div');
        header.className = 'fly-tooltip__header';

        const title = document.createElement('div');
        title.className = 'fly-tooltip__title';

        header.appendChild(title);

        const body = document.createElement('div');
        body.className = 'fly-tooltip__body';
        body.tabIndex = 0;

        root.appendChild(header);
        root.appendChild(body);
        document.body.appendChild(root);

        root.addEventListener('mouseenter', () => {
            this.isOverTooltip = true;
            this.cancelHide();
        });

        root.addEventListener('mouseleave', () => {
            this.isOverTooltip = false;
            this.scheduleHide();
        });

        root.addEventListener(
            'wheel',
            (e) => {
                e.stopPropagation();
            },
            { passive: true }
        );

        this.el = root;
        this.titleEl = title;
        this.contentEl = body;
    }

    private positionToTarget(target: HTMLElement) {
        if (!this.el) return;
        const rect = target.getBoundingClientRect();

        const tt = this.el;
        const margin = 10;

        tt.style.left = '-9999px';
        tt.style.top = '-9999px';

        const w = tt.offsetWidth;
        const h = tt.offsetHeight;

        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let top = rect.bottom + margin;
        if (top + h > vh - margin) top = rect.top - h - margin;

        let left = rect.left;
        if (left + w > vw - margin) left = vw - w - margin;
        if (left < margin) left = margin;

        tt.style.position = 'fixed';
        tt.style.top = `${Math.max(margin, top)}px`;
        tt.style.left = `${left}px`;
        tt.style.zIndex = '999999';
    }
}