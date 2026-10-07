using System.Text;
using System.Text.RegularExpressions;
using SurveyManagement.Infrastructure.Query.Contract.Response;

namespace SurveyManagement.Infrastructure.Query.Services;

/// <summary>
/// تحلیل پاسخ‌های متنی فارسی (بدون وابستگی خارجی).
/// ─────────────────────────────────────────────────────────────────────────
///  • نرمال‌سازی: ي/ك عربی، اعراب، کشیده، نیم‌فاصله، ارقام فارسی/عربی، فاصله‌های اضافه
///  • ریشه‌یابی سبک (حذف پسوندهای جمع/صفت عالی/ضمایر متصل) تا «مدیران/مدیریت/مدیر» پراکنده نشوند
///  • کلیدواژه‌های شاخص (TF-IDF) و عبارت‌های پرتکرار دو و سه‌کلمه‌ای (بر اساس تعداد پاسخ‌ها، نه تکرار در یک پاسخ)
///  • احساس با وزن، تشدیدکننده («خیلی»، «بسیار»)، نفی («نیست»، «نبود»، «نمی‌…») و حالت «دوگانه»
///  • دسته‌بندی موضوعی پاسخ‌ها (حقوق، مدیریت، محیط کار، آموزش، ارتباطات، فرآیند/سامانه، ایمنی، رفاه، …)
///  • تشخیص پیشنهادها، پاسخ‌های تکراری/بی‌محتوا («ندارم»، «-») و توزیع طول پاسخ‌ها
/// </summary>
public static class PersianTextAnalyzer
{
    private const char Zwnj = '‌';
    private static readonly Regex Diacritics = new("[ً-ٰٟـ]", RegexOptions.Compiled);
    private static readonly Regex NonWord = new(@"[^؀-ۿ‌a-z0-9\s]", RegexOptions.Compiled);
    private static readonly Regex Spaces = new(@"\s+", RegexOptions.Compiled);

    // ───────────────────────────── واژگان ─────────────────────────────

    private static readonly HashSet<string> StopWords = new(StringComparer.Ordinal)
    {
        "و","در","به","از","که","این","را","با","است","برای","آن","یک","تا","هم","هر","می","نمی","شود","شد","بود","باشد",
        "دارد","کرد","کند","اگر","یا","نیز","چون","ولی","اما","چه","کجا","چرا","چگونه","بی","بر","پس","نه","بله","من","ما",
        "شما","او","آنها","ایشان","اینکه","آنکه","همه","همین","همان","چند","چنین","چنان","دیگر","خود","خودم","خودش","وی",
        "هست","هستند","هستیم","هستم","نیست","نیستند","بودن","باشند","باشیم","شده","شوند","کرده","کنند","کنیم","کنم","کنید",
        "داشته","دارند","داریم","دارم","داشت","داشتند","گفت","گفته","کردن","شدن","بوده","بودند","باید","نباید","توان","تواند",
        "توانند","میتوان","میتواند","خواهد","خواهند","خیلی","بسیار","کمی","زیاد","بیشتر","کمتر","اینجا","آنجا","حتی","فقط",
        "البته","مثل","مانند","طور","نحوی","یعنی","زیرا","بنابراین","درباره","روی","زیر","بین","پیش","پی","طی","جای","جا",
        "وقتی","هنگام","اکنون","الان","حال","حالا","سپس","بعد","قبل","تر","ترین","ها","های","ای","ی","اش","شان","تان","مان",
        "ام","ات","را","رو","هیچ","کس","کسی","چیز","چیزی","کار","کارها","اینها","آنان","ضمن","جهت","توسط","سوی","سمت",
        "ک","مورد","موارد","ندارد","ندارند","نیستند","میکنم","میکنیم","میشه","میشود","شده‌اند","بیشتری","کنه","کنن","بشه","باشه","لطفا","لطفاً","ممنون","سلام","باتشکر","تشکر","با تشکر","اینکار","چی","چیه","نداره","داره","هستش",
        "مثلا","مثلاً","واقعا","واقعاً","کاملا","کاملاً","اصلا","اصلاً","همچنین","چنانچه","ازطرف","ازجمله","جمله","طرف","یکی",
        "دو","سه","اول","دوم","سوم","امر","ان","the","and","of","to","in","is"
    };

