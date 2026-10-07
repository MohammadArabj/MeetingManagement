using System.Collections.Generic;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

public static class DepartmentConstants
{
    public static readonly Dictionary<string, string> PersianDepartmentNames = new()
    {
        {"Legal", "امور حقوقی و قرارداد ها"},
        {"Procurement", "تدارکات و امور کلا"},
        {"HR", "منابع انسانی"},
        {"Finance", "امور مالی"},
        {"Marketing", "بازار یابی و فروش"},
        {"PR", "روابط عمومی"},
        {"Audit", "حسابرسی"},
        {"Risk", "ریسک"},
        {"Trading", "کمیسیون معاملات"},
        {"Production", "معاونت تولید"},
        {"Projects", "پروژه ها"},
        {"HSE", "HSE"},
        {"IT", "IT"},
        {"Other", "سایر ادارات"}
    };
}