using Epc.Application.Query;
using Epc.Company.Query;
using Epc.Dapper;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Application.Contracts.Member;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Meeting;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using MeetingManagement.Domain.Shared.Access;

namespace MeetingManagement.Infrastructure.Query;

public class MeetingQueryHandler(MeetingManagementQueryContext context, IUserManagementAclService userManagementAclService, BaseDapperRepository dapperRepository) :
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
    // Cache برای جلوگیری از دریافت مکرر نام کاربران
    private readonly Dictionary<Guid, string> _userCache = new();

    // ✅ roleId مهمان (طبق قرارداد فعلی پروژه، 6 = مهمان)
    private static int GuestRoleId => MeetingRoles.GuestId; // ✅ از پیکربندی نقش‌ها

    public async Task<Result<List<MeetingJsonModel>>> Handle(MeetingListSearchDto condition)
    {
        var query = BuildMeetingQuery(condition);

        var meetingsData = await query
            .Include(m => m.MeetingMembers.Where(mm => mm.RoleId == MeetingRoles.SecretaryId || mm.RoleId == MeetingRoles.NonMemberSecretaryId || mm.RoleId == MeetingRoles.ChairmanId))
            .ThenInclude(mm => mm.Role)
            .Include(m => m.Category)
            .Include(m => m.Status)
            .Include(m => m.Room)
            .Select(m => new MeetingProjection
            {
                Id = m.Id,
                Guid = m.Guid.Value,
                Number = m.Number,
                Title = m.Title,
                StatusId = m.StatusId,
                AllowReplacement = m.NotAllowReplacement,
                Date = m.Date.Value,
                StartTime = m.StartTime.Value,
                EndTime = m.EndTime.Value,
                StatusTitle = m.Status.Title,
                RoomLink = m.RoomLink,
                RoomName = m.RoomName,
                RoomTitle = m.Room.Title,
                CategoryTitle = m.Category.Title,
                Description = m.Description,
                CreatedBy = m.CreatedBy,
                Created = m.Created.Value.ToString("yyyy/MM/dd"),
                Rider = m.Rider,
                RiderGuid = m.RiderGuid,
                CategoryGuid = m.Category.Guid,
                Category = m.Category.Title,
                AllMembers = m.MeetingMembers.Select(mm => new MemberProjection
                {
                    RoleId = mm.RoleId ?? 0,
                    Name = mm.Name,
                    UserGuid = mm.UserGuid,
                    BoardMemberGuid = mm.BoardMember.Guid,   // ✅ اضافه شد
                    ReplacementUserGuid = mm.ReplacementUserGuid,
                    RoleTitle = mm.Role.Title
                }).ToList()
            })
            .ToListAsync();

        // یکبار همه UserGuid های سیستمی را جمع‌آوری کنیم
        // (BoardMember ها UserGuid ندارند پس وارد این لیست نمی‌شوند)
        var allUserGuids = meetingsData
            .SelectMany(m => m.AllMembers
                .SelectMany(member => new[] { member.UserGuid, member.ReplacementUserGuid })
                .Where(g => g.HasValue)
                .Select(g => g.Value))
            .Concat(meetingsData.Where(m => m.CreatedBy.HasValue).Select(m => m.CreatedBy.Value))
            .Distinct()
            .ToList();

        var users = await GetUsersWithCache(allUserGuids);

        var meetingModels = meetingsData.Select(m => MapToMeetingJsonModel(m, users, condition)).ToList();

        return Result<List<MeetingJsonModel>>.EmptyMessage(meetingModels);
    }
    // کوئری اصلی را بسازیم
    private IQueryable<Meeting> BuildMeetingQuery(MeetingListSearchDto condition)
    {
        var today = DateTime.Today;
        //var meetingss = context.Meetings.Where(c => c.Date <= date)
        //    .Where(x => !x.Resolutions.Any() && string.IsNullOrEmpty(x.Description)).ToList();
        //foreach (var meeting in meetingss)
        //{
        //    meeting.ChangeStatus(meeting.CreatedBy??Guid.Parse("6767AF94-9BF4-4C5E-AF42-B5A66452CB82") ,7);
        //}

        //context.SaveChanges();
        var query = context.Meetings.Include(x => x.MeetingMembers).AsQueryable();

        // فیلتر دسترسی
        if (!condition.CanViewAll)
        {
            query = query.Where(m =>
                (m.StatusId == MeetingStatusIds.Draft && m.CreatorPositionGuid == condition.PositionGuid) ||
                (m.StatusId != MeetingStatusIds.Draft && (m.CreatorPositionGuid == condition.PositionGuid ||
                 m.MeetingMembers.Any(mm => mm.PositionGuid == condition.PositionGuid && mm.RoleId != MeetingRoles.GuestId)))
            );
        }

        // فیلتر نوع
        query = condition.FilterType switch
        {
            FilterType.Today => query.Where(m => m.Date.Value.Date == DateTime.Today),
            FilterType.Upcoming => query.Where(m => m.Date.Value.Date > DateTime.Today),
            FilterType.Attendance => query.Where(m => m.StatusId == MeetingStatusIds.Registered && m.Date.Value.Date >= DateTime.Today &&
               m.MeetingMembers.Any(x => x.IsAttendance != true && x.PositionGuid == condition.PositionGuid)),
            FilterType.Signature => query.Where(m =>
               (m.StatusId == MeetingStatusIds.Finalized &&
                m.MeetingMembers.Any(mm =>
                    mm.PositionGuid == condition.PositionGuid && mm.UserGuid == condition.UserGuid &&
                    (mm.IsSign == false || mm.IsSign == null) &&
                    mm.IsPresent == true
                )) && (m.MeetingMembers.Any(mm =>
                   mm.RoleId == MeetingRoles.ChairmanId && // رئیس
                   mm.IsPresent == true &&
                   mm.IsSign == true
               ) || m.MeetingMembers.Any(x => x.PositionGuid == condition.PositionGuid && x.UserGuid == condition.UserGuid &&
                x.RoleId == MeetingRoles.ChairmanId))

            ),
            FilterType.Finished => query.Where(m => m.StatusId == MeetingStatusIds.Finalized),
            FilterType.Draft => query.Where(m => m.StatusId == MeetingStatusIds.Draft),
            FilterType.Canceled => query.Where(m => m.StatusId == MeetingStatusIds.Signed),
            FilterType.Undetermined => query.Where(m =>
                         (m.StatusId == MeetingStatusIds.Draft || m.StatusId == MeetingStatusIds.Registered || m.StatusId == MeetingStatusIds.Held) &&
                         m.Date.Value.Date < DateTime.Today),
            _ => query
        };

        return query.OrderByDescending(c => c.Date);
    }

    // کش برای کاربران
    private async Task<Dictionary<Guid, string>> GetUsersWithCache(List<Guid> userGuids)
    {
        var uncachedGuids = userGuids.Where(g => !_userCache.ContainsKey(g)).ToList();

        if (uncachedGuids.Any())
        {
            // Update the following line to convert the List<Guid> to List<Guid?> before passing it to the method
            var newUsers = await userManagementAclService.GetUsersByGuidsAsync(uncachedGuids.Cast<Guid?>().ToList());
            foreach (var user in newUsers)
            {
                _userCache[user.Guid] = user.Fullname;
            }
        }

        return userGuids.ToDictionary(g => g, g => _userCache.TryGetValue(g, out var name) ? name : "");
    }

    // Mapping منطق
    private MeetingJsonModel MapToMeetingJsonModel(MeetingProjection m, Dictionary<Guid, string> users, MeetingListSearchDto condition)
    {
        var chairman = m.AllMembers.FirstOrDefault(mm => mm.RoleId == MeetingRoles.ChairmanId);
        var secretary = m.AllMembers.FirstOrDefault(mm => mm.RoleId == MeetingRoles.SecretaryId || mm.RoleId == MeetingRoles.NonMemberSecretaryId);
        var userRole = m.AllMembers.FirstOrDefault(mm => mm.UserGuid == condition.UserGuid);

        return new MeetingJsonModel
        {
            Id = m.Id,
            Guid = m.Guid,
            Number = m.Number,
            Title = m.Title,
            Date = m.Date.ToString("yyyy/MM/dd") + " - " + m.StartTime.ToString(@"hh\:mm") + '~' + m.EndTime.ToString(@"hh\:mm"),
            Status = m.StatusTitle,
            Location = GetLocation(m),
            Chairman = FormatMemberName(chairman, users),
            Secretary = FormatMemberName(secretary, users),
            Role = userRole?.RoleTitle ?? "ثبت کننده",
            Category = m.CategoryTitle,
            RoleId = userRole?.RoleId ?? (condition.CanViewAll ? 999 : 0),
            Description = m.Description,
            StatusId = m.StatusId ?? 0,
            NotAllowReplacement = m.AllowReplacement ?? false,
            Creator = m.CreatedBy.HasValue && users.TryGetValue(m.CreatedBy.Value, out var creator) ? creator : "",
            Created = m.Created,
            Rider = m.Rider,
            RiderGuid = m.RiderGuid,
            CategoryGuid = m.CategoryGuid
        };
    }

    private string GetLocation(MeetingProjection m)
    {
        return !string.IsNullOrEmpty(m.RoomLink) ? m.RoomLink :
               !string.IsNullOrEmpty(m.RoomName) ? m.RoomName :
               m.RoomTitle;
    }

    private string FormatMemberName(MemberProjection member, Dictionary<Guid, string> users)
    {
        if (member == null) return null;

        string mainName;

        if (member.BoardMemberGuid.HasValue)
        {
            // عضو هیئت مدیره: نام مستقیماً از زمان ثبت جلسه ذخیره شده
            // نیازی به lookup در users نیست
            mainName = member.Name ?? "";
        }
        else if (member.UserGuid.HasValue && users.TryGetValue(member.UserGuid.Value, out var systemName))
        {
            // کاربر سیستمی: نام از سرویس مدیریت کاربران
            mainName = systemName;
        }
        else
        {
            // fallback: هر چه در Name ذخیره شده (مهمان خارجی یا سایر موارد)
            mainName = member.Name ?? "";
        }

        // جانشین
        if (member.ReplacementUserGuid.HasValue &&
            users.TryGetValue(member.ReplacementUserGuid.Value, out var replacementName))
        {
            return $"{mainName} جانشین ({replacementName})";
        }

        return mainName;
    }


    // کلاس‌های کمکی برای Projection
    private class MeetingProjection
    {
        public long Id { get; set; }
        public Guid Guid { get; set; }
        public string Number { get; set; }
        public string Title { get; set; }
        public int? StatusId { get; set; }
        public bool? AllowReplacement { get; set; }
        public DateTime Date { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        public string StatusTitle { get; set; }
        public string RoomLink { get; set; }
        public string RoomName { get; set; }
        public string RoomTitle { get; set; }
        public string CategoryTitle { get; set; }
        public string Description { get; set; }
        public Guid? CreatedBy { get; set; }
        public string Rider { get; set; }
        public Guid? RiderGuid { get; set; }
        public List<MemberProjection> AllMembers { get; set; } = new();
        public Guid CategoryGuid { get; set; }
        public string Category { get; internal set; }
        public string? Created { get; internal set; }
    }

    private class MemberProjection
    {
        public int RoleId { get; set; }
        public string Name { get; set; }
        public Guid? UserGuid { get; set; }

        /// <summary>
        /// وقتی عضو از جدول هیئت مدیره است (نه کاربر سیستمی) این فیلد مقدار دارد.
        /// در این حالت نام مستقیماً از فیلد Name خوانده می‌شود.
        /// </summary>
        public Guid? BoardMemberGuid { get; set; }

        public Guid? ReplacementUserGuid { get; set; }
        public string RoleTitle { get; set; }
    }
    // ═══════════════════════════════════════════════════════════════
    // فقط بخش Handle مربوط به MeetingSearchRequestDto تغییر کرده
    // بقیه متدها دست‌نخورده باقی می‌مانند
    // ═══════════════════════════════════════════════════════════════

    // در کلاس MeetingQueryHandler، متد زیر را جایگزین کنید:

    async Task<Result<List<MeetingJsonModel>>>
        IQueryHandlerAsync<Result<List<MeetingJsonModel>>, MeetingSearchRequestDto>
        .Handle(MeetingSearchRequestDto condition)
    {
        var startDate = condition.DateFrom.ToDateTimeNull();
        var endDate = condition.DateTo.ToDateTimeNull();

        var query = context.Meetings
            // ── فیلتر دسترسی: جلسه‌هایی که کاربر در آن‌ها دخیل است ─────────────
            .Where(m =>
                m.CreatorPositionGuid == condition.PositionGuid ||
                m.MeetingMembers.Any(mm => mm.PositionGuid == condition.PositionGuid))

            // ── فیلترهای متنی ──────────────────────────────────────────────────
            .WhereIf(!string.IsNullOrEmpty(condition.Title),
                x => EF.Functions.Like(x.Title, $"%{condition.Title}%"))

            .WhereIf(!string.IsNullOrEmpty(condition.Number),
                x => EF.Functions.Like(x.Number, $"%{condition.Number}%"))

            .WhereIf(!string.IsNullOrEmpty(condition.Agenda),
                x => x.Agendas.Any(c => EF.Functions.Like(c.Text, $"%{condition.Agenda}%")))

            // ── فیلترهای Guid ──────────────────────────────────────────────────
            .WhereIf(condition.StatusGuid != null, c => c.Status.Guid == condition.StatusGuid)
            .WhereIf(condition.CategoryGuid != null, x => x.Category.Guid == condition.CategoryGuid)
            .WhereIf(condition.RoomGuid != null, x => x.Room.Guid == condition.RoomGuid)

            // ── رئیس جلسه ──────────────────────────────────────────────────────
            // برای جلسات هیئت‌مدیره: رئیس با BoardMemberGuid ذخیره می‌شود
            // برای جلسات عادی: رئیس با UserGuid ذخیره می‌شود
            // هر دو حالت در یک شرط بررسی می‌شوند
            .WhereIf(condition.ChairmanGuid != null, x =>
                x.MeetingMembers.Any(c =>
                    (c.UserGuid == condition.ChairmanGuid ||
                     c.BoardMember.Guid == condition.ChairmanGuid)
                    && c.RoleId == MeetingRoles.ChairmanId))

            // ── دبیر جلسه ──────────────────────────────────────────────────────
            // دبیر می‌تواند:
            //   ۱. عضو هیئت مدیره باشد (BoardMemberGuid)
            //   ۲. کاربر سیستمی داخلی باشد، مانند دبیر سازمان (UserGuid)
            // هر دو حالت در یک شرط بررسی می‌شوند
            .WhereIf(condition.SecretaryGuid != null, x =>
                x.MeetingMembers.Any(c =>
                    (c.UserGuid == condition.SecretaryGuid ||
                     c.BoardMember.Guid == condition.SecretaryGuid)
                    && (c.RoleId == MeetingRoles.SecretaryId || c.RoleId == MeetingRoles.NonMemberSecretaryId)))

            // ── فیلتر تاریخ ────────────────────────────────────────────────────
            .WhereIf(startDate != null, x => x.Date >= startDate)
            .WhereIf(endDate != null, x => x.Date <= endDate)

            .OrderByDescending(c => c.Id);

        // ── Projection بهینه (مشابه Handle اصلی) ───────────────────────────────
        var meetingsData = await query
            .Include(m => m.MeetingMembers.Where(mm => mm.RoleId <= 3))
            .ThenInclude(mm => mm.Role)
            .Include(m => m.Category)
            .Include(m => m.Status)
            .Include(m => m.Room)
            .Select(m => new MeetingProjection
            {
                Id = m.Id,
                Guid = m.Guid.Value,
                Number = m.Number,
                Title = m.Title,
                StatusId = m.StatusId,
                AllowReplacement = m.NotAllowReplacement,
                Date = m.Date.Value,
                StartTime = m.StartTime.Value,
                EndTime = m.EndTime.Value,
                StatusTitle = m.Status.Title,
                RoomLink = m.RoomLink,
                RoomName = m.RoomName,
                RoomTitle = m.Room.Title,
                CategoryTitle = m.Category.Title,
                Description = m.Description,
                CreatedBy = m.CreatedBy,
                Rider = m.Rider,
                RiderGuid = m.RiderGuid,
                AllMembers = m.MeetingMembers.Select(mm => new MemberProjection
                {
                    RoleId = mm.RoleId ?? 0,
                    Name = mm.Name,
                    UserGuid = mm.UserGuid,
                    BoardMemberGuid = mm.BoardMember.Guid,
                    ReplacementUserGuid = mm.ReplacementUserGuid,
                    RoleTitle = mm.Role.Title
                }).ToList()
            })
            .ToListAsync();

        // ── دریافت یکجای همه کاربران ────────────────────────────────────────────
        var allUserGuids = meetingsData
            .SelectMany(m => m.AllMembers
                .SelectMany(member => new[] { member.UserGuid, member.ReplacementUserGuid })
                .Where(g => g.HasValue)
                .Select(g => g.Value))
            .Concat(meetingsData
                .Where(m => m.CreatedBy.HasValue)
                .Select(m => m.CreatedBy.Value))
            .Distinct()
            .ToList();

        var users = await GetUsersWithCache(allUserGuids);

        // condition برای mapping - CanViewAll را false می‌گذاریم چون جستجو برای همه است
        var searchCondition = new MeetingListSearchDto
        {
            UserGuid = condition.UserGuid,
            CanViewAll = false
        };

        var meetingModels = meetingsData
            .Select(m => MapToMeetingJsonModel(m, users, searchCondition))
            .ToList();

        return Result<List<MeetingJsonModel>>.EmptyMessage(meetingModels);
    }
    async Task<Result<MeetingJsonModel>> IQueryHandlerAsync<Result<MeetingJsonModel>, MeetingSearchDto>.Handle(MeetingSearchDto condition)
    {
        var meeting = await context.Meetings
            .Include(c => c.MeetingMembers)
            .Where(m => m.Guid == condition.MeetingGuid)
            .OrderByDescending(m => m.Id)
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
                CategoryGuid = m.Category.Guid,
                m.RiderGuid,
                AllowReplacement = m.NotAllowReplacement,
                MtDate = m.Date.Value.ToString("yyyy/MM/dd"),
                Status = context.MeetingStatuses.Where(s => s.Id == m.StatusId).Select(s => s.Title).FirstOrDefault(),
                Location = !string.IsNullOrEmpty(m.RoomLink) ? m.RoomLink :
                           !string.IsNullOrEmpty(m.RoomName) ? m.RoomName :
                           context.Rooms.Where(r => r.Id == m.RoomId).Select(r => r.Title).FirstOrDefault(),
                Chairman = m.MeetingMembers
                    .Where(mm => mm.RoleId == MeetingRoles.ChairmanId)
                    .Select(mm => new { mm.Name, mm.UserGuid })
                    .FirstOrDefault(),
                Secretary = m.MeetingMembers
                    .Where(mm => mm.RoleId == MeetingRoles.SecretaryId || mm.RoleId == MeetingRoles.NonMemberSecretaryId)
                    .Select(mm => new { mm.Name, mm.UserGuid })
                    .FirstOrDefault(),
                Role = m.MeetingMembers
                    .Any(mm => mm.PositionGuid == condition.PositionGuid) ? m.MeetingMembers.Where(mm => mm.PositionGuid == condition.PositionGuid)
                    .Select(mm => mm.Role.Title)
                    .FirstOrDefault() : "ثبت کننده",
                Category = m.Category.Title,
                FollowMeeting = m.FollowGuid != null ? context.Meetings.FirstOrDefault(c => c.Guid == m.FollowGuid).Title : "",
                RoleId = m.MeetingMembers
                    .Any(mm => mm.PositionGuid == condition.PositionGuid) ? m.MeetingMembers.Where(mm => mm.PositionGuid == condition.PositionGuid)
                    .Select(mm => mm.Role.Id)
                    .FirstOrDefault() : condition.CanView ? 999 : 0,
                Description = m.Description,
                CreatedBy = m.CreatedBy,
                Created = m.Created.Value.ToString("yyyy/MM/dd"),
                UserGuids = m.MeetingMembers.Select(mm => mm.UserGuid).Where(g => g != null).Distinct().ToList(),
                Agendas = m.Agendas.Select(c => new AgendaItem()
                {
                    Id = c.Id,
                    Text = c.Text,
                    FileGuid = c.File
                }),
            })
            .FirstOrDefaultAsync();

        if (meeting == null)
            return Result<MeetingJsonModel>.Failure(null, "جلسه مورد نظر یافت نشد");

        var userGuids = new[]
        {
                meeting.Chairman?.UserGuid,
                meeting.Secretary?.UserGuid,
                meeting.CreatedBy
            }.Where(g => g.HasValue)
        .Distinct()
        .ToList();


        var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);
        var usersDict = users.ToDictionary(u => u.Guid, u => u.Fullname);

        var meetingModel = new MeetingJsonModel
        {
            Id = meeting.Id,
            Guid = meeting.Guid.Value,
            Number = meeting.Number,
            Title = meeting.Title,
            StartTime = meeting.StartTime.Value.ToString(@"hh\:mm"),
            EndTime = meeting.EndTime.Value.ToString(@"hh\:mm"),
            MtDate = meeting.MtDate,
            Status = meeting.Status,
            StatusId = meeting?.StatusId ?? 0,
            Location = meeting.Location,
            CategoryGuid = meeting.CategoryGuid,
            Chairman = meeting.Chairman?.UserGuid != null
                ? (usersDict.TryGetValue(meeting.Chairman.UserGuid.Value, out var chairmanName) ? chairmanName : meeting.Chairman.Name)
                : meeting.Chairman?.Name,
            Secretary = meeting.Secretary?.UserGuid != null
                ? (usersDict.TryGetValue(meeting.Secretary.UserGuid.Value, out var secretaryName) ? secretaryName : meeting.Secretary.Name)
                : meeting.Secretary?.Name,
            Role = meeting.Role ?? "ثبت کننده",
            Category = meeting.Category,
            RoleId = meeting.RoleId,
            Description = meeting.Description,
            Creator = meeting.CreatedBy.HasValue ? usersDict.TryGetValue(meeting.CreatedBy.Value, out var creator) ? creator : "" : "",
            Agendas = meeting.Agendas.ToList(),
            UserGuids = meeting.UserGuids,
            FollowMeeting = meeting.FollowMeeting,
            NotAllowReplacement = meeting.AllowReplacement ?? false,
            Rider = meeting.Rider,
            RiderGuid = meeting.RiderGuid,
            Created = meeting.Created
        };

        return Result<MeetingJsonModel>.EmptyMessage(meetingModel);
    }
    public async Task<Result<List<SuggestedSlotDto>>> Handle(SuggestedSlotsRequestDto condition)
    {
        var date = condition.Date.ToDateTime();
        var workStart = new TimeSpan(8, 0, 0);
        var workEnd = new TimeSpan(17, 0, 0);
        var duration = TimeSpan.FromMinutes(
            condition.SlotDurationMinutes is >= 30 and <= 120
                ? condition.SlotDurationMinutes : 60);

        var memberGuids = condition.Members
            .Select(m => m.UserGuid)
            .Distinct().ToList();

        // همه بازه‌های اشغال‌شده
        var fromMeetings = await context.Meetings
            .Where(m => m.StatusId == MeetingStatusIds.Registered && m.Date == date)
            .WhereIf(condition.MeetingGuid.HasValue, m => m.Guid != condition.MeetingGuid)
            .Where(m =>
                (condition.RoomGuid.HasValue && m.Room.Guid == condition.RoomGuid) ||
                m.MeetingMembers.Any(mm => mm.UserGuid.HasValue && memberGuids.Contains(mm.UserGuid.Value)))
            .Select(m => new { Start = m.StartTime.Value, End = m.EndTime.Value })
            .ToListAsync();

        var fromBlocked = memberGuids.Any()
            ? await context.BlockedTimes
                .Where(b => !b.IsRemoved && b.Date.Date == date.Date && memberGuids.Contains(b.UserGuid))
                .Select(b => new SlotTimeDto { Start = b.StartTime, End = b.EndTime })
                .ToListAsync()
            : new List<SlotTimeDto>();  // ← یا هر anonymous type خالی

        var occupied = fromMeetings
            .Select(s => (s.Start, s.End))
            .Concat(fromBlocked.Select(b => (b.Start, b.End)))
            .ToList();

        var slots = new List<SuggestedSlotDto>();
        var current = workStart;

        while (current + duration <= workEnd)
        {
            var end = current + duration;
            if (!occupied.Any(s => !(end <= s.Start || current >= s.End)))
                slots.Add(new SuggestedSlotDto
                {
                    StartTime = current.ToString(@"hh\:mm"),
                    EndTime = end.ToString(@"hh\:mm")
                });
            current = current.Add(TimeSpan.FromMinutes(30));
        }

        return Result<List<SuggestedSlotDto>>.Success(slots);
    }

    private class SlotTimeDto
    {
        public TimeSpan Start { get; set; }
        public TimeSpan End { get; set; }
    }

    // ═══════════════════════════════════════════════════════════════
    // ✅ Handle(MeetingConflictCheckDto) - نسخه جدید
    //
    // قوانین پیاده‌سازی شده:
    //
    // 1) اگر کاربری در جلسه فعلی به عنوان عضو اصلی (roleId != 6) باشد
    //    و در جلسه/جلسات همپوشانِ دیگر فقط به عنوان "مهمان" (roleId == 6)
    //    حضور داشته باشد → این یک تداخل واقعی محسوب نمی‌شود.
    //    فقط با Type = "GuestInfo" برگردانده می‌شود تا فرانت فقط
    //    یک پیغام اطلاع‌رسانی (نمایش جزئیات) نشان دهد، بدون مسدود کردن ثبت.
    //
    // 2) اگر کاربری برای خودش جانشین انتخاب کرده باشد (ReplacementUserGuid != null)
    //    یعنی گفته «من نمی‌آیم و این جانشین من است»، و خودش هم جانشین
    //    فرد دیگری در همان جلسه نباشد → او آزاد محسوب می‌شود و
    //    تداخلی برایش ثبت نمی‌شود (می‌تواند عضو جلسه جدید شود).
    // ═══════════════════════════════════════════════════════════════
    public async Task<Result<MeetingConflictResultDto>> Handle(MeetingConflictCheckDto condition)
    {
        var date = condition.Date.ToDateTime();
        var result = new MeetingConflictResultDto();

        // ══════════════════════════════════════════
        // ۱. تداخل اعضا با جلسات دیگر
        // ══════════════════════════════════════════
        if (condition.Members.Any())
        {
            // دریافت جلسات همپوشان به همراه جزئیات
            var overlappingMeetings = await context.Meetings
                .Where(c => c.StatusId == MeetingStatusIds.Registered)
                .WhereIf(condition.MeetingGuid != null, c => c.Guid != condition.MeetingGuid)
                .Where(m => m.Date == date &&
                            !(condition.EndTime <= m.StartTime || condition.StartTime >= m.EndTime))
                .Select(m => new
                {
                    m.Id,
                    Guid = m.Guid.Value,
                    m.Title,
                    m.Number,
                    StartTime = m.StartTime.Value,
                    EndTime = m.EndTime.Value,
                    m.CreatedBy,
                    Created = m.Created.Value,
                    Members = m.MeetingMembers.Select(mm => new
                    {
                        mm.UserGuid,
                        mm.ReplacementUserGuid,
                        RoleId = mm.RoleId ?? 0
                    }).ToList()
                })
                .ToListAsync();

            // flatten: هر رکورد = یک عضو + مشخصات جلسه‌اش
            var flatMembers = overlappingMeetings
                .SelectMany(mtg => mtg.Members, (mtg, mm) => new
                {
                    MeetingId = mtg.Id,
                    MeetingGuid = mtg.Guid,
                    MeetingTitle = mtg.Title,
                    MeetingNumber = mtg.Number,
                    MeetingStart = mtg.StartTime,
                    MeetingEnd = mtg.EndTime,
                    MeetingCreatedBy = mtg.CreatedBy,
                    MeetingCreated = mtg.Created,
                    mm.UserGuid,
                    mm.ReplacementUserGuid,
                    mm.RoleId
                })
                .Where(x => x.UserGuid != null)
                .ToList();

            // roleId اعضای جلسه فعلی (برای تشخیص اینکه کاربر اینجا "مهمان" است یا "عضو اصلی")
            var currentMeetingMemberRoles = condition.Members
                .GroupBy(m => m.UserGuid)
                .ToDictionary(g => g.Key, g => g.First().RoleId);

            // پیدا کردن کاربران متداخل + جلسه‌ی عامل تداخل
            var conflictMap = new Dictionary<Guid, (Guid MtgGuid, string Title, string? Number,
                TimeSpan Start, TimeSpan End, Guid? CreatedBy, DateTime Created)>();

            // کاربرانی که فقط باید به صورت اطلاع‌رسانی (مهمان در جلسه دیگر) نمایش داده شوند
            var infoOnlyUsers = new HashSet<Guid>();

            // ✅ بررسی هر کاربر بر اساس مجموع تمام رکوردهای او در جلسات همپوشان
            // (نه فقط اولین رکورد مواجه‌شده) چون یک کاربر می‌تواند هم‌زمان در
            // چند جلسه‌ی همپوشان حضور داشته باشد (مثلاً در یکی مهمان و در
            // دیگری عضو اصلی با جانشین تعیین‌شده).
            var targetUserGuids = flatMembers
                .Select(x => x.UserGuid!.Value)
                .Where(g => condition.Members.Any(x => x.UserGuid == g))
                .Distinct()
                .ToList();

            foreach (var userGuid in targetUserGuids)
            {
                var userEntries = flatMembers.Where(x => x.UserGuid == userGuid).ToList();

                var currentRole = currentMeetingMemberRoles.TryGetValue(userGuid, out var cr) ? cr : (int?)null;

                // ─────────────────────────────────────────────────────────
                // برای هر رکورد (هر جلسه‌ی همپوشانی که کاربر در آن حضور دارد)
                // مشخص می‌کنیم که آیا آن رکورد یک "تداخل واقعی" است یا نه:
                //
                // - اگر roleId == GuestRoleId در آن جلسه باشد و کاربر در جلسه
                //   فعلی مهمان نباشد → این رکورد فقط GuestInfo است.
                //
                // - اگر کاربر برای خودش در آن جلسه جانشین تعیین کرده باشد
                //   (ReplacementUserGuid != null) و خودش هم جانشین فرد دیگری
                //   در همان جلسه نباشد → او در آن جلسه آزاد شده و این رکورد
                //   تداخل محسوب نمی‌شود (نه واقعی، نه حتی GuestInfo).
                //
                // - در غیر این صورت → تداخل واقعی (Meeting).
                // ─────────────────────────────────────────────────────────
                var realConflictEntries = new List<(Guid MtgGuid, string Title, string? Number,
                    TimeSpan Start, TimeSpan End, Guid? CreatedBy, DateTime Created)>();

                var guestInfoEntries = new List<(Guid MtgGuid, string Title, string? Number,
                    TimeSpan Start, TimeSpan End, Guid? CreatedBy, DateTime Created)>();

                foreach (var entry in userEntries)
                {
                    var entryTuple = (entry.MeetingGuid, entry.MeetingTitle, entry.MeetingNumber,
                        entry.MeetingStart, entry.MeetingEnd, entry.MeetingCreatedBy, entry.MeetingCreated);

                    // قانون: کاربر در این جلسه فقط "مهمان" است
                    if (entry.RoleId == GuestRoleId && currentRole != GuestRoleId)
                    {
                        guestInfoEntries.Add(entryTuple);
                        continue;
                    }

                    // قانون: کاربر برای خودش در این جلسه جانشین تعیین کرده
                    bool hasSetOwnReplacement = entry.ReplacementUserGuid != null;
                    bool isSomeoneElsesReplacement = flatMembers.Any(m => m.ReplacementUserGuid == userGuid &&
                                                                            m.MeetingId == entry.MeetingId);

                    if (hasSetOwnReplacement && !isSomeoneElsesReplacement)
                    {
                        // آزاد است؛ این رکورد نه تداخل واقعی و نه GuestInfo محسوب می‌شود
                        continue;
                    }

                    // در غیر این صورت: تداخل واقعی
                    realConflictEntries.Add(entryTuple);
                }

                if (realConflictEntries.Count > 0)
                {
                    // اولویت با تداخل واقعی است
                    conflictMap[userGuid] = realConflictEntries.First();
                }
                else if (guestInfoEntries.Count > 0)
                {
                    conflictMap[userGuid] = guestInfoEntries.First();
                    infoOnlyUsers.Add(userGuid);
                }
            }

            // دریافت نام ثبت‌کنندگان (یکجا)
            var creatorGuids = conflictMap.Values
                .Where(v => v.CreatedBy.HasValue)
                .Select(v => v.CreatedBy)
                .Distinct().ToList();
            var creators = await userManagementAclService.GetUsersByGuidsAsync(creatorGuids);
            var creatorsDict = creators.ToDictionary(c => c.Guid, c => c.Fullname);

            var userConflicts = conflictMap.Select(kv =>
            {
                var v = kv.Value;
                var cn = v.CreatedBy.HasValue && creatorsDict.TryGetValue(v.CreatedBy.Value, out var n) ? n : "";
                return new MeetingConflictTypeDto
                {
                    Guid = kv.Key,
                    // ✅ مهمان در جلسه دیگر → فقط اطلاع‌رسانی (GuestInfo)
                    Type = infoOnlyUsers.Contains(kv.Key) ? "GuestInfo" : "Meeting",
                    ConflictMeetingGuid = v.MtgGuid,
                    ConflictMeetingTitle = v.Title,
                    ConflictMeetingNumber = v.Number,
                    ConflictMeetingStartTime = v.Start.ToString(@"hh\:mm"),
                    ConflictMeetingEndTime = v.End.ToString(@"hh\:mm"),
                    ConflictMeetingCreatorName = cn,
                    ConflictMeetingCreatedDate = v.Created.ToString("yyyy/MM/dd")
                };
            }).ToList();

            // تداخل با BlockedTime (بدون تغییر منطق)
            var memberUserGuids = condition.Members.Select(m => m.UserGuid).Distinct().ToList();
            var blockedConflicts = await context.BlockedTimes
                .Where(b => !b.IsRemoved && memberUserGuids.Contains(b.UserGuid))
                .Where(b => b.Date.Date == date.Date)
                .Where(b => condition.StartTime < b.EndTime && condition.EndTime > b.StartTime)
                .Select(b => new { b.UserGuid, b.StartTime, b.EndTime, b.Description })
                .ToListAsync();

            foreach (var blocked in blockedConflicts)
            {
                var member = condition.Members.FirstOrDefault(m => m.UserGuid == blocked.UserGuid);
                if (member == null) continue;
                if (userConflicts.Any(c => c.Guid == member.UserGuid && c.Type == "BlockedTime")) continue;

                userConflicts.Add(new MeetingConflictTypeDto
                {
                    Guid = member.UserGuid,
                    Type = "BlockedTime",
                    Description = blocked.Description ?? "عدم حضور",
                    StartTime = blocked.StartTime.ToString(@"hh\:mm"),
                    EndTime = blocked.EndTime.ToString(@"hh\:mm")
                });
            }

            result.UsersWithConflict = userConflicts;
        }

        // ══════════════════════════════════════════
        // ۲. تداخل مکان
        // ══════════════════════════════════════════
        if (condition.RoomGuid.HasValue)
        {
            var roomMtg = await context.Meetings
                .Where(x => x.StatusId == MeetingStatusIds.Registered)
                .WhereIf(condition.MeetingGuid != null, c => c.Guid != condition.MeetingGuid)
                .Where(m => m.Date == date &&
                            m.Room.Guid == condition.RoomGuid &&
                            !(condition.EndTime <= m.StartTime || condition.StartTime >= m.EndTime))
                .Select(m => new
                {
                    Guid = m.Guid.Value,
                    m.Title,
                    m.Number,
                    Start = m.StartTime.Value,
                    End = m.EndTime.Value,
                    m.CreatedBy,
                    Created = m.Created.Value
                })
                .FirstOrDefaultAsync();

            result.RoomConflict = roomMtg != null;

            if (roomMtg != null)
            {
                var roomCreatorName = "";
                if (roomMtg.CreatedBy.HasValue)
                {
                    var rc = await userManagementAclService.GetUsersByGuidsAsync(
                        new List<Guid?> { roomMtg.CreatedBy.Value });
                    roomCreatorName = rc.FirstOrDefault()?.Fullname ?? "";
                }
                result.RoomConflictMeeting = new RoomConflictMeetingDto
                {
                    Guid = roomMtg.Guid,
                    Title = roomMtg.Title,
                    Number = roomMtg.Number,
                    StartTime = roomMtg.Start.ToString(@"hh\:mm"),
                    EndTime = roomMtg.End.ToString(@"hh\:mm"),
                    CreatorName = roomCreatorName,
                    CreatedDate = roomMtg.Created.ToString("yyyy/MM/dd")
                };
            }
        }

        return Result<MeetingConflictResultDto>.Success(result);
    }

    private class PersonalLeave
    {
        public string Title { get; set; }
        public DateTime Start { get; set; }
        public DateTime End { get; set; }
        public string UserName { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
    }

    public Task<Result<List<MeetingJsonModel>>> Handle(MeetingSearchRequestDto condition)
    {
        throw new NotImplementedException();
    }


    async Task<Result<EditMeetingDto>> IQueryHandlerAsync<Result<EditMeetingDto>, Guid>.Handle(Guid condition)
    {
        var meet = await context.Meetings.FirstOrDefaultAsync(c => c.Guid == condition);
        var meeting = await context.Meetings
            .Include(c => c.Category)
            .Include(c => c.MeetingMembers)
            .Include(c => c.Agendas)
            .Where(c => c.Guid == condition)
            .Select(c => new EditMeetingDto
            {
                Title = c.Title,
                Date = c.Date.Value.ToString("yyyy/MM/dd"),
                CategoryGuid = c.Category.Guid,
                StartTime = c.StartTime.Value,
                EndTime = c.EndTime.Value,
                RoomGuid = c.Room.Guid,
                FollowGuid = c.FollowGuid,
                Guid = c.Guid.Value,
                NotAllowReplacement = c.NotAllowReplacement ?? false,
                RoomLink = c.RoomLink,
                RoomName = c.RoomName,
                Number = c.Number,
                CreatedBy = c.CreatedBy,
                Members = c.MeetingMembers.Select(d => new MeetingMemberDto()
                {
                    Name = d.Name,
                    ReplacementUserGuid = d.ReplacementUserGuid,
                    UserGuid = d.UserGuid,
                    Comment = d.Comment,
                    Id = d.Id,
                    RoleId = d.RoleId ?? 0,
                    IsExternal = d.IsExternal.Value,
                    Email = d.Email,
                    Mobile = d.Mobile,
                    ProfileGuid = d.Profile,
                    SignatureGuid = d.Signature,
                    Organization = d.Organization
                }).ToList(),
                Agendas = c.Agendas.OrderBy(d => d.SortOrder).Select(a => new AgendaDto()
                {
                    Id = a.Id,
                    Text = a.Text,
                    Order = a.SortOrder ?? 0,
                    IsRemoved = false,
                    // ✅ بارگذاری فایل‌های مرتبط
                    Files = context.Files
                   .Where(f => f.ModuleId == a.Id && f.Type == FileType.Agenda)
                   .Select(f => new FileDto(f.Id, false, f.FileGuid))
                   .ToList()
                }).ToList()
            }).FirstOrDefaultAsync();
        var userGuids = meeting.Members
            .SelectMany(m => new[] { m.UserGuid })
            .Where(g => g.HasValue)
            .Distinct()
            .ToList();

        var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);
        var usersDict = users.ToDictionary(u => u.Guid, u => u.Fullname);

        var meetingMembers = meeting.Members.Select(d =>
        {

            var userName = d.UserGuid != null
                ? (usersDict.TryGetValue(d.UserGuid.Value, out var creatorName) ? creatorName : "")
                : d.Name;

            return new MeetingMemberDto
            {
                Name = userName,
                ReplacementUserGuid = d.ReplacementUserGuid,
                UserGuid = d.UserGuid,
                Comment = d.Comment,
                Id = d.Id,
                RoleId = d.RoleId,
                IsExternal = d.IsExternal,
                Email = d.Email,
                Mobile = d.Mobile,
                ProfileGuid = d.ProfileGuid,
                SignatureGuid = d.SignatureGuid,
                Organization = d.Organization
            };
        }).ToList();
        meeting.Members = meetingMembers;
        return meeting == null ? Result<EditMeetingDto>.Failure(null, "جلسه مورد نظر یافت نشد") : Result<EditMeetingDto>.EmptyMessage(meeting);
    }

    public async Task<Result<bool>> Handle(CheckSignGuidDto condition)
    {
        var meeting = await context.Meetings
            .Where(c => c.Guid == condition.Guid)
            .Include(c => c.Resolutions).
        Include(meeting => meeting.MeetingMembers)
            .FirstOrDefaultAsync();
        if (meeting == null)
            return Result<bool>.Failure(false, "جلسه مورد نظر یافت نشد");
        var members = meeting.MeetingMembers
            .Where(x => !(x.IsExternal ?? true) && x.UserGuid != null)
            .ToList();

        var presentedMembers = members.Where(c => c.IsPresent == true).ToList();
        var allPresentSigned = presentedMembers.All(c => c.IsSign == true);

        var chairSigned = members.Any(x => x.RoleId == MeetingRoles.ChairmanId && x.IsPresent == true && x.IsSign == true);
        var secretarySigned = members.Any(x => (x.RoleId == MeetingRoles.SecretaryId || x.RoleId == MeetingRoles.NonMemberSecretaryId) && x.IsPresent == true && x.IsSign == true);

        var result = allPresentSigned || (chairSigned && secretarySigned);
        return Result<bool>.Success(result);
    }
    #region MeetingStatistic
    public async Task<Result<List<MeetingStatisticResultDto>>> Handle(MeetingStatisticRequestDto condition)
    {
        var pc = new PersianCalendar();
        var now = DateTime.Now;

        var year = pc.GetYear(now);
        var month = pc.GetMonth(now);
        var day = pc.GetDayOfMonth(now);

        DateTime startDate;
        var endDate = now;

        switch (condition.Type)
        {
            case ReportType.Weekly:
                // پیدا کردن شنبه‌ی همین هفته
                var todayPersianDayOfWeek = (int)now.DayOfWeek;

                // در ساختار میلادی، Saturday = 6, Sunday = 0, Monday = 1, ..., Friday = 5
                // ما می‌خواهیم Saturday = 0 (یعنی شنبه)، Sunday = 1, ..., Friday = 6

                int customWeekDay = todayPersianDayOfWeek == 6 ? 0 : todayPersianDayOfWeek + 1;

                // حالا شروع هفته را از شنبه محاسبه کن
                startDate = now.Date.AddDays(-customWeekDay);
                endDate = startDate.AddDays(6);
                break;

            case ReportType.Monthly:
                startDate = pc.ToDateTime(year, month, 1, 0, 0, 0, 0);
                endDate = pc.ToDateTime(year, month, DateTime.DaysInMonth(startDate.Year, startDate.Month) == 31 ? 30 : DateTime.DaysInMonth(startDate.Year, startDate.Month), 23, 59, 59, 999);
                break;

            case ReportType.Yearly:
                startDate = pc.ToDateTime(year, 1, 1, 0, 0, 0, 0);
                endDate = pc.ToDateTime(year, 12, 29, 23, 59, 59, 999); // اسفند 29 یا 30 بررسی شود
                break;

            default:
                startDate = now.AddDays(-7);
                break;
        }

        var meetings = await context.Meetings
            .Include(c => c.MeetingMembers)
            .Where(m => m.StatusId >= 3 && m.MeetingMembers.Any(c => c.PositionGuid == condition.PositionGuid && c.IsPresent == true) &&
                        m.Date >= startDate && m.Date <= endDate)
            .ToListAsync();
        var groupedMeetings = meetings
            .GroupBy(m => GroupByPeriod(m.Date.Value, condition.Type))
            .ToDictionary(
                g => g.Key,
                g => new
                {
                    Count = g.Count(),
                    Duration = g.Sum(m => (m.EndTime.Value - m.StartTime.Value).TotalHours)
                }
            );
        List<MeetingStatisticResultDto> result = [];
        switch (condition.Type)
        {
            case ReportType.Weekly:
                for (var date = startDate.Date; date <= endDate.Date; date = date.AddDays(1))
                {
                    var key = $"{GetPersianDayOfWeekName(pc.GetDayOfWeek(date))}";
                    result.Add(new MeetingStatisticResultDto()
                    {
                        DateLabel = key,
                        Count = groupedMeetings.TryGetValue(key, out var meeting) ? meeting.Count : 0,
                        Duration = groupedMeetings.TryGetValue(key, out var groupedMeeting) ? groupedMeeting.Duration : 0
                    });
                }
                //for (var date = startDate.Date; date <= endDate.Date; date = date.AddDays(1))
                //{
                //    var key = date.ToString("dddd", new CultureInfo("fa-IR"));
                //    result.Add(new MeetingStatisticResultDto()
                //    {
                //        DateLabel = key,
                //        Count = groupedMeetings.TryGetValue(key, out var meeting) ? meeting.Count : 0,
                //        Duration = groupedMeetings.TryGetValue(key, out var groupedMeeting) ? groupedMeeting.Duration : 0
                //    });
                //}
                break;
            case ReportType.Monthly:
                //for (var date = startDate.Date; date <= endDate.Date; date = date.AddDays(1))
                //{
                //    var key = date.ToString("dd MMM", new CultureInfo("fa-IR"));
                //    result.Add(new MeetingStatisticResultDto()
                //    {
                //        DateLabel = key,
                //        Count = groupedMeetings.TryGetValue(key, out var meeting) ? meeting.Count : 0,
                //        Duration = groupedMeetings.TryGetValue(key, out var groupedMeeting) ? groupedMeeting.Duration : 0
                //    });
                //}

                var daysInMonth = pc.GetDaysInMonth(pc.GetYear(startDate), pc.GetMonth(startDate));

                for (int i = 1; i <= daysInMonth; i++)
                {
                    var date = pc.ToDateTime(pc.GetYear(startDate), pc.GetMonth(startDate), i, 0, 0, 0, 0);
                    var key = $"{i:00} {GetPersianMonthName(pc.GetMonth(date))}";

                    result.Add(new MeetingStatisticResultDto()
                    {
                        DateLabel = key,
                        Count = groupedMeetings.TryGetValue(key, out var meeting) ? meeting.Count : 0,
                        Duration = groupedMeetings.TryGetValue(key, out var groupedMeeting) ? groupedMeeting.Duration : 0
                    });
                }
                break;
            case ReportType.Yearly:
                //for (var date = startDate; date <= endDate; date=date.AddMonths(1))
                //{
                //    var key = date.ToString("MMM yyyy", new CultureInfo("fa-IR"));
                //    result.Add(new MeetingStatisticResultDto()
                //    {
                //        DateLabel = key,
                //        Count = groupedMeetings.TryGetValue(key, out var meeting) ? meeting.Count : 0,
                //        Duration = groupedMeetings.TryGetValue(key, out var groupedMeeting) ? groupedMeeting.Duration : 0
                //    });
                //}
                for (int m = 1; m <= 12; m++)
                {
                    var key = $"{GetPersianMonthName(m)} {year}";
                    result.Add(new MeetingStatisticResultDto()
                    {
                        DateLabel = key,
                        Count = groupedMeetings.TryGetValue(key, out var meeting) ? meeting.Count : 0,
                        Duration = groupedMeetings.TryGetValue(key, out var groupedMeeting) ? groupedMeeting.Duration : 0
                    });
                }
                break;
        }
        //if (condition.Type is ReportType.Monthly or ReportType.Weekly)
        //{
        //    for (var date = startDate.Date; date <= endDate.Date; date = date.AddDays(1))
        //    {
        //        var key = date.ToString("yyyy-MM-dd");
        //        result.Add(new MeetingStatisticResultDto()
        //        {
        //            DateLabel = key,
        //            Count = groupedMeetings.TryGetValue(key, out var meeting) ? meeting.Count : 0,
        //            Duration = groupedMeetings.TryGetValue(key, out var groupedMeeting) ? groupedMeeting.Duration : 0
        //        });
        //    }
        //}
        //else if (condition.Type==ReportType.Yearly)
        //{
        //    for (int month = 1; month <= 12; month++)
        //    {
        //        var key = $"{endDate.Year}-{month:00}";
        //        result.Add(new MeetingStatisticResultDto()
        //        {
        //            DateLabel = key,
        //            Count = groupedMeetings.TryGetValue(key, out var meeting) ? meeting.Count : 0,
        //            Duration = groupedMeetings.TryGetValue(key, out var groupedMeeting) ? groupedMeeting.Duration : 0
        //        });
        //    }
        //}

        return Result<List<MeetingStatisticResultDto>>.EmptyMessage(result);
    }
    private string GroupByPeriod(DateTime date, ReportType periodType)
    {
        var pc = new PersianCalendar();

        int year = pc.GetYear(date);
        int month = pc.GetMonth(date);
        int day = pc.GetDayOfMonth(date);
        var dayOfWeek = pc.GetDayOfWeek(date);

        switch (periodType)
        {
            case ReportType.Weekly:
                // نمایش نام روز هفته (مثلاً شنبه)
                return GetPersianDayOfWeekName(dayOfWeek);

            case ReportType.Monthly:
                // نمایش روز و ماه (مثلاً ۰۵ اردیبهشت)
                return $"{day:00} {GetPersianMonthName(month)}";

            case ReportType.Yearly:
                // نمایش ماه و سال (مثلاً اردیبهشت ۱۴۰۳)
                return $"{GetPersianMonthName(month)} {year}";

            default:
                return $"{day:00}/{month:00}/{year}";
        }
    }
    private string GetPersianMonthName(int month)
    {
        string[] persianMonths = new[]
        {
                "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
                "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
            };
        return persianMonths[month - 1];
    }

    private string GetPersianDayOfWeekName(DayOfWeek day)
    {
        return day switch
        {
            DayOfWeek.Saturday => "شنبه",
            DayOfWeek.Sunday => "یک‌شنبه",
            DayOfWeek.Monday => "دو‌شنبه",
            DayOfWeek.Tuesday => "سه‌شنبه",
            DayOfWeek.Wednesday => "چهار‌شنبه",
            DayOfWeek.Thursday => "پنج‌شنبه",
            DayOfWeek.Friday => "جمعه",
            _ => ""
        };
    }

    #endregion

    public async Task<Result<List<MeetingComboModel>>> Handle() =>
        Result<List<MeetingComboModel>>.EmptyMessage(await context.Meetings.Select(m => new MeetingComboModel
        {
            Guid = m.Guid.Value,
            Title = m.Title
        }).ToListAsync());



    async Task<Result<List<GuestComboDto>>> IQueryHandlerAsync<Result<List<GuestComboDto>>, Guid>.Handle(Guid condition) => Result<List<GuestComboDto>>.EmptyMessage(await context.MeetingsMembers
            .Where(c => c.Meeting.Guid == condition)
            .Where(c => c.UserGuid != null)
            .Select(c => new GuestComboDto()
            {
                Id = c.Id,
                Title = c.Name,
            }).ToListAsync());
    #region DashboardQueries

    async Task<Result<List<TodayMeetingDto>>> IQueryHandlerAsync<Result<List<TodayMeetingDto>>, Guid>.Handle(Guid condition)
    {
        var today = DateTime.Today;
        var tomorrow = today.AddDays(1);

        var meetings = await context.Meetings
            .Where(m =>
                m.StatusId == MeetingStatusIds.Registered &&
                (m.CreatorPositionGuid == condition || m.MeetingMembers.Any(mm => mm.PositionGuid == condition)) &&
                (EF.Functions.DateDiffDay(m.Date, today) == 0 || EF.Functions.DateDiffDay(m.Date, tomorrow) == 0)
            )
            .OrderByDescending(m => m.Id)
            .Select(m => new TodayMeetingDto
            {
                Number = m.Number,
                Type = EF.Functions.DateDiffDay(m.Date, today) == 0 ? "Today" : "Tomorrow",
                Room = !string.IsNullOrEmpty(m.RoomLink) ? m.RoomLink :
                    !string.IsNullOrEmpty(m.RoomName) ? m.RoomName :
                    m.Room.Title, // از navigation property استفاده می‌کنیم
                Time = m.EndTime.Value.ToString(@"hh\:mm") + '-' + m.StartTime.Value.ToString(@"hh\:mm"),
                Title = m.Title,
                Guid = m.Guid.Value
            })
            .ToListAsync();

        return Result<List<TodayMeetingDto>>.Success(meetings);
    }
    #endregion
    async Task<Result<CheckMeetingDto>> IQueryHandlerAsync<Result<CheckMeetingDto>, Guid>.Handle(Guid condition)
    {
        var result = new CheckMeetingDto();
        var meeting = await context.Meetings
            .Where(c => c.Guid == condition)
            .Include(c => c.Resolutions)
            .Include(meeting => meeting.MeetingMembers)
            .FirstOrDefaultAsync();
        if (meeting == null)
            return Result<CheckMeetingDto>.Failure(null, "جلسه مورد نظر یافت نشد");
        result.ExistResolution = meeting.Resolutions.Any() || !string.IsNullOrEmpty(meeting.Description);
        result.Attendance = meeting.MeetingMembers.All(c => c.IsPresent != null);
        return Result<CheckMeetingDto>.Success(result);
    }



    public async Task<Result<List<MeetingCalendarDto>>> Handle(MeetingCalendarSearchDto condition)
    {

        //var meeting =await dapperRepository.SelectFromSpAsync<MeetingCalendarDto>("GetCalendarRecords",
        //    new { UserGuid = condition.UserGuid, PersonalNo = condition.PersonalNo });
        var creatorMeetingsQuery = context.Meetings
         .AsNoTracking()
         .Where(x => x.CreatorPositionGuid == condition.PositionGuid
                  && x.Date >= condition.StartDate
                  && x.Date <= condition.EndDate);

        var memberMeetingsQuery = context.Meetings
            .AsNoTracking()
            .Where(x => x.MeetingMembers.Any(d => d.PositionGuid == condition.PositionGuid)
                     && x.Date >= condition.StartDate
                     && x.Date <= condition.EndDate);

        var meetings = await creatorMeetingsQuery
            .Union(memberMeetingsQuery)
            .Select(x => new MeetingCalendarDto()
            {
                Title = x.Title,
                Guid = x.Guid.Value,
                Type = "Meeting",
                Start = x.Date.Value.Add(x.StartTime.Value),
                End = x.Date.Value.Add(x.EndTime.Value)
            })
            .ToListAsync();
        //  var meeting = dapperRepository.Select<MeetingCalendarDto>(sql, new { UserGuid = condition.UserGuid ,PersonalNo=condition.PersonalNo});

        return Result<List<MeetingCalendarDto>>.Success(meetings);
    }

    public async Task<Result<List<ComboBase>>> Handle(MeetingGuidDto condition)
    {
        var meetings = await context.Meetings.Where(x => x.Category.Guid == condition.Guid)
            .Select(x => new ComboBase()
            {
                Guid = x.Guid.Value,
                Title = x.Title,
                Id = x.Id,
            }).ToListAsync();
        return Result<List<ComboBase>>.EmptyMessage(meetings);
    }

    public async Task<Result<CheckMeetingNumberResultDto>> Handle(CheckMeetingNumberDto condition)
    {
        var result = new CheckMeetingNumberResultDto();

        // بررسی وجود شماره تکراری در همان دسته‌بندی
        var existingMeeting = await context.Meetings
            .Where(m => m.Number == condition.Number && m.Category.Guid == condition.CategoryGuid)
            .WhereIf(condition.MeetingGuid.HasValue, m => m.Guid != condition.MeetingGuid) // در حالت ویرایش، خود جلسه را exclude کن
            .Select(m => new { m.Title, m.Number })
            .FirstOrDefaultAsync();

        if (existingMeeting != null)
        {
            result.IsDuplicate = true;
            result.ExistingMeetingTitle = existingMeeting.Title;
        }

        return Result<CheckMeetingNumberResultDto>.Success(result);
    }

    public async Task<Result<MeetingCountDto>> Handle(MeetingCountRequestDto condition)
    {
        var today = DateTime.Today;

        // یک کوئری واحد برای همه شمارش‌ها
        var meetingCounts = await context.Meetings
            .Where(m =>
                (m.StatusId == MeetingStatusIds.Draft && m.CreatorPositionGuid == condition.PositionGuid) ||
                (m.StatusId != MeetingStatusIds.Draft && (m.CreatorPositionGuid == condition.PositionGuid ||
                 m.MeetingMembers.Any(mm => mm.PositionGuid == condition.PositionGuid && mm.RoleId != MeetingRoles.GuestId)))
            )
            .GroupBy(m => 1)
            .Select(g => new MeetingCountDto
            {
                DraftMeetingsCount = g.Count(m => m.StatusId == MeetingStatusIds.Draft),
                TodayMeetingsCount = g.Count(m => m.Date.Value.Date == today),
                UpcomingMeetingsCount = g.Count(m => m.Date.Value.Date > today),
                SignatureMeetingsCount = g.Where(c => c.StatusId == MeetingStatusIds.Finalized)
                    .Count(m =>
                        (m.MeetingMembers.Any(mm =>
                            mm.PositionGuid == condition.PositionGuid && mm.UserGuid == condition.UserGuid &&
                            (mm.IsSign == false || mm.IsSign == null) &&
                            mm.IsPresent == true
                        )) && (m.MeetingMembers.Any(mm =>
                            mm.RoleId == MeetingRoles.ChairmanId &&
                            mm.IsPresent == true &&
                            mm.IsSign == true
                        ) || m.MeetingMembers.Any(x => x.PositionGuid == condition.PositionGuid && x.UserGuid == condition.UserGuid && x.RoleId == MeetingRoles.ChairmanId))
                    ),
                FinishedMeetingsCount = g.Count(m => m.StatusId == MeetingStatusIds.Finalized),
                AllMeetingsCount = g.Count(),
                CanceledMeetingsCount = g.Count(c => c.StatusId == MeetingStatusIds.Signed),
                AttendanceMeetingsCount = g.Count(c =>
                    c.StatusId == MeetingStatusIds.Registered &&
                    c.MeetingMembers.Any(x => x.PositionGuid == condition.PositionGuid && (x.IsAttendance != true)) &&
                    c.Date.Value.Date >= today),

                // جدید: جلسات تعیین تکلیف نشده
                // جلساتی که وضعیت 1، 2 یا 3 دارند و تاریخشان گذشته است
                UndeterminedMeetingsCount = g.Count(m =>
                    (m.StatusId == MeetingStatusIds.Draft || m.StatusId == MeetingStatusIds.Registered || m.StatusId == MeetingStatusIds.Held) &&
                    m.Date.Value.Date < today
                )
            })
            .FirstOrDefaultAsync();

        return Result<MeetingCountDto>.Success(meetingCounts ?? new MeetingCountDto());
    }
    public async Task<Result<List<MeetingFutureDto>>> Handle(MeetingFutureRequestDto condition)
    {
        var today = DateTime.Today;
        var fourDaysAgo = today.AddDays(4);

        var query = context.Meetings
            .Where(m =>
                (m.StatusId == MeetingStatusIds.Draft && m.CreatorPositionGuid == condition.PositionGuid) ||
                (m.StatusId != MeetingStatusIds.Draft && (m.CreatorPositionGuid == condition.PositionGuid ||
                 m.MeetingMembers.Any(mm => mm.PositionGuid == condition.PositionGuid && mm.RoleId != MeetingRoles.GuestId)))
            )
            .Where(m => m.Date <= fourDaysAgo && m.Date >= today)
            .OrderByDescending(c => c.Date)
            .ThenByDescending(x => x.StartTime);

        var meetingsData = await query
            .Include(m => m.MeetingMembers.Where(mm => mm.RoleId == MeetingRoles.SecretaryId || mm.RoleId == MeetingRoles.NonMemberSecretaryId || mm.RoleId == MeetingRoles.ChairmanId))
            .ThenInclude(mm => mm.Role)
            .Include(m => m.Category)
            .Include(m => m.Status)
            .Include(m => m.Room)
            .Select(m => new MeetingFutureDto
            {
                Guid = m.Guid.Value,
                Title = m.Title,

                Date = m.Date.Value.ToString("yyyy/MM/dd")
           + " - "
           + m.StartTime.Value.ToString(@"hh\:mm")
           + '~'
           + m.EndTime.Value.ToString(@"hh\:mm"),

                Place = !string.IsNullOrEmpty(m.RoomLink)
        ? m.RoomLink
        : !string.IsNullOrEmpty(m.RoomName)
            ? m.RoomName
            : m.Room.Title,

                Status =
        m.StatusId == MeetingStatusIds.Completed
            ? 3
            : m.Date < DateTime.Today ||
              (m.Date == DateTime.Today &&
               m.EndTime <= DateTime.Now.TimeOfDay)
                ? 2
                : 1
            })
            .ToListAsync();

        return Result<List<MeetingFutureDto>>.EmptyMessage(meetingsData);
    }

}