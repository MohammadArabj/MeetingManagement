//// Excel Export Service Interface & Implementation

//using System.ComponentModel;
//using OfficeOpenXml;
//using OfficeOpenXml.Style;
//using System.Drawing;
//using System.Net;
//using System.Reflection.Metadata;
//using OfficeOpenXml.Core.ExcelPackage;

//namespace MeetingManagement.Infrastructure.Services
//{
//    public interface IExcelExportService
//    {
//        Task<byte[]> ExportToExcel<T>(List<T> data, Dictionary<string, string> headers, string sheetName);
//        Task<byte[]> ExportMultiSheetToExcel(Dictionary<string, object> sheetsData, Dictionary<string, Dictionary<string, string>> sheetsHeaders, string workbookName);
//    }

//    public class ExcelExportService : IExcelExportService
//    {
//        public async Task<byte[]> ExportToExcel<T>(List<T> data, Dictionary<string, string> headers, string sheetName)
//        {
//            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

//            using var package = new ExcelPackage();
//            var worksheet = package.Workbook.Worksheets.Add(sheetName);

//            // تنظیم راست به چپ
//            worksheet.View.RightToLeft = true;
//            worksheet.PrinterSettings.Orientation = eOrientation.Landscape;

//            // اضافه کردن هدر
//            var headerRow = 1;
//            var col = 1;

//            foreach (var header in headers.Values)
//            {
//                var cell = worksheet.Cells[headerRow, col];
//                cell.Value = header;

//                // استایل هدر
//                cell.Style.Font.Bold = true;
//                cell.Style.Fill.PatternType = ExcelFillStyle.Solid;
//                cell.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(79, 70, 229)); // indigo-600
//                cell.Style.Font.Color.SetColor(Color.White);
//                cell.Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
//                cell.Style.VerticalAlignment = ExcelVerticalAlignment.Center;
//                cell.Style.Border.BorderAround(ExcelBorderStyle.Thin);

//                col++;
//            }

//            // اضافه کردن داده‌ها
//            var dataStartRow = 2;
//            if (data != null && data.Any())
//            {
//                var properties = typeof(T).GetProperties()
//                    .Where(p => headers.ContainsKey(p.Name))
//                    .OrderBy(p => headers.Keys.ToList().IndexOf(p.Name))
//                    .ToArray();

//                for (int i = 0; i < data.Count; i++)
//                {
//                    col = 1;
//                    var item = data[i];

//                    foreach (var prop in properties)
//                    {
//                        var cell = worksheet.Cells[dataStartRow + i, col];
//                        var value = prop.GetValue(item);

//                        if (value != null)
//                        {
//                            if (prop.PropertyType == typeof(DateTime) || prop.PropertyType == typeof(DateTime?))
//                            {
//                                cell.Value = ((DateTime)value).ToString("yyyy/MM/dd");
//                            }
//                            else if (prop.PropertyType.IsEnum)
//                            {
//                                cell.Value = GetEnumDisplayName(value);
//                            }
//                            else
//                            {
//                                cell.Value = value.ToString();
//                            }
//                        }

//                        // استایل سلول داده
//                        cell.Style.Border.BorderAround(ExcelBorderStyle.Thin);
//                        cell.Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;

//                        // رنگ متناوب برای ردیف‌ها
//                        if (i % 2 == 0)
//                        {
//                            cell.Style.Fill.PatternType = ExcelFillStyle.Solid;
//                            cell.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(248, 250, 252)); // gray-50
//                        }

//                        col++;
//                    }
//                }
//            }

//            // تنظیم عرض ستون‌ها
//            worksheet.Cells[worksheet.Dimension.Address].AutoFitColumns();

//            // حداقل عرض برای خوانایی بهتر
//            for (int i = 1; i <= headers.Count; i++)
//            {
//                if (worksheet.Column(i).Width < 15)
//                    worksheet.Column(i).Width = 15;
//            }

//            return await Task.FromResult(package.GetAsByteArray());
//        }

//        public async Task<byte[]> ExportMultiSheetToExcel(Dictionary<string, object> sheetsData, Dictionary<string, Dictionary<string, string>> sheetsHeaders, string workbookName)
//        {
//            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

