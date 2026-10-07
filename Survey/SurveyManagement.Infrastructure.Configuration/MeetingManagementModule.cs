using System;
using System.Text;
using Autofac;
using Autofac.Extras.DynamicProxy;
using Epc.Application.Command;
using Epc.Application.Query;
using Epc.Autofac;
using Epc.Domain;
using Microsoft.EntityFrameworkCore;
using SurveyManagement.Application;
using SurveyManagement.Application.Facades;
using SurveyManagement.Domain.Shared.Acls.UserManagement;
using SurveyManagement.Domain.SurveyAgg.Services;
using SurveyManagement.Infrastructure.Acl;
using SurveyManagement.Infrastructure.Persistence;
using SurveyManagement.Infrastructure.Persistence.Repository;
using SurveyManagement.Infrastructure.Query;
using SurveyManagement.Presentation.Facade.Query;

namespace Fle.Infrastructure.Configuration;

public class SurveyManagementModule(string connectionString) : Module
{
    private string ConnectionString { get; set; } = connectionString;

    protected override void Load(ContainerBuilder builder)
    {
        builder.RegisterType<UserManagementAclService>().As<IUserManagementAclService>();

        var repositoryAssembly = typeof(SurveyRepository).Assembly;
        builder.RegisterAssemblyTypes(repositoryAssembly)
            .AsClosedTypesOf(typeof(IRepository<,>))
            .InstancePerLifetimeScope();

        var domainServiceAssembly = typeof(SurveyService).Assembly;
        builder.RegisterAssemblyTypes(domainServiceAssembly)
            .Where(t => t.Name.EndsWith("Service"))
            .AsImplementedInterfaces();

        var commandHandlersAssembly = typeof(SurveyCommandHandler).Assembly;
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
        var queryHandlerAssembly = typeof(SurveyQueryHandler).Assembly;
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
                var optionsBuilder = new DbContextOptionsBuilder<SurveyManagementCommandContext>();
                optionsBuilder.UseSqlServer(ConnectionString);
                return new SurveyManagementCommandContext(optionsBuilder.Options);
            })
            .As<DbContext>()
            .As<SurveyManagementCommandContext>()
            .InstancePerLifetimeScope();

        builder.Register(_ =>
            {
                var optionsBuilder = new DbContextOptionsBuilder<SurveyManagementQueryContext>();
                optionsBuilder.UseSqlServer(ConnectionString);
                return new SurveyManagementQueryContext(optionsBuilder.Options);
            })
            .As<SurveyManagementQueryContext>()
            .InstancePerDependency();
        builder.Register(_ =>
        {
            var optionsBuilder = new DbContextOptionsBuilder<LegacyResponseReadContext>();
            optionsBuilder.UseSqlServer(ConnectionString);
            return new LegacyResponseReadContext(optionsBuilder.Options);
        })
           .As<LegacyResponseReadContext>()
           .InstancePerDependency();

        var facadeAssembly = typeof(SurveyCommandFacade).Assembly;
        builder.RegisterAssemblyTypes(facadeAssembly)
            .Where(t => t.Name.EndsWith("CommandFacade"))
            .InstancePerLifetimeScope()
            .EnableInterfaceInterceptors()
            .InterceptedBy(typeof(SecurityInterceptor))
            .AsImplementedInterfaces();

        var facadeQueryAssembly = typeof(SurveyQueryFacade).Assembly;
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