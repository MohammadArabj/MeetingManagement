/* ═══════════════════════════════════════════════════════════════════════
   EPC Portal — Dashboard  (dashboard.js)
   وابستگی‌ها: site-header.js، announcement-common.js (escHtml/escAttr/ANN_TYPE/openAnnouncementDetail)،
               jalali-picker.js، page-tour.js، bootstrap (vendor.min.js)
   هر ویجت مستقل بارگذاری و به محض آماده شدن نمایش داده می‌شود (داده‌ی نشست قبلی بی‌درنگ نمایش داده می‌شود).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    // اعداد فارسی + Escape (خروجی fa مستقیم در innerHTML قرار می‌گیرد)
    const fa = n => escHtml(String(n ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]));
    const csrf = () => window.getCsrfToken?.() || $('input[name="__RequestVerificationToken"]')?.value || '';
    const toast = m => window.showToast?.(m);
    const PALETTE = ['#f97316', '#0ea5e9', '#10b981', '#8b5cf6', '#ef4444', '#14b8a6', '#f59e0b', '#6366f1', '#ec4899', '#22c55e'];
    const main = $('main[data-personnel-code]');
    const personnelCode = main?.dataset.personnelCode || '';
    // کش به تفکیک کاربر + سمت/تفویض فعال (قبلاً بعد از تغییر سمت، داده‌ی سمت قبلی نمایش داده می‌شد)
    const cacheScope = `${personnelCode}:${main?.dataset.cacheScope || ''}`;

    const getJson = async (url, opts) => {
        const r = await fetch(url, { credentials: 'same-origin', ...opts });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    };
    const empty = (icon, text) => `<div class="p-empty"><i class="fa ${icon}"></i>${text}</div>`;
    /** retry: کلید ویجت (فقط همان ویجت دوباره خوانده می‌شود) یا 'force' برای اطلاعیه‌ی اجباری جاری */
    const errorBox = (text, retry = '') => `<div class="p-empty"><i class="fa fa-triangle-exclamation"></i>${text}<br><button type="button" class="db-retry" data-retry="${escAttr(retry)}"><i class="fa fa-rotate"></i> تلاش دوباره</button></div>`;

    /** شمارنده‌ی کنار عنوان کارت؛ hideZero برای «خوانده‌نشده» که صفر بودنش نیاز به نمایش ندارد */
    function setCount(sel, n, hideZero = false) {
        const el = $(sel);
        if (!el) return;
        el.textContent = n == null ? '—' : fa(n);
        el.hidden = hideZero && !n;
        if (hideZero && n) { el.style.background = 'var(--orange)'; el.style.color = '#fff'; }
    }

    /** محو شدن لبه‌ی پایین لیست تا وقتی محتوای بیشتری برای اسکرول هست */
    function watchScroll(el) {
        if (!el) return;
        const update = () => el.classList.toggle('is-end', el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
        el.addEventListener('scroll', update, { passive: true });
        requestAnimationFrame(update);
    }

    // ═══ Pins (سنجاق سامانه‌ها در مرورگر کاربر) ═══════════════════════════
    const PIN_KEY = 'epc-pins';
    const pins = new Set((() => { try { return JSON.parse(localStorage.getItem(PIN_KEY) || '[]'); } catch { return []; } })());
    const savePins = () => { try { localStorage.setItem(PIN_KEY, JSON.stringify([...pins])); } catch { } };

    function applyPins(grid) {
        if (!grid) return;
        const cards = $$('.db-app', grid);
        cards.forEach(c => $('.db-app__pin', c)?.classList.toggle('is-on', pins.has(c.dataset.id)));
        cards.filter(c => pins.has(c.dataset.id)).reverse().forEach(c => grid.prepend(c));
    }

    // ═══ Launchers ═══════════════════════════════════════════════════════
    function launchHidden(url, name) {
        toast(`🚀 در حال اجرای ${name || 'برنامه'} ...`);
        const f = document.createElement('iframe');
        f.style.display = 'none';
        f.src = url;
        document.body.appendChild(f);
        setTimeout(() => f.remove(), 3000);
    }

    function openApp(card) {
        const { kind, url, name } = card.dataset;
        if (kind === 'win') return launchHidden(url, name);
        if (kind === 'other') return launchOther(card);
        if (!url) return toast('این سامانه به‌زودی فعال می‌شود.');
        window.open(url, '_blank', 'noopener');
    }

    const launching = new Set();
    async function launchOther(card) {
        card.classList.add('is-busy');
        try { await launchOtherProgram(card.dataset.pid, card.dataset.name, card.dataset.iswin === 'true'); }
        finally { card.classList.remove('is-busy'); }
    }

    /** اجرای «سایر برنامه‌ها» با شناسه (لینک و بلیط SSO سمت سرور با OtherProgramService ساخته می‌شود) */
    async function launchOtherProgram(pid, name, isWin = false) {
        pid = String(pid);
        if (launching.has(pid)) return false;
        launching.add(pid);

        // برای وب، پنجره باید هم‌زمان با کلیک باز شود، وگرنه بعد از await توسط popup-blocker بسته می‌شود
        const win = isWin ? null : window.open('about:blank', '_blank');

        try {
            const res = await getJson('/Grants/LaunchOtherProgram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': csrf() },
                body: JSON.stringify({ Id: +pid })
            });
            if (!res.success) throw new Error(res.message);

            if (res.type === 'win') { win?.close(); launchHidden(res.url, name); }
            else if (win) { win.opener = null; win.location.href = res.url; }
            else toast('⚠️ باز شدن پنجره مسدود شد؛ popup را برای پورتال مجاز کنید.');
            return true;
        } catch (err) {
            win?.close();
            toast(err.message && !err.message.startsWith('HTTP') ? err.message : 'اجرای برنامه ناموفق بود.');
            return false;
        } finally {
            launching.delete(pid);
        }
    }

    document.addEventListener('click', e => {
        const pin = e.target.closest('.db-app__pin');
        if (pin) {
            e.stopPropagation();
            const card = pin.closest('.db-app');
            pins.has(card.dataset.id) ? pins.delete(card.dataset.id) : pins.add(card.dataset.id);
            savePins();
            applyPins(card.parentElement);
            return;
        }
        const card = e.target.closest('.db-app');
        if (card) openApp(card);
    });
    document.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('db-app')) { e.preventDefault(); openApp(e.target); }
    });

    // ═══ Tabs + Search ═══════════════════════════════════════════════════
    const search = $('#appSearch');
    let activeTab = 'web';

    function setTab(tab) {
        activeTab = tab;
        $$('.db-tab').forEach(t => {
            t.classList.toggle('is-active', t.dataset.tab === tab);
            t.setAttribute('aria-selected', String(t.dataset.tab === tab));
        });
        $$('.db-pane').forEach(p => p.hidden = p.dataset.pane !== tab);
        filterApps();
    }
    $$('.db-tab').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));

    function filterApps() {
        const q = (search?.value || '').trim().toLowerCase();
        const pane = $(`.db-pane[data-pane="${activeTab}"]`);
        let visible = 0;
        $$('.db-app', pane).forEach(c => {
            const hit = !q || (c.dataset.name || '').toLowerCase().includes(q) || (c.dataset.desc || '').toLowerCase().includes(q);
            c.classList.toggle('is-hidden', !hit);
            if (hit) visible++;
        });
        $('#appsNoResult').hidden = !(q && visible === 0);
    }
    search?.addEventListener('input', filterApps);
    document.addEventListener('keydown', e => {
        if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName)) { e.preventDefault(); search?.focus(); }
        if (e.key === 'Escape' && document.activeElement === search) { search.value = ''; filterApps(); search.blur(); }
    });

    // ═══ Renderers ═══════════════════════════════════════════════════════
    function renderWindowsApps(list) {
        if (!list?.length) return;
        $('#tabWin').hidden = false;
        $('#countWin').textContent = list.length;
        $('#windowsAppsGrid').innerHTML = list.map((a, i) => `
            <div class="db-app" tabindex="0" role="button" data-kind="win" data-id="win:${escAttr(a.id)}" data-url="${escAttr(a.launchUrl)}"
                 data-name="${escAttr(a.name)}" data-desc="${escAttr(a.description)}" title="${escAttr(a.description)}"
                 style="--_c:${PALETTE[(i + 3) % PALETTE.length]};animation-delay:${Math.min(i, 20) * 18}ms">
                <button type="button" class="db-app__pin" aria-label="سنجاق"><i class="fa fa-star"></i></button>
                <span class="db-app__icon">${a.id
                    ? `<img src="/Grants/AppIcon/${encodeURIComponent(a.id)}" alt="" loading="lazy" data-fallback-icon="fa-desktop">`
                    : '<i class="fa fa-desktop"></i>'}</span>
                <span class="db-app__name">${escHtml(a.name)}</span>
            </div>`).join('');
        applyPins($('#windowsAppsGrid'));
    }

    function renderOtherPrograms(list) {
        if (!list?.length) return;
        $('#tabOther').hidden = false;
        $('#countOther').textContent = list.length;
        $('#otherProgramsGrid').innerHTML = list.map((p, i) => `
        <div class="db-app" tabindex="0" role="button" data-kind="other" data-id="other:${escAttr(p.id)}" data-pid="${escAttr(p.id)}"
             data-name="${escAttr(p.name)}" data-iswin="${p.kind === 2}" title="${escAttr(p.name)}"
             style="--_c:${PALETTE[(i + 6) % PALETTE.length]};animation-delay:${Math.min(i, 20) * 18}ms">
            <button type="button" class="db-app__pin" aria-label="سنجاق"><i class="fa fa-star"></i></button>
            <span class="db-app__icon"><i class="fa ${p.kind === 2 ? 'fa-window-maximize' : 'fa-earth-asia'}"></i></span>
            <span class="db-app__name">${escHtml(p.name)}</span>
        </div>`).join('');
        applyPins($('#otherProgramsGrid'));
    }

    const MEETING_STATUS = {
        1: { label: 'پیش رو', color: '#0ea5e9' },
        2: { label: 'برگزار شده', color: '#10b981' },
        3: { label: 'اتمام یافته', color: '#64748b' }
    };

    function renderMeetings(list) {
        const ct = $('#meetingContainer');
        setCount('#countMeetings', list ? list.length : null);
        if (!list) return ct.innerHTML = errorBox('جلسات در دسترس نیست', 'meetings');
        if (!list.length) return ct.innerHTML = empty('fa-mug-hot', 'جلسه‌ای در ۴ روز آینده ندارید');

        ct.innerHTML = list.map(m => {
            // قالب تاریخ: yyyy/MM/dd - HH:mm~HH:mm
            const [datePart, timePart] = String(m.date || '').split(' - ');
            const [, mo, d] = (datePart || '').split('/');
            const st = MEETING_STATUS[m.status] || MEETING_STATUS[1];
            const url = m.baseUrl ? `${m.baseUrl}/#/meetings/details/${encodeURIComponent(m.guid)}` : '';
            return `
            <div class="db-meet" tabindex="0" role="link" data-href="${escAttr(url)}">
                <div class="db-meet__date"><b>${fa(+d || '')}</b><span>${typeof MONTH_NAMES_FA !== 'undefined' && mo ? escHtml(MONTH_NAMES_FA[+mo - 1] || '') : ''}</span></div>
                <div class="db-meet__body">
                    <div class="db-meet__title" title="${escAttr(m.title)}">${escHtml(m.title)}</div>
                    <div class="db-meet__meta">
                        ${timePart ? `<span><i class="fa fa-clock"></i> ${fa(timePart.replace('~', ' تا '))}</span>` : ''}
                        ${m.place ? `<span><i class="fa fa-location-dot"></i> ${escHtml(m.place)}</span>` : ''}
                        <span class="p-badge" style="background:${st.color}1f;color:${st.color}">${st.label}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    }
    document.addEventListener('click', e => {
        const m = e.target.closest('.db-meet');
        if (m?.dataset.href) window.open(m.dataset.href, '_blank', 'noopener');
    });

    function renderAnnouncements(list) {
        const ct = $('#announceContainer');
        if (!list) { setCount('#countUnread', null, true); return ct.innerHTML = errorBox('اطلاعیه‌ها در دسترس نیست', 'announcements'); }
        const unread = list.filter(a => !a.isRead).length;
        setCount('#countUnread', unread, true);
        if (!list.length) return ct.innerHTML = empty('fa-bell-slash', 'اطلاعیه‌ای وجود ندارد');

        ct.innerHTML = list.map(a => {
            const cfg = ANN_TYPE[a.type] || ANN_TYPE.info;
            const pri = a.priority === 3 ? '<span class="p-badge" style="background:#ef44441f;color:#ef4444">فوری</span>'
                : a.priority === 2 ? '<span class="p-badge" style="background:#f59e0b1f;color:#d97706">مهم</span>' : '';
            return `
            <div class="db-ann ${a.isRead ? '' : 'db-ann--unread'}" tabindex="0" role="button" data-guid="${escAttr(a.guid)}">
                <span class="db-ann__dot" style="background:${cfg.color}"></span>
                <div style="min-width:0">
                    <div class="db-ann__title">${escHtml(a.title)}</div>
                    <div class="db-ann__meta">
                        <span class="p-badge" style="background:${cfg.color}1f;color:${cfg.color}">${cfg.label}</span>
                        <span>${fa(a.date)}</span>${pri}
                        ${a.fileCount > 0 ? `<span><i class="fa fa-paperclip"></i> ${fa(a.fileCount)}</span>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    }
    document.addEventListener('click', e => {
        const a = e.target.closest('.db-ann');
        if (!a) return;
        a.classList.remove('db-ann--unread');
        openAnnouncementDetail(a.dataset.guid);
    });

    function renderSurveys(list) {
        const ct = $('#surveyContainer');
        setCount('#countSurveys', list ? list.length : null);
        if (!list) return ct.innerHTML = errorBox('نظرسنجی‌ها در دسترس نیست', 'surveys');
        if (!list.length) return ct.innerHTML = empty('fa-circle-check', 'نظرسنجی فعالی برای شما وجود ندارد');

        ct.innerHTML = list.map(s => {
            const pct = s.responseStatus === 1 ? Math.round(s.progressPercentage) : 0;
            const badge = s.responseStatus === 0
                ? '<span class="p-badge" style="background:#f973161f;color:#ea580c">جدید</span>'
                : '<span class="p-badge" style="background:#0ea5e91f;color:#0284c7">ناتمام</span>';
            return `
            <div class="db-survey" tabindex="0" role="link" data-href="${escAttr(`${s.surveyBaseUrl}/#/survey/take/${encodeURIComponent(s.guid)}`)}">
                <div class="db-survey__head"><div class="db-survey__title">${escHtml(s.title)}</div>${badge}</div>
                <div class="db-survey__bar"><span style="width:${Number(pct) || 0}%"></span></div>
                <div class="db-survey__meta">
                    <span><i class="fa fa-list-check"></i> ${fa(s.totalQuestions)} سؤال</span>
                    ${s.daysRemaining > 0 ? `<span><i class="fa fa-hourglass-half"></i> ${fa(s.daysRemaining)} روز مانده</span>` : ''}
                </div>
            </div>`;
        }).join('');
    }
    document.addEventListener('click', e => {
        const s = e.target.closest('.db-survey');
        if (s?.dataset.href) location.href = s.dataset.href;
    });

    // ── Suggesters slideshow ──
    const Sugg = { cur: 0, n: 0, timer: null };
    function renderSuggesters(list) {
        const ct = $('#suggestionList');
        if (!list?.length) {
            ct.innerHTML = `<div class="db-sugg__slide is-active"><i class="fa fa-lightbulb" style="font-size:28px;opacity:.7"></i><div>${list ? 'هنوز پیشنهاد دهنده‌ی برتری ثبت نشده' : 'اطلاعات در دسترس نیست'}</div></div>`;
            return;
        }
        const initial = n => (String(n || '؟').trim()[0]) || '؟';
        ct.innerHTML = list.map((s, i) => `
            <div class="db-sugg__slide ${i === 0 ? 'is-active' : ''}">
                <span class="db-sugg__rank">رتبه ${fa(i + 1)}</span>
                ${s.imageUrl
                    ? `<img class="db-sugg__avatar" src="${escAttr(s.imageUrl)}" alt="" loading="lazy" data-fallback-text="${escAttr(initial(s.lfName))}">`
                    : `<div class="db-sugg__avatar">${escHtml(initial(s.lfName))}</div>`}
                <div class="db-sugg__name">${escHtml(s.lfName || 'بدون نام')}</div>
                ${s.officeName ? `<div class="db-sugg__meta">${escHtml(s.officeName)}</div>` : ''}
                <div class="db-sugg__count">💡 ${fa(s.suggestionCount)} پیشنهاد تأییدشده</div>
            </div>`).join('') + (list.length > 1 ? `
            <button type="button" class="db-sugg__nav db-sugg__nav--prev" data-sugg="-1" aria-label="قبلی"><i class="fa fa-chevron-right"></i></button>
            <button type="button" class="db-sugg__nav db-sugg__nav--next" data-sugg="1" aria-label="بعدی"><i class="fa fa-chevron-left"></i></button>
            <div class="db-sugg__dots">${list.map((_, i) => `<button type="button" data-sugg-go="${i}" class="${i === 0 ? 'is-active' : ''}" aria-label="${i + 1}"></button>`).join('')}</div>` : '');

        Sugg.n = list.length; Sugg.cur = 0;
        const go = i => {
            const slides = $$('.db-sugg__slide', ct), dots = $$('.db-sugg__dots button', ct);
            slides[Sugg.cur]?.classList.remove('is-active'); dots[Sugg.cur]?.classList.remove('is-active');
            Sugg.cur = (i + Sugg.n) % Sugg.n;
            slides[Sugg.cur]?.classList.add('is-active'); dots[Sugg.cur]?.classList.add('is-active');
        };
        // اسلاید خودکار: در تب پنهان، هنگام فوکوس کیبورد و با «کاهش حرکت» متوقف است
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const auto = () => {
            clearInterval(Sugg.timer);
            if (Sugg.n > 1 && !reduceMotion && !document.hidden && !ct.contains(document.activeElement))
                Sugg.timer = setInterval(() => go(Sugg.cur + 1), 4500);
        };
        Sugg.auto = auto;
        ct.onclick = e => {
            const step = e.target.closest('[data-sugg]'); const dot = e.target.closest('[data-sugg-go]');
            if (step) go(Sugg.cur + +step.dataset.sugg);
            if (dot) go(+dot.dataset.suggGo);
        };
        ct.onmouseenter = () => clearInterval(Sugg.timer);
        ct.onmouseleave = auto;
        ct.onfocusin = () => clearInterval(Sugg.timer);
        ct.onfocusout = () => setTimeout(auto, 0);
        auto();
    }
    document.addEventListener('visibilitychange', () => document.hidden ? clearInterval(Sugg.timer) : Sugg.auto?.());

    // تصویر جایگزین (به جای onerror داخل HTML)؛ رویداد error حباب نمی‌زند، پس در capture گرفته می‌شود
    document.addEventListener('error', e => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement)) return;
        if (img.dataset.fallbackIcon) {
            const i = document.createElement('i');
            i.className = 'fa ' + img.dataset.fallbackIcon;
            img.replaceWith(i);
        } else if (img.dataset.fallbackText !== undefined) {
            const d = document.createElement('div');
            d.className = img.className;
            d.textContent = img.dataset.fallbackText;
            img.replaceWith(d);
        }
    }, true);

    // ═══ Force read (اطلاعیه‌های نیازمند تأیید) ═════════════════════════════
    const Force = { items: [], idx: 0 };

    async function startForceRead(list) {
        const pending = (list || []).filter(a => a.requireReadConfirmation && !a.isRead);
        if (!pending.length) return;
        Force.items = pending.map(a => ({ guid: a.guid, title: a.title, loaded: false, ok: false, data: null }));
        Force.idx = 0;
        $('#forceReadOverlay').classList.add('is-open');
        await showForce(0);
    }

    async function showForce(i) {
        Force.idx = i;
        const it = Force.items[i];
        $('#forceStep').textContent = `اطلاعیه ${fa(i + 1)} از ${fa(Force.items.length)} — مطالعه و تأیید الزامی است`;
        $('#forceTitle').textContent = it.title;
        $('#forceSteps').innerHTML = Force.items.map((x, k) => `<span class="${x.ok ? 'is-ok' : k === i ? 'is-cur' : ''}"></span>`).join('');
        const body = $('#forceBody');
        const confirmBtn = $('#forceConfirm');
        // تا متن اطلاعیه نمایش داده نشده، «مطالعه کردم» غیرفعال است
        if (confirmBtn) confirmBtn.disabled = true;
        if (!it.loaded) {
            body.innerHTML = '<div class="p-skel" style="height:120px"></div>';
            try {
                const res = await getJson(`/Grants/GetAnnouncementDetail?guid=${encodeURIComponent(it.guid)}`);
                if (res?.success) { it.data = res.data; it.loaded = true; }
            } catch { }
        }
        if (Force.idx !== i) return;
        if (!it.data) { body.innerHTML = errorBox('بارگذاری جزئیات ممکن نشد', 'force'); return; }
        if (confirmBtn) confirmBtn.disabled = false;
        let html = `<div>${escHtml(it.data.body)}</div>`;
        if (it.data.files?.length && typeof buildFileSlideshowHtml === 'function') html += buildFileSlideshowHtml(it.data.files);
        typeof setHtml === 'function' ? setHtml(body, html) : (body.innerHTML = html);
        body.scrollTop = 0;
        $('#forceTitle')?.focus?.();
    }

    // فوکوس داخل پنجره‌ی اجباری می‌ماند (کاربر کیبورد/صفحه‌خوان پشت آن گیر نمی‌کند)
    document.addEventListener('keydown', e => {
        const overlay = $('#forceReadOverlay');
        if (e.key !== 'Tab' || !overlay?.classList.contains('is-open')) return;
        const focusables = $$('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"]), iframe', overlay)
            .filter(el => el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (!overlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    $('#forceConfirm')?.addEventListener('click', async e => {
        const btn = e.currentTarget, it = Force.items[Force.idx];
        if (!it || !it.data) return;
        const orig = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '<span class="p-spin"></span> در حال ثبت...';
        try {
            const r = await fetch('/Grants/ConfirmAnnouncementRead', {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': csrf() },
                body: JSON.stringify({ AnnouncementGuid: it.guid })
            });
            if (!r.ok) throw new Error();
            it.ok = true;
            $(`.db-ann[data-guid="${CSS.escape(String(it.guid))}"]`)?.classList.remove('db-ann--unread');
            const next = Force.items.findIndex(x => !x.ok);
            if (next === -1) {
                $('#forceReadOverlay').classList.remove('is-open');
                toast('✅ همه‌ی اطلاعیه‌ها تأیید شد');
                setCount('#countUnread', $$('.db-ann--unread').length, true);
            } else await showForce(next);
        } catch { toast('ثبت تأیید ناموفق بود؛ دوباره تلاش کنید'); }
        finally { btn.disabled = false; btn.innerHTML = orig; }
    });

    // ═══ Sessions modal ══════════════════════════════════════════════════
    let sessPicker = null;
    let sessSeq = 0;
    async function loadSessions() {
        const tbody = $('#sessionTableBody');
        const seq = ++sessSeq;
        tbody.innerHTML = '<tr><td colspan="3" class="sess-empty-row"><span class="p-spin"></span></td></tr>';
        try {
            const { from, to } = sessPicker.getRange();
            const q = `fromDate=${from ? encodeURIComponent(jalaaliToStr(from)) : ''}&toDate=${to ? encodeURIComponent(jalaaliToStr(to)) : ''}`;
            const res = await getJson(`/Grants/GetSessions?${q}`);
            if (seq !== sessSeq) return; // نتیجه‌ی بازه‌ی قدیمی‌تر
            const items = res.items || [];
            tbody.innerHTML = items.length
                ? items.map(s => `<tr><td>${escHtml(s.created)}</td>
                    <td>${s.isSuccessful ? '<span class="p-badge" style="background:#10b9811f;color:#059669">موفق</span>' : '<span class="p-badge" style="background:#ef44441f;color:#dc2626">ناموفق</span>'}</td>
                    <td dir="ltr" style="text-align:right">${escHtml(s.clientIpAddress)}</td></tr>`).join('')
                : '<tr><td colspan="3" class="sess-empty-row">در این بازه سابقه‌ای یافت نشد</td></tr>';
        } catch { if (seq === sessSeq) tbody.innerHTML = '<tr><td colspan="3" class="sess-empty-row">خطا در بارگذاری</td></tr>'; }
    }
    function setPreset(days, chip) {
        const today = jalaaliToday();
        sessPicker.setRange(jalaaliAddDays(today, -days), today);
        $$('.sess-preset-chip').forEach(c => c.classList.toggle('sess-preset-chip--active', c === chip));
        loadSessions();
    }
    $('#btnSessions')?.addEventListener('click', () => {
        if (!sessPicker) {
            sessPicker = createJalaliRangePicker({
                popupEl: $('#sessCalendarPopup'), fromBtnEl: $('#sessFromBtn'), toBtnEl: $('#sessToBtn'),
                fromLabelEl: $('#sessFromLabel'), toLabelEl: $('#sessToLabel'), containerEl: $('.sess-filter-bar'),
                onChange: () => { $$('.sess-preset-chip').forEach(c => c.classList.remove('sess-preset-chip--active')); loadSessions(); }
            });
            setPreset(30, $('.sess-preset-chip[data-days="30"]'));
        } else loadSessions();
        bootstrap.Modal.getOrCreateInstance($('#sessionModal')).show();
    });
    $$('.sess-preset-chip').forEach(c => c.addEventListener('click', () => setPreset(+c.dataset.days, c)));

    // ═══ User profiles (impersonation) ═══════════════════════════════════
    const UP = { page: 1, search: '', loading: false, hasMore: true, items: [], seq: 0 };
    async function loadUsers(append) {
        const body = $('#upBody');
        // هر جستجوی جدید شماره‌ی تازه می‌گیرد؛ پاسخ جستجوی قبلی نتیجه‌ی جدید را بازنویسی نمی‌کند
        const seq = append ? UP.seq : ++UP.seq;
        UP.loading = true;
        try {
            const res = await getJson(`/Grants/GetUsersForProfile?search=${encodeURIComponent(UP.search)}&page=${UP.page}&pageSize=20`);
            if (seq !== UP.seq) return;
            UP.hasMore = !!res.hasMore;
            UP.items = append ? UP.items.concat(res.items) : res.items;
            if (!UP.items.length) { body.innerHTML = empty('fa-user-slash', 'کاربری یافت نشد'); return; }
            body.innerHTML = UP.items.map(u => `
                <div class="db-up">
                    <span class="p-avatar">${escHtml((u.fullName || '؟').trim()[0])}</span>
                    <div class="db-up__info">
                        <div class="db-up__name">${escHtml(u.fullName)}</div>
                        <div class="db-up__meta"><span>${fa(u.personnelCode)}</span>${u.mainPosition ? `<span>· ${escHtml(u.mainPosition)}</span>` : ''}
                        ${u.isSuperAdmin ? '<span class="p-badge" style="background:#ef44441f;color:#dc2626">سوپرادمین</span>' : ''}</div>
                    </div>
                    <button type="button" class="p-btn" data-imp="${escAttr(u.guid)}">ورود <i class="fa fa-arrow-left"></i></button>
                </div>`).join('') + (UP.hasMore ? '<div class="p-empty"><span class="p-spin"></span></div>' : '');
        } catch { if (seq === UP.seq) body.innerHTML = errorBox('خطا در بارگذاری کاربران', 'users'); }
        finally {
            if (seq === UP.seq) {
                UP.loading = false;
                // اگر صفحه‌ی اول کادر را پر نکرد، رویداد scroll هرگز رخ نمی‌دهد؛ صفحه‌ی بعد همین‌جا خوانده می‌شود
                if (UP.hasMore && body.scrollHeight <= body.clientHeight + 60 && UP.items.length) { UP.page++; loadUsers(true); }
            }
        }
    }
    const resetUsers = () => { UP.page = 1; UP.items = []; UP.hasMore = true; $('#upBody').innerHTML = '<div class="p-skel" style="height:56px;margin:8px"></div>'.repeat(4); loadUsers(false); };
    $('#btnProfiles')?.addEventListener('click', () => { bootstrap.Modal.getOrCreateInstance($('#userProfileModal')).show(); resetUsers(); });
    let upTimer;
    $('#upSearchInput')?.addEventListener('input', e => { clearTimeout(upTimer); upTimer = setTimeout(() => { UP.search = e.target.value.trim(); resetUsers(); }, 350); });
    $('#upBody')?.addEventListener('scroll', e => {
        const el = e.currentTarget;
        if (!UP.loading && UP.hasMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 60) { UP.page++; loadUsers(true); }
    });
    $('#upBody')?.addEventListener('click', async e => {
        const btn = e.target.closest('[data-imp]');
        if (!btn) return;
        const orig = btn.innerHTML;
        btn.disabled = true; btn.innerHTML = '<span class="p-spin"></span>';
        try {
            const res = await getJson('/Grants/ImpersonateUser', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': csrf() },
                body: JSON.stringify({ UserGuid: btn.dataset.imp })
            });
            if (res.success) return location.href = res.redirectUrl;
            toast(res.message || 'خطا در ورود به پروفایل کاربر');
        } catch { toast('خطا در ارتباط با سرور'); }
        btn.disabled = false; btn.innerHTML = orig;
    });

    // ═══ Page tour ═══════════════════════════════════════════════════════
    if (typeof PageTour !== 'undefined') {
        PageTour.init({ storageKey: 'grants_tour_seen_v2' });
        const visible = s => { const el = $(s); return !!el && el.offsetParent !== null; };
        $('#pageTourFab')?.addEventListener('click', () => PageTour.start(() => [
            visible('#hdrPosPill') && { selector: '#hdrPosPill', title: 'سمت فعال', html: 'اگر بیش از یک سمت یا تفویض دارید، از اینجا سمت فعال را عوض کنید؛ سامانه‌ها بر اساس همین سمت نمایش داده می‌شوند.', placement: 'bottom' },
            { selector: '#themeToggle', title: 'حالت روشن / تیره', html: 'ظاهر پورتال را بین حالت روشن و تیره جابه‌جا کنید. انتخاب شما در همین مرورگر ذخیره می‌شود.', placement: 'bottom' },
            { selector: '#hdrUserBtn', title: 'منوی کاربری', html: 'تغییر رمز، تفویض اختیار، مستندات، بازنشانی رمز فرزین و خروج.', placement: 'bottom' },
            { selector: '.db-actions', title: 'دسترسی سریع', html: 'دفترچه تلفن، سوابق ورود و (در صورت داشتن مجوز) ورود به پروفایل کاربران.', placement: 'bottom' },
            { selector: '.db-tabs', title: 'دسته‌بندی سامانه‌ها', html: 'سامانه‌های تحت وب، برنامه‌های ویندوزی و سایر سامانه‌ها در سه زبانه.', placement: 'bottom' },
            { selector: '#appSearch', title: 'جستجوی سریع', html: 'کلید / را بزنید و نام سامانه را تایپ کنید. با ستاره‌ی روی هر کارت، آن را به ابتدای لیست سنجاق کنید.', placement: 'bottom' },
            { selector: '#meetingContainer', title: 'جلسات ۴ روز آینده', html: 'با کلیک روی هر جلسه، جزئیات آن در سامانه‌ی مدیریت جلسات باز می‌شود.', placement: 'left' },
            { selector: '#announceContainer', title: 'اطلاعیه‌ها', html: 'اطلاعیه‌های خوانده‌نشده با نوار آبی مشخص شده‌اند. آرشیو کامل از لینک بالای کارت.', placement: 'left' },
            { selector: '#surveyContainer', title: 'نظرسنجی‌ها', html: 'نظرسنجی‌هایی که باید تکمیل کنید.', placement: 'top' }
        ].filter(Boolean)));
        try { if (localStorage.getItem('grants_tour_seen_v2') === '1') $('#pageTourFab span')?.remove(); } catch { }
    }

    // ═══ Load all ════════════════════════════════════════════════════════
    applyPins($('#systemsGrid'));

    // نور دنبال‌کننده‌ی ماوس روی کاشی‌ها (حداکثر یک بار در هر فریم)
    let glowFrame = 0, glowEvent = null;
    document.addEventListener('pointermove', e => {
        glowEvent = e;
        if (glowFrame) return;
        glowFrame = requestAnimationFrame(() => {
            glowFrame = 0;
            const ev = glowEvent;
            const card = ev?.target.closest?.('.db-app');
            if (!card) return;
            const r = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${ev.clientX - r.left}px`);
            card.style.setProperty('--my', `${ev.clientY - r.top}px`);
        });
    }, { passive: true });

    // Enter/Space روی کارت‌های جلسه، اطلاعیه و نظرسنجی (قبلاً فقط کاشی سامانه‌ها با کیبورد باز می‌شد)
    document.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const card = e.target.closest?.('.db-meet, .db-ann, .db-survey');
        if (card && card === e.target) { e.preventDefault(); card.click(); }
    });

    // «تلاش دوباره» فقط همان بخش را دوباره می‌خواند
    document.addEventListener('click', e => {
        const btn = e.target.closest('[data-retry]');
        if (!btn) return;
        const key = btn.dataset.retry;
        if (key === 'force') { const it = Force.items[Force.idx]; if (it) { it.loaded = false; showForce(Force.idx); } return; }
        if (key === 'users') { resetUsers(); return; }
        const widget = WIDGETS.find(w => w.key === key);
        widget ? loadWidget(widget) : load();
    });

    // با رسیدن اعلان لحظه‌ای سامانه جلسات (portal-realtime.js)، فقط ویجت جلسات دوباره خوانده می‌شود
    let meetingsReloadTimer;
    window.addEventListener('portal:notification', e => {
        if (e.detail?.source !== 'MeetManage') return;
        clearTimeout(meetingsReloadTimer);
        meetingsReloadTimer = setTimeout(async () => {
            try { renderMeetings(await getJson('/Grants/GetMeetings')); } catch { /* ویجت قبلی می‌ماند */ }
        }, 500);
    });

    /*  بارگذاری تدریجی
        ─────────────────────────────────────────────────────────────────────
        • آخرین داده‌ی دیده‌شده (sessionStorage، فقط برای همین کاربر و همین نشست مرورگر) بی‌درنگ نمایش داده می‌شود.
        • هر ویجت درخواست مستقل دارد و به محض رسیدن پاسخش به‌روز می‌شود؛ قبلاً کل داشبورد منتظر کندترین API
          (تا ۱۰ ثانیه) می‌ماند.
        • خطای یک ویجت فقط همان ویجت را «تلاش دوباره» نشان می‌دهد و داده‌ی قبلی (اگر بود) حفظ می‌شود. */
    const CACHE_PREFIX = `epc-dash:${cacheScope}:`;
    // کش سمت‌های دیگر همین کاربر در این تب پاک می‌شود
    try {
        Object.keys(sessionStorage)
            .filter(k => k.startsWith('epc-dash:') && !k.startsWith(CACHE_PREFIX))
            .forEach(k => sessionStorage.removeItem(k));
    } catch { /* حالت خصوصی */ }
    const readCache = key => { try { return JSON.parse(sessionStorage.getItem(CACHE_PREFIX + key) || 'null'); } catch { return null; } };
    const writeCache = (key, value) => { try { sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value)); } catch { /* حجم/حالت خصوصی */ } };

    const WIDGETS = [
        { key: 'meetings', url: '/Grants/GetMeetings', render: renderMeetings },
        { key: 'announcements', url: '/Grants/GetAnnouncements', render: renderAnnouncements, after: startForceRead },
        { key: 'surveys', url: '/Grants/GetSurveys', render: renderSurveys },
        { key: 'windowsApps', url: '/Grants/GetWindowsApps', render: renderWindowsApps },
        { key: 'otherPrograms', url: '/Grants/GetOtherPrograms', render: renderOtherPrograms },
        { key: 'suggestions', url: '/Grants/GetSuggestions', render: renderSuggesters },
    ];

    function paint(widget, data) {
        try { widget.render(data); } catch (e) { console.error('[dashboard]', widget.key, e); }
        $$('.p-scroll').forEach(el => { if (!el.dataset.watched) { el.dataset.watched = '1'; watchScroll(el); } });
    }

    async function loadWidget(widget) {
        const cached = readCache(widget.key);
        try {
            const data = await getJson(widget.url);
            if (data === null && cached) return; // منبع در دسترس نیست؛ همان داده‌ی قبلی می‌ماند
            if (data !== null) writeCache(widget.key, data);
            paint(widget, data);
            if (data !== null) widget.after?.(data);
        } catch {
            if (!cached) paint(widget, null);
        }
    }

    function load() {
        // نمایش فوری از نشست قبلی (بدون انتظار برای شبکه)
        WIDGETS.forEach(w => { const c = readCache(w.key); if (c) paint(w, c); });
        // همه با هم و مستقل
        WIDGETS.forEach(loadWidget);
    }

    load();
    checkTrainingEvaluations();

    /*  ارزیابی‌های تکمیل‌نشده‌ی سامانه فراگیر آموزش
        ─────────────────────────────────────────────────────────────────────
        • فقط یک بار در هر ورود (هر نشست مرورگر) نمایش داده می‌شود، نه با هر رفرش.
        • اگر اطلاعیه‌ی «مطالعه‌ی اجباری» باز است، پیغام پس از بسته شدن آن نمایش داده می‌شود.
        • خطا یا کندی پایگاه داده‌ی آموزش هیچ اثری بر داشبورد ندارد (درخواست مستقل، بدون پیغام خطا). */
    async function checkTrainingEvaluations() {
        const overlay = $('#trainingEvalOverlay');
        if (!overlay || !personnelCode) return;
        const seenKey = `epc-train-shown:${personnelCode}`;
        try { if (sessionStorage.getItem(seenKey)) return; } catch { /* حالت خصوصی */ }

        let res;
        try { res = await getJson('/Grants/GetTrainingEvaluations'); } catch { return; }
        const count = Number(res?.count) || 0;
        if (count <= 0) return;

        // صبر تا بسته شدن اطلاعیه‌ی اجباری (حداکثر چند دقیقه)
        for (let i = 0; i < 600 && $('#forceReadOverlay')?.classList.contains('is-open'); i++) {
            await new Promise(r => setTimeout(r, 500));
        }
        try { sessionStorage.setItem(seenKey, '1'); } catch { }

        // لینک ورود (با بلیط SSO) هنگام کلیک از «سایر برنامه‌ها» (شناسه‌ی سامانه فراگیر آموزش) ساخته می‌شود
        const go = $('#trainingEvalGo');
        const programId = Number(res.programId) || 0;
        go.hidden = !programId;
        $('#trainingEvalCount').textContent = `${fa(count)} ارزیابی تکمیل‌نشده`;

        const previous = document.activeElement;
        const close = () => {
            overlay.hidden = true;
            document.removeEventListener('keydown', onKey);
            previous?.focus?.();
        };
        const onKey = e => {
            if (e.key === 'Escape') close();
            if (e.key === 'Tab') { // نگه داشتن فوکوس داخل پیغام
                const items = $$('button:not([hidden])', overlay);
                const first = items[0], last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        $('#trainingEvalClose').onclick = close;
        go.onclick = async () => {
            go.disabled = true;
            const ok = await launchOtherProgram(programId, 'سامانه فراگیر آموزش');
            go.disabled = false;
            if (ok) close();
        };
        overlay.onclick = e => { if (e.target === overlay) close(); };
        document.addEventListener('keydown', onKey);
        overlay.hidden = false;
        (programId ? go : $('#trainingEvalClose')).focus();
    }
})();
