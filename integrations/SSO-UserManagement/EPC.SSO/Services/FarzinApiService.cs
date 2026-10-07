using System.Security.Cryptography;

namespace EPC.SSO.Services;

/// <summary>
/// بازنشانی رمز فرزین و ارسال رمز جدید با پیامک.
///  • اگر شماره همراه ثبت نشده باشد، رمز اصلاً بازنشانی نمی‌شود (قبلاً رمز عوض می‌شد و پیامک به "" می‌رفت
///    و کاربر از فرزین بیرون می‌ماند).
///  • رمز با RandomNumberGenerator ساخته می‌شود (System.Random قابل پیش‌بینی است).
///  • خطای شبکه/Timeout به پیام مناسب تبدیل می‌شود (قبلاً 500).
///  • پیامک با کلاینت SmsClient و قرارداد سرویس پیامک (Number) ارسال می‌شود؛ Phone هم برای سازگاری فرستاده می‌شود.
/// </summary>
public class FarzinApiService(IHttpClientFactory httpClientFactory, IConfiguration configuration, ILogger<FarzinApiService> logger)
{
    private const string PasswordChars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#";

    private readonly string _farzinBase = configuration["ExternalApis:FarzinApi:BaseUrl"] ?? string.Empty;
    private readonly string _smsBase = configuration["ExternalApis:SmsApi:BaseUrl"] ?? string.Empty;

    /// <summary>رمز رندوم می‌سازد، در فرزین بازنشانی می‌کند و پیامک می‌فرستد</summary>
    public async Task<(bool success, string message)> ResetAndNotifyAsync(
        string personnelCode, string phone, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return (false, "شماره همراه شما ثبت نشده است؛ لطفاً با راهبر سیستم تماس بگیرید.");
        if (string.IsNullOrWhiteSpace(_farzinBase) || string.IsNullOrWhiteSpace(_smsBase))
            return (false, "سرویس بازنشانی رمز فرزین تنظیم نشده است.");

        var password = RandomNumberGenerator.GetString(PasswordChars, 10);

        // ─── ۱. بازنشانی رمز فرزین ──────────────────────────────────────
        try
        {
            var farzin = httpClientFactory.CreateClient(Infrastructure.HttpClientSetup.FarzinClient);
            using var resetResp = await farzin.PostAsJsonAsync(
                $"{_farzinBase.TrimEnd('/')}/api/AuthApi/ResetPassword",
                new { UserName = personnelCode, Password = password }, cancellationToken);

            if (!resetResp.IsSuccessStatusCode)
                return (false, "خطا در بازنشانی رمز فرزین");
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogError(ex, "[Farzin] بازنشانی رمز {PersonnelCode} ناموفق بود", personnelCode);
            return (false, "ارتباط با سامانه فرزین برقرار نشد");
        }

        // ─── ۲. ارسال پیامک ──────────────────────────────────────────
        try
        {
            var sms = httpClientFactory.CreateClient(Infrastructure.HttpClientSetup.SmsClient);
            using var smsResp = await sms.PostAsJsonAsync(
                $"{_smsBase.TrimEnd('/')}/api/SmsApi/SendSmsPost",
                new { Number = phone, Phone = phone, Text = $"رمز جدید فرزین شما: {password}" }, cancellationToken);

            if (!smsResp.IsSuccessStatusCode)
                return (false, "رمز بازنشانی شد اما ارسال پیامک با خطا مواجه شد");
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogError(ex, "[Farzin] ارسال پیامک رمز {PersonnelCode} ناموفق بود", personnelCode);
            return (false, "رمز بازنشانی شد اما ارسال پیامک با خطا مواجه شد");
        }

        return (true, "رمز فرزین با موفقیت بازنشانی شد و پیامک ارسال گردید");
    }
}
