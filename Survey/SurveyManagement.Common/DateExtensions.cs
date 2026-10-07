using System.Globalization;

namespace MeetingManagement.Common.Extensions;

public static class DateExtensions
{

    ///// <summary>
    ///// تبدیل رشته حاوی تاریخ میلادی به تاریخ میلادی
    ///// </summary>
    ///// <param name="s"></param>
    ///// <returns></returns>
    //public static DateTime ToDateTime(this object s)
    //{
    //    try
    //    {
    //        return Convert.ToDateTime(s.ToString());
    //    }
    //    catch (Exception)
    //    {
    //        return DateTime.Now;
    //    }
    //}
    ///// <summary>
    ///// تبدیل رشته حاوی تاریخ میلادی به تاریخ میلادی
    ///// </summary>
    ///// <param name="s"></param>
    ///// <returns></returns>
    //public static DateTime? ToDateTimeNull(this object s)
    //{
    //    try
    //    {
    //        if (s == null) return null;
    //        return Convert.ToDateTime(s.ToString());
    //    }
    //    catch (Exception)
    //    {
    //        return null;
    //    }
    //}

    ///// <summary>
    ///// تبدیل رشته حاوی تاریخ شمسی به تاریخ میلادی- ورودی بدون ساعت
    ///// </summary>
    ///// <param name="s">1400/06/24</param>
    ///// <returns>2021/09/15</returns>
    //public static DateTime ToEnglishDate(this object s)
    //{
    //    try
    //    {
    //        if (s == null)
    //            return DateTime.Now;

    //        var date = s.ToString();
    //        if (string.IsNullOrEmpty(date))
    //            return DateTime.Now;
    //        var d = date.ToEnglishNumber().Split('/');
    //        int year = d[0].ToInt();
    //        int month = d[1].ToInt();
    //        int day = d[2].ToInt();

    //        var p = new PersianCalendar();
    //        var dt = p.ToDateTime(year, month, day, 0, 0, 0, 0);
    //        var xyear = dt.Year.ToString();
    //        var xmonth = dt.Month.ToString();
    //        if (xmonth.Length == 1)
    //        {
    //            xmonth = "0" + xmonth;
    //        }
    //        var xday = dt.Day.ToString();
    //        if (xday.Length == 1)
    //        {
    //            xday = "0" + xday;
    //        }
    //        return (xyear + '/' + xmonth + '/' + xday).ToDateTime();
    //    }
    //    catch (Exception)
    //    {
    //        return DateTime.Now;
    //    }
    //}

    //public static string EnglishDateToString(this object s, string to = "yyyy/MM/dd")
    //{
    //    if (s == null)
    //        return "";

    //    var d = s.ToString();
    //    if (string.IsNullOrEmpty(d))
    //        return "";

    //    var date = d.ToDateTime();

    //    return date.ToString(to);
    //}

    ///// <summary>
    ///// تبدیل رشته حاوی تاریخ شمسی به تاریخ میلادی- ورودی بدون ساعت
    ///// </summary>
    ///// <param name="s">1400/06/24</param>
    ///// <returns>2021/09/15</returns>
    //public static string ToEnglishDateString(this object s)
    //{
    //    try
    //    {
    //        if (s == null)
    //            return "";

    //        var date = s.ToString();
    //        if (string.IsNullOrEmpty(date))
    //            return "";

    //        var d = date.ToEnglishNumber().Split('/');
    //        int year = d[0].ToInt();
    //        int month = d[1].ToInt();
    //        int day = d[2].ToInt();

    //        var p = new PersianCalendar();
    //        var dt = p.ToDateTime(year, month, day, 0, 0, 0, 0);
    //        var xyear = dt.Year.ToString();
    //        var xmonth = dt.Month.ToString();
    //        if (xmonth.Length == 1)
    //        {
    //            xmonth = "0" + xmonth;
    //        }
    //        var xday = dt.Day.ToString();
    //        if (xday.Length == 1)
    //        {
    //            xday = "0" + xday;
    //        }
    //        return (xyear + '/' + xmonth + '/' + xday);
    //    }
    //    catch (Exception)
    //    {
    //        return "";
    //    }
    //}

