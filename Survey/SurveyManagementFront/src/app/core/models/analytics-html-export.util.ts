// ============================================================
// analytics-html-export.util.ts
// ✅ تولید خروجی HTML مستقل و کاملاً آفلاین (بدون هیچ وابستگی اینترنتی)
// Chart.js از assets محلی پروژه inline می‌شود، فونت از استک سیستمی استفاده می‌کند
// ============================================================

import { SurveyAnalyticsDto } from '../../core/models/survey-analytics.model';

let cachedChartJsSource: string | null = null;

/**
 * دریافت محتوای Chart.js از assets محلی پروژه (نه CDN).
 * فایل باید از قبل در src/assets/vendor/chart.umd.js قرار گرفته باشد.
 */
async function loadChartJsSource(): Promise<string> {
  if (cachedChartJsSource) return cachedChartJsSource;

  // ✅ مسیر مطلق از ریشه سایت (با / ابتدایی) تا صرف‌نظر از روت فعلی درست resolve شود
  const assetUrl = `${document.baseURI.replace(/\/$/, '')}/vendor/chart.umd.js`;

  let response: Response;
  try {
    response = await fetch(assetUrl, { cache: 'force-cache' });
  } catch (networkErr) {
    throw new Error(
      `اتصال به فایل Chart.js برقرار نشد (${assetUrl}). ` +
      `مطمئن شوید فایل در مسیر src/assets/vendor/chart.umd.js قرار دارد و پروژه build/serve شده است.`
    );
  }

  if (!response.ok) {
    throw new Error(
      `فایل Chart.js یافت نشد (کد ${response.status}) در آدرس ${assetUrl}. ` +
      `ابتدا آن را از node_modules/chart.js/dist/chart.umd.js به src/assets/vendor/chart.umd.js کپی کنید.`
    );
  }

  const text = await response.text();

  // ✅ اعتبارسنجی حداقلی: فایل واقعی Chart.js چند صد کیلوبایته؛
  // اگر خیلی کوچک بود یعنی به‌جای فایل واقعی، صفحه 404 یا index.html برگشته
  if (text.length < 50000 || !text.includes('Chart')) {
    throw new Error(
      `محتوای دریافت‌شده از ${assetUrl} فایل معتبر Chart.js به نظر نمی‌رسد ` +
      `(احتمالاً به‌جای آن صفحه خطا یا index.html بازگشته است).`
    );
  }

  cachedChartJsSource = text;
  return cachedChartJsSource;
}

