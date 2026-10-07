# سامانه مدیریت جلسات (Meeting Management)

سامانه‌ی تحت وب برای برنامه‌ریزی، برگزاری و پیگیری جلسات سازمانی، از جمله جلسات **هیئت مدیره** و **کمیسیون معاملات**. چرخه‌ی کامل جلسه را پوشش می‌دهد: دعوت اعضا، دستور جلسه، حضور و غیاب، ثبت مصوبه، صورتجلسه و امضا. پس از جلسه هم تخصیص مصوبات، ارجاع و پیگیری اقدامات در همین سامانه انجام می‌شود.

> **قید اصلی رعایت‌شده: هیچ تغییری در اسکیمای دیتابیس داده نشده است.**
> هیچ Migration جدیدی لازم نیست و Mapping موجودیت‌ها دست‌نخورده مانده تا مدل EF دقیقاً با دیتابیس فعلی یکی باشد.
> هر جا داده‌ی جدید لازم بود (پیکربندی نقش‌ها، نگاشت رویدادها، Watermark یادآوری)، به‌صورت **ردیف جدید در جدول موجود `SystemSettings`** ذخیره شده است.

## فهرست

**بخش اول: معرفی و راه‌اندازی**
- [امکانات](#امکانات)
- [فناوری‌ها](#فناوریها)
- [ساختار مخزن و معماری بک‌اند](#ساختار-مخزن-و-معماری-بکاند)
- [ساختار فرانت](#ساختار-فرانت)
- [سرویس‌های وابسته](#سرویسهای-وابسته)
- [پیکربندی](#پیکربندی)
- [اجرای محلی](#اجرای-محلی)
- [Jobهای زمان‌بندی‌شده](#jobهای-زمانبندیشده)
- [وضعیت‌های جلسه](#وضعیتهای-جلسه)
- [دسترسی‌ها (Permission)](#دسترسیها-permission)
- [کلیدهای `SystemSettings`](#کلیدهای-systemsettings)

**بخش سوم: نسخه‌ی جدید**
- [مدل امنیتی، ادمین، امضا، کارتابل، هیئت مدیره، اطلاع‌رسانی لحظه‌ای، فایل، چاپ، ظاهر، راهنما و استقرار](#بخش-سوم-نسخهی-جدید-امنیت-ادمین-ارجاع-امضا-چاپ-اطلاعرسانی-لحظهای-ظاهر-و-راهنما)

**بخش دوم: گزارش بازبینی و بازسازی**
- [۱. وضعیت تغییرات و build](#۱-وضعیت-تغییرات-و-build)
- [۲. علت‌های «گاهی مصوبه ثبت نمی‌شود و باید رفرش کرد»](#۲-علتهای-گاهی-مصوبه-ثبت-نمیشود-و-باید-رفرش-کرد)
- [۳. سایر مشکلات پیداشده و رفع‌شده](#۳-سایر-مشکلات-پیداشده-و-رفعشده)
- [۴. نقش‌ها: حذف هاردکد](#۴-نقشها-حذف-هاردکد)
- [۵. ارجاع تخصیص: تصمیم‌های طراحی](#۵-ارجاع-تخصیص-تصمیمهای-طراحی)
- [۶. اطلاع‌رسانی](#۶-اطلاعرسانی-کامل-روی-جدولهای-موجود)
- [۷. احراز هویت](#۷-احراز-هویت-oidc-client--oidc-client-ts)
- [۸. مراحل استقرار](#۸-مراحل-استقرار)
- [۹. چک‌لیست تست](#۹-چکلیست-تست)
- [۱۰. کارهای باقی‌مانده](#۱۰-کارهای-باقیمانده)

---

# بخش اول: معرفی و راه‌اندازی

## امکانات

| حوزه | امکانات |
|---|---|
| **جلسات** | ثبت، کپی (clone) و ویرایش جلسه. انتخاب دسته‌بندی، اتاق و زمان، با کنترل زمان‌های مسدود (`BlockedTime`). تقویم جلسات (FullCalendar)، جستجو و فهرست |
| **اعضا و نقش‌ها** | افزودن اعضا با سمت، تعیین نقش (رئیس، دبیر، دبیر غیرعضو، ناظر، عضو، مهمان و نقش‌های سفارشی)، جانشین، اعلام حضور |
| **برگزاری** | دستور جلسه، حضور و غیاب، ثبت مصوبات با برچسب و پیوست، صورتجلسه، امضا و تأیید نهایی |
| **هیئت مدیره** | گردش کار جداگانه و مدیریت اعضای هیئت مدیره (`/boardMember`) |
| **مصوبات و پیگیری** | تخصیص مصوبه به اقدام‌کننده و پیگیری‌کننده، ارجاع چندسطحی (همراه با بازگشت و فراخوانی، با نمایش درختی زنجیره‌ی ارجاع با d3-org-chart)، ثبت اقدام، گزارش مصوبات |
| **فایل‌ها** | آپلود قابل ازسرگیری (tus) در سرویس FileManagement، نمایشگر PDF، کنترل تعداد، حجم و پسوند مجاز |
| **اطلاع‌رسانی** | پیامک (از طریق صف Outbox) و اعلان داخل سامانه برای ۱۵ رویداد. قالب پیام قابل ویرایش است و یادآوری‌ها خودکار ارسال می‌شوند |
| **تفویض و سمت** | سوییچ سمت کاربر و کار به نیابت از دیگری (تفویض) از هدر |
| **تنظیمات** | تنظیمات داده‌محور، ماتریس نقش × توانایی، رویدادها، قالب‌ها، پنل پیامک و گزارش ارسال |
| **داشبورد** | کارتابل: شاخص‌های فوری، جلسات/اقدامات/پیگیری‌های من، برنامه‌ی امروز و فردا و روند جلسات؛ به‌روزرسانی لحظه‌ای |
| **اطلاع‌رسانی لحظه‌ای** | SignalR در همین سامانه (`/hubs/notifications`) و رله‌ی امن به پورتال SSO (`/hubs/portal`) |
| **چاپ** | سربرگ ثابت (لوگو، نام شرکت، رنگ، فونت، پاورقی، واترمارک) و طراح قالب HTML/CSS برای صورتجلسه، مصوبات، دستور جلسه و گزارش‌ها |
| **راهنما** | راهنمای درون‌برنامه‌ای برای همه‌ی صفحات (دکمه‌ی «؟» یا F1) با جستجو، پرسش‌های پرتکرار و مرجع وضعیت‌ها و نقش‌ها |
| **ظاهر** | سیستم طراحی یکپارچه (توکن‌های رنگ، فونت وزیرمتن با ارقام فارسی)، حالت روشن/تیره |

## فناوری‌ها

**بک‌اند**
- .NET 10 / ASP.NET Core Web API
- Entity Framework Core 10 (SQL Server) برای Command و NHibernate/Dapper برای Query (الگوی CQRS)
- Autofac برای DI و Interceptorها، و Quartz.NET برای Jobها
- JWT Bearer برای احراز هویت با SSO مبتنی بر OpenID Connect
- Swagger (فقط در محیط Development)، RestSharp و `HttpClientFactory` برای فراخوانی سرویس‌های دیگر
- پکیج‌های خصوصی سازمان: `Epc.Application`، `Epc.Domain`، `Epc.EntityFramework`، `Epc.Dapper`، `Epc.Autofac` و `Epc.Company` (نسخه‌ی 1.2.7)

**فرانت**
- Angular 21 (Standalone، Signals، Interceptorها و Guardهای functional)
- `oidc-client-ts` برای Authorization Code + PKCE
- Bootstrap 5، ng-bootstrap 20، ng-select، ag-grid، FullCalendar، ApexCharts، SweetAlert2 و toastr
- `jalali-moment` برای تاریخ شمسی، `ngx-extended-pdf-viewer` و `tus-js-client`

## ساختار مخزن و معماری بک‌اند

```
MeetingManagement.slnx
├── MeetingManagement.Common                       # Enumها، Extensionها، مدل پاسخ (Result)، مدل پیامک، آپلود
├── MeetingManagement.Domain                       # Aggregateها (Meeting, Resolution, Assignment, Role, …) و قوانین دامنه
│   └── Shared/Access                              # MeetingRoles، MeetingStatusIds، MeetingKinds، MeetingWorkflow
├── MeetingManagement.Application.Contracts        # Command و DTOها
├── MeetingManagement.Application                  # CommandHandlerها و سرویس‌های کاربردی
├── MeetingManagement.Infrastructure.Persistence   # DbContextها (Command/Query)، Mapping، Repository و Migrations
├── MeetingManagement.Infrastructure.Query.Contracts # قراردادهای Query و ViewModelها
├── MeetingManagement.Infrastructure.Query         # QueryHandlerها
├── MeetingManagement.Infrastructure.Acl           # ارتباط با UserManagement (Anti-Corruption Layer)
├── MeetingManagement.Infrastructure.Configuration # ماژول Autofac، Jobها، اطلاع‌رسانی، Seeder و سرویس‌های دسترسی
│   ├── Job/                                       # MeetingAutoCloseJob، NotificationDispatchJob، NotificationReminderJob
│   ├── Notifications/                             # Publisher (Outbox)، Renderer قالب، SmsSender و ServiceTokenProvider
│   ├── Service/                                   # SettingInitializationService و MeetingDataSeeder
│   └── Services/                                  # MeetingAccessService، MeetingRoleConfigService و ActingIdentityResolver
├── MeetingManagement.Presentation.Facade.Contracts # رابط‌های Facade
├── MeetingManagement.Presentation.Facade          # Command Facadeها
├── MeetingManagement.Presentation.Facade.Query    # Query Facadeها
├── MeetingManagement.Presentation.Api             # Controllerها، Middlewareها (Exception و AntiXss) و Filterها (RequirePermission)
└── Front/                                         # پروژه‌ی Angular (Front.esproj)
```

**جریان درخواست:**

```
Controller → Facade (Command/Query)
   ├─ Command → CommandHandler → Domain Aggregate → Repository (EF Core) → SQL Server
   └─ Query   → QueryHandler   → QueryContext / Dapper                    → SQL Server
```

**Controllerها** (`api/[controller]/...`): `Meeting`، `MeetingMember`، `Agenda`، `Resolution`، `Assignment`، `Action`، `File`، `BoardMember`، `Category`، `CategoryPermission`، `Label`، `Role`، `Room`، `Status`، `BlockedTime`، `Setting`، `SystemSetting`، `NotificationSetting`، `NotificationTemplate`، `NotificationCenter`، `Alarm` و `MeetingAccess`.

همه‌ی Controllerها به توکن معتبر با scope `MeetApi` نیاز دارند (Policy به نام `FileManagementApi`). کنترل دسترسی ریزدانه با `[RequirePermission]` و `IMeetingAccessService` انجام می‌شود.

## ساختار فرانت

```
Front/src/app
├── authentication/      # صفحه‌ی challenge (callback ورود از SSO)
├── core/                # auth (AuthService/SessionStore)، guards، interceptors، meeting-access (*meetingCan)، directives (*hasPermission)
├── services/            # سرویس‌های HTTP هر ماژول و سرویس‌های زیرساختی
├── shared/              # کامپوننت‌های مشترک (ag-grid، modal، file-manager، file-uploader، file-viewer، …)
└── app-shell/           # پوسته‌ی اصلی برنامه
    ├── dashboard/  calendar/  search/  meetings/  resolutions/
    ├── board-member/  delegation/  user/  notification/
    ├── settings/        # تنظیمات جدید (lazy)
    └── header/ sidebar/ footer/ breadcrumb/
```

| مسیر | توضیح | دسترسی لازم |
|---|---|---|
| `/#/dashboard` | داشبورد | — |
| `/#/meetings/list`، `create`، `clone/:guid`، `details/:guid` | فهرست، ثبت، کپی و جزئیات جلسه | — (کنترل در سطح جلسه) |
| `/#/meetings/category`، `categoryPermission` | دسته‌بندی‌ها و دسترسی آن‌ها | `MT_Categories` |
| `/#/meetings/label`، `status`، `role`، `room` | برچسب‌ها، وضعیت‌ها، نقش‌ها و اتاق‌ها | `MT_ResolutionLabels`، `MT_Statuses`، `MT_UserRoles`، `MT_Locations` |
| `/#/resolutions/list`، `report`، `details/:id` | مصوبات، گزارش و مدیریت تخصیص | — |
| `/#/calendar`، `/#/search` | تقویم و جستجو | — |
| `/#/delegation` | تفویض | — |
| `/#/boardMember` | اعضای هیئت مدیره | `MT_BoardMembers` |
| `/#/user` | کاربران | `MT_User_ViewAll` |
| `/#/settings/...` | تنظیمات سامانه | `MT_Settings` (بخش نقش‌ها: `MT_UserRoles`) |

## سرویس‌های وابسته

سامانه به چند سرویس سازمانی دیگر وابسته است:

| سرویس | کاربرد | پیش‌فرض توسعه |
|---|---|---|
| **SSO** (IdentityServer) | ورود کاربران، صدور توکن و توکن سرویس‌به‌سرویس (S2S) | `https://localhost:7001` |
| **UserManagement** | کاربران، سمت‌ها، دسترسی‌ها و تفویض | `https://localhost:6001` |
| **FileManagement** | ذخیره و دریافت فایل‌ها (آپلود tus) | `https://localhost:4001` |
| **پنل پیامک** | ارسال پیامک | `http://sms.epciran.ir` |
| **SQL Server** | دیتابیس `MeetingManagement` | — |

## پیکربندی

### بک‌اند: `MeetingManagement.Presentation.Api/appsettings*.json`

| کلید | توضیح |
|---|---|
| `ConnectionStrings:Application` | رشته‌ی اتصال SQL Server. در محیط عملیاتی از متغیر محیطی `ConnectionStrings__Application` یا `appsettings.Production.json` روی سرور استفاده کنید. |
| `IdentityAuthorities[0]` | آدرس SSO برای اعتبارسنجی JWT |
| `Auth:RequireHttpsMetadata` | در شبکه‌ی داخلی بدون HTTPS برابر `false` است |
| `AllowedOrigins` | Originهای مجاز CORS (آدرس فرانت) |
| `BoardCategoryGuid` | GUID دسته‌بندی هیئت مدیره |
| `ssoDatabaseName` | نام دیتابیس SSO |
| `UserManagementUrl`، `FileManagementUrl`، `SmsUrl` | آدرس سرویس‌های وابسته |
| `S2S:ClientId`، `S2S:ClientSecret`، `S2S:Scope` | توکن سرویس‌به‌سرویس برای Jobهای اطلاع‌رسانی. `ClientSecret` را فقط روی سرور مقداردهی کنید. |

> ⚠️ هیچ رمزی (رمز دیتابیس یا `S2S:ClientSecret`) را در مخزن commit نکنید. مقدار واقعی را فقط روی سرور، در متغیر محیطی یا `appsettings.Production.json` (خارج از مخزن) قرار دهید.

### فرانت: `Front/src/environments/environment*.ts`

| مقدار | توضیح |
|---|---|
| `serviceEndpoint` | آدرس API همین سامانه (توسعه: `https://localhost:8001`) |
| `userManagementEndpoint`، `identityEndpoint`، `fileManagementEndpoint` | آدرس سرویس‌های وابسته |
| `selfEndpoint` | آدرس خود فرانت. آدرس بازگشت از SSO برابر `{selfEndpoint}/#/challenge` است. |
| `ssoAuthenticationFlow` | `'code'` (پیش‌فرض، PKCE) یا `'password'` |
| `systemGuid` | شناسه‌ی سامانه در SSO و UserManagement |
| `boardCategoryGuid`، `committeeGuid` | GUID دسته‌بندی هیئت مدیره و کمیسیون معاملات |
| `defaultFollowerGuid`، `defaultFollowerPositionGuid` | پیگیری‌کننده‌ی پیش‌فرض تخصیص‌ها |
| `auth.clientId`، `auth.scope` | کلاینت `MeetManage` با scopeهای `openid profile UserManagementApi FileManagementApi MeetApi` |
| `apiEndpoints` | فهرست سفید آدرس‌هایی که توکن به آن‌ها فرستاده می‌شود |

در build عملیاتی، `environment.prod.ts` جایگزین `environment.ts` می‌شود.

## اجرای محلی

**پیش‌نیازها:** .NET SDK 10، Node.js (نسخه‌ی سازگار با Angular 21)، SQL Server، دسترسی به فید NuGet سازمانی (برای پکیج‌های `Epc.*`) و اجرای SSO، UserManagement و FileManagement روی آدرس‌های بالا.

**بک‌اند:**

```bash
# رشته‌ی اتصال را در appsettings.Development.json یا با user-secrets تنظیم کنید
dotnet restore MeetingManagement.slnx
dotnet build   MeetingManagement.slnx
dotnet run --project MeetingManagement.Presentation.Api
# https://localhost:8001/swagger
```

در اولین اجرا، `SettingInitializationService` تنظیمات پیش‌فرض، پیکربندی نقش‌ها و رویدادهای اطلاع‌رسانی را Seed می‌کند. این کار فقط داده اضافه می‌کند و اسکیما را تغییر نمی‌دهد.

**فرانت:**

```bash
cd Front
npm ci
npm start          # ng serve روی http://127.0.0.1:4200
npx ng build       # خروجی عملیاتی در dist/
npm test           # تست‌های واحد (Karma + Jasmine)
```

> اگر از Visual Studio استفاده می‌کنید، هر دو پروژه (API و `Front.esproj`) در `MeetingManagement.slnx` تعریف شده‌اند و می‌توانند با هم اجرا شوند.

## Jobهای زمان‌بندی‌شده

با Quartz.NET به‌صورت Hosted Service اجرا می‌شوند (`Infrastructure.Configuration/Job/QuartzConfiguration.cs`):

| Job | زمان‌بندی | کار |
|---|---|---|
| `MeetingAutoCloseJob` | هر ۳۰ دقیقه | اتمام خودکار جلسات «ثبت نهایی» که از امضای رئیس آن‌ها `MeetingAutoCloseMinutes` گذشته است (امضای رئیس تنها شرط است)؛ و در صورت فعال بودن `MeetingUndeterminedAfterDays`، «تعیین تکلیف نشده» کردن جلسات معوق |
| `NotificationDispatchJob` | هر ۱ دقیقه | ارسال پیامک‌های در صف `NotificationLogs` با تلاش مجدد نمایی و رعایت ساعات سکوت |
| `NotificationReminderJob` | هر ۱۰ دقیقه | یادآوری جلسه و سررسید تخصیص‌ها با Watermark در `SystemSettings[27]` |

## وضعیت‌های جلسه

تعریف در `MeetingManagement.Domain/Shared/Access/MeetingWorkflow.cs` (`MeetingStatusIds`):

| Id | وضعیت |
|---|---|
| 1 | پیش‌نویس |
| 2 | ثبت اولیه |
| 3 | برگزار شده |
| 4 | ثبت نهایی |
| 5 | لغو شده |
| 6 | اتمام یافته |
| 7 | تعیین تکلیف نشده |

انتقال‌های مجاز فقط در `MeetingStatusIds.CanTransition` تعریف شده‌اند (فرانت: `core/meeting-access/meeting-status.ts` با همان جدول):

| از | به |
|---|---|
| پیش‌نویس | ثبت اولیه، لغو |
| ثبت اولیه | برگزار شده، لغو، تعیین تکلیف نشده، (هیئت مدیره: اتمام) |
| برگزار شده | ثبت نهایی، تعیین تکلیف نشده، (هیئت مدیره: اتمام) |
| ثبت نهایی | اتمام (پس از امضای رئیس)، بازگشت به برگزار شده (پیش از امضای رئیس) |
| تعیین تکلیف نشده | برگزار شده، لغو |
| لغو شده | ثبت اولیه (فعال‌سازی مجدد؛ نیازمند توانایی «لغو جلسه») |

ادمین مدیریت جلسات می‌تواند خارج از این جدول هم وضعیت را اصلاح کند. نوع جلسه (عادی، هیئت مدیره یا کمیسیون معاملات) فقط در `MeetingKinds` و از روی دسته‌بندی تشخیص داده می‌شود.

## دسترسی‌ها (Permission)

دسترسی‌های سطح سامانه در UserManagement تعریف می‌شوند و در claim `permission` توکن قرار می‌گیرند. دسترسی‌های پرکاربرد:

| گروه | دسترسی‌ها |
|---|---|
| جلسات | `MT_Meetings`، `MT_Meetings_InitialRegister`، `MT_Meetings_FinalRegister`، `MT_Meetings_Edit`، `MT_Meetings_Delete`، `MT_Meetings_Cancel`، `MT_Meetings_Hold`، `MT_Meetings_Finalize`، `MT_Meetings_CommentAndSign`، `MT_Meetings_ViewAllMeetings`، `MT_Meetings_Search`، `MT_Meetings_ViewCalendar`، `MT_Meetings_ViewFiles` |
| مصوبات | `MT_Resolutions`، `MT_Resolutions_Add`، `MT_Resolutions_Edit`، `MT_Resolutions_Delete`، `MT_Resolutions_Assign`، `MT_Resolutions_ViewFiles`، `MT_Resolutions_DeleteFiles`، `MT_Descriptions_Edit`، `MT_Followups` |
| پایه و تنظیمات | `MT_Settings`، `MT_UserRoles`، `MT_Categories`، `MT_ResolutionLabels`، `MT_Statuses`، `MT_Locations`، `MT_BoardMembers`، `MT_User_ViewAll`، `MT_Archive`، `MT_PrintTemplates` |
| **ادمین و هیئت مدیره (جدید)** | `MT_Admin` (ادمین مدیریت جلسات)، `MT_Board_ViewAll` (مشاهده‌ی جلسات هیئت مدیره بدون عضویت) |

> سه دسترسی `MT_Admin`، `MT_Board_ViewAll` و `MT_PrintTemplates` جدید هستند و باید در سامانه‌ی مدیریت کاربران برای این سیستم تعریف و به سمت‌های مربوط داده شوند.

دسترسی کاربر **روی یک جلسه‌ی مشخص** از نقش او در آن جلسه به دست می‌آید (توانایی‌ها؛ بخش ۴ را ببینید). این دسترسی را `IMeetingAccessService` و `api/MeetingAccess` محاسبه می‌کنند.

## کلیدهای `SystemSettings`

تعریف در `MeetingManagement.Common/Extensions/Enumerations.cs`. کلیدهای ۱۵ به بعد در این بازبینی اضافه شده‌اند و فقط ردیف جدید در جدول موجودند:

| Id | کلید | توضیح |
|---|---|---|
| 1 | `BoardCategoryGuid` | دسته‌بندی هیئت مدیره |
| 2 | `BoardPositionGuid` | سمت هیئت مدیره |
| 3 | `BoardSecretaryUserGuid` | کاربر دبیر هیئت مدیره |
| 4 | `CommitteeCategoryGuid` | دسته‌بندی کمیسیون معاملات |
| 7 | `MeetingAutoCloseMinutes` | مدت اتمام خودکار جلسه پس از امضا (دقیقه) |
| 8 | `MaxResolutionAttachments` | حداکثر تعداد پیوست هر مصوبه |
| 9 | `MaxAttachmentSizeMB` | حداکثر حجم پیوست (مگابایت) |
| 10 | `SystemGuid` | کد سیستم |
| 11 | `SmsUrl` | آدرس پنل پیامک |
| 12 | `SystemName` | نام سیستم |
| 13 | `SmsEnabled` | فعال بودن پیامک |
| 14 | `AllowedFileExtensions` | پسوندهای مجاز آپلود |
| 15 | `MeetingRoleConfig` | پیکربندی نقش‌ها و توانایی‌ها (JSON) |
| 16 | `NotificationEventMap` | نگاشت کد رویدادها به شناسه‌ی جدول (JSON) |
| 17 | `SystemBaseUrl` | آدرس عمومی سامانه برای لینک داخل پیامک |
| 18 | `MeetingReminderHoursBefore` | یادآوری جلسه: چند ساعت قبل |
| 19 | `AssignmentDueReminderDaysBefore` | یادآوری سررسید تخصیص: چند روز قبل |
| 20 | `NotificationMaxRetry` | حداکثر تلاش مجدد ارسال |
| 21 | `NotificationQuietStart` | شروع ساعات سکوت پیامک (`HH:mm`) |
| 22 | `NotificationQuietEnd` | پایان ساعات سکوت پیامک (`HH:mm`) |
| 23 | `ReferralMaxDepth` | حداکثر عمق زنجیره‌ی ارجاع (پیش‌فرض ۵) |
| 24 | `ReferralAllowLaterDueDate` | اجازه‌ی سررسید ارجاع دیرتر از تخصیص والد |
| 25 | `InAppNotificationEnabled` | فعال بودن اعلان داخل سامانه |
| 26 | `SmsTestMode` | حالت آزمایشی پیامک (فقط ثبت لاگ) |
| 27 | `NotificationReminderWatermark` | آخرین زمان اجرای Job یادآوری (داخلی؛ دستی تغییر ندهید) |
| 28 | `PrintBranding` | سربرگ چاپ (JSON: نام شرکت، شناسه‌ی لوگو، نشانی، رنگ، فونت، …) |
| 29 | `PrintTemplates` | قالب‌های سفارشی چاپ (JSON: کلید قالب ← شناسه‌ی فایل JSON قالب در FileManagement) |
| 30 | `MeetingUndeterminedAfterDays` | «تعیین تکلیف نشده»ی خودکار: چند روز پس از تاریخ جلسه (۰ = غیرفعال؛ پیش‌فرض) |

---

# بخش سوم: نسخه‌ی جدید (امنیت، ادمین، ارجاع، امضا، چاپ، اطلاع‌رسانی لحظه‌ای، ظاهر و راهنما)

## ۱. مدل امنیتی: هویت از سرور، نه از کلاینت

- فرانت دیگر شناسه‌ی کاربر/سمت یا «مشاهده‌ی همه» را تعیین نمی‌کند. `ActingIdentityResolver` هویت فعال (کاربر، سمت، تفویض) را با سرویس تفویض UserManagement راستی‌آزمایی می‌کند و دسترسی‌ها را از `GetPositionPermissions` یا `GetDelegationPermissions` می‌گیرد (Fail-closed؛ کش ۱۰ دقیقه).
- پارامترهای هویتی درخواست‌ها با `[CallerUser]`، `[CallerPosition]` و `[CallerHasPermission]` در `CallerIdentityFilter` با مقدار سرور جایگزین می‌شوند.
- قواعد مشترک کوئری‌ها در `Infrastructure.Query/Security/QueryScopes.cs` (جلسات قابل مشاهده، تخصیص‌های ابلاغ‌شده، ارجاع‌های باز و …) و قواعد Command در `MeetingGuard` و `IMeetingAccessService` هستند.

## ۲. ادمین مدیریت جلسات (`MT_Admin`)

روش درست برای «ادمین مدیریت جلسات»: یک سمت (مثلاً «ادمین مدیریت جلسات») در UserManagement، با دسترسی **`MT_Admin`** برای این سیستم. نیازی نیست آن سمت «مدیر کل» همه‌ی سامانه‌ها باشد.

- دارای همه‌ی دسترسی‌های `MT_*`، عبور از قفل وضعیت (ویرایش جلسه، اعضا، حضور و غیاب، شرح، پیوست‌ها و الحاقیه در هر وضعیت، و تغییر وضعیت خارج از جدول انتقال‌ها)، دیدن همه‌ی جلسات حتی پیش‌نویس‌ها.
- از راه تفویض منتقل نمی‌شود (در سرور و فرانت یکسان).
- **جلسات هیئت مدیره** همچنان دسترسی صریح `MT_Board_ViewAll` می‌خواهند؛ اگر ادمین باید آن‌ها را ببیند، این دسترسی را هم به همان سمت بدهید.
- امضای صورتجلسه شخصی است و ادمین به‌جای اعضا امضا نمی‌کند.
- فرانت: `SessionStore.isSuperAdmin` و `readIsMeetingAdmin()` همان منطق سرور را دارند.

## ۳. امضای صورتجلسه

- فقط امضای **رئیس جلسه** تعیین‌کننده است؛ سایر اعضا پس از امضای رئیس امضا می‌کنند (ثبت نظر پیش از آن ممکن است). امضای رئیس قطعی است. امضای دبیر غیرعضو شرط هیچ مرحله‌ای نیست و پرچم «امضای الزامی» نقش‌ها حذف شد.
- هر عضو فقط به نام خود و فقط در وضعیت «ثبت نهایی» امضا می‌کند؛ عضو غایب امضا ندارد.
- با امضای رئیس، تخصیص‌ها ابلاغ و اطلاع‌رسانی می‌شوند (رویداد `ChairmanSigned`).

## ۴. کارتابل و ارجاع

- تخصیص‌ها پس از **ابلاغ** دیده می‌شوند: جلسات عادی پس از امضای رئیس، هیئت مدیره پس از اتمام.
- نمای «همه» = تخصیص‌های اصلی + ارجاع‌های **باز** دریافتی؛ ارجاع‌های ارسالی فقط در تب خودشان (دیگر اصل و ارجاع با هم تکرار نمی‌شوند).
- با پایان تخصیص اصلی، همه‌ی ارجاع‌های زیرمجموعه بسته می‌شوند و از کارتابل/داشبورد ارجاع‌گیرندگان خارج می‌شوند؛ داده‌ی قدیمی هنگام شروع برنامه ترمیم می‌شود (`RepairOrphanReferralsAsync`).
- شمارنده‌های داشبورد و فهرست‌ها از همان Scopeها محاسبه می‌شوند تا همیشه یکسان باشند.

## ۵. هیئت مدیره

دسترسی فقط برای اعضای جلسه، ثبت‌کننده و دارندگان `MT_Board_ViewAll`؛ «مشاهده‌ی همه‌ی جلسات» و حتی مدیر سامانه به‌تنهایی کافی نیست. این قاعده در همه‌ی کوئری‌ها (جلسات، مصوبات، اعضا، دستور جلسه، اقدامات، فایل‌ها، گزارش‌ها و اعضای هیئت مدیره) اعمال شده است.

## ۶. اطلاع‌رسانی لحظه‌ای (SignalR)

- هاب `/hubs/notifications` (متد `notification`)؛ اعلان‌ها پس از commit تراکنش ارسال می‌شوند (`RealtimeFlushFilter`).
- رله‌ی امن به SSO: `POST api/realtime/publish` با امضای HMAC (`X-Realtime-Timestamp`، `X-Realtime-Signature`) و هاب پورتال `/hubs/portal`. پیکربندی: `Realtime:Sso:{Url, SourceName, SharedSecret}` در این سامانه و `Realtime:Sources` در SSO (کلید مشترک یکسان).
- **IIS:** ویژگی WebSocket Protocol باید نصب و فعال باشد.
- کد و patch سامانه‌های SSO/UserManagement/FileManagement در پوشه‌ی `integrations/` و راهنمای آن در `integrations/README.md` است.

## ۷. فایل‌ها (tus) و FileManagement

بارگذاری تکه‌ای (۵ مگابایت) با تازه‌سازی توکن در هر تکه، تلاش مجدد برای خطاهای شبکه/۵xx و ازسرگیری؛ در FileManagement سقف حجم بزرگ و لینک امضاشده برای فایل‌ها (`/files`) اعمال شده است.

## ۸. چاپ و قالب‌ها

- «تنظیمات › چاپ و قالب‌ها» (دسترسی `MT_PrintTemplates` یا `MT_Settings`): سربرگ و طراح قالب با پیش‌نمایش زنده، چاپ آزمایشی و بازگشت به پیش‌فرض.
- قالب‌ها: قاب مشترک، صورتجلسه، مصوبه، همه‌ی مصوبات، صورتجلسه‌ی هیئت مدیره، دستور جلسه و گزارش‌های پیگیری/اقدامات/مصوبات.
- محتوای قالب‌ها فایل JSON در FileManagement است (بدون تغییر اسکیما). موتور قالب کد اجرا نمی‌کند و HTML خروجی پاک‌سازی می‌شود.

## ۹. ظاهر و راهنما

- سیستم طراحی در `Front/src/styles/` (`tokens.css`، `base.css`، `components.css`، `layout.css`، `vendors.css`)، تم ag-grid در `shared/ag-grid-base/grid-theme.ts` و حالت تیره در `core/theme/theme.service.ts`.
- راهنما: محتوا در `core/help/help-content.ts` (هر موضوع با `match` به مسیر صفحه وصل است)، پنل در `app-shell/help-panel`، دکمه‌ی بخشی `<app-help-button topic="...">`.

## ۱۰. استقرار این نسخه

1. در UserManagement دسترسی‌های `MT_Admin`، `MT_Board_ViewAll` و `MT_PrintTemplates` را تعریف و به سمت‌ها بدهید.
2. patchهای `integrations/` را روی SSO، UserManagement و FileManagement اعمال کنید و `Realtime:*` را با کلید مشترک تنظیم کنید.
3. روی IIS ویژگی WebSocket را فعال کنید.
4. بک‌اند را منتشر کنید؛ Seeder کلیدهای ۲۸ تا ۳۰ را اضافه می‌کند.
5. فرانت: `npm ci` و `npx ng build` (فونت وزیرمتن از بسته‌ی npm کپی می‌شود).
6. در «تنظیمات › چاپ و قالب‌ها» لوگو و سربرگ را ثبت کنید.

---

# بخش دوم: گزارش بازبینی و بازسازی

## ۱. وضعیت تغییرات و build

همه‌ی تغییرات این بازبینی در سورس بک‌اند و فرانت اعمال شده‌اند.

**فایل‌های حذف‌شده در فرانت** (با نسخه‌ی جدید جایگزین شده‌اند؛ اگر نسخه‌ی قدیمی را روی سورس دیگری کپی می‌کنید، این فایل‌ها را پاک کنید):
`core/guards/challenge.guard.service.ts`،
`core/interceptors/exception.interceptor.service.ts`،
`core/interceptors/loader.interceptor.service.ts`،
`core/interceptors/security.interceptor.service.ts`،
`core/interceptors/validation.interceptor.service.ts`.

**وضعیت build:**
- **فرانت:** `ng build` (production و development) بدون خطا اجرا شد. فقط هشدارهای قبلیِ بودجه‌ی CSS و حجم bundle باقی است.
- **بک‌اند:** در محیط بازبینی **کامپایل نشده** است، چون پکیج‌های خصوصی `Epc.*` و NuGet در دسترس نبودند. همه‌ی امضاها با سورس تطبیق داده شده‌اند، ولی **اولین قدم `dotnet build` است.** خطاهای احتمالی باید جزئی باشند (مثلاً یک using).

---

## ۲. علت‌های «گاهی مصوبه ثبت نمی‌شود و باید رفرش کرد»

این مشکل چند علت هم‌زمان داشت و همه رفع شده‌اند:

| # | علت | لایه | رفع |
|---|---|---|---|
| 1 | `ValidationInterceptor` هر POST را با **اولین** `#submitForm` صفحه اعتبارسنجی می‌کرد. فرم ویرایش جلسه (`meeting-ops`) همیشه داخل صفحه‌ی جزئیات جلسه با همین id بود، پس ثبت مصوبه با فرم دیگری سنجیده و رد می‌شد. listenerها هم با هر submit انباشته می‌شدند. | فرانت | interceptor جدید فقط فرمی را بررسی می‌کند که دکمه‌ی ارسال در آن است. فرم‌های Reactive (مصوبه، تخصیص، اقدام) `noValidate` دارند. |
| 2 | `ActorItem.PositionGuid` از نوع `Guid` بود. برای کاربر بدون سمت `''` ارسال می‌شد و Model Binding کل درخواست را با خطای 400 رد می‌کرد. | هر دو | در سرور `Guid?` شد و فرانت `null` می‌فرستد. |
| 3 | پاسخ ناموفق (`isSuccess=false`) در `HttpService` به‌عنوان داده به `next()` می‌رفت. مودال بسته و فرم ریست می‌شد و داده‌ی کاربر از دست می‌رفت. | فرانت | پاسخ ناموفق حالا وارد شاخه‌ی error می‌شود (`ApiError`). |
| 4 | فرم مصوبه داخل مودال همیشه زنده بود. اگر مودال با Esc بسته می‌شد، حالت ویرایش (حتی **id مصوبه**) در «ثبت جدید» باقی می‌ماند. | فرانت | `openToken`: با هر بار باز شدن، فرم از نو ساخته می‌شود. |
| 5 | جلوی دابل‌کلیک گرفته نشده بود. Loader هم در درخواست‌های لغوشده هیچ‌وقت بسته نمی‌شد. | فرانت | `isSaving` به‌همراه spinner، و `finalize` در loading interceptor. |
| 6 | در هیئت مدیره، ثبت شرح را در `Text` ذخیره می‌کرد ولی ویرایش آن را در `Description` می‌نوشت. UI ستون `Text` را می‌خواند، پس ویرایش‌ها «گم» می‌شدند. | بک‌اند | هر دو ستون در ویرایش به‌روز می‌شوند. |
| 7 | تخصیص جدید در حالت ویرایش با وضعیت **«پایان یافته»** ساخته می‌شد. حذف تخصیصی که اقدام داشت خطای FK و 500 می‌داد. شماره‌ی غیرعددی با `Convert.ToInt32` خطا می‌داد. `SortOrder` از نوع byte سرریز می‌کرد. | بک‌اند | همه رفع شد و کل عملیات در **یک تراکنش** انجام می‌شود. |
| 8 | ثبت جلسه: شرط `setting != null \|\| setting.IsSmsEnabled` خطای NullReference می‌داد و پیامک هم‌زمان ارسال می‌شد. نتیجه این بود که جلسه ذخیره می‌شد ولی کاربر خطای 500 می‌دید و دوباره ثبت می‌کرد. | بک‌اند | اطلاع‌رسانی از طریق صف (Outbox) انجام می‌شود. |

---

## ۳. سایر مشکلات پیداشده و رفع‌شده

### امنیت
- **🔴 فوری:** رمز `sa` سرور عملیاتی داخل `appsettings.json` (به‌صورت comment) بود. **رمز را عوض کنید** و برای برنامه یک SQL Login با حداقل دسترسی بسازید.
  > ⚠️ در سورس فعلی، `appsettings.json` و `appsettings.Development.json` هنوز رشته‌های اتصال با کاربر `sa` و رمز (فعال و comment‌شده) دارند. پیش از commit همه را حذف کنید و رشته‌ی اتصال را فقط روی سرور یا در متغیر محیطی `ConnectionStrings__Application` قرار دهید. رمزهایی که تا امروز در فایل‌ها بوده‌اند لو رفته به حساب می‌آیند و باید عوض شوند.
- `client_secret` داخل باندل فرانت بود (هم کلاینت `MeetManage` و هم `PhoenixClient`). در SSO کلاینت public است و PKCE اجباری است، پس secret هم ناامن بود و هم بی‌اثر. حذف شد.
- **هیچ کنترل دسترسی سمت سرور وجود نداشت.** هر کاربر دارای scope `MeetApi` می‌توانست مصوبه، تخصیص، ارجاع و وضعیت هر جلسه‌ای را تغییر دهد. کنترل ارجاع هم comment شده بود. حالا `IMeetingAccessService` و `[RequirePermission]` این کنترل را انجام می‌دهند.
- مسیرهای تنظیمات فقط در منو مخفی بودند و API آن‌ها برای همه باز بود. `permissionGuard` در فرانت و `[RequirePermission]` در بک‌اند اضافه شد.
- `ExceptionMiddleware` برای `BusinessException` کل **stack trace** را به کاربر می‌فرستاد.
- `UseDeveloperExceptionPage` و `ShowPII` در محیط عملیاتی فعال بودند.
- `SecurityInterceptor`: عبارت `if (flow = 'code')` انتساب بود نه مقایسه. همین interceptor روی خطای 403 کاربر را logout می‌کرد.
- `AntiXss`: به حروف بزرگ و کوچک حساس بود (`<SCRIPT` عبور می‌کرد) و آپلودهای تا ۵۰۰ مگابایت را کامل در حافظه کپی می‌کرد.

### باگ و کیفیت کد
- در `Role`، `Category`، `Label`، `Room` و `MeetingStatus` متد `ThrowWhenDuplicated` بدون `await` اجرا می‌شد. کنترل تکراری کار نمی‌کرد و DbContext هم‌زمان استفاده می‌شد.
- `UserManagementAclService` در هر Scope یک `RestClient` جدید می‌ساخت که خطر اتمام سوکت‌ها را داشت.
- گاردها در **هر** جابجایی صفحه دو درخواست به سرور می‌فرستادند (`runGuardsAndResolvers: 'always'`).
- `HasPermissionDirective` در هر نمونه رشته‌ی دسترسی‌ها را با PapaParse پارس می‌کرد.
- `apexcharts` در `package.json` نبود و `ng-bootstrap 19` (مخصوص Angular 20) با Angular 21 ناسازگار بود.
- `environment.prod.ts` چند فیلد را نداشت.
- اجرای Job بستن خودکار، امضای «دبیر غیرعضو» را در نظر نمی‌گرفت.
- `BulkUpdate` تنظیمات هر مقداری را بدون اعتبارسنجی نوع ذخیره می‌کرد.

---

## ۴. نقش‌ها: حذف هاردکد

**قبل:** در بیش از ۸۰ جای فرانت و ۳۸ جای بک‌اند مقایسه‌هایی مثل `roleId === 3` یا `[1,2,3].includes(roleId)` وجود داشت.

**بعد:** هر نقش یک **کلید سیستمی** و مجموعه‌ای از **توانایی‌ها** دارد.

- **کلیدهای سیستمی:** رئیس، دبیر، دبیر غیرعضو، ناظر، عضو، مهمان، سفارشی.
- **توانایی‌ها (۲۳ مورد):** مثل مشاهده، ویرایش جلسه، مدیریت اعضا، دستور جلسه، حضور و غیاب، تغییر وضعیت، ثبت و حذف مصوبه، تخصیص، نگارش و امضای صورتجلسه، تأیید نهایی، جانشین، چاپ، دریافت اطلاع‌رسانی.
- **ویژگی‌های نقش:**
  - «یکتا در جلسه»
  - «عضو رسمی»: در صورتجلسه و حد نصاب شمرده می‌شود.
  - «امضای الزامی»
- **محل ذخیره:** ردیف `SystemSettings[MeetingRoleConfig = 15]` به‌صورت JSON. هنگام اولین اجرا، Seeder این ردیف را از روی **عنوان** نقش‌های موجود می‌سازد و پیش‌فرض‌ها دقیقاً همان رفتار فعلی است.
- **سمت سرور:**
  - کلاس `MeetingRoles` جای عددهای ثابت را گرفته است، مثل `MeetingRoles.ChairmanId`. داخل EF به پارامتر SQL تبدیل می‌شود.
  - `IMeetingAccessService` توانایی‌های کاربر روی جلسه را محاسبه می‌کند. عضویت مستقیم، عضو بدون سمت و جانشینی در نظر گرفته می‌شود.
- **سمت فرانت:**
  - `MeetingRoles.isChairman(...)`، `can(roleId, 'ManageAgenda')`، `isUnique`، `countsAsMember`
  - `MeetingAccessService.can('ManageResolutions')` و دایرکتیو `*meetingCan`
- **صفحه‌ی مدیریت:** تنظیمات › نقش‌ها و دسترسی‌ها، به‌صورت ماتریس نقش × توانایی همراه با هشدارهای منطقی.

> وضعیت‌های جلسه (1 تا 6) هم در بک‌اند در `MeetingStatusIds` متمرکز شدند. در فرانت هنوز عددی هستند؛ ادامه‌ی همین الگو در بخش ۱۰ آمده است.

---

## ۵. ارجاع تخصیص: تصمیم‌های طراحی

همه‌ی قوانین در `Assignment` (Domain) متمرکز شده‌اند و از همان ستون‌های موجود (`ActionStatus`، `Result`، `ResultDescription`، `Actions`) استفاده می‌کنند:

1. **فقط اقدام‌کننده‌ی فعلی** تخصیص (یا مدیر سامانه) می‌تواند ارجاع دهد. سمت عامل در سرور راستی‌آزمایی می‌شود.
2. **چند مورد ممنوع است:**
   - ارجاع به خود
   - ارجاع به هر کسی که در زنجیره‌ی بالاتر است (جلوگیری از چرخه)
   - ارجاع تکراری باز به یک نفر
3. **عمق** زنجیره محدود است. تنظیم «حداکثر عمق ارجاع» پیش‌فرض ۵ دارد.
4. **مهلت ارجاع** نباید در گذشته باشد و به‌طور پیش‌فرض نباید دیرتر از مهلت والد باشد (قابل تنظیم).
5. **بازگشت ارجاع:** ارجاع‌گیرنده کار را با شرح الزامی برمی‌گرداند. این شرح به‌صورت «اقدام» روی تخصیص والد ثبت می‌شود و ارجاع‌دهنده مطلع می‌شود.
6. **فراخوانی ارجاع:** ارجاع‌دهنده ارجاع را پس می‌گیرد. اگر کاری روی آن انجام نشده باشد حذف می‌شود، وگرنه با حفظ سابقه بسته می‌شود.
7. **بستن آبشاری:** با ثبت نتیجه روی تخصیص اصلی، همه‌ی ارجاع‌های باز زیرمجموعه بسته می‌شوند. این مورد قبلاً به‌صورت TODO مانده بود.
8. **ثبت اقدام** فقط توسط اقدام‌کننده و ثبت پیگیری فقط توسط پیگیری‌کننده انجام می‌شود. مدیر جلسه هم می‌تواند به نیابت ثبت کند.

APIهای جدید: `POST api/Assignment/ReturnReferral` و `POST api/Assignment/RecallReferral`.

---

## ۶. اطلاع‌رسانی (کامل روی جدول‌های موجود)

**معماری (Outbox):**
1. عملیات کاربر ← `INotificationPublisher.PublishAsync`
2. پیام‌ها **در همان تراکنش** در `NotificationLogs` با وضعیت `pending` ثبت می‌شوند.
3. `NotificationDispatchJob` (هر دقیقه) پیامک‌ها را ارسال می‌کند.
4. اعلان داخل سامانه در `Alarms/AlarmsReceivers` ثبت می‌شود.

**جزئیات:**
- **۱۵ رویداد:** ثبت جلسه، تغییر زمان، لغو، یادآوری، اعلام حضور، آماده‌ی امضا، نهایی‌شدن، جانشین، تخصیص مصوبه، ارجاع، یادآوری سررسید، تأخیر، ثبت اقدام، پایان تخصیص، بازگشت ارجاع.
- **تلاش مجدد:** با فاصله‌ی نمایی ۲، ۴، ۸ دقیقه و … تا سقف تنظیم‌شده. پس از آن وضعیت `failed` می‌شود.
- **ساعات سکوت پیامک:** ارسال به پایان بازه موکول می‌شود.
- **یادآوری‌ها** (`NotificationReminderJob`، هر ۱۰ دقیقه): بدون ستون جدید، با **Watermark** در `SystemSettings[27]` کار می‌کند تا هیچ یادآوری‌ای دو بار ارسال نشود.
- **قالب‌ها:** متغیرهایی مثل `{ReceiverName}`، `{MeetingTitle}`، `{MeetingDate}`، `{StartTime}`، `{Location}`، `{ResolutionNumber}`، `{DueDate}`، `{ActorName}`، `{ReferrerName}` و `{Link}`.
- **گیرندگان:** به‌طور پیش‌فرض بر اساس رویداد تعیین می‌شوند. سوییچ «همه اعضا» برای رویدادهای جلسه وجود دارد (خاموش یعنی فقط رئیس و دبیر). نقشی که توانایی «دریافت اطلاع‌رسانی» ندارد پیامی دریافت نمی‌کند. خودِ انجام‌دهنده‌ی عملیات پیام نمی‌گیرد.
- **موبایل گیرنده:** اولویت با موبایل عضو جلسه است، سپس جدول اعضای هیئت مدیره، سپس UserManagement.
- **⚠️ پیامک همه‌ی رویدادها پس از استقرار خاموش است.** این کار عمدی است تا پیامک انبوه ناخواسته ارسال نشود. از تنظیمات › رویدادها روشن کنید. اعلان داخل سامانه روشن است.
- **محدودیت اسکیمای فعلی Alarm:** کلید `AlarmsReceivers.Id` خودش FK به `Alarms.Id` است. بنابراین هر هشدار **دقیقاً یک گیرنده** دارد و برای هر گیرنده یک Alarm ساخته می‌شود. بدون تغییر اسکیما راه دیگری وجود ندارد.

**صفحه‌ی تنظیمات** (`/#/settings`):

| بخش | امکانات |
|---|---|
| عمومی / جلسات و مصوبات / هیئت مدیره | فرم داده‌محور. هر تنظیم جدیدی که در سرور Seed شود خودکار نمایش داده می‌شود. برای GUIDها انتخاب‌گر دسته‌بندی، سمت یا کاربر وجود دارد. |
| رویدادها | روشن و خاموش کردن پیامک و اعلان، «همه اعضا»، انتخاب قالب، آمار ۳۰ روز، عملیات گروهی |
| قالب پیام‌ها | ویرایشگر با درج متغیر در محل مکان‌نما، پیش‌نمایش زنده، شمارش کاراکتر و بخش پیامک، تشخیص متغیر ناشناخته |
| پیامک و زمان‌بندی | پنل، حالت آزمایشی، ساعات سکوت، تلاش مجدد، یادآوری‌ها، **پیامک آزمایشی** |
| گزارش ارسال | فیلتر وضعیت و رویداد، جزئیات خطا، **ارسال مجدد** |
| نقش‌ها و دسترسی‌ها | ماتریس توانایی‌ها |
| همه تنظیمات | جدول قبلی (نمای پیشرفته) |

**زنگوله‌ی اعلان** در هدر: هر ۶۰ ثانیه و فقط وقتی تب فعال است به‌روز می‌شود، با تغییر سمت دوباره بارگذاری می‌شود و گزینه‌ی «خواندن همه» دارد.

---

## ۷. احراز هویت: `oidc-client` ← `oidc-client-ts`

- **روش ورود:** Authorization Code با **PKCE** و بدون secret. این با پیکربندی فعلی SSO سازگار است (`RequireClientSecret=false`، `RedirectUris={Url}/challenge`).
- **پردازش callback** در `APP_INITIALIZER` انجام می‌شود و هر دو آدرس `/challenge` و `/#/challenge` پشتیبانی می‌شوند. مسیر قبلی کاربر بعد از ورود حفظ می‌شود و جلوی حلقه‌ی ورود گرفته شده است.
- **لایه‌ی سازگاری:** `CodeFlowService` و `PasswordFlowService` حفظ شده‌اند، چون حدود ۴۰ فایل از آن‌ها استفاده می‌کنند. کد جدید مستقیماً از `AuthService` و `SessionStore` استفاده کند.
- **`SessionStore`** (مبتنی بر signal) همیشه با localStorage هم‌گام است. سوییچ سمت و تفویض در هدر بدون تغییر کار می‌کند.
- **دسترسی‌ها** از claim `permission` داخل توکن خوانده می‌شوند. در حالت تفویض از API گرفته می‌شوند.
- **گاردها:** بررسی نشست SSO حداکثر هر ۲ دقیقه یک بار انجام می‌شود و خطای شبکه کاربر را بیرون نمی‌اندازد. دسترسی به سامانه در هر بارگذاری فقط یک بار بررسی می‌شود. `permissionGuard('...')` برای مسیرها اضافه شد.
- **Interceptorها (functional):**
  - validation ← loading ← auth ← error
  - توکن **فقط** به APIهای خودمان فرستاده می‌شود.
  - هدرهای `X-Position-Guid` و `X-Acting-User` ارسال می‌شوند. سرور آن‌ها را با `GetActiveDelegationsForDelegatee` در UserManagement راستی‌آزمایی می‌کند و نتیجه را ۱۰ دقیقه کش می‌کند.
  - خطای 401 به ورود مجدد می‌رود و 403 فقط پیام نمایش می‌دهد.
- **Silent renew خاموش است**، چون در SSO آدرس silent ثبت نشده و Refresh Token هم فعال نیست. با انقضای توکن، کاربر با حفظ صفحه به SSO می‌رود و به‌دلیل معتبر بودن کوکی SSO رمز نمی‌خواهد.

---

## ۸. مراحل استقرار

1. **پشتیبان دیتابیس** بگیرید. با اینکه اسکیما تغییر نمی‌کند، Seeder ردیف‌های داده اضافه می‌کند.
2. **رمز `sa` را عوض کنید.** رشته‌ی اتصال را در `appsettings.Production.json` روی سرور یا در متغیر محیطی `ConnectionStrings__Application` قرار دهید.
3. **SSO:**
   - برای کلاینت `MeetManage` مطمئن شوید `RedirectUris` برابر `http://meeting.epciran.ir/challenge` و `PostLogoutRedirectUris` برابر آدرس پایه است.
   - برای اطلاع‌رسانی در Jobها (یادآوری‌ها) گزینه‌ی **HasS2S** سیستم را فعال کنید و `S2S:ClientSecret` را در appsettings قرار دهید. بدون این تنظیم، یادآوری‌ها فقط برای اعضایی که موبایلشان در جلسه ثبت شده ارسال می‌شود.
4. **بک‌اند:**
   - `dotnet build`، سپس انتشار.
   - در اولین اجرا لاگ‌های `Meeting role configuration seeded` و `Seeded … notification events` را ببینید.
   - ردیف‌های 15، 16 و 27 باید در `SystemSettings` ساخته شوند.
5. **فرانت:**
   - `npm ci`، سپس `npx ng build`.
   - روی IIS ماژول **URL Rewrite** باید نصب باشد. `web.config` در `public/` قرار دارد و خودکار در خروجی کپی می‌شود.
6. **تنظیمات اولیه در سامانه:**
   - تنظیمات › عمومی: «آدرس عمومی سامانه» را برای لینک‌های داخل پیامک وارد کنید.
   - تنظیمات › پیامک: آدرس پنل را بررسی کنید و یک **پیامک آزمایشی** بفرستید.
   - تنظیمات › رویدادها: پیامک رویدادهای مورد نظر را روشن کنید.
   - تنظیمات › نقش‌ها: ماتریس را بازبینی کنید.

---

## ۹. چک‌لیست تست

- [ ] ورود و خروج، بازگشت به همان صفحه بعد از ورود، و ورود دوباره پس از انقضای توکن
- [ ] سوییچ سمت و تفویض در هدر. منوها و دسترسی‌ها باید فوراً عوض شوند.
- [ ] ثبت مصوبه‌ی عادی در حالی که تب «ویرایش جلسه» هم در صفحه است (سناریوی باگ اصلی)
- [ ] ثبت مصوبه برای کاربر **بدون سمت**
- [ ] ویرایش یک مصوبه دو بار پشت سر هم، سپس بستن با Esc و «ثبت جدید». فرم باید خالی باشد.
- [ ] ویرایش شرح مصوبه‌ی هیئت مدیره، که باید ذخیره و نمایش داده شود.
- [ ] حذف تخصیصی که اقدام دارد. باید پیام قابل فهم بدهد، نه خطای 500.
- [ ] ارجاع ← ارجاع دوباره ← تلاش برای ارجاع به خودِ ارجاع‌دهنده (باید رد شود) ← بازگشت ارجاع ← ثبت نتیجه روی تخصیص اصلی (ارجاع‌های باز باید بسته شوند)
- [ ] کاربر عادی: درخواست مستقیم به `api/Resolution/CreateOrEdit` برای جلسه‌ای که در آن نقش ندارد باید رد شود.
- [ ] کاربر بدون `MT_Settings`: باز کردن مستقیم `/#/settings` باید به داشبورد برگردد.
- [ ] رویداد «ثبت جلسه» با پیامک روشن و دکمه‌ی «ثبت و ارسال». لاگ ارسال باید `sent` نشان دهد. با قطع پنل پیامک، وضعیت باید `retry` شود و جلسه همچنان ثبت شود.
- [ ] یادآوری جلسه: جلسه‌ای برای ۲۴ ساعت بعد بسازید و چند دقیقه صبر کنید.

---

## ۱۰. کارهای باقی‌مانده

1. **کنترل دسترسی سمت سرور در بقیه‌ی handlerها:** اعضا، دستور جلسه، حضور و غیاب، صورتجلسه و امضا. الگو آماده است:
   ```csharp
   var access = await accessService.GetAsync(meetingGuid);
   if (!access.Can(MeetingCapability.ManageAgenda))
       return Result<bool>.Failure(false, MeetingAccess.DeniedMessage(MeetingCapability.ManageAgenda));
   ```
2. **وضعیت‌های جلسه در فرانت** (`statusId === 2` و مانند آن): با همان الگوی `MeetingStatusIds` متمرکز شوند. استفاده از `access().workflowSteps`، `hasAttendance` و `hasMinutes` که API برمی‌گرداند، تفاوت هیئت مدیره و جلسه‌ی عادی را از کامپوننت‌ها خارج می‌کند.
3. **هیئت مدیره:** `MeetingKinds` و `MeetingWorkflow` در بک‌اند ساخته شده‌اند (مراحل، قفل محتوا، داشتن حضور و غیاب و صورتجلسه) و در `MeetingAccess` برمی‌گردند. ۳۳ مقایسه‌ی `BoardCategoryGuid` در Query handlerها هنوز باید به `MeetingKinds.Of(...)` منتقل شوند.
4. **شکستن کامپوننت‌های بزرگ:** `meeting-ops` (۲۱۱۴ خط)، `meeting-participants` (۱۹۳۴)، `file-manager` (۱۸۶۵) و `resolution-form` (۱۷۶۰). پیشنهاد: یک Store سرویسی (signal) برای هر صفحه، زیرکامپوننت‌های presentational، و انتقال mapperها به توابع خالص.
5. **متدهای مرده:** در `assignment.service.ts` حدود ۱۰ متد APIهایی را صدا می‌زنند که در بک‌اند وجود ندارند (`SearchAssignments`، `MarkAsViewed`، `BulkUpdateAssignmentStatus` و …).
6. **حجم bundle اولیه ۳٫۹ مگابایت است:** `AppShell`، `Dashboard` و کامپوننت‌های سنگین را lazy کنید و `ag-grid` را فقط در مسیرهای لازم بارگذاری کنید.
