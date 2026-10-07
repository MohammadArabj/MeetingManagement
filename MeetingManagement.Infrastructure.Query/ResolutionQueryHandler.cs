using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Assignment;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.AssignmentAgg;
using MeetingManagement.Domain.ResolutionAgg;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using MeetingManagement.Infrastructure.Acl;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Meeting;
using MeetingManagement.Infrastructure.Query.Contracts.Resolution;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using MeetingManagement.Infrastructure.Query.Security;
using MeetingManagement.Domain.Shared.Access;

namespace MeetingManagement.Infrastructure.Query;

/// <summary>
/// Queryهای مصوبات. هر Query روی یک جلسه ابتدا دسترسی را بررسی می‌کند و جستجو/گزارش‌ها فقط مصوباتی را
/// برمی‌گردانند که جلسه‌شان برای کاربر قابل مشاهده است یا کاربر در تخصیص ابلاغ‌شده‌ی آن نقش دارد.
/// </summary>
public class ResolutionQueryHandler(
    MeetingManagementQueryContext context,
    IUserManagementAclService userManagementAclService,
    IActingIdentityResolver identityResolver,
    IMeetingAccessService accessService) :
    IQueryHandlerAsync<Result<List<ResolutionJsonModel>>, Guid>,
    IQueryHandlerAsync<Result<List<ResolutionSearchResultDto>>, ResolutionSearchRequestDto>,
    IQueryHandlerAsync<Result<List<ComboBase>>, Guid>,
    IQueryHandlerAsync<Result<ResolutionReportDto>, ResolutionDetailReportRequestDto>,
    IQueryHandlerAsync<Result<MeetingActionsReportDto>, GetActionsReportQuery> , // ✅ اضافه شد
    IQueryHandlerAsync<Result<int>,Guid>
{
    public async Task<Result<List<ResolutionJsonModel>>> Handle(Guid condition)
    {
        var access = await accessService.GetAsync(condition);
        if (!access.Can(MeetingCapability.ViewResolutions))
            return Result<List<ResolutionJsonModel>>.Failure([], DeniedMessage);

        var resolutions = await context.Resolutions
            .Include(c => c.AssignedMembers)
            .Include(resolution => resolution.Label)
            .Where(c => c.Meeting.Guid == condition)
           .ToListAsync();
        var result = new List<ResolutionJsonModel>();
        foreach (var item in resolutions.OrderBy(x => x.SortOrder))
        {
            var model = new ResolutionJsonModel()
            {
                Text = item.Text,
                Description = item.Description,
                //Label = item.Label.Title,
                Id = item.Id,
                Title = item.Title,
                Number = item.Number,
                ApprovedPrice = item.ApprovedPrice,
                Documentation = item.Documentation,
                ContractNumber = item.ContractNumber,
                DecisionsMade = item.DecisionsMade,
                CommitteeMeeting = item.CommitteeMeetingId != null ? context.Meetings.FirstOrDefault(x => x.Id == item.CommitteeMeetingId).Title : "",
                CommitteeResolution = item.CommitteeResolutionId != null ? context.Resolutions.FirstOrDefault(x => x.Id == item.CommitteeResolutionId).Title : "",
                FollowUpMeeting = item.ParentMeetingId != null ? context.Meetings.FirstOrDefault(x => x.Id == item.ParentMeetingId).Title : "",
                FollowUpResolution = item.ParentResolutionId != null ? context.Resolutions.FirstOrDefault(x => x.Id == item.ParentResolutionId).Title : ""


                //LabelGuid = item.Label.Guid
            };
            var assignments = item.AssignedMembers.Where(x => x.IsReferral == false);
            if (assignments.Any())
            {
                var userGuids = assignments
                    .SelectMany(m => new[] { m.ActorGuid, m.FollowerGuid })
                    .Where(g => g.HasValue)
                    .Distinct()
                    .ToList();
                var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);
                var usersDict = users.ToDictionary(u => u.Guid, u => u.Fullname);
                var assignmentModels = assignments.Select(m =>
                {
                    var actorName = m.ActorGuid != null
                        ? (usersDict.TryGetValue(m.ActorGuid.Value, out var name) ? name : "")
                        : "";

                    var follower = m.FollowerGuid != null
                        ? (usersDict.TryGetValue(m.FollowerGuid.Value, out var fullname) ? fullname : "")
                        : "";

                    return new ResolutionAssignmentDto()
                    {
                        FollowerGuid = m.FollowerGuid,
                        FollowerPositionGuid = m.FollowerPositionGuid,
                        ActorGuid = m.ActorGuid,
                        ActorPositionGuid = m.ActorPositionGuid,
                        ActorName = actorName,
                        FollowerName = follower,
                        Status = m.ActionStatus,
                        Result = m.Result,
                        DueDate = m.DueDate.Value.ToString("yyyy/MM/dd"),
                        //  FollowUpDate = m.FollowUpDate.ToString("yyyy/MM/dd"),
                        Id = m.Id,
                        Type = m.Type.GetDisplayName(),
                        AssignmentType = m.Type.ToString()
                    };
                }).ToList();
                model.Assignments = assignmentModels;
            }
            result.Add(model);
        }
        return Result<List<ResolutionJsonModel>>.EmptyMessage(result);
    }

    public async Task<Result<List<ResolutionSearchResultDto>>> Handle(ResolutionSearchRequestDto condition)
    {
        var meetingDateFrom = condition.MeetingDateFrom.ToDateTimeNull();
        var meetingDateTo = condition.MeetingDateTo.ToDateTimeNull();
        var resolutionDate = condition.ResolutionDate.ToDateTimeNull();
        var query = context.Resolutions
            .Include(resolution => resolution.Label)
            .Include(resolution => resolution.AssignedMembers)
            .Include(resolution => resolution.Meeting)
            .ThenInclude(x => x.MeetingMembers)
            .Where(await VisibleResolutionsAsync())
            .WhereIf(meetingDateFrom != null, c => c.Meeting.Date >= meetingDateFrom)
            .WhereIf(meetingDateTo != null, c => c.Meeting.Date <= meetingDateTo)
            .WhereIf(resolutionDate != null, c => c.AssignedMembers.Any(x => x.DueDate == resolutionDate))
            .WhereIf(!string.IsNullOrEmpty(condition.MeetingNumber), c => c.Meeting.Number.Contains(condition.MeetingNumber))
            .WhereIf(!string.IsNullOrEmpty(condition.MeetingTitle), c => c.Meeting.Title.Contains(condition.MeetingTitle))
            .WhereIf(!string.IsNullOrEmpty(condition.Title), c => c.Title.Contains(condition.Title))
            .WhereIf(!string.IsNullOrEmpty(condition.Documents), c => c.Documentation.Contains(condition.Documents))
            .WhereIf(!string.IsNullOrEmpty(condition.Decisions), c => c.DecisionsMade.Contains(condition.Decisions))
            .WhereIf(!string.IsNullOrEmpty(condition.ResolutionNumber), c => c.Number.Contains(condition.ResolutionNumber))
            .WhereIf(!string.IsNullOrEmpty(condition.Text), c => c.Text.Contains(condition.Text))
            .WhereIf(condition.ActorGuid != null, c => c.AssignedMembers.Any(x => x.ActorGuid == condition.ActorGuid))
            .WhereIf(condition.FollowerGuid != null, c => c.AssignedMembers.Any(x => x.FollowerGuid == condition.FollowerGuid));

        if (condition.Type != null)
        {
            query = condition.Type == ActionType.Action
                ? query.Where(a => a.AssignedMembers.Any(x => x.ActorPositionGuid == condition.PositionGuid))
                : query.Where(a => a.AssignedMembers.Any(x => x.FollowerPositionGuid == condition.PositionGuid));
        }

        query = query
            .WhereIf(condition.ApprovalStatus != null, c => c.AssignedMembers.Any(x => x.FollowStatus == condition.ApprovalStatus))
            .WhereIf(condition.ActionStatus.HasValue, c => c.AssignedMembers.Any(x => x.ActionStatus == condition.ActionStatus))
            .OrderByDescending(x => x.Meeting.Date);
        var result = new List<ResolutionSearchResultDto>();
        foreach (var item in query)
        {
            var resolution = new ResolutionSearchResultDto()
            {
                Id = item.Id,
                MeetingGuid = item.Meeting.Guid.Value,
                MeetingNumber = item.Meeting.Number,
                MeetingTitle = item.Meeting.Title,
                Title = item.Title,
                Decisions = item.DecisionsMade,
                Documents = item.Documentation,
                Description = item.Description,
                ResolutionNumber = item.Number,
                ResolutionDate = item.AssignedMembers.Count() != 0 ? item.AssignedMembers.FirstOrDefault().DueDate.Value.ToString("yyyy/MM/dd") : "",
                MeetingDate = item.Meeting.Date.HasValue ? item.Meeting.Date.Value.ToString("yyyy/MM/dd") : "",
                Text = item.Text
            };
            var assignments = item.AssignedMembers;
            if (assignments.Any())
            {
                var userGuids = assignments
                    .SelectMany(m => new[] { m.ActorGuid, m.FollowerGuid })
                    .Where(g => g.HasValue)
                    .Distinct()
                    .ToList();
                var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);
                var usersDict = users.ToDictionary(u => u.Guid, u => u.Fullname);
                var followers = assignments.Select(m =>
                {
                    var follower = m.FollowerGuid != null
                        ? (usersDict.TryGetValue(m.FollowerGuid.Value, out var fullname) ? fullname : "")
                        : "";
                    return follower;
                }).ToList();
                var actors = assignments.Select(m =>
                {
                    var actorName = m.ActorGuid != null
                        ? (usersDict.TryGetValue(m.ActorGuid.Value, out var name) ? name : "")
                        : "";
                    return actorName;
                }).ToList();
                resolution.Actors = actors;
                resolution.Followers = followers;

            }
            result.Add(resolution);
        }
        return Result<List<ResolutionSearchResultDto>>.EmptyMessage(result);
    }

    async Task<Result<List<ComboBase>>> IQueryHandlerAsync<Result<List<ComboBase>>, Guid>.Handle(Guid condition)
    {
        var access = await accessService.GetAsync(condition);
        if (!access.Can(MeetingCapability.ViewResolutions))
            return Result<List<ComboBase>>.Failure([], DeniedMessage);

        var resolutions = await context.Resolutions
            .Where(c => c.Meeting.Guid == condition)
            .Select(c => new ComboBase()
            {
                Id = c.Id,
                Title = c.Title,

            }).ToListAsync();
        return Result<List<ComboBase>>.EmptyMessage(resolutions);
    }
    public async Task<Result<ResolutionReportDto>> Handle(ResolutionDetailReportRequestDto condition)
    {
        DateTime? fromDate = condition.FromDate.ToDateTimeNull()?.Date;
        DateTime? toDate = condition.ToDate.ToDateTimeNull()?.Date;

        // ------------------------
        // 1) Query پایه (فقط فیلترهای سطح Resolution + PositionMainGuid اگر مقدار داشت)
        // ------------------------
        var query = context.Resolutions
            .AsNoTracking()
            .Where(await VisibleResolutionsAsync())
            .Include(r => r.Meeting).ThenInclude(m => m.Category)
            .Include(r => r.AssignedMembers).ThenInclude(a => a.Actions)
            .WhereIf(condition.PositionMainGuid.HasValue, r => r.AssignedMembers.Any(x =>
                x.FollowerPositionGuid == condition.PositionMainGuid!.Value ||
                x.ActorPositionGuid == condition.PositionMainGuid!.Value))
            .WhereIf(condition.CategoryGuid != null, r => r.Meeting.Category.Guid == condition.CategoryGuid)
            .WhereIf(fromDate.HasValue, r => r.Meeting.Date >= fromDate.Value)
            .WhereIf(toDate.HasValue, r => r.Meeting.Date <= toDate.Value)
            .WhereIf(!string.IsNullOrEmpty(condition.MeetingNumber), r => r.Meeting.Number.Contains(condition.MeetingNumber))
            .WhereIf(!string.IsNullOrEmpty(condition.ResolutionNumber), r => r.Number.Contains(condition.ResolutionNumber))
            .WhereIf(!string.IsNullOrEmpty(condition.ResolutionTitle), r => r.Title.Contains(condition.ResolutionTitle))
            .WhereIf(!string.IsNullOrEmpty(condition.MeetingTitle), r => r.Meeting.Title.Contains(condition.MeetingTitle))
            .WhereIf(!string.IsNullOrEmpty(condition.Title), r => r.Title.Contains(condition.Title))
            .WhereIf(!string.IsNullOrEmpty(condition.Documents), r => r.Documentation.Contains(condition.Documents))
            .WhereIf(!string.IsNullOrEmpty(condition.Decisions), r => r.DecisionsMade.Contains(condition.Decisions))
            .WhereIf(!string.IsNullOrEmpty(condition.Text), r => r.Text.Contains(condition.Text));

        var resolutions = await query
            .OrderByDescending(r => r.Meeting.Date)
            .ThenBy(r => r.SortOrder)
            .ToListAsync();

        // ------------------------
        // 2) لود کاربران/پوزیشن‌ها برای نمایش نام‌ها
        // ------------------------
        var allUserGuids = resolutions
            .SelectMany(r => r.AssignedMembers)
            .SelectMany(a => new[] { a.ActorGuid, a.FollowerGuid })
            .Where(g => g.HasValue)
            .Select(g => g)
            .Distinct()
            .ToList();

        var users = await userManagementAclService.GetUserAndPositionsByGuidsAsync(allUserGuids);
        var positionDict = await GetUserPositionMapping(users);

        // ------------------------
        // 3) یکسان‌سازی فیلترهای Assignment برای Details و Summary
        // ------------------------
        bool PassesAssignmentFilters(Assignment assignment)
        {
            // فیلتر PositionGuid (این را پوزیشن در نظر می‌گیریم، نه UserGuid)
            if (condition.ActorPositionGuid.HasValue)
            {
                if (!assignment.ActorPositionGuid.HasValue || assignment.ActorPositionGuid.Value != condition.ActorPositionGuid.Value)
                    return false;
            }

            // فیلتر ActionStatus
            if (condition.ActionStatus.HasValue && assignment.ActionStatus != condition.ActionStatus.Value)
                return false;

            // فیلتر AssignmentResult (فقط وقتی End باشد)
            if (condition.AssignmentResult.HasValue)
            {
                if (assignment.ActionStatus != ActionStatus.End)
                    return false;

                if (assignment.Result != condition.AssignmentResult.Value)
                    return false;
            }

            return true;
        }

        Guid? GetEffectivePositionGuid(Assignment a)
            => a.ActorPositionGuid ?? a.FollowerPositionGuid;

        string FormatDate(DateTime? dt)
            => dt.HasValue ? dt.Value.ToString("yyyy/MM/dd") : "نامشخص";

        // تمام Assignmentها (در حافظه، چون resolutions را ToListAsync کردیم)
        var rows = resolutions
            .SelectMany(r => r.AssignedMembers.Select(a => new { Resolution = r, Assignment = a }))
            .ToList();

        // Assignmentهای فیلترشده (برای Details و Summary)
        var filteredRows = rows
            .Where(x => PassesAssignmentFilters(x.Assignment))
            .ToList();

        // ------------------------
        // 4) Details
        // ------------------------
        var details = new List<ResolutionDetailReportDto>();

        foreach (var row in filteredRows)
        {
            var resolution = row.Resolution;
            var assignment = row.Assignment;

            var posGuid = GetEffectivePositionGuid(assignment);
            var positionName = posGuid.HasValue ? GetPositionNameByGuid(posGuid.Value, positionDict) : "نامشخص";

            // اگر ActorPositionGuid داریم، از همان برای نام فرد استفاده کن
            var actorInfo =
                assignment.ActorPositionGuid.HasValue &&
                positionDict.TryGetValue(assignment.ActorPositionGuid.Value, out var actor)
                    ? actor
                    : null;

            var lastAction = assignment.Actions?
                .OrderByDescending(a => a.Id)
                .FirstOrDefault();

            details.Add(new ResolutionDetailReportDto
            {
                MeetingNumber = resolution.Meeting.Number,
                MeetingCategory = resolution.Meeting.Category?.Title ?? "نامشخص",
                MeetingTitle = resolution.Meeting.Title,
                MeetingDate = resolution.Meeting.Date.HasValue ? resolution.Meeting.Date.Value.ToString("yyyy/MM/dd") : "نامشخص",

                ResolutionNumber = resolution.Number,
                ResolutionTitle = resolution.Title,
                DecisionsMade = resolution.DecisionsMade,

                Position = positionName,
                ActorName = actorInfo?.Name ?? "نامشخص",

                DueDate = FormatDate(assignment.DueDate),
                ActionStatus = assignment.ActionStatus,
                Result = assignment.ActionStatus == ActionStatus.End ? assignment.Result : null,
                Description = lastAction?.Description ?? resolution.Description ?? resolution.Text,
                TotalActions = assignment.Actions?.Count ?? 0,
                ResolutionText = resolution.Text
            });
        }

        // ------------------------
        // 5) Summary (بدون فیلتر دوباره‌ی PositionMainGuid و بدون excludedIds)
        // ------------------------
        var today = DateTime.Today;

        var positionSummaries = filteredRows
            .GroupBy(x => GetEffectivePositionGuid(x.Assignment) ?? Guid.Empty)
            .Where(g => g.Key != Guid.Empty) // اگر دیتای ناقص بود، گروه Empty را حذف کن
            .Select(g =>
            {
                var positionGuid = g.Key;
                var positionName = GetPositionNameByGuid(positionGuid, positionDict);

                var assignments = g.Select(x => x.Assignment).ToList();

                var pendingCount = assignments.Count(a => a.ActionStatus == ActionStatus.Pending);
                var inProgressCount = assignments.Count(a => a.ActionStatus == ActionStatus.InProgress);
                var completedCount = assignments.Count(a => a.ActionStatus == ActionStatus.End);

                var overdueCount = assignments.Count(a =>
                    a.DueDate.HasValue &&
                    a.DueDate.Value.Date < today &&
                    a.ActionStatus != ActionStatus.End);

                var totalAssignments = assignments.Count;
                var totalMeetings = g.Select(x => x.Resolution.MeetingId).Distinct().Count();
                var completionPercentage = totalAssignments > 0
                    ? (double)completedCount / totalAssignments * 100
                    : 0;

                return new PositionResolutionSummary
                {
                    PositionName = positionName,
                    PositionGuid = positionGuid,
                    TotalResolutions = totalAssignments, // اینجا منظور تعداد آیتم‌های Assignment است (مثل کد خودت)
                    TotalMeetings = totalMeetings,
                    CompletedResolutions = completedCount,
                    InProgressResolutions = inProgressCount,
                    NotStartedResolutions = pendingCount,
                    OverdueResolutions = overdueCount,
                    CompletionPercentage = Math.Round(completionPercentage, 2)
                };
            })
            .OrderBy(x => x.PositionName)
            .ToList();

        // اگر TotalResolutions در Summary باید مطابق فیلترها باشد:
        var totalResolutionsFiltered = filteredRows
            .Select(x => x.Resolution.Id)
            .Distinct()
            .Count();

        var summary = new ResolutionSummaryReportDto
        {
            TotalResolutions = totalResolutionsFiltered,
            PositionSummaries = positionSummaries
        };

        // ------------------------
        // 6) خروجی نهایی
        // ------------------------
        var result = new ResolutionReportDto
        {
            Summary = summary,
            Details = details
        };

        return Result<ResolutionReportDto>.EmptyMessage(result);
    }

    //public async Task<Result<ResolutionReportDto>> Handle(ResolutionDetailReportRequestDto condition)
    //{
    //    var fromDate = condition.FromDate.ToDateTimeNull();
    //    var toDate = condition.ToDate.ToDateTimeNull();

    //    // دریافت مصوبات با فیلترهای مشترک
    //    var query = context.Resolutions
    //        .Include(r => r.Meeting).ThenInclude(meeting => meeting.Category)
    //        .Include(r => r.AssignedMembers)
    //            .ThenInclude(a => a.Actions)
    //        .Where(r => r.AssignedMembers.Any(x =>
    //            x.FollowerPositionGuid == condition.PositionMainGuid ||
    //            x.ActorPositionGuid == condition.PositionMainGuid))
    //        .WhereIf(condition.CategoryGuid != null, r => r.Meeting.Category.Guid == condition.CategoryGuid)
    //        .WhereIf(fromDate.HasValue, r => r.Meeting.Date >= fromDate.Value.Date)
    //        .WhereIf(toDate.HasValue, r => r.Meeting.Date <= toDate.Value.Date)
    //        .WhereIf(!string.IsNullOrEmpty(condition.MeetingNumber), r => r.Meeting.Number.Contains(condition.MeetingNumber))
    //        .WhereIf(!string.IsNullOrEmpty(condition.ResolutionNumber), r => r.Number.Contains(condition.ResolutionNumber))
    //        .WhereIf(!string.IsNullOrEmpty(condition.ResolutionTitle), r => r.Title.Contains(condition.ResolutionTitle))
    //        .WhereIf(!string.IsNullOrEmpty(condition.MeetingTitle), r => r.Meeting.Title.Contains(condition.MeetingTitle))
    //        .WhereIf(!string.IsNullOrEmpty(condition.Title), r => r.Title.Contains(condition.Title))
    //        .WhereIf(!string.IsNullOrEmpty(condition.Documents), r => r.Documentation.Contains(condition.Documents))
    //        .WhereIf(!string.IsNullOrEmpty(condition.Decisions), r => r.DecisionsMade.Contains(condition.Decisions))
    //        .WhereIf(!string.IsNullOrEmpty(condition.Text), r => r.Text.Contains(condition.Text));

    //    var resolutions = await query
    //        .OrderBy(r => r.Meeting.Date)
    //        .ThenBy(r => r.SortOrder)
    //        .ToListAsync();

    //    var totalResolutions = resolutions.Count;

    //    // کاربران
    //    var allUserGuids = resolutions
    //        .SelectMany(r => r.AssignedMembers)
    //        .SelectMany(a => new[] { a.ActorGuid, a.FollowerGuid })
    //        .Where(g => g.HasValue)
    //        .Distinct()
    //        .ToList();
    //    var users = await userManagementAclService.GetUserAndPositionsByGuidsAsync(allUserGuids);
    //    var positionDict = await GetUserPositionMapping(users);

    //    // ------------------------
    //    // بخش جزئیات (Details)
    //    // ------------------------
    //    var details = new List<ResolutionDetailReportDto>();
    //    var excludedIds = new List<long>();

    //    foreach (var resolution in resolutions)
    //    {
    //        foreach (var assignment in resolution.AssignedMembers)
    //        {
    //            var actorInfo = assignment.ActorPositionGuid.HasValue &&
    //                positionDict.TryGetValue(assignment.ActorPositionGuid.Value, out var actor) ? actor : null;
    //            var positionName = GetPositionName(actorInfo, positionDict);

    //            // فیلتر بر اساس UserGuid
    //            if (condition.PositionGuid.HasValue &&
    //                (!positionDict.ContainsKey(assignment.ActorGuid ?? Guid.Empty) ||
    //                 (positionDict.TryGetValue(assignment.ActorGuid ?? Guid.Empty, out var pos) &&
    //                  pos.PositionGuid != condition.PositionGuid.Value)))
    //            {
    //                continue;
    //            }

    //            // فیلتر بر اساس ActionStatus
    //            if (condition.ActionStatus.HasValue && assignment.ActionStatus != condition.ActionStatus.Value)
    //            {
    //                excludedIds.Add(resolution.Id);
    //                continue;
    //            }

    //            // فیلتر بر اساس AssignmentResult (فقط وقتی وضعیت پایان یافته باشد)
    //            if (condition.AssignmentResult.HasValue)
    //            {
    //                // اگر وضعیت پایان یافته نیست، این رکورد را رد کن
    //                if (assignment.ActionStatus != ActionStatus.End)
    //                {
    //                    excludedIds.Add(resolution.Id);
    //                    continue;
    //                }

    //                // اگر نتیجه مطابقت ندارد، رد کن
    //                if (assignment.Result != condition.AssignmentResult.Value)
    //                {
    //                    excludedIds.Add(resolution.Id);
    //                    continue;
    //                }
    //            }

    //            var lastAction = assignment.Actions.OrderByDescending(a => a.Id).FirstOrDefault();

    //            details.Add(new ResolutionDetailReportDto
    //            {
    //                MeetingNumber = resolution.Meeting.Number,
    //                MeetingCategory = resolution.Meeting.Category?.Title ?? "نامشخص",
    //                MeetingTitle = resolution.Meeting.Title,
    //                MeetingDate = resolution.Meeting.Date.Value.ToString("yyyy/MM/dd"),
    //                ResolutionNumber = resolution.Number,
    //                ResolutionTitle = resolution.Title,
    //                DecisionsMade = resolution.DecisionsMade,
    //                Position = positionName,
    //                ActorName = actorInfo?.Name ?? "نامشخص",
    //                DueDate = assignment.DueDate != null ? assignment.DueDate?.ToString("yyyy/MM/dd") : "نامشخص",
    //                ActionStatus = assignment.ActionStatus,
    //                Result = assignment.ActionStatus == ActionStatus.End ? assignment.Result : null, // فقط وقتی پایان یافته
    //                Description = lastAction?.Description ?? resolution.Description ?? resolution.Text,
    //                TotalActions = assignment.Actions.Count,
    //                ResolutionText = resolution.Text
    //            });
    //        }
    //    }

    //    // ------------------------
    //    // بخش خلاصه (Summary)
    //    // ------------------------
    //    var positionGroups = resolutions.Where(x => !excludedIds.Contains(x.Id))
    //        .SelectMany(r => r.AssignedMembers.Select(a => new { Resolution = r, Assignment = a }))
    //        .GroupBy(x => GetPositionGuid(x.Assignment.ActorPositionGuid, positionDict))
    //        .ToList();

    //    var summaryItems = resolutions
    //    .SelectMany(r => r.AssignedMembers.Select(a => new { Resolution = r, Assignment = a }))
    //    .AsEnumerable();

    //    // اگر واقعاً فیلتر PositionGuid مدنظر شما "پوزیشن" است، درستش این است (نه ActorGuid):
    //    if (condition.PositionGuid.HasValue)
    //    {
    //        summaryItems = summaryItems.Where(x =>
    //            x.Assignment.ActorPositionGuid.HasValue &&
    //            x.Assignment.ActorPositionGuid.Value == condition.PositionGuid.Value);
    //    }

    //    // فیلتر ActionStatus
    //    if (condition.ActionStatus.HasValue)
    //    {
    //        summaryItems = summaryItems.Where(x => x.Assignment.ActionStatus == condition.ActionStatus.Value);
    //    }

    //    // فیلتر AssignmentResult (فقط وقتی End باشد)
    //    if (condition.AssignmentResult.HasValue)
    //    {
    //        summaryItems = summaryItems.Where(x =>
    //            x.Assignment.ActionStatus == ActionStatus.End &&
    //            x.Assignment.Result == condition.AssignmentResult.Value);
    //    }

    //    var positionSummaries = summaryItems
    //        // کلید گروه‌بندی را مستقیم از ActorPositionGuid بگیر؛ اگر نال بود از FollowerPositionGuid
    //        .GroupBy(x => x.Assignment.ActorPositionGuid
    //                    ?? x.Assignment.FollowerPositionGuid
    //                    ?? Guid.Empty)
    //        // اگر Guid.Empty تولید می‌شود یعنی داده‌ی ناقص/Mapping مشکل دارد؛ این‌ها را حذف کن
    //        .Where(g => g.Key != Guid.Empty)
    //        .Select(g =>
    //        {
    //            var positionGuid = g.Key;
    //            var positionName = GetPositionNameByGuid(positionGuid, positionDict);

    //            var assignments = g.Select(x => x.Assignment).ToList();

    //            var pendingCount = assignments.Count(a => a.ActionStatus == ActionStatus.Pending);
    //            var inProgressCount = assignments.Count(a => a.ActionStatus == ActionStatus.InProgress);
    //            var completedCount = assignments.Count(a => a.ActionStatus == ActionStatus.End);

    //            var overdueCount = assignments.Count(a =>
    //                a.DueDate.HasValue &&
    //                a.DueDate.Value.Date < DateTime.Now.Date &&
    //                a.ActionStatus != ActionStatus.End);

    //            var total = assignments.Count;
    //            var totalMeetings = g.Select(x => x.Resolution.MeetingId).Distinct().Count();
    //            var completionPercentage = total > 0 ? (double)completedCount / total * 100 : 0;

    //            return new PositionResolutionSummary
    //            {
    //                PositionName = positionName,
    //                PositionGuid = positionGuid,
    //                TotalResolutions = total,
    //                TotalMeetings = totalMeetings,
    //                CompletedResolutions = completedCount,
    //                InProgressResolutions = inProgressCount,
    //                NotStartedResolutions = pendingCount,
    //                OverdueResolutions = overdueCount,
    //                CompletionPercentage = Math.Round(completionPercentage, 2)
    //            };
    //        })
    //        .OrderBy(x => x.PositionName)
    //        .ToList();

    //    var summary = new ResolutionSummaryReportDto
    //    {
    //        // اگر TotalResolutions باید بر اساس فیلترهای Summary باشد:
    //        TotalResolutions = summaryItems.Select(x => x.Resolution.Id).Distinct().Count(),
    //        PositionSummaries = positionSummaries
    //    };


    //    // ------------------------
    //    // خروجی نهایی
    //    // ------------------------
    //    var result = new ResolutionReportDto
    //    {
    //        Summary = summary,
    //        Details = details
    //    };

    //    return Result<ResolutionReportDto>.EmptyMessage(result);
    //}

    // ═══════════════════════════════════════════════════════════════════════════════
    // ✅ متد جدید: گزارش اقدامات مصوبات
    // ═══════════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// دریافت گزارش اقدامات مصوبات یک جلسه
    /// </summary>
    public async Task<Result<MeetingActionsReportDto>> Handle(GetActionsReportQuery condition)
    {
        var access = await accessService.GetAsync(condition.MeetingGuid);
        if (!access.Can(MeetingCapability.ViewFollowUps))
            return Result<MeetingActionsReportDto>.Failure(null!, DeniedMessage);

        // دریافت اطلاعات جلسه
        var meeting = await context.Meetings
            .Include(m => m.Category)
            .Where(m => m.Guid == condition.MeetingGuid)
            .Select(m => new
            {
                m.Guid,
                m.Number,
                m.Title,
                m.Date,
                CategoryTitle = m.Category != null ? m.Category.Title : "",
                CategoryGuid = m.Category.Guid
            })
            .FirstOrDefaultAsync();

        if (meeting == null)
        {
            return Result<MeetingActionsReportDto>.Failure(null, "جلسه یافت نشد");
        }

        // تعیین جلسه هیئت مدیره - GUID دسته‌بندی هیئت مدیره را اینجا قرار دهید
        var isBoardMeeting = MeetingKinds.IsBoard(meeting.CategoryGuid);

        // Query مصوبات با فیلتر اختیاری
        var resolutionsQuery = context.Resolutions
            .Include(r => r.AssignedMembers)
                .ThenInclude(a => a.Actions)
            .Where(r => r.Meeting.Guid == condition.MeetingGuid);

        // فیلتر بر اساس ResolutionId (اگر مشخص شده)
        if (condition.ResolutionId.HasValue)
        {
            resolutionsQuery = resolutionsQuery.Where(r => r.Id == condition.ResolutionId.Value);
        }

        var resolutions = await resolutionsQuery
            .OrderBy(r => r.SortOrder)
            .ToListAsync();

        // جمع‌آوری همه UserGuid ها برای دریافت نام‌ها
        var allUserGuids = resolutions
            .SelectMany(r => r.AssignedMembers)
            .SelectMany(a => new[] { a.ActorGuid, a.FollowerGuid })
            .Where(g => g.HasValue)
            .Distinct()
            .ToList();

        // دریافت CreatedBy اقدامات
        var actionCreatorGuids = resolutions
            .SelectMany(r => r.AssignedMembers)
            .SelectMany(a => a.Actions)
            .Select(act => (Guid?)act.CreatedBy)
            .Distinct()
            .ToList();

        allUserGuids.AddRange(actionCreatorGuids);
        allUserGuids = allUserGuids.Distinct().ToList();

        // دریافت اطلاعات کاربران
        var users = await userManagementAclService.GetUsersByGuidsAsync(allUserGuids);
        var userList = users.GroupBy(c => new { c.Guid, c.Fullname }).ToList();
        var usersDict = userList.ToDictionary(u => u.Key.Guid, u => u.Key.Fullname);

        // دریافت اطلاعات سمت‌ها
        var usersWithPositions = await userManagementAclService.GetUserAndPositionsByGuidsAsync(allUserGuids);
        var positionList = usersWithPositions.GroupBy(c => new { c.PositionGuid, c.Position }).Distinct().ToList();
        var positionsDict = positionList.ToDictionary(u => u.Key.PositionGuid, u => u.Key.Position ?? "");

        // ساخت لیست مصوبات
        var resolutionItems = new List<ResolutionActionsItemDto>();
        int totalAssignments = 0;
        int totalActions = 0;
        int completedAssignments = 0;
        int inProgressAssignments = 0;
        int pendingAssignments = 0;

        foreach (var resolution in resolutions)
        {
            var assignmentItems = new List<AssignmentActionsItemDto>();

            // فیلتر تخصیص‌ها (اگر AssignmentId مشخص شده)
            var assignments = resolution.AssignedMembers
                .Where(a => !a.IsReferral);

            if (condition.AssignmentId.HasValue)
            {
                assignments = assignments.Where(a => a.Id == condition.AssignmentId.Value);
            }

            foreach (var assignment in assignments)
            {
                totalAssignments++;

                // شمارش وضعیت‌ها
                switch (assignment.ActionStatus)
                {
                    case ActionStatus.End:
                        completedAssignments++;
                        break;
                    case ActionStatus.InProgress:
                        inProgressAssignments++;
                        break;
                    case ActionStatus.Pending:
                    default:
                        pendingAssignments++;
                        break;
                }

                // دریافت نام اقدام‌کننده
                var actorName = assignment.ActorGuid.HasValue &&
                    usersDict.TryGetValue(assignment.ActorGuid.Value, out var aName)
                    ? aName : "نامشخص";

                // دریافت سمت اقدام‌کننده
                var actorPosition = assignment.ActorPositionGuid.HasValue &&
                    positionsDict.TryGetValue(assignment.ActorPositionGuid.Value, out var aPos)
                    ? aPos : "";

                // دریافت نام پیگیری‌کننده
                var followerName = assignment.FollowerGuid.HasValue &&
                    usersDict.TryGetValue(assignment.FollowerGuid.Value, out var fName)
                    ? fName : "نامشخص";

                // ساخت لیست اقدامات
                var actionItems = new List<ActionItemDto>();
                var sortedActions = assignment.Actions
                    .OrderByDescending(a => a.Created)
                    .ToList();

                foreach (var action in sortedActions)
                {
                    totalActions++;

                    var createdByName = action.CreatedBy != null &&
                        usersDict.TryGetValue(action.CreatedBy, out var cName)
                        ? cName : "نامشخص";

                    actionItems.Add(new ActionItemDto
                    {
                        ActionId = (int)action.Id,
                        ActionDate = action.ActionDate.ToString("yyyy/MM/dd") ?? action.Created.ToString("yyyy/MM/dd"),
                        ActionText = action.Description ?? "",
                        ActionStatus = action.Status ?? ActionStatus.Pending,
                        Result = action.Status == ActionStatus.End ? assignment.Result : null,
                        CreatedBy = createdByName,
                        CreatedAt = action.Created.ToString("yyyy/MM/dd HH:mm"),
                    });
                }

                var lastAction = sortedActions.FirstOrDefault();

                assignmentItems.Add(new AssignmentActionsItemDto
                {
                    AssignmentId = (int)assignment.Id,
                    ActorName = actorName,
                    ActorPosition = actorPosition,
                    FollowerName = followerName,
                    Type = assignment.Type.GetDisplayName(),
                    DueDate = assignment.DueDate?.ToString("yyyy/MM/dd") ?? "نامشخص",
                    ActionStatus = assignment.ActionStatus ?? ActionStatus.Pending,
                    Result = assignment.ActionStatus == ActionStatus.End ? assignment.Result : null,
                    LastActionDate = lastAction?.Created.ToString("yyyy/MM/dd"),
                    TotalActions = actionItems.Count,
                    Actions = actionItems
                });
            }

            resolutionItems.Add(new ResolutionActionsItemDto
            {
                ResolutionId = (int)resolution.Id,
                ResolutionNumber = resolution.Number ?? "",
                ResolutionTitle = resolution.Title ?? "",
                ResolutionText = resolution.Text ?? "",
                DecisionsMade = resolution.DecisionsMade ?? "",
                Documentation = resolution.Documentation ?? "",
                Assignments = assignmentItems,
                TotalAssignments = assignmentItems.Count
            });
        }

        // ساخت خلاصه
        var summary = new ActionsReportSummaryDto
        {
            TotalResolutions = resolutionItems.Count,
            TotalAssignments = totalAssignments,
            TotalActions = totalActions,
            CompletedAssignments = completedAssignments,
            InProgressAssignments = inProgressAssignments,
            PendingAssignments = pendingAssignments
        };

        // ساخت نتیجه نهایی
        var result = new MeetingActionsReportDto
        {
            MeetingGuid = meeting.Guid.ToString(),
            MeetingNumber = meeting.Number ?? "",
            MeetingTitle = meeting.Title ?? "",
            MeetingDate = meeting.Date?.ToString("yyyy/MM/dd") ?? "",
            MeetingCategory = meeting.CategoryTitle,
            IsBoardMeeting = isBoardMeeting,
            Resolutions = resolutionItems,
            Summary = summary
        };

        return Result<MeetingActionsReportDto>.EmptyMessage(result);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // متدهای کمکی موجود
    // ═══════════════════════════════════════════════════════════════════════════════

    private string GetPositionName(UserPositionHelper user, Dictionary<Guid, UserPositionHelper> positionDict)
    {
        if (user == null) return "نامشخص";
        return positionDict.TryGetValue(user.PositionGuid, out var userPos)
            ? userPos.Position
            : "سایر سمت‌ها";
    }
    private Guid GetPositionGuid(Guid? userGuid, Dictionary<Guid, UserPositionHelper> positionDict)
    {
        if (!userGuid.HasValue) return Guid.Empty;
        return positionDict.TryGetValue(userGuid.Value, out var userPos)
            ? userPos.PositionGuid
            : Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"); // سایر سمت‌ها
    }

    private string GetPositionNameByGuid(Guid positionGuid, Dictionary<Guid, UserPositionHelper> positionDict)
    {
        var userPos = positionDict.Values.FirstOrDefault(p => p.PositionGuid == positionGuid);
        return userPos?.Position ?? "سایر سمت‌ها";
    }
    private async Task<Dictionary<Guid, UserPositionHelper>> GetUserPositionMapping(List<UserPositionHelper> users)
    {
        var result = new Dictionary<Guid, UserPositionHelper>();
        foreach (var user in users)
        {
            if (user != null && user.PositionGuid != Guid.Empty)
            {
                result[user.PositionGuid] = user;
            }
            else
            {
                // fallback -> سایر سمت‌ها
                result[user.PositionGuid] = new UserPositionHelper
                {
                    Guid = user.Guid,
                    PositionGuid = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
                    Position = "سایر سمت‌ها",
                    Name = user.Name,
                    UserName = user.UserName
                };
            }
        }
        return result;
    }

    private string GetDepartmentName(UserViewHelper user, Dictionary<Guid, UnitViewHelper> departmentDict)
    {
        if (user == null) return "نامشخص";

        return departmentDict.TryGetValue(user.Guid, out var dept)
            ? dept.Title
            : "سایر ادارات";
    }
    private async Task<Dictionary<Guid, UnitViewHelper>> GetUserDepartmentMapping(List<UserViewHelper> users)
    {
        var result = new Dictionary<Guid, UnitViewHelper>();

        // گرفتن Guid همه‌ی کاربران
        var userGuids = users.Select(u => (Guid?)u.Guid).ToList();

        // گرفتن Unit هر کاربر از SSO
        var units = await userManagementAclService.GetUnitsByGuidsAsync(userGuids);

        // ساخت دیکشنری از Guid کاربر به Unit
        foreach (var user in users)
        {
            var unit = units.FirstOrDefault(u => u.Guid == user.UnitGuid);
            if (unit != null)
            {
                result[user.Guid] = unit;
            }
            else
            {
                // fallback -> سایر ادارات
                result[user.Guid] = new UnitViewHelper
                {
                    Guid = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
                    Id = 0,
                    Title = "سایر ادارات"
                };
            }
        }

        return result;
    }

    private Guid GetDepartmentGuid(Guid? userGuid, Dictionary<Guid, UnitViewHelper> departmentDict)
    {
        if (!userGuid.HasValue) return Guid.Empty;

        return departmentDict.TryGetValue(userGuid.Value, out var dept)
            ? dept.Guid
            : Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"); // سایر ادارات
    }

    private string GetDepartmentNameByGuid(Guid departmentGuid, Dictionary<Guid, UnitViewHelper> departmentDict)
    {
        var dept = departmentDict.Values.FirstOrDefault(d => d.Guid == departmentGuid);
        return dept?.Title ?? "سایر ادارات";
    }

    private static string GetResultText(ActionStatus? actionStatus, ActionFollowStatus? followStatus, Domain.ActionAgg.Action lastAction, Assignment assignment)
    {
        if (assignment.Result != null)
        {
            return assignment.ResultDescription;
        }
        else if (lastAction != null && !string.IsNullOrEmpty(lastAction.Description))
        {
            return lastAction.Description;
        }

        return "بدون نتیجه";
    }

    async Task<Result<int>> IQueryHandlerAsync<Result<int>, Guid>.Handle(Guid condition)
    {
        var access = await accessService.GetAsync(condition);
        if (!access.Can(MeetingCapability.ViewResolutions))
            return Result<int>.Failure(0, DeniedMessage);

        // شماره‌های غیرعددی نادیده گرفته می‌شوند (قبلاً int.Parse خطا می‌داد)
        var numbers = await context.Resolutions.AsNoTracking()
            .Where(r => r.MeetingId == access.MeetingId && r.Number != null)
            .Select(r => r.Number!)
            .ToListAsync();
        var max = numbers.Select(n => int.TryParse(n.Trim(), out var v) ? v : 0).DefaultIfEmpty(0).Max();
        return Result<int>.Success(max + 1);
    }

    private const string DeniedMessage = "شما به مصوبات این جلسه دسترسی ندارید.";

    /// <summary>
    /// مصوباتی که کاربر می‌تواند ببیند: جلسه‌اش برای او قابل مشاهده است (اعضا به‌جز مهمان، ثبت‌کننده، دسترسی‌های سیستمی)
    /// یا در یکی از تخصیص‌های «ابلاغ‌شده»ی آن نقش دارد.
    /// </summary>
    private async Task<System.Linq.Expressions.Expression<Func<Resolution, bool>>> VisibleResolutionsAsync()
    {
        var identity = await identityResolver.ResolveAsync();
        var position = identity.PositionGuid ?? Guid.Empty;
        var visibleMeetings = context.Meetings.VisibleTo(identity, includeGuests: false).Select(m => m.Id);
        var myAssignments = context.Assignments.Published()
            .Where(a => a.ActorPositionGuid == position || a.FollowerPositionGuid == position || a.ReferrerPositionGuid == position)
            .Select(a => a.ResolutionId);

        return r => visibleMeetings.Contains(r.MeetingId) || myAssignments.Contains(r.Id);
    }
}