export async function downloadAnalyticsHtml(analytics: SurveyAnalyticsDto): Promise<void> {
  const chartJsSource = await loadChartJsSource();
  const html = buildHtmlDocument(analytics, chartJsSource);

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // ✅ عنصر <a> باید حتماً به DOM اضافه شود تا click() در همه مرورگرها کار کند
  const a = document.createElement('a');
  a.href = url;
  a.download = `داشبورد_${sanitizeFileName(analytics.surveyTitle || 'نظرسنجی')}_${Date.now()}.html`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // ✅ revoke را کمی به تأخیر می‌اندازیم تا مرورگر فرصت شروع دانلود را داشته باشد
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

function buildHtmlDocument(analytics: SurveyAnalyticsDto, chartJsSource: string): string {
  const dataJson = JSON.stringify(analytics).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>داشبورد تحلیل | ${escapeHtml(analytics.surveyTitle)}</title>
<style>
${CSS_TEMPLATE}
</style>
<script>
${chartJsSource}
<\/script>
</head>
<body>

<div class="page">
  <header class="pageHeader">
    <div class="pageHeader__badge"><i class="dot"></i> گزارش تحلیل نظرسنجی</div>
    <h1 id="surveyTitle"></h1>
    <p class="pageHeader__meta">
      <span id="generatedDate"></span>
      <span class="sep">•</span>
      <span>تولید شده توسط سامانه نظرسنجی — این فایل کاملاً آفلاین است</span>
    </p>
  </header>

  <nav class="tabs">
    <button class="tabBtn active" data-tab="overview">نمای کلی</button>
    <button class="tabBtn" data-tab="dashboard">نمای جامع سوالات</button>
  </nav>

  <section id="tab-overview" class="tabPanel active">
    <div class="statCards" id="overviewStatCards"></div>
    <div class="sp"></div>
    <div class="chartsGrid" id="overviewCharts"></div>
  </section>

  <section id="tab-dashboard" class="tabPanel">
    <div class="dashboardHead">
      <div class="dashboardHead__stats" id="dashboardMiniStats"></div>
      <input type="search" id="searchBox" class="searchInput" placeholder="جستجو در سوالات...">
    </div>
    <div class="sp"></div>
    <div class="dashboardGrid" id="dashboardGrid"></div>
  </section>

  <footer class="pageFooter">
    این گزارش به‌صورت خودکار تولید شده و شامل تمام داده‌های موجود در زمان خروجی‌گیری است.
  </footer>
</div>

<script id="analytics-data" type="application/json">${dataJson}</script>
<script>
${JS_TEMPLATE}
<\/script>

</body>
</html>`;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ==================== CSS ====================
// ✅ بدون هیچ لینک خارجی — فقط استک فونت سیستمی فارسی

const CSS_TEMPLATE = `
:root {
  --primary: #1d4ed8;
  --accent: #ff4d6d;
  --ink: #0f172a;
  --muted: #64748b;
  --line: #e2e8f0;
  --ok: #16a34a;
  --warn: #d97706;
  --bg: #f8fafc;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'Vazirmatn', 'Vazir', 'IRANSans', 'Sahel', Tahoma, Arial, sans-serif;
  background: var(--bg); color: var(--ink); line-height: 1.7;
}
.page { max-width: 1300px; margin: 0 auto; padding: 32px 24px 60px; }

.pageHeader { text-align: center; margin-bottom: 28px; }
.pageHeader__badge {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px;
  background: rgba(29,78,216,.08); color: var(--primary); border-radius: 999px;
  font-size: .8rem; font-weight: 800; margin-bottom: 14px;
}
.pageHeader__badge .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--primary); display:inline-block; }
.pageHeader h1 { margin: 0 0 8px; font-size: 1.9rem; font-weight: 900; }
.pageHeader__meta { color: var(--muted); font-size: .88rem; font-weight: 600; }
.pageHeader__meta .sep { margin: 0 8px; }