//            using var package = new ExcelPackage();

//            foreach (var sheetData in sheetsData)
//            {
//                var sheetName = sheetData.Key;
//                var data = sheetData.Value;

//                var worksheet = package.Workbook.Worksheets.Add(sheetName);
//                worksheet.View.RightToLeft = true;

//                if (sheetsHeaders.TryGetValue(sheetName, out var headers) && headers != null)
//                {
//                    // اضافه کردن هدر
//                    var headerRow = 1;
//                    var col = 1;

//                    foreach (var header in headers.Values)
//                    {
//                        var cell = worksheet.Cells[headerRow, col];
//                        cell.Value = header;

//                        // استایل هدر
//                        cell.Style.Font.Bold = true;
//                        cell.Style.Fill.PatternType = ExcelFillStyle.Solid;
//                        cell.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(79, 70, 229));
//                        cell.Style.Font.Color.SetColor(Color.White);
//                        cell.Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
//                        cell.Style.Border.BorderAround(ExcelBorderStyle.Thin);

//                        col++;
//                    }

//                    // اضافه کردن داده‌ها
//                    if (data is IEnumerable<object> dataList)
//                    {
//                        var dataArray = dataList.ToArray();
//                        var dataStartRow = 2;

//                        for (int i = 0; i < dataArray.Length; i++)
//                        {
//                            col = 1;
//                            var item = dataArray[i];
//                            var properties = item.GetType().GetProperties()
//                                .Where(p => headers.ContainsKey(p.Name))
//                                .OrderBy(p => headers.Keys.ToList().IndexOf(p.Name))
//                                .ToArray();

//                            foreach (var prop in properties)
//                            {
//                                var cell = worksheet.Cells[dataStartRow + i, col];
//                                var value = prop.GetValue(item);

//                                if (value != null)
//                                {
//                                    cell.Value = value.ToString();
//                                }

//                                cell.Style.Border.BorderAround(ExcelBorderStyle.Thin);
//                                cell.Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;

//                                if (i % 2 == 0)
//                                {
//                                    cell.Style.Fill.PatternType = ExcelFillStyle.Solid;
//                                    cell.Style.Fill.BackgroundColor.SetColor(Color.FromArgb(248, 250, 252));
//                                }

//                                col++;
//                            }
//                        }
//                    }
//                }
//                else
//                {
//                    // برای شیت‌های بدون هدر (مثل خلاصه)
//                    if (data is IEnumerable<object> simpleData)
//                    {
//                        var row = 1;
//                        foreach (var item in simpleData)
//                        {
//                            var props = item.GetType().GetProperties();
//                            if (props.Length >= 2)
//                            {
//                                worksheet.Cells[row, 1].Value = props[0].GetValue(item)?.ToString();
//                                worksheet.Cells[row, 2].Value = props[1].GetValue(item)?.ToString();

//                                worksheet.Cells[row, 1].Style.Font.Bold = true;
//                                worksheet.Cells[row, 1, row, 2].Style.Border.BorderAround(ExcelBorderStyle.Thin);
//                            }
//                            row++;
//                        }
//                    }
//                }

//                worksheet.Cells[worksheet.Dimension.Address].AutoFitColumns();
//            }

//            return await Task.FromResult(package.GetAsByteArray());
//        }

//        private string GetEnumDisplayName(object enumValue)
//        {
//            var type = enumValue.GetType();
//            var name = Enum.GetName(type, enumValue);
//            if (name == null) return enumValue.ToString();

//            var field = type.GetField(name);
//            var attribute = field?.GetCustomAttributes(typeof(System.ComponentModel.DataAnnotations.DisplayAttribute), false)
//                .FirstOrDefault() as System.ComponentModel.DataAnnotations.DisplayAttribute;

//            return attribute?.Name ?? enumValue.ToString();
//        }
//    }
//}

//// PDF Export Service Interface & Implementation
//using iText.Kernel.Pdf;
//using iText.Layout;
//using iText.Layout.Element;
//using iText.Layout.Properties;
//using iText.Kernel.Font;
//using iText.IO.Font;

