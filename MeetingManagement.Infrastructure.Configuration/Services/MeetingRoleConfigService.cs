using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Configuration.Services;

// ═══════════════════════════════════════════════════════════
// مدل‌های API
// ═══════════════════════════════════════════════════════════
public sealed class CapabilityInfo
{
    public string Name { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
}

public sealed class RoleKeyInfo
{
    public byte Value { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
}

public sealed class RoleDefinitionModel
{
    public int RoleId { get; set; }
    public string? Title { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; }

    /// <summary>نام کلید سیستمی (Chairman, Secretary, ...)</summary>
    public string Key { get; set; } = nameof(MeetingRoleKey.Custom);

    /// <summary>
    /// نام توانایی‌ها (نه عدد) — چون عملگرهای بیتی جاوااسکریپت ۳۲ بیتی‌اند و مقدار Flags تا بیت ۴۲ می‌رسد.
    /// </summary>
    public List<string> Capabilities { get; set; } = [];

    public bool IsUnique { get; set; }
    public bool CountsAsMember { get; set; }
    public int Order { get; set; }
}

public sealed class RoleConfigModel
{
    public List<RoleDefinitionModel> Roles { get; set; } = [];
    public List<CapabilityInfo> Capabilities { get; set; } = [];
    public List<RoleKeyInfo> Keys { get; set; } = [];
}

public sealed class MeetingAccessModel
{
    public bool Exists { get; set; }
    public Guid MeetingGuid { get; set; }
    public int StatusId { get; set; }
    public string Kind { get; set; } = string.Empty;
    public int? RoleId { get; set; }
    public string RoleKey { get; set; } = string.Empty;
    public string? RoleTitle { get; set; }
    public List<string> Capabilities { get; set; } = [];
    public bool IsSuperAdmin { get; set; }
    public bool IsCreator { get; set; }
    public bool IsSubstitute { get; set; }
    public bool IsGlobalViewer { get; set; }
    public bool ChairmanSigned { get; set; }
    public bool IsContentEditable { get; set; }
    public bool CanEditResolutions { get; set; }
    public bool CanManageAssignments { get; set; }
    public int[] WorkflowSteps { get; set; } = [];
    public bool HasAttendance { get; set; }
    public bool HasMinutes { get; set; }

    public static MeetingAccessModel From(MeetingAccess a) => new()
    {
        Exists = a.Exists,
        MeetingGuid = a.MeetingGuid,
        StatusId = a.StatusId,
        Kind = a.Kind.ToString(),
        RoleId = a.RoleId,
        RoleKey = a.RoleKey.ToString(),
        RoleTitle = a.RoleTitle,
        Capabilities = (a.IsSuperAdmin ? AllSingleCapabilities() : a.Capabilities.GetFlags().ToList())
            .Select(c => c.ToString()).ToList(),
        IsSuperAdmin = a.IsSuperAdmin,
        IsCreator = a.IsCreator,
        IsSubstitute = a.IsSubstitute,
        IsGlobalViewer = a.IsGlobalViewer,
        ChairmanSigned = a.ChairmanSigned,
        IsContentEditable = a.IsContentEditable,
        CanEditResolutions = a.CanEditResolutions,
        CanManageAssignments = a.CanManageAssignments,
        WorkflowSteps = a.Workflow.Steps,
        HasAttendance = a.Workflow.HasAttendance,
        HasMinutes = a.Workflow.HasMinutes,
    };

    public static List<MeetingCapability> AllSingleCapabilities() =>
        Enum.GetValues<MeetingCapability>().Where(IsSingleBit).ToList();

    public static bool IsSingleBit(MeetingCapability c)
    {
        var v = (long)c;
        return v != 0 && (v & (v - 1)) == 0;
    }
}

/// <summary>خواندن/ذخیره پیکربندی نقش‌ها برای صفحه «نقش‌ها و دسترسی‌ها».</summary>
public sealed class MeetingRoleConfigService(MeetingManagementCommandContext db) : IMeetingRoleConfigService
{
    private static readonly (long From, long To, string Group)[] Groups =
    [
        (1L << 0, 1L << 9, "مشاهده"),
        (1L << 10, 1L << 19, "مدیریت جلسه"),
        (1L << 20, 1L << 29, "مصوبات"),
        (1L << 30, 1L << 39, "صورتجلسه و امضا"),
        (1L << 40, 1L << 62, "سایر"),
    ];

