// SurveyManagement.Infrastructure.Query.Services/PersianSentimentAnalyzer.cs

using System.Text.RegularExpressions;
using SurveyManagement.Infrastructure.Query.Contract.Response;

namespace SurveyManagement.Infrastructure.Query.Services;

/// <summary>
/// احساس‌سنجی ساده مبتنی بر کلمات کلیدی فارسی.
/// دقیق نیست ولی برای دید کلی روی پاسخ‌های متنی نظرسنجی کاربردی است.
/// </summary>
public static class PersianSentimentAnalyzer
{
    private static readonly HashSet<string> PositiveWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "عالی","خوب","خیلی خوب","راضی","رضایت","عالیه","محشر","فوق‌العاده","دوست دارم",
        "خوشحال","مفید","کاربردی","سریع","آسان","راحت","بهترین","لذت","ممنون","تشکر",
        "پیشنهاد میکنم","توصیه میکنم","کیفیت بالا","حرفه‌ای","مناسب","خوشایند","مثبت",
        "موفق","کامل","زیبا","جالب","سازنده","کارآمد","قابل اعتماد","صمیمی","دلپذیر","خوبه"
    };

    private static readonly HashSet<string> NegativeWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "بد","ضعیف","ناراضی","افتضاح","مشکل","کند","سخت","دشوار","بدترین","متاسفانه",
        "خراب","نامناسب","غیرقابل قبول","شکایت","اعتراض","نارضایتی","بی‌کیفیت","دیر",
        "قطعی","خطا","ایراد","نقص","آزاردهنده","ناامید","بی‌فایده","غیرحرفه‌ای",
        "ناکارآمد","بی‌احترامی","منفی","شکست","بدی","افتضاحه"
    };

    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "و","در","به","از","که","این","را","با","است","برای","آن","یک","تا","هم","هر",
        "می","نمی","شود","شد","بود","باشد","دارد","کرد","کند","اگر","یا","نیز","چون",
        "ولی","اما","چه","کجا","چرا","چگونه","بی","بر","پس","نه","بله","خیلی","من","ما","شما"
    };

    public static List<string> Tokenize(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return new List<string>();

        var cleaned = Regex.Replace(text, @"[^\u0600-\u06FFa-zA-Z0-9\s]", " ");
        return cleaned.Split(new[] { ' ', '\t', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(w => w.Trim())
            .Where(w => w.Length > 1)
            .ToList();
    }

    public static string Analyze(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "neutral";

        var score = 0;
        var words = Tokenize(text);

        foreach (var word in words)
        {
            if (PositiveWords.Contains(word)) score++;
            if (NegativeWords.Contains(word)) score--;
        }

        foreach (var phrase in PositiveWords.Where(p => p.Contains(' ')))
            if (text.Contains(phrase)) score++;

        foreach (var phrase in NegativeWords.Where(p => p.Contains(' ')))
            if (text.Contains(phrase)) score--;

        return score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
    }

    public static List<WordFrequencyDto> GetTopWords(IEnumerable<string> texts, int topN = 25)
    {
        var freq = new Dictionary<string, int>();

        foreach (var text in texts)
        {
            foreach (var word in Tokenize(text))
            {
                if (StopWords.Contains(word)) continue;
                freq[word] = freq.GetValueOrDefault(word) + 1;
            }
        }

        return freq
            .OrderByDescending(kv => kv.Value)
            .Take(topN)
            .Select(kv => new WordFrequencyDto(kv.Key, kv.Value))
            .ToList();
    }
}