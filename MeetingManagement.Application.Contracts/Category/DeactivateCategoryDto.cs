using System;
using Epc.Application.Command;

namespace MeetingManagement.Application.Contracts.Category;

public class DeactivateCategoryDto(Guid guid) : ICommand
{
    public Guid Guid { get; set; } = guid;
}