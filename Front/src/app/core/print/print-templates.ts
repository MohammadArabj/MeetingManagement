/**
 * فهرست قالب‌های چاپ سامانه.
 * ─────────────────────────────────────────────────────────────────────────
 *   • layout   : قاب مشترک همه‌ی چاپ‌ها (سربرگ با لوگو و نام شرکت، پاورقی، واترمارک)
 *   • document : قالب کامل یک سند (HTML + CSS) که از صفحه‌ی «چاپ و قالب‌ها» قابل طراحی است
 *   • report   : گزارش‌هایی که بدنه‌شان را برنامه می‌سازد؛ فقط CSS و قاب مشترکشان قابل تغییر است
 * قالب سفارشی هر کلید (در صورت وجود) جایگزین پیش‌فرض همین فایل می‌شود و «بازگشت به پیش‌فرض» همیشه ممکن است.
 */

export type PrintTemplateKind = 'layout' | 'document' | 'report';

export interface PrintVariable {
  name: string;
  description: string;
}

export interface PrintTemplateDefinition {
  key: string;
  title: string;
  description: string;
  kind: PrintTemplateKind;
  /** سربرگ مشترک (لوگو/نام شرکت) بالای سند نمایش داده شود؟ (سندهایی که سربرگ خودشان را دارند false) */
  layoutHeader: boolean;
  variables: PrintVariable[];
  defaultHtml: string;
  defaultCss: string;
  sampleData: Record<string, unknown>;
}

/** محتوای قالب سفارشی ذخیره‌شده در سامانه مدیریت فایل */
export interface PrintTemplateContent {
  version: 1;
  html: string;
  css: string;
  updatedAt?: string;
  updatedBy?: string;
}

// ═══════════════════════════════════════════════════════════
// متغیرهای مشترک
// ═══════════════════════════════════════════════════════════
const COMMON_VARS: PrintVariable[] = [
  { name: 'company.name', description: 'نام شرکت' },
  { name: 'company.subtitle', description: 'زیرعنوان سربرگ' },
  { name: 'company.logoUrl', description: 'آدرس لوگو (برای img)' },
  { name: 'company.address', description: 'نشانی' },
  { name: 'company.phone', description: 'تلفن' },
  { name: 'company.website', description: 'وب‌سایت' },
  { name: 'company.footerText', description: 'متن پاورقی' },
  { name: 'document.title', description: 'عنوان سند' },
  { name: 'printDate', description: 'تاریخ چاپ (شمسی)' },
  { name: 'printedBy', description: 'چاپ‌کننده' },
];

const MEETING_VARS: PrintVariable[] = [
  { name: 'meeting.title', description: 'عنوان جلسه' },
  { name: 'meeting.number', description: 'شماره جلسه' },
  { name: 'meeting.date', description: 'تاریخ جلسه' },
  { name: 'meeting.startTime / meeting.endTime', description: 'ساعت شروع / پایان' },
  { name: 'meeting.location', description: 'محل یا لینک جلسه' },
  { name: 'meeting.category', description: 'دسته‌بندی' },
  { name: 'meeting.chairman / meeting.secretary', description: 'رئیس / دبیر جلسه' },
];

const SAMPLE_COMPANY = {
  name: 'نام شرکت',
  subtitle: 'واحد دبیرخانه',
  logoUrl: '',
  address: 'نشانی شرکت',
  phone: '031-00000000',
  website: 'www.example.ir',
  footerText: 'این سند به‌صورت سیستمی تولید شده است.',
};

const SAMPLE_MEETING = {
  title: 'جلسه بررسی برنامه سالانه',
  number: '1404-125',
  date: '1404/07/15',
  startTime: '10:00',
  endTime: '12:00',
  location: 'سالن جلسات مرکزی',
  category: 'جلسات مدیریتی',
  chairman: 'مدیرعامل',
  secretary: 'دبیر جلسه',
};

const SAMPLE_ASSIGNMENTS = [
  { actor: 'مدیر برنامه‌ریزی', type: 'اقدام', follower: 'دبیر جلسه', dueDate: '1404/08/01' },
  { actor: 'مدیر مالی', type: 'اطلاع', follower: 'دبیر جلسه', dueDate: '1404/08/10' },
];

// ═══════════════════════════════════════════════════════════
// قاب مشترک
// ═══════════════════════════════════════════════════════════
const LAYOUT_HTML = `<div class="pt-page">
  {{#if watermark}}<div class="pt-watermark">{{watermark}}</div>{{/if}}
  {{#if header}}
  <header class="pt-header">
    <div class="pt-brand">
      {{#if company.logoUrl}}<img class="pt-logo" src="{{company.logoUrl}}" alt="لوگو">{{/if}}
      <div>
        <div class="pt-company">{{company.name}}</div>
        {{#if company.subtitle}}<div class="pt-subtitle">{{company.subtitle}}</div>{{/if}}
      </div>
    </div>
    <div class="pt-title">{{document.title}}</div>
    <div class="pt-meta">
      {{#if printDate}}<div>تاریخ چاپ: {{printDate}}</div>{{/if}}
      {{#if printedBy}}<div>چاپ‌کننده: {{printedBy}}</div>{{/if}}
    </div>
  </header>
  {{/if}}
  <main class="pt-content">{{{content}}}</main>
  {{#if footer}}
  <footer class="pt-footer">
    <span>{{company.footerText}}</span>
    <span>{{company.address}}{{#if company.phone}} — {{company.phone}}{{/if}}</span>
  </footer>
  {{/if}}
</div>`;

