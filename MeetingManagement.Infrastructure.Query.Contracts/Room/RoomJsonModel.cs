using System;

namespace MeetingManagement.Infrastructure.Query.Contracts.Room;

public class RoomJsonModel
{
    public int Id { get; set; }
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public int Capacity { get; set; }
    public string? Address { get; set; }
    public string Created { get; set; }
    public int IsActive { get; set; }
}