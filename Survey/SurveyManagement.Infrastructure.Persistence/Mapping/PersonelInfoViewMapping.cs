using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SurveyManagement.Infrastructure.Persistence.Views;

namespace SurveyManagement.Infrastructure.Persistence.Mapping;


public class PersonelInfoViewMapping : IEntityTypeConfiguration<PersonelInfoView>
{
    public void Configure(EntityTypeBuilder<PersonelInfoView> builder)
    {
        // ✅ Keyless — چون این یک View هست نه جدول، و فقط برای Read استفاده می‌شه
        builder.HasNoKey();
        builder.ToView("vwPersonelInfo", "dbo");
    }
}