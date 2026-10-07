using ClosedXML.Excel;
using SurveyManagement.Infrastructure.Query.Contract.Response;

namespace SurveyManagement.Presentation.Api.Services;

public interface IResponseExcelExportService
{
    byte[] GenerateExcel(ResponseMatrixDto matrix, List<string>? selectedColumns = null);
}

public class ResponseExcelExportService : IResponseExcelExportService
{
    private static readonly XLColor HeaderBg = XLColor.FromHtml("#4F46E5");
    private static readonly XLColor StripeBg = XLColor.FromHtml("#F8FAFC");
    private static readonly XLColor BorderColor = XLColor.FromHtml("#E2E8F0");

    private record ColumnDef(string Key, string Header, Func<MatrixResponseRowDto, int, object> ValueGetter);

    public byte[] GenerateExcel(ResponseMatrixDto matrix, List<string>? selectedColumns = null)
    {
        var orderedQuestions = matrix.Questions.OrderBy(q => q.OrderIndex).ToList();
        var allColumns = BuildAllColumns(orderedQuestions);

        List<ColumnDef> columns;
        if (selectedColumns != null && selectedColumns.Count > 0)
        {
            columns = selectedColumns
                .Select(key => allColumns.FirstOrDefault(c => c.Key == key))
                .Where(c => c != null)
                .Select(c => c!)
                .ToList();

            if (columns.Count == 0) columns = allColumns;
        }
        else
        {
            columns = allColumns;
        }

        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add(TrimSheetName(matrix.SurveyTitle));
        sheet.RightToLeft = true;
        sheet.PageSetup.PageOrientation = XLPageOrientation.Landscape;

        var totalCols = columns.Count;

        sheet.Cell(1, 1).Value = matrix.SurveyTitle;
        sheet.Range(1, 1, 1, Math.Max(totalCols, 1)).Merge();
        sheet.Cell(1, 1).Style.Font.Bold = true;
        sheet.Cell(1, 1).Style.Font.FontSize = 14;
        sheet.Cell(1, 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#EEF2FF");
        sheet.Cell(1, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        sheet.Row(1).Height = 32;

        sheet.Cell(2, 1).Value = $"تعداد پاسخ‌ها: {matrix.Rows.Count}   |   تاریخ تولید گزارش: {DateTime.Now:yyyy/MM/dd HH:mm}";
        sheet.Range(2, 1, 2, Math.Max(totalCols, 1)).Merge();
        sheet.Cell(2, 1).Style.Font.FontSize = 10;
        sheet.Cell(2, 1).Style.Font.FontColor = XLColor.FromHtml("#64748B");
        sheet.Cell(2, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        sheet.Cell(3, 1).Value = "⚠ این گزارش حاوی داده‌های دموگرافیک دقیق است. دسترسی و اشتراک‌گذاری آن باید محدود به افراد مجاز باشد.";
        sheet.Range(3, 1, 3, Math.Max(totalCols, 1)).Merge();
        sheet.Cell(3, 1).Style.Font.FontSize = 9;
        sheet.Cell(3, 1).Style.Font.FontColor = XLColor.FromHtml("#B45309");
        sheet.Cell(3, 1).Style.Font.Italic = true;
        sheet.Cell(3, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        const int headerRow = 4;
        for (int i = 0; i < columns.Count; i++)
            sheet.Cell(headerRow, i + 1).Value = columns[i].Header;

        var headerRange = sheet.Range(headerRow, 1, headerRow, Math.Max(totalCols, 1));
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Font.FontColor = XLColor.White;
        headerRange.Style.Fill.BackgroundColor = HeaderBg;
        headerRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        headerRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        headerRange.Style.Alignment.WrapText = true;
        sheet.Row(headerRow).Height = 34;

        var rowIndex = headerRow + 1;
        var rowNumber = 1;

        foreach (var row in matrix.Rows)
        {
            for (int i = 0; i < columns.Count; i++)
            {
                var value = columns[i].ValueGetter(row, rowNumber);
                var cell = sheet.Cell(rowIndex, i + 1);

                if (value is int intVal) cell.Value = intVal;
                else cell.Value = value?.ToString() ?? "-";
            }

            if (rowNumber % 2 == 0)
                sheet.Range(rowIndex, 1, rowIndex, Math.Max(totalCols, 1)).Style.Fill.BackgroundColor = StripeBg;

            rowIndex++;
            rowNumber++;
        }

        var lastRow = rowIndex - 1;
        var lastCol = Math.Max(totalCols, 1);

        if (lastRow >= headerRow && totalCols > 0)
        {
            var dataRange = sheet.Range(headerRow, 1, lastRow, lastCol);
            dataRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            dataRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            dataRange.Style.Border.OutsideBorderColor = BorderColor;
            dataRange.Style.Border.InsideBorderColor = BorderColor;
            dataRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;

            sheet.Range(headerRow, 1, lastRow, lastCol).SetAutoFilter();
        }

        sheet.SheetView.FreezeRows(headerRow);
        if (columns.Any(c => c.Key == "index"))
            sheet.SheetView.FreezeColumns(Math.Min(1, columns.Count));

        sheet.Columns().AdjustToContents();
        foreach (var column in sheet.ColumnsUsed())
        {
            if (column.Width > 55) column.Width = 55;
            if (column.Width < 10) column.Width = 10;
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private List<ColumnDef> BuildAllColumns(List<MatrixQuestionColumnDto> questions)
    {
        var list = new List<ColumnDef>
        {
            new("index", "ردیف", (row, idx) => idx),
            new("age", "سن", (row, idx) => row.Age?.ToString() ?? "-"),
            new("gender", "جنسیت", (row, idx) => row.Gender ?? "-"),
            new("office", "امور", (row, idx) => row.Office ?? "-"),
            new("employmentType", "نوع استخدام", (row, idx) => row.EmploymentType ?? "-"),
            new("education", "مدرک تحصیلی", (row, idx) => row.Education ?? "-"),
            new("shiftWorker", "نوبت‌کاری", (row, idx) => row.ShiftWorker ?? "-"),
            new("experienceYears", "سابقه (سال)", (row, idx) => row.ExperienceYears?.ToString() ?? "-"),
            new("organizationalGrade", "گرید سازمانی", (row, idx) => row.OrganizationalGrade ?? "-"),
            new("organizationalGroup", "گروه سازمانی", (row, idx) => row.OrganizationalGroup ?? "-"),
            new("startedAt", "تاریخ شروع", (row, idx) => row.StartedAt ?? "-"),
            new("completedAt", "تاریخ اتمام", (row, idx) => row.CompletedAt ?? "-"),
            new("timeSpent", "زمان صرف‌شده", (row, idx) => row.TimeSpentText ?? "-"),
        };

        foreach (var q in questions)
        {
            var key = q.QuestionGuid.ToString();
            list.Add(new ColumnDef(
                key,
                q.QuestionText + (q.IsRequired ? " *" : ""),
                (row, idx) => row.Answers.TryGetValue(key, out var v) ? v : "-"));
        }

        return list;
    }

    private string TrimSheetName(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "پاسخ‌ها";
        var invalid = new[] { '\\', '/', '?', '*', '[', ']', ':' };
        var cleaned = new string(name.Where(c => !invalid.Contains(c)).ToArray());
        return cleaned.Length > 31 ? cleaned[..31] : cleaned;
    }
}

