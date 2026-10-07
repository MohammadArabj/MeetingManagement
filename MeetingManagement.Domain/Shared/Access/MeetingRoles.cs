using System.Text.Json;
using System.Text.Json.Serialization;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Domain.Shared.Access;

/// <summary>
/// تعریف یک نقش جلسه: کلید معنایی + توانایی‌ها + ویژگی‌ها.
/// در ردیف <see cref="SettingKey.MeetingRoleConfig"/> جدول SystemSettings به‌صورت JSON فشرده ذخیره می‌شود
/// (بدون هیچ تغییری در اسکیمای جدول Roles).
/// </summary>
public sealed class MeetingRoleDefinition
{
    /// <summary>شناسه ردیف در جدول Roles</summary>
    [JsonPropertyName("id")] public int RoleId { get; set; }

    /// <summary>کلید معنایی</summary>
    [JsonPropertyName("k")] public MeetingRoleKey Key { get; set; }

    /// <summary>توانایی‌ها</summary>
    [JsonPropertyName("c")] public MeetingCapability Capabilities { get; set; }

    /// <summary>در هر جلسه فقط یک نفر می‌تواند این نقش را داشته باشد</summary>
    [JsonPropertyName("u")] public bool IsUnique { get; set; }

    /// <summary>در فهرست «اعضای حاضر/غایب» صورتجلسه و حد نصاب شمرده می‌شود</summary>
    [JsonPropertyName("m")] public bool CountsAsMember { get; set; }

    /// <summary>ترتیب نمایش</summary>
    [JsonPropertyName("o")] public int Order { get; set; }

    public bool Has(MeetingCapability capability) => (Capabilities & capability) == capability;

    public MeetingRoleDefinition Clone() => (MeetingRoleDefinition)MemberwiseClone();
}

/// <summary>
/// رجیستری سراسری نقش‌ها.
/// ─────────────────────────────────────────────────────────────────────────
/// به‌جای «RoleId == 3» از «MeetingRoles.ChairmanId» یا «MeetingRoles.Is(roleId, MeetingRoleKey.Chairman)»
/// استفاده کنید. ویژگی‌های Id به‌صورت int ساده هستند تا داخل عبارت‌های EF Core
/// به پارامتر SQL تبدیل شوند (بدون ارزیابی سمت کلاینت).
/// </summary>
public static class MeetingRoles
{
    private static readonly object Sync = new();
    private static volatile IReadOnlyList<MeetingRoleDefinition> _roles = Defaults();

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingDefault,
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>شناسه‌ای که هیچ ردیفی ندارد (برای نقشی که تعریف نشده).</summary>
    public const int NotDefined = -1;

    // ── شناسه‌های نقش‌های اصلی (برای استفاده در Query ها) ─────────────
    public static int ChairmanId => IdOf(MeetingRoleKey.Chairman);
    public static int SecretaryId => IdOf(MeetingRoleKey.Secretary);
    public static int NonMemberSecretaryId => IdOf(MeetingRoleKey.NonMemberSecretary);
    public static int ObserverId => IdOf(MeetingRoleKey.Observer);
    public static int MemberId => IdOf(MeetingRoleKey.Member);
    public static int GuestId => IdOf(MeetingRoleKey.Guest);

    public static IReadOnlyList<MeetingRoleDefinition> All => _roles;

    public static int IdOf(MeetingRoleKey key) =>
        _roles.FirstOrDefault(r => r.Key == key)?.RoleId ?? NotDefined;

    public static MeetingRoleDefinition? Get(int? roleId) =>
        roleId is null ? null : _roles.FirstOrDefault(r => r.RoleId == roleId.Value);

    public static MeetingRoleKey KeyOf(int? roleId) => Get(roleId)?.Key ?? MeetingRoleKey.Custom;

    public static MeetingCapability CapabilitiesOf(int? roleId) => Get(roleId)?.Capabilities ?? MeetingCapability.None;

    public static bool Is(int? roleId, MeetingRoleKey key) => roleId is not null && KeyOf(roleId) == key && IdOf(key) == roleId;

    public static bool IsAny(int? roleId, params MeetingRoleKey[] keys) => keys.Any(k => Is(roleId, k));

    /// <summary>دبیر یا دبیر غیرعضو</summary>
    public static bool IsAnySecretary(int? roleId) => IsAny(roleId, MeetingRoleKey.Secretary, MeetingRoleKey.NonMemberSecretary);

    public static bool CountsAsMember(int? roleId) => Get(roleId)?.CountsAsMember ?? false;

    public static int[] MemberRoleIds => _roles.Where(r => r.CountsAsMember).Select(r => r.RoleId).ToArray();

    /// <summary>نقش‌هایی که در فهرست جلسات به‌عنوان «اعضای کلیدی» نمایش داده می‌شوند (رئیس و دبیرها)</summary>
    public static int[] KeyRoleIds => new[] { ChairmanId, SecretaryId, NonMemberSecretaryId }.Where(x => x != NotDefined).ToArray();

    // ── بارگذاری/ذخیره ───────────────────────────────────────────────

    /// <summary>بارگذاری از JSON ذخیره‌شده؛ در صورت خالی یا نامعتبر بودن، پیش‌فرض‌ها استفاده می‌شوند.</summary>
    public static void Load(string? json)
    {
        var parsed = TryParse(json);
        lock (Sync)
        {
            _roles = parsed is { Count: > 0 } ? parsed : Defaults();
        }
    }

