using System;
using System.Text;
using Autofac;
using Autofac.Extras.DynamicProxy;
using Epc.Application.Command;
using Epc.Application.Query;
using Epc.Autofac;
using Epc.Domain;
using MeetingManagement.Application;
using MeetingManagement.Application.Services;
using MeetingManagement.Domain.Shared.Access;
using MeetingManagement.Domain.Shared.Notifications;
using MeetingManagement.Infrastructure.Configuration.Notifications;
using MeetingManagement.Infrastructure.Configuration.Services;
using MeetingManagement.Domain.CategoryAgg.Service;
using MeetingManagement.Domain.Shared.Acls.UserManagement;
using MeetingManagement.Infrastructure.Acl;
using MeetingManagement.Infrastructure.Persistence;
using MeetingManagement.Infrastructure.Persistence.Repository;
using MeetingManagement.Infrastructure.Query;
using MeetingManagement.Presentation.Facade.Command;
using MeetingManagement.Presentation.Facade.Query;
using Microsoft.EntityFrameworkCore;

namespace MeetingManagement.Infrastructure.Configuration;

public class MeetingManagementModule(string connectionString) : Module
{
    private string ConnectionString { get; set; } = connectionString;

    protected override void Load(ContainerBuilder builder)
    {
        builder.RegisterType<UserManagementAclService>().As<IUserManagementAclService>();

        // ═══════════════════════════════════════════════════════════
        // دسترسی، نقش‌ها و اطلاع‌رسانی (جدید)
        // ═══════════════════════════════════════════════════════════
        builder.RegisterType<CurrentUser>().As<ICurrentUser>().InstancePerLifetimeScope();
        builder.RegisterType<ActingIdentityResolver>().As<IActingIdentityResolver>().InstancePerLifetimeScope();
        builder.RegisterType<MeetingAccessService>().As<IMeetingAccessService>().InstancePerLifetimeScope();
        builder.RegisterType<MeetingRoleConfigService>().AsSelf().As<IMeetingRoleConfigService>().InstancePerLifetimeScope();
        builder.RegisterType<NotificationPublisher>().As<INotificationPublisher>().InstancePerLifetimeScope();
        builder.RegisterType<AssignmentPublication>().AsSelf().InstancePerLifetimeScope();
        builder.RegisterType<RealtimeNotifier>().As<IRealtimeNotifier>().InstancePerLifetimeScope();
        builder.RegisterType<NotificationAdminService>().AsSelf().InstancePerLifetimeScope();
        builder.RegisterType<HttpSmsSender>().As<ISmsSender>().InstancePerLifetimeScope();
        builder.RegisterType<ServiceTokenProvider>().As<IServiceTokenProvider>().SingleInstance();

        var repositoryAssembly = typeof(CategoryRepository).Assembly;
        builder.RegisterAssemblyTypes(repositoryAssembly)
            .AsClosedTypesOf(typeof(IRepository<,>))
            .InstancePerLifetimeScope();

        var domainServiceAssembly = typeof(CategoryService).Assembly;
        builder.RegisterAssemblyTypes(domainServiceAssembly)
            .Where(t => t.Name.EndsWith("Service"))
            .AsImplementedInterfaces();

        var commandHandlersAssembly = typeof(CategoryCommandHandler).Assembly;
        builder.RegisterAssemblyTypes(commandHandlersAssembly)
            .AsClosedTypesOf(typeof(ICommandHandler<>))
            .InstancePerLifetimeScope();

        builder.RegisterAssemblyTypes(commandHandlersAssembly)
            .AsClosedTypesOf(typeof(ICommandHandler<,>))
            .InstancePerLifetimeScope();
        builder.RegisterAssemblyTypes(commandHandlersAssembly)
            .AsClosedTypesOf(typeof(ICommandHandlerAsync<>))
            .InstancePerLifetimeScope();

        builder.RegisterAssemblyTypes(commandHandlersAssembly)
            .AsClosedTypesOf(typeof(ICommandHandlerAsync<,>))
            .InstancePerLifetimeScope();
        var queryHandlerAssembly = typeof(CategoryQueryHandler).Assembly;
        builder.RegisterAssemblyTypes(queryHandlerAssembly)
            .AsClosedTypesOf(typeof(IQueryHandler<>))
            .InstancePerDependency();

        builder.RegisterAssemblyTypes(queryHandlerAssembly)
            .AsClosedTypesOf(typeof(IQueryHandlerAsync<>))
            .InstancePerDependency();

        builder.RegisterAssemblyTypes(queryHandlerAssembly)
            .AsClosedTypesOf(typeof(IQueryHandler<,>))
            .InstancePerDependency();

        builder.RegisterAssemblyTypes(queryHandlerAssembly)
            .AsClosedTypesOf(typeof(IQueryHandlerAsync<,>))
            .InstancePerDependency();
        if (!ConnectionString.Contains("Server"))
            ConnectionString = Encoding.UTF8.GetString(Convert.FromBase64String(ConnectionString));
        builder.Register(_ =>
            {
                var optionsBuilder = new DbContextOptionsBuilder<MeetingManagementCommandContext>();
                optionsBuilder.UseSqlServer(ConnectionString);
                return new MeetingManagementCommandContext(optionsBuilder.Options);
            })
            .As<DbContext>()
            .As<MeetingManagementCommandContext>()
            .InstancePerLifetimeScope();

        builder.Register(_ =>
            {
                var optionsBuilder = new DbContextOptionsBuilder<MeetingManagementQueryContext>();
                optionsBuilder.UseSqlServer(ConnectionString);
                return new MeetingManagementQueryContext(optionsBuilder.Options);
            })
            .As<MeetingManagementQueryContext>()
            .InstancePerDependency();

        var facadeAssembly = typeof(CategoryCommandFacade).Assembly;
        builder.RegisterAssemblyTypes(facadeAssembly)
            .Where(t => t.Name.EndsWith("CommandFacade"))
            .InstancePerLifetimeScope()
            .EnableInterfaceInterceptors()
            .InterceptedBy(typeof(SecurityInterceptor))
            .AsImplementedInterfaces();

        var facadeQueryAssembly = typeof(CategoryQueryFacade).Assembly;
        builder.RegisterAssemblyTypes(facadeQueryAssembly)
            .Where(t => t.Name.EndsWith("QueryFacade"))
            .InstancePerLifetimeScope()
            .EnableInterfaceInterceptors()
            .InterceptedBy(typeof(SecurityInterceptor))
            .AsImplementedInterfaces();
        
        //var aclServiceAssembly = typeof(UserManagementAclService).Assembly;
        //builder.RegisterAssemblyTypes(aclServiceAssembly)
        //    .Where(t => t.Title.EndsWith("AclService"))
        //    .AsImplementedInterfaces()
        //    .InstancePerLifetimeScope();

        base.Load(builder);
    }
}