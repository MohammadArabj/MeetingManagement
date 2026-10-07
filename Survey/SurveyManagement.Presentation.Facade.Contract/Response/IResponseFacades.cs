using Epc.Company.Query;
using SurveyManagement.Application.Contract.Response;

namespace SurveyManagement.Presentation.Facade.Contract.Response;

/// <summary>
/// Facade برای Command های Response
/// </summary>
public interface IResponseCommandFacade
{
    Task<Result<Guid>> Submit(SubmitResponseDto command);
    Task<Result<bool>> Delete(DeleteResponseDto command);
    Task<Result<bool>> AddNote(AddResponseNoteDto command);
}
