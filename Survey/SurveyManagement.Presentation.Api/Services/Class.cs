using ClosedXML.Excel;
using SurveyManagement.Infrastructure.Query.Contract.Response;

namespace SurveyManagement.Presentation.Api.Services;

public interface IParticipantExcelExportService
{
    byte[] GenerateExcel(string surveyTitle, List<ParticipantListDto> participants);
}

public class ParticipantExcelExportService : IParticipantExcelExportService
{
    public byte[] GenerateExcel(string surveyTitle, List<ParticipantListDto> participants)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("شرکت‌کنندگان");
        sheet.RightToLeft = true;

        sheet.Cell(1, 1).Value = $"لیست شرکت‌کنندگان — {surveyTitle}";
        sheet.Range(1, 1, 1, 3).Merge();
        sheet.Cell(1, 1).Style.Font.Bold = true;
        sheet.Cell(1, 1).Style.Font.FontSize = 14;
        sheet.Cell(1, 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#EEF2FF");
        sheet.Cell(1, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        sheet.Row(1).Height = 30;

        sheet.Cell(2, 1).Value = $"تعداد کل شرکت‌کنندگان: {participants.Count}   |   تاریخ تولید: {DateTime.Now:yyyy/MM/dd HH:mm}";
        sheet.Range(2, 1, 2, 3).Merge();
        sheet.Cell(2, 1).Style.Font.FontSize = 10;
        sheet.Cell(2, 1).Style.Font.FontColor = XLColor.FromHtml("#64748B");
        sheet.Cell(2, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        const int headerRow = 3;
        sheet.Cell(headerRow, 1).Value = "ردیف";
        sheet.Cell(headerRow, 2).Value = "کد پرسنلی";
        sheet.Cell(headerRow, 3).Value = "نام و نام خانوادگی";

        var headerRange = sheet.Range(headerRow, 1, headerRow, 3);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Font.FontColor = XLColor.White;
        headerRange.Style.Fill.BackgroundColor = XLColor.FromHtml("#4F46E5");
        headerRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        sheet.Row(headerRow).Height = 28;

        var row = headerRow + 1;
        var idx = 1;
        foreach (var p in participants)
        {
            sheet.Cell(row, 1).Value = idx;
            sheet.Cell(row, 2).Value = p.PersonnelCode;
            sheet.Cell(row, 3).Value = p.FullName;

            if (idx % 2 == 0)
                sheet.Range(row, 1, row, 3).Style.Fill.BackgroundColor = XLColor.FromHtml("#F8FAFC");

            row++;
            idx++;
        }

        if (participants.Count > 0)
        {
            var dataRange = sheet.Range(headerRow, 1, row - 1, 3);
            dataRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            dataRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            sheet.Range(headerRow, 1, row - 1, 3).SetAutoFilter();
        }

        sheet.SheetView.FreezeRows(headerRow);
        sheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}