    public static List<MeetingRoleDefinition>? TryParse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<List<MeetingRoleDefinition>>(json, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static string Serialize(IEnumerable<MeetingRoleDefinition> roles) =>
        JsonSerializer.Serialize(roles.OrderBy(r => r.Order).ThenBy(r => r.RoleId), JsonOptions);

    /// <summary>
    /// اعتبارسنجی پیکربندی: هر کلید سیستمی حداکثر یک بار، و نقش‌های رئیس/دبیر باید وجود داشته باشند.
    /// </summary>
    public static IReadOnlyList<string> Validate(IReadOnlyCollection<MeetingRoleDefinition> roles)
    {
        var errors = new List<string>();

        var duplicatedKeys = roles.Where(r => r.Key != MeetingRoleKey.Custom)
            .GroupBy(r => r.Key).Where(g => g.Count() > 1).Select(g => g.Key);
        foreach (var key in duplicatedKeys)
            errors.Add($"نقش سیستمی «{key.GetDescription()}» به بیش از یک نقش تخصیص داده شده است.");

        if (roles.GroupBy(r => r.RoleId).Any(g => g.Count() > 1))
            errors.Add("یک نقش بیش از یک بار تعریف شده است.");

        if (roles.All(r => r.Key != MeetingRoleKey.Chairman))
            errors.Add("نقش «رئیس» باید به یکی از نقش‌ها نسبت داده شود.");

        if (roles.All(r => r.Key != MeetingRoleKey.Secretary && r.Key != MeetingRoleKey.NonMemberSecretary))
            errors.Add("حداقل یکی از نقش‌های «دبیر» یا «دبیر غیرعضو» باید تعریف شود.");

        if (Serialize(roles).Length > 1000)
            errors.Add("تعداد نقش‌ها بیش از ظرفیت ذخیره‌سازی است (حداکثر حدود ۲۰ نقش).");

        return errors;
    }

    /// <summary>توانایی‌های پیش‌فرض هر کلید سیستمی (برای نقش جدید یا بازنشانی).</summary>
    public static MeetingCapability DefaultCapabilities(MeetingRoleKey key) => key switch
    {
        MeetingRoleKey.Chairman =>
            MeetingCapability.ViewAll | MeetingCapability.ManageAll | MeetingCapability.SignMinutes
            | MeetingCapability.FinalApprove | MeetingCapability.CommentOnMinutes | MeetingCapability.AppointSubstitute
            | MeetingCapability.Print | MeetingCapability.ReceiveNotifications,

        MeetingRoleKey.Secretary or MeetingRoleKey.NonMemberSecretary =>
            MeetingCapability.ViewAll | MeetingCapability.ManageAll | MeetingCapability.SignMinutes
            | MeetingCapability.CommentOnMinutes | MeetingCapability.AppointSubstitute | MeetingCapability.Print
            | MeetingCapability.ReceiveNotifications,

        MeetingRoleKey.Observer =>
            MeetingCapability.ViewAll | MeetingCapability.CommentOnMinutes | MeetingCapability.Print
            | MeetingCapability.ReceiveNotifications,

        MeetingRoleKey.Member =>
            MeetingCapability.ViewAll | MeetingCapability.SignMinutes | MeetingCapability.CommentOnMinutes
            | MeetingCapability.AppointSubstitute | MeetingCapability.Print | MeetingCapability.ReceiveNotifications,

        MeetingRoleKey.Guest =>
            MeetingCapability.ViewMeeting | MeetingCapability.ViewAgenda | MeetingCapability.ReceiveNotifications,

        _ => MeetingCapability.ViewMeeting | MeetingCapability.ViewAgenda | MeetingCapability.ReceiveNotifications,
    };

    public static MeetingRoleDefinition CreateDefault(int roleId, MeetingRoleKey key, int order) => new()
    {
        RoleId = roleId,
        Key = key,
        Capabilities = DefaultCapabilities(key),
        IsUnique = key is MeetingRoleKey.Chairman or MeetingRoleKey.Secretary or MeetingRoleKey.NonMemberSecretary,
        CountsAsMember = key is MeetingRoleKey.Chairman or MeetingRoleKey.Secretary or MeetingRoleKey.Member or MeetingRoleKey.Observer,
        Order = order,
    };

    /// <summary>
    /// پیش‌فرض‌ها = قرارداد فعلی پروژه (1 دبیر، 2 دبیر غیرعضو، 3 رئیس، 4 ناظر، 5 عضو، 6 مهمان).
    /// فقط تا زمانی استفاده می‌شوند که ردیف تنظیمات ساخته شود (Seeder در شروع برنامه آن را می‌سازد).
    /// </summary>
    public static IReadOnlyList<MeetingRoleDefinition> Defaults() =>
    [
        CreateDefault(3, MeetingRoleKey.Chairman, 1),
        CreateDefault(1, MeetingRoleKey.Secretary, 2),
        CreateDefault(2, MeetingRoleKey.NonMemberSecretary, 3),
        CreateDefault(4, MeetingRoleKey.Observer, 4),
        CreateDefault(5, MeetingRoleKey.Member, 5),
        CreateDefault(6, MeetingRoleKey.Guest, 6),
    ];
}
