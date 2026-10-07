using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace MeetingManagement.Infrastructure.Configuration.Notifications;

/// <summary>جایگذاری {Placeholder} ها در متن قالب. placeholder ناشناخته حذف می‌شود.</summary>
public static partial class NotificationTemplateRenderer
{
    [GeneratedRegex(@"\{(?<key>[A-Za-z]+)\}")]
    private static partial Regex PlaceholderRegex();

    [GeneratedRegex(@"[ \t]{2,}")]
    private static partial Regex MultiSpace();

    public static string Render(string template, IReadOnlyDictionary<string, string?> values)
    {
        if (string.IsNullOrEmpty(template)) return string.Empty;

        var result = PlaceholderRegex().Replace(template, m =>
            values.TryGetValue(m.Groups["key"].Value, out var v) ? v ?? string.Empty : string.Empty);

        return MultiSpace().Replace(result, " ").Trim();
    }

    /// <summary>تعداد بخش‌های پیامک فارسی (UCS-2: ۷۰ کاراکتر تک‌بخشی، ۶۷ کاراکتر در چندبخشی).</summary>
    public static int SmsParts(string text) =>
        string.IsNullOrEmpty(text) ? 0 : text.Length <= 70 ? 1 : (int)Math.Ceiling(text.Length / 67d);

    public static string NormalizeMobile(string? mobile)
    {
        if (string.IsNullOrWhiteSpace(mobile)) return string.Empty;
        var digits = new string(mobile
            .Select(ch => ch is >= '۰' and <= '۹' ? (char)('0' + (ch - '۰')) : ch is >= '٠' and <= '٩' ? (char)('0' + (ch - '٠')) : ch)
            .Where(char.IsDigit).ToArray());

        if (digits.StartsWith("0098")) digits = "0" + digits[4..];
        else if (digits.StartsWith("98") && digits.Length == 12) digits = "0" + digits[2..];
        else if (digits.Length == 10 && digits.StartsWith('9')) digits = "0" + digits;

        return digits.Length == 11 && digits.StartsWith("09") ? digits : string.Empty;
    }
}
