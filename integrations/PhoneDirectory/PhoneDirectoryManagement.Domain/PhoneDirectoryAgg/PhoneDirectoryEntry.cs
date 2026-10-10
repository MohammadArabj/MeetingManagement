using Epc.Domain;
using PhoneDirectoryManagement.Common;
using PhoneDirectoryManagement.Domain.PhoneDirectoryAgg.Service;

namespace PhoneDirectoryManagement.Domain.PhoneDirectoryAgg;

public class PhoneDirectoryEntry : AuditableAggregateRootBase<int>
{
    private const int MaxNumbers = 4;

    public PhoneDirectoryEntry() { }

    public PhoneDirectoryEntry(
        Guid creator,
        PhoneDirectoryEntryType type,
        Guid? positionGuid,
        string? locationTitle,
        string? description,
        IPhoneDirectoryService service) : base(creator)
    {
        ValidateFields(type, positionGuid, locationTitle);

        if (type == PhoneDirectoryEntryType.Position)
            service.ThrowWhenDuplicatedPosition(positionGuid!.Value);
        else
            service.ThrowWhenDuplicatedLocation(locationTitle!);

        Type = type;
        PositionGuid = positionGuid;
        LocationTitle = locationTitle;
        Description = description;
    }

    /// <summary>
    /// ویرایش مخاطب — نوع مخاطب (سمت / مکان) هم قابل تغییر است.
    /// وقتی نوع عوض می‌شود، فیلد مربوط به نوع قبلی خودکار پاک می‌شود
    /// (مثلاً از «سمت» به «مکان» تغییر داده شود، PositionGuid نال می‌شود).
    /// </summary>
    public void Edit(
        Guid actor,
        PhoneDirectoryEntryType type,
        Guid? positionGuid,
        string? locationTitle,
        string? description,
        IPhoneDirectoryService service)
    {
        ValidateFields(type, positionGuid, locationTitle);

        if (type == PhoneDirectoryEntryType.Position)
            service.ThrowWhenDuplicatedPosition(positionGuid!.Value, Id);
        else
            service.ThrowWhenDuplicatedLocation(locationTitle!, Id);

        Type = type;
        PositionGuid = type == PhoneDirectoryEntryType.Position ? positionGuid : null;
        LocationTitle = type == PhoneDirectoryEntryType.Location ? locationTitle : null;
        Description = description;
        Modified(actor);
    }

    public void AddNumber(Guid creator, string number, int displayOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(number)) return;
        number = number.Trim();

        var existing = Numbers.FirstOrDefault(n => n.Number == number);
        if (existing is not null)
        {
            existing.SetOrder(displayOrder);
            return;
        }

        if (Numbers.Count >= MaxNumbers)
            throw new InvalidOperationException($"حداکثر {MaxNumbers} شماره داخلی برای هر مخاطب مجاز است.");

        Numbers.Add(new PhoneDirectoryNumber(creator, Id, number, displayOrder));
    }

    public void RemoveNumber(string number)
    {
        var existing = Numbers.FirstOrDefault(n => n.Number == number);
        if (existing is not null)
            Numbers.Remove(existing);
    }

    /// <summary>حذف همه‌ی شماره‌ها — کاربرد در سناریوهایی مثل جایگزینی کامل لیست شماره‌ها</summary>
    public void ClearNumbers() => Numbers.Clear();

    private static void ValidateFields(PhoneDirectoryEntryType type, Guid? positionGuid, string? locationTitle)
    {
        if (type == PhoneDirectoryEntryType.Position && (positionGuid is null || positionGuid == Guid.Empty))
            throw new InvalidOperationException("انتخاب سمت سازمانی الزامی است.");

        if (type == PhoneDirectoryEntryType.Location && string.IsNullOrWhiteSpace(locationTitle))
            throw new InvalidOperationException("عنوان مکان الزامی است.");
    }

    // ── Properties ───────────────────────────────────────────────────────
    public PhoneDirectoryEntryType Type { get; private set; }
    public Guid? PositionGuid { get; private set; }
    public string? LocationTitle { get; private set; }
    public string? Description { get;private set; }

    public List<PhoneDirectoryNumber> Numbers { get; private set; } = [];
}