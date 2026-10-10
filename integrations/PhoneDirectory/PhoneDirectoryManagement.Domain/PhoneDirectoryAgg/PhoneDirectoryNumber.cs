// PhoneDirectoryManagement.Domain/PhoneDirectoryAgg/PhoneDirectoryNumber.cs
using Epc.Domain;

namespace PhoneDirectoryManagement.Domain.PhoneDirectoryAgg;

public class PhoneDirectoryNumber : EntityBase<long>
{
    public PhoneDirectoryNumber() { }

    public PhoneDirectoryNumber(Guid creator, int phoneDirectoryEntryId, string number, int displayOrder = 0)
        : base(creator)
    {
        PhoneDirectoryEntryId = phoneDirectoryEntryId;
        Number = number;
        DisplayOrder = displayOrder;
    }

    public int PhoneDirectoryEntryId { get; private set; }
    public string Number { get; private set; }
    public int DisplayOrder { get; private set; }
    public PhoneDirectoryEntry PhoneDirectoryEntry { get; set; }
    public void SetOrder(int order) => DisplayOrder = order;
    public void SetNumber(string number) => Number = number;
}