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
  // ✅ همه‌ی متن‌های کاربر فقط از طریق textContent در DOM قرار می‌گیرند؛ این‌جا فقط از شکستن تگ <script> جلوگیری می‌شود
  const dataJson = JSON.stringify(analytics)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

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
    <button class="tabBtn" data-tab="text" id="textTabBtn">تحلیل پاسخ‌های متنی</button>
  </nav>

  <section id="tab-overview" class="tabPanel active">
    <div class="statCards" id="overviewStatCards"></div>
    <div class="sp"></div>
    <div id="stepOverview"></div>
    <div class="chartsGrid" id="overviewCharts"></div>
  </section>

  <section id="tab-dashboard" class="tabPanel">
    <div class="dashboardHead">
      <div class="dashboardHead__stats" id="dashboardMiniStats"></div>
      <input type="search" id="searchBox" class="searchInput" placeholder="جستجو در سوالات...">
    </div>
    <div class="sp"></div>
    <div class="stepNav" id="dashStepNav"></div>
    <div id="dashboardGroups"></div>
  </section>

  <section id="tab-text" class="tabPanel">
    <div class="stepNav" id="textStepNav"></div>
    <div id="textGroups"></div>
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
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

/* ===== گام‌ها ===== */
.stepNo {
  display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; padding: 0 6px;
  border-radius: 8px; background: rgba(29,78,216,.1); color: var(--primary); font-weight: 900; font-size: .8rem; flex-shrink: 0;
}
.toneChip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 9px; border-radius: 999px; font-size: .72rem; font-weight: 850; background: #f1f5f9; color: #475569; white-space: nowrap; }
.toneChip.good { background: rgba(22,163,74,.1); color: #15803d; }
.toneChip.bad { background: rgba(225,29,72,.09); color: #be123c; }

.stepOverview { background: white; border: 2px solid var(--line); border-radius: 18px; padding: 18px; margin-bottom: 18px; }
.stepOverview h3 { margin: 0 0 12px; font-size: 1rem; font-weight: 900; }
.stepCards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.stepCard { display: flex; flex-direction: column; gap: 9px; padding: 13px; border: 1px solid var(--line); border-radius: 14px; background: #fbfcfe; cursor: pointer; text-align: right; font-family: inherit; color: var(--ink); }
.stepCard:hover { border-color: rgba(29,78,216,.45); }
.stepCard__top { display: flex; gap: 8px; align-items: flex-start; font-weight: 850; font-size: .9rem; }
.stepCard__meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: .74rem; color: var(--muted); font-weight: 700; }
.metric { display: grid; grid-template-columns: 70px 1fr 44px; gap: 8px; align-items: center; font-size: .72rem; }
.metric__label { color: var(--muted); font-weight: 700; }
.metric__track { height: 8px; background: #e9eef5; border-radius: 999px; overflow: hidden; }
.metric__fill { display: block; height: 100%; border-radius: 999px; background: var(--primary); }
.metric__fill.good { background: #16a34a; } .metric__fill.mid { background: #d97706; } .metric__fill.bad { background: #e11d48; }
.metric__value { font-weight: 850; text-align: left; }
.metric__na { grid-column: 2 / 4; color: #94a3b8; }

.stepNav { display: flex; gap: 6px; overflow-x: auto; padding: 8px 10px; margin-bottom: 14px; background: rgba(255,255,255,.95); border: 1px solid var(--line); border-radius: 14px; position: sticky; top: 0; z-index: 5; }
.stepNav:empty { display: none; }
.stepNav button { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px 4px 10px; border: 1px solid var(--line); border-radius: 999px; background: white; font-family: inherit; font-size: .78rem; font-weight: 750; color: var(--ink); cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.stepNav button:hover { border-color: var(--primary); color: var(--primary); }

details.stepGroup { margin-bottom: 18px; scroll-margin-top: 70px; }
details.stepGroup > summary { list-style: none; cursor: pointer; }
details.stepGroup > summary::-webkit-details-marker { display: none; }
.stepHeader { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 12px; padding: 10px 14px; margin-bottom: 12px; background: #f1f5fb; border: 1px solid var(--line); border-right: 4px solid var(--primary); border-radius: 12px; }
.stepHeader__title { display: flex; align-items: center; gap: 10px; font-weight: 900; font-size: 1rem; }
.stepHeader__title::before { content: '▾'; color: var(--muted); font-size: .8rem; }
details.stepGroup:not([open]) .stepHeader__title::before { content: '◂'; }
.stepHeader__stats { display: flex; flex-wrap: wrap; gap: 6px; }
.stepStat { padding: 1px 10px; border-radius: 999px; background: white; border: 1px solid var(--line); font-size: .72rem; font-weight: 800; color: var(--muted); white-space: nowrap; }

.sentimentBar span.mix { background: #d97706; }
.sentimentLegend { flex-wrap: wrap; }
.sentimentLegend .mix { color: #b45309; }
.themeMini { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.themeMini span { font-size: .62rem; font-weight: 750; padding: 1px 7px; border-radius: 6px; background: #f1f5f9; color: #334155; }

/* ===== تحلیل متنی ===== */
.textBlock { background: white; border: 2px solid var(--line); border-radius: 18px; padding: 18px; margin-bottom: 16px; }
.textBlock h4 { margin: 0 0 4px; font-size: 1rem; font-weight: 900; line-height: 1.6; }
.textBlock .sub { color: var(--muted); font-size: .76rem; font-weight: 700; margin-bottom: 14px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 14px; }
.kpi { padding: 10px 12px; background: var(--bg); border: 1px solid var(--line); border-radius: 12px; }
.kpi b { display: block; font-size: 1.2rem; font-weight: 900; }
.kpi b.good { color: #15803d; } .kpi b.bad { color: #be123c; }
.kpi span { font-size: .72rem; color: var(--muted); font-weight: 700; }
.twoCol { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-bottom: 14px; }
.panel { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; min-width: 0; }
.panel h5 { margin: 0 0 10px; font-size: .86rem; font-weight: 850; }
.bigBar { display: flex; height: 14px; border-radius: 999px; overflow: hidden; background: #e2e8f0; gap: 2px; margin-bottom: 10px; }
.bigBar span { display: block; height: 100%; }
.c-pos { background: #16a34a; } .c-neg { background: #e11d48; } .c-mix { background: #d97706; } .c-neu { background: #94a3b8; }
.legend { display: flex; flex-wrap: wrap; gap: 10px; font-size: .76rem; font-weight: 750; }
.legend i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-left: 4px; }
table.tbl { width: 100%; border-collapse: collapse; font-size: .8rem; }
table.tbl th { text-align: right; background: var(--bg); color: var(--muted); font-size: .72rem; font-weight: 800; padding: 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
table.tbl td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; overflow-wrap: anywhere; }
.pos { color: #15803d; font-weight: 800; } .neg { color: #be123c; font-weight: 800; }
.chips { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: baseline; }
.chip { padding: 2px 10px; border-radius: 999px; background: rgba(29,78,216,.05); border: 1px solid rgba(29,78,216,.18); color: #1e3a8a; }
.chip small { color: var(--muted); font-size: .65em; margin-right: 3px; }
ol.plain, ul.plain { margin: 0; padding: 0 18px 0 0; font-size: .82rem; display: flex; flex-direction: column; gap: 5px; }
ul.sugg { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
ul.sugg li { padding: 7px 12px; background: rgba(217,119,6,.06); border-right: 3px solid #d97706; border-radius: 8px; font-size: .82rem; }
.badge { font-size: .68rem; color: var(--muted); background: #f1f5f9; padding: 0 7px; border-radius: 999px; margin-right: 6px; font-weight: 800; }
details.samples summary { cursor: pointer; color: var(--primary); font-size: .74rem; font-weight: 800; }
details.samples blockquote { margin: 6px 0 0; padding: 6px 10px; background: var(--bg); border-right: 3px solid var(--line); border-radius: 6px; font-size: .78rem; }
.answersTools { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.answersTools input, .answersTools select { padding: 7px 12px; border: 1px solid var(--line); border-radius: 10px; font-family: inherit; font-size: .8rem; }
.answersTools input { flex: 1 1 200px; min-width: 0; }
.answersScroll { max-height: 420px; overflow: auto; border: 1px solid var(--line); border-radius: 10px; }
.sent { display: inline-block; padding: 0 8px; border-radius: 999px; font-size: .7rem; font-weight: 800; white-space: nowrap; background: #f1f5f9; color: #475569; }
.sent.positive { background: rgba(22,163,74,.12); color: #15803d; }
.sent.negative { background: rgba(225,29,72,.1); color: #be123c; }
.sent.mixed { background: rgba(217,119,6,.12); color: #b45309; }
.sent.empty { color: #94a3b8; }
.tag { display: inline-block; margin: 0 0 2px 4px; padding: 0 7px; border-radius: 6px; background: #f1f5f9; font-size: .68rem; font-weight: 700; }
.muted { color: var(--muted); font-size: .76rem; }

@media (max-width: 760px) {
  .twoCol { grid-template-columns: minmax(0, 1fr); }
  .chartsGrid { grid-template-columns: 1fr; }
  .page { padding: 20px 12px 40px; }
  .tabs { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
}

@media print {
  .tabs, .searchInput, .stepNav, .answersTools { display: none !important; }
  .tabPanel { display: block !important; page-break-before: always; }
  .dashboardGrid { column-count: 2; }
  details.stepGroup > *:not(summary) { display: block; }
  .answersScroll { max-height: none; overflow: visible; }
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
    var mix = el('span', 'mix'); mix.style.width = (s.mixedPercentage || 0) + '%';
    var neu = el('span', 'neu'); neu.style.width = s.neutralPercentage + '%';
    var neg = el('span', 'neg'); neg.style.width = s.negativePercentage + '%';
    bar.appendChild(pos); bar.appendChild(mix); bar.appendChild(neu); bar.appendChild(neg);
    body.appendChild(bar);

    var legend = el('div', 'sentimentLegend');
    legend.appendChild(el('span', 'pos', 'مثبت ' + s.positivePercentage + '%'));
    if (s.mixedCount) legend.appendChild(el('span', 'mix', 'دوگانه ' + s.mixedPercentage + '%'));
    legend.appendChild(el('span', 'neu', 'خنثی ' + s.neutralPercentage + '%'));
    legend.appendChild(el('span', 'neg', 'منفی ' + s.negativePercentage + '%'));
    legend.appendChild(el('span', 'toneChip ' + sentTone(netOf(q)), 'خالص ' + signed(netOf(q))));
    body.appendChild(legend);

    var qThemes = q.textAnalytics.themes || [];
    if (qThemes.length) {
      var tm = el('div', 'themeMini');
      qThemes.slice(0, 3).forEach(function (th) { tm.appendChild(el('span', null, th.title + ' ' + th.count)); });
      body.appendChild(tm);
    }

    var terms = (q.textAnalytics.keywords && q.textAnalytics.keywords.length)
      ? q.textAnalytics.keywords.map(function (k) { return k.term; })
      : (q.textAnalytics.topWords || []).map(function (w) { return w.word; });
    if (terms.length) {
      var cloud = el('div', 'wordCloud');
      terms.slice(0, 10).forEach(function (w) {
        cloud.appendChild(el('span', 'wordTag', w));
      });
      body.appendChild(cloud);
    }
    if (q.textAnalytics.suggestionCount) body.appendChild(el('div', 'emptyRow', q.textAnalytics.suggestionCount + ' پیشنهاد'));
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

// ==================== گام‌ها ====================

var HAS_STEPS = (DATA.criteria || []).length > 0;
var REDUCE_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function signed(v, digits) {
  if (v === null || v === undefined || isNaN(Number(v))) return '—';
  var n = Number(v);
  var f = Math.abs(n).toFixed(digits || 0);
  return n > 0 ? '+' + f : (n < 0 ? '−' + f : f);
}
function sentTone(v) { if (v === null || v === undefined) return ''; return v >= 10 ? 'good' : (v <= -10 ? 'bad' : ''); }
function scoreTone(v) { return v >= 70 ? 'good' : (v >= 50 ? 'mid' : 'bad'); }
function sentLabel(s) {
  return s === 'positive' ? 'مثبت' : s === 'negative' ? 'منفی' : s === 'mixed' ? 'دوگانه' : s === 'empty' ? 'بی‌محتوا' : 'خنثی';
}
function netOf(q) {
  var s = q.textAnalytics.sentiment;
  if (s.netSentiment !== undefined && s.netSentiment !== null) return Number(s.netSentiment);
  return Math.round((s.positivePercentage - s.negativePercentage) * 10) / 10;
}

/** گروه‌بندی سوال‌ها به ترتیب گام؛ سوال‌های بدون گام در «سایر سوالات» */
function groupQuestions(qs) {
  var criteria = (DATA.criteria || []).slice().sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  if (!criteria.length) return [{ key: 'all', title: '', index: null, criterion: null, questions: qs.slice() }];
  var groups = [], byKey = {}, keyByQ = {}, no = 0;
  criteria.forEach(function (c) {
    var key = c.guid ? c.guid : '__other__';
    if (byKey[key]) return;
    var g = { key: key, title: c.guid ? c.title : (c.title || 'سایر سوالات'), index: c.guid ? ++no : null, criterion: c, questions: [] };
    byKey[key] = g; groups.push(g);
    (c.questionGuids || []).forEach(function (qg) { keyByQ[qg] = key; });
  });
  qs.forEach(function (q) {
    var key = keyByQ[q.questionGuid] || (q.criterionGuid && byKey[q.criterionGuid] ? q.criterionGuid : null);
    if (!key) {
      key = '__other__';
      if (!byKey[key]) { byKey[key] = { key: key, title: 'سایر سوالات', index: null, criterion: null, questions: [] }; groups.push(byKey[key]); }
    }
    byKey[key].questions.push(q);
  });
  groups.sort(function (a, b) { return (a.key === '__other__' ? 1 : 0) - (b.key === '__other__' ? 1 : 0); });
  return groups.filter(function (g) { return g.questions.length > 0; });
}

function stepLabel(g) { return g.index === null ? g.title : ('گام ' + g.index + ' — ' + g.title); }

function stepHeaderNode(g, count) {
  var head = el('summary', 'stepHeader');
  var title = el('span', 'stepHeader__title');
  title.appendChild(el('span', 'stepNo', g.index === null ? '—' : String(g.index)));
  title.appendChild(el('span', null, g.title));
  head.appendChild(title);
  var stats = el('span', 'stepHeader__stats');
  stats.appendChild(el('span', 'stepStat', count + ' سوال'));
  var c = g.criterion;
  if (c) {
    stats.appendChild(el('span', 'stepStat', 'پاسخ‌دهی ' + c.averageAnswerRate + '%'));
    if (c.averageScorePercent !== null && c.averageScorePercent !== undefined) stats.appendChild(el('span', 'stepStat', 'امتیاز ' + c.averageScorePercent + '%'));
    if (c.netSentiment !== null && c.netSentiment !== undefined) stats.appendChild(el('span', 'toneChip ' + sentTone(c.netSentiment), 'احساس ' + signed(c.netSentiment)));
  }
  head.appendChild(stats);
  return head;
}

function activateTab(name) {
  document.querySelectorAll('.tabBtn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
  document.querySelectorAll('.tabPanel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + name); });
}

function jumpTo(id) {
  var target = document.getElementById(id);
  if (!target) return;
  if (target.tagName === 'DETAILS') target.open = true;
  target.scrollIntoView({ behavior: REDUCE_MOTION ? 'auto' : 'smooth', block: 'start' });
}

function renderStepNav(navId, groups, prefix) {
  var nav = document.getElementById(navId);
  if (!HAS_STEPS) return;
  groups.forEach(function (g) {
    var b = el('button');
    b.type = 'button';
    b.appendChild(el('span', 'stepNo', g.index === null ? '…' : String(g.index)));
    b.appendChild(el('span', null, g.title));
    b.addEventListener('click', function () { jumpTo(prefix + g.key); });
    nav.appendChild(b);
  });
}

(function renderStepOverview() {
  if (!HAS_STEPS) return;
  var host = document.getElementById('stepOverview');
  var box = el('div', 'stepOverview');
  box.appendChild(el('h3', null, 'خلاصه گام‌ها'));
  var grid = el('div', 'stepCards');
  groupQuestions(DATA.questions || []).forEach(function (g) {
    var c = g.criterion || {};
    var card = el('button', 'stepCard');
    card.type = 'button';
    var top = el('div', 'stepCard__top');
    top.appendChild(el('span', 'stepNo', g.index === null ? '—' : String(g.index)));
    top.appendChild(el('span', null, g.title));
    card.appendChild(top);
    var meta = el('div', 'stepCard__meta');
    meta.appendChild(el('span', null, (c.questionCount || g.questions.length) + ' سوال'));
    if (c.netSentiment !== null && c.netSentiment !== undefined) meta.appendChild(el('span', 'toneChip ' + sentTone(c.netSentiment), 'احساس ' + signed(c.netSentiment)));
    card.appendChild(meta);

    function metric(label, value, tone) {
      var m = el('div', 'metric');
      m.appendChild(el('span', 'metric__label', label));
      if (value === null || value === undefined) {
        m.appendChild(el('span', 'metric__na', 'سوال امتیازی ندارد'));
      } else {
        var track = el('span', 'metric__track');
        var fill = el('span', 'metric__fill' + (tone ? ' ' + tone : ''));
        fill.style.width = Math.max(0, Math.min(100, Number(value))) + '%';
        track.appendChild(fill);
        m.appendChild(track);
        m.appendChild(el('span', 'metric__value', value + '%'));
      }
      card.appendChild(m);
    }
    metric('نرخ پاسخ‌دهی', c.averageAnswerRate !== undefined ? c.averageAnswerRate : 0, '');
    metric('امتیاز', c.averageScorePercent, c.averageScorePercent !== null && c.averageScorePercent !== undefined ? scoreTone(c.averageScorePercent) : '');
    card.addEventListener('click', function () { activateTab('dashboard'); setTimeout(function () { jumpTo('dstep-' + g.key); }, 30); });
    grid.appendChild(card);
  });
  box.appendChild(grid);
  host.appendChild(box);
})();

(function renderDashboardGrid() {
  var host = document.getElementById('dashboardGroups');
  var groups = groupQuestions(DATA.questions || []);
  renderStepNav('dashStepNav', groups, 'dstep-');

  groups.forEach(function (g) {
    var grid = el('div', 'dashboardGrid');
    g.questions.forEach(function (q) { renderQuestionCard(q, grid); });
    if (HAS_STEPS) {
      var det = el('details', 'stepGroup');
      det.open = true;
      det.id = 'dstep-' + g.key;
      det.appendChild(stepHeaderNode(g, g.questions.length));
      det.appendChild(grid);
      host.appendChild(det);
    } else {
      host.appendChild(grid);
    }
  });

  document.getElementById('searchBox').addEventListener('input', function (e) {
    var term = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#dashboardGroups .dashCard').forEach(function (card) {
      var match = !term || card.getAttribute('data-search').indexOf(term) !== -1;
      card.style.display = match ? '' : 'none';
    });
    document.querySelectorAll('#dashboardGroups details.stepGroup').forEach(function (det) {
      var any = Array.prototype.some.call(det.querySelectorAll('.dashCard'), function (c) { return c.style.display !== 'none'; });
      det.style.display = any ? '' : 'none';
    });
  });
})();

// ==================== تب تحلیل پاسخ‌های متنی ====================

function renderTextBlock(q, host) {
  var t = q.textAnalytics;
  var s = t.sentiment;
  var block = el('div', 'textBlock');
  block.appendChild(el('h4', null, q.questionText));
  block.appendChild(el('div', 'sub', (q.questionTypeName || '') + ' · ' + q.totalAnswered + ' پاسخ · نرخ پاسخ‌دهی ' + q.answerRate + '%'));

  // KPI
  var total = t.totalTextAnswers !== undefined ? t.totalTextAnswers : q.totalAnswered;
  var kpis = el('div', 'kpis');
  function kpi(value, label, cls) { var k = el('div', 'kpi'); k.appendChild(el('b', cls || null, value)); k.appendChild(el('span', null, label)); kpis.appendChild(k); }
  kpi(String(total), 'پاسخ متنی');
  if (t.meaningfulCount !== undefined) kpi(t.meaningfulCount + (total ? ' (' + Math.round(t.meaningfulCount / total * 100) + '%)' : ''), 'دارای محتوا');
  if (t.emptyLikeCount) kpi(String(t.emptyLikeCount), 'بی‌محتوا (ندارم، - و …)');
  kpi(String(t.medianWordCount !== undefined ? t.medianWordCount : t.averageWordCount), 'میانه تعداد کلمات (میانگین ' + t.averageWordCount + ')');
  var net = netOf(q);
  kpi(signed(net), 'شاخص خالص احساس', sentTone(net));
  if (t.suggestionCount) kpi(String(t.suggestionCount), 'پیشنهاد');
  block.appendChild(kpis);

  // احساس + طول
  var row1 = el('div', 'twoCol');
  var sp = el('div', 'panel');
  sp.appendChild(el('h5', null, 'توزیع احساس'));
  var segs = [
    ['c-pos', 'مثبت', s.positiveCount, s.positivePercentage],
    ['c-mix', 'دوگانه', s.mixedCount || 0, s.mixedPercentage || 0],
    ['c-neu', 'خنثی', s.neutralCount, s.neutralPercentage],
    ['c-neg', 'منفی', s.negativeCount, s.negativePercentage]
  ];
  var sum = segs.reduce(function (a, x) { return a + (x[2] || 0); }, 0);
  var bar = el('div', 'bigBar');
  segs.forEach(function (x) { if (!x[2]) return; var sg = el('span', x[0]); sg.style.width = (x[2] / (sum || 1) * 100) + '%'; sg.title = x[1] + ': ' + x[2]; bar.appendChild(sg); });
  sp.appendChild(bar);
  var lg = el('div', 'legend');
  segs.forEach(function (x) { var it = el('span'); it.appendChild(el('i', x[0])); it.appendChild(document.createTextNode(x[1] + ' ' + x[3] + '% (' + x[2] + ')')); lg.appendChild(it); });
  sp.appendChild(lg);
  if (s.averageScore !== undefined && s.averageScore !== null) sp.appendChild(el('div', 'muted', 'میانگین امتیاز احساس: ' + signed(s.averageScore, 1) + ' (از −۵ تا +۵)'));
  row1.appendChild(sp);

  var lp = el('div', 'panel');
  lp.appendChild(el('h5', null, 'توزیع طول پاسخ‌ها'));
  var ld = t.lengthDistribution || [];
  if (ld.length) {
    var max = Math.max.apply(null, ld.map(function (b) { return b.count; })) || 1;
    ld.forEach(function (b) {
      var m = el('div', 'metric');
      m.appendChild(el('span', 'metric__label', b.label));
      var tr = el('span', 'metric__track'); var fl = el('span', 'metric__fill'); fl.style.width = (b.count / max * 100) + '%'; tr.appendChild(fl);
      m.appendChild(tr);
      m.appendChild(el('span', 'metric__value', String(b.count)));
      lp.appendChild(m);
    });
  } else {
    lp.appendChild(el('div', 'muted', 'میانگین ' + t.averageWordCount + ' کلمه و ' + t.averageCharCount + ' نویسه در هر پاسخ'));
  }
  row1.appendChild(lp);
  block.appendChild(row1);

  // موضوعات
  var themes = t.themes || [];
  var themeTitle = {};
  themes.forEach(function (th) { themeTitle[th.key] = th.title; });
  if (themes.length) {
    var tp = el('div', 'panel');
    tp.style.marginBottom = '14px';
    tp.appendChild(el('h5', null, 'موضوعات مطرح‌شده'));
    var tbl = el('table', 'tbl');
    var thead = el('tr');
    ['موضوع', 'تعداد', 'درصد', 'مثبت', 'منفی', 'نمونه‌ها'].forEach(function (h) { thead.appendChild(el('th', null, h)); });
    tbl.appendChild(thead);
    themes.forEach(function (th) {
      var tr = el('tr');
      tr.appendChild(el('td', null, th.title));
      tr.appendChild(el('td', null, String(th.count)));
      tr.appendChild(el('td', null, th.percentage + '%'));
      tr.appendChild(el('td', 'pos', '+' + th.positiveCount));
      tr.appendChild(el('td', 'neg', '−' + th.negativeCount));
      var td = el('td');
      if ((th.samples || []).length) {
        var det = el('details', 'samples');
        det.appendChild(el('summary', null, th.samples.length + ' نمونه'));
        th.samples.forEach(function (sm) { det.appendChild(el('blockquote', null, sm)); });
        td.appendChild(det);
      }
      tr.appendChild(td);
      tbl.appendChild(tr);
    });
    tp.appendChild(tbl);
    block.appendChild(tp);
  }

  // کلیدواژه + عبارت
  var kws = (t.keywords && t.keywords.length) ? t.keywords : (t.topWords || []).map(function (w) { return { term: w.word, count: w.count, documentCount: w.count }; });
  var phrases = t.phrases || [];
  if (kws.length || phrases.length) {
    var row2 = el('div', 'twoCol');
    if (kws.length) {
      var kp = el('div', 'panel');
      kp.appendChild(el('h5', null, 'کلیدواژه‌های شاخص (اندازه = تعداد پاسخ‌های شامل)'));
      var chips = el('div', 'chips');
      var dmax = Math.max.apply(null, kws.map(function (k) { return k.documentCount || k.count; }));
      var dmin = Math.min.apply(null, kws.map(function (k) { return k.documentCount || k.count; }));
      kws.slice(0, 40).forEach(function (k) {
        var v = k.documentCount || k.count;
        var c = el('span', 'chip', k.term);
        c.style.fontSize = (dmax === dmin ? 0.9 : 0.78 + (v - dmin) / (dmax - dmin) * 0.7) + 'em';
        c.appendChild(el('small', null, String(k.documentCount)));
        chips.appendChild(c);
      });
      kp.appendChild(chips);
      row2.appendChild(kp);
    }
    if (phrases.length) {
      var pp = el('div', 'panel');
      pp.appendChild(el('h5', null, 'عبارت‌های پرتکرار'));
      var ol = el('ol', 'plain');
      phrases.forEach(function (p) { var li = el('li', null, '«' + p.term + '»'); li.appendChild(el('span', 'badge', p.documentCount + ' پاسخ')); ol.appendChild(li); });
      pp.appendChild(ol);
      row2.appendChild(pp);
    }
    block.appendChild(row2);
  }

  // پیشنهادها + تکراری
  var sugg = t.suggestions || [];
  var rep = t.repeatedAnswers || [];
  if (sugg.length || rep.length) {
    var row3 = el('div', 'twoCol');
    if (sugg.length) {
      var sgp = el('div', 'panel');
      sgp.appendChild(el('h5', null, 'پیشنهادهای پاسخ‌دهندگان (' + (t.suggestionCount || sugg.length) + ')'));
      var ul = el('ul', 'sugg');
      sugg.forEach(function (x) { ul.appendChild(el('li', null, x)); });
      sgp.appendChild(ul);
      row3.appendChild(sgp);
    }
    if (rep.length) {
      var rp = el('div', 'panel');
      rp.appendChild(el('h5', null, 'پاسخ‌های تکراری'));
      var rol = el('ol', 'plain');
      rep.forEach(function (r) { var li = el('li', null, r.word); li.appendChild(el('span', 'badge', r.count + ' بار')); rol.appendChild(li); });
      rp.appendChild(rol);
      row3.appendChild(rp);
    }
    block.appendChild(row3);
  }

  // همه پاسخ‌ها با جستجو و فیلتر
  var answers = (t.answers && t.answers.length) ? t.answers
    : ((s.samples || []).length ? s.samples.map(function (x) { return { text: x.text, sentiment: x.sentiment, wordCount: '', themes: [], isSuggestion: false }; })
      : (t.sampleAnswers || []).map(function (x) { return { text: x, sentiment: 'neutral', wordCount: '', themes: [], isSuggestion: false }; }));
  if (answers.length) {
    var ap = el('div', 'panel');
    ap.appendChild(el('h5', null, 'همه پاسخ‌ها (' + answers.length + ')'));
    var tools = el('div', 'answersTools');
    var search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'جستجو در پاسخ‌ها...';
    var sel = document.createElement('select');
    [['all', 'همه احساس‌ها'], ['positive', 'مثبت'], ['negative', 'منفی'], ['mixed', 'دوگانه'], ['neutral', 'خنثی'], ['empty', 'بی‌محتوا']].forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; sel.appendChild(op);
    });
    var themeSel = document.createElement('select');
    var opAll = document.createElement('option'); opAll.value = 'all'; opAll.textContent = 'همه موضوعات'; themeSel.appendChild(opAll);
    themes.forEach(function (th) { var op = document.createElement('option'); op.value = th.key; op.textContent = th.title; themeSel.appendChild(op); });
    var counter = el('span', 'muted');
    tools.appendChild(search); tools.appendChild(sel);
    if (themes.length) tools.appendChild(themeSel);
    tools.appendChild(counter);
    ap.appendChild(tools);

    var scroll = el('div', 'answersScroll');
    var at = el('table', 'tbl');
    var ah = el('tr');
    ['#', 'پاسخ', 'احساس', 'کلمات', 'موضوع'].forEach(function (h) { ah.appendChild(el('th', null, h)); });
    at.appendChild(ah);
    var rows = [];
    answers.forEach(function (a, i) {
      var tr = el('tr');
      tr.appendChild(el('td', 'muted', String(i + 1)));
      var txt = el('td');
      if (a.isSuggestion) txt.appendChild(el('span', 'tag', 'پیشنهاد'));
      txt.appendChild(document.createTextNode(a.text || ''));
      tr.appendChild(txt);
      var sc = el('td'); sc.appendChild(el('span', 'sent ' + a.sentiment, sentLabel(a.sentiment))); tr.appendChild(sc);
      tr.appendChild(el('td', 'muted', String(a.wordCount)));
      var thc = el('td');
      (a.themes || []).forEach(function (k) { thc.appendChild(el('span', 'tag', themeTitle[k] || k)); });
      tr.appendChild(thc);
      at.appendChild(tr);
      rows.push({ tr: tr, text: String(a.text || '').toLowerCase(), sentiment: a.sentiment, themes: a.themes || [] });
    });
    scroll.appendChild(at);
    ap.appendChild(scroll);

    function applyFilter() {
      var term = search.value.trim().toLowerCase();
      var sv = sel.value, tv = themeSel.value, shown = 0;
      rows.forEach(function (r) {
        var ok = (!term || r.text.indexOf(term) !== -1) && (sv === 'all' || r.sentiment === sv) && (tv === 'all' || r.themes.indexOf(tv) !== -1);
        r.tr.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      counter.textContent = shown + ' از ' + rows.length;
    }
    search.addEventListener('input', applyFilter);
    sel.addEventListener('change', applyFilter);
    themeSel.addEventListener('change', applyFilter);
    applyFilter();
    block.appendChild(ap);
  }

  host.appendChild(block);
}

(function renderTextTab() {
  var host = document.getElementById('textGroups');
  var textQs = (DATA.questions || []).filter(function (q) { return !!q.textAnalytics; });
  if (!textQs.length) {
    document.getElementById('textTabBtn').style.display = 'none';
    return;
  }
  var groups = groupQuestions(textQs);
  renderStepNav('textStepNav', groups, 'tstep-');
  groups.forEach(function (g) {
    var wrap = el('div');
    g.questions.forEach(function (q) { renderTextBlock(q, wrap); });
    if (HAS_STEPS) {
      var det = el('details', 'stepGroup');
      det.open = true;
      det.id = 'tstep-' + g.key;
      det.appendChild(stepHeaderNode(g, g.questions.length));
      det.appendChild(wrap);
      host.appendChild(det);
    } else {
      host.appendChild(wrap);
    }
  });
})();
`;