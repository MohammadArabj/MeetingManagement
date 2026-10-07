namespace SurveyManagement.Infrastructure.Persistence.Views;

/// <summary>
/// نگاشت مستقیم روی View دیتابیس vwPersonelInfo — فقط خواندنی (Keyless)
/// </summary>
public class PersonelInfoView
{
    public string? PersonelNo { get; set; }
    public string? Sgender { get; set; }
    public string? OfficeCode { get; set; }
    public string? EmployKindpers { get; set; }
    public string? MadrakTypeNameHs { get; set; }
    public string? Nobatkar { get; set; }
    public int? sabeghe { get; set; }
    public int? age { get; set; }
    public string? PostBase { get; set; }
    public string? PostTitle { get; set; }
    public string? GroupDesc { get; set; }
}