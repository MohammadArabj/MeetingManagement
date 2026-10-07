using Epc.Domain;
using SurveyManagement.Domain.SurveyAgg;

namespace SurveyManagement.Domain.SurveyCriterionAgg;

/// <summary>
/// معیار/گام نظرسنجی — صرفاً برای گروه‌بندی بصری سوالات (فعلاً بدون وزن‌دهی)
/// </summary>
public class SurveyCriterion : AuditableAggregateRootBase<long>
{
    public SurveyCriterion() { } // برای EF Core

    public SurveyCriterion(
        Guid creator,
        long surveyId,
        Guid guid,
        string title,
        string? description,
        int sortOrder)
        : base(creator)
    {
        // ✅ guid از فرانت می‌آید (crypto.randomUUID()) تا سوالات بتوانند در همان
        // درخواست، پیش از ذخیره شدن معیار در دیتابیس، به آن ارجاع بدهند.
        Guid = guid;
        SurveyId = surveyId;
        Title = title;
        Description = description;
        SortOrder = sortOrder;
    }

    public Guid Guid { get; private set; }

    /// <summary>
    /// شناسه نظرسنجی مرتبط
    /// </summary>
    public long SurveyId { get; private set; }

    /// <summary>
    /// عنوان معیار
    /// </summary>
    public string Title { get; private set; }

    /// <summary>
    /// توضیحات معیار (اختیاری)
    /// </summary>
    public string? Description { get; private set; }

    /// <summary>
    /// ترتیب نمایش معیار
    /// </summary>
    public int SortOrder { get; private set; }

    /// <summary>
    /// Navigation Properties
    /// </summary>
    public Survey Survey { get; set; }
    public ICollection<QuestionAgg.Question> Questions { get; set; } = [];

    /// <summary>
    /// ویرایش معیار
    /// </summary>
    public void Edit(Guid actor, string title, string? description, int sortOrder)
    {
        Title = title;
        Description = description;
        SortOrder = sortOrder;
        Modified(actor);
    }
}