const LAYOUT_CSS = `@page { size: A4; margin: 12mm; }
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
body { direction: rtl; font-family: var(--pt-font, 'B Nazanin', Tahoma, sans-serif); color: #111; margin: 0; font-size: 13px; line-height: 1.7; }
.pt-page { position: relative; }
.pt-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 2px solid var(--pt-primary, #1f3a5f); padding-bottom: 8px; margin-bottom: 14px; }
.pt-brand { display: flex; align-items: center; gap: 10px; }
.pt-logo { height: 56px; width: auto; object-fit: contain; }
.pt-company { font-size: 16px; font-weight: 700; }
.pt-subtitle { font-size: 12px; color: #555; }
.pt-title { font-size: 17px; font-weight: 700; color: var(--pt-primary, #1f3a5f); text-align: center; flex: 1; }
.pt-meta { font-size: 11px; color: #555; text-align: left; min-width: 140px; }
.pt-footer { display: flex; justify-content: space-between; border-top: 1px solid #999; margin-top: 18px; padding-top: 6px; font-size: 10px; color: #555; }
.pt-watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 96px; color: rgba(0,0,0,.06); transform: rotate(-30deg); pointer-events: none; z-index: 0; }
.pt-content { position: relative; z-index: 1; }
table { border-collapse: collapse; width: 100%; }
.page-break { page-break-after: always; break-after: page; }`;

// ═══════════════════════════════════════════════════════════
// مصوبه/مصوبات جلسه عادی
// ═══════════════════════════════════════════════════════════
const RESOLUTION_BLOCK = `
  <div class="rs-section">
    <div class="rs-section-title">متن مصوبه {{resolution.number}}</div>
    <div class="rs-text">{{{resolution.text}}}</div>
  </div>
  <div class="rs-section">
    <div class="rs-section-title">تخصیص‌ها</div>
    <table class="rs-table">
      <thead><tr><th>ردیف</th><th>اقدام‌کننده</th><th>نوع</th><th>پیگیری‌کننده</th><th>سررسید</th></tr></thead>
      <tbody>
        {{#each resolution.assignments}}
        <tr><td>{{@number}}</td><td>{{actor}}</td><td>{{type}}</td><td>{{follower}}</td><td>{{dueDate}}</td></tr>
        {{else}}
        <tr><td colspan="5">تخصیصی برای این مصوبه ثبت نشده است.</td></tr>
        {{/each}}
      </tbody>
    </table>
  </div>`;

const MEETING_INFO_TABLE = `
<table class="rs-info">
  <thead><tr><th>موضوع جلسه</th><th>تاریخ</th><th>ساعت</th><th>شماره</th><th>رئیس جلسه</th><th>دبیر جلسه</th><th>محل</th></tr></thead>
  <tbody><tr><td>{{meeting.title}}</td><td>{{meeting.date}}</td><td>{{meeting.startTime}}</td><td>{{meeting.number}}</td><td>{{meeting.chairman}}</td><td>{{meeting.secretary}}</td><td>{{meeting.location}}</td></tr></tbody>
</table>`;

const SIGNATURES_BLOCK = `
{{#if signatures}}
<div class="rs-section">
  <div class="rs-section-title">امضای اعضا</div>
  <div class="rs-signatures">
    {{#each signatures}}
    <div class="rs-signature">
      {{#if signatureUrl}}<img src="{{signatureUrl}}" alt="امضا">{{/if}}
      <span>{{name}}</span>
    </div>
    {{/each}}
  </div>
</div>
{{/if}}`;

const RESOLUTION_CSS = `.rs-info th, .rs-table th { background: #e5e7eb; border: 1px solid #333; padding: 6px; font-weight: 700; }
.rs-info td, .rs-table td { border: 1px solid #333; padding: 6px; text-align: center; }
.rs-section { border: 1.5px solid #555; border-radius: 8px; margin: 12px 0; overflow: hidden; }
.rs-section-title { background: #fbe5d5; border-bottom: 1px solid #555; padding: 6px 10px; font-weight: 700; text-align: center; }
.rs-text { padding: 12px; text-align: justify; }
.rs-signatures { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px; }
.rs-signature { display: flex; flex-direction: column; align-items: center; min-width: 120px; }
.rs-signature img { width: 125px; height: 65px; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; }
.rs-comments td { text-align: right; }`;

