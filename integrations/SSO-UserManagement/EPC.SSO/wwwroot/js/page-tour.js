// ═══════════════════════════════════════════════════════════════
//  Page Tour Engine — راهنمای گام‌به‌گام سبک با افکت اسپات‌لایت
//  بدون وابستگی خارجی؛ در هر صفحه‌ای قابل استفاده مجدد است.
//
//  استفاده:
//    PageTour.init({ storageKey: 'my_page_tour_seen' });
//    PageTour.start(() => [
//        { selector: '#foo', title: '...', html: '...', placement: 'bottom' },
//        ...
//    ]);
// ═══════════════════════════════════════════════════════════════
const PageTour = (function () {
    let steps = [];
    let idx = 0;
    let els = null;
    let active = false;
    let opts = {};

    function qs(sel) { return document.querySelector(sel); }

    function isVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function ensureEls() {
        if (els) return els;
        const overlay = document.createElement('div');
        overlay.className = 'pt-overlay';
        const ring = document.createElement('div');
        ring.className = 'pt-glow-ring';
        const tooltip = document.createElement('div');
        tooltip.className = 'pt-tooltip';
        document.body.appendChild(overlay);
        document.body.appendChild(ring);
        document.body.appendChild(tooltip);
        els = { overlay, ring, tooltip };
        return els;
    }

    function updatePositions() {
        if (!active) return;
        const step = steps[idx];
        const target = qs(step.selector);
        if (!target || !isVisible(target)) { next(); return; }

        const pad = step.padding ?? 8;
        const rect = target.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;

        const x1 = Math.max(0, rect.left - pad);
        const y1 = Math.max(0, rect.top - pad);
        const x2 = Math.min(vw, rect.right + pad);
        const y2 = Math.min(vh, rect.bottom + pad);

        // ترفند «سوراخ» با clip-path: مستطیل بیرونی + مستطیل داخلی با جهت مخالف
        els.overlay.style.clipPath =
            `polygon(0px 0px, 0px ${vh}px, ${vw}px ${vh}px, ${vw}px 0px, 0px 0px,` +
            `${x1}px ${y1}px, ${x2}px ${y1}px, ${x2}px ${y2}px, ${x1}px ${y2}px, ${x1}px ${y1}px)`;

        els.ring.style.top = y1 + 'px';
        els.ring.style.left = x1 + 'px';
        els.ring.style.width = (x2 - x1) + 'px';
        els.ring.style.height = (y2 - y1) + 'px';

        positionTooltip(rect, step);
    }

    function resolvePlacement(rect, requested, ttWidth, ttHeight, gap) {
        const vw = window.innerWidth, vh = window.innerHeight;
        const spaceBottom = vh - rect.bottom;
        const spaceTop = rect.top;
        const spaceLeft = rect.left;
        const spaceRight = vw - rect.right;

        const fits = {
            bottom: spaceBottom > ttHeight + gap,
            top: spaceTop > ttHeight + gap,
            left: spaceLeft > ttWidth + gap,
            right: spaceRight > ttWidth + gap,
        };

        // ✅ در صفحه‌های باریک (موبایل)، فقط بالا/پایین را در نظر بگیر
        // چون فضای افقی معمولاً کافی نیست و باعث سرریز می‌شود
        if (vw < 576) {
            return fits.bottom ? 'bottom' : (fits.top ? 'top' : 'bottom');
        }

        // اگر جهت درخواستی جا دارد، همان را استفاده کن
        if (requested !== 'auto' && fits[requested]) return requested;

        // در غیر این صورت، بهترین جهت موجود را به ترتیب اولویت انتخاب کن
        if (fits.bottom) return 'bottom';
        if (fits.top) return 'top';
        if (fits.right) return 'right';
        if (fits.left) return 'left';
        return 'bottom'; // بدترین حالت: هرجا جا نشد، پایین با کلمپ نمایش بده
    }

    function positionTooltip(rect, step) {
        const tt = els.tooltip;
        const gap = 16;
        const ttWidth = tt.offsetWidth || 320;
        const ttHeight = tt.offsetHeight || 180;
        const vw = window.innerWidth, vh = window.innerHeight;

        const placement = resolvePlacement(rect, step.placement || 'auto', ttWidth, ttHeight, gap);

        let top, left;
        if (placement === 'bottom') {
            top = rect.bottom + gap;
            left = rect.left + rect.width / 2 - ttWidth / 2;
        } else if (placement === 'top') {
            top = rect.top - ttHeight - gap;
            left = rect.left + rect.width / 2 - ttWidth / 2;
        } else if (placement === 'left') {
            top = rect.top + rect.height / 2 - ttHeight / 2;
            left = rect.left - ttWidth - gap;
        } else { // right
            top = rect.top + rect.height / 2 - ttHeight / 2;
            left = rect.right + gap;
        }

        left = Math.max(12, Math.min(left, vw - ttWidth - 12));
        top = Math.max(12, Math.min(top, vh - ttHeight - 12));

        tt.style.top = top + 'px';
        tt.style.left = left + 'px';
        tt.setAttribute('data-placement', placement);

        const arrowLeft = Math.max(16, Math.min(
            (rect.left + rect.width / 2) - left - 7,
            ttWidth - 24
        ));
        tt.style.setProperty('--pt-arrow-left', arrowLeft + 'px');
    }
    function renderTooltip() {
        const step = steps[idx];
        const total = steps.length;
        const dots = steps.map((_, i) => {
            let cls = 'pt-dot';
            if (i === idx) cls += ' pt-dot--active';
            else if (i < idx) cls += ' pt-dot--done';
            return `<span class="${cls}"></span>`;
        }).join('');

        els.tooltip.innerHTML = `
            <div class="pt-tooltip-header">
                <div class="pt-tooltip-badge">${idx + 1}</div>
                <div class="pt-tooltip-title">${step.title}</div>
                <button type="button" class="pt-tooltip-close" data-pt-close title="بستن راهنما">✕</button>
            </div>
            <div class="pt-tooltip-body">${step.html || step.description || ''}</div>
            <div class="pt-tooltip-footer">
                <div class="pt-dots">${dots}</div>
                <div class="pt-nav-btns">
                    <button type="button" class="pt-nav-btn pt-nav-btn--prev" data-pt-prev ${idx === 0 ? 'disabled' : ''}>
                        <i class="fa fa-arrow-right"></i> قبلی
                    </button>
                    <button type="button" class="pt-nav-btn pt-nav-btn--next" data-pt-next>
                        ${idx === total - 1 ? 'پایان' : 'بعدی'} <i class="fa fa-arrow-left"></i>
                    </button>
                </div>
            </div>
            ${idx < total - 1 ? '<div class="pt-skip-link" data-pt-skip>رد کردن راهنما</div>' : ''}
        `;

        els.tooltip.querySelector('[data-pt-close]').onclick = end;
        els.tooltip.querySelector('[data-pt-prev]').onclick = prev;
        els.tooltip.querySelector('[data-pt-next]').onclick = () => {
            if (idx === total - 1) end(); else next();
        };
        els.tooltip.querySelector('[data-pt-skip]')?.addEventListener('click', end);
    }

    async function showStep() {
        const step = steps[idx];

        if (step.onEnter) { try { await step.onEnter(); } catch { } }
        // ✅ اگر onEnter خودش صبر واقعی کرده (مثل رویداد shown.bs.dropdown)،
        // این تاخیر کوتاه فقط برای اطمینان از قطعی‌شدن layout است
        await new Promise(r => setTimeout(r, 30));

        const target = qs(step.selector);
        if (!target || !isVisible(target)) {
            if (idx < steps.length - 1) { idx++; return showStep(); }
            end();
            return;
        }

        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(r => setTimeout(r, 280));

        renderTooltip();
        updatePositions();

        els.overlay.classList.add('pt-overlay--active');
        els.ring.classList.add('pt-glow-ring--active');
        els.tooltip.classList.add('pt-tooltip--active');
    }

    function runExitHook() {
        const step = steps[idx];
        if (step?.onExit) { try { step.onExit(); } catch { } }
    }

    function next() {
        runExitHook();
        if (idx < steps.length - 1) { idx++; showStep(); }
        else end();
    }

    function prev() {
        runExitHook();
        if (idx > 0) { idx--; showStep(); }
    }

    function onScrollOrResize() {
        if (active) requestAnimationFrame(updatePositions);
    }

    function onKeydown(e) {
        if (!active) return;
        if (e.key === 'Escape') end();
    }

    function start(customSteps) {
        steps = (typeof customSteps === 'function' ? customSteps() : customSteps) || [];
        steps = steps.filter(s => qs(s.selector));
        if (!steps.length) return;

        ensureEls();
        idx = 0;
        active = true;

        document.getElementById('pageTourFab')?.classList.add('pt-fab--hidden');
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        document.addEventListener('keydown', onKeydown);

        if (opts.storageKey) { try { localStorage.setItem(opts.storageKey, '1'); } catch { /* ذخیره‌سازی مسدود */ } }
        document.getElementById('pageTourFab')?.classList.remove('pt-fab--pulse');

        showStep();
    }

    function end() {
        runExitHook();
        active = false;
        if (els) {
            els.overlay.classList.remove('pt-overlay--active');
            els.ring.classList.remove('pt-glow-ring--active');
            els.tooltip.classList.remove('pt-tooltip--active');
        }
        window.removeEventListener('scroll', onScrollOrResize, true);
        window.removeEventListener('resize', onScrollOrResize);
        document.removeEventListener('keydown', onKeydown);
        document.getElementById('pageTourFab')?.classList.remove('pt-fab--hidden');
    }

    function init(config) { opts = config || {}; }

    return { init, start, end, next, prev };
})();