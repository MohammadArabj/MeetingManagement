using Epc.Domain;
using SurveyManagement.Common;
using SurveyManagement.Domain.SurveyAgg;

namespace SurveyManagement.Domain.ResponseAgg;

public class Response
{
    public Response() { } // EF Core

    public Response(
        long surveyId,
        int? age,
        string? gender,
        string? office,
        string? employmentType,
        string? education,
        string? shiftWorker,
        int? experienceYears,
        string? organizationalGrade,
        string? organizationalGroup)
    {
        Guid = Guid.NewGuid();
        SurveyId = surveyId;
        Status = ResponseStatus.Completed;
        StartedAt = DateTime.Now;

        Age = age;
        Gender = gender;
        Office = office;
        EmploymentType = employmentType;
        Education = education;
        ShiftWorker = shiftWorker;
        ExperienceYears = experienceYears;
        OrganizationalGrade = organizationalGrade;
        OrganizationalGroup = organizationalGroup;
    }

    public long Id { get; set; }
    public Guid Guid { get; private set; }
    public ResponseStatus Status { get; private set; }
    public DateTime StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public int? TimeSpentSeconds { get; private set; }

    // ===== دموگرافیک — مقادیر مستقیم از vwPersonelInfo، بدون bucketing =====
    public int? Age { get; private set; }
    public string? Gender { get; private set; }
    public string? Office { get; private set; }
    public string? EmploymentType { get; private set; }
    public string? Education { get; private set; }
    public string? ShiftWorker { get; private set; }
    public int? ExperienceYears { get; private set; }
    public string? OrganizationalGrade { get; private set; }
    public string? OrganizationalGroup { get; private set; }

    public long SurveyId { get; private set; }
    public Survey Survey { get; set; }
    public ICollection<ResponseAnswer> Answers { get; set; } = new List<ResponseAnswer>();

    public void Complete()
    {
        CompletedAt = DateTime.Now;
        TimeSpentSeconds = (int)(CompletedAt.Value - StartedAt).TotalSeconds;
    }

    // ───────────────────────── پیش‌نویس (ادامه‌ی پاسخ‌دهی بعداً) ─────────────────────────
    //  بدون تغییر اسکیما: پاسخ نیمه‌کاره یک Response با وضعیت InProgress است که Guid آن از
    //  HMAC(کلید سرور، نظرسنجی، کاربر) ساخته می‌شود؛ سرور می‌تواند آن را دوباره پیدا کند ولی کسی که فقط
    //  به دیتابیس دسترسی دارد نمی‌تواند پاسخ را به شخص نسبت دهد. با تکمیل، Guid تصادفی می‌شود و پیوند
    //  قطع می‌شود (همان طراحی ناشناس‌بودن: کاربر فقط در SurveyParticipant ثبت می‌شود).

    /// <summary>شروع پیش‌نویس برای کاربر (draftKey از IResponseDraftKeys)</summary>
    public static Response StartDraft(long surveyId, Guid draftKey) => new()
    {
        Guid = draftKey,
        SurveyId = surveyId,
        Status = ResponseStatus.InProgress,
        StartedAt = DateTime.Now
    };

    public bool IsDraft => Status == ResponseStatus.InProgress;

    /// <summary>جایگزینی پاسخ یک سوال (هر سوال فقط یک پاسخ در هر Response)</summary>
    public void UpsertAnswer(ResponseAnswer answer)
    {
        foreach (var existing in Answers.Where(a => a.QuestionId == answer.QuestionId).ToList())
            Answers.Remove(existing);
        Answers.Add(answer);
    }

    public void RemoveAnswer(long questionId)
    {
        foreach (var existing in Answers.Where(a => a.QuestionId == questionId).ToList())
            Answers.Remove(existing);
    }

    /// <summary>
    /// تکمیل پیش‌نویس یا پاسخ جدید: ثبت اطلاعات جمعیت‌شناختی، وضعیت «تکمیل»، و Guid تصادفی
    /// (تا پاسخ تکمیل‌شده دیگر از روی کاربر قابل محاسبه نباشد).
    /// </summary>
    public void CompleteWith(
        int? age, string? gender, string? office, string? employmentType, string? education,
        string? shiftWorker, int? experienceYears, string? organizationalGrade, string? organizationalGroup)
    {
        Age = age;
        Gender = gender;
        Office = office;
        EmploymentType = employmentType;
        Education = education;
        ShiftWorker = shiftWorker;
        ExperienceYears = experienceYears;
        OrganizationalGrade = organizationalGrade;
        OrganizationalGroup = organizationalGroup;
        Status = ResponseStatus.Completed;
        Guid = Guid.NewGuid();
        Complete();
    }

    /// <summary>پیش‌نویسی که مهلت نظرسنجی آن تمام شده</summary>
    public void Expire() => Status = ResponseStatus.Expired;
}
