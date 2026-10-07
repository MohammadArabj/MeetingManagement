using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.Room;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Query;
public class RoomQueryHandler(MeetingManagementQueryContext context)
    : IQueryHandlerAsync<Result<List<RoomJsonModel>>>,
      IQueryHandlerAsync<Result<RoomJsonModel>, Guid>,
      IQueryHandlerAsync<Result<List<RoomComboModel>>>
{
    public async Task<Result<List<RoomJsonModel>>> Handle()
    {
        var rooms = await context.Rooms
            .Select(c => new RoomJsonModel
            {
                Guid = c.Guid,
                Id = c.Id,
                Title = c.Title,
                Address = c.Address,
                Capacity = c.Capacity,
                IsActive = c.IsActive,
                Created = c.Created.ToString("yyyy/MM/dd")
            })
            .ToListAsync();

        return Result<List<RoomJsonModel>>.EmptyMessage(rooms);
    }

    public async Task<Result<RoomJsonModel>> Handle(Guid condition)
    {
        var room = await context.Rooms
            .Where(c => c.Guid == condition)
            .Select(c => new RoomJsonModel
            {
                Guid = c.Guid,
                Id = c.Id,
                Title = c.Title,
                Address = c.Address,
                Capacity = c.Capacity,
                IsActive = c.IsActive,
                Created = c.Created.ToString("yyyy/MM/dd")
            })
            .FirstOrDefaultAsync();

        return room == null ? Result<RoomJsonModel>.Failure(null, "اتاق مورد نظر یافت نشد.") : Result<RoomJsonModel>.EmptyMessage(room);
    }

    async Task<Result<List<RoomComboModel>>> IQueryHandlerAsync<Result<List<RoomComboModel>>>.Handle()
    {
        var rooms = await context.Rooms
            .Select(c => new RoomComboModel
            {
                Guid = c.Guid,
                Id = c.Id,
                Title = c.Title,
            })
            .ToListAsync();
        
        return Result<List<RoomComboModel>>.EmptyMessage(rooms);
    }
}
