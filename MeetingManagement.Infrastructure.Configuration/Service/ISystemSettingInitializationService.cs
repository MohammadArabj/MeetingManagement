using System.Threading.Tasks;

namespace MeetingManagement.Infrastructure.Configuration.Service;

public interface ISystemSettingInitializationService
{
    Task InitializeAsync();
    Task SeedDefaultSettingsAsync();
}
