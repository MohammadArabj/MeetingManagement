using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.BlockedTime;
using MeetingManagement.Infrastructure.Query.Contracts.UserBlockedTime;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Query;


public class BlockedTimeQueryHandler(MeetingManagementQueryContext context)
    : IQueryHandlerAsync<Result<List<BlockedTimeJsonModel>>, Guid>,
      IQueryHandlerAsync<Result<List<BlockedTimeJsonModel>>, BlockedTimeCalendarSearchDto>,
      IQueryHandlerAsync<Result<AvailabilityResultModel>, CheckAvailabilityDto>,
      IQueryHandlerAsync<Result<MultipleAvailabilityResultModel>, CheckMultipleAvailabilityDto>
{
    /// <summary>
    /// دریافت لیست زمان‌های عدم حضور بر اساس UserGuid
    /// </summary>
    public async Task<Result<List<BlockedTimeJsonModel>>> Handle(Guid userGuid)
    {
        var blockedTimes = await context.BlockedTimes
            .Where(b => b.UserGuid == userGuid)
            .Where(b => !b.IsRemoved)
            .OrderByDescending(b => b.Date)
            .ThenBy(b => b.StartTime)
            .Select(b => new BlockedTimeJsonModel
            {
                Id = b.Id,
                Guid = b.Guid,
                Date = b.Date.ToString("yyyy-MM-dd", new CultureInfo("en-Us")), // فرمت برای تقویم
                StartTime = b.StartTime.ToString(@"hh\:mm"),
                EndTime = b.EndTime.ToString(@"hh\:mm"),
                Description = b.Description,
                CreatedAt = b.Created.ToString("yyyy/MM/dd HH:mm")
            })
            .ToListAsync();

        return Result<List<BlockedTimeJsonModel>>.EmptyMessage(blockedTimes);
    }

    /// <summary>
    /// دریافت زمان‌های عدم حضور برای تقویم
    /// </summary>
    public async Task<Result<List<BlockedTimeJsonModel>>> Handle(BlockedTimeCalendarSearchDto condition)
    {
        var fromDate = condition.FromDate.ToDateTimeNull() ?? DateTime.Now.AddMonths(-1);
        var toDate = condition.ToDate.ToDateTimeNull() ?? DateTime.Now.AddMonths(2);

        var blockedTimes = await context.BlockedTimes
            .Where(b => b.UserGuid == condition.UserGuid)
            .Where(b => !b.IsRemoved)
            .OrderBy(b => b.Date)
            .ThenBy(b => b.StartTime)
            .Select(b => new BlockedTimeJsonModel
            {
                Id = b.Id,
                Guid = b.Guid,
                Date = b.Date.ToString("yyyy-MM-dd",new CultureInfo("en-Us")), // فرمت برای تقویم
                StartTime = b.StartTime.ToString(@"hh\:mm"),
                EndTime = b.EndTime.ToString(@"hh\:mm"),
                Description = b.Description,
                CreatedAt = b.Created.ToString("yyyy/MM/dd HH:mm")
            })
            .ToListAsync();

        return Result<List<BlockedTimeJsonModel>>.EmptyMessage(blockedTimes);
    }

    /// <summary>
    /// بررسی در دسترس بودن یک کاربر
    /// </summary>
    public async Task<Result<AvailabilityResultModel>> Handle(CheckAvailabilityDto condition)
    {
        var date = condition.Date.ToDateTimeNull();
        if (!date.HasValue)
            return Result<AvailabilityResultModel>.Failure(null, "تاریخ نامعتبر است");

        if (!TimeSpan.TryParse(condition.StartTime, out var startTime))
            return Result<AvailabilityResultModel>.Failure(null, "ساعت شروع نامعتبر است");

        if (!TimeSpan.TryParse(condition.EndTime, out var endTime))
            return Result<AvailabilityResultModel>.Failure(null, "ساعت پایان نامعتبر است");

        var conflict = await context.BlockedTimes
            .Where(b => b.UserGuid == condition.UserGuid)
            .Where(b => !b.IsRemoved)
            .Where(b => b.Date.Date == date.Value.Date)
            .Where(b => startTime < b.EndTime && endTime > b.StartTime)
            .Select(b => new
            {
                b.StartTime,
                b.EndTime,
                b.Description
            })
            .FirstOrDefaultAsync();

        if (conflict != null)
        {
            return Result<AvailabilityResultModel>.EmptyMessage(new AvailabilityResultModel
            {
                UserGuid = condition.UserGuid,
                IsAvailable = false,
                ConflictDescription = conflict.Description ?? "زمان عدم حضور",
                BlockedFrom = conflict.StartTime.ToString(@"hh\:mm"),
                BlockedTo = conflict.EndTime.ToString(@"hh\:mm")
            });
        }

        return Result<AvailabilityResultModel>.EmptyMessage(new AvailabilityResultModel
        {
            UserGuid = condition.UserGuid,
            IsAvailable = true
        });
    }

    /// <summary>
    /// بررسی در دسترس بودن چند کاربر
    /// </summary>
    public async Task<Result<MultipleAvailabilityResultModel>> Handle(CheckMultipleAvailabilityDto condition)
    {
        var results = new List<AvailabilityResultModel>();

        var date = condition.Date.ToDateTimeNull();
        if (!date.HasValue)
            return Result<MultipleAvailabilityResultModel>.Failure(null, "تاریخ نامعتبر است");

        if (!TimeSpan.TryParse(condition.StartTime, out var startTime))
            return Result<MultipleAvailabilityResultModel>.Failure(null, "ساعت شروع نامعتبر است");

        if (!TimeSpan.TryParse(condition.EndTime, out var endTime))
            return Result<MultipleAvailabilityResultModel>.Failure(null, "ساعت پایان نامعتبر است");

        // یکجا همه تداخل‌ها رو می‌گیریم
        var conflicts = await context.BlockedTimes
            .Where(b => condition.UserGuids.Contains(b.UserGuid))
            .Where(b => !b.IsRemoved)
            .Where(b => b.Date.Date == date.Value.Date)
            .Where(b => startTime < b.EndTime && endTime > b.StartTime)
            .Select(b => new
            {
                b.UserGuid,
                b.StartTime,
                b.EndTime,
                b.Description
            })
            .ToListAsync();

        foreach (var userGuid in condition.UserGuids)
        {
            var conflict = conflicts.FirstOrDefault(c => c.UserGuid == userGuid);

            if (conflict != null)
            {
                results.Add(new AvailabilityResultModel
                {
                    UserGuid = userGuid,
                    IsAvailable = false,
                    ConflictDescription = conflict.Description ?? "زمان عدم حضور",
                    BlockedFrom = conflict.StartTime.ToString(@"hh\:mm"),
                    BlockedTo = conflict.EndTime.ToString(@"hh\:mm")
                });
            }
            else
            {
                results.Add(new AvailabilityResultModel
                {
                    UserGuid = userGuid,
                    IsAvailable = true
                });
            }
        }

        return Result<MultipleAvailabilityResultModel>.EmptyMessage(new MultipleAvailabilityResultModel
        {
            Results = results
        });
    }
}
