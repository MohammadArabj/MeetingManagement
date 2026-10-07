namespace MeetingManagement.Domain.LabelAgg.Service;

public interface ILabelService
{
    Task ThrowWhenDuplicated(string title, int? id = null);
    Task<bool> HasHistoryAsync(int id);

}