-- ═══════════════════════════════════════════════════════════════════════
-- دسترسی‌های جدید سامانه نظرسنجی (SystemId = 2) — شناسه‌ها صریح (515 و 516)
-- قابل اجرای چندباره: هر ردیف فقط اگر شناسه یا عنوان آن وجود نداشته باشد درج می‌شود.
--   SV_Admin        → مدیر سامانه نظرسنجی: دسترسی کامل به همه‌ی نظرسنجی‌ها، پاسخ‌ها و نتایج
--                      (بدون آن هر کاربر فقط نظرسنجی‌های خودش و آن‌هایی که در فهرست دسترسی‌شان است را می‌بیند؛
--                       از راه تفویض منتقل نمی‌شود)
--   SV_Impersonate  → «ورود به جای کاربر» در سامانه نظرسنجی
-- ═══════════════════════════════════════════════════════════════════════
USE [UserManagement]
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 515 OR ([Title] = N'SV_Admin' AND [SystemId] = 2))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (515, 131, N'SV_Admin', N'مدیر سامانه نظرسنجی (دسترسی کامل)', 0, 2, NULL, 0, N'de3c80f2-767d-4947-9cb6-5768ff31c745')
GO
IF NOT EXISTS (SELECT 1 FROM [dbo].[Permissions] WHERE [Id] = 516 OR ([Title] = N'SV_Impersonate' AND [SystemId] = 2))
    INSERT [dbo].[Permissions] ([Id], [ParentId], [Title], [Name], [Sort], [SystemId], [ClassificationLevelId], [IsPage], [Guid]) VALUES (516, 131, N'SV_Impersonate', N'ورود به جای کاربر', 20, 2, NULL, 0, N'796de21c-6a6e-4449-a19d-b094ce8bc92b')
GO
