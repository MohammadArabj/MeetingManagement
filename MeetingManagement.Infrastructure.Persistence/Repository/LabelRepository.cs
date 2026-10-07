using Epc.EntityFramework;
using MeetingManagement.Domain.LabelAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class LabelRepository(DbContext commandContext) : BaseRepository<int, Label>(commandContext), ILabelRepository;