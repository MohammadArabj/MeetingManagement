using Epc.Domain;

namespace MeetingManagement.Domain.CategoryAgg;

public class CategoryPermission : EntityBase<long>
{
    public CategoryPermission()
    {
    }

    public CategoryPermission(Guid creator, int categoryId, Guid positionGuid) : base(creator)
    {
        CategoryId = categoryId;
        PositionGuid = positionGuid;
    }

    public int CategoryId { get; private set; }
    public Guid PositionGuid { get; private set; }

    public Category Category { get; set; }
}