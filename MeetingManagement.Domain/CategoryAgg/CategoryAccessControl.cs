using Epc.Domain;

namespace MeetingManagement.Domain.CategoryAgg;

public class CategoryAccessControl:AuditableAggregateRootBase<long>
{
    public CategoryAccessControl()
    {
    }

    public CategoryAccessControl(Guid creator, int categoryId, List<Guid> allowedPositions):base(creator)
    {
        CategoryId = categoryId;
        AllowedPositions = string.Join(",", allowedPositions);
    }

    public void UpdateAccess(Guid editor, List<Guid> allowedPositions)
    {
        AllowedPositions = string.Join(",", allowedPositions);
        Modified(editor);
    }

    public List<Guid> GetAllowedPositionGuids()
    {
        if (string.IsNullOrEmpty(AllowedPositions))
            return new List<Guid>();

        return AllowedPositions.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(x => Guid.Parse(x.Trim()))
            .ToList();
    }

    public int CategoryId { get; private set; }
    public string AllowedPositions { get; private set; } // Comma-separated GUIDs

    public Category Category { get; set; }
}