    /// <summary>پاسخ‌هایی که محتوای قابل تحلیل ندارند</summary>
    private static readonly HashSet<string> NoContent = new(StringComparer.Ordinal)
    {
        "ندارم","نداریم","ندارد","نداره","خیر","نه","هیچ","هیچی","هیچ چیز","هیچ موردی","موردی نیست","موردی ندارم","مورد خاصی ندارم",
        "نظری ندارم","نظری نیست","پیشنهادی ندارم","پیشنهادی نیست","بدون نظر","-","--","---",".","..","...","ـ","x","no","none",
        "ندارم.","خیر.","خوب","خوبه","عالی","عالیه","ok","اوکی","باشه","تشکر","ممنون","سپاس","مرسی"
    };

    private static readonly Dictionary<string, double> Lexicon = Build(
        (2.0, "عالی عالیه فوق‌العاده فوقالعاده محشر بی‌نظیر بینظیر بهترین ممتاز درجه‌یک شاهکار"),
        (1.5, "راضی رضایت خوشحال خرسند سپاسگزار قدردان ممنون متشکر تشکر سپاس قدردانی موفق موفقیت"),
        (1.0, "خوب خوبه مناسب مفید کاربردی سریع آسان راحت روان دقیق منظم حرفه‌ای حرفه ای مثبت کامل زیبا جالب سازنده کارآمد " +
              "قابل‌اعتماد صمیمی دلپذیر خوشایند بهبود پیشرفت ارزشمند شفاف منصفانه عادلانه پاسخگو همکاری حمایت پشتیبانی تشویق انگیزه"),
        (-1.0, "مشکل مشکلات کند کندی سخت دشوار ضعیف ضعف نقص ایراد خطا اشکال دیر تاخیر تأخیر قطع قطعی کمبود ناکافی نامناسب " +
               "شلوغ سردرگمی پیچیده گران کم تبعیض بی‌نظمی بینظمی خستگی خسته فشار استرس نگرانی ابهام"),
        (-1.5, "ناراضی نارضایتی شکایت اعتراض ناامید ناامیدی بی‌توجهی بیتوجهی بی‌احترامی بیاحترامی ناعادلانه بی‌انصافی ناکارآمد " +
               "غیرحرفه‌ای غیرقابل‌قبول آزاردهنده بی‌فایده بیفایده خراب"),
        (-2.0, "افتضاح افتضاحه بدترین فاجعه وحشتناک اسفناک مزخرف"),
        (-1.0, "بد بده متاسفانه متأسفانه"));

    private static readonly HashSet<string> Negators = new(StringComparer.Ordinal)
    {
        "نیست","نیستند","نبود","نبودند","نیستم","نیستیم","نشد","نشده","نمیشه","نمی‌شود","نمیشود","ندارد","نداره","ندارند","هرگز","اصلا","اصلاً","نه"
    };

    private static readonly Dictionary<string, double> Intensifiers = new(StringComparer.Ordinal)
    {
        ["خیلی"] = 1.5, ["بسیار"] = 1.5, ["واقعا"] = 1.4, ["واقعاً"] = 1.4, ["کاملا"] = 1.3, ["کاملاً"] = 1.3,
        ["فوق"] = 1.3, ["شدیدا"] = 1.6, ["شدیداً"] = 1.6, ["خیلیی"] = 1.5, ["نسبتا"] = 0.7, ["نسبتاً"] = 0.7, ["کمی"] = 0.6, ["تاحدی"] = 0.7
    };

    private sealed record Theme(string Key, string Title, string[] Stems);

