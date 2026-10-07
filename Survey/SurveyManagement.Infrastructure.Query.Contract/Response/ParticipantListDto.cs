using System;
using System.Collections.Generic;
using System.Text;
namespace SurveyManagement.Infrastructure.Query.Contract.Response;

public record GetSurveyParticipantsRequest(Guid SurveyGuid);

public class ParticipantListDto
{
    public string PersonnelCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
}

public class ParticipantsReportDto
{
    public string SurveyTitle { get; set; } = string.Empty;
    public List<ParticipantListDto> Participants { get; set; } = new();
}
