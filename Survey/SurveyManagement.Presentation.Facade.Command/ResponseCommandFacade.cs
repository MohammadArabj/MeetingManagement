using Epc.Application.Command;
using Epc.Company.Query;
using SurveyManagement.Application.Contract.Response;
using SurveyManagement.Presentation.Facade.Contract.Response;

namespace SurveyManagement.Application.Facades;

public class ResponseCommandFacade(IResponsiveCommandBusAsync commandBus) : IResponseCommandFacade
{

    // ✅ Start حذف شد — Submit همه کار رو انجام میده

    public async Task<Result<Guid>> Submit(SubmitResponseDto command) =>
        await commandBus.Dispatch<SubmitResponseDto, Result<Guid>>(command);

    public async Task<Result<ResponseDraftSavedDto>> SaveDraft(SaveResponseDraftDto command) =>
        await commandBus.Dispatch<SaveResponseDraftDto, Result<ResponseDraftSavedDto>>(command);

    public async Task<Result<bool>> DiscardDraft(DiscardResponseDraftDto command) =>
        await commandBus.Dispatch<DiscardResponseDraftDto, Result<bool>>(command);

    public async Task<Result<bool>> Delete(DeleteResponseDto command) =>
        await commandBus.Dispatch<DeleteResponseDto, Result<bool>>(command);

    public async Task<Result<bool>> AddNote(AddResponseNoteDto command) =>
        await commandBus.Dispatch<AddResponseNoteDto, Result<bool>>(command);
}