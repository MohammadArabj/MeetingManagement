
using SurveyManagement.Common;

namespace SurveyManagement.Infrastructure.Query.Contract.Question;

/// <summary>
/// DTO برای منطق شرطی
/// </summary>
public class QuestionLogicDetailDto
{
    public long Id { get; set; }
    public long? TargetQuestionId { get; set; }
    public string LogicType { get; set; }
    public LogicType LogicTypeEnum { get; set; }
    public string ConditionOperator { get; set; }
    public ConditionOperator ConditionOperatorEnum { get; set; }
    public string? ConditionValue { get; set; }
    public long? OptionId { get; set; }
    public int Priority { get; set; }
}
