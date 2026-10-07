using Epc.EntityFramework;
using MeetingManagement.Domain.BoardMemberAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class BoardMemberRepository(DbContext commandContext)
    : BaseRepository<int, BoardMember>(commandContext), IBoardMemberRepository;