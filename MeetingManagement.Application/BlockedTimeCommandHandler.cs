// MeetingManagement.Application/BlockedTimeCommandHandler.cs
using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Application.Contracts.BlockedTime;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.BlockedTimeAgg;
using MeetingManagement.Domain.UserBlockedTimeAgg;
using MeetingManagement.Infrastructure.Query.Contracts.BlockedTime;
using System.Globalization;

namespace MeetingManagement.Application;

public class BlockedTimeCommandHandler(
    IBlockedTimeRepository repository,
    IClaimHelper claimHelper
) : ICommandHandlerAsync<CreateBlockedTimeDto, Result<BlockedTimeJsonModel>>,
    ICommandHandlerAsync<UpdateBlockedTimeDto, Result<BlockedTimeJsonModel>>,
    ICommandHandlerAsync<DeleteBlockedTimeDto, Result<bool>>
{
    public async Task<Result<BlockedTimeJsonModel>> Handle(CreateBlockedTimeDto command)
    {
        var userGuid = claimHelper.GetCurrentUserGuid();


        var date = DateTime.Parse(command.Date,new CultureInfo("en-Us"));

        if (!TimeSpan.TryParse(command.StartTime, out var startTime))
            return Result<BlockedTimeJsonModel>.Failure(null, "ساعت شروع نامعتبر است");

        if (!TimeSpan.TryParse(command.EndTime, out var endTime))
            return Result<BlockedTimeJsonModel>.Failure(null, "ساعت پایان نامعتبر است");

        if (startTime >= endTime)
            return Result<BlockedTimeJsonModel>.Failure(null, "ساعت شروع باید قبل از ساعت پایان باشد");

        // بررسی تداخل
        var hasConflict = await repository.HasConflictAsync(command.UserGuid, date, startTime, endTime);
        if (hasConflict)
            return Result<BlockedTimeJsonModel>.Failure(null, "این بازه زمانی با یک زمان عدم حضور دیگر تداخل دارد");

        var blockedTime = new BlockedTime(
            userGuid,
            command.UserGuid,
            date,
            startTime,
            endTime,
            command.Description
        );

        await repository.CreateAsync(blockedTime);

        return Result<BlockedTimeJsonModel>.Success(new BlockedTimeJsonModel
        {
            Id = blockedTime.Id,
            Guid = blockedTime.Guid,
            Date = blockedTime.Date.ToString("yyyy-MM-dd", new CultureInfo("en-Us")), // فرمت برای تقویم
            StartTime = blockedTime.StartTime.ToString(@"hh\:mm"),
            EndTime = blockedTime.EndTime.ToString(@"hh\:mm"),
            Description = blockedTime.Description,
            CreatedAt = blockedTime.Created.ToString("yyyy/MM/dd HH:mm")
        });
    }

    public async Task<Result<BlockedTimeJsonModel>> Handle(UpdateBlockedTimeDto command)
    {
        var userGuid = claimHelper.GetCurrentUserGuid();
        var positionGuid = command.UserGuid;

        var blockedTime = await repository.LoadAsync(command.Guid);
        if (blockedTime == null || blockedTime.UserGuid != positionGuid)
            return Result<BlockedTimeJsonModel>.Failure(null, "زمان عدم حضور یافت نشد");

        var date = DateTime.Parse(command.Date, new CultureInfo("en-Us"));

        if (!TimeSpan.TryParse(command.StartTime, out var startTime))
            return Result<BlockedTimeJsonModel>.Failure(null, "ساعت شروع نامعتبر است");

        if (!TimeSpan.TryParse(command.EndTime, out var endTime))
            return Result<BlockedTimeJsonModel>.Failure(null, "ساعت پایان نامعتبر است");

        // بررسی تداخل (به جز خودش)
        var hasConflict = await repository.HasConflictAsync(positionGuid, date, startTime, endTime, blockedTime.Id);
        if (hasConflict)
            return Result<BlockedTimeJsonModel>.Failure(null, "این بازه زمانی با یک زمان عدم حضور دیگر تداخل دارد");

        blockedTime.Edit(userGuid, date, startTime, endTime, command.Description);
        repository.Update(blockedTime);

        return Result<BlockedTimeJsonModel>.Success(new BlockedTimeJsonModel
        {
            Id = blockedTime.Id,
            Guid = blockedTime.Guid,
            Date = blockedTime.Date.ToString("yyyy-MM-dd", new CultureInfo("en-Us")), // فرمت برای تقویم
            StartTime = blockedTime.StartTime.ToString(@"hh\:mm"),
            EndTime = blockedTime.EndTime.ToString(@"hh\:mm"),
            Description = blockedTime.Description,
            CreatedAt = blockedTime.Created.ToString("yyyy/MM/dd HH:mm")
        });
    }

    public async Task<Result<bool>> Handle(DeleteBlockedTimeDto command)
    {


        var blockedTime = await repository.LoadAsync(command.Guid);
        if (blockedTime == null)
            return Result<bool>.Failure(false, "زمان عدم حضور یافت نشد");

        repository.Delete(blockedTime);
        return Result<bool>.Success(true);
    }
}