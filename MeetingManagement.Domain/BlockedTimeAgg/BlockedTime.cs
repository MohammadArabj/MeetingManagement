// MeetingManagement.Domain/BlockedTimeAgg/BlockedTime.cs
using Epc.Domain;

namespace MeetingManagement.Domain.BlockedTimeAgg;

public class BlockedTime : AuditableAggregateRootBase<long>
{
    public BlockedTime() { }

    public BlockedTime(
        Guid creator,
        Guid userGuid,
        DateTime date,
        TimeSpan startTime,
        TimeSpan endTime,
        string? description) : base(creator)
    {
        if (startTime >= endTime)
            throw new InvalidOperationException("ساعت شروع باید قبل از ساعت پایان باشد");

        UserGuid = userGuid;
        Date = date.Date;
        StartTime = startTime;
        EndTime = endTime;
        Description = description?.Trim();
    }

    public void Edit(
        Guid actor,
        DateTime date,
        TimeSpan startTime,
        TimeSpan endTime,
        string? description)
    {
        if (startTime >= endTime)
            throw new InvalidOperationException("ساعت شروع باید قبل از ساعت پایان باشد");

        Date = date.Date;
        StartTime = startTime;
        EndTime = endTime;
        Description = description?.Trim();
        Modified(actor);
    }

    public Guid UserGuid { get; private set; }
    public DateTime Date { get; private set; }
    public TimeSpan StartTime { get; private set; }
    public TimeSpan EndTime { get; private set; }
    public string? Description { get; private set; }

    /// <summary>
    /// بررسی تداخل زمانی
    /// </summary>
    public bool HasConflictWith(TimeSpan otherStart, TimeSpan otherEnd)
    {
        return otherStart < EndTime && otherEnd > StartTime;
    }
}