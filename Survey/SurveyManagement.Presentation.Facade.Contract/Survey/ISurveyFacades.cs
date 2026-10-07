using Epc.Company.Query;
using SurveyManagement.Application.Contract.Survey;

namespace SurveyManagement.Presentation.Facade.Contract.Survey;

/// <summary>
/// Facade برای Command های Survey
/// </summary>
public interface ISurveyCommandFacade
{
    Task<Result<Guid>> CreateOrEdit(CreateOrEditSurveyDto command);
    Task<Result<bool>> Delete(DeleteSurveyDto command);
    Task<Result<bool>> Publish(PublishSurveyDto command);
    Task<Result<bool>> Activate(ActivateSurveyDto command);
    Task<Result<bool>> Close(CloseSurveyDto command);
    Task<Result<bool>> Pause(PauseSurveyDto command);
    Task<Result<bool>> Archive(ArchiveSurveyDto command);
    Task<Result<CreateSurveyWithQuestionsResponse>> CreateOrEditWithQuestions(CreateSurveyWithQuestionsDto command);
}
