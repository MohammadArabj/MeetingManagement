using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Application.Contracts.BoardMember;
using MeetingManagement.Domain.BoardMemberAgg;
using Microsoft.AspNetCore.Http;

namespace MeetingManagement.Application;

public class BoardMemberCommandHandler(
    IBoardMemberRepository repository,
    IClaimHelper claimHelper)
    : ICommandHandlerAsync<CreateBoardMemberDto, Result<bool>>,
      ICommandHandlerAsync<EditBoardMemberDto, Result<bool>>,
      ICommandHandlerAsync<DeleteBoardMemberDto, Result<bool>>,
      ICommandHandlerAsync<ActivateBoardMemberDto, Result<bool>>,
      ICommandHandlerAsync<DeactivateBoardMemberDto, Result<bool>>
{
    public async Task<Result<bool>> Handle(CreateBoardMemberDto command)
    {
        var currentUser = claimHelper.GetCurrentUserGuid();

        var boardMember = new BoardMember(
            currentUser,
            command.FirstName,
            command.LastName,
            command.Mobile,
            command.Position,
            command.StartDate,
            command.EndDate,
            command.Company,
            command.ProfileImageGuid);   // ✅ مستقیم از DTO

        await repository.CreateAsync(boardMember);
        return Result<bool>.Success(true, "عضو هیئت مدیره با موفقیت ایجاد شد.");
    }

    public async Task<Result<bool>> Handle(EditBoardMemberDto command)
    {
        var currentUser = claimHelper.GetCurrentUserGuid();
        var boardMember = await repository.LoadAsync(command.Guid);

        if (boardMember == null)
            return Result<bool>.Failure(false, "عضو هیئت مدیره یافت نشد.");

        // ✅ اگر ProfileImageGuid جدید ارسال نشده، تصویر قبلی حفظ می‌شه
        var profileImageGuid = command.ProfileImageGuid ?? boardMember.ProfileImageGuid;

        boardMember.Edit(
            currentUser,
            command.FirstName,
            command.LastName,
            command.Mobile,
            command.Position,
            command.StartDate,
            command.EndDate,
            command.Company,
            profileImageGuid);

        repository.Update(boardMember);
        return Result<bool>.Success(true, "عضو هیئت مدیره با موفقیت ویرایش شد.");
    }

    public async Task<Result<bool>> Handle(DeleteBoardMemberDto command)
    {
        var boardMember = await repository.LoadAsync(command.Guid);
        if (boardMember == null)
            return Result<bool>.Failure(false, "عضو هیئت مدیره یافت نشد.");

        repository.Delete(boardMember);
        return Result<bool>.Success(true, "عضو هیئت مدیره با موفقیت حذف شد.");
    }

    public async Task<Result<bool>> Handle(ActivateBoardMemberDto command)
    {
        var currentUser = claimHelper.GetCurrentUserGuid();
        var boardMember = await repository.LoadAsync(command.Guid);
        if (boardMember == null)
            return Result<bool>.Failure(false, "عضو هیئت مدیره یافت نشد.");

        boardMember.Activate(currentUser);
        repository.Update(boardMember);
        return Result<bool>.Success(true, "عضو هیئت مدیره فعال شد.");
    }

    public async Task<Result<bool>> Handle(DeactivateBoardMemberDto command)
    {
        var currentUser = claimHelper.GetCurrentUserGuid();
        var boardMember = await repository.LoadAsync(command.Guid);
        if (boardMember == null)
            return Result<bool>.Failure(false, "عضو هیئت مدیره یافت نشد.");

        boardMember.Deactivate(currentUser);
        repository.Update(boardMember);
        return Result<bool>.Success(true, "عضو هیئت مدیره غیرفعال شد.");
    }
}