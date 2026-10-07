using EPC.SSO.Models;
using EPC.SSO.Quickstart.Grants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Diagnostics;
using System.Security.Cryptography;

namespace EPC.SSO.Services;

public class OtherProgramService(
    IDbContextFactory<PortalDbContext> ctxFactory,
    EPC.SSO.Infrastructure.IAppCache cache,
    ILogger<OtherProgramService> logger)
{
    private const string CacheKey = "portal_other_programs_v2";   // v2: شکل مدل عوض شد

    private static OtherProgramKind Classify(string? address, bool? isSso)
    {
        address = address?.Trim() ?? "";
        if (address.StartsWith(@"\\")) return OtherProgramKind.Windows;
        return isSso == true ? OtherProgramKind.WebSso : OtherProgramKind.Web;
    }

    public async Task<List<OtherProgramViewModel>> GetAllAsync()
        => await cache.GetOrCreateAsync(CacheKey, LoadAsync, TimeSpan.FromMinutes(30), TimeSpan.FromHours(24)) ?? [];

    private async Task<List<OtherProgramViewModel>?> LoadAsync(CancellationToken ct)
    {
        await using var ctx = await ctxFactory.CreateDbContextAsync(ct);
        var rows = await ctx.OtherPrograms
            .AsNoTracking()
            .OrderBy(x => x.Level)
            .Select(x => new { x.PK_OtherProgram, x.OtherProgramName, x.OtherProgramAddress, x.Level, x.IsFirst, x.IsSSO })
            .ToListAsync(ct);

        return rows.Select(x => new OtherProgramViewModel
        {
            Id = x.PK_OtherProgram,
            Name = x.OtherProgramName ?? "بدون نام",
            Level = x.Level ?? 0,
            IsFirst = x.IsFirst ?? false,
            Kind = Classify(x.OtherProgramAddress, x.IsSSO)
        }).ToList();
    }

    /// آماده‌سازی اجرا: نوع را از DB تشخیص می‌دهد (نه از کلاینت)، برای SSO بلیط می‌سازد و ذخیره می‌کند.
    public async Task<OtherProgramLaunchResult> PrepareLaunchAsync(int id, string personnelCode, CancellationToken ct)
    {
        await using var ctx = await ctxFactory.CreateDbContextAsync(ct);
        var p = await ctx.OtherPrograms.AsNoTracking().FirstOrDefaultAsync(x => x.PK_OtherProgram == id, ct);
        if (p is null) return new(false, Message: "برنامه یافت نشد.");

        var address = p.OtherProgramAddress?.Trim() ?? "";
        if (address.Length == 0) return new(false, Message: "آدرس این برنامه تعریف نشده است.");

        switch (Classify(address, p.IsSSO))
        {
            case OtherProgramKind.Windows:
                // Launcher خودش آدرس را از DB می‌خواند؛ مسیر UNC در URL پروتکل نمی‌آید
                return new(true, "win", $"portalapp://launchother/{id}/{Uri.EscapeDataString(personnelCode)}");

            case OtherProgramKind.Web:
                return IsHttp(address) ? new(true, "web", address) : new(false, Message: "آدرس برنامه نامعتبر است.");

            default: // WebSso
                if (string.IsNullOrWhiteSpace(p.SSOAddress))
                    return new(false, Message: "آدرس ورود یکپارچه (SSO) تعریف نشده است.");

                var ticket = await IssueTicketAsync(ctx, personnelCode, ct);
                if (ticket is null) return new(false, Message: "صدور بلیط امنیتی ناموفق بود.");

                var url = Combine(address, p.SSOAddress.Trim())
                    .Replace(":p1", Uri.EscapeDataString(personnelCode))
                    .Replace(":p2", Uri.EscapeDataString(ticket));

                return IsHttp(url) ? new(true, "web", url) : new(false, Message: "آدرس نهایی نامعتبر است.");
        }
    }

    private static async Task<string?> IssueTicketAsync(PortalDbContext ctx, string personnelCode, CancellationToken ct)
    {
        if (!int.TryParse(personnelCode, out var pc)) return null;

        var ticket = RandomNumberGenerator.GetInt32(10000, 100000).ToString();   // ۵ رقم، CSPRNG
        var rows = await ctx.SYSTEM21
            .Where(x => x.Personeli_Number == pc)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RandomNumber, ticket), ct);

        return rows > 0 ? ticket : null;
    }

    private static string Combine(string address, string sso)
    {
        if (sso.StartsWith("http", StringComparison.OrdinalIgnoreCase)) return sso;
        if (sso.StartsWith('?') || sso.StartsWith('#') ||
            address.EndsWith('?') || address.EndsWith('&') || address.EndsWith('='))
            return address + sso;
        return address.TrimEnd('/') + "/" + sso.TrimStart('/');
    }

    private static bool IsHttp(string s) =>
        Uri.TryCreate(s, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps);
}