    /// <summary>موضوعات رایج نظرسنجی‌های سازمانی (ریشه‌ها؛ با ریشه‌یابی سبک مقایسه می‌شوند)</summary>
    private static readonly Theme[] Themes =
    [
        new("pay", "حقوق، مزایا و پاداش", ["حقوق","دستمزد","مزایا","مزای","پاداش","اضافه‌کار","اضافه کار","اضافه","کارانه","معیشت","وام","بن","افزایش","پرداخت","تورم","مالی","حق","بیمه"]),
        new("management", "مدیریت و سرپرستی", ["مدیر","مدیریت","سرپرست","رئیس","رییس","مسئول","مسئولین","تصمیم","رهبری","مافوق","معاون"]),
        new("workplace", "محیط کار و امکانات", ["محیط","فضا","تجهیزات","امکانات","ساختمان","دفتر","میز","صندلی","سیستم","کامپیوتر","تهویه","سرمایش","گرمایش","روشنایی","نور","سرویس بهداشتی","پارکینگ"]),
        new("training", "آموزش و توسعه", ["آموزش","دوره","کلاس","مهارت","یادگیری","توسعه","ارتقا","ارتقاء","پیشرفت","شغلی","مسیر"]),
        new("communication", "ارتباطات و همکاری", ["ارتباط","همکاری","همکار","تیم","هماهنگی","اطلاع‌رسانی","اطلاع","رسانی","شفافیت","جلسه","گفتگو","احترام","تعامل"]),
        new("process", "فرآیندها و سامانه‌ها", ["فرآیند","فرایند","روال","بوروکراسی","کاغذبازی","سامانه","نرم‌افزار","نرم","افزار","اتوماسیون","سرعت","زمان","انتظار","مراحل","دستورالعمل"]),
        new("safety", "ایمنی و سلامت", ["ایمنی","ایمن","سلامت","بهداشت","حادثه","خطر","پزشکی","درمان","بیمه","استرس","فشار"]),
        new("workload", "حجم کار و زمان‌بندی", ["حجم","ساعت","شیفت","نوبت","مرخصی","تعطیل","اضافه‌کاری","خستگی","استراحت","زمان‌بندی","برنامه"]),
        new("welfare", "رفاه، تغذیه و خدمات", ["رفاه","رفاهی","غذا","ناهار","تغذیه","سرویس","ایاب","ذهاب","رستوران","کیفیت","ورزش","تفریح","اردو"]),
        new("recognition", "قدردانی و انگیزه", ["قدردانی","تشویق","انگیزه","ارزش","دیده","شایسته","شایستگی","عدالت","عادلانه","تبعیض","انصاف"])
    ];

    private static readonly string[] SuggestionCues =
    [
        "پیشنهاد","بهتر است","بهتره","بهتر بود","لطفا","لطفاً","خواهشمند","باید","نیاز است","نیازه","لازم است","لازمه",
        "انتظار","امیدوارم","کاش","ای کاش","توصیه","اضافه شود","اضافه کنید","فراهم شود","در نظر گرفته","بررسی شود","اصلاح شود"
    ];

    // ───────────────────────────── API ─────────────────────────────

    public static TextAnalyticsDto Analyze(IReadOnlyList<string> rawTexts, int maxAnswers = 1000)
    {
        var dto = new TextAnalyticsDto();
        var items = rawTexts
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => new Doc(t.Trim(), Normalize(t)))
            .ToList();

        dto.TotalTextAnswers = items.Count;
        if (items.Count == 0) return dto;

        // تکراری‌ها و بی‌محتواها
        var groups = items.GroupBy(i => i.Normalized).OrderByDescending(g => g.Count()).ToList();
        dto.RepeatedAnswers = groups.Where(g => g.Count() > 1).Take(15)
            .Select(g => new WordFrequencyDto(g.First().Original, g.Count())).ToList();
        foreach (var d in items) d.IsNoContent = NoContent.Contains(d.Normalized) || d.Normalized.Length < 2;
        dto.EmptyLikeCount = items.Count(d => d.IsNoContent);

        var meaningful = items.Where(d => !d.IsNoContent).ToList();
        dto.MeaningfulCount = meaningful.Count;

        // طول
        var wordCounts = items.Select(d => d.Tokens.Count).ToList();
        dto.AverageWordCount = Math.Round((decimal)wordCounts.Average(), 1);
        dto.AverageCharCount = Math.Round((decimal)items.Average(d => d.Original.Length), 1);
        dto.MedianWordCount = Median(wordCounts);
        dto.LengthDistribution =
        [
            new HistogramBucketDto("کوتاه (۱ تا ۳ کلمه)", wordCounts.Count(c => c <= 3)),
            new HistogramBucketDto("متوسط (۴ تا ۱۵ کلمه)", wordCounts.Count(c => c is > 3 and <= 15)),
            new HistogramBucketDto("مفصل (۱۶ تا ۵۰ کلمه)", wordCounts.Count(c => c is > 15 and <= 50)),
            new HistogramBucketDto("بسیار مفصل (بیش از ۵۰)", wordCounts.Count(c => c > 50))
        ];

        // کلیدواژه‌ها: تعداد پاسخ‌هایی که واژه در آن آمده (DF) و امتیاز TF-IDF
        var df = new Dictionary<string, int>();
        var tf = new Dictionary<string, int>();
        var surface = new Dictionary<string, Dictionary<string, int>>();
        foreach (var d in meaningful)
        {
            foreach (var (stem, word) in d.Content)
            {
                tf[stem] = tf.GetValueOrDefault(stem) + 1;
                if (!surface.TryGetValue(stem, out var forms)) surface[stem] = forms = new();
                forms[word] = forms.GetValueOrDefault(word) + 1;
            }
            foreach (var stem in d.Content.Select(c => c.Stem).Distinct())
                df[stem] = df.GetValueOrDefault(stem) + 1;
        }

