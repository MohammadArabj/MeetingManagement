using Epc.Application.Command;
using Epc.Company.Query;
using SurveyManagement.Application.Contract.Question;
using SurveyManagement.Presentation.Facade.Contract.Question;

namespace SurveyManagement.Application.Facades;

public class QuestionCommandFacade : IQuestionCommandFacade
{
    private readonly IResponsiveCommandBusAsync _commandBus;

    public QuestionCommandFacade(IResponsiveCommandBusAsync commandBus)
    {
        _commandBus = commandBus;
    }

    public async Task<Result<Guid>> CreateOrEdit(CreateOrEditQuestionDto command) =>
        await _commandBus.Dispatch<CreateOrEditQuestionDto, Result<Guid>>(command);

    public async Task<Result<bool>> Delete(DeleteQuestionDto command) =>
        await _commandBus.Dispatch<DeleteQuestionDto, Result<bool>>(command);

    public async Task<Result<bool>> Reorder(ReorderQuestionsDto command) =>
        await _commandBus.Dispatch<ReorderQuestionsDto, Result<bool>>(command);
}