const RESOLUTION_VARS: PrintVariable[] = [
  ...COMMON_VARS, ...MEETING_VARS,
  { name: 'resolution.number / resolution.title', description: 'شماره / عنوان مصوبه' },
  { name: 'resolution.text', description: 'متن مصوبه (HTML؛ با {{{ }}})' },
  { name: 'resolution.assignments[]', description: 'تخصیص‌ها: actor ، type ، follower ، dueDate' },
  { name: 'comments[]', description: 'نظر اعضا: name ، comment' },
  { name: 'signatures[]', description: 'امضاها: name ، signatureUrl' },
];

// ═══════════════════════════════════════════════════════════
// هیئت مدیره (سربرگ اختصاصی در هر صفحه)
// ═══════════════════════════════════════════════════════════
const BOARD_PAGE = `
<section class="bd-page{{#unless @last}} page-break{{/unless}}">
  <div class="bd-header">
    {{#if company.logoUrl}}<img class="bd-logo" src="{{company.logoUrl}}" alt="لوگو">{{/if}}
    <div class="bd-company">{{company.name}}</div>
  </div>
  <div class="bd-box">
    <div class="bd-row bd-row-head">
      <div class="bd-title">صورتجلسه هیئت مدیره</div>
      <div class="bd-info">
        <span>تاریخ جلسه: {{meeting.date}}</span>
        <span>شماره صورتجلسه: {{meeting.number}}</span>
        <span>شماره مصوبه: {{number}}</span>
      </div>
    </div>
    <div class="bd-row"><span class="bd-label">حاضرین:</span>{{#each attendees}}<span class="bd-attendee"><i>✓</i>{{name}}</span>{{/each}}</div>
    {{#if secretary}}<div class="bd-row"><span class="bd-label">دبیر جلسه:</span><span class="bd-attendee"><i>✓</i>{{secretary}}</span></div>{{/if}}
    <div class="bd-row"><span class="bd-label">موضوع:</span> {{title}}</div>
    {{#if documentation}}<div class="bd-row"><div class="bd-label">سوابق و مستندات:</div><div class="bd-content">{{{documentation}}}</div></div>{{/if}}
    {{#if description}}<div class="bd-row"><div class="bd-label">توضیحات:</div><div class="bd-content">{{{description}}}</div></div>{{/if}}
    {{#if decisionsMade}}<div class="bd-row"><div class="bd-label">تصمیمات متخذه:</div><div class="bd-content">{{{decisionsMade}}}</div></div>{{/if}}
    <div class="bd-signatures">
      {{#each signers}}<div class="bd-signature"><div class="bd-sign-name">{{name}}</div><div class="bd-sign-pos">{{position}}</div></div>{{/each}}
    </div>
    <div class="bd-note">در راستای رعایت مفاد ماده ۱۲۹ اصلاحیه قانون تجارت، جناب آقای <span class="bd-line"></span> در تصمیم‌گیری بند <span class="bd-line"></span> مشارکت نداشته‌اند / امضاء</div>
  </div>
</section>`;

const BOARD_CSS = `body { font-size: 14px; }
.bd-header { text-align: center; margin-bottom: 8px; }
.bd-logo { height: 64px; width: auto; }
.bd-company { font-size: 18px; font-weight: 700; margin: 4px 0 12px; }
.bd-box { border: 2px solid #000; }
.bd-row { border-bottom: 1px solid #000; padding: 6px 10px; }
.bd-row-head { padding: 12px 10px; }
.bd-title { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 6px; }
.bd-info { display: flex; justify-content: space-between; gap: 24px; font-size: 15px; }
.bd-label { font-weight: 800; margin-left: 6px; }
.bd-attendee { display: inline-flex; align-items: center; gap: 4px; margin-left: 12px; font-weight: 800; }
.bd-attendee i { display: inline-flex; width: 12px; height: 12px; border: 2px solid #000; font-style: normal; font-size: 10px; align-items: center; justify-content: center; }
.bd-content { padding: 0 12px; text-align: justify; font-size: 15px; font-weight: 600; }
.bd-signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 24px 10px; border-bottom: 1px solid #000; }
.bd-signature { text-align: center; min-height: 70px; }
.bd-sign-name { font-weight: 700; margin-top: 28px; }
.bd-sign-pos { font-size: 12px; font-weight: 700; }
.bd-note { font-size: 12px; padding: 10px; text-align: justify; }
.bd-line { display: inline-block; width: 100px; border-bottom: 1px solid #000; margin: 0 4px; }`;

const BOARD_VARS: PrintVariable[] = [
  ...COMMON_VARS, ...MEETING_VARS,
  { name: 'resolutions[]', description: 'مصوبات: number ، title ، documentation ، description ، decisionsMade (HTML)' },
  { name: 'attendees[]', description: 'حاضرین: name' },
  { name: 'secretary', description: 'نام دبیر جلسه' },
  { name: 'signers[]', description: 'جای امضا: name ، position (۶ خانه)' },
];

const SAMPLE_BOARD_RESOLUTION = {
  number: '03',
  title: 'تصویب بودجه سال آینده',
  documentation: '<p>نامه شماره ۱۲۳ مورخ ۱۴۰۴/۰۷/۰۱</p>',
  description: '<p>بودجه پیشنهادی توسط مدیر مالی ارائه شد.</p>',
  decisionsMade: '<p>بودجه با اصلاحات پیشنهادی تصویب شد.</p>',
};

