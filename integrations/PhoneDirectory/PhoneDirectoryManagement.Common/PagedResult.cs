using System;
using System.Collections.Generic;
using System.Text;

namespace PhoneDirectoryManagement.Common
{
    public class PagedResult<T>
    {
        public List<T> Items { get; set; } = [];
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }
}