.tabs { display: flex; gap: 8px; justify-content: center; margin-bottom: 24px; }
.tabBtn {
  padding: 10px 22px; border: 2px solid var(--line); border-radius: 999px;
  background: white; font-weight: 800; font-size: .9rem; color: var(--muted);
  cursor: pointer; font-family: inherit; transition: all .2s;
}
.tabBtn:hover { border-color: var(--primary); color: var(--primary); }
.tabBtn.active { background: linear-gradient(135deg, var(--primary), #3b82f6); border-color: var(--primary); color: white; }

.tabPanel { display: none; }
.tabPanel.active { display: block; animation: fadeIn .25s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

.sp { height: 18px; }

.statCards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
.statCard {
  display: flex; align-items: center; gap: 14px; padding: 18px;
  background: white; border: 2px solid var(--line); border-radius: 18px;
}
.statCard__icon {
  width: 46px; height: 46px; border-radius: 14px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; color: white; font-size: 1.3rem; font-weight: 900;
}
.statCard__value { font-size: 1.25rem; font-weight: 950; display: block; }
.statCard__label { font-size: .8rem; color: var(--muted); font-weight: 700; display: block; }

/* ✅ جدید: هشدار محرمانگی k-anonymity */
.privacyNotice {
  margin-top: 12px; padding: 12px 16px; background: rgba(29,78,216,.06);
  border: 1px solid rgba(29,78,216,.2); border-radius: 12px;
  font-size: .82rem; font-weight: 700; color: var(--primary);
  display: flex; align-items: center; gap: 8px;
}

.chartsGrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.chartCard { background: white; border: 2px solid var(--line); border-radius: 18px; padding: 18px; }
.chartCard.wide { grid-column: 1 / -1; }
.chartCard h4 { margin: 0 0 12px; font-size: .95rem; font-weight: 900; }
.chartCard canvas { max-height: 260px; }

.dashboardHead { display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; }
.dashboardHead__stats { display: flex; flex-wrap: wrap; gap: 10px; }
.miniStat {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 16px; background: white; border: 2px solid var(--line); border-radius: 12px; min-width: 90px;
}
.miniStat__value { font-size: 1.05rem; font-weight: 950; }
.miniStat__label { font-size: .68rem; color: var(--muted); font-weight: 700; max-width: 110px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.miniStat.good { border-color: rgba(34,197,94,.35); background: rgba(34,197,94,.05); }
.miniStat.good .miniStat__value { color: var(--ok); }
.miniStat.warn { border-color: rgba(255,77,109,.35); background: rgba(255,77,109,.05); }
.miniStat.warn .miniStat__value { color: var(--accent); }

.searchInput {
  padding: 9px 16px; border: 2px solid var(--line); border-radius: 12px;
  font-family: inherit; outline: none; min-width: 220px; font-size: .85rem;
}
.searchInput:focus { border-color: var(--primary); }

.dashboardGrid { column-count: 3; column-gap: 12px; }
@media (max-width: 1100px) { .dashboardGrid { column-count: 2; } }
@media (max-width: 680px) { .dashboardGrid { column-count: 1; } }

.dashCard {
  break-inside: avoid; margin-bottom: 12px; background: white;
  border: 2px solid var(--line); border-radius: 14px; padding: 13px;
  position: relative; overflow: hidden;
}
.dashCard::before { content: ''; position: absolute; top: 0; right: 0; bottom: 0; width: 3px; }
.dashCard[data-type="choice"]::before { background: linear-gradient(180deg, #1d4ed8, #3b82f6); }
.dashCard[data-type="numeric"]::before { background: linear-gradient(180deg, #d97706, #f59e0b); }
.dashCard[data-type="text"]::before { background: linear-gradient(180deg, #7c3aed, #8b5cf6); }
.dashCard[data-type="date"]::before { background: linear-gradient(180deg, #0891b2, #06b6d4); }
.dashCard[data-type="ranking"]::before { background: linear-gradient(180deg, #db2777, #ff4d6d); }
.dashCard[data-type="file"]::before { background: linear-gradient(180deg, #16a34a, #22c55e); }
.dashCard[data-type="default"]::before { background: linear-gradient(180deg, #64748b, #94a3b8); }

.dashCard__head { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
.dashCard__headIcon {
  width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; color: white; font-size: .7rem; font-weight: 900;
}
.dashCard[data-type="choice"] .dashCard__headIcon { background: linear-gradient(135deg, #1d4ed8, #3b82f6); }
.dashCard[data-type="numeric"] .dashCard__headIcon { background: linear-gradient(135deg, #d97706, #f59e0b); }
.dashCard[data-type="text"] .dashCard__headIcon { background: linear-gradient(135deg, #7c3aed, #8b5cf6); }
.dashCard[data-type="date"] .dashCard__headIcon { background: linear-gradient(135deg, #0891b2, #06b6d4); }
.dashCard[data-type="ranking"] .dashCard__headIcon { background: linear-gradient(135deg, #db2777, #ff4d6d); }
.dashCard[data-type="file"] .dashCard__headIcon { background: linear-gradient(135deg, #16a34a, #22c55e); }
.dashCard[data-type="default"] .dashCard__headIcon { background: linear-gradient(135deg, #64748b, #94a3b8); }

.dashCard__order { font-size: .62rem; font-weight: 800; color: var(--muted); display: block; }
.dashCard__headText h4 { margin: 1px 0 0; font-size: .8rem; font-weight: 850; line-height: 1.4; }
.reqDot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; margin-top: 4px; display:inline-block; }

.dashCard__metaRow { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
.pill-sm {
  font-size: .62rem; font-weight: 800; padding: 2px 7px; border-radius: 999px;
  background: rgba(100,116,139,.1); color: var(--muted);
}
.pill-sm.ok { background: rgba(34,197,94,.1); color: var(--ok); }
.pill-sm.warn { background: rgba(251,146,60,.1); color: var(--warn); }
.rateMini { margin-right: auto; font-size: .7rem; font-weight: 900; color: var(--ok); }
.rateMini.low { color: var(--accent); }

.progressTrack { height: 4px; background: rgba(100,116,139,.1); border-radius: 999px; overflow: hidden; margin-bottom: 8px; }
.progressFill { height: 100%; background: linear-gradient(90deg, var(--primary), #3b82f6); border-radius: 999px; }

.dashCard canvas { max-height: 90px; }

.choiceWrap { display: flex; gap: 8px; align-items: center; }
.choiceChart { width: 70px; flex-shrink: 0; }
.choiceList { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.choiceRow { display: flex; align-items: center; gap: 5px; font-size: .68rem; }
.choiceDot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; display:inline-block; }
.choiceLabel { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
.choiceValue { font-weight: 900; color: var(--muted); flex-shrink: 0; }

.numericStats { display: flex; gap: 4px; margin-bottom: 6px; }
.numericStat { flex: 1; text-align: center; padding: 4px; background: rgba(249,250,251,.7); border: 1px solid var(--line); border-radius: 8px; }
.numericStat b { display: block; font-size: .78rem; color: var(--warn); }
.numericStat span { font-size: .58rem; color: var(--muted); font-weight: 700; }

.sentimentBar { display: flex; height: 8px; border-radius: 999px; overflow: hidden; margin-bottom: 6px; }
.sentimentBar span.pos { background: var(--ok); }
.sentimentBar span.neg { background: var(--accent); }
.sentimentBar span.neu { background: #94a3b8; }
.sentimentLegend { display: flex; gap: 8px; font-size: .64rem; font-weight: 800; margin-bottom: 6px; }
.sentimentLegend .pos { color: var(--ok); }
.sentimentLegend .neg { color: var(--accent); }
.sentimentLegend .neu { color: #64748b; }
.wordCloud { display: flex; flex-wrap: wrap; gap: 4px; }
.wordTag { font-size: .62rem; font-weight: 800; padding: 2px 7px; background: rgba(124,58,237,.08); color: #7c3aed; border-radius: 999px; }

.fileRow { display: flex; align-items: center; gap: 6px; font-size: .78rem; font-weight: 800; color: var(--ok); }
.emptyRow { font-size: .74rem; color: var(--muted); font-weight: 700; }

.pageFooter { text-align: center; color: var(--muted); font-size: .78rem; margin-top: 40px; }

@media print {
  .tabs, .searchInput { display: none; }
  .tabPanel { display: block !important; page-break-before: always; }
  .dashboardGrid { column-count: 2; }
}
`;

// ==================== JS ====================

const JS_TEMPLATE = `
var DATA = JSON.parse(document.getElementById('analytics-data').textContent);
var PALETTE = ['#1d4ed8','#3b82f6','#f59e0b','#22c55e','#ff4d6d','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899'];

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function fmtDate(d) {
  try { return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(d); }
  catch (e) { return d.toLocaleDateString(); }
}

document.querySelectorAll('.tabBtn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.tabBtn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tabPanel').forEach(function (p) { p.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

document.getElementById('surveyTitle').textContent = DATA.surveyTitle || 'نظرسنجی';
document.getElementById('generatedDate').textContent = 'تاریخ گزارش: ' + fmtDate(new Date());

// ✅ بازنویسی‌شده مطابق OverviewStatsDto فعلی (بدون Status/Device/Progress)
(function renderOverviewStats() {
  var o = DATA.overview;
  var wrap = document.getElementById('overviewStatCards');
  var items = [
    { color: '#1d4ed8', value: o.totalResponses, label: 'کل پاسخ‌ها' },
    { color: '#d97706', value: o.averageTimeSpentMinutes + ' دقیقه', label: 'میانگین زمان پاسخ‌دهی' }
  ];
  if (o.fastestCompletionTimeText) items.push({ color: '#06b6d4', value: o.fastestCompletionTimeText, label: 'سریع‌ترین پاسخ' });
  if (o.medianCompletionTimeText) items.push({ color: '#ec4899', value: o.medianCompletionTimeText, label: 'میانه زمان' });
  if (o.slowestCompletionTimeText) items.push({ color: '#7c3aed', value: o.slowestCompletionTimeText, label: 'کندترین پاسخ' });

  items.forEach(function (it) {
    var card = el('div', 'statCard');
    var icon = el('div', 'statCard__icon');
    icon.style.background = it.color;
    var body = el('div');
    body.appendChild(el('span', 'statCard__value', it.value));
    body.appendChild(el('span', 'statCard__label', it.label));
    card.appendChild(icon);
    card.appendChild(body);
    wrap.appendChild(card);
  });

  if (o.suppressedForPrivacy > 0) {
    var notice = el('div', 'privacyNotice');
    notice.textContent = 'به‌دلیل حفظ محرمانگی، ' + o.suppressedForPrivacy + ' پاسخ در دسته‌های کوچک (کمتر از حد آستانه) به‌صورت مجزا نمایش داده نمی‌شوند.';
    wrap.parentElement.insertBefore(notice, wrap.nextSibling);
  }
})();

// ✅ بازنویسی‌شده: چهار نمودار دموگرافیک به‌جای Status/Device
(function renderOverviewCharts() {
  var o = DATA.overview;
  var grid = document.getElementById('overviewCharts');

  function addChartCard(title, wide, canvasId) {
    var card = el('div', 'chartCard' + (wide ? ' wide' : ''));
    card.appendChild(el('h4', null, title));
    var canvas = document.createElement('canvas');
    canvas.id = canvasId;
    card.appendChild(canvas);
    grid.appendChild(card);
  }

  function addDemographicChart(buckets, title, canvasId) {
    if (!buckets || !buckets.length) return;
    addChartCard(title, false, canvasId);
    new Chart(document.getElementById(canvasId), {
      type: 'pie',
      data: {
        labels: buckets.map(function (b) { return b.label; }),
        datasets: [{ data: buckets.map(function (b) { return b.count; }), backgroundColor: PALETTE, borderWidth: 0 }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  }

addDemographicChart(o.responsesByAge, 'سن', 'chartAge');
addDemographicChart(o.responsesByGender, 'جنسیت', 'chartGender');
addDemographicChart(o.responsesByOffice, 'امور', 'chartOffice');
addDemographicChart(o.responsesByEmploymentType, 'نوع استخدام', 'chartEmploymentType');
addDemographicChart(o.responsesByEducation, 'مدرک تحصیلی', 'chartEducation');
addDemographicChart(o.responsesByShiftWorker, 'نوبت‌کاری', 'chartShiftWorker');
addDemographicChart(o.responsesByExperienceYears, 'سابقه', 'chartExperience');
addDemographicChart(o.responsesByOrganizationalGrade, 'گرید سازمانی', 'chartGrade');
addDemographicChart(o.responsesByOrganizationalGroup, 'گروه سازمانی', 'chartGroup');

  if ((o.responsesTrend || []).length) {
    addChartCard('روند پاسخ‌ها در طول زمان', true, 'chartTrend');
    new Chart(document.getElementById('chartTrend'), {
      type: 'line',
      data: {
        labels: o.responsesTrend.map(function (p) { return p.label; }),
        datasets: [{ label: 'تعداد', data: o.responsesTrend.map(function (p) { return p.count; }), borderColor: '#1d4ed8', backgroundColor: 'rgba(29,78,216,.12)', fill: true, tension: .35 }]
      },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }
    });
  }

  if ((o.responsesByDayOfWeek || []).length) {
    addChartCard('پاسخ‌ها بر اساس روز هفته', false, 'chartDay');
    new Chart(document.getElementById('chartDay'), {
      type: 'bar',
      data: { labels: o.responsesByDayOfWeek.map(function (p) { return p.label; }), datasets: [{ data: o.responsesByDayOfWeek.map(function (p) { return p.count; }), backgroundColor: '#1d4ed8', borderRadius: 6 }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }
    });
  }

  if ((o.responsesByHourOfDay || []).length) {
    addChartCard('پاسخ‌ها بر اساس ساعت روز', false, 'chartHour');
    new Chart(document.getElementById('chartHour'), {
      type: 'bar',
      data: { labels: o.responsesByHourOfDay.map(function (p) { return p.label; }), datasets: [{ data: o.responsesByHourOfDay.map(function (p) { return p.count; }), backgroundColor: '#f59e0b', borderRadius: 6 }] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }
    });
  }
})();

(function renderDashboardStats() {
  var wrap = document.getElementById('dashboardMiniStats');
  var qs = DATA.questions || [];
  var avgRate = qs.length ? Math.round((qs.reduce(function (a, q) { return a + q.answerRate; }, 0) / qs.length) * 10) / 10 : 0;
  var reqCount = qs.filter(function (q) { return q.isRequired; }).length;
  var sorted = qs.slice().sort(function (a, b) { return b.answerRate - a.answerRate; });
  var highest = sorted[0], lowest = sorted[sorted.length - 1];

  function stat(value, label, cls) {
    var d = el('div', 'miniStat' + (cls ? ' ' + cls : ''));
    d.appendChild(el('span', 'miniStat__value', value));
    d.appendChild(el('span', 'miniStat__label', label));
    wrap.appendChild(d);
  }
  stat(qs.length, 'سوال');
  stat(avgRate + '%', 'میانگین پاسخ‌دهی');
  stat(reqCount, 'الزامی');
  if (highest) stat(highest.answerRate + '%', 'بیشترین', 'good');
  if (lowest) stat(lowest.answerRate + '%', 'کمترین', 'warn');
})();

var questionTypeMeta = function (q) {
  if (q.optionStats && q.optionStats.length) return { type: 'choice', icon: '◔' };
  if (q.numericStats) return { type: 'numeric', icon: '#' };
  if (q.textAnalytics) return { type: 'text', icon: '≡' };
  if (q.dateDistribution) return { type: 'date', icon: '▤' };
  if (q.rankingStats && q.rankingStats.length) return { type: 'ranking', icon: '★' };
  if (q.fileUploadCount !== undefined && q.fileUploadCount !== null) return { type: 'file', icon: '⇧' };
  return { type: 'default', icon: '?' };
};

var chartCounter = 0;

function renderQuestionCard(q, container) {
  var meta = questionTypeMeta(q);
  var card = el('div', 'dashCard');
  card.setAttribute('data-type', meta.type);
  card.setAttribute('data-search', (q.questionText || '').toLowerCase());

  var head = el('div', 'dashCard__head');
  var icon = el('div', 'dashCard__headIcon', meta.icon);
  var headText = el('div', 'dashCard__headText');
  headText.appendChild(el('span', 'dashCard__order', 'سوال ' + q.sortOrder));
  headText.appendChild(el('h4', null, q.questionText));
  head.appendChild(icon);
  head.appendChild(headText);
  if (q.isRequired) head.appendChild(el('span', 'reqDot'));
  card.appendChild(head);

  var metaRow = el('div', 'dashCard__metaRow');
  metaRow.appendChild(el('span', 'pill-sm', q.questionTypeName));
  metaRow.appendChild(el('span', 'pill-sm ok', q.totalAnswered + ' پاسخ'));
  if (q.totalSkipped > 0) metaRow.appendChild(el('span', 'pill-sm warn', q.totalSkipped + ' رد شده'));
  metaRow.appendChild(el('span', 'rateMini' + (q.answerRate < 50 ? ' low' : ''), q.answerRate + '%'));
  card.appendChild(metaRow);

  var track = el('div', 'progressTrack');
  var fill = el('div', 'progressFill');
  fill.style.width = q.answerRate + '%';
  track.appendChild(fill);
  card.appendChild(track);

  var body = el('div');

  if (meta.type === 'choice') {
    var wrap = el('div', 'choiceWrap');
    var chartBox = el('div', 'choiceChart');
    var canvasId = 'chart_' + (chartCounter++);
    var canvas = document.createElement('canvas');
    canvas.id = canvasId;
    chartBox.appendChild(canvas);
    wrap.appendChild(chartBox);

    var list = el('div', 'choiceList');
    var opts = q.optionStats.slice(0, 4);
    opts.forEach(function (opt, i) {
      var row = el('div', 'choiceRow');
      var dot = el('span', 'choiceDot');
      dot.style.background = opt.color || PALETTE[i % PALETTE.length];
      row.appendChild(dot);
      row.appendChild(el('span', 'choiceLabel', opt.optionText));
      row.appendChild(el('span', 'choiceValue', opt.percentage + '%'));
      list.appendChild(row);
    });
    if (q.optionStats.length > 4) list.appendChild(el('div', 'emptyRow', '+' + (q.optionStats.length - 4) + ' گزینه دیگر'));
    wrap.appendChild(list);
    body.appendChild(wrap);

    setTimeout(function () {
      new Chart(document.getElementById(canvasId), {
        type: 'doughnut',
        data: {
          labels: q.optionStats.map(function (o) { return o.optionText; }),
          datasets: [{ data: q.optionStats.map(function (o) { return o.count; }), backgroundColor: q.optionStats.map(function (o, i) { return o.color || PALETTE[i % PALETTE.length]; }), borderWidth: 0 }]
        },
        options: { cutout: '65%', plugins: { legend: { display: false } } }
      });
    }, 0);
  }

  else if (meta.type === 'numeric') {
    var statsWrap = el('div', 'numericStats');
    [['average', 'میانگین'], ['min', 'حداقل'], ['max', 'حداکثر']].forEach(function (pair) {
      var s = el('div', 'numericStat');
      s.appendChild(el('b', null, q.numericStats[pair[0]]));
      s.appendChild(el('span', null, pair[1]));
      statsWrap.appendChild(s);
    });
    body.appendChild(statsWrap);

    var canvasId2 = 'chart_' + (chartCounter++);
    var canvas2 = document.createElement('canvas');
    canvas2.id = canvasId2;
    body.appendChild(canvas2);

    setTimeout(function () {
      var dist = q.numericStats.distribution || [];
      new Chart(document.getElementById(canvasId2), {
        type: 'bar',
        data: { labels: dist.map(function (d) { return d.label; }), datasets: [{ data: dist.map(function (d) { return d.count; }), backgroundColor: '#d97706', borderRadius: 4 }] },
        options: { scales: { y: { beginAtZero: true, ticks: { precision: 0, font: { size: 9 } } }, x: { ticks: { font: { size: 9 } } } }, plugins: { legend: { display: false } } }
      });
    }, 0);
  }

  else if (meta.type === 'text') {
    var s = q.textAnalytics.sentiment;
    var bar = el('div', 'sentimentBar');
    var pos = el('span', 'pos'); pos.style.width = s.positivePercentage + '%';
    var neg = el('span', 'neg'); neg.style.width = s.negativePercentage + '%';
    var neu = el('span', 'neu'); neu.style.width = s.neutralPercentage + '%';
    bar.appendChild(pos); bar.appendChild(neg); bar.appendChild(neu);
    body.appendChild(bar);

    var legend = el('div', 'sentimentLegend');
    legend.appendChild(el('span', 'pos', 'مثبت ' + s.positivePercentage + '%'));
    legend.appendChild(el('span', 'neg', 'منفی ' + s.negativePercentage + '%'));
    legend.appendChild(el('span', 'neu', 'خنثی ' + s.neutralPercentage + '%'));
    body.appendChild(legend);

    if ((q.textAnalytics.topWords || []).length) {
      var cloud = el('div', 'wordCloud');
      q.textAnalytics.topWords.slice(0, 10).forEach(function (w) {
        cloud.appendChild(el('span', 'wordTag', w.word));
      });
      body.appendChild(cloud);
    }
  }

  else if (meta.type === 'date') {
    var canvasId3 = 'chart_' + (chartCounter++);
    var canvas3 = document.createElement('canvas');
    canvas3.id = canvasId3;
    body.appendChild(canvas3);
    setTimeout(function () {
      new Chart(document.getElementById(canvasId3), {
        type: 'bar',
        data: { labels: q.dateDistribution.map(function (d) { return d.label; }), datasets: [{ data: q.dateDistribution.map(function (d) { return d.count; }), backgroundColor: '#06b6d4', borderRadius: 4 }] },
        options: { scales: { y: { beginAtZero: true, ticks: { precision: 0, font: { size: 9 } } }, x: { ticks: { font: { size: 9 } } } }, plugins: { legend: { display: false } } }
      });
    }, 0);
  }

  else if (meta.type === 'ranking') {
    var canvasId4 = 'chart_' + (chartCounter++);
    var canvas4 = document.createElement('canvas');
    canvas4.id = canvasId4;
    body.appendChild(canvas4);
    setTimeout(function () {
      new Chart(document.getElementById(canvasId4), {
        type: 'bar',
        data: { labels: q.rankingStats.map(function (r) { return r.itemLabel; }), datasets: [{ data: q.rankingStats.map(function (r) { return r.averageRank; }), backgroundColor: '#db2777', borderRadius: 4 }] },
        options: { scales: { y: { beginAtZero: true, ticks: { font: { size: 9 } } }, x: { ticks: { font: { size: 9 } } } }, plugins: { legend: { display: false } } }
      });
    }, 0);
  }

  else if (meta.type === 'file') {
    body.appendChild(el('div', 'fileRow', q.fileUploadCount + ' فایل آپلود شده'));
  }

  if (q.totalAnswered === 0) {
    body.appendChild(el('div', 'emptyRow', 'هنوز پاسخی ثبت نشده'));
  }

  card.appendChild(body);
  container.appendChild(card);
}

(function renderDashboardGrid() {
  var container = document.getElementById('dashboardGrid');
  var qs = (DATA.questions || []).slice().sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  qs.forEach(function (q) { renderQuestionCard(q, container); });

  document.getElementById('searchBox').addEventListener('input', function (e) {
    var term = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#dashboardGrid .dashCard').forEach(function (card) {
      var match = !term || card.getAttribute('data-search').indexOf(term) !== -1;
      card.style.display = match ? '' : 'none';
    });
  });
})();
`;