        var n = Math.Max(1, meaningful.Count);
        string Display(string stem) => surface[stem].OrderByDescending(kv => kv.Value).First().Key;
        dto.Keywords = df
            .Where(kv => kv.Value >= (n >= 20 ? 2 : 1))
            .Select(kv => new KeywordDto(Display(kv.Key), tf[kv.Key], kv.Value,
                Math.Round((decimal)(tf[kv.Key] * Math.Log(1 + n / (double)kv.Value)), 2)))
            .OrderByDescending(k => k.DocumentCount).ThenByDescending(k => k.Score)
            .Take(40)
            .ToList();
        dto.TopWords = dto.Keywords.Take(25).Select(k => new WordFrequencyDto(k.Term, k.DocumentCount)).ToList();

        // عبارت‌ها (دو و سه‌کلمه‌ای پشت‌سرهم بدون ایست‌واژه)
        var phraseDf = new Dictionary<string, int>();
        foreach (var d in meaningful)
        {
            var seen = new HashSet<string>();
            foreach (var run in d.Runs)
                for (var size = 2; size <= 3; size++)
                    for (var i = 0; i + size <= run.Count; i++)
                        seen.Add(string.Join(' ', run.Skip(i).Take(size)));
            foreach (var p in seen) phraseDf[p] = phraseDf.GetValueOrDefault(p) + 1;
        }
        dto.Phrases = phraseDf
            .Where(kv => kv.Value >= 2)
            .OrderByDescending(kv => kv.Value).ThenByDescending(kv => kv.Key.Count(c => c == ' '))
            .Take(25)
            .Select(kv => new KeywordDto(kv.Key, kv.Value, kv.Value, kv.Value))
            .ToList();
        // عبارت کوتاه‌تری که داخل عبارت بلندتر با همان تکرار آمده حذف شود
        dto.Phrases = dto.Phrases
            .Where(p => !dto.Phrases.Any(o => o != p && o.DocumentCount == p.DocumentCount && o.Term.Contains(p.Term)))
            .ToList();

        // احساس و موضوع
        foreach (var d in meaningful)
        {
            d.Score = Score(d);
            d.Sentiment = d.HasPositive && d.HasNegative && Math.Abs(d.Score) < 1.5 ? "mixed"
                : d.Score >= 0.6 ? "positive"
                : d.Score <= -0.6 ? "negative"
                : "neutral";
            d.Themes = Themes.Where(t => t.Stems.Any(s => d.StemSet.Contains(Stem(s)) || d.Normalized.Contains(s)))
                .Select(t => t.Key).ToList();
            d.IsSuggestion = SuggestionCues.Any(c => d.Normalized.Contains(c));
        }

        var s = dto.Sentiment;
        s.PositiveCount = meaningful.Count(d => d.Sentiment == "positive");
        s.NegativeCount = meaningful.Count(d => d.Sentiment == "negative");
        s.MixedCount = meaningful.Count(d => d.Sentiment == "mixed");
        s.NeutralCount = meaningful.Count(d => d.Sentiment == "neutral");
        if (meaningful.Count > 0)
        {
            s.PositivePercentage = Pct(s.PositiveCount, meaningful.Count);
            s.NegativePercentage = Pct(s.NegativeCount, meaningful.Count);
            s.MixedPercentage = Pct(s.MixedCount, meaningful.Count);
            s.NeutralPercentage = Pct(s.NeutralCount, meaningful.Count);
            s.AverageScore = Math.Round((decimal)meaningful.Average(d => Math.Clamp(d.Score, -5, 5)), 2);
            // شاخص -۱۰۰ تا +۱۰۰ (درصد مثبت منهای درصد منفی)
            s.NetSentiment = Math.Round(s.PositivePercentage - s.NegativePercentage, 1);
        }
        s.Samples = meaningful
            .GroupBy(d => d.Sentiment)
            .SelectMany(g => g.OrderByDescending(d => Math.Abs(d.Score)).ThenByDescending(d => d.Tokens.Count).Take(6)
                .Select(d => new SentimentAnswerDto(d.Original, d.Sentiment)))
            .ToList();

