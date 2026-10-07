using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Category;

public class CreateCategoryDto:ICommand
{
    public string Title { get; set; }
    public Guid? Guid { get; set; }
    public string NumberFormat { get; set; }
    public int StartNumber { get; set; }
    public int Step { get; set; }
    public bool ViewAll { get; set; }
    public bool ResetNumberYearly { get; set; }
}