//namespace MeetingManagement.Infrastructure.Services
//{
//    public interface IPdfExportService
//    {
//        Task<byte[]> GenerateReportPdf(string title, string subtitle, List<string> headers, List<List<string>> data, string summaryInfo = null);
//    }

//    public class PdfExportService : IPdfExportService
//    {
//        public async Task<byte[]> GenerateReportPdf(string title, string subtitle, List<string> headers, List<List<string>> data, string summaryInfo = null)
//        {
//            using var stream = new MemoryStream();
//            using var writer = new PdfWriter(stream);
//            using var pdf = new PdfDocument(writer);
//            using var document = new Document(pdf);

//            try
//            {
//                // تنظیم فونت فارسی
//                var fontPath = Path.Combine("wwwroot", "fonts", "Vazir-Regular.ttf"); // باید فونت فارسی اضافه کنید
//                PdfFont font;

//                if (WebRequestMethods.File.Exists(fontPath))
//                {
//                    font = PdfFontFactory.CreateFont(fontPath, PdfEncodings.IDENTITY_H);
//                }
//                else
//                {
//                    font = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);
//                }

//                document.SetFont(font);

//                // تنظیم راست به چپ
//                document.SetProperty(Property.BASE_DIRECTION, BaseDirection.RIGHT_TO_LEFT);
//                document.SetProperty(Property.TEXT_ALIGNMENT, TextAlignment.RIGHT);

//                // عنوان اصلی
//                var titleParagraph = new Paragraph(title)
//                    .SetFontSize(18)
//                    .SetBold()
//                    .SetTextAlignment(TextAlignment.CENTER)
//                    .SetMarginBottom(10);
//                document.Add(titleParagraph);

//                // زیرعنوان (فیلترها)
//                if (!string.IsNullOrEmpty(subtitle))
//                {
//                    var subtitleParagraph = new Paragraph(subtitle)
//                        .SetFontSize(12)
//                        .SetTextAlignment(TextAlignment.CENTER)
//                        .SetMarginBottom(15);
//                    document.Add(subtitleParagraph);
//                }

//                // اطلاعات خلاصه
//                if (!string.IsNullOrEmpty(summaryInfo))
//                {
//                    var summaryParagraph = new Paragraph(summaryInfo)
//                        .SetFontSize(12)
//                        .SetBold()
//                        .SetTextAlignment(TextAlignment.CENTER)
//                        .SetMarginBottom(20);
//                    document.Add(summaryParagraph);
//                }

//                // ایجاد جدول
//                if (headers != null && headers.Any() && data != null && data.Any())
//                {
//                    var table = new Table(headers.Count)
//                        .SetWidth(UnitValue.CreatePercentValue(100))
//                        .SetMarginTop(20);

//                    // اضافه کردن هدرها
//                    foreach (var header in headers)
//                    {
//                        var headerCell = new Cell()
//                            .Add(new Paragraph(header))
//                            .SetBackgroundColor(iText.Kernel.Colors.ColorConstants.LIGHT_GRAY)
//                            .SetBold()
//                            .SetTextAlignment(TextAlignment.CENTER)
//                            .SetPadding(8);
//                        table.AddHeaderCell(headerCell);
//                    }

//                    // اضافه کردن داده‌ها
//                    foreach (var row in data)
//                    {
//                        foreach (var cell in row)
//                        {
//                            var dataCell = new Cell()
//                                .Add(new Paragraph(cell ?? ""))
//                                .SetTextAlignment(TextAlignment.CENTER)
//                                .SetPadding(6);
//                            table.AddCell(dataCell);
//                        }
//                    }

//                    document.Add(table);
//                }

//                // اطلاعات فوتر
//                var footer = new Paragraph($"تاریخ تولید گزارش: {DateTime.Now:yyyy/MM/dd HH:mm}")
//                    .SetFontSize(10)
//                    .SetTextAlignment(TextAlignment.LEFT)
//                    .SetMarginTop(30);
//                document.Add(footer);

//                document.Close();
//            }
//            catch (Exception ex)
//            {
//                // در صورت خطا، یک PDF ساده تولید کنید
//                document.Add(new Paragraph($"خطا در تولید گزارش: {ex.Message}"));
//                document.Close();
//            }

//            return await Task.FromResult(stream.ToArray());
//        }
//    }
//}