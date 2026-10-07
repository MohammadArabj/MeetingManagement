using System;
using Epc.Application.Command;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Application.Contracts.File;

public class DeleteFileDto(long id):ICommand
{
    public long Id { get; set; } = id;
}