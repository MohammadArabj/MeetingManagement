using Epc.Application.Query;
using Epc.Company.Query;
using Epc.Dapper;
using Epc.Identity;
using MeetingManagement.Application.Contracts.Assignment;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.AssignmentAgg;
using MeetingManagement.Domain.CategoryAgg;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Action;
using MeetingManagement.Infrastructure.Query.Contracts.Assignment;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using MeetingManagement.Domain.Shared.Access;

namespace MeetingManagement.Infrastructure.Query;

public class AssignmentQueryHandler(
    MeetingManagementQueryContext context,
    BaseDapperRepository dapper,
    IUserManagementAclService userManagementAclService,
    ICategoryRepository categoryRepository,
    IClaimHelper claimHelper,
    IConfiguration configuration) :
    IQueryHandlerAsync<Result<AssignmentDto>, AssignmentSearchWitPositionDto>,
    IQueryHandlerAsync<Result<List<AssignmentListDto>>, AssignmentSearchDto>,
    IQueryHandlerAsync<Result<AssignmentCountDto>, Guid>,
    IQueryHandlerAsync<Result<AssignmentResolutionDetails>, int>,
    IQueryHandlerAsync<Result<List<AssignmentReferralListDto>>, int>,
    IQueryHandlerAsync<Result<AssignmentTreeDto>, int>,
    IQueryHandlerAsync<Result<List<AssignmentListDto>>, Guid>,
    IQueryHandlerAsync<Result<List<AssignmentListDto>>, AssignmentListGuidDto>,
    IQueryHandlerAsync<Result<OriginalAssignmentCountsDto>, Guid>,
    IQueryHandlerAsync<Result<ReferralCountsDto>, AssignmentListGuidDto>,
    IQueryHandlerAsync<Result<ReferralCountsDto>, Guid>,
    IQueryHandlerAsync<Result<PendingActionCountsDto>, Guid>,
    IQueryHandlerAsync<Result<FollowerActorsActionCountsDto>,AssignmentGuid>,
    IQueryHandlerAsync<Result<List<AssignmentActorDto>>>
{
    #region GetById - دریافت جزئیات یک تخصیص
    public async Task<Result<AssignmentDto>> Handle(AssignmentSearchWitPositionDto condition)
    {
        var currentUserGuid = claimHelper.GetCurrentUserGuid();
        var categoryGuid = Guid.Parse(configuration["BoardCategoryGuid"]);
        var categoryId = await context.Categories
            .Where(c => c.Guid == categoryGuid)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        var query = context.Assignments
            .Include(a => a.Resolution)
                .ThenInclude(r => r.Label)
            .Include(a => a.Resolution)
                .ThenInclude(c => c.Meeting)
                .ThenInclude(meeting => meeting.Category)
            .Include(a => a.Actions)
            .Where(c => c.Id == condition.Id);

        var assignmentRaw = await query.FirstOrDefaultAsync();
        if (assignmentRaw == null)
            return Result<AssignmentDto>.EmptyMessage(null);

        // --- پیدا کردن ریشه و وضعیت اقدام ریشه ---
        var rootId = await FindRootAssignmentId(assignmentRaw.Id);
        var rootStatus = await context.Assignments
            .Where(a => a.Id == rootId)
            .Select(a => a.ActionStatus)
            .FirstOrDefaultAsync();

        var effectiveStatus = rootStatus ?? assignmentRaw.ActionStatus ?? ActionStatus.Pending;
        var isMainAssignment = !assignmentRaw.ParentAssignmentId.HasValue;
        var isCurrentUserActor = assignmentRaw.ActorPositionGuid == condition.PositionGuid;

        var userGuids = new[] { assignmentRaw.ActorGuid, assignmentRaw.FollowerGuid, assignmentRaw.ReferrerGuid }
            .Where(g => g.HasValue)
            .Distinct()
            .ToList();

        var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);
        var userDictionary = users.ToDictionary(u => u.Guid, u => new { u.Fullname, u.UserName });

        var referralCounts = await context.Assignments
            .Where(a => a.ParentAssignmentId == assignmentRaw.Id)
            .GroupBy(a => a.ParentAssignmentId)
            .Select(g => new { ParentId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ParentId, x => x.Count);

        // نتیجه فقط وقتی معتبر است که اقدام End شده باشد
        var hasResult = effectiveStatus == ActionStatus.End;

        var result = new AssignmentDto
        {
            Id = assignmentRaw.Id,
            ActorGuid = assignmentRaw.ActorGuid,
            ActorPositionGuid = assignmentRaw.ActorPositionGuid,
            FollowerGuid = assignmentRaw.FollowerGuid,
            DueDate = assignmentRaw.DueDate?.ToString("yyyy/MM/dd") ?? "نامشخص",
            Type = assignmentRaw.Type,
            TypeName = assignmentRaw.Type.ToString(),
            ResolutionId = assignmentRaw.ResolutionId,
            ParentAssignmentId = assignmentRaw.ParentAssignmentId,
            ReferrerGuid = assignmentRaw.ReferrerGuid,
            IsReferral = assignmentRaw.IsReferral,
            ReferralNote = assignmentRaw.ReferralNote,
            Resolution = RemoveHtmlTags(assignmentRaw.Resolution?.Text ?? "نامشخص"),
            DecisionsMade = RemoveHtmlTags(assignmentRaw.Resolution?.DecisionsMade ?? "نامشخص"),
            MeetingDate = assignmentRaw.Resolution?.Meeting?.Date?.ToString("yyyy/MM/dd") ?? "نامشخص",
            Actor = assignmentRaw.ActorGuid.HasValue && userDictionary.TryGetValue(assignmentRaw.ActorGuid.Value, out var value) ? value.Fullname : "",
            Follower = assignmentRaw.FollowerGuid.HasValue && userDictionary.TryGetValue(assignmentRaw.FollowerGuid.Value, out var value1) ? value1.Fullname : "",
            IsFollower = assignmentRaw.FollowerPositionGuid == condition.PositionGuid,
            IsActor = assignmentRaw.ActorPositionGuid == condition.PositionGuid,
            Number = assignmentRaw.Resolution?.Number ?? "",
            Title = assignmentRaw.Resolution?.Title ?? "",
            Category = assignmentRaw.Resolution?.Meeting?.Category?.Title ?? "",
            MeetingNumber = assignmentRaw.Resolution?.Meeting?.Number ?? "نامشخص",
            MeetingTitle = assignmentRaw.Resolution?.Meeting?.Title ?? "نامشخص",

            // 🔹 وضعیت اقدام: بر اساس ریشه
            ActionStatus = effectiveStatus.GetDisplayName(),
            Status = effectiveStatus,

            FollowStatus = assignmentRaw.FollowStatus.GetDisplayName(),
            FollowStatusId = assignmentRaw.FollowStatus ?? 0,
            IsBoardMeeting = assignmentRaw.Resolution?.Meeting?.Category?.Guid == categoryGuid,
            ReferrerName = assignmentRaw.ReferrerGuid.HasValue && userDictionary.TryGetValue(assignmentRaw.ReferrerGuid.Value, out var referrerName) ? referrerName.Fullname : "",
            ReferralDate = assignmentRaw.ReferralDate?.ToString("yyyy/MM/dd") ?? "",
            ReferralsCount = referralCounts.TryGetValue(assignmentRaw.Id, out var count) ? count : 0,

            // 🔹 فقط اگر اقدام‌کننده اصلی و اقدام پایان‌نیافته
            CanRefer = isMainAssignment && isCurrentUserActor && effectiveStatus != ActionStatus.End,

            // فیلدهای نتیجه – فقط در صورت End بودن
            ActionResult = hasResult ? assignmentRaw.Result.ToString() : "",
            ResultName = hasResult ? assignmentRaw.Result.GetDisplayName() : "",
            ResultDate = hasResult ? (assignmentRaw.ResultDate?.ToString("yyyy/MM/dd") ?? "") : "",
            ResultDescription = hasResult ? assignmentRaw.ResultDescription : ""
        };

        return Result<AssignmentDto>.Success(result);
    }


    #endregion

    async Task<Result<PendingActionCountsDto>> IQueryHandlerAsync<Result<PendingActionCountsDto>, Guid>.Handle(Guid condition)
    {
        var categoryGuid = Guid.Parse(configuration["BoardCategoryGuid"]);
        var categoryId = await context.Categories
            .Where(c => c.Guid == categoryGuid)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        var now = DateTime.Now;

        var baseQuery = context.Assignments
            .Where(a => a.FollowerPositionGuid == condition)
            .Where(a => a.Resolution.Meeting.CategoryId == categoryId &&
                        (a.Resolution.Meeting.StatusId == MeetingStatusIds.Completed ||
                         a.Resolution.Meeting.MeetingMembers.Any(x => x.RoleId == MeetingRoles.ChairmanId && x.IsSign == true)));

        // همه موارد مهم برای پیگیری‌کننده
        var relevant = baseQuery
            .Where(a =>
                a.ActionStatus == ActionStatus.InProgress ||
                (a.ActionStatus == ActionStatus.End && a.Result == AssignmentResult.NotDone) ||
                (a.DueDate.HasValue && a.DueDate.Value < now && a.ActionStatus != ActionStatus.End));

        var aggregate = await relevant
            .GroupBy(a => 1)
            .Select(g => new
            {
                Total = g.Count(),
                InProgress = g.Count(a => a.ActionStatus == ActionStatus.InProgress),
                NotDone = g.Count(a => a.ActionStatus == ActionStatus.End &&
                                       a.Result == AssignmentResult.NotDone),
                Overdue = g.Count(a => a.DueDate.HasValue &&
                                       a.DueDate.Value < now &&
                                       a.ActionStatus != ActionStatus.End)
            })
            .FirstOrDefaultAsync();

        var byActorList = await relevant
            .Where(a => a.ActorGuid.HasValue)
            .GroupBy(a => a.ActorGuid.Value)
            .Select(g => new
            {
                ActorGuid = g.Key,
                Count = g.Count()
            })
            .ToListAsync();

        var result = new PendingActionCountsDto
        {
            Total = aggregate?.Total ?? 0,
            InProgress = aggregate?.InProgress ?? 0,
            NotDone = aggregate?.NotDone ?? 0,
            Overdue = aggregate?.Overdue ?? 0,
            ByActor = byActorList.ToDictionary(x => x.ActorGuid.ToString(), x => x.Count)
        };

        return Result<PendingActionCountsDto>.Success(result);
    }

    #region GetList - دریافت لیست تخصیص‌ها با فیلترهای پیشرفته

    public async Task<Result<List<AssignmentListDto>>> Handle(AssignmentSearchDto condition)
    {
        var currentUserGuid = claimHelper.GetCurrentUserGuid();
        var categoryGuid = Guid.Parse(configuration["BoardCategoryGuid"]);
        var categoryId = await context.Categories
            .Where(c => c.Guid == categoryGuid)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        var query = context.Assignments
            .Include(a => a.Resolution)
                .ThenInclude(r => r.Label)
            .Include(a => a.Resolution)
                .ThenInclude(c => c.Meeting)
                .ThenInclude(meeting => meeting.Category)
            .Include(a => a.Actions)
            .Where(c => c.Resolution.Meeting.CategoryId == categoryId && c.Resolution.Meeting.StatusId == MeetingStatusIds.Completed ||
                   c.Resolution.Meeting.MeetingMembers.Any(x => (x.RoleId == MeetingRoles.ChairmanId && x.IsSign == true)));

        // ==================== فیلتر نوع نمایش ====================
        query = ApplyViewTypeFilter(query, condition);

        // ==================== فیلتر نقش ====================
        query = ApplyRoleFilter(query, condition);

        // ==================== فیلتر وضعیت اقدام ====================
        query = ApplyActionStatusFilter(query, condition);

        // ==================== فیلتر وضعیت پیگیری ====================
        query = ApplyFollowStatusFilter(query, condition);

        // ==================== فیلتر نتیجه ====================
        query = ApplyResultFilter(query, condition);

        // ==================== فیلتر گذشته از مهلت ====================
        query = ApplyOverdueFilter(query, condition);

        // اجرای Query
        var assignmentsRaw = await query.ToListAsync();

        // دریافت اطلاعات کاربران
        var userGuids = assignmentsRaw
            .SelectMany(a => new[] { a.ActorGuid, a.FollowerGuid, a.ReferrerGuid })
            .Where(g => g.HasValue)
            .Distinct()
            .ToList();
        var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);
        var userList = users.GroupBy(c => new { c.Guid, c.Fullname }).ToList();
        var userDictionary = userList.ToDictionary(u => u.Key.Guid, u => u.Key.Fullname);

        // شمارش ارجاعات
        var assignmentIds = assignmentsRaw.Select(a => a.Id).ToList();
        var referralCounts = await context.Assignments
            .Where(a => assignmentIds.Contains(a.ParentAssignmentId ?? 0))
            .GroupBy(a => a.ParentAssignmentId)
            .Select(g => new { ParentId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ParentId, x => x.Count);

        // ساخت DTO
        try
        {
            var assignments = assignmentsRaw.Select(a => new AssignmentListDto()
            {
                Id = a.Id,
                Resolution = !string.IsNullOrEmpty(a.Resolution.Text)?  a.Resolution?.Text : a.Resolution.DecisionsMade??"",
                MeetingDate = a.Resolution?.Meeting?.Date?.ToString("yyyy/MM/dd") ?? "نامشخص",
                Actor = a.ActorGuid.HasValue && userDictionary.TryGetValue(a.ActorGuid.Value, out var value)
                    ? value : "",
                Follower = a.FollowerGuid.HasValue && userDictionary.TryGetValue(a.FollowerGuid.Value, out var value1)
                    ? value1 : "",
                IsFollower = a.FollowerGuid == currentUserGuid,
                IsActor = a.ActorGuid == currentUserGuid,
                Number = a.Resolution.Number,
                Title = a.Resolution.Title ?? "",
                Category = a.Resolution.Meeting.Category.Title,
                MeetingNumber = a.Resolution?.Meeting?.Number ?? "نامشخص",
                MeetingTitle = a.Resolution?.Meeting?.Title ?? "نامشخص",
                DueDate = a.DueDate.Value.ToString("yyyy/MM/dd"),
                IsBoardMeeting = a.Resolution.Meeting.Category.Guid == categoryGuid,
                IsReferral = a.IsReferral,
                ReferrerName = a.ReferrerGuid.HasValue && userDictionary.TryGetValue(a.ReferrerGuid.Value, out var referrerName)
                    ? referrerName : "",
                ReferralDate = a.ReferralDate?.ToString("yyyy/MM/dd") ?? "",
                ParentAssignmentId = a.ParentAssignmentId,
                ReferralsCount = referralCounts.TryGetValue(a.Id, out var count) ? count : 0,
                CanRefer = !a.IsReferral
                           && a.ActorGuid == currentUserGuid
                           && a.ActionStatus != ActionStatus.End,
                ViewType = DetermineViewType(a, condition.PositionGuid),
                DisplayRole = DetermineDisplayRole(a, currentUserGuid),
                HasPendingAction = DeterminePendingAction(a),
                ActionStatus = a.ActionStatus.GetDisplayName(),
                Status = a.ActionStatus ?? 0,
                FollowStatus = a.FollowStatus?.GetDisplayName() ?? "",
                FollowStatusId = a.FollowStatus ?? 0,
                StatusDescription = GenerateStatusDescription(a, condition.PositionGuid),

                // فیلدهای نتیجه
                ActionResult = a.Result.ToString(),
                ResultName = a.Result.GetDisplayName(),
                ResultDate = a.ResultDate?.ToString("yyyy/MM/dd") ?? "",
                ResultDescription = a.ResultDescription ?? ""

            }).OrderByDescending(x=>x.Id).ToList();

            return Result<List<AssignmentListDto>>.Success(assignments);
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
        }
    }

    #endregion

    #region Filter Methods - متدهای فیلتر

    private IQueryable<Assignment> ApplyViewTypeFilter(IQueryable<Assignment> query, AssignmentSearchDto condition)
    {
        if (condition.ViewType.HasValue)
        {
            query = condition.ViewType.Value switch
            {
                AssignmentViewType.OriginalAssignment => query.Where(a =>
                    (a.ActorPositionGuid == condition.PositionGuid ||
                     a.FollowerPositionGuid == condition.PositionGuid) && !a.IsReferral),

                AssignmentViewType.ReceivedReferral => query.Where(a =>
                    a.ActorPositionGuid == condition.PositionGuid && a.IsReferral),

                AssignmentViewType.GivenReferral => query.Where(a =>
                    a.ReferrerPositionGuid == condition.PositionGuid),

                _ => query.Where(c => (c.ActorPositionGuid == condition.PositionGuid ||
                                    c.FollowerPositionGuid == condition.PositionGuid) && !c.IsReferral)
            };
        }
        else
        {
            query = query.Where(c => (c.ActorPositionGuid == condition.PositionGuid ||
                                    c.FollowerPositionGuid == condition.PositionGuid) && !c.IsReferral);
        }

        return query;
    }

    private IQueryable<Assignment> ApplyRoleFilter(IQueryable<Assignment> query, AssignmentSearchDto condition)
    {
        if (condition.Type != null)
        {
            query = condition.Type == ActionType.Action
                ? query.Where(a => a.ActorPositionGuid == condition.PositionGuid)
                : query.Where(a => a.FollowerPositionGuid == condition.PositionGuid);
        }

        return query;
    }

    private IQueryable<Assignment> ApplyActionStatusFilter(IQueryable<Assignment> query, AssignmentSearchDto condition)
    {
        if (condition.ActionStatus.HasValue)
        {
            var status = condition.ActionStatus.Value;
            query = query.Where(a => a.ActionStatus == status);

            // محدود کردن به اقدام‌کننده‌ها
            if (condition.Type == ActionType.Action ||
                condition.ViewType == AssignmentViewType.ReceivedReferral)
            {
                query = query.Where(a => a.ActorPositionGuid == condition.PositionGuid);
            }
        }

        return query;
    }

    private IQueryable<Assignment> ApplyFollowStatusFilter(IQueryable<Assignment> query, AssignmentSearchDto condition)
    {
        if (condition.ApprovalStatus.HasValue)
        {
            var status = condition.ApprovalStatus.Value;
            query = query.Where(a => a.FollowStatus == status);

            // محدود کردن به پیگیری‌کننده‌ها
            if (condition.Type == ActionType.Follow ||
                condition.ViewType == AssignmentViewType.GivenReferral)
            {
                query = query.Where(a => a.FollowerPositionGuid == condition.PositionGuid);
            }
        }

        return query;
    }

    private IQueryable<Assignment> ApplyResultFilter(IQueryable<Assignment> query, AssignmentSearchDto condition)
    {
        if (condition.Result.HasValue)
        {
            var result = condition.Result.Value;
            query = query.Where(a => a.Result == result && a.ActionStatus == ActionStatus.End);
        }

        return query;
    }

    private IQueryable<Assignment> ApplyOverdueFilter(IQueryable<Assignment> query, AssignmentSearchDto condition)
    {
        if (condition.OverdueOnly)
        {
            var currentDate = DateTime.Now;
            query = query.Where(a =>
                a.DueDate.HasValue &&
                a.DueDate.Value < currentDate &&
                a.ActionStatus != ActionStatus.End);
        }

        return query;
    }

    #endregion

    #region Helper Methods - متدهای کمکی

    private string RemoveHtmlTags(string input)
    {
        if (string.IsNullOrEmpty(input))
            return input;
        string noTags = Regex.Replace(input, "<.*?>", string.Empty);
        noTags = System.Net.WebUtility.HtmlDecode(noTags);
        return noTags.Trim();
    }

    private AssignmentViewType DetermineViewType(Assignment assignment, Guid positionGuid)
    {
        if (!assignment.IsReferral)
            return AssignmentViewType.OriginalAssignment;

        if (assignment.ActorPositionGuid == positionGuid && assignment.IsReferral)
            return AssignmentViewType.ReceivedReferral;

        if (assignment.ReferrerPositionGuid == positionGuid)
            return AssignmentViewType.GivenReferral;

        return AssignmentViewType.OriginalAssignment;
    }

    private static string DetermineDisplayRole(Assignment assignment, Guid currentUserGuid)
    {
        if (assignment.ActorGuid == currentUserGuid && assignment.FollowerGuid == currentUserGuid)
            return "اقدام‌کننده و پیگیری‌کننده";
        if (assignment.ActorGuid == currentUserGuid)
            return "اقدام‌کننده";
        if (assignment.FollowerGuid == currentUserGuid)
            return "پیگیری‌کننده";
        return assignment.ReferrerGuid == currentUserGuid ? "ارجاع‌دهنده" : "نامشخص";
    }

    private static bool DeterminePendingAction(Assignment assignment)
    {
        return !assignment.Actions.Any();
    }

    private string DetermineActionStatus(Assignment assignment)
    {
        return !assignment.Actions.Any() ? "منتظر اقدام" : assignment.ActionStatus.GetDisplayName();
    }

    private string GenerateStatusDescription(Assignment assignment, Guid positionGuid)
    {
        var viewType = DetermineViewType(assignment, positionGuid);
        return viewType switch
        {
            AssignmentViewType.OriginalAssignment => "اصلی",
            AssignmentViewType.ReceivedReferral => "دریافتی",
            AssignmentViewType.GivenReferral => "ارجاعی",
            _ => "تخصیص"
        };
    }

    #endregion

    #region GetCounts - دریافت آمار تخصیص‌ها

    public async Task<Result<AssignmentCountDto>> Handle(Guid condition)
    {
        var categoryGuid = Guid.Parse(configuration["BoardCategoryGuid"]);
        var categoryId = await context.Categories
            .Where(c => c.Guid == categoryGuid)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        var baseQuery = context.Assignments
            .Include(a => a.Actions)
            .Where(c => c.Resolution.Meeting.CategoryId == categoryId && c.Resolution.Meeting.StatusId == MeetingStatusIds.Completed ||
                   c.Resolution.Meeting.MeetingMembers.Any(x => (x.RoleId == MeetingRoles.ChairmanId && x.IsSign == true)))
            .Where(a => (a.ActorPositionGuid == condition || a.FollowerPositionGuid == condition) && !a.IsReferral);

        var searchDto = new AssignmentSearchDto { PositionGuid = condition, ViewType = null };
        var counts = await GetFilteredCounts(baseQuery, searchDto);

        var actionCounts = new ActionCounts
        {
            Pending = counts.PendingAction,
            InProgress = counts.InProgressAction,
            End = counts.CompletedAction,
            Overdue = counts.Overdue
        };

        var followCounts = new ActionCounts
        {
            Pending = counts.PendingFollow,
            InProgress = counts.InProgressFollow,
            End = counts.CompletedFollow
        };

        var result = new AssignmentCountDto
        {
            ActionCounts = actionCounts,
            FollowCounts = followCounts
        };

        return Result<AssignmentCountDto>.Success(result);
    }

    private static async Task<CountsResult> GetFilteredCounts(IQueryable<Assignment> baseQuery, AssignmentSearchDto? searchDto = null)
    {
        var currentDate = DateTime.Now;

        if (searchDto != null)
        {
            if (searchDto.ViewType.HasValue)
            {
                baseQuery = searchDto.ViewType.Value switch
                {
                    AssignmentViewType.OriginalAssignment => baseQuery.Where(a =>
                        (a.ActorPositionGuid == searchDto.PositionGuid ||
                         a.FollowerPositionGuid == searchDto.PositionGuid) && !a.IsReferral),
                    AssignmentViewType.ReceivedReferral => baseQuery.Where(a =>
                        a.ActorPositionGuid == searchDto.PositionGuid && a.IsReferral),
                    AssignmentViewType.GivenReferral => baseQuery.Where(a =>
                        a.ReferrerPositionGuid == searchDto.PositionGuid),
                    _ => baseQuery.Where(a =>
                        a.ActorPositionGuid == searchDto.PositionGuid ||
                        a.FollowerPositionGuid == searchDto.PositionGuid)
                };
            }

            if (searchDto.Type != null)
            {
                baseQuery = searchDto.Type == ActionType.Action
                    ? baseQuery.Where(a => a.ActorPositionGuid == searchDto.PositionGuid)
                    : baseQuery.Where(a => a.FollowerPositionGuid == searchDto.PositionGuid);
            }

            baseQuery = baseQuery
                .WhereIf(searchDto.ApprovalStatus != null, a => a.FollowStatus == searchDto.ApprovalStatus)
                .WhereIf(searchDto.ActionStatus.HasValue, a => a.ActionStatus == searchDto.ActionStatus);
        }

        var counts = await baseQuery
            .GroupBy(a => 1)
            .Select(g => new CountsResult
            {
                PendingAction = g.Count(a =>
                    a.ActionStatus == ActionStatus.Pending &&
                    a.ActorPositionGuid == searchDto.PositionGuid),
                InProgressAction = g.Count(a =>
                    a.ActionStatus == ActionStatus.InProgress &&
                    a.ActorPositionGuid == searchDto.PositionGuid),
                CompletedAction = g.Count(a =>
                    a.ActionStatus == ActionStatus.End &&
                    a.ActorPositionGuid == searchDto.PositionGuid),
                PendingFollow = g.Count(a =>
                    a.FollowStatus == ActionFollowStatus.Pending &&
                    a.FollowerPositionGuid == searchDto.PositionGuid),
                InProgressFollow = g.Count(a =>
                    a.FollowStatus == ActionFollowStatus.InProgress &&
                    a.FollowerPositionGuid == searchDto.PositionGuid),
                CompletedFollow = g.Count(a =>
                    a.FollowStatus == ActionFollowStatus.End &&
                    a.FollowerPositionGuid == searchDto.PositionGuid),
                Overdue = g.Count(a =>
                    a.DueDate.HasValue &&
                    a.DueDate.Value < currentDate &&
                    a.ActionStatus != ActionStatus.End)
            })
            .FirstOrDefaultAsync();

        return counts ?? new CountsResult();
    }

    private class CountsResult
    {
        public int PendingAction { get; set; }
        public int InProgressAction { get; set; }
        public int CompletedAction { get; set; }
        public int PendingFollow { get; set; }
        public int InProgressFollow { get; set; }
        public int CompletedFollow { get; set; }
        public int Overdue { get; set; }
    }

    #endregion

    #region Other Handlers - سایر هندلرها

    // بقیه متدها همان کد قبلی شما باقی می‌مانند
    // فقط متدهای اصلی Handle را بازنویسی کردم

    async Task<Result<AssignmentResolutionDetails>> IQueryHandlerAsync<Result<AssignmentResolutionDetails>, int>.Handle(int condition)
    {
        var currentGuid = claimHelper.GetCurrentUserGuid();
        var assignment = await context.Assignments
            .Include(assignment => assignment.Resolution)
            .ThenInclude(resolution => resolution.Meeting)
            .FirstOrDefaultAsync(c => c.Id == condition);

        if (assignment == null)
            return Result<AssignmentResolutionDetails>.Failure(null, "تخصیص یافت نشد");

        var resolution = assignment.Resolution;
        var meeting = resolution.Meeting;

        var result = new AssignmentResolutionDetails()
        {
            AssignmentId = condition,
            MeetingDate = meeting.Date?.ToString("yyyy/MM/dd"),
            MeetingNumber = meeting.Number,
            MeetingTitle = meeting.Title,
            ResolutionNumber = resolution.SortOrder ?? 0,
            ResolutionText = resolution.Text,
            IsFollower = assignment.FollowerGuid == currentGuid
        };

        return Result<AssignmentResolutionDetails>.Success(result);
    }
    async Task<Result<OriginalAssignmentCountsDto>> IQueryHandlerAsync<Result<OriginalAssignmentCountsDto>, Guid>.Handle(Guid positionGuid)
    {
        var categoryGuid = Guid.Parse(configuration["BoardCategoryGuid"]);
        var categoryId = await context.Categories
            .Where(c => c.Guid == categoryGuid)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        // اگر دسته هیئت‌مدیره پیدا نشد، صفر برمی‌گردونیم
        if (categoryId == 0)
            return Result<OriginalAssignmentCountsDto>.Success(new OriginalAssignmentCountsDto());

        // پایه: فقط تخصیص‌های اصلی مربوط به این پوزیشن
        var baseQuery = context.Assignments
            .Where(a => !a.IsReferral)
            .Where(a =>
               // a.Resolution.Meeting.CategoryId == categoryId &&
                (a.Resolution.Meeting.StatusId == MeetingStatusIds.Completed ||
                 a.Resolution.Meeting.MeetingMembers.Any(x => x.RoleId == MeetingRoles.ChairmanId && x.IsSign==true)))
            .Where(a => a.ActorPositionGuid == positionGuid || a.FollowerPositionGuid == positionGuid);

        // تعداد کل تخصیص‌های اصلی (اقدام + پیگیری)
        var totalOriginal = await baseQuery.CountAsync();

        // --- بخش اقدام‌ها (بر اساس ActorPositionGuid) ---
        var actionQuery = baseQuery.Where(a => a.ActorPositionGuid == positionGuid);

        var actionInProgress = await actionQuery
            .Where(a => a.ActionStatus == ActionStatus.InProgress)
            .CountAsync();

        var actionEnd = await actionQuery
            .Where(a => a.ActionStatus == ActionStatus.End)
            .CountAsync();

        var actionDone = await actionQuery
            .Where(a =>
                a.ActionStatus == ActionStatus.End &&
                a.Result == AssignmentResult.Done)
            .CountAsync();

        var actionNotDone = await actionQuery
            .Where(a =>
                a.ActionStatus == ActionStatus.End &&
                a.Result == AssignmentResult.NotDone)
            .CountAsync();

        // --- بخش پیگیری‌ها (بر اساس FollowerPositionGuid) ---
        var followQuery = baseQuery.Where(a => a.FollowerPositionGuid == positionGuid);

        var followingUp = await followQuery
            .Where(a => a.FollowStatus == ActionFollowStatus.InProgress)
            .CountAsync();

        var followUpEnd = await followQuery
            .Where(a => a.FollowStatus == ActionFollowStatus.End)
            .CountAsync();

        var notFollowedUp = await followQuery
            .Where(a => a.FollowStatus == null || a.FollowStatus == ActionFollowStatus.Pending)
            .CountAsync();

        var dto = new OriginalAssignmentCountsDto
        {
            TotalOriginal = totalOriginal,

            ActionInProgress = actionInProgress,
            ActionEnd = actionEnd,
            ActionDone = actionDone,
            ActionNotDone = actionNotDone,

            FollowingUp = followingUp,
            FollowUpEnd = followUpEnd,
            NotFollowedUp = notFollowedUp
        };

        return Result<OriginalAssignmentCountsDto>.Success(dto);
    }



    async Task<Result<ReferralCountsDto>> IQueryHandlerAsync<Result<ReferralCountsDto>, AssignmentListGuidDto>.Handle(AssignmentListGuidDto condition)
    {
        var categoryGuid = Guid.Parse(configuration["BoardCategoryGuid"]);
        var categoryId = await context.Categories
            .Where(c => c.Guid == categoryGuid)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        var now = DateTime.Now;

        var query = context.Assignments
            .Where(a => a.ActorPositionGuid == condition.Guid && a.IsReferral)
            .Where(a => 
                //a.Resolution.Meeting.CategoryId == categoryId &&
                        (a.Resolution.Meeting.StatusId == MeetingStatusIds.Completed ||
                         a.Resolution.Meeting.MeetingMembers.Any(x => x.RoleId == MeetingRoles.ChairmanId && x.IsSign==true)));

        var stats = await query
            .GroupBy(a => 1)
            .Select(g => new ReferralCountsDto
            {
                Total = g.Count(),
                Pending = g.Count(a => a.ActionStatus == ActionStatus.Pending),
                InProgress = g.Count(a => a.ActionStatus == ActionStatus.InProgress),
                Completed = g.Count(a => a.ActionStatus == ActionStatus.End),
                Overdue = g.Count(a =>
                    a.DueDate.HasValue &&
                    a.DueDate.Value < now &&
                    a.ActionStatus != ActionStatus.End)
            })
            .FirstOrDefaultAsync() ?? new ReferralCountsDto();

        return Result<ReferralCountsDto>.Success(stats);
    }


    async Task<Result<ReferralCountsDto>> IQueryHandlerAsync<Result<ReferralCountsDto>, Guid>.Handle(Guid condition)
    {
        var categoryGuid = Guid.Parse(configuration["BoardCategoryGuid"]);
        var categoryId = await context.Categories
            .Where(c => c.Guid == categoryGuid)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        var now = DateTime.Now;

        var query = context.Assignments
            .Where(a => a.ReferrerGuid == condition)     // ارجاع داده شده توسط این کاربر
            .Where(a => 
                //a.Resolution.Meeting.CategoryId == categoryId &&
                        (a.Resolution.Meeting.StatusId == MeetingStatusIds.Completed ||
                         a.Resolution.Meeting.MeetingMembers.Any(x => x.RoleId == MeetingRoles.ChairmanId && x.IsSign == true)));

        var stats = await query
            .GroupBy(a => 1)
            .Select(g => new ReferralCountsDto
            {
                Total = g.Count(),
                Pending = g.Count(a => a.ActionStatus == ActionStatus.Pending),
                InProgress = g.Count(a => a.ActionStatus == ActionStatus.InProgress),
                Completed = g.Count(a => a.ActionStatus == ActionStatus.End),
                Overdue = g.Count(a =>
                    a.DueDate.HasValue &&
                    a.DueDate.Value < now &&
                    a.ActionStatus != ActionStatus.End)
            })
            .FirstOrDefaultAsync() ?? new ReferralCountsDto();

        return Result<ReferralCountsDto>.Success(stats);
    }


    async Task<Result<List<AssignmentReferralListDto>>> IQueryHandlerAsync<Result<List<AssignmentReferralListDto>>, int>.Handle(int condition)
    {
        var query = from assignment in context.Assignments
                    where assignment.ParentAssignmentId == condition
                    select new
                    {
                        assignment.Id,
                        assignment.ActorGuid,
                        assignment.ActorPositionGuid,
                        assignment.ReferrerGuid,
                        assignment.ReferralDate,
                        assignment.ReferralNote,
                        assignment.DueDate,
                        assignment.ActionStatus,
                        assignment.FollowStatus
                    };

        var referralsRaw = await query.ToListAsync();
        if (!referralsRaw.Any())
            return Result<List<AssignmentReferralListDto>>.Success(new List<AssignmentReferralListDto>());

        var userGuids = referralsRaw
            .SelectMany(r => new[] { r.ActorGuid, r.ReferrerGuid })
            .Where(g => g.HasValue)
            .Distinct()
            .ToList();
        var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);
        var userDictionary = users.ToDictionary(u => u.Guid, u => u.Fullname);

        var referrals = referralsRaw.Select(r => new AssignmentReferralListDto
        {
            Id = r.Id,
            ActorName = r.ActorGuid.HasValue && userDictionary.TryGetValue(r.ActorGuid.Value, out var value)
                ? value : "",
            ActorGuid = r.ActorGuid.Value,
            ActorPositionGuid = r.ActorPositionGuid,
            ActorPositionTitle = "",
            ReferrerName = r.ReferrerGuid.HasValue && userDictionary.TryGetValue(r.ReferrerGuid.Value, out var value1)
                ? value1 : "",
            ReferralDate = r.ReferralDate?.ToString("yyyy/MM/dd") ?? "",
            ReferralNote = r.ReferralNote ?? "",
            DueDate = r.DueDate.Value.ToString("yyyy/MM/dd"),
            ActionStatus = r.ActionStatus?.GetDisplayName() ?? "",
            FollowStatus = r.FollowStatus?.GetDisplayName() ?? "",
            ActionStatusId = (int)(r.ActionStatus ?? 0),
            FollowStatusId = (int)(r.FollowStatus ?? 0),
            CanPerformAction = r.ActionStatus != ActionStatus.End,
            ActionsCount = context.Actions.Count(a => a.AssignmentId == r.Id && a.Type == ActionType.Action),
            FollowupsCount = context.Actions.Count(a => a.AssignmentId == r.Id && a.Type == ActionType.Follow)
        }).ToList();

        return Result<List<AssignmentReferralListDto>>.Success(referrals);
    }

    async Task<Result<AssignmentTreeDto>> IQueryHandlerAsync<Result<AssignmentTreeDto>, int>.Handle(int condition)
    {
        var assignment = await context.Assignments
            .Include(a => a.Resolution)
            .FirstOrDefaultAsync(a => a.Id == condition);

        if (assignment == null)
            return Result<AssignmentTreeDto>.Failure(null, "تخصیص یافت نشد");

        var rootId = await FindRootAssignmentId(condition);
        var tree = await BuildAssignmentTree(rootId, 0);

        return Result<AssignmentTreeDto>.Success(tree);
    }

    async Task<Result<List<AssignmentListDto>>> IQueryHandlerAsync<Result<List<AssignmentListDto>>, Guid>.Handle(Guid condition)
    {
        return await GetReferralsByUserGuid(condition);
    }

    public async Task<Result<List<AssignmentListDto>>> Handle(AssignmentListGuidDto condition)
    {
        return await GetReferralsByUserGuid(condition.Guid);
    }

    private async Task<Result<List<AssignmentListDto>>> GetReferralsByUserGuid(Guid userGuid)
    {
        var categoryGuid = Guid.Parse(configuration["BoardCategoryGuid"]);
        var categoryId = await context.Categories
            .Where(c => c.Guid == categoryGuid)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        var query = from assignment in context.Assignments
                    join resolution in context.Resolutions on assignment.ResolutionId equals resolution.Id
                    join meeting in context.Meetings on resolution.MeetingId equals meeting.Id
                    where assignment.ReferrerGuid == userGuid
                          && (meeting.CategoryId == categoryId && meeting.StatusId == MeetingStatusIds.Completed ||
                              meeting.MeetingMembers.Any(x => x.RoleId == MeetingRoles.ChairmanId && x.IsSign == true))
                    select assignment;

        var assignmentsRaw = await query
            .Include(a => a.Resolution)
                .ThenInclude(r => r.Meeting)
                .ThenInclude(m => m.Category)
            .ToListAsync();

        var userGuids = assignmentsRaw
            .SelectMany(a => new[] { a.ActorGuid, a.FollowerGuid, a.ReferrerGuid })
            .Where(g => g.HasValue)
            .Distinct()
            .ToList();
        var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);
        var userDictionary = users.ToDictionary(u => u.Guid, u => u.Fullname);

        var results = assignmentsRaw.Select(a => new AssignmentListDto
        {
            Id = a.Id,
            MeetingNumber = a.Resolution.Meeting.Number,
            MeetingDate = a.Resolution.Meeting.Date?.ToString("yyyy/MM/dd") ?? "",
            MeetingTitle = a.Resolution.Meeting.Title,
            Number = a.Resolution.Number,
            Title = a.Resolution.Title,
            Category = a.Resolution.Meeting.Category.Title,
            Resolution = a.Resolution.Text,
            DueDate = a.DueDate.Value.ToString("yyyy/MM/dd"),
            ActionStatus = a.ActionStatus?.GetDisplayName() ?? "",
            FollowStatus = a.FollowStatus?.GetDisplayName() ?? "",
            Status = (a.ActionStatus ?? 0),
            FollowStatusId = (a.FollowStatus ?? 0),
            IsFollower = false,
            IsBoardMeeting = a.Resolution.Meeting.Category.Guid == categoryGuid,
            IsReferral = true,
            ReferralDate = a.ReferralDate?.ToString("yyyy/MM/dd") ?? "",
            ParentAssignmentId = a.ParentAssignmentId,
            Actor = a.ActorGuid.HasValue && userDictionary.TryGetValue(a.ActorGuid.Value, out var value)
                ? value : "",
            CanRefer = true,
            ActionResult = a.Result.ToString(),
            ResultName = a.Result.GetDisplayName(),
            ResultDate = a.ResultDate?.ToString("yyyy/MM/dd") ?? "",
            ResultDescription = a.ResultDescription ?? ""
        }).ToList();

        return Result<List<AssignmentListDto>>.Success(results);
    }

    #endregion

    #region Tree Methods - متدهای مربوط به درخت ارجاعات

    private class DicModel
    {
        public string FullName { get; set; }
        public string PersonalNo { get; set; }
    }
    private async Task<AssignmentTreeDto> BuildAssignmentTree(
    int assignmentId,
    int level,
    Dictionary<Guid, DicModel> globalUserDictionary = null)
    {
        var categoryGuid = Guid.Parse(configuration["BoardCategoryGuid"]);

        var assignment = await context.Assignments
            .Include(x => x.Resolution)
                .ThenInclude(r => r.Meeting)
                    .ThenInclude(m => m.Category)
            .Include(x => x.Resolution)
                .ThenInclude(r => r.Meeting)
                    .ThenInclude(m => m.MeetingMembers) // <-- مهم: برای SignedAt رئیس
            .Include(a => a.Actions)
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == assignmentId);

        if (assignment == null)
            return null;

        if (globalUserDictionary == null)
        {
            var allUserGuids = await GetAllUserGuidsInTree(assignmentId);
            var users = await userManagementAclService.GetUsersByGuidsAsync(allUserGuids);
            globalUserDictionary = users.ToDictionary(
                u => u.Guid,
                u => new DicModel { FullName = u.Fullname, PersonalNo = u.UserName }
            );
        }

        var children = await context.Assignments
            .AsNoTracking()
            .Where(a => a.ParentAssignmentId == assignmentId)
            .Select(a => a.Id)
            .ToListAsync();

        // ---------- تاریخ‌ها ----------
        DateTime? assignmentBaseDate = null;

        var meeting = assignment.Resolution?.Meeting;
        if (meeting != null)
        {
            var isBoardMeeting = meeting.Category != null && meeting.Category.Guid == categoryGuid;

            if (isBoardMeeting)
            {
                // هیئت مدیره: فقط اگر جلسه پایان یافته باشد
                assignmentBaseDate = meeting.EndDate; // DateTime?
            }
            else
            {
                // غیر هیئت مدیره: SignedAt رئیس جلسه (RoleId=3)
                var chairman = meeting.MeetingMembers?.FirstOrDefault(mm => mm.RoleId == MeetingRoles.ChairmanId);
                assignmentBaseDate = chairman?.SignedAt;
            }
        }

        string FormatDate(DateTime? dt) => dt.HasValue ? dt.Value.ToString("yyyy/MM/dd") : "";

        // ReferralDate فقط برای ارجاع‌ها
        var referralDateStr = assignment.IsReferral
            ? FormatDate(assignment.ReferralDate)
            : "";

        // AssignmentDate برای حالت اصلی
        var assignmentDateStr = !assignment.IsReferral
            ? FormatDate(assignmentBaseDate)
            : FormatDate(assignmentBaseDate); // اگر خواستی حتی برای ارجاع‌ها هم پایه را داشته باشی

        // ---------- Actions / Followups ----------
        var actions = assignment.Actions
            .Where(a => a.Type == ActionType.Action)
            .Select(a => new ActionListDto
            {
                Id = a.Id,
                Description = a.Description,
                Type = a.Type.ToString(),
                Date = a.ActionDate.ToString("yyyy/MM/dd"),
                UserName = globalUserDictionary.TryGetValue(a.UserGuid, out var u) ? u.FullName : ""
            })
            .ToList();

        var followups = assignment.Actions
            .Where(a => a.Type == ActionType.Follow)
            .Select(a => new ActionListDto
            {
                Id = a.Id,
                Description = a.Description,
                Type = a.Type.ToString(),
                Date = a.ActionDate.ToString("yyyy/MM/dd"),
                UserName = globalUserDictionary.TryGetValue(a.UserGuid, out var u) ? u.FullName : ""
            })
            .ToList();

        var treeNode = new AssignmentTreeDto
        {
            Id = assignment.Id,

            ActorName = assignment.ActorGuid.HasValue &&
                        globalUserDictionary.TryGetValue(assignment.ActorGuid.Value, out var a1)
                            ? a1.FullName : "",

            ReferrerName = assignment.ReferrerGuid.HasValue &&
                           globalUserDictionary.TryGetValue(assignment.ReferrerGuid.Value, out var r1)
                               ? r1.FullName : "",

            ActorPersonalNo = assignment.ActorGuid.HasValue &&
                              globalUserDictionary.TryGetValue(assignment.ActorGuid.Value, out var a2)
                                  ? a2.PersonalNo : "",

            ReferralDate = referralDateStr,        // فقط ارجاع
            AssignmentDate = assignmentDateStr,    // ابلاغ/پایه

            ReferralNote = assignment.ReferralNote ?? "",
            ActionStatus = assignment.ActionStatus?.GetDisplayName() ?? "",
            FollowStatus = assignment.FollowStatus?.GetDisplayName() ?? "",
            IsReferral = assignment.IsReferral,
            Level = level,
            Actions = actions,
            Followups = followups,
            Children = new List<AssignmentTreeDto>()
        };

        foreach (var childId in children)
        {
            var child = await BuildAssignmentTree(childId, level + 1, globalUserDictionary);
            if (child != null)
                treeNode.Children.Add(child);
        }

        return treeNode;
    }

    //private async Task<AssignmentTreeDto> BuildAssignmentTree(int assignmentId, int level, Dictionary<Guid, DicModel> globalUserDictionary = null)
    //{

    //    var assignment = await context.Assignments
    //        .Include(x=>x.Resolution)
    //        .ThenInclude(x=>x.Meeting)
    //        .ThenInclude(x=>x.Category)
    //        .Include(a => a.Actions)
    //        .FirstOrDefaultAsync(a => a.Id == assignmentId);
    //    var categoryGuid = Guid.Parse(configuration["BoardCategoryGuid"]);
    //    if (assignment == null)
    //        return null;

    //    if (globalUserDictionary == null)
    //    {
    //        var allUserGuids = await GetAllUserGuidsInTree(assignmentId);
    //        var users = await userManagementAclService.GetUsersByGuidsAsync(allUserGuids);
    //        globalUserDictionary = users.ToDictionary(u => u.Guid, u => new DicModel()
    //        {
    //            FullName = u.Fullname,
    //            PersonalNo = u.UserName
    //        });
    //    }

    //    var children = await context.Assignments
    //        .Where(a => a.ParentAssignmentId == assignmentId)
    //        .Select(a => a.Id)
    //        .ToListAsync();

    //    var currentUserGuid = claimHelper.GetCurrentUserGuid();
    //    var actions = assignment.Actions
    //        .Where(a => a.Type == ActionType.Action)
    //        .Select(a => new ActionListDto
    //        {
    //            Id = a.Id,
    //            Description = a.Description,
    //            Type = a.Type.ToString(),
    //            Date = a.ActionDate.ToString("yyyy/MM/dd"),
    //            UserName = globalUserDictionary.TryGetValue(a.UserGuid, out var userName)
    //                ? userName.FullName : ""
    //        }).ToList();

    //    var followups = assignment.Actions
    //        .Where(a => a.Type == ActionType.Follow)
    //        .Select(a => new ActionListDto
    //        {
    //            Id = a.Id,
    //            Description = a.Description,
    //            Type = a.Type.ToString(),
    //            Date = a.ActionDate.ToString("yyyy/MM/dd"),
    //            UserName = globalUserDictionary.TryGetValue(a.UserGuid, out var userName)
    //                ? userName.FullName : ""
    //        }).ToList();

    //    var treeNode = new AssignmentTreeDto
    //    {
    //        Id = assignment.Id,
    //        ActorName = assignment.ActorGuid.HasValue && globalUserDictionary.TryGetValue(assignment.ActorGuid.Value, out var value)
    //            ? value.FullName : "",
    //        ReferrerName = assignment.ReferrerGuid.HasValue && globalUserDictionary.TryGetValue(assignment.ReferrerGuid.Value, out var value1)
    //            ? value1.FullName : "",
    //        ActorPersonalNo = assignment.ActorGuid.HasValue && globalUserDictionary.TryGetValue(assignment.ActorGuid.Value, out var value2)
    //            ? value2.PersonalNo : "",
    //        ReferralDate = assignment.ReferralDate?.ToString("yyyy/MM/dd") ?? "",
    //        ReferralNote = assignment.ReferralNote ?? "",
    //        ActionStatus = assignment.ActionStatus?.GetDisplayName() ?? "",
    //        FollowStatus = assignment.FollowStatus?.GetDisplayName() ?? "",
    //        IsReferral = assignment.IsReferral,
    //        Level = level,
    //        Actions = actions,
    //        Followups = followups,
    //        Children = new List<AssignmentTreeDto>()
    //    };

    //    foreach (var childId in children)
    //    {
    //        var child = await BuildAssignmentTree(childId, level + 1, globalUserDictionary);
    //        if (child != null)
    //            treeNode.Children.Add(child);
    //    }

    //    return treeNode;
    //}

    private async Task<List<Guid?>> GetAllUserGuidsInTree(int rootAssignmentId)
    {
        var allGuids = new List<Guid?>();
        var allAssignments = dapper.Select<Assignment>(@"
            WITH AssignmentTree AS (
                SELECT Id, ActorGuid, FollowerGuid, ReferrerGuid, ParentAssignmentId,
                       ActionStatus, ActorPositionGuid, Created, CreatedBy, FollowStatus, DueDate
                FROM Assignments
                WHERE Id = @assignmentId
                UNION ALL
                SELECT a.Id, a.ActorGuid, a.FollowerGuid, a.ReferrerGuid, a.ParentAssignmentId,
                       a.ActionStatus, a.ActorPositionGuid, a.Created, a.CreatedBy, a.FollowStatus, a.DueDate
                FROM Assignments a
                INNER JOIN AssignmentTree t ON a.ParentAssignmentId = t.Id
            )
            SELECT * FROM AssignmentTree", new { assignmentId = rootAssignmentId });

        foreach (var assignment in allAssignments)
        {
            allGuids.AddRange([assignment.ActorGuid, assignment.FollowerGuid, assignment.ReferrerGuid]);
        }

        var assignmentIds = allAssignments.Select(a => a.Id).ToList();
        var actionUserGuids = await context.Actions
            .Where(a => assignmentIds.Contains(a.AssignmentId))
            .Select(a => a.UserGuid)
            .ToListAsync();

        allGuids.AddRange(actionUserGuids.Cast<Guid?>());
        return allGuids.Where(g => g.HasValue).Distinct().ToList();
    }

    private async Task<int> FindRootAssignmentId(int assignmentId)
    {
        var current = await context.Assignments.FirstOrDefaultAsync(a => a.Id == assignmentId);
        while (current?.ParentAssignmentId != null)
        {
            current = await context.Assignments.FirstOrDefaultAsync(a => a.Id == current.ParentAssignmentId);
        }
        return current?.Id ?? assignmentId;
    }

    #endregion

    public async Task<Result<FollowerActorsActionCountsDto>> Handle(AssignmentGuid condition)
    {
        var categoryGuid = Guid.Parse(configuration["BoardCategoryGuid"]);

        var categoryId = await context.Categories
            .Where(c => c.Guid == categoryGuid)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        if (categoryId == 0)
            return Result<FollowerActorsActionCountsDto>.Success(new FollowerActorsActionCountsDto());

        var now = DateTime.Now;

        // من پیگیری‌کننده هستم -> وضعیت اقدامِ اقدام‌کننده‌ها را می‌خواهم
        var query = context.Assignments
            .AsNoTracking()
            .Where(a => a.FollowerPositionGuid == condition.Guid)
            .Where(a =>
                //a.Resolution.Meeting.CategoryId == categoryId &&
                        (a.Resolution.Meeting.StatusId == MeetingStatusIds.Completed ||
                         a.Resolution.Meeting.MeetingMembers.Any(x => x.RoleId == MeetingRoles.ChairmanId && x.IsSign == true)));

        var stats = await query
            .GroupBy(_ => 1)
            .Select(g => new FollowerActorsActionCountsDto
            {
                Total = g.Count(),
                Pending = g.Count(a => a.ActionStatus == ActionStatus.Pending),
                InProgress = g.Count(a => a.ActionStatus == ActionStatus.InProgress),
                End = g.Count(a => a.ActionStatus == ActionStatus.End),
                Overdue = g.Count(a =>
                    a.DueDate.HasValue &&
                    a.DueDate.Value < now &&
                    a.ActionStatus != ActionStatus.End)
            })
            .FirstOrDefaultAsync() ?? new FollowerActorsActionCountsDto();

        return Result<FollowerActorsActionCountsDto>.Success(stats);
    }

    public async Task<Result<List<AssignmentActorDto>>> Handle()
    {
        var categoryGuid = Guid.Parse(configuration["BoardCategoryGuid"]);

        // اگر متد آماده در categoryRepository داری، همینجا جایگزینش کن:
        // var categoryId = await categoryRepository.GetIdByGuidAsync(categoryGuid);
        var categoryId = await context.Categories
            .Where(c => c.Guid == categoryGuid)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        if (categoryId == 0)
            return Result<List<AssignmentActorDto>>.Success(new List<AssignmentActorDto>());

        // فقط تخصیص‌های اصلی (نه ارجاعی) که مربوط به جلسات هیئت‌مدیره هستن
        var raw = await context.Assignments
            .Where(a => !a.IsReferral)
            .Where(a => a.Resolution.Meeting.CategoryId == categoryId)
            .Where(a => a.ActorGuid.HasValue)
            .Select(a => new { a.ActorGuid, a.ActorPositionGuid })
            .Distinct()
            .ToListAsync();

        var positionGuids = raw.Select(x => x.ActorPositionGuid).Distinct().ToList();
        var users = await userManagementAclService.GetPositionsByGuidsAsync(positionGuids);
        var userDict = users.ToDictionary(u => u.Guid, u => u.Title);

        var result = raw
            .GroupBy(x => x.ActorPositionGuid)
            .Select(g => new AssignmentActorDto
            {
                ActorPositionGuid = g.Key.Value,
                ActorName = g.Select(x => x.ActorPositionGuid.HasValue && userDict.TryGetValue(x.ActorPositionGuid.Value, out var name) ? name : "")
                             .FirstOrDefault(n => !string.IsNullOrEmpty(n)) ?? ""
            })
            .Where(x => !string.IsNullOrEmpty(x.ActorName))
            .OrderBy(x => x.ActorName)
            .ToList();

        return Result<List<AssignmentActorDto>>.Success(result);
    }
  
}
      