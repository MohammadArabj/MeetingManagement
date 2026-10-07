using System;

namespace MeetingManagement.Application.Contracts.Category;

public class EditCategoryDto:CreateCategoryDto
{
    public Guid Guid { get; set; }
}