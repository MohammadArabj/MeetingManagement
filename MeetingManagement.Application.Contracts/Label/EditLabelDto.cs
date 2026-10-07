using System;

namespace MeetingManagement.Application.Contracts.Label;

public class EditLabelDto:CreateLabelDto
{
    public Guid Guid { get; set; }
}