// ═══════════════════════════════════════════════════════════
// صورتجلسه
// ═══════════════════════════════════════════════════════════
const MINUTES_HTML = `
${MEETING_INFO_TABLE}
{{#if agendas}}
<div class="mn-section">
  <div class="mn-section-title">دستور جلسه</div>
  <ol class="mn-list">{{#each agendas}}<li>{{text}}</li>{{/each}}</ol>
</div>
{{/if}}
{{#if attachmentsCount}}<p class="mn-attachments">پیوست: {{attachmentsCount}} فایل</p>{{/if}}
<div class="mn-section">
  <div class="mn-section-title">حاضرین و غائبین</div>
  <table class="mn-table">
    <thead><tr><th>ردیف</th><th>نام</th><th>نقش</th><th>وضعیت</th></tr></thead>
    <tbody>
      {{#each members}}
      <tr><td>{{@number}}</td><td>{{name}}{{#if substitute}} (جانشین: {{substitute}}){{/if}}</td><td>{{role}}</td><td>{{#if isPresent}}حاضر{{else}}غایب{{/if}}</td></tr>
      {{/each}}
    </tbody>
  </table>
</div>
{{#if guests}}
<div class="mn-section">
  <div class="mn-section-title">مدعوین</div>
  <div class="mn-inline">{{#each guests}}<span>{{name}}{{#if organization}} ({{organization}}){{/if}}</span>{{/each}}</div>
</div>
{{/if}}
{{#if description}}
<div class="mn-section">
  <div class="mn-section-title">شرح جلسه</div>
  <div class="mn-text">{{{description}}}</div>
</div>
{{/if}}
<div class="mn-section">
  <div class="mn-section-title">مصوبات</div>
  <table class="mn-table">
    <thead><tr><th style="width:48px">ردیف</th><th>متن مصوبه</th><th>اقدام‌کننده</th><th>پیگیری‌کننده</th><th>سررسید</th></tr></thead>
    <tbody>
      {{#each resolutions}}
      <tr>
        <td>{{@number}}</td>
        <td class="mn-left">{{{text}}}</td>
        <td>{{#each assignments}}<div>{{actor}}</div>{{/each}}</td>
        <td>{{#each assignments}}<div>{{follower}}</div>{{/each}}</td>
        <td>{{#each assignments}}<div>{{dueDate}}</div>{{/each}}</td>
      </tr>
      {{else}}
      <tr><td colspan="5">مصوبه‌ای ثبت نشده است.</td></tr>
      {{/each}}
    </tbody>
  </table>
</div>
{{#if rider}}
<div class="mn-section">
  <div class="mn-section-title">الحاقیه</div>
  <div class="mn-text">{{{rider}}}</div>
</div>
{{/if}}
{{#if comments}}
<div class="mn-section">
  <div class="mn-section-title">نظرات اعضا</div>
  <table class="mn-table"><tbody>{{#each comments}}<tr><td style="width:180px">{{name}}</td><td class="mn-left">{{comment}}</td></tr>{{/each}}</tbody></table>
</div>
{{/if}}
<div class="mn-section">
  <div class="mn-section-title">امضای حاضرین</div>
  <div class="mn-signatures">
    {{#each signers}}
    <div class="mn-signature">
      <div class="mn-sign-box">{{#if signatureUrl}}<img src="{{signatureUrl}}" alt="امضا">{{/if}}</div>
      <div class="mn-sign-name">{{name}}</div>
      <div class="mn-sign-role">{{role}}{{#if signedAt}} — {{signedAt}}{{/if}}</div>
    </div>
    {{/each}}
  </div>
</div>`;

const MINUTES_CSS = `${RESOLUTION_CSS}
.mn-section { border: 1.5px solid #555; border-radius: 8px; margin: 12px 0; overflow: hidden; }
.mn-section-title { background: #e8eef6; border-bottom: 1px solid #555; padding: 6px 10px; font-weight: 700; }
.mn-table th { background: #f1f5f9; border: 1px solid #555; padding: 5px; }
.mn-table td { border: 1px solid #555; padding: 5px; text-align: center; vertical-align: top; }
.mn-left { text-align: justify !important; }
.mn-list { margin: 8px 24px; }
.mn-inline { display: flex; flex-wrap: wrap; gap: 12px; padding: 8px 12px; }
.mn-text { padding: 10px 12px; text-align: justify; }
.mn-signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 12px; }
.mn-signature { text-align: center; }
.mn-sign-box { height: 64px; display: flex; align-items: center; justify-content: center; border-bottom: 1px dashed #999; }
.mn-sign-box img { max-height: 60px; max-width: 120px; object-fit: contain; }
.mn-sign-name { font-weight: 700; margin-top: 4px; }
.mn-sign-role { font-size: 11px; color: #555; }
.mn-attachments { margin: 6px 0; color: #555; }`;

