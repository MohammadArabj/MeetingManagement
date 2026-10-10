namespace PhoneDirectoryManagement.Application.Contracts.PhoneDirectory;

public class PhoneDirectoryNumberDto
{
    public string Number { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsRemoved { get; set; }
}
