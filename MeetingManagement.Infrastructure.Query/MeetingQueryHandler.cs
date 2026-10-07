using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Application.Contracts.Member;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Meeting;
using MeetingManagement.Infrastructure.Query.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Query;

/// <summary>
/// Queryهای جلسه.
/// ─────────────────────────────────────────────────────────────────────────
///   • همه‌ی فهرست‌ها (کارتابل، جستجو، تقویم، شمارنده‌ها، کمبو) با <see cref="QueryScopes.VisibleTo"/> محدود می‌شوند
///   • هر Query روی یک جلسه‌ی مشخص ابتدا دسترسی مشاهده را با <see cref="IMeetingAccessService"/> بررسی می‌کند
///   • سمت و کاربر همیشه از هویت راستی‌آزمایی‌شده خوانده می‌شود، نه از پارامتر درخواست
///   • عنوان جلساتی که کاربر اجازه‌ی دیدنشان را ندارد (مثلاً هیئت مدیره) در پیام تداخل نمایش داده نمی‌شود
/// </summary>
public class MeetingQueryHandler(
    MeetingManagementQueryContext context,
    IUserManagementAclService userManagementAclService,
    IActingIdentityResolver identityResolver,
    IMeetingAccessService accessService,
    ICurrentUser currentUser,
    IConfiguration configuration) :
    IQueryHandlerAsync<Result<List<MeetingJsonModel>>, MeetingListSearchDto>,
    IQueryHandlerAsync<Result<List<MeetingComboModel>>>,
    IQueryHandlerAsync<Result<MeetingJsonModel>, MeetingSearchDto>,
    IQueryHandlerAsync<Result<List<GuestComboDto>>, Guid>,
    IQueryHandlerAsync<Result<EditMeetingDto>, Guid>,
    IQueryHandlerAsync<Result<MeetingCountDto>, MeetingCountRequestDto>,
    IQueryHandlerAsync<Result<MeetingConflictResultDto>, MeetingConflictCheckDto>,
    IQueryHandlerAsync<Result<List<TodayMeetingDto>>, Guid>,
    IQueryHandlerAsync<Result<CheckMeetingDto>, Guid>,
    IQueryHandlerAsync<Result<List<MeetingCalendarDto>>, MeetingCalendarSearchDto>,
    IQueryHandlerAsync<Result<List<MeetingJsonModel>>, MeetingSearchRequestDto>,
    IQueryHandlerAsync<Result<bool>, CheckSignGuidDto>,
    IQueryHandlerAsync<Result<List<MeetingStatisticResultDto>>, MeetingStatisticRequestDto>,
    IQueryHandlerAsync<Result<List<ComboBase>>, MeetingGuidDto>,
    IQueryHandlerAsync<Result<CheckMeetingNumberResultDto>, CheckMeetingNumberDto>,
    IQueryHandlerAsync<Result<List<MeetingFutureDto>>, MeetingFutureRequestDto>,
    IQueryHandlerAsync<Result<List<SuggestedSlotDto>>, SuggestedSlotsRequestDto>
{
    private const string NotFoundMessage = "جلسه مورد نظر یافت نشد";
    private const string DeniedMessage = "شما به این جلسه دسترسی ندارید.";
    private const string HiddenMeetingTitle = "جلسه‌ی دیگر (محرمانه)";

    private static int GuestRoleId => MeetingRoles.GuestId;

    // ═══════════════════════════════════════════════════════════
    // فهرست جلسات (کارتابل)
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<List<MeetingJsonModel>>> Handle(MeetingListSearchDto condition)
    {
        var identity = await identityResolver.ResolveAsync();
        var query = ApplyFilter(context.Meetings.AsNoTracking().VisibleTo(identity, includeGuests: false), condition.FilterType, identity);
        var models = await ProjectListAsync(query.OrderByDescending(m => m.Date), identity);
        return Result<List<MeetingJsonModel>>.EmptyMessage(models);
    }

    private static IQueryable<Meeting> ApplyFilter(IQueryable<Meeting> query, FilterType filter, ActingIdentity identity)
    {
        var today = DateTime.Today;
        var position = identity.PositionGuid ?? Guid.Empty;
        var user = identity.UserGuid;
        var chairmanId = MeetingRoles.ChairmanId;

        return filter switch
        {
            FilterType.Today => query.Where(m => m.Date!.Value.Date == today),
            FilterType.Upcoming => query.Where(m => m.Date!.Value.Date > today
                                                    && m.StatusId != MeetingStatusIds.Cancelled),
            FilterType.Attendance => query.Where(m => m.StatusId == MeetingStatusIds.Registered && m.Date!.Value.Date >= today &&
                                                      m.MeetingMembers.Any(x => x.IsAttendance != true && x.PositionGuid == position)),
            FilterType.Signature => query.Where(m => m.StatusId == MeetingStatusIds.Finalized
                // امضای من باقی مانده
                && m.MeetingMembers.Any(mm => mm.PositionGuid == position && mm.UserGuid == user
                                              && mm.IsSign != true && mm.IsPresent == true)
                // رئیس امضا کرده، یا خودم رئیس هستم (نوبت من است)
                && (m.MeetingMembers.Any(mm => mm.RoleId == chairmanId && mm.IsSign == true)
                    || m.MeetingMembers.Any(mm => mm.PositionGuid == position && mm.UserGuid == user && mm.RoleId == chairmanId))),
            FilterType.Finished => query.Where(m => m.StatusId == MeetingStatusIds.Finalized),
            FilterType.Draft => query.Where(m => m.StatusId == MeetingStatusIds.Draft),
            FilterType.Canceled => query.Where(m => m.StatusId == MeetingStatusIds.Cancelled),
            FilterType.Undetermined => query.Where(m =>
                m.StatusId == MeetingStatusIds.Undetermined
                || ((m.StatusId == MeetingStatusIds.Draft || m.StatusId == MeetingStatusIds.Registered || m.StatusId == MeetingStatusIds.Held)
                    && m.Date!.Value.Date < today)),
            _ => query,
        };
    }

    // ═══════════════════════════════════════════════════════════
    // جستجوی پیشرفته
    // ═══════════════════════════════════════════════════════════
    async Task<Result<List<MeetingJsonModel>>> IQueryHandlerAsync<Result<List<MeetingJsonModel>>, MeetingSearchRequestDto>
        .Handle(MeetingSearchRequestDto condition)
    {
        var identity = await identityResolver.ResolveAsync();
        var startDate = condition.DateFrom.ToDateTimeNull();
        var endDate = condition.DateTo.ToDateTimeNull();
        var chairmanId = MeetingRoles.ChairmanId;
        var secretaryId = MeetingRoles.SecretaryId;
        var nonMemberSecretaryId = MeetingRoles.NonMemberSecretaryId;

        var query = context.Meetings.AsNoTracking().VisibleTo(identity)
            .WhereIf(!string.IsNullOrEmpty(condition.Title), x => EF.Functions.Like(x.Title, $"%{condition.Title}%"))
            .WhereIf(!string.IsNullOrEmpty(condition.Number), x => EF.Functions.Like(x.Number, $"%{condition.Number}%"))
            .WhereIf(!string.IsNullOrEmpty(condition.Agenda), x => x.Agendas.Any(c => EF.Functions.Like(c.Text, $"%{condition.Agenda}%")))
            .WhereIf(condition.StatusGuid != null, c => c.Status!.Guid == condition.StatusGuid)
            .WhereIf(condition.CategoryGuid != null, x => x.Category!.Guid == condition.CategoryGuid)
            .WhereIf(condition.RoomGuid != null, x => x.Room!.Guid == condition.RoomGuid)
            // رئیس/دبیر هم کاربر سیستمی (UserGuid) و هم عضو هیئت مدیره (BoardMember) می‌تواند باشد
            .WhereIf(condition.ChairmanGuid != null, x => x.MeetingMembers.Any(c =>
                (c.UserGuid == condition.ChairmanGuid || c.BoardMember!.Guid == condition.ChairmanGuid) && c.RoleId == chairmanId))
            .WhereIf(condition.SecretaryGuid != null, x => x.MeetingMembers.Any(c =>
                (c.UserGuid == condition.SecretaryGuid || c.BoardMember!.Guid == condition.SecretaryGuid)
                && (c.RoleId == secretaryId || c.RoleId == nonMemberSecretaryId)))
            .WhereIf(startDate != null, x => x.Date >= startDate)
            .WhereIf(endDate != null, x => x.Date <= endDate);

        var models = await ProjectListAsync(query.OrderByDescending(c => c.Id), identity);
        return Result<List<MeetingJsonModel>>.EmptyMessage(models);
    }

    private async Task<List<MeetingJsonModel>> ProjectListAsync(IQueryable<Meeting> query, ActingIdentity identity)
    {
        var rows = await query
            .Select(m => new MeetingProjection
            {
                Id = m.Id,
                Guid = m.Guid!.Value,
                Number = m.Number,
                Title = m.Title,
                StatusId = m.StatusId,
                AllowReplacement = m.NotAllowReplacement,
                Date = m.Date!.Value,
                StartTime = m.StartTime!.Value,
                EndTime = m.EndTime!.Value,
                StatusTitle = m.Status!.Title,
                RoomLink = m.RoomLink,
                RoomName = m.RoomName,
                RoomTitle = m.Room!.Title,
                CategoryTitle = m.Category!.Title,
                CategoryGuid = m.Category!.Guid,
                Description = m.Description,
                CreatedBy = m.CreatedBy,
                Created = m.Created!.Value.ToString("yyyy/MM/dd"),
                Rider = m.Rider,
                RiderGuid = m.RiderGuid,
                AllMembers = m.MeetingMembers.Select(mm => new MemberProjection
                {
                    RoleId = mm.RoleId ?? 0,
                    Name = mm.Name,
                    UserGuid = mm.UserGuid,
                    PositionGuid = mm.PositionGuid,
                    BoardMemberGuid = mm.BoardMember != null ? mm.BoardMember.Guid : null,
                    ReplacementUserGuid = mm.ReplacementUserGuid,
                    RoleTitle = mm.Role!.Title,
                }).ToList(),
            })
            .ToListAsync();

        var keyRoles = MeetingRoles.KeyRoleIds;
        var users = await GetUserNamesAsync(rows
            .SelectMany(m => m.AllMembers.Where(mm => keyRoles.Contains(mm.RoleId))
                .SelectMany(mm => new[] { mm.UserGuid, mm.ReplacementUserGuid }))
            .Concat(rows.Select(m => m.CreatedBy)));

        var canViewAll = identity.HasPermission(Common.Security.Permissions.MeetingsViewAll);
        return rows.Select(m => MapToMeetingJsonModel(m, users, identity, canViewAll)).ToList();
    }

    private static MeetingJsonModel MapToMeetingJsonModel(MeetingProjection m, Dictionary<Guid, string> users,
        ActingIdentity identity, bool canViewAll)
    {
        var chairman = m.AllMembers.FirstOrDefault(mm => mm.RoleId == MeetingRoles.ChairmanId);
        var secretary = m.AllMembers.FirstOrDefault(mm => MeetingRoles.IsAnySecretary(mm.RoleId));
        var myMembership = m.AllMembers
            .Where(mm => (identity.PositionGuid != null && mm.PositionGuid == identity.PositionGuid)
                         || (mm.PositionGuid == null && mm.UserGuid == identity.UserGuid)
                         || mm.ReplacementUserGuid == identity.UserGuid)
            .OrderBy(mm => MeetingRoles.Get(mm.RoleId)?.Order ?? int.MaxValue)
            .FirstOrDefault();

        return new MeetingJsonModel
        {
            Id = m.Id,
            Guid = m.Guid,
            Number = m.Number,
            Title = m.Title,
            Date = m.Date.ToString("yyyy/MM/dd") + " - " + m.StartTime.ToString(@"hh\:mm") + '~' + m.EndTime.ToString(@"hh\:mm"),
            Status = m.StatusTitle,
            Location = GetLocation(m.RoomLink, m.RoomName, m.RoomTitle),
            Chairman = FormatMemberName(chairman, users),
            Secretary = FormatMemberName(secretary, users),
            Role = myMembership?.RoleTitle ?? "ثبت کننده",
            Category = m.CategoryTitle,
            RoleId = myMembership?.RoleId ?? (canViewAll ? 999 : 0),
            Description = m.Description,
            StatusId = m.StatusId ?? 0,
            NotAllowReplacement = m.AllowReplacement ?? false,
            Creator = m.CreatedBy is { } c && users.TryGetValue(c, out var creator) ? creator : "",
            Created = m.Created ?? "",
            Rider = m.Rider,
            RiderGuid = m.RiderGuid,
            CategoryGuid = m.CategoryGuid,
        };
    }

    // ═══════════════════════════════════════════════════════════
    // جزئیات یک جلسه
    // ═══════════════════════════════════════════════════════════
    async Task<Result<MeetingJsonModel>> IQueryHandlerAsync<Result<MeetingJsonModel>, MeetingSearchDto>.Handle(MeetingSearchDto condition)
    {
        var access = await accessService.GetAsync(condition.MeetingGuid);
        if (!access.Exists) return Result<MeetingJsonModel>.Failure(null!, NotFoundMessage);
        if (!access.Can(MeetingCapability.ViewMeeting)) return Result<MeetingJsonModel>.Failure(null!, DeniedMessage);

        var canViewAgenda = access.Can(MeetingCapability.ViewAgenda);
        var meeting = await context.Meetings.AsNoTracking()
            .Where(m => m.Id == access.MeetingId)
            .Select(m => new
            {
                m.Id,
                m.Guid,
                m.Number,
                m.Title,
                m.StartTime,
                m.EndTime,
                m.StatusId,
                m.Rider,
                CategoryGuid = m.Category!.Guid,
                m.RiderGuid,
                m.NotAllowReplacement,
                m.Date,
                Status = m.Status!.Title,
                m.RoomLink,
                m.RoomName,
                RoomTitle = m.Room!.Title,
                Chairman = m.MeetingMembers.Where(mm => mm.RoleId == MeetingRoles.ChairmanId)
                    .Select(mm => new { mm.Name, mm.UserGuid }).FirstOrDefault(),
                Secretary = m.MeetingMembers.Where(mm => mm.RoleId == MeetingRoles.SecretaryId || mm.RoleId == MeetingRoles.NonMemberSecretaryId)
                    .Select(mm => new { mm.Name, mm.UserGuid }).FirstOrDefault(),
                Category = m.Category!.Title,
                m.FollowGuid,
                m.Description,
                m.CreatedBy,
                m.Created,
                UserGuids = m.MeetingMembers.Select(mm => mm.UserGuid).Where(g => g != null).Distinct().ToList(),
                Agendas = m.Agendas.OrderBy(a => a.SortOrder)
                    .Select(c => new AgendaItem { Id = c.Id, Text = c.Text, FileGuid = c.File }).ToList(),
            })
            .FirstOrDefaultAsync();

        if (meeting == null)
            return Result<MeetingJsonModel>.Failure(null!, NotFoundMessage);

        // عنوان جلسه‌ی پیرو فقط اگر کاربر به آن دسترسی داشته باشد
        string followTitle = "";
        if (meeting.FollowGuid is { } followGuid)
        {
            var followAccess = await accessService.GetAsync(followGuid);
            if (followAccess.Can(MeetingCapability.ViewMeeting))
                followTitle = await context.Meetings.AsNoTracking()
                    .Where(c => c.Guid == followGuid).Select(c => c.Title).FirstOrDefaultAsync() ?? "";
        }

        var users = await GetUserNamesAsync([meeting.Chairman?.UserGuid, meeting.Secretary?.UserGuid, meeting.CreatedBy]);

        return Result<MeetingJsonModel>.EmptyMessage(new MeetingJsonModel
        {
            Id = meeting.Id,
            Guid = meeting.Guid!.Value,
            Number = meeting.Number,
            Title = meeting.Title,
            StartTime = meeting.StartTime?.ToString(@"hh\:mm"),
            EndTime = meeting.EndTime?.ToString(@"hh\:mm"),
            MtDate = meeting.Date?.ToString("yyyy/MM/dd"),
            Status = meeting.Status,
            StatusId = meeting.StatusId ?? 0,
            Location = GetLocation(meeting.RoomLink, meeting.RoomName, meeting.RoomTitle),
            CategoryGuid = meeting.CategoryGuid,
            Chairman = NameOrStored(users, meeting.Chairman?.UserGuid, meeting.Chairman?.Name),
            Secretary = NameOrStored(users, meeting.Secretary?.UserGuid, meeting.Secretary?.Name),
            Role = access.RoleTitle ?? (access.IsCreator ? "ثبت کننده" : "مشاهده‌کننده"),
            Category = meeting.Category,
            RoleId = access.RoleId ?? (access.IsGlobalViewer ? 999 : 0),
            Description = access.Can(MeetingCapability.ViewMinutes) ? meeting.Description : null,
            Creator = meeting.CreatedBy is { } c && users.TryGetValue(c, out var creator) ? creator : "",
            Agendas = canViewAgenda ? meeting.Agendas : [],
            UserGuids = meeting.UserGuids,
            FollowMeeting = followTitle,
            NotAllowReplacement = meeting.NotAllowReplacement ?? false,
            Rider = meeting.Rider,
            RiderGuid = meeting.RiderGuid,
            Created = meeting.Created?.ToString("yyyy/MM/dd") ?? "",
        });
    }

    /// <summary>اطلاعات کامل جلسه برای فرم ویرایش/کپی</summary>
    async Task<Result<EditMeetingDto>> IQueryHandlerAsync<Result<EditMeetingDto>, Guid>.Handle(Guid meetingGuid)
    {
        var access = await accessService.GetAsync(meetingGuid);
        if (!access.Exists) return Result<EditMeetingDto>.Failure(null!, NotFoundMessage);
        // فرم «کپی جلسه» هم از همین Query استفاده می‌کند؛ پس مشاهده‌ی کامل کافی است
        if (!access.Can(MeetingCapability.ViewMeeting | MeetingCapability.ViewAgenda))
            return Result<EditMeetingDto>.Failure(null!, DeniedMessage);

        var meeting = await context.Meetings.AsNoTracking()
            .Where(c => c.Id == access.MeetingId)
            .Select(c => new EditMeetingDto
            {
                Title = c.Title,
                Date = c.Date!.Value.ToString("yyyy/MM/dd"),
                CategoryGuid = c.Category!.Guid,
                StartTime = c.StartTime!.Value,
                EndTime = c.EndTime!.Value,
                RoomGuid = c.Room!.Guid,
                FollowGuid = c.FollowGuid,
                Guid = c.Guid!.Value,
                NotAllowReplacement = c.NotAllowReplacement ?? false,
                RoomLink = c.RoomLink,
                RoomName = c.RoomName,
                Number = c.Number,
                StatusId = c.StatusId,
                CreatedBy = c.CreatedBy,
                Members = c.MeetingMembers.Select(d => new MeetingMemberDto
                {
                    Name = d.Name,
                    ReplacementUserGuid = d.ReplacementUserGuid,
                    UserGuid = d.UserGuid,
                    PositionGuid = d.PositionGuid,
                    Comment = d.Comment,
                    Id = d.Id,
                    RoleId = d.RoleId ?? 0,
                    IsExternal = d.IsExternal ?? false,
                    Email = d.Email,
                    Mobile = d.Mobile,
                    ProfileGuid = d.Profile,
                    SignatureGuid = d.Signature,
                    Organization = d.Organization,
                    PersNo = d.PersNo,
                    Gender = d.Gender,
                    BoardMemberGuid = d.BoardMember != null ? d.BoardMember.Guid : null,
                }).ToList(),
                Agendas = c.Agendas.OrderBy(d => d.SortOrder).Select(a => new AgendaDto
                {
                    Id = a.Id,
                    Text = a.Text,
                    Order = a.SortOrder ?? 0,
                    IsRemoved = false,
                    Files = context.Files
                        .Where(f => f.ModuleId == a.Id && f.Type == FileType.Agenda)
                        .Select(f => new FileDto(f.Id, false, f.FileGuid))
                        .ToList(),
                }).ToList(),
            })
            .FirstOrDefaultAsync();

        if (meeting == null) return Result<EditMeetingDto>.Failure(null!, NotFoundMessage);

        var users = await GetUserNamesAsync(meeting.Members.Select(m => m.UserGuid));
        foreach (var member in meeting.Members.Where(m => m.UserGuid != null))
            member.Name = users.TryGetValue(member.UserGuid!.Value, out var name) ? name : member.Name;

        return Result<EditMeetingDto>.EmptyMessage(meeting);
    }

    async Task<Result<List<GuestComboDto>>> IQueryHandlerAsync<Result<List<GuestComboDto>>, Guid>.Handle(Guid meetingGuid)
    {
        var access = await accessService.GetAsync(meetingGuid);
        if (!access.Can(MeetingCapability.ViewMeeting))
            return Result<List<GuestComboDto>>.Failure([], DeniedMessage);

        var guests = await context.MeetingsMembers.AsNoTracking()
            .Where(c => c.MeetingId == access.MeetingId && c.UserGuid != null)
            .Select(c => new GuestComboDto { Id = c.Id, Title = c.Name })
            .ToListAsync();
        return Result<List<GuestComboDto>>.EmptyMessage(guests);
    }

    async Task<Result<CheckMeetingDto>> IQueryHandlerAsync<Result<CheckMeetingDto>, Guid>.Handle(Guid meetingGuid)
    {
        var access = await accessService.GetAsync(meetingGuid);
        if (!access.Can(MeetingCapability.ViewMeeting))
            return Result<CheckMeetingDto>.Failure(null!, DeniedMessage);

        var guestId = GuestRoleId;
        var result = await context.Meetings.AsNoTracking()
            .Where(c => c.Id == access.MeetingId)
            .Select(m => new CheckMeetingDto
            {
                ExistResolution = m.Resolutions.Any() || (m.Description != null && m.Description != ""),
                Attendance = m.MeetingMembers.Where(mm => mm.RoleId != guestId).All(mm => mm.IsPresent != null),
            })
            .FirstOrDefaultAsync();

        return result is null ? Result<CheckMeetingDto>.Failure(null!, NotFoundMessage) : Result<CheckMeetingDto>.Success(result);
    }

    /// <summary>آیا جلسه قابل اتمام است؟ (فقط امضای رئیس تعیین‌کننده است)</summary>
    public async Task<Result<bool>> Handle(CheckSignGuidDto condition)
    {
        var access = await accessService.GetAsync(condition.Guid);
        if (!access.Exists) return Result<bool>.Failure(false, NotFoundMessage);
        if (!access.Can(MeetingCapability.ViewMeeting)) return Result<bool>.Failure(false, DeniedMessage);
        return Result<bool>.Success(!access.Workflow.HasMinutes || access.ChairmanSigned);
    }

    // ═══════════════════════════════════════════════════════════
    // شمارنده‌های داشبورد
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<MeetingCountDto>> Handle(MeetingCountRequestDto _)
    {
        var identity = await identityResolver.ResolveAsync();
        var position = identity.PositionGuid ?? Guid.Empty;
        var user = identity.UserGuid;
        var today = DateTime.Today;
        var chairmanId = MeetingRoles.ChairmanId;

        var counts = await context.Meetings.AsNoTracking()
            .VisibleTo(identity, includeGuests: false)
            .GroupBy(m => 1)
            .Select(g => new MeetingCountDto
            {
                DraftMeetingsCount = g.Count(m => m.StatusId == MeetingStatusIds.Draft),
                TodayMeetingsCount = g.Count(m => m.Date!.Value.Date == today),
                UpcomingMeetingsCount = g.Count(m => m.Date!.Value.Date > today && m.StatusId != MeetingStatusIds.Cancelled),
                SignatureMeetingsCount = g.Count(m => m.StatusId == MeetingStatusIds.Finalized
                    && m.MeetingMembers.Any(mm => mm.PositionGuid == position && mm.UserGuid == user && mm.IsSign != true && mm.IsPresent == true)
                    && (m.MeetingMembers.Any(mm => mm.RoleId == chairmanId && mm.IsSign == true)
                        || m.MeetingMembers.Any(mm => mm.PositionGuid == position && mm.UserGuid == user && mm.RoleId == chairmanId))),
                FinishedMeetingsCount = g.Count(m => m.StatusId == MeetingStatusIds.Finalized),
                AllMeetingsCount = g.Count(),
                CanceledMeetingsCount = g.Count(m => m.StatusId == MeetingStatusIds.Cancelled),
                AttendanceMeetingsCount = g.Count(m => m.StatusId == MeetingStatusIds.Registered && m.Date!.Value.Date >= today
                    && m.MeetingMembers.Any(x => x.PositionGuid == position && x.IsAttendance != true)),
                UndeterminedMeetingsCount = g.Count(m => m.StatusId == MeetingStatusIds.Undetermined
                    || ((m.StatusId == MeetingStatusIds.Draft || m.StatusId == MeetingStatusIds.Registered || m.StatusId == MeetingStatusIds.Held)
                        && m.Date!.Value.Date < today)),
            })
            .FirstOrDefaultAsync();

        return Result<MeetingCountDto>.Success(counts ?? new MeetingCountDto());
    }

    /// <summary>جلسات امروز و فردای من</summary>
    async Task<Result<List<TodayMeetingDto>>> IQueryHandlerAsync<Result<List<TodayMeetingDto>>, Guid>.Handle(Guid _)
    {
        var identity = await identityResolver.ResolveAsync();
        var today = DateTime.Today;
        var tomorrow = today.AddDays(1);

        var meetings = await context.Meetings.AsNoTracking()
            .VisibleTo(identity, includeGuests: true)
            .Where(m => m.StatusId == MeetingStatusIds.Registered && (m.Date!.Value.Date == today || m.Date!.Value.Date == tomorrow))
            .OrderBy(m => m.Date).ThenBy(m => m.StartTime)
            .Select(m => new TodayMeetingDto
            {
                Number = m.Number,
                Type = m.Date!.Value.Date == today ? "Today" : "Tomorrow",
                Room = !string.IsNullOrEmpty(m.RoomLink) ? m.RoomLink : !string.IsNullOrEmpty(m.RoomName) ? m.RoomName : m.Room!.Title,
                Time = m.StartTime!.Value.ToString(@"hh\:mm") + '-' + m.EndTime!.Value.ToString(@"hh\:mm"),
                Title = m.Title,
                Guid = m.Guid!.Value,
            })
            .ToListAsync();

        return Result<List<TodayMeetingDto>>.Success(meetings);
    }

    /// <summary>
    /// جلسات چند روز آینده برای پرتال SSO.
    /// فقط کلاینت سرویس‌به‌سرویس مورد اعتماد (S2S:ClientId) می‌تواند کاربر/سمت را تعیین کند؛
    /// برای کاربر عادی همیشه هویت خودش استفاده می‌شود.
    /// </summary>
    public async Task<Result<List<MeetingFutureDto>>> Handle(MeetingFutureRequestDto condition)
    {
        ActingIdentity identity;
        if (currentUser.IsServiceClient)
        {
            var trustedClient = configuration["S2S:ClientId"] ?? "MeetManage.s2s";
            if (!string.Equals(currentUser.ClientId, trustedClient, StringComparison.OrdinalIgnoreCase)
                || condition.UserGuid is not { } u || u == Guid.Empty)
                return Result<List<MeetingFutureDto>>.Failure([], DeniedMessage);

            identity = new ActingIdentity(u, u, condition.PositionGuid, false, false, true, new HashSet<string>());
        }
        else
        {
            identity = await identityResolver.ResolveAsync();
        }

        var today = DateTime.Today;
        var until = today.AddDays(4);
        var now = DateTime.Now.TimeOfDay;

        var meetings = await context.Meetings.AsNoTracking()
            .VisibleTo(identity, includeGuests: false)
            .Where(m => m.StatusId != MeetingStatusIds.Draft && m.StatusId != MeetingStatusIds.Cancelled)
            .Where(m => m.Date <= until && m.Date >= today)
            .OrderByDescending(c => c.Date).ThenByDescending(x => x.StartTime)
            .Select(m => new MeetingFutureDto
            {
                Guid = m.Guid!.Value,
                Title = m.Title,
                Date = m.Date!.Value.ToString("yyyy/MM/dd") + " - " + m.StartTime!.Value.ToString(@"hh\:mm") + '~' + m.EndTime!.Value.ToString(@"hh\:mm"),
                Place = !string.IsNullOrEmpty(m.RoomLink) ? m.RoomLink : !string.IsNullOrEmpty(m.RoomName) ? m.RoomName : m.Room!.Title,
                Status = m.StatusId == MeetingStatusIds.Completed
                    ? 3
                    : m.Date < today || (m.Date == today && m.EndTime <= now) ? 2 : 1,
            })
            .ToListAsync();

        return Result<List<MeetingFutureDto>>.EmptyMessage(meetings);
    }

    // ═══════════════════════════════════════════════════════════
    // تقویم
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<List<MeetingCalendarDto>>> Handle(MeetingCalendarSearchDto condition)
    {
        var identity = await identityResolver.ResolveAsync();

        var meetings = await context.Meetings.AsNoTracking()
            .VisibleTo(identity, includeGuests: true)
            .Where(x => x.Date >= condition.StartDate && x.Date <= condition.EndDate && x.StatusId != MeetingStatusIds.Cancelled)
            .Select(x => new MeetingCalendarDto
            {
                Title = x.Title,
                Guid = x.Guid!.Value,
                Type = "Meeting",
                Start = x.Date!.Value.Add(x.StartTime!.Value),
                End = x.Date!.Value.Add(x.EndTime!.Value),
            })
            .ToListAsync();

        return Result<List<MeetingCalendarDto>>.Success(meetings);
    }

    // ═══════════════════════════════════════════════════════════
    // کمبوها
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<List<MeetingComboModel>>> Handle()
    {
        var identity = await identityResolver.ResolveAsync();
        var meetings = await context.Meetings.AsNoTracking()
            .VisibleTo(identity)
            .OrderByDescending(m => m.Date)
            .Select(m => new MeetingComboModel { Guid = m.Guid!.Value, Title = m.Title })
            .ToListAsync();
        return Result<List<MeetingComboModel>>.EmptyMessage(meetings);
    }

    /// <summary>جلسات یک دسته‌بندی (برای انتخاب «جلسه‌ی پیرو» / مصوبه‌ی مرجع)</summary>
    public async Task<Result<List<ComboBase>>> Handle(MeetingGuidDto condition)
    {
        var identity = await identityResolver.ResolveAsync();
        var meetings = await context.Meetings.AsNoTracking()
            .VisibleTo(identity)
            .Where(x => x.Category!.Guid == condition.Guid)
            .OrderByDescending(x => x.Date)
            .Select(x => new ComboBase { Guid = x.Guid!.Value, Title = x.Title, Id = x.Id })
            .ToListAsync();
        return Result<List<ComboBase>>.EmptyMessage(meetings);
    }

    public async Task<Result<CheckMeetingNumberResultDto>> Handle(CheckMeetingNumberDto condition)
    {
        var existing = await context.Meetings.AsNoTracking()
            .Where(m => m.Number == condition.Number && m.Category!.Guid == condition.CategoryGuid && m.IsRemoved != true)
            .WhereIf(condition.MeetingGuid.HasValue, m => m.Guid != condition.MeetingGuid)
            .Select(m => new { m.Id, m.Title })
            .FirstOrDefaultAsync();

        var result = new CheckMeetingNumberResultDto();
        if (existing != null)
        {
            result.IsDuplicate = true;
            var access = await accessService.GetAsync(existing.Id);
            result.ExistingMeetingTitle = access.Can(MeetingCapability.ViewMeeting) ? existing.Title : HiddenMeetingTitle;
        }
        return Result<CheckMeetingNumberResultDto>.Success(result);
    }

    // ═══════════════════════════════════════════════════════════
    // آمار حضور من
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<List<MeetingStatisticResultDto>>> Handle(MeetingStatisticRequestDto condition)
    {
        var identity = await identityResolver.ResolveAsync();
        var position = identity.PositionGuid ?? Guid.Empty;
        var pc = new PersianCalendar();
        var now = DateTime.Now;
        var year = pc.GetYear(now);
        var month = pc.GetMonth(now);

        DateTime startDate;
        DateTime endDate;
        switch (condition.Type)
        {
            case ReportType.Weekly:
                var customWeekDay = now.DayOfWeek == DayOfWeek.Saturday ? 0 : (int)now.DayOfWeek + 1; // شنبه = ۰
                startDate = now.Date.AddDays(-customWeekDay);
                endDate = startDate.AddDays(7).AddTicks(-1);
                break;
            case ReportType.Monthly:
                startDate = pc.ToDateTime(year, month, 1, 0, 0, 0, 0);
                endDate = pc.ToDateTime(year, month, pc.GetDaysInMonth(year, month), 23, 59, 59, 999);
                break;
            case ReportType.Yearly:
                startDate = pc.ToDateTime(year, 1, 1, 0, 0, 0, 0);
                endDate = pc.ToDateTime(year, 12, pc.GetDaysInMonth(year, 12), 23, 59, 59, 999);
                break;
            default:
                startDate = now.AddDays(-7);
                endDate = now;
                break;
        }

        int[] heldStatuses = [MeetingStatusIds.Held, MeetingStatusIds.Finalized, MeetingStatusIds.Completed];
        var meetings = await context.Meetings.AsNoTracking()
            .Where(m => m.IsRemoved != true && heldStatuses.Contains(m.StatusId ?? 0)
                        && m.MeetingMembers.Any(c => c.PositionGuid == position && c.IsPresent == true)
                        && m.Date >= startDate && m.Date <= endDate)
            .Select(m => new { Date = m.Date!.Value, Start = m.StartTime ?? TimeSpan.Zero, End = m.EndTime ?? TimeSpan.Zero })
            .ToListAsync();

        var grouped = meetings
            .GroupBy(m => GroupByPeriod(m.Date, condition.Type))
            .ToDictionary(g => g.Key, g => (Count: g.Count(), Duration: g.Sum(m => (m.End - m.Start).TotalHours)));

        IEnumerable<string> keys = condition.Type switch
        {
            ReportType.Weekly => Enumerable.Range(0, 7).Select(i => GetPersianDayOfWeekName(pc.GetDayOfWeek(startDate.AddDays(i)))),
            ReportType.Monthly => Enumerable.Range(1, pc.GetDaysInMonth(year, month)).Select(d => $"{d:00} {GetPersianMonthName(month)}"),
            ReportType.Yearly => Enumerable.Range(1, 12).Select(m => $"{GetPersianMonthName(m)} {year}"),
            _ => grouped.Keys,
        };

        var result = keys.Select(key => new MeetingStatisticResultDto
        {
            DateLabel = key,
            Count = grouped.TryGetValue(key, out var v) ? v.Count : 0,
            Duration = grouped.TryGetValue(key, out var d) ? d.Duration : 0,
        }).ToList();

        return Result<List<MeetingStatisticResultDto>>.EmptyMessage(result);
    }

    private static string GroupByPeriod(DateTime date, ReportType periodType)
    {
        var pc = new PersianCalendar();
        return periodType switch
        {
            ReportType.Weekly => GetPersianDayOfWeekName(pc.GetDayOfWeek(date)),
            ReportType.Monthly => $"{pc.GetDayOfMonth(date):00} {GetPersianMonthName(pc.GetMonth(date))}",
            ReportType.Yearly => $"{GetPersianMonthName(pc.GetMonth(date))} {pc.GetYear(date)}",
            _ => $"{pc.GetDayOfMonth(date):00}/{pc.GetMonth(date):00}/{pc.GetYear(date)}",
        };
    }

    private static string GetPersianMonthName(int month) =>
        new[] { "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند" }[month - 1];

    private static string GetPersianDayOfWeekName(DayOfWeek day) => day switch
    {
        DayOfWeek.Saturday => "شنبه",
        DayOfWeek.Sunday => "یک‌شنبه",
        DayOfWeek.Monday => "دو‌شنبه",
        DayOfWeek.Tuesday => "سه‌شنبه",
        DayOfWeek.Wednesday => "چهار‌شنبه",
        DayOfWeek.Thursday => "پنج‌شنبه",
        DayOfWeek.Friday => "جمعه",
        _ => "",
    };

    // ═══════════════════════════════════════════════════════════
    // پیشنهاد زمان خالی
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<List<SuggestedSlotDto>>> Handle(SuggestedSlotsRequestDto condition)
    {
        var date = condition.Date.ToDateTime();
        var workStart = new TimeSpan(8, 0, 0);
        var workEnd = new TimeSpan(17, 0, 0);
        var duration = TimeSpan.FromMinutes(condition.SlotDurationMinutes is >= 30 and <= 120 ? condition.SlotDurationMinutes : 60);
        var memberGuids = condition.Members.Select(m => m.UserGuid).Distinct().ToList();

        // فقط بازه‌ها خوانده می‌شوند (نه مشخصات جلسات دیگر)
        var fromMeetings = await context.Meetings.AsNoTracking()
            .Where(m => m.StatusId == MeetingStatusIds.Registered && m.Date == date && m.IsRemoved != true)
            .WhereIf(condition.MeetingGuid.HasValue, m => m.Guid != condition.MeetingGuid)
            .Where(m => (condition.RoomGuid.HasValue && m.Room!.Guid == condition.RoomGuid) ||
                        m.MeetingMembers.Any(mm => mm.UserGuid.HasValue && memberGuids.Contains(mm.UserGuid.Value)))
            .Select(m => new { Start = m.StartTime!.Value, End = m.EndTime!.Value })
            .ToListAsync();

        var fromBlocked = memberGuids.Count > 0
            ? await context.BlockedTimes.AsNoTracking()
                .Where(b => !b.IsRemoved && b.Date.Date == date.Date && memberGuids.Contains(b.UserGuid))
                .Select(b => new { Start = b.StartTime, End = b.EndTime })
                .ToListAsync()
            : [];

        var occupied = fromMeetings.Select(s => (s.Start, s.End)).Concat(fromBlocked.Select(b => (b.Start, b.End))).ToList();

        var slots = new List<SuggestedSlotDto>();
        for (var current = workStart; current + duration <= workEnd; current = current.Add(TimeSpan.FromMinutes(30)))
        {
            var end = current + duration;
            if (!occupied.Any(s => !(end <= s.Start || current >= s.End)))
                slots.Add(new SuggestedSlotDto { StartTime = current.ToString(@"hh\:mm"), EndTime = end.ToString(@"hh\:mm") });
        }

        return Result<List<SuggestedSlotDto>>.Success(slots);
    }

    // ═══════════════════════════════════════════════════════════
    // تداخل اعضا و مکان
    // ═══════════════════════════════════════════════════════════
    /// <summary>
    /// قوانین:
    ///   ۱) کاربری که در جلسه‌ی همپوشان فقط «مهمان» است (و اینجا مهمان نیست) → فقط اطلاع‌رسانی (GuestInfo)
    ///   ۲) کاربری که در جلسه‌ی همپوشان برای خودش جانشین گذاشته (و خودش جانشین کسی نیست) → آزاد است
    ///   ۳) عنوان/شماره‌ی جلسه‌ی همپوشانی که کاربر جاری اجازه‌ی دیدنش را ندارد نمایش داده نمی‌شود
    /// </summary>
    public async Task<Result<MeetingConflictResultDto>> Handle(MeetingConflictCheckDto condition)
    {
        var identity = await identityResolver.ResolveAsync();
        var date = condition.Date.ToDateTime();
        var result = new MeetingConflictResultDto();

        if (condition.Members.Count > 0)
        {
            var overlapping = await context.Meetings.AsNoTracking()
                .Where(c => c.StatusId == MeetingStatusIds.Registered && c.IsRemoved != true)
                .WhereIf(condition.MeetingGuid != null, c => c.Guid != condition.MeetingGuid)
                .Where(m => m.Date == date && !(condition.EndTime <= m.StartTime || condition.StartTime >= m.EndTime))
                .Select(m => new ConflictMeeting
                {
                    Id = m.Id,
                    Guid = m.Guid!.Value,
                    Title = m.Title ?? "",
                    Number = m.Number,
                    Start = m.StartTime!.Value,
                    End = m.EndTime!.Value,
                    CreatedBy = m.CreatedBy,
                    Created = m.Created!.Value,
                    Members = m.MeetingMembers.Select(mm => new ConflictMember
                    {
                        UserGuid = mm.UserGuid,
                        ReplacementUserGuid = mm.ReplacementUserGuid,
                        RoleId = mm.RoleId ?? 0,
                    }).ToList(),
                })
                .ToListAsync();

            await MaskInvisibleAsync(overlapping, identity);

            var currentRoles = condition.Members.GroupBy(m => m.UserGuid).ToDictionary(g => g.Key, g => g.First().RoleId);
            var conflictMap = new Dictionary<Guid, (ConflictMeeting Meeting, bool InfoOnly)>();

            foreach (var userGuid in condition.Members.Select(m => m.UserGuid).Distinct())
            {
                ConflictMeeting? real = null, guestInfo = null;
                var currentRole = currentRoles.TryGetValue(userGuid, out var cr) ? cr : (int?)null;

                foreach (var meeting in overlapping)
                foreach (var entry in meeting.Members.Where(x => x.UserGuid == userGuid))
                {
                    if (entry.RoleId == GuestRoleId && currentRole != GuestRoleId)
                    {
                        guestInfo ??= meeting;
                        continue;
                    }

                    var setOwnReplacement = entry.ReplacementUserGuid != null;
                    var isSomeonesReplacement = meeting.Members.Any(m => m.ReplacementUserGuid == userGuid);
                    if (setOwnReplacement && !isSomeonesReplacement) continue;

                    real ??= meeting;
                }

                if (real is not null) conflictMap[userGuid] = (real, false);
                else if (guestInfo is not null) conflictMap[userGuid] = (guestInfo, true);
            }

            var creators = await GetUserNamesAsync(conflictMap.Values.Where(v => v.Meeting.Visible).Select(v => v.Meeting.CreatedBy));

            var userConflicts = conflictMap.Select(kv => new MeetingConflictTypeDto
            {
                Guid = kv.Key,
                Type = kv.Value.InfoOnly ? "GuestInfo" : "Meeting",
                ConflictMeetingGuid = kv.Value.Meeting.Visible ? kv.Value.Meeting.Guid : Guid.Empty,
                ConflictMeetingTitle = kv.Value.Meeting.Title,
                ConflictMeetingNumber = kv.Value.Meeting.Number,
                ConflictMeetingStartTime = kv.Value.Meeting.Start.ToString(@"hh\:mm"),
                ConflictMeetingEndTime = kv.Value.Meeting.End.ToString(@"hh\:mm"),
                ConflictMeetingCreatorName = kv.Value.Meeting.CreatedBy is { } c && creators.TryGetValue(c, out var n) ? n : "",
                ConflictMeetingCreatedDate = kv.Value.Meeting.Visible ? kv.Value.Meeting.Created.ToString("yyyy/MM/dd") : "",
            }).ToList();

            // تداخل با زمان‌های عدم حضور (شرح فقط برای خود صاحب آن)
            var memberUserGuids = condition.Members.Select(m => m.UserGuid).Distinct().ToList();
            var blocked = await context.BlockedTimes.AsNoTracking()
                .Where(b => !b.IsRemoved && memberUserGuids.Contains(b.UserGuid) && b.Date.Date == date.Date
                            && condition.StartTime < b.EndTime && condition.EndTime > b.StartTime)
                .Select(b => new { b.UserGuid, b.StartTime, b.EndTime, b.Description })
                .ToListAsync();

            foreach (var b in blocked)
            {
                if (userConflicts.Any(c => c.Guid == b.UserGuid && c.Type == "BlockedTime")) continue;
                userConflicts.Add(new MeetingConflictTypeDto
                {
                    Guid = b.UserGuid,
                    Type = "BlockedTime",
                    Description = b.UserGuid == identity.UserGuid ? b.Description ?? "عدم حضور" : "عدم حضور",
                    StartTime = b.StartTime.ToString(@"hh\:mm"),
                    EndTime = b.EndTime.ToString(@"hh\:mm"),
                });
            }

            result.UsersWithConflict = userConflicts;
        }

        if (condition.RoomGuid.HasValue)
        {
            var roomMeeting = await context.Meetings.AsNoTracking()
                .Where(x => x.StatusId == MeetingStatusIds.Registered && x.IsRemoved != true)
                .WhereIf(condition.MeetingGuid != null, c => c.Guid != condition.MeetingGuid)
                .Where(m => m.Date == date && m.Room!.Guid == condition.RoomGuid
                            && !(condition.EndTime <= m.StartTime || condition.StartTime >= m.EndTime))
                .Select(m => new ConflictMeeting
                {
                    Id = m.Id,
                    Guid = m.Guid!.Value,
                    Title = m.Title ?? "",
                    Number = m.Number,
                    Start = m.StartTime!.Value,
                    End = m.EndTime!.Value,
                    CreatedBy = m.CreatedBy,
                    Created = m.Created!.Value,
                })
                .FirstOrDefaultAsync();

            result.RoomConflict = roomMeeting != null;
            if (roomMeeting != null)
            {
                await MaskInvisibleAsync([roomMeeting], identity);
                var creator = roomMeeting.Visible ? await GetUserNamesAsync([roomMeeting.CreatedBy]) : [];
                result.RoomConflictMeeting = new RoomConflictMeetingDto
                {
                    Guid = roomMeeting.Visible ? roomMeeting.Guid : Guid.Empty,
                    Title = roomMeeting.Title,
                    Number = roomMeeting.Number,
                    StartTime = roomMeeting.Start.ToString(@"hh\:mm"),
                    EndTime = roomMeeting.End.ToString(@"hh\:mm"),
                    CreatorName = roomMeeting.CreatedBy is { } c && creator.TryGetValue(c, out var n) ? n : "",
                    CreatedDate = roomMeeting.Visible ? roomMeeting.Created.ToString("yyyy/MM/dd") : "",
                };
            }
        }

        return Result<MeetingConflictResultDto>.Success(result);
    }

    /// <summary>جلساتی که کاربر نمی‌بیند: عنوان و شماره پنهان می‌شود</summary>
    private async Task MaskInvisibleAsync(List<ConflictMeeting> meetings, ActingIdentity identity)
    {
        if (meetings.Count == 0) return;
        var ids = meetings.Select(m => m.Id).ToList();
        var visible = (await context.Meetings.AsNoTracking().VisibleTo(identity)
            .Where(m => ids.Contains(m.Id)).Select(m => m.Id).ToListAsync()).ToHashSet();

        foreach (var m in meetings)
        {
            m.Visible = visible.Contains(m.Id);
            if (m.Visible) continue;
            m.Title = HiddenMeetingTitle;
            m.Number = null;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════
    private async Task<Dictionary<Guid, string>> GetUserNamesAsync(IEnumerable<Guid?> guids)
    {
        var list = guids.Where(g => g.HasValue && g != Guid.Empty).Distinct().ToList();
        if (list.Count == 0) return [];
        var users = await userManagementAclService.GetUsersByGuidsAsync(list);
        return users.GroupBy(u => u.Guid).ToDictionary(g => g.Key, g => g.First().Fullname);
    }

    private static string? NameOrStored(Dictionary<Guid, string> users, Guid? userGuid, string? stored) =>
        userGuid is { } g && users.TryGetValue(g, out var name) ? name : stored;

    private static string GetLocation(string? link, string? name, string? roomTitle) =>
        !string.IsNullOrEmpty(link) ? link : !string.IsNullOrEmpty(name) ? name : roomTitle ?? "";

    private static string? FormatMemberName(MemberProjection? member, Dictionary<Guid, string> users)
    {
        if (member == null) return null;

        // عضو هیئت مدیره نامش هنگام ثبت ذخیره شده؛ کاربر سیستمی از UserManagement
        var mainName = member.BoardMemberGuid.HasValue
            ? member.Name ?? ""
            : member.UserGuid is { } u && users.TryGetValue(u, out var systemName) ? systemName : member.Name ?? "";

        return member.ReplacementUserGuid is { } r && users.TryGetValue(r, out var replacementName)
            ? $"{mainName} جانشین ({replacementName})"
            : mainName;
    }

    private sealed class MeetingProjection
    {
        public long Id { get; set; }
        public Guid Guid { get; set; }
        public string? Number { get; set; }
        public string? Title { get; set; }
        public int? StatusId { get; set; }
        public bool? AllowReplacement { get; set; }
        public DateTime Date { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        public string? StatusTitle { get; set; }
        public string? RoomLink { get; set; }
        public string? RoomName { get; set; }
        public string? RoomTitle { get; set; }
        public string? CategoryTitle { get; set; }
        public Guid CategoryGuid { get; set; }
        public string? Description { get; set; }
        public Guid? CreatedBy { get; set; }
        public string? Rider { get; set; }
        public Guid? RiderGuid { get; set; }
        public string? Created { get; set; }
        public List<MemberProjection> AllMembers { get; set; } = [];
    }

    private sealed class MemberProjection
    {
        public int RoleId { get; set; }
        public string? Name { get; set; }
        public Guid? UserGuid { get; set; }
        public Guid? PositionGuid { get; set; }
        public Guid? BoardMemberGuid { get; set; }
        public Guid? ReplacementUserGuid { get; set; }
        public string? RoleTitle { get; set; }
    }

    private sealed class ConflictMeeting
    {
        public long Id { get; set; }
        public Guid Guid { get; set; }
        public string Title { get; set; } = "";
        public string? Number { get; set; }
        public TimeSpan Start { get; set; }
        public TimeSpan End { get; set; }
        public Guid? CreatedBy { get; set; }
        public DateTime Created { get; set; }
        public bool Visible { get; set; } = true;
        public List<ConflictMember> Members { get; set; } = [];
    }

    private sealed class ConflictMember
    {
        public Guid? UserGuid { get; set; }
        public Guid? ReplacementUserGuid { get; set; }
        public int RoleId { get; set; }
    }
}
