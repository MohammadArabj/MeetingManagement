namespace SurveyManagement.Infrastructure.Query.Contract.Response;

public record GetUserResponseStatusRequest(Guid SurveyGuid, Guid UserGuid);