const MINUTES_VARS: PrintVariable[] = [
  ...COMMON_VARS, ...MEETING_VARS,
  { name: 'agendas[]', description: 'دستور جلسه: text' },
  { name: 'members[]', description: 'اعضا: name ، role ، isPresent ، substitute' },
  { name: 'guests[]', description: 'مدعوین: name ، organization' },
  { name: 'description', description: 'شرح جلسه (HTML)' },
  { name: 'rider', description: 'الحاقیه (HTML)' },
  { name: 'attachmentsCount', description: 'تعداد فایل‌های پیوست' },
  { name: 'resolutions[]', description: 'مصوبات: number ، text (HTML) ، assignments[] (actor ، follower ، dueDate)' },
  { name: 'comments[]', description: 'نظر اعضا: name ، comment' },
  { name: 'signers[]', description: 'امضاکنندگان: name ، role ، signatureUrl ، signedAt' },
  { name: 'isDraft', description: 'پیش‌نویس است؟ (واترمارک خودکار)' },
];

// ═══════════════════════════════════════════════════════════
// دستور جلسه
// ═══════════════════════════════════════════════════════════
const AGENDA_HTML = `
<div class="ag-info">
  <span>موضوع جلسه: <strong>{{meeting.title}}</strong></span>
  <span>شماره جلسه: {{meeting.number}}</span>
  <span>تاریخ جلسه: {{meeting.date}}{{#if meeting.startTime}} ساعت {{meeting.startTime}}{{/if}}</span>
</div>
<table class="ag-table">
  <thead><tr><th style="width:56px">ردیف</th><th>متن دستور جلسه</th><th style="width:120px">پیوست</th></tr></thead>
  <tbody>
    {{#each agendas}}
    <tr><td class="ag-center">{{@number}}</td><td>{{text}}</td><td class="ag-center">{{#if files}}دارد ({{files}} فایل){{else}}ندارد{{/if}}</td></tr>
    {{else}}
    <tr><td colspan="3" class="ag-center">دستور جلسه‌ای ثبت نشده است.</td></tr>
    {{/each}}
  </tbody>
</table>`;

const AGENDA_CSS = `.ag-info { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.ag-table th { background: #e8eef6; border: 1px solid #333; padding: 8px; }
.ag-table td { border: 1px solid #333; padding: 8px; white-space: pre-line; }
.ag-table tbody tr:nth-child(even) { background: #f7f7f7; }
.ag-center { text-align: center; }`;

// ═══════════════════════════════════════════════════════════
// گزارش‌ها (بدنه توسط برنامه)
// ═══════════════════════════════════════════════════════════
const REPORT_VARS: PrintVariable[] = [
  ...COMMON_VARS,
  { name: 'content', description: 'بدنه‌ی گزارش (توسط برنامه ساخته می‌شود؛ فقط CSS قابل تغییر است)' },
];

/** ظاهر پایه‌ی گزارش‌ها (بدنه با کلاس‌های بوت‌استرپ ساخته می‌شود؛ بوت‌استرپ در پنجره‌ی چاپ بارگذاری نمی‌شود) */
const REPORT_CSS = `table { width: 100%; border-collapse: collapse; margin: 8px 0; }
th { background: #e8eef6; border: 1px solid #444; padding: 6px; font-weight: 700; }
td { border: 1px solid #444; padding: 6px; vertical-align: top; }
h1, h2, h3, h4, h5 { color: var(--pt-primary, #1f3a5f); margin: 10px 0 6px; }
.text-center { text-align: center; } .text-end { text-align: left; } .text-start { text-align: right; }
.fw-bold, strong { font-weight: 700; }
.badge { display: inline-block; padding: 1px 6px; border: 1px solid #999; border-radius: 4px; font-size: 11px; }
.d-none, .no-print, button, .btn { display: none !important; }`;

const FOLLOWUP_CSS = `.resolution-card { page-break-inside: avoid; }
.print-header {
  text-align: center;
  border-bottom: 3px solid #4f46e5;
  padding-bottom: 15px;
  margin-bottom: 20px;
}
.meeting-info { display: flex; justify-content: center; gap: 30px; background: #f3f4f6; padding: 10px; border-radius: 8px; }
.stats-bar { display: flex; justify-content: space-around; background: #f8f9fa; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
.stat-item { text-align: center; }
.stat-value { font-size: 24px; font-weight: bold; }
.stat-label { font-size: 12px; color: #6b7280; }
.resolution-card { border: 2px solid #e5e7eb; border-radius: 10px; margin-bottom: 20px; overflow: hidden; }
.resolution-header { background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; padding: 12px; display: flex; gap: 15px; }
.resolution-number { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-weight: bold; }
.resolution-text, .resolution-decisions { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
.assignment-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin: 10px; overflow: hidden; }
.assignment-card.overdue { border-color: #f87171; background: #fef2f2; }
.assignment-header { padding: 10px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; font-size: 12px; }
.assignment-info { display: flex; gap: 15px; flex-wrap: wrap; }
.overdue-badge { color: #dc2626; font-weight: bold; }
.actions-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.actions-table th { background: #e5e7eb; padding: 8px; border: 1px solid #d1d5db; }
.actions-table td { padding: 8px; border: 1px solid #e5e7eb; text-align: center; }
.text-right { text-align: right !important; }
.badge { padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
.status-pending { background: #6b7280; color: white; }
.status-progress { background: #f59e0b; color: white; }
.status-completed { background: #10b981; color: white; }
.result-done { background: #059669; color: white; }
.result-notdone { background: #dc2626; color: white; }
.no-data, .no-assignments { text-align: center; padding: 15px; color: #6b7280; font-style: italic; }`;

