using Epc.Core.Exceptions;
using Epc.Domain.Specification;
using SurveyManagement.Domain.SurveyAgg;
using System.Linq.Expressions;

namespace SurveyManagement.Domain.SurveyAgg.Services;

public interface ISurveyService
{
    Task ThrowWhenDuplicated(string title, long? id = null);
    Task<bool> CanUserAccessSurvey(long surveyId, Guid userGuid);
    Task<bool> HasUserAlreadyResponded(long surveyId, Guid userGuid);
}

public class SurveyService : ISurveyService
{
    private readonly ISurveyRepository _repository;
    private Expression<Func<Survey, bool>>? _predicate;

    public SurveyService(ISurveyRepository repository)
    {
        _repository = repository;
    }

    /// <summary>
    /// بررسی تکراری بودن عنوان نظرسنجی
    /// </summary>
    public async Task ThrowWhenDuplicated(string title, long? id = null)
    {
        _predicate = x => x.Title == title;
        
        if (id.HasValue)
            _predicate = _predicate.And(x => x.Id != id.Value);
        
        if (await _repository.ExistsAsync(_predicate))
            throw new DuplicatedDataEnteredException("نظرسنجی با این عنوان قبلاً ثبت شده است.");
    }

    /// <summary>
    /// بررسی دسترسی کاربر به نظرسنجی
    /// این متد در Query Handler پیاده‌سازی می‌شود
    /// </summary>
    public async Task<bool> CanUserAccessSurvey(long surveyId, Guid userGuid)
    {
        // این منطق در Query Handler پیاده‌سازی می‌شود
        // چون نیاز به Join با AccessControl دارد
        await Task.CompletedTask;
        return true;
    }

    /// <summary>
    /// بررسی اینکه آیا کاربر قبلاً پاسخ داده است
    /// این متد در Query Handler پیاده‌سازی می‌شود
    /// </summary>
    public async Task<bool> HasUserAlreadyResponded(long surveyId, Guid userGuid)
    {
        // این منطق در Query Handler پیاده‌سازی می‌شود
        await Task.CompletedTask;
        return false;
    }
}
