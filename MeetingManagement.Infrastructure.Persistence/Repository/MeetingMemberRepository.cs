using Epc.EntityFramework;
using MeetingManagement.Domain.MeetingAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class MeetingMemberRepository(DbContext commandContext)
    : BaseRepository<long, MeetingMember>(commandContext), IMeetingMemberRepository;