const ACTIONS_CSS = `@media print {
.resolution-card { page-break-inside: avoid; }
}
.print-header {
text-align: center;
border-bottom: 3px solid #4f46e5;
padding-bottom: 20px;
margin-bottom: 25px;
}
.meeting-info {
display: flex;
justify-content: center;
gap: 30px;
flex-wrap: wrap;
margin-top: 15px;
padding: 10px;
background: #f3f4f6;
border-radius: 8px;
}
.meeting-info-item {
display: flex;
gap: 5px;
}
.meeting-info-item .label {
font-weight: 600;
color: #6b7280;
}
.meeting-info-item .value {
color: #1f2937;
}
.summary-section {
background: linear-gradient(135deg, #f8faff 0%, #e7eeff 100%);
border: 1px solid #c7d2fe;
border-radius: 10px;
padding: 15px;
margin-bottom: 25px;
}
.summary-title {
font-size: 14px;
font-weight: 600;
color: #4338ca;
margin-bottom: 10px;
text-align: center;
}
.summary-grid {
display: grid;
grid-template-columns: repeat(6, 1fr);
gap: 10px;
}
.summary-item {
text-align: center;
padding: 8px;
background: white;
border-radius: 6px;
border: 1px solid #e5e7eb;
}
.summary-item .label {
display: block;
font-size: 11px;
color: #6b7280;
}
.summary-item .value {
display: block;
font-size: 18px;
font-weight: bold;
color: #1f2937;
}
.summary-item.completed { border-color: #10b981; background: #ecfdf5; }
.summary-item.completed .value { color: #059669; }
.summary-item.progress { border-color: #f59e0b; background: #fffbeb; }
.summary-item.progress .value { color: #d97706; }
.summary-item.pending { border-color: #6b7280; background: #f9fafb; }
.summary-item.pending .value { color: #4b5563; }
.resolution-card {
border: 2px solid #e5e7eb;
border-radius: 12px;
margin-bottom: 20px;
overflow: hidden;
}
.resolution-header {
background: linear-gradient(135deg, #4f46e5, #6366f1);
color: white;
padding: 12px 15px;
display: flex;
align-items: center;
gap: 15px;
}
.resolution-number {
background: rgba(255,255,255,0.2);
padding: 5px 12px;
border-radius: 20px;
font-weight: bold;
font-size: 13px;
}
.resolution-title {
font-size: 14px;
font-weight: 600;
}
.resolution-text, .resolution-decisions {
padding: 12px 15px;
border-bottom: 1px solid #e5e7eb;
}
.section-title {
font-weight: 600;
color: #4338ca;
margin-bottom: 8px;
font-size: 13px;
}
.content {
color: #374151;
font-size: 12px;
line-height: 1.8;
text-align: justify;
}
.assignments-section {
padding: 15px;
}
.assignment-card {
background: #f9fafb;
border: 1px solid #e5e7eb;
border-radius: 8px;
margin-bottom: 12px;
overflow: hidden;
}
.assignment-header {
background: #f3f4f6;
padding: 10px 12px;
display: flex;
justify-content: space-between;
align-items: center;
flex-wrap: wrap;
gap: 10px;
border-bottom: 1px solid #e5e7eb;
}
.assignment-info {
display: flex;
gap: 5px;
align-items: center;
flex-wrap: wrap;
font-size: 11px;
}
.assignment-info .label {
color: #6b7280;
}
.assignment-info .value {
color: #1f2937;
font-weight: 500;
}
.assignment-info .separator {
color: #d1d5db;
margin: 0 5px;
}
.assignment-status {
display: flex;
gap: 5px;
}
.badge {
padding: 3px 8px;
border-radius: 12px;
font-size: 10px;
font-weight: 600;
}
.status-pending { background: #6b7280; color: white; }
.status-progress { background: #f59e0b; color: white; }
.status-completed { background: #10b981; color: white; }
.result-done { background: #059669; color: white; }
.result-notdone { background: #dc2626; color: white; }
.actions-table {
width: 100%;
border-collapse: collapse;
font-size: 11px;
}
.actions-table th {
background: #e5e7eb;
padding: 8px;
text-align: center;
font-weight: 600;
color: #374151;
border: 1px solid #d1d5db;
}
.actions-table td {
padding: 8px;
text-align: center;
border: 1px solid #e5e7eb;
vertical-align: middle;
}
.actions-table tbody tr:nth-child(even) {
background: #f9fafb;
}
.action-row td:nth-child(3) {
text-align: right;
}
.no-data, .no-assignments {
text-align: center;
padding: 20px;
color: #6b7280;
font-style: italic;
}`;

