using System;

namespace MeetingManagement.Application.Contracts.Role;

public class EditRoleDto:CreateRoleDto
{
    public Guid Guid { get; set; }
}