    public async Task<RoleConfigModel> GetAsync(CancellationToken ct = default)
    {
        var roles = await db.Roles.AsNoTracking()
            .Where(r => !r.IsRemoved)
            .Select(r => new { r.Id, r.Title, r.Color, r.IsActive })
            .ToListAsync(ct);

        var model = new RoleConfigModel
        {
            Capabilities = MeetingAccessModel.AllSingleCapabilities().Select(c => new CapabilityInfo
            {
                Name = c.ToString(),
                Title = c.GetDescription(),
                Group = Groups.First(g => (long)c >= g.From && (long)c <= g.To).Group,
            }).ToList(),
            Keys = Enum.GetValues<MeetingRoleKey>().Select(k => new RoleKeyInfo
            {
                Value = (byte)k, Name = k.ToString(), Title = k.GetDescription()
            }).ToList(),
        };

        var order = 0;
        foreach (var role in roles)
        {
            var def = MeetingRoles.Get(role.Id) ?? MeetingRoles.CreateDefault(role.Id, MeetingRoleKey.Custom, 100 + order++);
            model.Roles.Add(new RoleDefinitionModel
            {
                RoleId = role.Id,
                Title = role.Title,
                Color = role.Color,
                IsActive = role.IsActive == 1,
                Key = def.Key.ToString(),
                Capabilities = def.Capabilities.GetFlags().Select(c => c.ToString()).ToList(),
                IsUnique = def.IsUnique,
                CountsAsMember = def.CountsAsMember,
                Order = def.Order,
            });
        }

        model.Roles = model.Roles.OrderBy(r => r.Order).ThenBy(r => r.RoleId).ToList();
        return model;
    }

    public async Task<(bool Ok, List<string> Errors)> SaveAsync(List<RoleDefinitionModel> input, Guid actor, CancellationToken ct = default)
    {
        var roleIds = await db.Roles.AsNoTracking().Where(r => !r.IsRemoved).Select(r => r.Id).ToListAsync(ct);
        var errors = new List<string>();

        var definitions = new List<MeetingRoleDefinition>();
        foreach (var item in input.Where(i => roleIds.Contains(i.RoleId)))
        {
            if (!Enum.TryParse<MeetingRoleKey>(item.Key, out var key))
            {
                errors.Add($"کلید نقش «{item.Key}» نامعتبر است.");
                continue;
            }

            var caps = MeetingCapability.None;
            foreach (var name in item.Capabilities)
            {
                if (Enum.TryParse<MeetingCapability>(name, out var c)) caps |= c;
                else errors.Add($"توانایی «{name}» نامعتبر است.");
            }

            definitions.Add(new MeetingRoleDefinition
            {
                RoleId = item.RoleId,
                Key = key,
                Capabilities = caps,
                IsUnique = item.IsUnique,
                CountsAsMember = item.CountsAsMember,
                Order = item.Order,
            });
        }

        // نقش‌هایی که در ورودی نبودند تعریف قبلی‌شان را حفظ کنند
        foreach (var id in roleIds.Where(id => definitions.All(d => d.RoleId != id)))
            if (MeetingRoles.Get(id) is { } existing) definitions.Add(existing.Clone());

        errors.AddRange(MeetingRoles.Validate(definitions));
        if (errors.Count > 0) return (false, errors);

        await PersistAsync(definitions, actor, ct);
        return (true, errors);
    }

    public async Task EnsureDefinitionAsync(int roleId, CancellationToken ct = default)
    {
        if (MeetingRoles.Get(roleId) is not null) return;

        var definitions = MeetingRoles.All.Select(d => d.Clone()).ToList();
        var order = definitions.Count == 0 ? 1 : definitions.Max(d => d.Order) + 1;
        definitions.Add(MeetingRoles.CreateDefault(roleId, MeetingRoleKey.Custom, order));
        await PersistAsync(definitions, SettingValues.SystemGuid, ct);
    }

    /// <summary>بازنشانی توانایی‌های یک نقش به پیش‌فرض کلید سیستمی آن.</summary>
    public async Task ResetAsync(int roleId, Guid actor, CancellationToken ct = default)
    {
        var definitions = MeetingRoles.All.Select(d => d.Clone()).ToList();
        var def = definitions.FirstOrDefault(d => d.RoleId == roleId);
        if (def is null) return;
        def.Capabilities = MeetingRoles.DefaultCapabilities(def.Key);
        await PersistAsync(definitions, actor, ct);
    }

    private async Task PersistAsync(List<MeetingRoleDefinition> definitions, Guid actor, CancellationToken ct)
    {
        var json = MeetingRoles.Serialize(definitions);
        var row = await db.SystemSettings.FirstOrDefaultAsync(s => s.Key == SettingKey.MeetingRoleConfig, ct);
        if (row is null)
            db.SystemSettings.Add(new SystemSetting(actor, SettingKey.MeetingRoleConfig, json, SettingValueType.Json,
                SettingCategory.Roles, "پیکربندی نقش‌های جلسه", isPublic: false));
        else
            row.UpdateValue(actor, json);

        await db.SaveChangesAsync(ct);
        SettingValues.Update(SettingKey.MeetingRoleConfig, json); // → MeetingRoles.Load
    }
}
