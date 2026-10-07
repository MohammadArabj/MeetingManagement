/* ═══════════════════════════════════════════════════════════════════════
   EPC Portal — Login page (login.js) — بدون وابستگی به jQuery/Bootstrap
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const csrf = () => $('input[name="__RequestVerificationToken"]')?.value || '';

    // ── Theme ──
    $('#themeToggle')?.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('epc-theme', next); } catch { }
    });

    // ── Password eye ──
    const pwd = $('#password');
    $('#passToggle')?.addEventListener('click', e => {
        const show = pwd.type === 'password';
        pwd.type = show ? 'text' : 'password';
        e.currentTarget.innerHTML = `<i class="fa ${show ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
        pwd.focus();
    });

    // ── Caps Lock ──
    // فقط با یک رویداد واقعی صفحه‌کلید/ماوس وضعیت مشخص می‌شود؛ تا آن موقع پیام همیشه پنهان است.
    // (نسخه‌ی قبلی هنگام بارگذاری پیام را نشان می‌داد و toggle بدون مقدار، آن را جابه‌جا می‌کرد.)
    const caps = $('#capsWarn');
    const updateCaps = e => {
        if (!caps || typeof e.getModifierState !== 'function') return;
        // هنگام فشردن خود کلید CapsLock در keydown، وضعیت هنوز قدیمی است → فقط keyup را معتبر بدان
        if (e.type === 'keydown' && e.key === 'CapsLock') return;
        caps.hidden = !(document.activeElement === pwd && e.getModifierState('CapsLock') === true);
    };
    if (pwd && caps) {
        caps.hidden = true;
        ['keydown', 'keyup', 'mousedown'].forEach(t => pwd.addEventListener(t, updateCaps));
        pwd.addEventListener('blur', () => caps.hidden = true);
    }

    // ── Login submit ──
    const form = $('#loginForm');
    form?.addEventListener('submit', e => {
        const errs = [];
        if (!form.Username.value.trim()) errs.push('نام کاربری را وارد کنید.');
        if (!form.Password.value) errs.push('رمز عبور را وارد کنید.');
        if (form.EnteredCaptcha && !form.EnteredCaptcha.value.trim()) errs.push('کد امنیتی را وارد کنید.');
        const box = $('#clientErrors');
        if (errs.length) {
            e.preventDefault();
            box.innerHTML = '<ul>' + errs.map(x => `<li>${x}</li>`).join('') + '</ul>';
            box.hidden = false;
            return;
        }
        box.hidden = true;
        const h = document.createElement('input');
        h.type = 'hidden'; h.name = 'button'; h.value = 'login';
        form.appendChild(h);
        const btn = $('#loginButton');
        setTimeout(() => { btn.disabled = true; btn.innerHTML = '<span class="p-spin"></span><span>در حال ورود...</span>'; }, 0);
    });

    // ── Captcha refresh ──
    $('#captchaRefresh')?.addEventListener('click', async () => {
        try {
            const r = await fetch('/Account/RefreshCaptcha', { credentials: 'same-origin', cache: 'no-store' });
            const d = await r.json();
            if (d.url) $('#captchaImage').src = d.url;
            const inp = $('#EnteredCaptcha');
            inp.value = ''; inp.focus();
        } catch { }
    });

    // ── Panels (ورود / فراموشی رمز) ──
    const show = id => { $$('.lg-panel').forEach(p => p.hidden = p.id !== id); $(`#${id} input`)?.focus(); };
    $('#openForgot')?.addEventListener('click', () => {
        $('#fpForm').hidden = false; $('#fpDone').hidden = true; $('#fpError').hidden = true;
        show('panelForgot');
    });
    $$('[data-back]').forEach(b => b.addEventListener('click', () => show('panelLogin')));
    ['#fpCode', '#fpPhone'].forEach(s => $(s)?.addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, '')));

    $('#fpSubmit')?.addEventListener('click', async e => {
        const btn = e.currentTarget, err = $('#fpError');
        const code = $('#fpCode').value.trim(), phone = $('#fpPhone').value.trim();
        const fail = m => { err.textContent = m; err.hidden = false; };
        err.hidden = true;
        if (!code) return fail('کد پرسنلی را وارد کنید.');
        if (phone.length !== 4) return fail('چهار رقم آخر شماره همراه را وارد کنید.');

        const orig = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '<span class="p-spin"></span><span>در حال ارسال...</span>';
        try {
            const r = await fetch('/Account/ForgotPassword', {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': csrf() },
                body: JSON.stringify({ PersonnelCode: code, Phone: phone })
            });
            if (r.status === 429) return fail('تعداد درخواست‌ها زیاد است؛ چند دقیقه بعد تلاش کنید.');
            const d = await r.json();
            if (d.success) { $('#fpDoneMsg').textContent = d.message || ''; $('#fpForm').hidden = true; $('#fpDone').hidden = false; }
            else fail(d.message || 'خطا در ثبت درخواست.');
        } catch { fail('خطا در ارتباط با سرور.'); }
        finally { btn.disabled = false; btn.innerHTML = orig; }
    });

    // ── رسانه‌ی اطلاعیه‌ها (تصویر و PDF با بارگذاری تنبل) ──
    function activateMedia(item) {
        if (!item) return;
        const img = $('img[data-src]', item);
        if (img && !img.getAttribute('src')) img.src = img.dataset.src;
        const frame = $('iframe[data-src]', item);
        if (frame && !frame.getAttribute('src')) {
            frame.addEventListener('load', () => $('.lg-stage__loading', item)?.remove(), { once: true });
            frame.src = frame.dataset.src;
        }
    }
    function activateSlide(slide) {
        if (!slide) return;
        activateMedia($('.lg-stage__item.is-active', slide));
        const next = slide.nextElementSibling;
        const nimg = next && $('.lg-stage__item.is-active img[data-src]', next);
        if (nimg && !nimg.getAttribute('src')) nimg.src = nimg.dataset.src;
    }
    document.addEventListener('click', e => {
        // جابه‌جایی بین چند تصویر/PDF یک اطلاعیه
        const tab = e.target.closest('.lg-stage__tab');
        if (tab) {
            const stage = tab.closest('.lg-stage'), idx = tab.dataset.media;
            $$('.lg-stage__tab', stage).forEach(t => t.classList.toggle('is-active', t === tab));
            $$('.lg-stage__item', stage).forEach(it => it.classList.toggle('is-active', it.dataset.media === idx));
            const item = $(`.lg-stage__item[data-media="${idx}"]`, stage);
            activateMedia(item);
            const src = ($('img', item)?.dataset.src) || ($('iframe', item)?.dataset.src || '').split('#')[0];
            const name = $('img', item)?.alt || $('iframe', item)?.title || '';
            const open = $('[data-tool="open"]', stage), dl = $('[data-tool="download"]', stage);
            if (open) open.href = src;
            if (dl) { dl.href = src; dl.setAttribute('download', name); }
            return;
        }
        // نمایش/پنهان کردن متن اطلاعیه روی پیش‌نمایش
        const more = e.target.closest('[data-more]');
        if (more) {
            const drawer = $('.lg-drawer', more.closest('.lg-stage'));
            if (drawer) drawer.hidden = !drawer.hidden;
        }
    });

    // ── اسلایدر اطلاعیه‌ها ──
    const box = $('#annBox');
    const slides = box ? $$('.lg-slide', box) : [];
    if (slides.length) activateSlide(slides[0]);

    if (box && slides.length > 1) {
        const MS = Math.max(4000, parseInt(box.dataset.interval, 10) || 6000);
        const bar = $('#annProgress'), counter = $('#annCount');
        let cur = 0, timer = null, paused = false;

        const startBar = () => {
            if (!bar) return;
            bar.style.transition = 'none'; bar.style.width = '0';
            requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${MS}ms linear`; bar.style.width = '100%'; }));
        };
        const schedule = () => { clearTimeout(timer); if (paused) return; startBar(); timer = setTimeout(() => go(cur + 1), MS); };
        const go = i => {
            slides[cur].classList.remove('is-active');
            cur = (i + slides.length) % slides.length;
            slides[cur].classList.add('is-active');
            counter.textContent = `${fa(cur + 1)} / ${fa(slides.length)}`;
            activateSlide(slides[cur]);
            schedule();
        };
        const pause = () => {
            paused = true; clearTimeout(timer);
            if (bar) { const w = getComputedStyle(bar).width; bar.style.transition = 'none'; bar.style.width = w; }
        };
        const resume = () => { paused = false; schedule(); };

        $('[data-ann="next"]', box)?.addEventListener('click', () => go(cur + 1));
        $('[data-ann="prev"]', box)?.addEventListener('click', () => go(cur - 1));
        box.addEventListener('mouseenter', pause);
        box.addEventListener('mouseleave', resume);
        document.addEventListener('visibilitychange', () => document.hidden ? pause() : resume());
        document.addEventListener('keydown', e => {
            if (/input|textarea/i.test(document.activeElement?.tagName)) return;
            if (e.key === 'ArrowLeft') go(cur + 1);
            if (e.key === 'ArrowRight') go(cur - 1);
        });
        counter.textContent = `${fa(1)} / ${fa(slides.length)}`;
        schedule();
    }

    // ── Lightbox تصاویر ──
    const lb = $('#lightbox');
    document.addEventListener('click', e => {
        const img = e.target.closest('img[data-zoom]');
        if (!img || !lb) return;
        lb.querySelector('img').src = img.currentSrc || img.src;
        lb.classList.add('is-open');
    });
    lb?.addEventListener('click', () => lb.classList.remove('is-open'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') lb?.classList.remove('is-open'); });

    // ── لینک‌های غیرفعال ──
    $$('.lg-q[data-soon]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); alert('این بخش به‌زودی فعال می‌شود.'); }));
})();
