using Epc.Domain;
using SurveyManagement.Common;

namespace SurveyManagement.Domain.SurveyAgg;

/// <summary>
/// تاریخچه تغییرات نظرسنجی
/// </summary>
public class SurveyChangeLog : EntityBase<long>
{
    public SurveyChangeLog() { }

    public SurveyChangeLog(
        Guid creator,
        long surveyId,
        ChangeType changeType,
        string? description,
        int version)
        : base(creator)
    {
        SurveyId = surveyId;
        ChangeType = changeType;
        Description = description;
        Version = version;
        ChangeDate = DateTime.Now;
    }

    public long SurveyId { get; private set; }
    public ChangeType ChangeType { get; private set; }
    public string? Description { get; private set; }
    public int Version { get; private set; }
    public DateTime ChangeDate { get; private set; }
    
    /// <summary>
    /// محتوای JSON قبل از تغییر (برای بازیابی)
    /// </summary>
    public string? BeforeSnapshot { get; private set; }
    
    /// <summary>
    /// محتوای JSON بعد از تغییر
    /// </summary>
    public string? AfterSnapshot { get; private set; }
    
    public Survey Survey { get; set; }
}
