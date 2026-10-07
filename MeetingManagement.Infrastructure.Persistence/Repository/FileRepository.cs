using Epc.EntityFramework;
using MeetingManagement.Domain.FileAgg;
using Microsoft.EntityFrameworkCore;
using File = MeetingManagement.Domain.FileAgg.File;

namespace MeetingManagement.Infrastructure.Persistence.Repository;

public class FileRepository(DbContext commandContext) : BaseRepository<long, File>(commandContext), IFileRepository;
