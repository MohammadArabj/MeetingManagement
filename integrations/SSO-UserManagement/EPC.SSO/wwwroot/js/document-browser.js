// ═══════════════════════════════════════════════════════════════
//  DOCUMENTS BROWSER — کاوشگر مستندات سیستم‌ها
// ═══════════════════════════════════════════════════════════════
const DocBrowser = (function () {
    let rootUuid = '';
    let rootLabel = 'مستندات سیستم‌ها';
    let crumbs = []; // [{ uuid, name }]
    let currentFolders = [];
    let currentDocuments = [];

    function formatSize(bytes) {
        if (!bytes || bytes === 0) return '';
        const k = 1024, u = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + u[i];
    }

    function escHtml(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    // داده‌ها هرگز داخل onclick قرار نمی‌گیرند (decode شدن entity ها قبل از اجرای JS = XSS)؛
    // فقط در data-* و با یک listener مرکزی خوانده می‌شوند
    const escAttr = escHtml;

    function iconForMime(mime, name) {
        const m = (mime || '').toLowerCase();
        const ext = (name || '').split('.').pop()?.toLowerCase() || '';

        if (m === 'application/pdf' || ext === 'pdf') return { icon: 'fa-file-pdf', cls: 'doc-icon--pdf' };
        if (m.includes('word') || ['doc', 'docx'].includes(ext)) return { icon: 'fa-file-word', cls: 'doc-icon--word' };
        if (m.includes('sheet') || m.includes('excel') || ['xls', 'xlsx'].includes(ext)) return { icon: 'fa-file-excel', cls: 'doc-icon--excel' };
        if (m.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return { icon: 'fa-file-powerpoint', cls: 'doc-icon--ppt' };
        if (m.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return { icon: 'fa-file-image', cls: 'doc-icon--image' };
        if (m.includes('zip') || m.includes('rar') || ['zip', 'rar', '7z'].includes(ext)) return { icon: 'fa-file-archive', cls: 'doc-icon--zip' };
        if (m.startsWith('text/')) return { icon: 'fa-file-lines', cls: 'doc-icon--generic' };
        return { icon: 'fa-file', cls: 'doc-icon--generic' };
    }

    function renderBreadcrumb() {
        const ct = document.getElementById('docBreadcrumb');
        ct.innerHTML = crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return `
            ${i > 0 ? '<span class="doc-crumb-sep"><i class="fa fa-chevron-left"></i></span>' : ''}
            <button type="button" class="doc-crumb${isLast ? ' doc-crumb--active' : ''}"
                data-action="crumb" data-index="${i}" ${isLast ? 'disabled' : ''}>
                ${i === 0 ? '<i class="fa fa-folder-tree"></i>' : ''} ${escHtml(c.name)}
            </button>`;
        }).join('');
    }

    function setLoading(loading) {
        document.getElementById('docLoadingBar')?.classList.toggle('doc-loading-bar--hidden', !loading);
    }

    async function browse(uuid) {
        setLoading(true);
        const foldersGrid = document.getElementById('docFoldersGrid');
        const docsGrid = document.getElementById('docFilesGrid');
        const foldersSection = document.getElementById('docFoldersSection');
        const filesSection = document.getElementById('docFilesSection');

        foldersGrid.innerHTML = Array(3).fill('<div class="doc-skeleton"></div>').join('');
        docsGrid.innerHTML = Array(4).fill('<div class="doc-skeleton"></div>').join('');
        foldersSection.style.display = '';
        filesSection.style.display = '';

        try {
            const r = await fetch(`/Documents/Browse?folderUuid=${encodeURIComponent(uuid)}`);
            if (!r.ok) throw new Error();
            const res = await r.json();
            currentFolders = res.folders || [];
            currentDocuments = res.documents || [];
            renderGrids(currentFolders, currentDocuments);
        } catch {
            foldersSection.style.display = 'none';
            docsGrid.innerHTML = `<div class="doc-empty"><i class="fa fa-triangle-exclamation"></i><span>خطا در بارگذاری محتوای این پوشه</span></div>`;
        } finally {
            setLoading(false);
        }
    }

    function renderGrids(folders, documents) {
        const foldersGrid = document.getElementById('docFoldersGrid');
        const docsGrid = document.getElementById('docFilesGrid');
        const foldersSection = document.getElementById('docFoldersSection');
        const filesSection = document.getElementById('docFilesSection');

        document.getElementById('docFoldersCount').textContent = folders.length ? `${toPersianNum(folders.length)} پوشه` : '';
        document.getElementById('docFilesCount').textContent = documents.length ? `${toPersianNum(documents.length)} فایل` : '';

        foldersSection.style.display = folders.length ? '' : 'none';

        foldersGrid.innerHTML = folders.map(f => `
            <div class="doc-card doc-card--folder" data-name="${escAttr(f.name)}" tabindex="0" role="button"
                 data-action="folder" data-uuid="${escAttr(f.uuid)}">
                <i class="fa fa-chevron-left doc-folder-chevron"></i>
                <div class="doc-card-icon"><i class="fa fa-folder"></i></div>
                <div class="doc-card-name">${escHtml(f.name || 'بدون‌نام')}</div>
                ${f.created ? `<div class="doc-card-meta">${escHtml(f.created)}</div>` : ''}
            </div>`).join('');

        if (!documents.length) {
            docsGrid.innerHTML = `<div class="doc-empty"><i class="fa fa-inbox"></i><span>فایلی در این پوشه وجود ندارد</span></div>`;
            return;
        }

        docsGrid.innerHTML = documents.map(d => {
            const { icon, cls } = iconForMime(d.mimeType, d.name);
            return `
    <div class="doc-card" data-name="${escAttr(d.name)}" tabindex="0" role="button"
         data-action="open" data-uuid="${escAttr(d.uuid)}">
        <button type="button" class="doc-card-download" title="دانلود" aria-label="دانلود"
            data-action="download" data-uuid="${escAttr(d.uuid)}">
            <i class="fa fa-download"></i>
        </button>
        <div class="doc-card-icon ${cls}"><i class="fa ${icon}"></i></div>
        <div class="doc-card-name" title="${escAttr(d.name)}">${escHtml(d.name || 'بدون‌نام')}</div>
        <div class="doc-card-meta">${formatSize(d.size)}${d.created ? ' · ' + escHtml(d.created) : ''}</div>
    </div>`;
        }).join('');
    }

    function openFolder(uuid, name) {
        crumbs.push({ uuid, name });
        renderBreadcrumb();
        browse(uuid);
    }

    function goToCrumb(index) {
        if (index >= crumbs.length - 1) return;
        crumbs = crumbs.slice(0, index + 1);
        renderBreadcrumb();
        browse(crumbs[crumbs.length - 1].uuid);
    }

    function download(uuid, name) {
        const a = document.createElement('a');
        a.href = `/Documents/Download?docUuid=${encodeURIComponent(uuid)}`;
        a.download = name || '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function openDocument(uuid, name, isPdf, isImage) {
        if (!isPdf && !isImage) { download(uuid, name); return; }

        document.getElementById('docPreviewName').textContent = name;
        const body = document.getElementById('docPreviewBody');
        const url = `/Documents/Download?docUuid=${encodeURIComponent(uuid)}&inline=true`;

        body.innerHTML = isImage
            ? `<img src="${url}" alt="${escAttr(name)}" />`
            : `<iframe src="${url}" class="doc-preview-iframe" title="${escAttr(name)}"></iframe>`;

        document.getElementById('docPreviewDownloadBtn').onclick = () => download(uuid, name);
        bootstrap.Modal.getOrCreateInstance(document.getElementById('docPreviewModal')).show();
    }

    function filter(term) {
        const t = term.trim().toLowerCase();
        document.querySelectorAll('#docFoldersGrid .doc-card, #docFilesGrid .doc-card').forEach(el => {
            el.style.display = (el.dataset.name || '').toLowerCase().includes(t) ? '' : 'none';
        });
    }

    function init(initialRootUuid, initialLabel) {
        rootUuid = initialRootUuid;
        if (initialLabel) rootLabel = initialLabel;
        crumbs = [{ uuid: rootUuid, name: rootLabel }];
        renderBreadcrumb();
        browse(rootUuid);

        document.getElementById('docSearchInput')?.addEventListener('input', e => filter(e.target.value));

        if (!listenersBound) {
            listenersBound = true;
            document.addEventListener('click', onAction);
            document.addEventListener('keydown', e => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.doc-card[data-action]')) {
                    e.preventDefault();
                    onAction(e);
                }
            });
        }
    }

    let listenersBound = false;
    const findDoc = uuid => currentDocuments.find(d => d.uuid === uuid);
    const findFolder = uuid => currentFolders.find(f => f.uuid === uuid);

    function onAction(e) {
        const el = e.target.closest?.('[data-action]');
        if (!el || !el.closest('#docBreadcrumb, #docFoldersGrid, #docFilesGrid')) return;
        const uuid = el.dataset.uuid;
        switch (el.dataset.action) {
            case 'crumb':
                goToCrumb(Number(el.dataset.index));
                break;
            case 'folder': {
                const f = findFolder(uuid);
                if (f) openFolder(f.uuid, f.name);
                break;
            }
            case 'download': {
                e.stopPropagation();
                const d = findDoc(uuid);
                if (d) download(d.uuid, d.name);
                break;
            }
            case 'open': {
                const d = findDoc(uuid);
                if (d) openDocument(d.uuid, d.name, !!d.isPdf, !!d.isImage);
                break;
            }
        }
    }

    return { init, openFolder, goToCrumb, openDocument, download, filter };
})();