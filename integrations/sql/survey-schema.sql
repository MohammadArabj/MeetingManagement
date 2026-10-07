-- ═══════════════════════════════════════════════════════════════════════
-- تغییرات اسکیمای سامانه نظرسنجی (معادل Migration های EF در Survey/…Persistence/Migrations)
-- اگر با dotnet ef database update به‌روزرسانی می‌کنید، این فایل لازم نیست.
-- قابل اجرای چندباره.
-- ═══════════════════════════════════════════════════════════════════════
USE [SurveyManagement]
GO

-- 20261007172050_AddSurveyCompletionEffect: جلوه‌ی صفحه‌ی تشکر (confetti/fireworks/balloons/stars/hearts/ribbons/none)
IF COL_LENGTH(N'dbo.Surveys', N'CompletionEffect') IS NULL
    ALTER TABLE [dbo].[Surveys] ADD [CompletionEffect] nvarchar(30) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM [dbo].[__EFMigrationsHistory] WHERE [MigrationId] = N'20261007172050_AddSurveyCompletionEffect')
    INSERT INTO [dbo].[__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20261007172050_AddSurveyCompletionEffect', N'10.0.11');
GO