    ///// <summary>
    ///// تبدیل رشته حاوی تاریخ شمسی به تاریخ میلادی- ورودی بدون ساعت
    ///// </summary>
    ///// <param name="s">1400/06/24</param>
    ///// <returns>2021/09/15</returns>
    //public static DateTime? ToEnglishDateNull(this object s)
    //{

    //    try
    //    {
    //        if (string.IsNullOrEmpty(s.ToString())) return null;
    //        var date = s.ToEnglishNumber().ToString();
    //        int year;
    //        int month;
    //        int day;
    //        if (string.IsNullOrEmpty(date))
    //            return DateTime.Now;
    //        if (date.Substring(0, 4).Contains("/"))
    //        {
    //            day = int.Parse(date.Substring(0, 2));
    //            month = int.Parse(date.Substring(3, 2));
    //            year = int.Parse(date.Substring(6, 4));
    //        }
    //        else
    //        {
    //            day = int.Parse(date.Substring(8, 2));
    //            month = int.Parse(date.Substring(5, 2));
    //            year = int.Parse(date.Substring(0, 4));
    //        }

    //        var p = new PersianCalendar();
    //        var dt = p.ToDateTime(year, month, day, 0, 0, 0, 0);
    //        var xyear = dt.Year.ToString();
    //        var xmonth = dt.Month.ToString();
    //        if (xmonth.Length == 1)
    //        {
    //            xmonth = "0" + xmonth;
    //        }
    //        var xday = dt.Day.ToString();
    //        if (xday.Length == 1)
    //        {
    //            xday = "0" + xday;
    //        }
    //        return (xyear + '/' + xmonth + '/' + xday).ToDateTime();
    //    }
    //    catch (Exception)
    //    {
    //        return null;
    //    }
    //}

    ///// <summary>
    ///// تبدیل فقط به تاریخ شمسی
    ///// </summary>
    ///// <param name="d"></param>
    ///// <returns>1400/06/13</returns>
    //public static string ToPersianDate(this object d)
    //{
    //    try
    //    {
    //        if (d == null)
    //            return "";

    //        var date = d.ToString();

    //        if (string.IsNullOrEmpty(date))
    //            return "";

    //        var eDate = Convert.ToDateTime(date);
    //        var year = eDate.Year;
    //        var month = eDate.Month;
    //        var day = eDate.Day;
    //        var p = new PersianCalendar();
    //        var dt = new DateTime(year, month, day);
    //        var xyear = p.GetYear(dt).ToString();
    //        var xmonth = p.GetMonth(dt).ToString();
    //        if (xmonth.Length == 1)
    //        {
    //            xmonth = "0" + xmonth;
    //        }
    //        var xday = p.GetDayOfMonth(dt).ToString();
    //        if (xday.Length == 1)
    //        {
    //            xday = "0" + xday;
    //        }
    //        return xyear + '/' + xmonth + '/' + xday;
    //    }
    //    catch (Exception)
    //    {
    //        return "نامعین";
    //    }
    //}

    ///// <summary>
    ///// روز هفته شمسی
    ///// </summary>
    ///// <param name="d"></param>
    ///// <returns>شنبه</returns>
    //public static string ToPersianDay(this object d)
    //{
    //    try
    //    {
    //        var date = d.ToString();
    //        if (string.IsNullOrEmpty(date))
    //            return string.Empty;
    //        var eDate = Convert.ToDateTime(date);
    //        var year = eDate.Year;
    //        var month = eDate.Month;
    //        var day = eDate.Day;
    //        var p = new PersianCalendar();
    //        var dt = new DateTime(year, month, day);
    //        var xyear = p.GetYear(dt).ToString();
    //        var xmonth = p.GetMonth(dt).ToString();
    //        var dayOfWeek = "";
    //        switch (eDate.DayOfWeek)
    //        {
    //            case DayOfWeek.Saturday:
    //                dayOfWeek = "شنبه";
    //                break;
    //            case DayOfWeek.Sunday:
    //                dayOfWeek = "یکشنبه";
    //                break;
    //            case DayOfWeek.Monday:
    //                dayOfWeek = "دوشنبه";
    //                break;
    //            case DayOfWeek.Tuesday:
    //                dayOfWeek = "سه شنبه";
    //                break;
    //            case DayOfWeek.Wednesday:
    //                dayOfWeek = "چهارشنبه";
    //                break;
    //            case DayOfWeek.Thursday:
    //                dayOfWeek = "پنج شنبه";
    //                break;
    //            case DayOfWeek.Friday:
    //                dayOfWeek = "جمعه";
    //                break;
    //        }
    //        return dayOfWeek;
    //    }
    //    catch (Exception)
    //    {

