using System;
using MeetingManagement.Common.Extensions;

namespace MeetingManagement.Infrastructure.Query.Contracts.Resolution;

public record ResolutionDetailReportRequestDto(string? FromDate, string? ToDate, string? MeetingNumber, string? ResolutionNumber, string? ResolutionTitle, Guid? DepartmentGuid, ActionStatus? ActionStatus, AssignmentResult? AssignmentResult,Guid? ActorPositionGuid, Guid? UserGuid, Guid? PositionGuid, Guid? PositionMainGuid, string? Text, string? Title, string? MeetingTitle, string? Decisions, string? Description, string? Documents, Guid? CategoryGuid, string? MeetingDate, string? ResolutionDate);
