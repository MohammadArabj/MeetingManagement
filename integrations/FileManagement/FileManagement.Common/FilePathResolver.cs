using System;

namespace FileManagement.Common
{
    public interface IFilePathResolver
    {
        /// <summary>مسیر ذخیره‌شده‌ی پیوست (files/…) → مسیر فیزیکی؛ مسیر خارج از ریشه‌های مجاز خطا می‌دهد.</summary>
        string ToPhysicalPath(string relativePath);
    }

    /// <summary>سازگاری با کدهای قدیمی؛ منطق اصلی در <see cref="FileStorageLocations"/> است.</summary>
    public class FilePathResolver(FileStorageLocations locations) : IFilePathResolver
    {
        public string ToPhysicalPath(string relativePath)
            => locations.ResolveStoredFile(relativePath)
               ?? locations.ExpectedPhysicalPath(relativePath)
               ?? throw new InvalidOperationException("Invalid path traversal.");
    }
}
