/* ═══════════════════════════════════════════════════════════════════════
   EPC Portal — Dashboard  (dashboard.js)
   وابستگی‌ها: site-header.js، announcement-common.js (escHtml/escAttr/ANN_TYPE/openAnnouncementDetail)،
               jalali-picker.js، page-tour.js، bootstrap (vendor.min.js)
   همه‌ی داده‌ها با یک درخواست (/Grants/GetDashboardData) و به‌صورت موازی سمت سرور گرفته می‌شوند.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const fa = n => String(n ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
    const csrf = () => window.getCsrfToken?.() || $('input[name="__RequestVerificationToken"]')?.value || '';
    const toast = m => window.showToast?.(m);
    const PALETTE = ['#f97316', '#0ea5e9', '#10b981', '#8b5cf6', '#ef4444', '#14b8a6', '#f59e0b', '#6366f1', '#ec4899', '#22c55e'];
    const personnelCode = $('main[data-personnel-code]')?.dataset.personnelCode || '';

    const getJson = async (url, opts) => {
        const r = await fetch(url, { credentials: 'same-origin', ...opts });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    };
    const empty = (icon, text) => `<div class="p-empty"><i class="fa ${icon}"></i>${text}</div>`;
    const errorBox = text => `<div class="p-empty"><i class="fa fa-triangle-exclamation"></i>${text}<br><button type="button" class="db-retry" data-retry><i class="fa fa-rotate"></i> تلاش دوباره</button></div>`;

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
        const pid = card.dataset.pid;
        if (launching.has(pid)) return;
        launching.add(pid);
        card.classList.add('is-busy');

        // برای وب، پنجره باید هم‌زمان با کلیک باز شود، وگرنه بعد از await توسط popup-blocker بسته می‌شود
        const isWin = card.dataset.iswin === 'true';
        const win = isWin ? null : window.open('about:blank', '_blank');

        try {
            const res = await getJson('/Grants/LaunchOtherProgram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': csrf() },
                body: JSON.stringify({ Id: +pid })
            });
            if (!res.success) throw new Error(res.message);

            if (res.type === 'win') launchHidden(res.url, card.dataset.name);
            else if (win) { win.opener = null; win.location.href = res.url; }
            else toast('⚠️ باز شدن پنجره مسدود شد؛ popup را برای پورتال مجاز کنید.');
        } catch (err) {
            win?.close();
            toast(err.message && !err.message.startsWith('HTTP') ? err.message : 'اجرای برنامه ناموفق بود.');
        } finally {
            launching.delete(pid);
            card.classList.remove('is-busy');
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
        $$('.db-tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === tab));
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
            <div class="db-app" tabindex="0" role="button" data-kind="win" data-id="win:${a.id}" data-url="${escAttr(a.launchUrl)}"
                 data-name="${escAttr(a.name)}" data-desc="${escAttr(a.description)}" title="${escAttr(a.description)}"
                 style="--_c:${PALETTE[(i + 3) % PALETTE.length]};animation-delay:${Math.min(i, 20) * 18}ms">
                <button type="button" class="db-app__pin" aria-label="سنجاق"><i class="fa fa-star"></i></button>
                <span class="db-app__icon">${a.id
                    ? `<img src="/Grants/AppIcon/${a.id}" alt="" loading="lazy" onerror="this.outerHTML='<i class=&quot;fa fa-desktop&quot;></i>'">`
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
        <div class="db-app" tabindex="0" role="button" data-kind="other" data-id="other:${p.id}" data-pid="${p.id}"
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
        if (!list) return ct.innerHTML = errorBox('جلسات در دسترس نیست');
        if (!list.length) return ct.innerHTML = empty('fa-mug-hot', 'جلسه‌ای در ۴ روز آینده ندارید');

        ct.innerHTML = list.map(m => {
            // قالب تاریخ: yyyy/MM/dd - HH:mm~HH:mm
            const [datePart, timePart] = String(m.date || '').split(' - ');
            const [, mo, d] = (datePart || '').split('/');
            const st = MEETING_STATUS[m.status] || MEETING_STATUS[1];
            const url = m.baseUrl ? `${m.baseUrl}/#/meetings/details/${m.guid}` : '';
            return `
            <div class="db-meet" tabindex="0" data-href="${escAttr(url)}">
                <div class="db-meet__date"><b>${fa(+d || '')}</b><span>${typeof MONTH_NAMES_FA !== 'undefined' && mo ? MONTH_NAMES_FA[+mo - 1] || '' : ''}</span></div>
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
        if (!list) { setCount('#countUnread', null, true); return ct.innerHTML = errorBox('اطلاعیه‌ها در دسترس نیست'); }
        const unread = list.filter(a => !a.isRead).length;
        setCount('#countUnread', unread, true);
        if (!list.length) return ct.innerHTML = empty('fa-bell-slash', 'اطلاعیه‌ای وجود ندارد');

        ct.innerHTML = list.map(a => {
            const cfg = ANN_TYPE[a.type] || ANN_TYPE.info;
            const pri = a.priority === 3 ? '<span class="p-badge" style="background:#ef44441f;color:#ef4444">فوری</span>'
                : a.priority === 2 ? '<span class="p-badge" style="background:#f59e0b1f;color:#d97706">مهم</span>' : '';
            return `
            <div class="db-ann ${a.isRead ? '' : 'db-ann--unread'}" tabindex="0" data-guid="${a.guid}">
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
        if (!list) return ct.innerHTML = errorBox('نظرسنجی‌ها در دسترس نیست');
        if (!list.length) return ct.innerHTML = empty('fa-circle-check', 'نظرسنجی فعالی برای شما وجود ندارد');

        ct.innerHTML = list.map(s => {
            const pct = s.responseStatus === 1 ? Math.round(s.progressPercentage) : 0;
            const badge = s.responseStatus === 0
                ? '<span class="p-badge" style="background:#f973161f;color:#ea580c">جدید</span>'
                : '<span class="p-badge" style="background:#0ea5e91f;color:#0284c7">ناتمام</span>';
            return `
            <div class="db-survey" tabindex="0" data-href="${escAttr(`${s.surveyBaseUrl}/#/survey/take/${s.guid}`)}">
                <div class="db-survey__head"><div class="db-survey__title">${escHtml(s.title)}</div>${badge}</div>
                <div class="db-survey__bar"><span style="width:${pct}%"></span></div>
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
                    ? `<img class="db-sugg__avatar" src="${escAttr(s.imageUrl)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;db-sugg__avatar&quot;>${escAttr(initial(s.lfName))}</div>'">`
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
        const auto = () => { clearInterval(Sugg.timer); if (Sugg.n > 1) Sugg.timer = setInterval(() => go(Sugg.cur + 1), 4500); };
        ct.onclick = e => {
            const step = e.target.closest('[data-sugg]'); const dot = e.target.closest('[data-sugg-go]');
            if (step) go(Sugg.cur + +step.dataset.sugg);
            if (dot) go(+dot.dataset.suggGo);
        };
        ct.onmouseenter = () => clearInterval(Sugg.timer);
        ct.onmouseleave = auto;
        auto();
    }

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
        if (!it.loaded) {
            body.innerHTML = '<div class="p-skel" style="height:120px"></div>';
            try {
                const res = await getJson(`/Grants/GetAnnouncementDetail?guid=${it.guid}`);
                if (res?.success) { it.data = res.data; it.loaded = true; }
            } catch { }
        }
        if (!it.data) { body.innerHTML = errorBox('بارگذاری جزئیات ممکن نشد'); return; }
        let html = `<div>${escHtml(it.data.body)}</div>`;
        if (it.data.files?.length && typeof buildFileSlideshowHtml === 'function') html += buildFileSlideshowHtml(it.data.files);
        typeof setHtml === 'function' ? setHtml(body, html) : (body.innerHTML = html);
        body.scrollTop = 0;
    }

    $('#forceConfirm')?.addEventListener('click', async e => {
        const btn = e.currentTarget, it = Force.items[Force.idx];
        if (!it) return;
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
            $(`.db-ann[data-guid="${it.guid}"]`)?.classList.remove('db-ann--unread');
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
    async function loadSessions() {
        const tbody = $('#sessionTableBody');
        tbody.innerHTML = '<tr><td colspan="3" class="sess-empty-row"><span class="p-spin"></span></td></tr>';
        try {
            const { from, to } = sessPicker.getRange();
            const q = `fromDate=${from ? jalaaliToStr(from) : ''}&toDate=${to ? jalaaliToStr(to) : ''}`;
            const res = await getJson(`/Grants/GetSessions?${q}`);
            const items = res.items || [];
            tbody.innerHTML = items.length
                ? items.map(s => `<tr><td>${escHtml(s.created)}</td>
                    <td>${s.isSuccessful ? '<span class="p-badge" style="background:#10b9811f;color:#059669">موفق</span>' : '<span class="p-badge" style="background:#ef44441f;color:#dc2626">ناموفق</span>'}</td>
                    <td dir="ltr" style="text-align:right">${escHtml(s.clientIpAddress)}</td></tr>`).join('')
                : '<tr><td colspan="3" class="sess-empty-row">در این بازه سابقه‌ای یافت نشد</td></tr>';
        } catch { tbody.innerHTML = '<tr><td colspan="3" class="sess-empty-row">خطا در بارگذاری</td></tr>'; }
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
    const UP = { page: 1, search: '', loading: false, hasMore: true, items: [] };
    async function loadUsers(append) {
        const body = $('#upBody');
        UP.loading = true;
        try {
            const res = await getJson(`/Grants/GetUsersForProfile?search=${encodeURIComponent(UP.search)}&page=${UP.page}&pageSize=20`);
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
                    <button type="button" class="p-btn" data-imp="${u.guid}">ورود <i class="fa fa-arrow-left"></i></button>
                </div>`).join('') + (UP.hasMore ? '<div class="p-empty"><span class="p-spin"></span></div>' : '');
        } catch { body.innerHTML = errorBox('خطا در بارگذاری کاربران'); }
        finally { UP.loading = false; }
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

    // نور دنبال‌کننده‌ی ماوس روی کاشی‌ها
    document.addEventListener('pointermove', e => {
        const card = e.target.closest?.('.db-app');
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });

    document.addEventListener('click', e => { if (e.target.closest('[data-retry]')) load(); });

    // با رسیدن اعلان لحظه‌ای سامانه جلسات (portal-realtime.js)، فقط ویجت جلسات دوباره خوانده می‌شود
    let meetingsReloadTimer;
    window.addEventListener('portal:notification', e => {
        if (e.detail?.source !== 'MeetManage') return;
        clearTimeout(meetingsReloadTimer);
        meetingsReloadTimer = setTimeout(async () => {
            try { renderMeetings(await getJson('/Grants/GetMeetings')); } catch { /* ویجت قبلی می‌ماند */ }
        }, 500);
    });

    load();
    async function load() {
        try {
            const d = await getJson('/Grants/GetDashboardData');
            renderMeetings(d.meetings);
            renderAnnouncements(d.announcements);
            renderSurveys(d.surveys);
            renderSuggesters(d.suggestions);
            renderWindowsApps(d.windowsApps);
            renderOtherPrograms(d.otherPrograms);
            startForceRead(d.announcements);
            $$('.p-scroll').forEach(watchScroll);
        } catch {
            renderMeetings(null); renderAnnouncements(null); renderSurveys(null); renderSuggesters(null);
        }
    }
})();
