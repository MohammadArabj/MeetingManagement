using Epc.Domain;
using SurveyManagement.Common;

namespace SurveyManagement.Domain.QuestionAgg;

/// <summary>
/// منطق شرطی سوالات (Skip Logic / Branching)
/// </summary>
public class QuestionLogic : EntityBase<long>
{
    public QuestionLogic() { }

    public QuestionLogic(
        Guid creator,
        long sourceQuestionId,
        long? targetQuestionId,
        LogicType logicType,
        ConditionOperator conditionOperator,
        string? conditionValue,
        long? optionId
        ,int priority)
        : base(creator)
    {
        Guid = Guid.NewGuid();
        SourceQuestionId = sourceQuestionId;
        TargetQuestionId = targetQuestionId;
        LogicType = logicType;
        ConditionOperator = conditionOperator;
        ConditionValue = conditionValue;
        OptionId = optionId;
        Priority = priority;
    }

    public Guid Guid { get; private set; }
    
    /// <summary>
    /// سوال مبدا (سوالی که شرط روی آن اعمال می‌شود)
    /// </summary>
    public long SourceQuestionId { get; private set; }
    
    /// <summary>
    /// سوال مقصد (سوالی که باید نمایش داده یا مخفی شود)
    /// </summary>
    public long? TargetQuestionId { get; private set; }
    
    /// <summary>
    /// نوع منطق
    /// </summary>
    public LogicType LogicType { get; private set; }
    
    /// <summary>
    /// عملگر شرطی
    /// </summary>
    public ConditionOperator ConditionOperator { get; private set; }
    
    /// <summary>
    /// مقدار شرط (JSON برای شرایط پیچیده)
    /// </summary>
    public string? ConditionValue { get; private set; }
    
    /// <summary>
    /// شناسه گزینه (اگر شرط روی گزینه خاصی است)
    /// </summary>
    public long? OptionId { get; private set; }
    
    /// <summary>
    /// اولویت اجرا (در صورت چند شرط)
    /// </summary>
    public int Priority { get; private set; }
    
    public Question SourceQuestion { get; set; }
    public Question? TargetQuestion { get; set; }
    public QuestionOption? Option { get; set; }
    
    public void Edit(
        long? targetQuestionId,
        LogicType logicType,
        ConditionOperator conditionOperator,
        string? conditionValue,
        long? optionId,
        int priority)
    {
        TargetQuestionId = targetQuestionId;
        LogicType = logicType;
        ConditionOperator = conditionOperator;
        ConditionValue = conditionValue;
        OptionId = optionId;
        Priority = priority;
    }
}