const RESOLUTION_REPORT_CSS = `@page { size: A4 landscape; margin: 10mm 10mm 16mm 10mm; @bottom-center { content: "صفحه " counter(page) " از " counter(pages); font-size: 10px; color: #555; } }
table { font-size: 11px; }
th, td { text-align: center; vertical-align: middle; }
tbody tr:nth-child(even) { background-color: #f9fafb; }
tr, td, th { page-break-inside: avoid; }
.bg-success { background: #10b981; color: #fff; }
.bg-warning { background: #f59e0b; color: #fff; }
.bg-danger { background: #ef4444; color: #fff; }
.bg-secondary { background: #6b7280; color: #fff; }
.filters-applied { background: #f3f4f6; padding: 8px; border-radius: 6px; margin: 6px 0; border-right: 4px solid var(--pt-primary, #4f46e5); }
.filter-item { display: inline-block; margin: 2px 4px; padding: 2px 6px; background: #e5e7eb; border-radius: 3px; font-size: 11px; }
.stats-table td:first-child { text-align: right; }`;

function report(key: string, title: string, description: string, css = ''): PrintTemplateDefinition {
  return {
    key, title, description, kind: 'report', layoutHeader: true, variables: REPORT_VARS,
    defaultHtml: '{{{content}}}', defaultCss: css ? `${REPORT_CSS}\n${css}` : REPORT_CSS,
    sampleData: { content: '<table><thead><tr><th>ردیف</th><th>عنوان</th><th>وضعیت</th></tr></thead><tbody><tr><td>1</td><td>نمونه‌ی محتوای گزارش</td><td>در حال انجام</td></tr></tbody></table>' },
  };
}

