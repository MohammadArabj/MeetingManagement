namespace MeetingManagement.Common.Extensions;

public static class Pagination
{
    public static IEnumerable<TSource> ToPaged<TSource>(this IEnumerable<TSource> sources, int start, int length, out int recordsTotal)
    {
        recordsTotal = sources.ToList().Count();
        return sources.Skip(start).Take(length);
    }
}