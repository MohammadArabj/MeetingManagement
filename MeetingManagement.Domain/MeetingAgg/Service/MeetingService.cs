using Epc.Application.FileValidation;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Agenda;
using MeetingManagement.Application.Contracts.Member;
using MeetingManagement.Application.Contracts.UploadFile;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.BoardMemberAgg;
using MeetingManagement.Domain.CategoryAgg;
using MeetingManagement.Domain.NotificationEventAgg;
using MeetingManagement.Domain.NotificationSettingAgg;
using MeetingManagement.Domain.RoomAgg;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace MeetingManagement.Domain.MeetingAgg.Service;

public class MeetingService(ICategoryRepository categoryRepository,
    IRoomRepository roomRepository,
    IMeetingRepository meetingRepository, IFileService fileService,
    IUserManagementAclService userManagementAclService,
    INotificationEventRepository notificationEventRepository,
    INotificationSettingRepository notificationSettingRepository,
    IBoardMemberRepository boardMemberRepository,
    IConfiguration configuration,
    IHttpContextAccessor httpContextAccessor) : IMeetingService
{
    public void AddAgendas(Meeting meeting, Guid creator, string systemGuid, List<AgendaDto> agendas)
    {
        // حذف دستور جلساتی که باید حذف شوند
        var agendasToRemove = agendas.Where(x => x.IsRemoved).ToList();
        foreach (var agendaToRemove in agendasToRemove
            .Select(item => meeting.Agendas.FirstOrDefault(c => c.Id == item.Id))
            .OfType<Agenda>())
        {
            meeting.Agendas.Remove(agendaToRemove);
        }

        // پردازش دستور جلساتی که حذف نشده‌اند
        var agendasToProcess = agendas.Where(x => !x.IsRemoved).ToList();

        foreach (var item in agendasToProcess)
        {
            if (item.Id == 0 || !item.Id.HasValue)
            {
                // ✅ دستور جلسه جدید
                if (!string.IsNullOrEmpty(item.Text))
                {
                    var newAgenda = new Agenda(creator, item, meeting.Id);
                    meeting.Agendas.Add(newAgenda);

                    // فایل‌ها بعداً توسط FileRepository اضافه می‌شوند
                    // چون نیاز به AgendaId داریم که بعد از SaveChanges مشخص می‌شود
                }
            }
            else
            {
                // ✅ ویرایش دستور جلسه موجود
                var agenda = meeting.Agendas.FirstOrDefault(c => c.Id == item.Id);
                if (agenda == null) continue;

                agenda.Edit(item);
            }
        }
    }

    public string GetNumber(int categoryId)
    {
        var category = categoryRepository.Load(categoryId);
        var lastMeeting = meetingRepository.Filter(c => c.CategoryId == categoryId).MaxBy(c => c.Id);

        // پیدا کردن آخرین شماره ثبت شده در این دسته
        var lastNumberString = lastMeeting?.Number; // در صورتی که هیچ جلسه‌ای نباشد، از شماره شروع استفاده می‌کنیم

        // استخراج 4 رقم آخر شماره (که باید افزایش پیدا کند)
        var lastThreeDigits = lastNumberString?[^4..];

        // تبدیل چهار رقم آخر به عدد و افزایش آن
        var lastNumber = int.Parse(lastThreeDigits ?? "0");
        var newNumber = lastNumber != 0 ? lastNumber + category.Step : category.StartNumber;

        // حالا باید شماره را با فرمت مناسب تنظیم کنیم
        var currentDate = DateTime.Now.Date.ToString("");
        var currentDay = DateTime.Now.ToString("dd");
        var currentMonth = DateTime.Now.ToString("MM");
        var currentYear = DateTime.Now.ToString("yyyy");
        // ساخت شماره با جایگزینی فرمت
        var formattedNumber = category.NumberFormat
            .Replace("%i", newNumber.ToString("D4"))  // جایگزینی شماره افزایشی با 3 رقم
            .Replace("%d", currentDay) // جایگزینی روز
            .Replace("%m", currentMonth) // جایگزینی ماه
            .Replace("%y", currentYear); // جایگزینی سال

        return formattedNumber;
    }

    public async Task AddMembers(Meeting meeting, Guid creator, string systemGuid, List<MeetingMemberDto> members)
    {
        var membersToRemove = members.Where(x => x.IsRemoved).ToList();
        foreach (var member in membersToRemove
                     .Select(item => meeting.MeetingMembers.FirstOrDefault(c => c.Id == item.Id))
                     .OfType<MeetingMember>())
        {
            meeting.MeetingMembers.Remove(member);
        }

        if (membersToRemove.Any())
        {
            #region sendNotification
            var eventEntity = notificationEventRepository.Load(2);
            if (eventEntity is { IsActive: 1 })
            {
                var setting = (notificationSettingRepository.Filter(x => x.NotificationEventId == eventEntity.Id, null, "Template")).FirstOrDefault();
                if (setting != null || setting.IsSmsEnabled)
                {

                    var location = !string.IsNullOrEmpty(meeting.RoomLink) ? meeting.RoomLink :
                        !string.IsNullOrEmpty(meeting.RoomName) ? meeting.RoomName :
                        roomRepository.Load(meeting.RoomId ?? 0).Title;
                    var message = setting.Template.Content.Replace("[Title]", meeting.Title)
                        .Replace("[Date]",
                            meeting.Date?.ToString("yyyy/MM/dd") + "-" + meeting.StartTime + '~' + meeting.EndTime)
                        .Replace("[Place]", location);

                    var guids = membersToRemove.Where(c => c.IsExternal == false).Select(c => c.UserGuid)
                        .ToList();
                    var users = userManagementAclService.GetUsersByGuidsAsync(guids).Result;
                    var mobiles = users.Where(c => !string.IsNullOrEmpty(c.Mobile)).Select(c => c.Mobile).ToList();
                    await mobiles.SendMessage(message, configuration);

                }
            }


            #endregion
        }

        // Process members that are not marked as removed
        var membersToProcess = members.Where(x => !x.IsRemoved).ToList();
        var token = httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();

        foreach (var item in from item in membersToProcess let file = (Guid?)null select item)
        {
            // Handle new member
            if (item.Id == 0)
            {
                var path = meeting.Number + "{{Folder}}اعضا";
                if (item.Profile != null)
                {
                    item.ProfileGuid = item.Profile.UploadFileAsync(systemGuid, path, token, configuration).Result.Data;
                }

                if (item.Signature != null)
                {
                    item.SignatureGuid = item.Signature.UploadFileAsync(systemGuid, path, token, configuration).Result
                        .Data;
                }

                int? boardMemberId = null;
                if (item.BoardMemberGuid != null)
                    boardMemberId = await boardMemberRepository.GetIdByAsync(item.BoardMemberGuid.Value);
                meeting.MeetingMembers.Add(new MeetingMember(creator, item, meeting.Id, boardMemberId));
            }
            else
            {
                // Handle existing member
                var member = meeting.MeetingMembers.FirstOrDefault(c => c.Id == item.Id);
                if (member == null) continue;
                var path = meeting.Number + "{{Folder}}اعضا";
                if (item.Profile != null)
                {
                    item.ProfileGuid = item.Profile.UploadFileAsync(systemGuid, path, token, configuration).Result.Data;
                }

                if (item.Signature != null)
                {
                    item.SignatureGuid = item.Signature.UploadFileAsync(systemGuid, path, token, configuration).Result
                        .Data;
                }

                item.ReplacementUserGuid = member.ReplacementUserGuid;
                member.Edit(item);
            }
        }
    }

}