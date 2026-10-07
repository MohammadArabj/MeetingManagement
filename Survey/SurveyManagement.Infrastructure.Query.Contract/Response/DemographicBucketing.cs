namespace SurveyManagement.Infrastructure.Query.Contract.Response;


public static class DemographicBucketing
{
    public static string? GetAgeGroupLabel(int? age)
    {
        if (!age.HasValue) return null;
        return age.Value switch
        {
            <= 25 => "زیر ۲۵ سال",
            >= 26 and <= 30 => "۲۶ تا ۳۰ سال",
            >= 31 and <= 35 => "۳۱ تا ۳۵ سال",
            >= 36 and <= 40 => "۳۶ تا ۴۰ سال",
            >= 41 and <= 45 => "۴۱ تا ۴۵ سال",
            _ => "بالاتر از ۴۶ سال"
        };
    }

    public static string? GetExperienceGroupLabel(int? years)
    {
        if (!years.HasValue) return null;
        return years.Value switch
        {
            < 5 => "کمتر از ۵ سال",
            >= 5 and <= 10 => "۵ تا ۱۰ سال",
            >= 11 and <= 15 => "۱۱ تا ۱۵ سال",
            >= 16 and <= 20 => "۱۶ تا ۲۰ سال",
            _ => "بالاتر از ۲۰ سال"
        };
    }

    public static readonly string[] AgeGroupOrder =
    {
        "زیر ۲۵ سال", "۲۶ تا ۳۰ سال", "۳۱ تا ۳۵ سال",
        "۳۶ تا ۴۰ سال", "۴۱ تا ۴۵ سال", "بالاتر از ۴۶ سال"
    };

    public static readonly string[] ExperienceGroupOrder =
    {
        "کمتر از ۵ سال", "۵ تا ۱۰ سال", "۱۱ تا ۱۵ سال",
        "۱۶ تا ۲۰ سال", "بالاتر از ۲۰ سال"
    };
}