using Epc.Company.Query;
using SurveyManagement.Application.Contract.Question;

namespace SurveyManagement.Presentation.Facade.Contract.Question;

/// <summary>
/// Facade برای Command های Question
/// </summary>
public interface IQuestionCommandFacade
{
    Task<Result<Guid>> CreateOrEdit(CreateOrEditQuestionDto command);
    Task<Result<bool>> Delete(DeleteQuestionDto command);
    Task<Result<bool>> Reorder(ReorderQuestionsDto command);
}
