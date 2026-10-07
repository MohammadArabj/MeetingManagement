using Epc.Application.Command;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace MeetingManagement.Application.Contracts.Category;
public class SetCategoryPermissionDto : ICommand
{
    public int Id { get; set; }
    public bool ViewAll { get; set; }
}