    //        return "نامعین";
    //    }
    //}


    ///// <summary>
    ///// تبدیل به روز، تاریخ و ساعت شمسی
    ///// </summary>
    ///// <param name="d"></param>
    ///// <returns>یکشنبه 1400/06/13-12:35:39</returns>
    //public static string ToPersianFullDateTime(this object d)
    //{
    //    try
    //    {
    //        var date = d.ToString();
    //        if (string.IsNullOrEmpty(date))
    //            return string.Empty;
    //        var eDate = Convert.ToDateTime(date);
    //        var year = eDate.Year;
    //        var month = eDate.Month;
    //        var day = eDate.Day;
    //        var p = new PersianCalendar();
    //        var dt = new DateTime(year, month, day);
    //        var xyear = p.GetYear(dt).ToString();
    //        var xmonth = p.GetMonth(dt).ToString();
    //        if (xmonth.Length == 1)
    //        {
    //            xmonth = "0" + xmonth;
    //        }
    //        var xday = p.GetDayOfMonth(dt).ToString();
    //        if (xday.Length == 1)
    //        {
    //            xday = "0" + xday;
    //        }
    //        var dayOfWeek = "";
    //        switch (eDate.DayOfWeek)
    //        {
    //            case DayOfWeek.Saturday:
    //                dayOfWeek = "شنبه";
    //                break;
    //            case DayOfWeek.Sunday:
    //                dayOfWeek = "یکشنبه";
    //                break;
    //            case DayOfWeek.Monday:
    //                dayOfWeek = "دوشنبه";
    //                break;
    //            case DayOfWeek.Tuesday:
    //                dayOfWeek = "سه شنبه";
    //                break;
    //            case DayOfWeek.Wednesday:
    //                dayOfWeek = "چهارشنبه";
    //                break;
    //            case DayOfWeek.Thursday:
    //                dayOfWeek = "پنج شنبه";
    //                break;
    //            case DayOfWeek.Friday:
    //                dayOfWeek = "جمعه";
    //                break;
    //        }
    //        return dayOfWeek + " " + xyear + '/' + xmonth + '/' + xday + "-" +
    //               Convert.ToDateTime(eDate).ToString("HH:mm:ss");
    //    }
    //    catch (Exception)
    //    {
    //        return "نامعین";
    //    }
    //}

    ///// <summary>
    ///// تبدیل به تاریخ و ساعت شمسی
    ///// </summary>
    ///// <param name="d"></param>
    ///// <returns>1400/06/13-12:35:39</returns>
    //public static string ToPersianDateTime(this object d)
    //{
    //    try
    //    {
    //        if (d == null)
    //            return "";

    //        var date = d.ToString();

    //        if (string.IsNullOrEmpty(date))
    //            return "";

    //        var eDate = Convert.ToDateTime(date);
    //        var year = eDate.Year;
    //        var month = eDate.Month;
    //        var day = eDate.Day;
    //        var p = new PersianCalendar();
    //        var dt = new DateTime(year, month, day);
    //        var xyear = p.GetYear(dt).ToString();
    //        var xmonth = p.GetMonth(dt).ToString();
    //        if (xmonth.Length == 1)
    //        {
    //            xmonth = "0" + xmonth;
    //        }
    //        var xday = p.GetDayOfMonth(dt).ToString();
    //        if (xday.Length == 1)
    //        {
    //            xday = "0" + xday;
    //        }
    //        return xyear + '/' + xmonth + '/' + xday + "-" +
    //               Convert.ToDateTime(eDate).ToString("HH:mm:ss");
    //    }
    //    catch (Exception)
    //    {
    //        return "نامعین";
    //    }
    //}

