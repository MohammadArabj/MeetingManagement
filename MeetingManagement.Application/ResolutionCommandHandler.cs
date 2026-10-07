using Epc.Application.Command;
using Epc.Company.Query;
using MeetingManagement.Application.Contracts.Resolution;
using MeetingManagement.Common.Extensions;
using MeetingManagement.Domain.ActionAgg;
using MeetingManagement.Domain.AssignmentAgg;
using MeetingManagement.Domain.FileAgg;
using MeetingManagement.Domain.ResolutionAgg;
using MeetingManagement.Domain.SettingAgg;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Domain.Shared.Notifications;
using Microsoft.Extensions.Logging;
using Action = MeetingManagement.Domain.ActionAgg.Action;
using File = MeetingManagement.Domain.FileAgg.File;

namespace MeetingManagement.Application;

/// <summary>
/// ثبت/ویرایش/حذف/مرتب‌سازی مصوبات.
/// ─────────────────────────────────────────────────────────────────────────
/// تغییرات نسبت به نسخه قبل:
///   • کنترل دسترسی سمت سرور (قبلاً هر کاربر احراز‌هویت‌شده می‌توانست مصوبه هر جلسه‌ای را تغییر دهد)
///   • همه‌ی تغییرات در یک تراکنش (مصوبه + تخصیص‌ها + فایل‌ها)
///   • حذف امن تخصیص (اگر اقدام/ارجاع دارد خطای قابل فهم به‌جای 500)
///   • تخصیص جدید در حالت ویرایش با وضعیت «در انتظار اقدام» (قبلاً به اشتباه «پایان یافته» ثبت می‌شد)
///   • ویرایش شرح مصوبه هیئت مدیره در ستون Text (قبلاً تغییرات گم می‌شد)
///   • شماره‌گذاری/ترتیب مقاوم در برابر شماره غیرعددی و سرریز
///   • انتشار رویداد «تخصیص مصوبه» برای اقدام‌کنندگان جدید
/// </summary>
public class ResolutionCommandHandler(
    IResolutionRepository resolutionRepository,
    IFileRepository fileRepository,
    IActionRepository actionRepository,
    IMeetingAccessService accessService,
    INotificationPublisher notificationPublisher,
    ICurrentUser currentUser,
    ILogger<ResolutionCommandHandler> logger
) : ICommandHandlerAsync<CreateResolutionDto, Result<long>>,
    ICommandHandlerAsync<CreateResolutionBoardMeetingDto, Result<long>>,
    ICommandHandlerAsync<DeleteResolutionDto, Result<bool>>,
    ICommandHandlerAsync<UpdateResolutionOrderRequest, Result<bool>>
{
    // ═══════════════════════════════════════════════════════════
    // مصوبه جلسه عادی
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<long>> Handle(CreateResolutionDto command)
    {
        var access = await accessService.GetAsync(command.MeetingGuid);
        var denied = CheckEditAccess(access);
        if (denied is not null) return Result<long>.Failure(0, denied);

        if (string.IsNullOrWhiteSpace(command.Description))
            return Result<long>.Failure(0, "متن مصوبه الزامی است.");

        var validation = ValidateRegularAssignments(command.Assignments, isEdit: command.Id.HasValue);
        if (validation is not null) return Result<long>.Failure(0, validation);

        var userGuid = currentUser.UserGuid;
        var newActors = new List<(Guid user, Guid? position, string? due)>();

        try
        {
            var id = await resolutionRepository.InTransactionAsync(async () =>
            {
                Resolution resolution;

                if (command.Id.HasValue)
                {
                    resolution = await resolutionRepository.LoadForEditAsync(command.Id.Value)
                                 ?? throw new InvalidOperationException("مصوبه مورد نظر یافت نشد.");

                    if (resolution.MeetingId != access.MeetingId)
                        throw new InvalidOperationException("مصوبه متعلق به این جلسه نیست.");

                    resolution.Edit(command.Description!.Trim(), access.MeetingId);
                    ApplyRegularAssignments(resolution, command.Assignments, newActors);
                    resolutionRepository.Update(resolution);
                }
                else
                {
                    var (sortOrders, _) = await resolutionRepository.GetOrderingAsync(access.MeetingId);
                    resolution = new Resolution(userGuid, command.Description!.Trim(), access.MeetingId,
                        Resolution.NextSortOrder(sortOrders));

                    foreach (var item in command.Assignments)
                    foreach (var actor in item.Actors.Where(a => !a.IsRemoved))
                    {
                        resolution.AssignedMembers.Add(NewRegularAssignment(actor, item, resolution.Id, userGuid));
                        newActors.Add((actor.UserGuid, actor.PositionGuid, item.DueDate));
                    }

                    await resolutionRepository.CreateAsync(resolution);
                }

                await resolutionRepository.SaveChangesAsync();
                await ProcessResolutionFilesAsync(command.Files, resolution.Id, userGuid);
                await PublishAssignedAsync(access, resolution.Id, newActors);
                return resolution.Id;
            });

            return Result<long>.Success(id);
        }
        catch (InvalidOperationException ex)
        {
            return Result<long>.Failure(0, ex.Message);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // مصوبه هیئت مدیره
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<long>> Handle(CreateResolutionBoardMeetingDto command)
    {
        var access = await accessService.GetAsync(command.MeetingGuid);
        var denied = CheckEditAccess(access);
        if (denied is not null) return Result<long>.Failure(0, denied);

        if (string.IsNullOrWhiteSpace(command.Title))
            return Result<long>.Failure(0, "عنوان مصوبه الزامی است.");

        // ارجاع به جلسه‌ی دیگر فقط اگر کاربر اجازه‌ی دیدن مصوبات آن را داشته باشد
        long? parentMeetingId, committeeMeetingId;
        try
        {
            parentMeetingId = command.ParentMeetingGuid is { } pg ? await ReferencedMeetingIdAsync(pg) : null;
            committeeMeetingId = command.CommitteeMeetingGuid is { } cg ? await ReferencedMeetingIdAsync(cg) : null;
        }
        catch (InvalidOperationException ex)
        {
            return Result<long>.Failure(0, ex.Message);
        }
        if (parentMeetingId == 0) parentMeetingId = null;
        if (committeeMeetingId == 0) committeeMeetingId = null;

        var userGuid = currentUser.UserGuid;
        var newActors = new List<(Guid user, Guid? position, string? due)>();

        try
        {
            var id = await resolutionRepository.InTransactionAsync(async () =>
            {
                Resolution resolution;

                if (command.Id.HasValue)
                {
                    resolution = await resolutionRepository.LoadForEditAsync(command.Id.Value)
                                 ?? throw new InvalidOperationException("مصوبه مورد نظر یافت نشد.");

                    if (resolution.MeetingId != access.MeetingId)
                        throw new InvalidOperationException("مصوبه متعلق به این جلسه نیست.");

                    resolution.EditBoardResolution(command.Title.Trim(), command.Description, command.DecisionsMade,
                        command.Documentation, command.ContractNumber, command.ApprovedPrice, parentMeetingId,
                        command.ParentResolutionId, committeeMeetingId, command.CommitteeResolutionId);

                    if (!string.IsNullOrWhiteSpace(command.Number) && command.Number != resolution.Number)
                    {
                        var (_, numbers) = await resolutionRepository.GetOrderingAsync(resolution.MeetingId, resolution.Id);
                        if (IsDuplicateNumber(command.Number, numbers))
                            throw new InvalidOperationException("شماره وارد شده تکراری است.");
                        resolution.Number = command.Number.Trim();
                    }

                    ApplyBoardItems(resolution, command.Items, userGuid, newActors);
                    resolutionRepository.Update(resolution);
                }
                else
                {
                    var (sortOrders, numbers) = await resolutionRepository.GetOrderingAsync(access.MeetingId);
                    var number = !string.IsNullOrWhiteSpace(command.Number) ? command.Number.Trim() : Resolution.NextBoardNumber(numbers);
                    if (IsDuplicateNumber(number, numbers))
                        throw new InvalidOperationException("شماره وارد شده تکراری است.");

                    resolution = new Resolution(userGuid, command.Title.Trim(), number, Resolution.NextSortOrder(sortOrders),
                        access.MeetingId, command.Description, command.DecisionsMade, command.Documentation,
                        command.ContractNumber, command.ApprovedPrice, parentMeetingId, command.ParentResolutionId,
                        committeeMeetingId, command.CommitteeResolutionId);

                    foreach (var item in command.Items.Where(i => !i.IsRemoved))
                    foreach (var actor in item.Actors.Where(a => !a.IsRemoved))
                    {
                        resolution.AssignedMembers.Add(NewBoardAssignment(actor, item, resolution.Id, userGuid));
                        newActors.Add((actor.UserGuid, actor.PositionGuid, item.DueDate));
                    }

                    await resolutionRepository.CreateAsync(resolution);
                }

                await resolutionRepository.SaveChangesAsync();
                await ProcessResolutionFilesAsync(command.Files, resolution.Id, userGuid);
                await PublishAssignedAsync(access, resolution.Id, newActors);
                return resolution.Id;
            });

            return Result<long>.Success(id);
        }
        catch (InvalidOperationException ex)
        {
            return Result<long>.Failure(0, ex.Message);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // حذف و ترتیب
    // ═══════════════════════════════════════════════════════════
    public async Task<Result<bool>> Handle(DeleteResolutionDto command)
    {
        var resolution = await resolutionRepository.LoadForEditAsync(command.Id);
        if (resolution == null)
            return Result<bool>.Failure(false, "مصوبه مورد نظر یافت نشد.");

        var access = await accessService.GetAsync(resolution.MeetingId);
        if (!access.Can(MeetingCapability.DeleteResolutions))
            return Result<bool>.Failure(false, MeetingAccess.DeniedMessage(MeetingCapability.DeleteResolutions));
        if (!access.IsSuperAdmin && !access.IsContentEditable)
            return Result<bool>.Failure(false, MeetingAccess.LockedMessage);

        if (resolution.AssignedMembers.Any())
            return Result<bool>.Failure(false, "به دلیل وجود تخصیص، امکان حذف وجود ندارد. ابتدا تخصیص‌ها را حذف کنید.");

        resolutionRepository.Delete(resolution);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(UpdateResolutionOrderRequest command)
    {
        if (command.Resolutions.Count == 0) return Result<bool>.Success(true);

        var ids = command.Resolutions.Select(r => r.Id).ToList();
        var resolutions = (await resolutionRepository.FilterAsync(c => ids.Contains(c.Id))).ToList();
        var meetingIds = resolutions.Select(r => r.MeetingId).Distinct().ToList();
        if (meetingIds.Count != 1)
            return Result<bool>.Failure(false, "مصوبات انتخاب‌شده متعلق به یک جلسه نیستند.");

        var access = await accessService.GetAsync(meetingIds[0]);
        var denied = CheckEditAccess(access);
        if (denied is not null) return Result<bool>.Failure(false, denied);

        foreach (var res in resolutions)
        {
            var newOrder = command.Resolutions.FirstOrDefault(r => r.Id == res.Id)?.SortOrder;
            if (newOrder.HasValue) res.SortOrder = newOrder.Value;
        }

        await resolutionRepository.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    // ═══════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════
    private async Task<long?> ReferencedMeetingIdAsync(Guid meetingGuid)
    {
        var referenced = await accessService.GetAsync(meetingGuid);
        if (!referenced.Exists) return null;
        if (!referenced.Can(MeetingCapability.ViewResolutions))
            throw new InvalidOperationException("شما به جلسه‌ی ارجاع‌شده دسترسی ندارید.");
        return referenced.MeetingId;
    }

    private static string? CheckEditAccess(MeetingAccess access)
    {
        if (!access.Exists) return "جلسه مورد نظر یافت نشد.";
        if (!access.Can(MeetingCapability.ManageResolutions)) return MeetingAccess.DeniedMessage(MeetingCapability.ManageResolutions);
        if (!access.IsSuperAdmin && !access.IsContentEditable) return MeetingAccess.LockedMessage;
        return null;
    }

    private static string? ValidateRegularAssignments(List<AssignmentItem> items, bool isEdit)
    {
        var active = items.Where(i => i.Actors.Any(a => !a.IsRemoved)).ToList();
        if (!isEdit && active.Count == 0)
            return "حداقل یک تخصیص برای مصوبه الزامی است.";

        foreach (var item in active)
        {
            if (item.Follower is null || item.Follower.UserGuid == Guid.Empty)
                return "پیگیری‌کننده هر تخصیص الزامی است.";
            if (string.IsNullOrWhiteSpace(item.DueDate))
                return "مهلت انجام هر تخصیص الزامی است.";
            if (item.Actors.Any(a => !a.IsRemoved && a.UserGuid == Guid.Empty))
                return "اقدام‌کننده نامعتبر است.";
        }
        return null;
    }

    private static void ApplyRegularAssignments(Resolution resolution, List<AssignmentItem> items,
        List<(Guid user, Guid? position, string? due)> newActors)
    {
        foreach (var item in items)
        foreach (var actor in item.Actors)
        {
            if (actor.IsRemoved)
            {
                if (actor.Id > 0 && !resolution.TryRemoveAssignment(actor.Id, out var reason))
                    throw new InvalidOperationException(reason);
                continue;
            }

            if (actor.Id == 0)
            {
                resolution.AssignedMembers.Add(NewRegularAssignment(actor, item, resolution.Id, null));
                newActors.Add((actor.UserGuid, actor.PositionGuid, item.DueDate));
                continue;
            }

            var current = resolution.AssignedMembers.FirstOrDefault(c => c.Id == actor.Id);
            if (current is null) continue; // تخصیص متعلق به مصوبه دیگری است → نادیده

            current.Edit(actor.UserGuid, item.Follower?.UserGuid, actor.PositionGuid, item.Follower?.PositionGuid,
                item.Type, item.DueDate ?? string.Empty, resolution.Id);
        }
    }

    private static Assignment NewRegularAssignment(ActorItem actor, AssignmentItem item, long resolutionId, Guid? creator) =>
        new(actor.UserGuid, item.Follower?.UserGuid, actor.PositionGuid, item.Follower?.PositionGuid,
            item.Type, item.DueDate ?? string.Empty, resolutionId, ActionStatus.Pending, creator: creator);

    private static Assignment NewBoardAssignment(ActorItem actor, BoardMeetingResolutionItemDto item, long resolutionId, Guid creator)
    {
        var followerGuid = item.FollowerGuid ?? (SettingValues.BoardSecretaryUserGuid == Guid.Empty ? null : SettingValues.BoardSecretaryUserGuid);
        var followerPosition = item.FollowerPositionGuid ?? (SettingValues.BoardPositionGuid == Guid.Empty ? null : SettingValues.BoardPositionGuid);

        var assignment = new Assignment(actor.UserGuid, followerGuid, actor.PositionGuid, followerPosition,
            AssignmentType.Action, item.DueDate ?? string.Empty, resolutionId, item.Status ?? ActionStatus.Pending, creator: creator);

        if (item.Status == ActionStatus.End && item.Result.HasValue)
            assignment.Result = item.Result.Value;

        if (!string.IsNullOrWhiteSpace(item.Description))
            assignment.Actions.Add(new Action(creator, 0, item.Description, item.DueDate ?? Assignment.ToShamsi(DateTime.Now),
                actor.UserGuid, ActionType.Action));

        return assignment;
    }

    private void ApplyBoardItems(Resolution resolution, List<BoardMeetingResolutionItemDto> items, Guid userGuid,
        List<(Guid user, Guid? position, string? due)> newActors)
    {
        foreach (var item in items)
        {
            foreach (var actor in item.Actors)
            {
                var removed = actor.IsRemoved || item.IsRemoved;

                if (removed)
                {
                    if (actor.Id > 0) RemoveBoardAssignment(resolution, actor.Id);
                    continue;
                }

                if (actor.Id == 0)
                {
                    resolution.AssignedMembers.Add(NewBoardAssignment(actor, item, resolution.Id, userGuid));
                    newActors.Add((actor.UserGuid, actor.PositionGuid, item.DueDate));
                    continue;
                }

                var current = resolution.AssignedMembers.FirstOrDefault(c => c.Id == actor.Id);
                if (current is null) continue;

                current.ActionStatus = item.Status ?? ActionStatus.Pending;
                if (item.Status == ActionStatus.End && item.Result.HasValue)
                    current.Result = item.Result.Value;

                if (!string.IsNullOrWhiteSpace(item.Description))
                {
                    // شرح وضعیت در هیئت مدیره یک «اقدام» خلاصه است؛ فقط اقدام ثبت‌شده توسط فرم را جایگزین می‌کنیم
                    var formAction = current.Actions.FirstOrDefault(a => a.Type == ActionType.Action && a.UserGuid == actor.UserGuid);
                    if (formAction is not null)
                        formAction.Edit(item.DueDate ?? Assignment.ToShamsi(DateTime.Now), item.Description);
                    else
                        current.Actions.Add(new Action(userGuid, current.Id, item.Description,
                            item.DueDate ?? Assignment.ToShamsi(DateTime.Now), actor.UserGuid, ActionType.Action));
                }
            }
        }
    }

    /// <summary>
    /// در هیئت مدیره «اقدام» تخصیص فقط شرح وضعیتی است که دبیر در همین فرم وارد کرده؛
    /// بنابراین حذف تخصیص همراه با حذف این اقدام‌ها مجاز است (مگر ارجاع داشته باشد).
    /// </summary>
    private void RemoveBoardAssignment(Resolution resolution, int assignmentId)
    {
        var assignment = resolution.AssignedMembers.FirstOrDefault(a => a.Id == assignmentId);
        if (assignment is null) return;

        if (assignment.ReferredAssignments.Count > 0)
            throw new InvalidOperationException("این تخصیص ارجاع داده شده است و قابل حذف نیست.");

        foreach (var action in assignment.Actions.ToList())
            actionRepository.Delete(action);

        resolution.AssignedMembers.Remove(assignment);
    }

    private static bool IsDuplicateNumber(string number, IEnumerable<string?> existing)
    {
        if (int.TryParse(number, out var n))
            return existing.Any(x => int.TryParse(x, out var v) && v == n);
        return existing.Any(x => string.Equals(x?.Trim(), number.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    private async Task ProcessResolutionFilesAsync(List<FileDto>? files, long resolutionId, Guid userGuid)
    {
        if (files == null || files.Count == 0) return;

        var active = files.Count(f => !f.IsRemoved);
        if (SettingValues.MaxResolutionAttachments > 0 && active > SettingValues.MaxResolutionAttachments)
            throw new InvalidOperationException($"حداکثر {SettingValues.MaxResolutionAttachments} فایل برای هر مصوبه مجاز است.");

        foreach (var fileDto in files)
        {
            if (fileDto.IsRemoved)
            {
                if (fileDto.Id <= 0) continue;
                var existing = await fileRepository.LoadAsync(fileDto.Id);
                // ✅ فقط فایل متعلق به همین مصوبه قابل حذف است
                if (existing != null && existing.ModuleId == resolutionId && existing.Type == FileType.Resolution)
                    fileRepository.Delete(existing);
            }
            else if (fileDto.Id == 0 && fileDto.FileGuid != Guid.Empty)
            {
                await fileRepository.CreateAsync(new File(userGuid, resolutionId, fileDto.FileGuid, FileType.Resolution));
            }
        }

        await fileRepository.SaveChangesAsync();
    }

    private async Task PublishAssignedAsync(MeetingAccess access, long resolutionId,
        List<(Guid user, Guid? position, string? due)> actors)
    {
        // پیش از ابلاغ (امضای رئیس / اتمام جلسه هیئت مدیره) پیامی ارسال نمی‌شود؛ هنگام ابلاغ برای همه ارسال می‌شود
        if (actors.Count == 0 || !access.IsPublished) return;
        try
        {
            foreach (var group in actors.GroupBy(a => a.due))
            {
                await notificationPublisher.PublishAsync(NotificationEventCode.ResolutionAssigned, new NotificationPayload
                {
                    MeetingId = access.MeetingId,
                    ResolutionId = resolutionId,
                    ActorUserGuid = currentUser.UserGuid,
                    Targets = group.Select(a => new NotificationTarget(NotificationRecipient.Actor, a.user, a.position)).ToList(),
                    Values = { ["DueDate"] = group.Key },
                });
            }
        }
        catch (Exception ex)
        {
            // اطلاع‌رسانی هرگز نباید ثبت مصوبه را خراب کند
            logger.LogError(ex, "Publishing ResolutionAssigned failed for resolution {ResolutionId}", resolutionId);
        }
    }
}
