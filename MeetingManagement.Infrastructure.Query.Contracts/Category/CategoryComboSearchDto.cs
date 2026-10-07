using MeetingManagement.Common.Security;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Query.Contracts.Category;
    public class CategoryComboSearchDto
    {
        [CallerPosition]
        public Guid PositionGuid { get; set; }
        public bool ShowAll { get; set; }
    }
