namespace MeetingManagement.Application.Contracts.Setting;

public static class MeetingSettingKeys
{
    public const string AutoFinalizeEnabled = "Meeting.AutoFinalize.Enabled";
    public const string AutoFinalizeAfterChairSignDays = "Meeting.AutoFinalize.AfterChairSignDays";
    public const string CompletedStatusId = "Meeting.Status.CompletedId";

    public const string UndeterminedEnabled = "Meeting.Undetermined.Enabled";
    public const string UndeterminedAfterMonthsNoActivity = "Meeting.Undetermined.AfterMonthsNoActivity";
    public const string UndeterminedStatusId = "Meeting.Status.UndeterminedId";

    public const string BoardCategoryGuid = "Meeting.Category.BoardGuid";
    public const string TradeCommissionCategoryGuid = "Meeting.Category.TradeCommissionGuid";
    public const string BoardSecretaryPositionGuid = "Meeting.Board.SecretaryPositionGuid";
    public const string BoardPositionGuid = "Meeting.Board.UserGuid";
}