namespace SurveyManagement.Domain.ParticipantAgg;

// نه Auditable و نه چیزی که ردی از "چه کسی چه پاسخی داد" داشته باشه
public class SurveyParticipant 
{
    public SurveyParticipant() { } // EF

    public SurveyParticipant(long surveyId, Guid userGuid)
    {
        SurveyId = surveyId;
        UserGuid = userGuid;
        ParticipatedAt = DateTime.Now;
    }

    public long SurveyId { get; private set; }
    public Guid UserGuid { get; private set; }
    public DateTime ParticipatedAt { get; private set; }
}

