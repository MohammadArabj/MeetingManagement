using Epc.Application.Command;
using Epc.Company.Query;
using SurveyManagement.Application.Contract.Survey;
using SurveyManagement.Presentation.Facade.Contract.Survey;

namespace SurveyManagement.Application.Facades;

public class SurveyCommandFacade : ISurveyCommandFacade
{
    private readonly IResponsiveCommandBusAsync _commandBus;

    public SurveyCommandFacade(IResponsiveCommandBusAsync commandBus)
    {
        _commandBus = commandBus;
    }

    public async Task<Result<Guid>> CreateOrEdit(CreateOrEditSurveyDto command) =>
        await _commandBus.Dispatch<CreateOrEditSurveyDto, Result<Guid>>(command);

    public async Task<Result<bool>> Delete(DeleteSurveyDto command) =>
        await _commandBus.Dispatch<DeleteSurveyDto, Result<bool>>(command);

    public async Task<Result<bool>> Publish(PublishSurveyDto command) =>
        await _commandBus.Dispatch<PublishSurveyDto, Result<bool>>(command);

    public async Task<Result<bool>> Activate(ActivateSurveyDto command) =>
        await _commandBus.Dispatch<ActivateSurveyDto, Result<bool>>(command);

    public async Task<Result<bool>> Close(CloseSurveyDto command) =>
        await _commandBus.Dispatch<CloseSurveyDto, Result<bool>>(command);

    public async Task<Result<bool>> Pause(PauseSurveyDto command) =>
        await _commandBus.Dispatch<PauseSurveyDto, Result<bool>>(command);

    public async Task<Result<bool>> Archive(ArchiveSurveyDto command) =>
        await _commandBus.Dispatch<ArchiveSurveyDto, Result<bool>>(command);

    public async Task<Result<CreateSurveyWithQuestionsResponse>> CreateOrEditWithQuestions(CreateSurveyWithQuestionsDto command) =>
        await _commandBus.Dispatch<CreateSurveyWithQuestionsDto, Result<CreateSurveyWithQuestionsResponse>>(command);
}