    ///// <summary>
    ///// نمایش نام ماه بجای عدد ماه
    ///// </summary>
    ///// <param name="d"></param>
    ///// <returns>12 شهریور 1400</returns>
    //public static string ToPersianDateMonthName(this object d)
    //{
    //    try
    //    {
    //        var date = d.ToString();
    //        if (string.IsNullOrEmpty(date))
    //            return string.Empty;
    //        var eDate = Convert.ToDateTime(d);
    //        var year = eDate.Year;
    //        var month = eDate.Month;
    //        var day = eDate.Day;
    //        var p = new PersianCalendar();
    //        var dt = new DateTime(year, month, day);
    //        var xyear = p.GetYear(dt).ToString();
    //        var xmonth = p.GetMonth(dt);
    //        var monthName = "";
    //        switch (xmonth)
    //        {
    //            case 1:
    //                monthName = "فروردین";
    //                break;
    //            case 2:
    //                monthName = "اردیبشهت";
    //                break;
    //            case 3:
    //                monthName = "خرداد";
    //                break;
    //            case 4:
    //                monthName = "تیر";
    //                break;
    //            case 5:
    //                monthName = "مرداد";
    //                break;
    //            case 6:
    //                monthName = "شهریور";
    //                break;
    //            case 7:
    //                monthName = "مهر";
    //                break;
    //            case 8:
    //                monthName = "آبان";
    //                break;
    //            case 9:
    //                monthName = "آذر";
    //                break;
    //            case 10:
    //                monthName = "دی";
    //                break;
    //            case 12:
    //                monthName = "بهمن";
    //                break;
    //            case 13:
    //                monthName = "اسفند";
    //                break;
    //        }

    //        var xday = p.GetDayOfMonth(dt).ToString();
    //        if (xday.Length == 1)
    //        {
    //            xday = "0" + xday;
    //        }
    //        return xday + ' ' + monthName + ' ' + xyear;
    //    }
    //    catch (Exception)
    //    {
    //        return "نامعین";
    //    }
    //}

    ///// <summary>
    ///// نمایش نام ماه بجای عدد ماه  به همراه ساعت کامل
    ///// </summary>
    ///// <param name="d"></param>
    ///// <returns>12 شهریور 1400 -12:35:39</returns>
    //public static string ToPersianDateTimeMonthName(this object d)
    //{
    //    try
    //    {
    //        var date = d.ToString();
    //        if (string.IsNullOrEmpty(date))
    //            return string.Empty;
    //        var eDate = Convert.ToDateTime(d);
    //        var year = eDate.Year;
    //        var month = eDate.Month;
    //        var day = eDate.Day;
    //        var p = new PersianCalendar();
    //        var dt = new DateTime(year, month, day);
    //        var xyear = p.GetYear(dt).ToString();
    //        var xmonth = p.GetMonth(dt);
    //        var monthName = "";
    //        switch (xmonth)
    //        {
    //            case 1:
    //                monthName = "فروردین";
    //                break;
    //            case 2:
    //                monthName = "اردیبشهت";
    //                break;
    //            case 3:
    //                monthName = "خرداد";
    //                break;
    //            case 4:
    //                monthName = "تیر";
    //                break;
    //            case 5:
    //                monthName = "مرداد";
    //                break;
    //            case 6:
    //                monthName = "شهریور";
    //                break;
    //            case 7:
    //                monthName = "مهر";
    //                break;
    //            case 8:
    //                monthName = "آبان";
    //                break;
    //            case 9:
    //                monthName = "آذر";
    //                break;
    //            case 10:
    //                monthName = "دی";
    //                break;
    //            case 12:
    //                monthName = "بهمن";
    //                break;
    //            case 13:
    //                monthName = "اسفند";
    //                break;
    //        }

    //        var xday = p.GetDayOfMonth(dt).ToString();
    //        if (xday.Length == 1)
    //        {
    //            xday = "0" + xday;
    //        }
    //        return xday + ' ' + monthName + ' ' + xyear + "-" +
    //               Convert.ToDateTime(eDate).ToString("HH:mm:ss");
    //    }
    //    catch (Exception)
    //    {
    //        return "نامعین";
    //    }
    //}

