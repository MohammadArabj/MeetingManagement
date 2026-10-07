using Epc.EntityFramework;
using MeetingManagement.Domain.RoleAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class RoleRepository(DbContext commandContext) : BaseRepository<int, Role>(commandContext), IRoleRepository;
