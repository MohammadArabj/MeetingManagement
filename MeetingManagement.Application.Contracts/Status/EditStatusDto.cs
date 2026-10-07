using System;

namespace MeetingManagement.Application.Contracts.Status;

public class EditStatusDto: CreateStatusDto
{
    public Guid Guid { get; set; }
}