        dto.Themes = Themes
            .Select(t =>
            {
                var hits = meaningful.Where(d => d.Themes.Contains(t.Key)).ToList();
                return new TextThemeDto
                {
                    Key = t.Key,
                    Title = t.Title,
                    Count = hits.Count,
                    Percentage = Pct(hits.Count, Math.Max(1, meaningful.Count)),
                    PositiveCount = hits.Count(h => h.Sentiment == "positive"),
                    NegativeCount = hits.Count(h => h.Sentiment == "negative"),
                    Samples = hits.OrderByDescending(h => h.Tokens.Count).Take(4).Select(h => h.Original).ToList()
                };
            })
            .Where(t => t.Count > 0)
            .OrderByDescending(t => t.Count)
            .ToList();

        var suggestions = meaningful.Where(d => d.IsSuggestion).ToList();
        dto.SuggestionCount = suggestions.Count;
        dto.Suggestions = suggestions.OrderByDescending(d => d.Tokens.Count).Take(15).Select(d => d.Original).ToList();

        dto.SampleAnswers = meaningful.OrderByDescending(d => d.Tokens.Count).Take(30).Select(d => d.Original).ToList();
        dto.Answers = items.Take(maxAnswers).Select(d => new TextAnswerItemDto
        {
            Text = d.Original,
            Sentiment = d.IsNoContent ? "empty" : d.Sentiment,
            Score = Math.Round((decimal)d.Score, 2),
            WordCount = d.Tokens.Count,
            Themes = d.Themes,
            IsSuggestion = d.IsSuggestion
        }).ToList();

