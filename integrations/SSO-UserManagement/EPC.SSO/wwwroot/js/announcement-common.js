const escHtml = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// داده‌ی سرور هرگز داخل onclick قرار نمی‌گیرد (entity ها قبل از اجرای JS decode می‌شوند = XSS با نام فایل)؛
// فقط در data-* و با listener مرکزی پایین همین فایل خوانده می‌شود.
const escAttr = escHtml;

const formatSize = bytes => {
    if (!bytes || bytes === 0) return '';
    const k = 1024, u = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + u[i];
};

const getFileIcon = ct => {
    if (!ct) return 'fa-file';
    if (ct.includes('word')) return 'fa-file-word';
    if (ct.includes('excel') || ct.includes('sheet')) return 'fa-file-excel';
    if (ct.includes('zip') || ct.includes('rar')) return 'fa-file-archive';
    if (ct.startsWith('text/')) return 'fa-file-alt';
    return 'fa-file';
};

const ANN_TYPE = {
    info: { color: '#3b82f6', bg: '#eff6ff', icon: 'fa-info-circle', label: 'اطلاعیه' },
    warn: { color: '#b45309', bg: '#fef3c7', icon: 'fa-exclamation-triangle', label: 'هشدار' },
    success: { color: '#16a34a', bg: '#f0fdf4', icon: 'fa-check-circle', label: 'موفقیت' },
    danger: { color: '#dc2626', bg: '#fef2f2', icon: 'fa-times-circle', label: 'فوری' },
};

const FssReg = {
    _m: {},
    add(id, total) { this._m[id] = { cur: 0, total }; },
    go(id, idx) {
        const s = this._m[id]; const el = document.getElementById(id);
        if (!s || !el) return;
        const slides = el.querySelectorAll('.fss-slide');
        const dots = el.querySelectorAll('.fss-dot');
        slides[s.cur]?.classList.remove('fss-slide--active');
        dots[s.cur]?.classList.remove('fss-dot--active');
        s.cur = ((idx % s.total) + s.total) % s.total;
        slides[s.cur]?.classList.add('fss-slide--active');
        dots[s.cur]?.classList.add('fss-dot--active');
        const ctr = document.getElementById(id + '_ctr');
        if (ctr) ctr.textContent = `${toPersianNum(s.cur + 1)} / ${toPersianNum(s.total)}`;
    },
    prev(id) { const s = this._m[id]; if (s) this.go(id, s.cur - 1); },
    next(id) { const s = this._m[id]; if (s) this.go(id, s.cur + 1); },
};

function buildFileSlideshowHtml(files) {
    const media = files.filter(f => f.isImage || f.isPdf);
    const other = files.filter(f => !f.isImage && !f.isPdf);
    const ssId = 'fss_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5);
    let html = '';

    if (media.length > 0) {
        html += `<div class="file-slideshow" id="${ssId}"><div class="fss-viewport">`;
        media.forEach((f, i) => {
            const isActive = i === 0;
            const proxyUrl = `/Grants/FileProxy?guid=${encodeURIComponent(f.fileGuid)}`;
            const dlUrl = proxyUrl;
            html += `<div class="fss-slide${isActive ? ' fss-slide--active' : ''}" data-idx="${i}">`;
            if (f.isImage) {
                html += `<div class="fss-media--image"><img src="${escAttr(f.fileUrl)}" alt="${escAttr(f.displayName)}"
                    loading="${isActive ? 'eager' : 'lazy'}"
                    onerror="this.closest('.fss-media--image').innerHTML='<div class=fss-error>خطا در بارگذاری تصویر</div>'" /></div>`;
            } else {
                html += `<div class="fss-pdf-iframe-wrap"><iframe src="${escAttr(proxyUrl)}" class="fss-pdf-iframe"
                    title="${escAttr(f.displayName)}" loading="${isActive ? 'eager' : 'lazy'}"></iframe></div>`;
            }
            html += `<div class="fss-caption">
                <i class="fa ${f.isImage ? 'fa-image' : 'fa-file-pdf'} fss-caption__icon" ${f.isPdf ? 'style="color:#f87171"' : ''}></i>
                <span class="fss-caption__name">${escHtml(f.displayName)}</span>
                ${f.fileSize ? `<span class="fss-caption__size">${formatSize(f.fileSize)}</span>` : ''}
                ${f.isPdf ? `<button type="button" class="fss-caption__open" title="نمایش کامل در تب جدید" aria-label="نمایش کامل در تب جدید" data-open-url="${escAttr(dlUrl)}">↗</button>` : ''}
                <button type="button" class="fss-caption__dl" title="دانلود" aria-label="دانلود" data-dl-url="${escAttr(dlUrl)}" data-dl-name="${escAttr(f.displayName)}">
                    <i class="fa fa-download"></i></button>
            </div>`;
            html += `</div>`;
        });
        html += `</div>`;
        if (media.length > 1) {
            html += `<div class="fss-controls">
                <button type="button" class="fss-arrow" onclick="FssReg.prev('${ssId}')"><i class="fa fa-chevron-right"></i></button>
                <div class="fss-dots">${media.map((_, i) =>
                `<button type="button" class="fss-dot${i === 0 ? ' fss-dot--active' : ''}" onclick="FssReg.go('${ssId}',${i})"></button>`
            ).join('')}</div>
                <button type="button" class="fss-arrow" onclick="FssReg.next('${ssId}')"><i class="fa fa-chevron-left"></i></button>
            </div>
            <div class="fss-counter" id="${ssId}_ctr">${toPersianNum(1)} / ${toPersianNum(media.length)}</div>`;
        }
        html += `</div>`;
        window.__pdfSS = window.__pdfSS || [];
        window.__pdfSS.push({ ssId, total: media.length });
    }

    if (other.length > 0) {
        html += `<div class="ann-files-section${media.length > 0 ? ' ann-files-section--border' : ''}">
            <div class="ann-files-title"><i class="fa fa-paperclip"></i> پیوست‌ها</div>`;
        other.forEach(f => {
            html += `<button type="button" class="ann-file-link"
                data-dl-url="${escAttr('/Grants/FileProxy?guid=' + encodeURIComponent(f.fileGuid))}" data-dl-name="${escAttr(f.displayName)}">
                <i class="fa ${getFileIcon(f.contentType)} file-icon"></i>
                <span class="file-name">${escHtml(f.displayName)}</span>
                <span class="file-size">${formatSize(f.fileSize)}</span>
                <i class="fa fa-download" style="color:#94a3b8;font-size:.72rem"></i>
            </button>`;
        });
        html += `</div>`;
    }
    return html;
}

