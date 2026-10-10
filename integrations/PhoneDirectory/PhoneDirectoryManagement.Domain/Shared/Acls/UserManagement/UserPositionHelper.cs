// PhoneDirectoryManagement.Domain/Shared/Acls/UserManagement/PositionHolderHelper.cs
namespace PhoneDirectoryManagement.Domain.Shared.Acls.UserManagement;

// نمایانگر «کسی که الان این سمت رو داره» — برای نمایش در دفترچه تلفن

public class UserPositionHelper
{
    public Guid Guid { get; set; }
    public string Name { get; set; }
    public string UserName { get; set; }
    public string Unit { get; set; }
    public string Position { get; set; }
    public Guid PositionGuid { get; set; }
    public string Mobile { get; set; }
}