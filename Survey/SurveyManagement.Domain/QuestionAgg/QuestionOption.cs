using Epc.Domain;

namespace SurveyManagement.Domain.QuestionAgg;

/// <summary>
/// گزینه‌های سوال (برای سوالات چند گزینه‌ای، دراپ‌داون و...)
/// </summary>
public class QuestionOption : EntityBase<long>
{
    public QuestionOption() { }

    public QuestionOption(
        Guid creator,
        long questionId,
        string optionText,
        int sortOrder,
        string? value,
        Guid? image,
        string? color)
        : base(creator)
    {
        Guid = Guid.NewGuid();
        QuestionId = questionId;
        OptionText = optionText;
        SortOrder = sortOrder;
        Value = value;
        Color=color;
        ImageFile = image;
    }

    public Guid Guid { get; private set; }
    public long QuestionId { get; private set; }
    
    /// <summary>
    /// متن گزینه
    /// </summary>
    public string OptionText { get; private set; }
    
    /// <summary>
    /// ترتیب نمایش
    /// </summary>
    public int SortOrder { get; private set; }
    
    /// <summary>
    /// مقدار عددی گزینه (برای محاسبات)
    /// </summary>
    public string? Value { get; private set; }
    
    /// <summary>
    /// تصویر گزینه
    /// </summary>
    public Guid? ImageFile { get; private set; }
    
    /// <summary>
    /// رنگ گزینه (برای نمایش بهتر)
    /// </summary>
    public string? Color { get; private set; }
    
    public Question Question { get; set; }
    
    public void Edit(string optionText, int sortOrder, string? value, Guid? image,string? color)
    {
        OptionText = optionText;
        SortOrder = sortOrder;
        Value = value;
        ImageFile = image;
        Color=color;
    }
    
    public void SetColor(string? color)
    {
        Color = color;
    }
}
