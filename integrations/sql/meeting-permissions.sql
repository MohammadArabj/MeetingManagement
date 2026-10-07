-- ═══════════════════════════════════════════════════════════════════════
-- دسترسی‌های جدید سامانه مدیریت جلسات (SystemId = 7) — شناسه‌ها صریح (503 تا 514)
-- قابل اجرای چندباره: هر ردیف فقط اگر شناسه یا عنوان آن وجود نداشته باشد درج می‌شود.
-- پس از اجرا، در UserManagement این دسترسی‌ها را به سمت‌ها/گروه‌های مربوط بدهید:
--   MT_Admin              → سمت «ادمین مدیریت جلسات» (دسترسی کامل در همه‌ی وضعیت‌ها؛ از راه تفویض منتقل نمی‌شود)
--   MT_Board_ViewAll      → دبیرخانه/مدیران مجاز به دیدن همه‌ی جلسات هیئت مدیره (حتی ادمین هم بدون آن نمی‌بیند)
--   MT_Impersonate        → پشتیبانی: «ورود به جای کاربر» (بدون امکان امضا)
--   MT_PrintTemplates     → طراحی سربرگ و قالب‌های چاپ
--   MT_Archive            → منوی بایگانی (جلسات اتمام‌یافته)
-- ═══════════════════════════════════════════════════════════════════════
USE [UserManagement]
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 503 OR ([Title] = N'MT_Admin' AND [SystemId] = 7))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (503, 132, N'MT_Admin', N'ادمین مدیریت جلسات (دسترسی کامل)', 0, 7, NULL, 0, N'15a6bbf7-d9a4-4dd5-8480-5640e6d60327')
GO
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 504 OR ([Title] = N'MT_Board_ViewAll' AND [SystemId] = 7))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (504, 50, N'MT_Board_ViewAll', N'مشاهده همه جلسات هیئت مدیره', 2, 7, NULL, 0, N'aa3f5fa5-b062-43f5-abc9-aae505980ddc')
GO
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 505 OR ([Title] = N'MT_Archive' AND [SystemId] = 7))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (505, 132, N'MT_Archive', N'بایگانی جلسات', 21, 7, NULL, 1, N'3f5aa3ec-dd2e-4dc3-9f6c-93c898302e35')
GO
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 506 OR ([Title] = N'MT_Impersonate' AND [SystemId] = 7))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (506, 28, N'MT_Impersonate', N'ورود به جای کاربر', 6, 7, NULL, 0, N'8bba1371-ac5e-48ce-ac63-326e7fe9279f')
GO
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 507 OR ([Title] = N'MT_PrintTemplates' AND [SystemId] = 7))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (507, 28, N'MT_PrintTemplates', N'چاپ و قالب‌ها', 7, 7, NULL, 1, N'b8de9504-ec20-44b2-b8ac-1c9b248a5d5b')
GO
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 508 OR ([Title] = N'MT_NotificationTemplates' AND [SystemId] = 7))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (508, 28, N'MT_NotificationTemplates', N'قالب‌های اطلاع‌رسانی', 8, 7, NULL, 1, N'5ab1f912-2442-41f8-9e2b-472806f3cc11')
GO
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 509 OR ([Title] = N'MT_NotificationTemplates_Add' AND [SystemId] = 7))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (509, 508, N'MT_NotificationTemplates_Add', N'جدید', 1, 7, NULL, 0, N'82943230-0c2d-4285-8601-a9652dfacd9e')
GO
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 510 OR ([Title] = N'MT_NotificationTemplates_Edit' AND [SystemId] = 7))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (510, 508, N'MT_NotificationTemplates_Edit', N'ویرایش', 2, 7, NULL, 0, N'5797405e-4929-4a70-8e36-9fe579f76019')
GO
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 511 OR ([Title] = N'MT_NotificationTemplates_Delete' AND [SystemId] = 7))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (511, 508, N'MT_NotificationTemplates_Delete', N'حذف', 3, 7, NULL, 0, N'f2553c3d-bb05-47da-8f24-9525cd7559ae')
GO
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 512 OR ([Title] = N'MT_NotificationTemplates_ToggleActive' AND [SystemId] = 7))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (512, 508, N'MT_NotificationTemplates_ToggleActive', N'فعال/غیرفعال کردن', 4, 7, NULL, 0, N'faaee3e2-b900-4956-8f9e-fc7f857a7e15')
GO
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 513 OR ([Title] = N'MT_UserRoles_Delete' AND [SystemId] = 7))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (513, 32, N'MT_UserRoles_Delete', N'حذف', 4, 7, NULL, 0, N'7c800dc7-1bfb-4154-a981-1405c80b0478')
GO
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 514 OR ([Title] = N'MT_UserRoles_ToggleActive' AND [SystemId] = 7))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (514, 32, N'MT_UserRoles_ToggleActive', N'فعال/غیرفعال کردن', 5, 7, NULL, 0, N'ecffea2e-1d0a-489f-ac64-c280c40ea80e')
GO
