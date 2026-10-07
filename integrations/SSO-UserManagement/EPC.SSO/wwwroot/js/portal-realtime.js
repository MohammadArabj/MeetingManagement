/* ════════════════════════════════════════════════════════════════════════
   اعلان‌های لحظه‌ای پرتال (SignalR: /hubs/portal)
   ─────────────────────────────────────────────────────────────────────────
   • احراز هویت با کوکی SSO؛ هر کاربر فقط اعلان‌های خودش را دریافت می‌کند.
   • با هر اعلان: نمایش toast + رویداد «portal:notification» برای به‌روزرسانی ویجت‌ها.
   • قطع ارتباط: اتصال مجدد خودکار با فاصله‌ی افزایشی.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (!window.signalR) return;

    function show(n) {
        const text = n.title ? `${n.title}: ${n.message || ''}` : (n.message || '');
        if (typeof window.showToast === 'function') {
            window.showToast(text);
        } else {
            console.info('[portal]', text);
        }

        // اعلان مرورگر (فقط اگر کاربر قبلاً اجازه داده باشد و صفحه در پس‌زمینه است)
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(n.title || 'پرتال', { body: n.message || '', dir: 'rtl', lang: 'fa' });
            if (n.link) notification.onclick = () => window.open(n.link, '_blank', 'noopener');
        }
    }

    const connection = new signalR.HubConnectionBuilder()
        .withUrl('/hubs/portal')
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000, 60000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

    connection.on('portalNotification', n => {
        show(n);
        window.dispatchEvent(new CustomEvent('portal:notification', { detail: n }));
    });

    async function start(delay = 0) {
        if (delay) await new Promise(r => setTimeout(r, delay));
        try {
            await connection.start();
        } catch {
            // سرور در دسترس نیست؛ با تأخیر بیشتر دوباره تلاش می‌شود (حداکثر هر ۲ دقیقه)
            start(Math.min((delay || 2000) * 2, 120000));
        }
    }

    connection.onclose(() => start(5000));
    start();
})();
