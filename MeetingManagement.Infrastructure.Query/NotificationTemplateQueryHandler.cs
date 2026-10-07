using Epc.Application.Query;
using Epc.Company.Query;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Query.Contracts.NotificationTemplate;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Query;

//public class NotificationTemplateListQueryHandler(MeetingManagementQueryContext context)
//    : IQueryHandlerAsync<Result<List<NotificationTemplateDto>>>
//{
//    public async Task<Result<List<NotificationTemplateDto>>> Handle()
//    {
//        var result = await context.NotificationTemplates
//            .Select(x => new NotificationTemplateDto
//            {
//                Id = x.Id,
//                Title = x.Title,
//                Channel = x.Channel,
//                Content = x.Content
//            })
//            .ToListAsync();

//        return Result<List<NotificationTemplateDto>>.Success(result);
//    }
//}