using Epc.EntityFramework;
using MeetingManagement.Domain.CategoryAgg;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class CategoryRepository(DbContext commandContext)
    : BaseRepository<int, Category>(commandContext), ICategoryRepository;