        return dto;
    }

    /// <summary>برای سازگاری با کد قبلی (فهرست واژه‌ها)</summary>
    public static List<string> Tokenize(string text) => Normalize(text).Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();

    public static string Normalize(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var sb = new StringBuilder(text.Length);
        foreach (var ch in text.ToLowerInvariant())
        {
            sb.Append(ch switch
            {
                'ي' or 'ى' => 'ی',
                'ك' => 'ک',
                'ة' => 'ه',
                'أ' or 'إ' or 'ٱ' => 'ا',
                'ؤ' => 'و',
                >= '۰' and <= '۹' => (char)('0' + (ch - '۰')),
                >= '٠' and <= '٩' => (char)('0' + (ch - '٠')),
                '‍' or '‏' or '‎' => ' ',
                _ => ch
            });
        }
        var s = Diacritics.Replace(sb.ToString(), "");
        s = NonWord.Replace(s, " ");
        // «می رود» / «می‌رود» یکی شوند؛ نیم‌فاصله به‌عنوان بخشی از واژه می‌ماند
        s = Regex.Replace(s, @"\b(ن?می)\s+(?=\S)", "$1" + Zwnj);
        s = Spaces.Replace(s, " ").Trim();
        return s;
    }

    /// <summary>ریشه‌یابی سبک: حذف پسوندهای رایج وقتی ریشه حداقل ۳ حرف بماند</summary>
    public static string Stem(string word)
    {
        var w = word.Replace(Zwnj.ToString(), "");
        foreach (var suffix in new[] { "هایشان", "هایمان", "هایتان", "هایی", "های", "ها", "ترین", "تری", "تر", "یشان", "شان", "مان", "تان", "ات", "ان", "یم", "ید", "ند", "ام", "اش" })
        {
            if (w.Length - suffix.Length >= 3 && w.EndsWith(suffix, StringComparison.Ordinal))
                return w[..^suffix.Length];
        }
        return w;
    }

    // ───────────────────────────── داخلی ─────────────────────────────

    private sealed class Doc
    {
        public Doc(string original, string normalized)
        {
            Original = original.Length > 2000 ? original[..2000] : original;
            Normalized = normalized;
            Tokens = normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
            Content = Tokens.Where(t => t.Length > 1 && !StopWords.Contains(t) && !StopWords.Contains(t.Replace(Zwnj.ToString(), "")) && !t.All(char.IsAsciiDigit))
                .Select(t => (Stem(t), t)).ToList();
            StemSet = Content.Select(c => c.Item1).ToHashSet();

            // دنباله‌های پیوسته‌ی واژه‌های محتوایی برای استخراج عبارت
            var run = new List<string>();
            foreach (var t in Tokens)
            {
                if (t.Length > 1 && !StopWords.Contains(t)) run.Add(t);
                else { if (run.Count >= 2) Runs.Add(run); run = new(); }
            }
            if (run.Count >= 2) Runs.Add(run);
        }

        public string Original { get; }
        public string Normalized { get; }
        public List<string> Tokens { get; }
        public List<(string Stem, string Word)> Content { get; }
        public HashSet<string> StemSet { get; }
        public List<List<string>> Runs { get; } = new();
        public bool IsNoContent { get; set; }
        public double Score { get; set; }
        public bool HasPositive { get; set; }
        public bool HasNegative { get; set; }
        public string Sentiment { get; set; } = "neutral";
        public List<string> Themes { get; set; } = new();
        public bool IsSuggestion { get; set; }
    }

    private static double Score(Doc d)
    {
        double total = 0;
        var tokens = d.Tokens;
        for (var i = 0; i < tokens.Count; i++)
        {
            var token = tokens[i];
            if (!TryPolarity(token, out var value)) continue;

            // تشدیدکننده‌ی قبلی
            if (i > 0 && Intensifiers.TryGetValue(tokens[i - 1], out var factor)) value *= factor;

            // نفی: واژه‌ی نفی تا دو کلمه بعد («خوب نیست»، «خوب نبود») یا قبل («نه خوب»)
            var negated = (i + 1 < tokens.Count && Negators.Contains(tokens[i + 1]))
                          || (i + 2 < tokens.Count && Negators.Contains(tokens[i + 2]))
                          || (i > 0 && tokens[i - 1] == "نه");
            if (negated) value = -value * (value < 0 ? 0.3 : 1.0); // «بد نیست» ≈ خنثی؛ «خوب نیست» = منفی

            if (value > 0) d.HasPositive = true;
            if (value < 0) d.HasNegative = true;
            total += value;
        }

        // عبارت‌های چندکلمه‌ای
        foreach (var (phrase, value) in MultiWord)
            if (d.Normalized.Contains(phrase))
            {
                total += value;
                if (value > 0) d.HasPositive = true; else d.HasNegative = true;
            }

        // پیام کوتاه با یک واژه‌ی قوی وزن بیشتری دارد؛ متن بلند با چند واژه‌ی ضعیف کمتر
        return total / Math.Max(1, Math.Sqrt(Math.Max(1, tokens.Count) / 12.0));
    }

    private static readonly (string Phrase, double Value)[] MultiWord =
    [
        ("خیلی خوب", 1.0), ("دست شما درد نکنه", 1.5), ("دستتون درد نکنه", 1.5), ("خسته نباشید", 1.0), ("راضی هستم", 1.0),
        ("رضایت دارم", 1.0), ("قابل قبول", 0.5), ("رسیدگی نمی", -1.0),
        ("توجه نمی", -1.0), ("پاسخگو نیست", -1.2), ("پاسخ نمی", -1.0), ("وقت تلف", -1.2), ("اتلاف وقت", -1.2),
        ("ناراضی هستم", -1.0), ("رضایت ندارم", -1.2), ("اصلا خوب نیست", -1.0)
    ];

    private static bool TryPolarity(string token, out double value)
    {
        if (Lexicon.TryGetValue(token, out value)) return true;
        var stem = Stem(token);
        if (Lexicon.TryGetValue(stem, out value)) return true;
        // پیشوند منفی‌ساز «نا»/«بی» روی واژه‌ی مثبت («نامناسب»، «بی‌کیفیت» از قبل در واژگان هستند)
        foreach (var prefix in new[] { "نا", "بی" })
            if (stem.StartsWith(prefix, StringComparison.Ordinal) && Lexicon.TryGetValue(stem[prefix.Length..].TrimStart(Zwnj), out var baseValue) && baseValue > 0)
            {
                value = -baseValue;
                return true;
            }
        value = 0;
        return false;
    }

    private static Dictionary<string, double> Build(params (double Value, string Words)[] groups)
    {
        var dict = new Dictionary<string, double>(StringComparer.Ordinal);
        foreach (var (value, words) in groups)
            foreach (var w in words.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            {
                var normalized = Normalize(w).Replace(" ", Zwnj.ToString());
                dict.TryAdd(normalized, value);
                dict.TryAdd(normalized.Replace(Zwnj.ToString(), ""), value);
            }
        return dict;
    }

    private static decimal Pct(int part, int total) => total == 0 ? 0 : Math.Round(part * 100m / total, 1);

    private static decimal Median(List<int> values)
    {
        if (values.Count == 0) return 0;
        var sorted = values.OrderBy(v => v).ToList();
        var mid = sorted.Count / 2;
        return sorted.Count % 2 == 0 ? (sorted[mid - 1] + sorted[mid]) / 2m : sorted[mid];
    }
}