function _activatePdf() {
    // اسلایدشوهایی که دیگر در صفحه نیستند حذف می‌شوند (قبلاً _m با هر بار باز شدن مودال بزرگ‌تر می‌شد)
    Object.keys(FssReg._m).forEach(id => { if (!document.getElementById(id)) delete FssReg._m[id]; });
    (window.__pdfSS || []).forEach(({ ssId, total }) => FssReg.add(ssId, total));
    delete window.__pdfSS;
}

// دانلود/باز کردن پیوست‌ها (به جای onclick داخل HTML)
document.addEventListener('click', e => {
    const dl = e.target.closest?.('[data-dl-url]');
    if (dl) {
        e.preventDefault();
        e.stopPropagation();
        proxyDownload(dl.dataset.dlUrl, dl.dataset.dlName, { currentTarget: dl });
        return;
    }
    const open = e.target.closest?.('[data-open-url]');
    if (open && open.dataset.openUrl.startsWith('/')) {
        e.preventDefault();
        window.open(open.dataset.openUrl, '_blank', 'noopener,noreferrer');
    }
});
function setHtml(el, html) { el.innerHTML = html; _activatePdf(); }

async function proxyDownload(proxyUrl, fileName, evt) {
    const btn = evt?.currentTarget;
    let orig = null;
    try {
        if (btn) { orig = btn.innerHTML; btn.innerHTML = '<span class="fss-dl-spin"></span>'; btn.disabled = true; }
        const resp = await fetch(proxyUrl, { credentials: 'same-origin' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), { href: url, download: fileName || 'file' });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
        console.error('[proxyDownload]', e);
        alert('خطا در دانلود فایل. لطفاً دوباره تلاش کنید.');
    } finally {
        if (btn && orig !== null) { btn.innerHTML = orig; btn.disabled = false; }
    }
}

async function openAnnouncementDetail(guid) {
    const els = {
        header: document.getElementById('annDetailHeader'),
        title: document.getElementById('annDetailTitle'),
        icon: document.getElementById('annDetailIcon'),
        body: document.getElementById('annDetailBody'),
        footer: document.getElementById('annDetailFooter'),
        mark: document.getElementById('annConfirmedMark'),
    };
    els.title.textContent = 'در حال بارگذاری...';
    els.body.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;
    els.footer.style.display = 'none';
    els.mark.classList.add('d-none');

    // یک نمونه برای مودال (قبلاً هر کلیک یک نمونه‌ی جدید می‌ساخت؛ listener و backdrop روی هم انباشته می‌شد)
    bootstrap.Modal.getOrCreateInstance(document.getElementById('annDetailModal')).show();

    // اگر کاربر سریع اطلاعیه‌ی دیگری را باز کند، پاسخ قبلی نادیده گرفته می‌شود
    const requestId = (openAnnouncementDetail._seq = (openAnnouncementDetail._seq || 0) + 1);
    const isStale = () => requestId !== openAnnouncementDetail._seq;

    try {
        const resp = await fetch(`/Grants/GetAnnouncementDetail?guid=${encodeURIComponent(guid)}`);
        if (isStale()) return;
        if (!resp.ok) throw new Error();
        const res = await resp.json();
        if (isStale()) return;
        if (!res.success) { els.body.innerHTML = '<p class="text-danger">خطا در بارگذاری.</p>'; return; }

        const d = res.data;
        const cfg = ANN_TYPE[d.type] || ANN_TYPE.info;
        els.header.style.background = cfg.color;
        els.icon.innerHTML = `<i class="fas ${cfg.icon}"></i>`;
        els.title.textContent = d.title;

        let html = `<p class="ann-detail-body-text">${escHtml(d.body)}</p>
        <div class="ann-meta" style="margin-bottom:1rem">
            <span class="ann-badge" style="background:${cfg.bg};color:${cfg.color}">${cfg.label}</span>
            <span style="font-size:.78rem;color:#94a3b8">${escHtml(d.date)}</span>
        </div>`;

        if (d.files?.length > 0) html += buildFileSlideshowHtml(d.files);
        setHtml(els.body, html);

        if (d.requireReadConfirmation && d.isRead) {
            els.footer.style.display = '';
            els.mark.classList.remove('d-none');
        }
    } catch {
        if (!isStale()) els.body.innerHTML = '<p class="text-danger">خطا در ارتباط با سرور.</p>';
    }
}