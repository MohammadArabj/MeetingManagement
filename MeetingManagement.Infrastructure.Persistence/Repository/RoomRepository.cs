using Epc.EntityFramework;
using MeetingManagement.Domain.RoomAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class RoomRepository(DbContext commandContext) : BaseRepository<int, Room>(commandContext), IRoomRepository;