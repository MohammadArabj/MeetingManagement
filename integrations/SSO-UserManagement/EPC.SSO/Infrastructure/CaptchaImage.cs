using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace EPC.SSO.Infrastructure;

/// <summary>
/// تصویر کد امنیتی (SVG) که متن آن فقط به صورت خطوط کج و معوج رسم می‌شود.
/// قبلاً متن کد در HTML و در پاسخ JSON (RefreshCaptcha) برگردانده می‌شد و ربات به‌راحتی آن را می‌خواند.
/// SVG فقط در تگ img استفاده می‌شود (اسکریپت در آن اجرا نمی‌شود) و هیچ متن یا فونتی در آن نیست.
/// </summary>
public static class CaptchaImage
{
    /// <summary>کاراکترهای مجاز (بدون ارقام قابل اشتباه ۰ و ۱)</summary>
    public const string Alphabet = "23456789";

    // هر رقم: چند خط شکسته روی شبکه‌ی 10×16
    private static readonly Dictionary<char, float[][]> Glyphs = new()
    {
        ['2'] = [[1, 4, 3, 1, 7, 1, 9, 4, 9, 6, 1, 15, 9, 15]],
        ['3'] = [[1, 2, 8, 1, 9, 4, 8, 7, 4, 8], [4, 8, 8, 9, 9, 12, 8, 15, 1, 14]],
        ['4'] = [[7, 15, 7, 1, 1, 11, 9, 11]],
        ['5'] = [[9, 1, 2, 1, 1, 7, 7, 7, 9, 10, 8, 14, 1, 15]],
        ['6'] = [[8, 1, 3, 3, 1, 9, 2, 14, 7, 15, 9, 12, 8, 9, 3, 8, 1, 10]],
        ['7'] = [[1, 1, 9, 1, 4, 15], [3, 8, 8, 8]],
        ['8'] = [[5, 8, 2, 6, 2, 2, 5, 1, 8, 2, 8, 6, 5, 8, 1, 11, 2, 15, 8, 15, 9, 11, 5, 8]],
        ['9'] = [[8, 6, 6, 8, 2, 7, 1, 3, 3, 1, 7, 1, 9, 4, 8, 10, 5, 15, 2, 15]],
    };

    public const int Width = 180;
    public const int Height = 56;

    public static string NewText(int length = 5) =>
        new(Enumerable.Range(0, length).Select(_ => Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)]).ToArray());

    public static string Render(string text)
    {
        var sb = new StringBuilder(4096);
        sb.Append(CultureInfo.InvariantCulture,
            $"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{Width}\" height=\"{Height}\" viewBox=\"0 0 {Width} {Height}\">");
        sb.Append(CultureInfo.InvariantCulture, $"<rect width=\"{Width}\" height=\"{Height}\" fill=\"#f4efe9\"/>");

        // نویز پس‌زمینه
        for (var i = 0; i < 40; i++)
            sb.Append(CultureInfo.InvariantCulture,
                $"<circle cx=\"{R(0, Width)}\" cy=\"{R(0, Height)}\" r=\"{R(0.6, 1.8):0.#}\" fill=\"{Color(150, 210)}\"/>");
        for (var i = 0; i < 3; i++)
            sb.Append(Curve(Color(140, 200), R(1, 1.8)));

        var step = (Width - 24.0) / text.Length;
        for (var i = 0; i < text.Length; i++)
        {
            if (!Glyphs.TryGetValue(text[i], out var strokes)) continue;
            var scale = R(2.2, 2.7);
            var x = 12 + i * step + R(-3, 3);
            var y = (Height - 16 * scale) / 2 + R(-4, 4);
            var angle = R(-22, 22);
            var color = Color(30, 90);

            sb.Append(CultureInfo.InvariantCulture,
                $"<g transform=\"translate({x:0.##} {y:0.##}) rotate({angle:0.#} {5 * scale:0.#} {8 * scale:0.#})\" fill=\"none\" stroke=\"{color}\" stroke-width=\"{R(2.4, 3.2):0.#}\" stroke-linecap=\"round\" stroke-linejoin=\"round\">");
            foreach (var stroke in strokes)
            {
                sb.Append("<polyline points=\"");
                for (var p = 0; p < stroke.Length; p += 2)
                {
                    var px = (stroke[p] + R(-0.5, 0.5)) * scale;
                    var py = (stroke[p + 1] + R(-0.5, 0.5)) * scale;
                    sb.Append(CultureInfo.InvariantCulture, $"{px:0.#},{py:0.#} ");
                }
                sb.Append("\"/>");
            }
            sb.Append("</g>");
        }

        // خطوط روی متن
        for (var i = 0; i < 2; i++)
            sb.Append(Curve(Color(60, 120), R(1.2, 2)));

        sb.Append("</svg>");
        return sb.ToString();
    }

    private static string Curve(string color, double width) =>
        string.Create(CultureInfo.InvariantCulture,
            $"<path d=\"M{R(0, 20):0} {R(5, Height - 5):0} C{R(40, 80):0} {R(0, Height):0},{R(100, 140):0} {R(0, Height):0},{R(160, Width):0} {R(5, Height - 5):0}\" fill=\"none\" stroke=\"{color}\" stroke-width=\"{width:0.#}\"/>");

    private static double R(double min, double max) =>
        min + RandomNumberGenerator.GetInt32(0, 10_000) / 10_000.0 * (max - min);

    private static string Color(int min, int max)
    {
        int C() => RandomNumberGenerator.GetInt32(min, max);
        return $"#{C():x2}{C():x2}{C():x2}";
    }
}
