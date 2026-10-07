/* EPC Portal — Header: تم، تغییر سمت، بازنشانی فرزین، Toast  (site-header.js) */
(function () {
    'use strict';

    const csrf = () => document.getElementById('globalAntiForgery')?.value
        || document.querySelector('input[name="__RequestVerificationToken"]')?.value || '';
    window.getCsrfToken = window.getCsrfToken || csrf;

    // ── Theme ─────────────────────────────────────────────────────────────
    window.EpcTheme = {
        get: () => document.documentElement.getAttribute('data-theme') || 'light',
        set(t) {
            document.documentElement.setAttribute('data-theme', t);
            try { localStorage.setItem('epc-theme', t); } catch { }
        },
        toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); }
    };
    document.getElementById('themeToggle')?.addEventListener('click', () => EpcTheme.toggle());

    // ── Toast ─────────────────────────────────────────────────────────────
    let toastTimer;
    window.showToast = function (msg, ms = 2800) {
        const t = document.getElementById('pToast');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('is-visible'), ms);
    };
    window.hideToast = () => document.getElementById('pToast')?.classList.remove('is-visible');

    // ── خروج: داده‌های کش‌شده‌ی داشبورد در این تب پاک می‌شود ─────────────────
    document.getElementById('navItemLogout')?.addEventListener('click', () => {
        try {
            Object.keys(sessionStorage).filter(k => k.startsWith('epc-dash:')).forEach(k => sessionStorage.removeItem(k));
        } catch { }
    });

    // ── Position switcher ─────────────────────────────────────────────────
    const pill = document.getElementById('hdrPosPill');
    if (pill) {
        let positions = [];
        try { positions = JSON.parse(pill.dataset.positions || '[]'); } catch { }
        const selected = (pill.dataset.selected || '').toLowerCase();
        const sel = document.getElementById('hdrPositionSelect');
        const lbl = document.getElementById('hdrPosLabel');
        const title = p => p.title + (p.isDelegated ? ' (تفویضی)' : '');

        positions.forEach(p => {
            const o = document.createElement('option');
            o.value = p.guid;
            o.textContent = title(p);
            o.selected = String(p.guid || '').toLowerCase() === selected;
            sel.appendChild(o);
        });
        const current = positions.find(p => String(p.guid || '').toLowerCase() === selected) ?? positions[0];
        if (current) lbl.textContent = title(current);

        sel.addEventListener('change', async () => {
            lbl.textContent = sel.options[sel.selectedIndex]?.text ?? '';
            sel.disabled = true;
            try {
                const r = await fetch('/Grants/ChangePosition', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', 'RequestVerificationToken': csrf() },
                    body: JSON.stringify({ PositionGuid: sel.value })
                });
                const d = await r.json();
                if (d.success) location.reload();
                else { showToast(d.message || 'خطا در تغییر سمت'); sel.disabled = false; }
            } catch {
                showToast('خطا در ارتباط با سرور');
                sel.disabled = false;
            }
        });
    }

    // ── Farzin reset ──────────────────────────────────────────────────────
    window.resetFarzinPassword = async function () {
        const icon = document.getElementById('farzinResetIcon');
        const msg = document.getElementById('farzinResetMsg');
        const spin = document.getElementById('farzinResetSpinner');
        const close = document.getElementById('farzinResetClose');
        icon.textContent = '🔐'; msg.textContent = 'در حال بازنشانی رمز فرزین...';
        spin.style.display = ''; close.style.display = 'none';
        bootstrap.Modal.getOrCreateInstance(document.getElementById('farzinResetModal')).show();
        try {
            const r = await fetch('/Account/ResetFarzinPassword', {
                method: 'POST', credentials: 'same-origin', headers: { 'RequestVerificationToken': csrf() }
            });
            const d = await r.json();
            icon.textContent = d.success ? '✅' : '❌';
            msg.textContent = d.message;
        } catch {
            icon.textContent = '❌'; msg.textContent = 'خطا در ارتباط با سرور';
        } finally {
            spin.style.display = 'none'; close.style.display = '';
        }
    };

    // ── Impersonation exit ────────────────────────────────────────────────
    window.endImpersonation = async function () {
        try {
            await fetch('/Grants/EndImpersonation', { method: 'POST', credentials: 'same-origin', headers: { 'RequestVerificationToken': csrf() } });
        } finally { location.href = '/Grants/Index'; }
    };
})();
