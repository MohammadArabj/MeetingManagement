using Epc.Application.Command;
using Epc.Company.Query;
using Epc.Identity;
using MeetingManagement.Application.Contracts.Meeting;
using MeetingManagement.Application.Contracts.Member;
using MeetingManagement.Domain.MeetingAgg;
using MeetingManagement.Domain.RoleAgg;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;

namespace MeetingManagement.Application;

public class MemberCommandHandler(
    IMeetingMemberRepository repository,
    IMeetingRepository meetingRepository,
    IRoleRepository roleRepository,
    IClaimHelper claimHelper
) : ICommandHandlerAsync<MeetingMemberDto,Result<long>>, 
    ICommandHandlerAsync<DeleteMeetingMember, Result<bool>>,
    ICommandHandlerAsync<MeetingMemberCommentDto,Result<bool>>,
    ICommandHandlerAsync<CreateMemberDto,Result<bool>>,
    ICommandHandlerAsync<SetSubstituteDto,Result<bool>>,
    ICommandHandlerAsync<AttendanceMemberDto,Result<bool>>,
    ICommandHandlerAsync<AttendanceGroupDto,Result<bool>>
{
    public async Task<Result<long>> Handle(MeetingMemberDto command)
    {
        var meetingId = await meetingRepository.GetIdByAsync(command.MeetingGuid);
        if (command.Id.HasValue)
        {
            var meetingMember = await repository.LoadAsync(command.Id.Value);
            if (meetingMember == null)
                return Result<long>.Failure(0, "عضو مورد نظر یافت نشد.");

            meetingMember.Edit(command);
            repository.Update(meetingMember);
            return Result<long>.Success(meetingMember.Id);
        }
        else
        {
            var currentUserId = claimHelper.GetCurrentUserGuid();
            var meetingMember = new MeetingMember(currentUserId, command, meetingId);
            await repository.CreateAsync(meetingMember);
            return Result<long>.Success(meetingMember.Id);
        }
    }

    public async Task<Result<bool>> Handle(DeleteMeetingMember command)
    {
        var meetingMember = await repository.LoadAsync(command.Id);
        if (meetingMember == null)
            return Result<bool>.Failure(false, "عضو مورد نظر یافت نشد.");

        repository.Delete(meetingMember);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(MeetingMemberCommentDto command)
    {
        var meetingMember = await repository.LoadAsync(command.MemberId);
        if (meetingMember == null)
            return Result<bool>.Failure(false, "عضو مورد نظر یافت نشد.");
        meetingMember.SetComment(command);
        repository.Update(meetingMember);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(CreateMemberDto command)
    {
        var currentUserId = claimHelper.GetCurrentUserGuid();

        var meetingId = await meetingRepository.GetIdByAsync(command.MeetingGuid);
        var meeting = await meetingRepository.LoadAsync(command.MeetingGuid, "MeetingMembers");
        if (command.MemberId.HasValue)
        {
            var meetingMember = meeting.MeetingMembers.FirstOrDefault(c=>c.Id==command.MemberId);
            if (meetingMember == null)
                return Result<bool>.Failure(false, "عضو مورد نظر یافت نشد.");

            meetingMember.SetReplacement(command.UserGuid.Value);

            repository.Update(meetingMember);
            var newMember = new MeetingMember(currentUserId, new MeetingMemberDto()
            {
                UserGuid = command.UserGuid,
                IsExternal = false,
                RoleId = meetingMember.RoleId??0,
                MeetingGuid = command.MeetingGuid,
            },meetingId);
            await repository.CreateAsync(newMember);
            return Result<bool>.Success(true);
        }
        else
        {
            var meetingMember = new MeetingMember(currentUserId, new MeetingMemberDto()
            {
                UserGuid = command.UserGuid,
                RoleId = await roleRepository.GetIdByAsync(command.RoleGuid.Value),
                IsExternal = false,
                MeetingGuid = command.MeetingGuid,
            }, meetingId);
            await repository.CreateAsync(meetingMember);
            return Result<bool>.Success(true);
        }
    }

    public async Task<Result<bool>> Handle(SetSubstituteDto command)
    {
        var userGuid = command.UserGuid;
        var member = await repository.LoadAsync(command.Id??0,"Meeting");
        if(member == null) return Result<bool>.Failure(false,"عضو مورد نظر یافت نشد");
        member.SetAttendance(command.IsAttendance);
        repository.Update(member);
        if (command.IsAttendance)
        {
            var meeting = await meetingRepository.LoadAsync(member.MeetingId ?? 0, "MeetingMembers");
            var meetingMember = meeting.MeetingMembers.FirstOrDefault(c => c.ReplacementUserGuid == userGuid);
            if (meetingMember != null)
            {
                if (meetingMember.MainRoleId != null)
                {
                    meetingMember.SetMainRole();
                    repository.Update(meetingMember);
                }
                else 
                    repository.Delete(meetingMember);
            }
          
        }
        else
        {
            var meeting =await meetingRepository.LoadAsync(member.MeetingId??0);
            if (!meeting.NotAllowReplacement.Value&&command.ReplacementUserGuid!=null)
            {
                var meetingMembers = meeting.MeetingMembers;
                var exist = ( meetingMembers.Where(c => c.UserGuid == member.ReplacementUserGuid && c.MeetingId == member.MeetingId)).FirstOrDefault();
                if (exist != null)
                {
                    exist.SetReplacement(null);
                    exist.SetMainRole();
                    repository.Update(exist);
                }

                var newMember = (await repository.FilterAsync(c => c.UserGuid == command.ReplacementUserGuid && c.MeetingId == member.MeetingId)).FirstOrDefault();

                if (newMember == null)
                {
                    newMember = new MeetingMember(userGuid.Value, new MeetingMemberDto()
                    {
                        UserGuid = command.ReplacementUserGuid,
                        RoleId = member.RoleId ?? 0,
                        MeetingGuid = member.Meeting.Guid.Value,
                        IsExternal = false,
                        PositionGuid = command.ReplacementPositionGuid,
                        PersNo = command.PersNo
                    }, member.MeetingId ?? 0);
                    await repository.CreateAsync(newMember);
                }
                else
                {
                    newMember.Edit(new MeetingMemberDto()
                    {
                        RoleId = member.RoleId ?? 0,
                        UserGuid = newMember.UserGuid,
                        SignatureGuid = newMember.Signature,
                        ProfileGuid = newMember.Profile,
                        Comment = newMember.Comment,
                        Name = newMember.Name,
                        IsExternal = newMember.IsExternal ??false,
                        MainRoleId = newMember.RoleId,
                        PersNo = newMember.PersNo
                    });
                
                    repository.Update(newMember);
                }
                member.SetReplacement(command.ReplacementUserGuid);
                repository.Update(member);
            }
        }
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(AttendanceMemberDto command)
    {
        var userGuid = claimHelper.GetCurrentUserGuid();
        var member = await repository.LoadAsync(command.Id ?? 0, "Meeting");
        if (member == null) return Result<bool>.Failure(false, "عضو مورد نظر یافت نشد");
        member.SetSubstitute(command.IsPresent);
        repository.Update(member);
        return Result<bool>.Success(true);
    }

    public Task<Result<bool>> Handle(AttendanceGroupDto command)
    {
       var members=repository.FilterAsync(x=>x.Meeting.Guid==command.MeetingGuid);
        if (members == null || !members.Result.Any())
            return Task.FromResult(Result<bool>.Failure(false, "هیچ عضوی یافت نشد"));
        foreach (var member in members.Result)
        {
            member.SetSubstitute(command.IsPresent);
            repository.Update(member);
        }
        return Task.FromResult(Result<bool>.Success(true));
    }
}
