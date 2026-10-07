const archPicker = createJalaliRangePicker({
    popupEl: document.getElementById('archCalendarPopup'),
    fromBtnEl: document.getElementById('archFromBtn'),
    toBtnEl: document.getElementById('archToBtn'),
    fromLabelEl: document.getElementById('archFromLabel'),
    toLabelEl: document.getElementById('archToLabel'),
    containerEl: document.getElementById('archFilterCard'),
    onChange: () => loadArchivePage(1),
});

let _archTitleTimer = null;
document.getElementById('archTitleInput').addEventListener('input', () => {
    clearTimeout(_archTitleTimer);
    _archTitleTimer = setTimeout(() => loadArchivePage(1), 400);
});

function clearArchFilters() {
    document.getElementById('archTitleInput').value = '';
    archPicker.clear();
    loadArchivePage(1);
}

const PAGE_SIZE = 10;
let _curPage = 1;

function renderArchiveList(items, ct) {
    if (!items?.length) {
        ct.innerHTML = `<div class="placeholder-note"><i class="fa fa-inbox"></i><span>اطلاعیه‌ای با این فیلتر یافت نشد</span></div>`;
        return;
    }
    ct.innerHTML = items.map(a => {
        const cfg = ANN_TYPE[a.type] || ANN_TYPE.info;
        const unread = !a.isRead && a.requireReadConfirmation;
        let pri = '';
        if (a.priority === 3) pri = `<span class="ann-badge" style="background:#fef2f2;color:#dc2626">فوری</span>`;
        else if (a.priority === 2) pri = `<span class="ann-badge" style="background:#fef3c7;color:#b45309">مهم</span>`;
        return `
        <div class="ann-item${unread ? ' ann-item--unread' : ''}" role="button" tabindex="0" data-ann-guid="${escAttr(a.guid)}">
            <div class="ann-dot" style="background:${cfg.color}"></div>
            <div class="ann-content">
                <div class="ann-title" title="${escAttr(a.title)}">${escHtml(a.title)}</div>
                <div class="ann-meta">
                    <span class="ann-badge" style="background:${cfg.bg};color:${cfg.color}">${cfg.label}</span>
                    <span>${escHtml(a.date)}</span>
                    ${pri}
                    ${a.fileCount > 0 ? `<span><i class="fa fa-paperclip"></i> ${a.fileCount} پیوست</span>` : ''}
                    ${unread ? `<span style="color:var(--orange);font-weight:700"><i class="fa fa-circle" style="font-size:.5rem"></i> خوانده‌نشده</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderPagination(total, page, pageSize) {
    const ct = document.getElementById('archPagination');
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    document.getElementById('archCount').textContent = total > 0 ? `${toPersianNum(total)} اطلاعیه` : '';

    if (totalPages <= 1) { ct.innerHTML = ''; return; }

    const btn = (p, label, active, disabled) =>
        `<button type="button" class="arch-page-btn${active ? ' arch-page-btn--active' : ''}" ${disabled ? 'disabled' : ''} data-page="${p}"${active ? ' aria-current="page"' : ''}>${label}</button>`;

    let html = btn(page - 1, '<i class="fa fa-chevron-right"></i>', false, page === 1);

    const windowSize = 2;
    const pages = new Set([1, totalPages]);
    for (let p = page - windowSize; p <= page + windowSize; p++) if (p >= 1 && p <= totalPages) pages.add(p);
    const sorted = [...pages].sort((a, b) => a - b);

    let prev = 0;
    for (const p of sorted) {
        if (prev && p - prev > 1) html += `<span class="arch-page-ellipsis">…</span>`;
        html += btn(p, toPersianNum(p), p === page, false);
        prev = p;
    }

    html += btn(page + 1, '<i class="fa fa-chevron-left"></i>', false, page === totalPages);
    ct.innerHTML = html;
}

let _archiveSeq = 0;

async function loadArchivePage(page) {
    if (page < 1) return;
    _curPage = page;
    // درخواست‌های قدیمی‌تر (مثلاً هنگام تایپ) نتیجه‌ی جدیدتر را بازنویسی نمی‌کنند
    const seq = ++_archiveSeq;
    const ct = document.getElementById('archiveList');
    ct.innerHTML = Array(5).fill('<div class="ann-skeleton"></div>').join('');

    try {
        const title = document.getElementById('archTitleInput').value.trim();
        const { from, to } = archPicker.getRange();
        const fromStr = from ? jalaaliToStr(from) : '';
        const toStr = to ? jalaaliToStr(to) : '';

        const url = `/Grants/GetAnnouncementsArchive?page=${page}&pageSize=${PAGE_SIZE}&title=${encodeURIComponent(title)}&fromDate=${fromStr}&toDate=${toStr}`;
        const r = await fetch(url);
        if (seq !== _archiveSeq) return;
        if (!r.ok) throw new Error();
        const res = await r.json();
        if (seq !== _archiveSeq) return;
        renderArchiveList(res.items, ct);
        renderPagination(res.total, res.page, res.pageSize);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
        if (seq !== _archiveSeq) return;
        ct.innerHTML = `<div class="placeholder-note"><i class="fa fa-triangle-exclamation"></i><span>خطا در بارگذاری اطلاعیه‌ها</span></div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadArchivePage(1);

    const list = document.getElementById('archiveList');
    const openItem = e => {
        const item = e.target.closest('[data-ann-guid]');
        if (item) openAnnouncementDetail(item.dataset.annGuid);
    };
    list?.addEventListener('click', openItem);
    list?.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(e); }
    });
    document.getElementById('archPagination')?.addEventListener('click', e => {
        const b = e.target.closest('button[data-page]');
        if (b && !b.disabled) loadArchivePage(Number(b.dataset.page));
    });
});