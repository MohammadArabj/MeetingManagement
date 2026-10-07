using Epc.Domain;
using SurveyManagement.Common;

namespace SurveyManagement.Domain.ResponseAgg;

/// <summary>
/// پاسخ به سوال مشخص
/// </summary>
public class ResponseAnswer 
{
    public ResponseAnswer() { }

    public ResponseAnswer(
        long responseId,
        long questionId,
        QuestionType questionType)
    {
        Guid = Guid.NewGuid();
        QuestionId = questionId;
        QuestionType = questionType;
        AnsweredAt = DateTime.Now;
    }
    public long Id { get; set; }
    public Guid Guid { get; private set; }
    
    /// <summary>
    /// شناسه پاسخ کلی
    /// </summary>
    public long ResponseId { get; private set; }
    
    /// <summary>
    /// شناسه سوال
    /// </summary>
    public long QuestionId { get; private set; }
    
    /// <summary>
    /// نوع سوال (برای سرعت بیشتر در query ها)
    /// </summary>
    public QuestionType QuestionType { get; private set; }
    
    /// <summary>
    /// پاسخ متنی
    /// </summary>
    public string? TextAnswer { get; private set; }
    
    /// <summary>
    /// پاسخ عددی
    /// </summary>
    public decimal? NumericAnswer { get; private set; }
    
    /// <summary>
    /// پاسخ تاریخ
    /// </summary>
    public DateTime? DateAnswer { get; private set; }
    
    /// <summary>
    /// شناسه گزینه انتخاب شده (برای تک انتخابی)
    /// </summary>
    public long? SelectedOptionId { get; private set; }
    
    /// <summary>
    /// شناسه‌های گزینه‌های انتخاب شده (برای چند انتخابی) - JSON Array
    /// </summary>
    public string? SelectedOptionIds { get; private set; }
    
    /// <summary>
    /// پاسخ به گزینه "سایر"
    /// </summary>
    public string? OtherAnswer { get; private set; }
    
    /// <summary>
    /// URL فایل آپلود شده
    /// </summary>
    public string? FileUrl { get; private set; }
    
    /// <summary>
    /// نام فایل آپلود شده
    /// </summary>
    public string? FileName { get; private set; }
    
    /// <summary>
    /// حجم فایل آپلود شده (بایت)
    /// </summary>
    public long? FileSize { get; private set; }
    
    /// <summary>
    /// پاسخ‌های ماتریسی - JSON Object
    /// مثال: {"row1": "col2", "row2": "col1"}
    /// </summary>
    public string? MatrixAnswers { get; private set; }
    
    /// <summary>
    /// پاسخ‌های رتبه‌بندی - JSON Array
    /// مثال: [3, 1, 2] که نشان‌دهنده ترتیب گزینه‌هاست
    /// </summary>
    public string? RankingAnswers { get; private set; }
    
    /// <summary>
    /// زمان پاسخ
    /// </summary>
    public DateTime AnsweredAt { get; private set; }
    
    /// <summary>
    /// زمان صرف شده برای پاسخ به این سوال (ثانیه)
    /// </summary>
    public int? TimeSpentSeconds { get; private set; }
    
    /// <summary>
    /// آیا سوال رد شده (Skip شده)؟
    /// </summary>
    public bool IsSkipped { get; private set; }
    
    public Response Response { get; set; }
    public QuestionAgg.Question Question { get; set; }
    
    /// <summary>
    /// تنظیم پاسخ متنی
    /// </summary>
    public void SetTextAnswer(string textAnswer, int? timeSpentSeconds = null)
    {
        TextAnswer = textAnswer;
        TimeSpentSeconds = timeSpentSeconds;
        IsSkipped = false;
    }
    
    /// <summary>
    /// تنظیم پاسخ عددی
    /// </summary>
    public void SetNumericAnswer(decimal numericAnswer, int? timeSpentSeconds = null)
    {
        NumericAnswer = numericAnswer;
        TimeSpentSeconds = timeSpentSeconds;
        IsSkipped = false;
    }
    
    /// <summary>
    /// تنظیم پاسخ تاریخ
    /// </summary>
    public void SetDateAnswer(DateTime dateAnswer, int? timeSpentSeconds = null)
    {
        DateAnswer = dateAnswer;
        TimeSpentSeconds = timeSpentSeconds;
        IsSkipped = false;
    }
    
    /// <summary>
    /// تنظیم گزینه انتخابی (تک انتخابی)
    /// </summary>
    public void SetSelectedOption(long optionId, string? otherAnswer = null, int? timeSpentSeconds = null)
    {
        SelectedOptionId = optionId;
        OtherAnswer = otherAnswer;
        TimeSpentSeconds = timeSpentSeconds;
        IsSkipped = false;
    }
    
    /// <summary>
    /// تنظیم گزینه‌های انتخابی (چند انتخابی)
    /// </summary>
    public void SetSelectedOptions(string selectedOptionIds, string? otherAnswer = null, int? timeSpentSeconds = null)
    {
        SelectedOptionIds = selectedOptionIds;
        OtherAnswer = otherAnswer;
        TimeSpentSeconds = timeSpentSeconds;
        IsSkipped = false;
    }
    
    /// <summary>
    /// تنظیم فایل آپلود شده
    /// </summary>
    public void SetFileAnswer(string fileUrl, string fileName, long fileSize, int? timeSpentSeconds = null)
    {
        FileUrl = fileUrl;
        FileName = fileName;
        FileSize = fileSize;
        TimeSpentSeconds = timeSpentSeconds;
        IsSkipped = false;
    }
    
    /// <summary>
    /// تنظیم پاسخ‌های ماتریسی
    /// </summary>
    public void SetMatrixAnswers(string matrixAnswers, int? timeSpentSeconds = null)
    {
        MatrixAnswers = matrixAnswers;
        TimeSpentSeconds = timeSpentSeconds;
        IsSkipped = false;
    }
    
    /// <summary>
    /// تنظیم پاسخ‌های رتبه‌بندی
    /// </summary>
    public void SetRankingAnswers(string rankingAnswers, int? timeSpentSeconds = null)
    {
        RankingAnswers = rankingAnswers;
        TimeSpentSeconds = timeSpentSeconds;
        IsSkipped = false;
    }
    
    /// <summary>
    /// نشان‌گذاری سوال به عنوان رد شده
    /// </summary>
    public void Skip()
    {
        IsSkipped = true;
    }
}