    ///// <summary>
    ///// بازگرداندن چند وقت پیش
    ///// </summary>
    ///// <param name="d"></param>
    ///// <returns>دقایقی پیش</returns>
    //public static string ToPersianTextDate(this object d)
    //{

    //    if (d == null)
    //        return "";

    //    var dd = d.ToString();

    //    if (string.IsNullOrEmpty(dd))
    //        return "";

    //    var date = d.ToDateTime();
    //    var dt = DateTime.Now;
    //    var diff = dt.Subtract(date);
    //    if (diff.TotalMinutes < 60)
    //        return "دقایقی پیش";
    //    if (diff.TotalMinutes < 120)
    //        return "یک ساعت پیش";
    //    if (diff.TotalMinutes < 180)
    //        return "دو ساعت پیش";
    //    var days = diff.TotalDays;
    //    if (days < 1)
    //        return "امروز";
    //    if (days < 2)
    //        return "دیروز";
    //    if (days < 7)
    //        return Math.Round(days).ToInt() + " روز پیش";
    //    if (days < 14)
    //        return "هفته پیش";
    //    if (days < 21)
    //        return "دوهفته پیش";
    //    if (days < 28)
    //        return "سه هفته پیش";
    //    if (days < 30)
    //        return "چهارهفته پیش";
    //    if (days < 60)
    //        return " یک ماه پیش";
    //    if (days < 360)
    //        return Math.Round(days / 30).ToInt() + " ماه پیش";
    //    if (days < 720)
    //        return " یک سال پیش";
    //    return d.ToPersianDateTimeMonthName();
    //}

    /// <summary>
    /// تاریخ شمسی (yyyy/MM/dd) یا میلادی ISO. مقدار نامعتبر خطای <see cref="InvalidDateException"/> می‌دهد
    /// (قبلاً بی‌صدا «اکنون» برمی‌گشت؛ مثلاً اشتباه تایپی در تاریخ پایان، نظرسنجی را همان لحظه می‌بست).
    /// </summary>
    public static DateTime ToDateTime(this object s)
    {
        var raw = s?.ToString()?.Trim() ?? string.Empty;
        var parsed = ParseFlexible(raw);
        return parsed ?? throw new InvalidDateException(raw);
    }

    /// <summary>yyyy/MM/dd شمسی (سال کمتر از ۱۷۰۰) یا میلادی، و ISO؛ ارقام فارسی پشتیبانی می‌شود</summary>
    public static DateTime? ParseFlexible(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var latin = new string(raw.Trim().Select(c =>
            c is >= '۰' and <= '۹' ? (char)('0' + (c - '۰')) :
            c is >= '٠' and <= '٩' ? (char)('0' + (c - '٠')) : c).ToArray());

        var m = System.Text.RegularExpressions.Regex.Match(latin, @"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?");
        if (m.Success)
        {
            int y = int.Parse(m.Groups[1].Value), mo = int.Parse(m.Groups[2].Value), d = int.Parse(m.Groups[3].Value);
            int h = m.Groups[4].Success ? int.Parse(m.Groups[4].Value) : 0;
            int mi = m.Groups[5].Success ? int.Parse(m.Groups[5].Value) : 0;
            int sec = m.Groups[6].Success ? int.Parse(m.Groups[6].Value) : 0;
            try
            {
                return y < 1700
                    ? new PersianCalendar().ToDateTime(y, mo, d, h, mi, sec, 0)
                    : new DateTime(y, mo, d, h, mi, sec);
            }
            catch (ArgumentOutOfRangeException) { return null; }
        }

        return DateTime.TryParse(latin, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dt) ? dt : null;
    }
    public static DateTime? ToDateTimeNull(this object s) => ParseFlexible(s?.ToString());
}

/// <summary>تاریخ ورودی کاربر نامعتبر است (پیام قابل نمایش به کاربر)</summary>
public sealed class InvalidDateException(string value) : FormatException($"تاریخ «{value}» معتبر نیست.");
