using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Assignment;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.AssignmentAgg;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Action;
using MeetingManagement.Infrastructure.Query.Contracts.Assignment;
using MeetingManagement.Infrastructure.Query.Security;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Query;

/// <summary>
/// کارتابل تخصیص‌ها و ارجاع‌ها.
/// ─────────────────────────────────────────────────────────────────────────
/// رابطه‌ی هر ردیف با کاربر (سمت فعال P) یکی از این‌هاست:
///   • تخصیص اصلی     : !IsReferral و (اقدام‌کننده == P یا پیگیری‌کننده == P)
///   • ارجاع دریافتی  : ارجاع باز و اقدام‌کننده == P
///   • ارجاع ارسالی   : ارجاع باز و ارجاع‌دهنده == P
/// «همه» = تخصیص‌های اصلی + ارجاع‌های دریافتی. ارجاع‌های ارسالی فقط در زبانه‌ی خودشان می‌آیند؛
/// قبلاً ارجاع‌دهنده هم تخصیص اصلی و هم ارجاعی که داده بود را (به‌عنوان پیگیری‌کننده) می‌دید.
/// ارجاع فقط تا وقتی باز است در کارتابل می‌ماند؛ با پایان تخصیص اصلی از کارتابل همه‌ی ارجاع‌گیرندگان خارج می‌شود.
/// شمارنده‌ها و فهرست‌ها از همین قوانین (<see cref="QueryScopes"/>) استفاده می‌کنند تا همیشه یکی باشند.
/// سمت و کاربر همیشه از هویت راستی‌آزمایی‌شده گرفته می‌شوند، نه از پارامتر درخواست.
/// </summary>
public class AssignmentQueryHandler(
    MeetingManagementQueryContext context,
    IUserManagementAclService userManagementAclService,
    IActingIdentityResolver identityResolver,
    IMeetingAccessService accessService) :
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
    IQueryHandlerAsync<Result<FollowerActorsActionCountsDto>, AssignmentGuid>,
    IQueryHandlerAsync<Result<List<AssignmentActorDto>>>
{
    private const string NotFoundMessage = "تخصیص یافت نشد.";
    private const string DeniedMessage = "شما به این تخصیص دسترسی ندارید.";

    // ═══════════════════════════════════════════════════════════
    // جزئیات یک تخصیص
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<AssignmentDto>> Handle(AssignmentSearchWitPositionDto condition)
    {
        var assignment = await context.Assignments.AsNoTracking()
            .Include(a => a.Resolution).ThenInclude(r => r.Meeting).ThenInclude(m => m.Category)
            .FirstOrDefaultAsync(a => a.Id == condition.Id);
        if (assignment == null)
            return Result<AssignmentDto>.Failure(null, NotFoundMessage);

        var chain = await AssignmentAccessRules.LoadChainAsync(context, assignment.Id);
        var identity = await identityResolver.ResolveAsync();
        if (!await AssignmentAccessRules.CanViewAsync(accessService, assignment, chain, identity))
            return Result<AssignmentDto>.Failure(null, DeniedMessage);

        var position = identity.PositionGuid ?? Guid.Empty;
        var root = chain.Last();
        var rootEnded = root.ActionStatus == ActionStatus.End;
        var status = rootEnded ? ActionStatus.End : assignment.ActionStatus ?? ActionStatus.Pending;
        var isActor = assignment.ActorPositionGuid == position;
        var hasResult = assignment.ActionStatus == ActionStatus.End;

        var users = await GetUserNamesAsync([assignment.ActorGuid, assignment.FollowerGuid, assignment.ReferrerGuid]);
        var referralsCount = await context.Assignments.CountAsync(a => a.ParentAssignmentId == assignment.Id);
        var meeting = assignment.Resolution?.Meeting;

        return Result<AssignmentDto>.Success(new AssignmentDto
        {
            Id = assignment.Id,
            ActorGuid = assignment.ActorGuid,
            ActorPositionGuid = assignment.ActorPositionGuid,
            FollowerGuid = assignment.FollowerGuid,
            FollowerPositionGuid = assignment.FollowerPositionGuid,
            DueDate = assignment.DueDate?.ToString("yyyy/MM/dd") ?? "نامشخص",
            Type = assignment.Type,
            TypeName = assignment.Type.ToString(),
            ResolutionId = assignment.ResolutionId,
            ParentAssignmentId = assignment.ParentAssignmentId,
            ReferrerGuid = assignment.ReferrerGuid,
            IsReferral = assignment.IsReferral,
            ReferralNote = assignment.ReferralNote ?? "",
            Resolution = RemoveHtmlTags(assignment.Resolution?.Text ?? "نامشخص"),
            DecisionsMade = RemoveHtmlTags(assignment.Resolution?.DecisionsMade ?? "نامشخص"),
            MeetingGuid = meeting?.Guid,
            MeetingDate = meeting?.Date?.ToString("yyyy/MM/dd") ?? "نامشخص",
            MeetingNumber = meeting?.Number ?? "نامشخص",
            MeetingTitle = meeting?.Title ?? "نامشخص",
            Actor = NameOf(users, assignment.ActorGuid),
            Follower = NameOf(users, assignment.FollowerGuid),
            ReferrerName = NameOf(users, assignment.ReferrerGuid),
            IsFollower = assignment.FollowerPositionGuid == position,
            IsActor = isActor,
            Number = assignment.Resolution?.Number ?? "",
            Title = assignment.Resolution?.Title ?? "",
            Category = meeting?.Category?.Title ?? "",
            ActionStatus = status.GetDisplayName(),
            Status = status,
            FollowStatus = assignment.FollowStatus.GetDisplayName(),
            FollowStatusId = assignment.FollowStatus ?? ActionFollowStatus.Pending,
            IsBoardMeeting = MeetingKinds.IsBoard(meeting?.Category?.Guid),
            ReferralDate = assignment.ReferralDate?.ToString("yyyy/MM/dd") ?? "",
            ReferralsCount = referralsCount,
            // ارجاع‌گیرنده هم می‌تواند ارجاع دهد (زنجیره)، تا وقتی تخصیص اصلی باز است
            CanRefer = isActor && !rootEnded && assignment.ActionStatus != ActionStatus.End,
            ActionResult = hasResult ? assignment.Result.ToString() ?? "" : "",
            ResultName = hasResult ? assignment.Result.GetDisplayName() : "",
            ResultDate = hasResult ? assignment.ResultDate?.ToString("yyyy/MM/dd") ?? "" : "",
            ResultDescription = hasResult ? assignment.ResultDescription ?? "" : "",
        });
    }

    // ═══════════════════════════════════════════════════════════
    // فهرست کارتابل
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<List<AssignmentListDto>>> Handle(AssignmentSearchDto condition)
    {
        var position = await CurrentPositionAsync();
        var published = context.Assignments.AsNoTracking().Published();

        var query = (condition.ViewType ?? AssignmentViewType.All) switch
        {
            AssignmentViewType.OriginalAssignment => published.OriginalsOf(position),
            AssignmentViewType.ReceivedReferral => published.ReceivedReferralsOf(position),
            AssignmentViewType.GivenReferral => published.GivenReferralsOf(position),
            _ => published.Where(a =>
                (!a.IsReferral && (a.ActorPositionGuid == position || a.FollowerPositionGuid == position))
                || (a.IsReferral && a.ActorPositionGuid == position
                    && a.ActionStatus != ActionStatus.End
                    && (a.ParentAssignment == null || a.ParentAssignment.ActionStatus != ActionStatus.End))),
        };

        query = ApplyFilters(query, condition, position);

        var rows = await query
            .OrderByDescending(a => a.Id)
            .Select(a => new
            {
                a.Id,
                a.ActorGuid,
                a.ActorPositionGuid,
                a.FollowerGuid,
                a.FollowerPositionGuid,
                a.ReferrerGuid,
                a.ReferrerPositionGuid,
                a.IsReferral,
                a.ParentAssignmentId,
                a.ReferralDate,
                a.DueDate,
                a.ActionStatus,
                a.FollowStatus,
                a.Result,
                a.ResultDate,
                a.ResultDescription,
                HasActions = a.Actions.Any(),
                ReferralsCount = a.ReferredAssignments.Count(),
                a.Resolution.Text,
                a.Resolution.DecisionsMade,
                a.Resolution.Number,
                a.Resolution.Title,
                MeetingNumber = a.Resolution.Meeting.Number,
                MeetingTitle = a.Resolution.Meeting.Title,
                MeetingDate = a.Resolution.Meeting.Date,
                CategoryTitle = a.Resolution.Meeting.Category!.Title,
                CategoryGuid = (Guid?)a.Resolution.Meeting.Category!.Guid,
            })
            .ToListAsync();

        var users = await GetUserNamesAsync(rows.SelectMany(r => new[] { r.ActorGuid, r.FollowerGuid, r.ReferrerGuid }));

        var result = rows.Select(a =>
        {
            var viewType = !a.IsReferral
                ? AssignmentViewType.OriginalAssignment
                : a.ActorPositionGuid == position ? AssignmentViewType.ReceivedReferral : AssignmentViewType.GivenReferral;
            var isActor = a.ActorPositionGuid == position;
            var isFollower = a.FollowerPositionGuid == position;

            return new AssignmentListDto
            {
                Id = a.Id,
                Resolution = !string.IsNullOrEmpty(a.Text) ? a.Text : a.DecisionsMade ?? "",
                MeetingDate = a.MeetingDate?.ToString("yyyy/MM/dd") ?? "نامشخص",
                MeetingNumber = a.MeetingNumber ?? "نامشخص",
                MeetingTitle = a.MeetingTitle ?? "نامشخص",
                Actor = NameOf(users, a.ActorGuid),
                Follower = NameOf(users, a.FollowerGuid),
                ReferrerName = NameOf(users, a.ReferrerGuid),
                IsActor = isActor,
                IsFollower = isFollower,
                Number = a.Number ?? "",
                Title = a.Title ?? "",
                Category = a.CategoryTitle ?? "",
                DueDate = a.DueDate?.ToString("yyyy/MM/dd") ?? "",
                IsBoardMeeting = MeetingKinds.IsBoard(a.CategoryGuid),
                IsReferral = a.IsReferral,
                ReferralDate = a.ReferralDate?.ToString("yyyy/MM/dd") ?? "",
                ParentAssignmentId = a.ParentAssignmentId,
                ReferralsCount = a.ReferralsCount,
                CanRefer = isActor && a.ActionStatus != ActionStatus.End,
                ViewType = viewType,
                DisplayRole = viewType switch
                {
                    AssignmentViewType.GivenReferral => "ارجاع‌دهنده",
                    _ when isActor && isFollower => "اقدام‌کننده و پیگیری‌کننده",
                    _ when isActor => "اقدام‌کننده",
                    _ when isFollower => "پیگیری‌کننده",
                    _ => "نامشخص",
                },
                HasPendingAction = !a.HasActions,
                ActionStatus = a.ActionStatus.GetDisplayName(),
                Status = a.ActionStatus ?? ActionStatus.Pending,
                FollowStatus = a.FollowStatus?.GetDisplayName() ?? "",
                FollowStatusId = a.FollowStatus ?? ActionFollowStatus.Pending,
                StatusDescription = viewType switch
                {
                    AssignmentViewType.ReceivedReferral => "دریافتی",
                    AssignmentViewType.GivenReferral => "ارجاعی",
                    _ => "اصلی",
                },
                ActionResult = a.Result?.ToString() ?? "",
                ResultName = a.Result.GetDisplayName(),
                ResultDate = a.ResultDate?.ToString("yyyy/MM/dd") ?? "",
                ResultDescription = a.ResultDescription ?? "",
            };
        }).ToList();

        return Result<List<AssignmentListDto>>.Success(result);
    }

    private static IQueryable<Assignment> ApplyFilters(IQueryable<Assignment> query, AssignmentSearchDto condition, Guid position)
    {
        if (condition.Type == ActionType.Action)
            query = query.Where(a => a.ActorPositionGuid == position);
        else if (condition.Type == ActionType.Follow)
            query = query.Where(a => a.FollowerPositionGuid == position);

        var actionStatus = condition.ActionStatus ?? condition.PendingActionStatus;
        if (actionStatus.HasValue)
            query = query.Where(a => a.ActionStatus == actionStatus.Value);

        if (condition.ApprovalStatus.HasValue)
        {
            var followStatus = condition.ApprovalStatus.Value;
            query = followStatus == ActionFollowStatus.Pending
                ? query.Where(a => a.FollowStatus == null || a.FollowStatus == followStatus)
                : query.Where(a => a.FollowStatus == followStatus);
        }

        if (condition.Result.HasValue)
        {
            var result = condition.Result.Value;
            query = query.Where(a => a.ActionStatus == ActionStatus.End && a.Result == result);
        }

        if (condition.OverdueOnly)
        {
            var now = DateTime.Now;
            query = query.Where(a => a.DueDate.HasValue && a.DueDate.Value < now && a.ActionStatus != ActionStatus.End);
        }

        return query;
    }

    // ═══════════════════════════════════════════════════════════
    // شمارنده‌ها (همه بر اساس سمت راستی‌آزمایی‌شده؛ پارامتر ورودی نادیده گرفته می‌شود)
    // ═══════════════════════════════════════════════════════════

    /// <summary>اقدامات و پیگیری‌های من روی تخصیص‌های اصلی</summary>
    public async Task<Result<AssignmentCountDto>> Handle(Guid _)
    {
        var position = await CurrentPositionAsync();
        var now = DateTime.Now;

        var counts = await context.Assignments.AsNoTracking().Published().OriginalsOf(position)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                PendingAction = g.Count(a => a.ActorPositionGuid == position && (a.ActionStatus == null || a.ActionStatus == ActionStatus.Pending)),
                InProgressAction = g.Count(a => a.ActorPositionGuid == position && a.ActionStatus == ActionStatus.InProgress),
                EndAction = g.Count(a => a.ActorPositionGuid == position && a.ActionStatus == ActionStatus.End),
                OverdueAction = g.Count(a => a.ActorPositionGuid == position && a.DueDate < now && a.ActionStatus != ActionStatus.End),
                PendingFollow = g.Count(a => a.FollowerPositionGuid == position && (a.FollowStatus == null || a.FollowStatus == ActionFollowStatus.Pending)),
                InProgressFollow = g.Count(a => a.FollowerPositionGuid == position && a.FollowStatus == ActionFollowStatus.InProgress),
                EndFollow = g.Count(a => a.FollowerPositionGuid == position && a.FollowStatus == ActionFollowStatus.End),
            })
            .FirstOrDefaultAsync();

        return Result<AssignmentCountDto>.Success(new AssignmentCountDto
        {
            ActionCounts = new ActionCounts
            {
                Pending = counts?.PendingAction ?? 0,
                InProgress = counts?.InProgressAction ?? 0,
                End = counts?.EndAction ?? 0,
                Overdue = counts?.OverdueAction ?? 0,
            },
            FollowCounts = new ActionCounts
            {
                Pending = counts?.PendingFollow ?? 0,
                InProgress = counts?.InProgressFollow ?? 0,
                End = counts?.EndFollow ?? 0,
            },
        });
    }

    async Task<Result<OriginalAssignmentCountsDto>> IQueryHandlerAsync<Result<OriginalAssignmentCountsDto>, Guid>.Handle(Guid _)
    {
        var position = await CurrentPositionAsync();

        var counts = await context.Assignments.AsNoTracking().Published().OriginalsOf(position)
            .GroupBy(_ => 1)
            .Select(g => new OriginalAssignmentCountsDto
            {
                TotalOriginal = g.Count(),
                ActionInProgress = g.Count(a => a.ActorPositionGuid == position && a.ActionStatus == ActionStatus.InProgress),
                ActionEnd = g.Count(a => a.ActorPositionGuid == position && a.ActionStatus == ActionStatus.End),
                ActionDone = g.Count(a => a.ActorPositionGuid == position && a.ActionStatus == ActionStatus.End && a.Result == AssignmentResult.Done),
                ActionNotDone = g.Count(a => a.ActorPositionGuid == position && a.ActionStatus == ActionStatus.End && a.Result == AssignmentResult.NotDone),
                FollowingUp = g.Count(a => a.FollowerPositionGuid == position && a.FollowStatus == ActionFollowStatus.InProgress),
                FollowUpEnd = g.Count(a => a.FollowerPositionGuid == position && a.FollowStatus == ActionFollowStatus.End),
                NotFollowedUp = g.Count(a => a.FollowerPositionGuid == position && (a.FollowStatus == null || a.FollowStatus == ActionFollowStatus.Pending)),
            })
            .FirstOrDefaultAsync();

        return Result<OriginalAssignmentCountsDto>.Success(counts ?? new OriginalAssignmentCountsDto());
    }

    /// <summary>ارجاع‌های باز دریافتی</summary>
    async Task<Result<ReferralCountsDto>> IQueryHandlerAsync<Result<ReferralCountsDto>, AssignmentListGuidDto>.Handle(AssignmentListGuidDto _)
    {
        var position = await CurrentPositionAsync();
        return Result<ReferralCountsDto>.Success(
            await CountReferralsAsync(context.Assignments.AsNoTracking().Published().ReceivedReferralsOf(position)));
    }

    /// <summary>ارجاع‌های باز ارسالی</summary>
    async Task<Result<ReferralCountsDto>> IQueryHandlerAsync<Result<ReferralCountsDto>, Guid>.Handle(Guid _)
    {
        var position = await CurrentPositionAsync();
        return Result<ReferralCountsDto>.Success(
            await CountReferralsAsync(context.Assignments.AsNoTracking().Published().GivenReferralsOf(position)));
    }

    private static async Task<ReferralCountsDto> CountReferralsAsync(IQueryable<Assignment> query)
    {
        var now = DateTime.Now;
        return await query
            .GroupBy(_ => 1)
            .Select(g => new ReferralCountsDto
            {
                Total = g.Count(),
                Pending = g.Count(a => a.ActionStatus == null || a.ActionStatus == ActionStatus.Pending),
                InProgress = g.Count(a => a.ActionStatus == ActionStatus.InProgress),
                Completed = 0, // ارجاع پایان‌یافته در کارتابل نمی‌ماند
                Overdue = g.Count(a => a.DueDate < now),
            })
            .FirstOrDefaultAsync() ?? new ReferralCountsDto();
    }

    /// <summary>موارد نیازمند توجه پیگیری‌کننده در جلسات هیئت مدیره</summary>
    async Task<Result<PendingActionCountsDto>> IQueryHandlerAsync<Result<PendingActionCountsDto>, Guid>.Handle(Guid _)
    {
        var position = await CurrentPositionAsync();
        var boardGuid = SettingValues.BoardCategoryGuid;
        var now = DateTime.Now;

        var relevant = context.Assignments.AsNoTracking().Published()
            .Where(a => !a.IsReferral && a.FollowerPositionGuid == position && a.Resolution.Meeting.Category!.Guid == boardGuid)
            .Where(a => a.ActionStatus == ActionStatus.InProgress
                        || (a.ActionStatus == ActionStatus.End && a.Result == AssignmentResult.NotDone)
                        || (a.DueDate < now && a.ActionStatus != ActionStatus.End));

        var aggregate = await relevant
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                InProgress = g.Count(a => a.ActionStatus == ActionStatus.InProgress),
                NotDone = g.Count(a => a.ActionStatus == ActionStatus.End && a.Result == AssignmentResult.NotDone),
                Overdue = g.Count(a => a.DueDate < now && a.ActionStatus != ActionStatus.End),
            })
            .FirstOrDefaultAsync();

        var byActor = await relevant
            .Where(a => a.ActorGuid.HasValue)
            .GroupBy(a => a.ActorGuid!.Value)
            .Select(g => new { ActorGuid = g.Key, Count = g.Count() })
            .ToListAsync();

        return Result<PendingActionCountsDto>.Success(new PendingActionCountsDto
        {
            Total = aggregate?.Total ?? 0,
            InProgress = aggregate?.InProgress ?? 0,
            NotDone = aggregate?.NotDone ?? 0,
            Overdue = aggregate?.Overdue ?? 0,
            ByActor = byActor.ToDictionary(x => x.ActorGuid.ToString(), x => x.Count),
        });
    }

    /// <summary>وضعیت اقدامِ اقدام‌کنندگانِ تخصیص‌هایی که من پیگیری‌کننده‌ی آن‌ها هستم</summary>
    public async Task<Result<FollowerActorsActionCountsDto>> Handle(AssignmentGuid _)
    {
        var position = await CurrentPositionAsync();
        var now = DateTime.Now;

        var stats = await context.Assignments.AsNoTracking().Published()
            .Where(a => !a.IsReferral && a.FollowerPositionGuid == position)
            .GroupBy(_ => 1)
            .Select(g => new FollowerActorsActionCountsDto
            {
                Total = g.Count(),
                Pending = g.Count(a => a.ActionStatus == null || a.ActionStatus == ActionStatus.Pending),
                InProgress = g.Count(a => a.ActionStatus == ActionStatus.InProgress),
                End = g.Count(a => a.ActionStatus == ActionStatus.End),
                Overdue = g.Count(a => a.DueDate < now && a.ActionStatus != ActionStatus.End),
            })
            .FirstOrDefaultAsync();

        return Result<FollowerActorsActionCountsDto>.Success(stats ?? new FollowerActorsActionCountsDto());
    }

    // ═══════════════════════════════════════════════════════════
    // فهرست ارجاع‌های من (سازگاری با Endpointهای قبلی)
    // ═══════════════════════════════════════════════════════════

    /// <summary>ارجاع‌های باز دریافتی (GetMyReferrals)</summary>
    async Task<Result<List<AssignmentListDto>>> IQueryHandlerAsync<Result<List<AssignmentListDto>>, Guid>.Handle(Guid _) =>
        await Handle(new AssignmentSearchDto { ViewType = AssignmentViewType.ReceivedReferral });

    /// <summary>ارجاع‌های باز ارسالی (GetReferralsGivenByMe)</summary>
    public async Task<Result<List<AssignmentListDto>>> Handle(AssignmentListGuidDto _) =>
        await Handle(new AssignmentSearchDto { ViewType = AssignmentViewType.GivenReferral });

    // ═══════════════════════════════════════════════════════════
    // جزئیات مصوبه‌ی تخصیص / ارجاع‌های مستقیم / درخت ارجاع
    // ═══════════════════════════════════════════════════════════
    async Task<Result<AssignmentResolutionDetails>> IQueryHandlerAsync<Result<AssignmentResolutionDetails>, int>.Handle(int id)
    {
        var assignment = await context.Assignments.AsNoTracking()
            .Include(a => a.Resolution).ThenInclude(r => r.Meeting)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (assignment == null)
            return Result<AssignmentResolutionDetails>.Failure(null, NotFoundMessage);

        var identity = await identityResolver.ResolveAsync();
        if (!await AssignmentAccessRules.CanViewAsync(accessService, assignment, await AssignmentAccessRules.LoadChainAsync(context, id), identity))
            return Result<AssignmentResolutionDetails>.Failure(null, DeniedMessage);

        return Result<AssignmentResolutionDetails>.Success(new AssignmentResolutionDetails
        {
            AssignmentId = id,
            MeetingDate = assignment.Resolution.Meeting.Date?.ToString("yyyy/MM/dd") ?? "",
            MeetingNumber = assignment.Resolution.Meeting.Number ?? "",
            MeetingTitle = assignment.Resolution.Meeting.Title ?? "",
            ResolutionNumber = assignment.Resolution.SortOrder ?? 0,
            ResolutionText = assignment.Resolution.Text ?? "",
            IsFollower = assignment.FollowerPositionGuid == identity.PositionGuid,
        });
    }

    async Task<Result<List<AssignmentReferralListDto>>> IQueryHandlerAsync<Result<List<AssignmentReferralListDto>>, int>.Handle(int parentId)
    {
        var parent = await context.Assignments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == parentId);
        if (parent == null)
            return Result<List<AssignmentReferralListDto>>.Failure([], NotFoundMessage);

        var identity = await identityResolver.ResolveAsync();
        if (!await AssignmentAccessRules.CanViewAsync(accessService, parent, await AssignmentAccessRules.LoadChainAsync(context, parentId), identity))
            return Result<List<AssignmentReferralListDto>>.Failure([], DeniedMessage);

        var rows = await context.Assignments.AsNoTracking()
            .Where(a => a.ParentAssignmentId == parentId)
            .Select(a => new
            {
                a.Id,
                a.ActorGuid,
                a.ActorPositionGuid,
                a.ReferrerGuid,
                a.ReferralDate,
                a.ReferralNote,
                a.DueDate,
                a.ActionStatus,
                a.FollowStatus,
                ActionsCount = a.Actions.Count(x => x.Type == ActionType.Action),
                FollowupsCount = a.Actions.Count(x => x.Type == ActionType.Follow),
            })
            .ToListAsync();

        var users = await GetUserNamesAsync(rows.SelectMany(r => new[] { r.ActorGuid, r.ReferrerGuid }));
        var parentEnded = parent.ActionStatus == ActionStatus.End;

        return Result<List<AssignmentReferralListDto>>.Success(rows.Select(r => new AssignmentReferralListDto
        {
            Id = r.Id,
            ActorGuid = r.ActorGuid,
            ActorPositionGuid = r.ActorPositionGuid,
            ActorName = NameOf(users, r.ActorGuid),
            ActorPositionTitle = "",
            ReferrerName = NameOf(users, r.ReferrerGuid),
            ReferralDate = r.ReferralDate?.ToString("yyyy/MM/dd") ?? "",
            ReferralNote = r.ReferralNote ?? "",
            DueDate = r.DueDate?.ToString("yyyy/MM/dd") ?? "",
            ActionStatus = r.ActionStatus?.GetDisplayName() ?? "",
            FollowStatus = r.FollowStatus?.GetDisplayName() ?? "",
            ActionStatusId = (int)(r.ActionStatus ?? 0),
            FollowStatusId = (int)(r.FollowStatus ?? 0),
            CanPerformAction = !parentEnded && r.ActionStatus != ActionStatus.End,
            ActionsCount = r.ActionsCount,
            FollowupsCount = r.FollowupsCount,
        }).ToList());
    }

    async Task<Result<AssignmentTreeDto>> IQueryHandlerAsync<Result<AssignmentTreeDto>, int>.Handle(int assignmentId)
    {
        var assignment = await context.Assignments.AsNoTracking()
            .Include(a => a.Resolution)
            .FirstOrDefaultAsync(a => a.Id == assignmentId);
        if (assignment == null)
            return Result<AssignmentTreeDto>.Failure(null, NotFoundMessage);

        var chain = await AssignmentAccessRules.LoadChainAsync(context, assignmentId);
        if (!await AssignmentAccessRules.CanViewAsync(accessService, assignment, chain, await identityResolver.ResolveAsync()))
            return Result<AssignmentTreeDto>.Failure(null, DeniedMessage);

        // کل درخت مصوبه یک‌جا خوانده می‌شود (قبلاً برای هر گره یک Query جداگانه اجرا می‌شد)
        var rootId = chain.Last().Id;
        var all = await context.Assignments.AsNoTracking()
            .Where(a => a.ResolutionId == assignment.ResolutionId)
            .Include(a => a.Actions)
            .ToListAsync();

        var meeting = await context.Meetings.AsNoTracking()
            .Where(m => m.Id == assignment.Resolution.MeetingId)
            .Select(m => new
            {
                CategoryGuid = (Guid?)m.Category!.Guid,
                m.EndDate,
                ChairmanSignedAt = m.MeetingMembers.Where(mm => mm.RoleId == MeetingRoles.ChairmanId).Select(mm => mm.SignedAt).FirstOrDefault(),
            })
            .FirstOrDefaultAsync();
        var baseDate = meeting is null ? null : MeetingKinds.IsBoard(meeting.CategoryGuid) ? meeting.EndDate : meeting.ChairmanSignedAt;

        var users = await userManagementAclService.GetUsersByGuidsAsync(all
            .SelectMany(a => new[] { a.ActorGuid, a.FollowerGuid, a.ReferrerGuid }
                .Concat(a.Actions.Select(x => (Guid?)x.UserGuid)))
            .Where(g => g.HasValue).Distinct().ToList());
        var userInfo = users.GroupBy(u => u.Guid).ToDictionary(g => g.Key, g => g.First());

        AssignmentTreeDto? Build(int id, int level, HashSet<int> visited)
        {
            var node = all.FirstOrDefault(a => a.Id == id);
            if (node is null || !visited.Add(id)) return null;

            var dto = new AssignmentTreeDto
            {
                Id = node.Id,
                ActorName = node.ActorGuid is { } ag && userInfo.TryGetValue(ag, out var actor) ? actor.Fullname : "",
                ActorPersonalNo = node.ActorGuid is { } ag2 && userInfo.TryGetValue(ag2, out var actor2) ? actor2.UserName : "",
                ReferrerName = node.ReferrerGuid is { } rg && userInfo.TryGetValue(rg, out var referrer) ? referrer.Fullname : "",
                ReferralDate = node.IsReferral ? node.ReferralDate?.ToString("yyyy/MM/dd") ?? "" : "",
                AssignmentDate = baseDate?.ToString("yyyy/MM/dd") ?? "",
                ReferralNote = node.ReferralNote ?? "",
                ActionStatus = node.ActionStatus?.GetDisplayName() ?? "",
                FollowStatus = node.FollowStatus?.GetDisplayName() ?? "",
                IsReferral = node.IsReferral,
                Level = level,
                Actions = MapActions(node, ActionType.Action),
                Followups = MapActions(node, ActionType.Follow),
            };

            foreach (var child in all.Where(a => a.ParentAssignmentId == id).OrderBy(a => a.Id))
                if (Build(child.Id, level + 1, visited) is { } childDto)
                    dto.Children.Add(childDto);

            return dto;
        }

        List<ActionListDto> MapActions(Assignment node, ActionType type) => node.Actions
            .Where(a => a.Type == type)
            .OrderBy(a => a.ActionDate)
            .Select(a => new ActionListDto
            {
                Id = a.Id,
                Description = a.Description,
                Type = a.Type.ToString(),
                Date = a.ActionDate.ToString("yyyy/MM/dd"),
                UserName = userInfo.TryGetValue(a.UserGuid, out var u) ? u.Fullname : "",
            })
            .ToList();

        return Result<AssignmentTreeDto>.Success(Build(rootId, 0, []));
    }

    // ═══════════════════════════════════════════════════════════
    // اقدام‌کنندگان هیئت مدیره (برای فیلتر گزارش)
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<List<AssignmentActorDto>>> Handle()
    {
        var identity = await identityResolver.ResolveAsync();
        if (!identity.HasExplicitPermission(Common.Security.Permissions.BoardViewAll)
            && !identity.HasExplicitPermission(Common.Security.Permissions.BoardMembers))
            return Result<List<AssignmentActorDto>>.Success([]);

        var boardGuid = SettingValues.BoardCategoryGuid;
        var positionGuids = await context.Assignments.AsNoTracking()
            .Where(a => !a.IsReferral && a.ActorPositionGuid != null && a.Resolution.Meeting.Category!.Guid == boardGuid)
            .Select(a => a.ActorPositionGuid)
            .Distinct()
            .ToListAsync();

        var positions = await userManagementAclService.GetPositionsByGuidsAsync(positionGuids);
        var result = positions
            .Where(p => !string.IsNullOrEmpty(p.Title))
            .GroupBy(p => p.Guid)
            .Select(g => new AssignmentActorDto { ActorPositionGuid = g.Key, ActorName = g.First().Title })
            .OrderBy(x => x.ActorName)
            .ToList();

        return Result<List<AssignmentActorDto>>.Success(result);
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════
    private async Task<Guid> CurrentPositionAsync() =>
        (await identityResolver.ResolveAsync()).PositionGuid ?? Guid.Empty;

    private async Task<Dictionary<Guid, string>> GetUserNamesAsync(IEnumerable<Guid?> guids)
    {
        var list = guids.Where(g => g.HasValue).Distinct().ToList();
        if (list.Count == 0) return [];
        var users = await userManagementAclService.GetUsersByGuidsAsync(list);
        return users.GroupBy(u => u.Guid).ToDictionary(g => g.Key, g => g.First().Fullname);
    }

    private static string NameOf(Dictionary<Guid, string> users, Guid? guid) =>
        guid is { } g && users.TryGetValue(g, out var name) ? name : "";

    private static string RemoveHtmlTags(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;
        var noTags = Regex.Replace(input, "<.*?>", string.Empty);
        return System.Net.WebUtility.HtmlDecode(noTags).Trim();
    }
}