// ═══════════════════════════════════════════════════════════
// Registry
// ═══════════════════════════════════════════════════════════
export const PRINT_TEMPLATES: readonly PrintTemplateDefinition[] = [
  {
    key: 'layout',
    title: 'قاب مشترک چاپ',
    description: 'سربرگ (لوگو، نام شرکت، عنوان سند)، پاورقی و واترمارک همه‌ی چاپ‌ها',
    kind: 'layout',
    layoutHeader: true,
    variables: [...COMMON_VARS,
      { name: 'content', description: 'محتوای سند (با {{{content}}})' },
      { name: 'header / footer', description: 'نمایش سربرگ / پاورقی' },
      { name: 'watermark', description: 'متن واترمارک' }],
    defaultHtml: LAYOUT_HTML,
    defaultCss: LAYOUT_CSS,
    sampleData: { header: true, footer: true, watermark: '', content: '<p style="text-align:center">محتوای سند در این قسمت قرار می‌گیرد.</p>' },
  },
  {
    key: 'minutes',
    title: 'صورتجلسه',
    description: 'صورتجلسه‌ی کامل جلسات عادی (اعضا، دستور، شرح، مصوبات، نظرات و امضاها)',
    kind: 'document',
    layoutHeader: true,
    variables: MINUTES_VARS,
    defaultHtml: MINUTES_HTML,
    defaultCss: MINUTES_CSS,
    sampleData: {
      meeting: SAMPLE_MEETING,
      agendas: [{ text: 'گزارش عملکرد شش‌ماهه' }, { text: 'بررسی برنامه سال آینده' }],
      members: [
        { name: 'مدیرعامل', role: 'رئیس', isPresent: true },
        { name: 'دبیر جلسه', role: 'دبیر', isPresent: true },
        { name: 'مدیر مالی', role: 'عضو', isPresent: false, substitute: 'معاون مالی' },
      ],
      guests: [{ name: 'کارشناس برنامه‌ریزی', organization: 'واحد برنامه‌ریزی' }],
      description: '<p>جلسه با تلاوت آیاتی از قرآن کریم آغاز شد.</p>',
      resolutions: [{ number: 1, text: '<p>برنامه سال آینده تا پایان ماه نهایی شود.</p>', assignments: SAMPLE_ASSIGNMENTS }],
      comments: [{ name: 'مدیر مالی', comment: 'با رعایت سقف بودجه موافقم.' }],
      signers: [
        { name: 'مدیرعامل', role: 'رئیس', signedAt: '1404/07/16' },
        { name: 'دبیر جلسه', role: 'دبیر' },
      ],
    },
  },
  {
    key: 'resolution',
    title: 'مصوبه (تکی)',
    description: 'چاپ یک مصوبه‌ی جلسه‌ی عادی با تخصیص‌ها و امضاها',
    kind: 'document',
    layoutHeader: true,
    variables: RESOLUTION_VARS,
    defaultHtml: `${MEETING_INFO_TABLE}${RESOLUTION_BLOCK}
{{#if comments}}<div class="rs-section"><div class="rs-section-title">توضیحات اعضا</div><table class="rs-table rs-comments"><tbody>{{#each comments}}<tr><td style="width:180px">{{name}}</td><td>{{comment}}</td></tr>{{/each}}</tbody></table></div>{{/if}}
${SIGNATURES_BLOCK}`,
    defaultCss: RESOLUTION_CSS,
    sampleData: {
      meeting: SAMPLE_MEETING,
      resolution: { number: 1, text: '<p>متن نمونه‌ی مصوبه</p>', assignments: SAMPLE_ASSIGNMENTS },
      comments: [{ name: 'مدیر مالی', comment: 'موافق' }],
      signatures: [{ name: 'مدیرعامل' }, { name: 'دبیر جلسه' }],
    },
  },
  {
    key: 'resolutions',
    title: 'همه مصوبات جلسه',
    description: 'چاپ همه‌ی مصوبات یک جلسه‌ی عادی (هر مصوبه در صفحه‌ی جدا)',
    kind: 'document',
    layoutHeader: true,
    variables: RESOLUTION_VARS,
    defaultHtml: `${MEETING_INFO_TABLE}
<p class="rs-summary"><strong>تعداد مصوبات: {{resolutions.length}}</strong></p>
{{#each resolutions}}
<section class="{{#unless @last}}page-break{{/unless}}">
  <div class="rs-section"><div class="rs-section-title">مصوبه شماره {{number}}</div><div class="rs-text">{{{text}}}</div></div>
  <div class="rs-section">
    <div class="rs-section-title">تخصیص‌ها</div>
    <table class="rs-table">
      <thead><tr><th>ردیف</th><th>اقدام‌کننده</th><th>نوع</th><th>پیگیری‌کننده</th><th>سررسید</th></tr></thead>
      <tbody>{{#each assignments}}<tr><td>{{@number}}</td><td>{{actor}}</td><td>{{type}}</td><td>{{follower}}</td><td>{{dueDate}}</td></tr>{{else}}<tr><td colspan="5">تخصیصی ثبت نشده است.</td></tr>{{/each}}</tbody>
    </table>
  </div>
  ${SIGNATURES_BLOCK}
</section>
{{/each}}`,
    defaultCss: `${RESOLUTION_CSS}\n.rs-summary { text-align: center; color: #555; }`,
    sampleData: {
      meeting: SAMPLE_MEETING,
      resolutions: [
        { number: 1, text: '<p>مصوبه اول</p>', assignments: SAMPLE_ASSIGNMENTS },
        { number: 2, text: '<p>مصوبه دوم</p>', assignments: [] },
      ],
      signatures: [{ name: 'مدیرعامل' }, { name: 'دبیر جلسه' }],
    },
  },
  {
    key: 'board-resolutions',
    title: 'صورتجلسه هیئت مدیره',
    description: 'مصوبات هیئت مدیره (هر مصوبه در صفحه‌ی جدا با سربرگ اختصاصی)؛ برای چاپ تکی هم استفاده می‌شود',
    kind: 'document',
    layoutHeader: false,
    variables: BOARD_VARS,
    defaultHtml: `{{#each resolutions}}${BOARD_PAGE}{{/each}}`,
    defaultCss: BOARD_CSS,
    sampleData: {
      meeting: SAMPLE_MEETING,
      resolutions: [SAMPLE_BOARD_RESOLUTION],
      attendees: [{ name: 'رئیس هیئت مدیره' }, { name: 'نایب رئیس' }, { name: 'عضو هیئت مدیره' }],
      secretary: 'دبیر هیئت مدیره',
      signers: [
        { name: 'رئیس هیئت مدیره', position: 'رئیس هیئت مدیره' },
        { name: 'نایب رئیس', position: 'نایب رئیس' },
        { name: 'عضو هیئت مدیره', position: 'عضو هیئت مدیره' },
        { name: 'دبیر هیئت مدیره', position: 'دبیر جلسه' },
        { name: '', position: '' },
        { name: '', position: '' },
      ],
    },
  },
  {
    key: 'agenda',
    title: 'دستور جلسه',
    description: 'چاپ دستور جلسه از تب «دستور جلسه»',
    kind: 'document',
    layoutHeader: true,
    variables: [...COMMON_VARS, ...MEETING_VARS, { name: 'agendas[]', description: 'دستورها: text ، files (تعداد پیوست)' }],
    defaultHtml: AGENDA_HTML,
    defaultCss: AGENDA_CSS,
    sampleData: {
      meeting: SAMPLE_MEETING,
      agendas: [{ text: 'گزارش عملکرد شش‌ماهه', files: 2 }, { text: 'بررسی برنامه سال آینده', files: 0 }],
    },
  },
  report('followup-report', 'گزارش پیگیری', 'گزارش پیگیری مصوبات جلسه', FOLLOWUP_CSS),
  report('actions-report', 'گزارش اقدامات', 'گزارش اقدامات مصوبات جلسه', ACTIONS_CSS),
  report('resolution-report', 'گزارش مصوبات', 'گزارش تفصیلی/خلاصه/آماری مصوبات (منوی گزارش‌ها)', RESOLUTION_REPORT_CSS),
];

export function getPrintTemplate(key: string): PrintTemplateDefinition | undefined {
  return PRINT_TEMPLATES.find(t => t.key === key);
}
