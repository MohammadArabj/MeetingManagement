using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Category;

public class ActivateCategoryDto(Guid guid) : ICommand
{
    public Guid Guid { get; set; } = guid;
}