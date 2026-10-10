using Autofac;
using Autofac.Extras.DynamicProxy;
using Epc.Application.Command;
using Epc.Application.Query;
using Epc.Autofac;
using Epc.Domain;
using Microsoft.EntityFrameworkCore;
using PhoneDirectoryManagement.Application;
using PhoneDirectoryManagement.Domain.PhoneDirectoryAgg.Service;
using PhoneDirectoryManagement.Domain.Shared.Acls.UserManagement;
using PhoneDirectoryManagement.Infrastructure.Acl;
using PhoneDirectoryManagement.Infrastructure.Persistence;
using PhoneDirectoryManagement.Infrastructure.Persistence.Repository;
using PhoneDirectoryManagement.Infrastructure.Query;
using PhoneDirectoryManagement.Presentation.Facade.Command;
using PhoneDirectoryManagement.Presentation.Facade.Query;
using System.Reflection;
using System.Text;

namespace PhoneDirectoryManagement.Infrastructure.Configuration;

public class PhoneDirectoryManagementModule(string connectionString) : Autofac.Module
{
    private string ConnectionString { get; set; } = connectionString;

    protected override void Load(ContainerBuilder builder)
    {
        builder.RegisterType<UserManagementAclService>().As<IUserManagementAclService>();

        var repositoryAssembly = typeof(PhoneDirectoryRepository).Assembly;
        builder.RegisterAssemblyTypes(repositoryAssembly)
            .AsClosedTypesOf(typeof(IRepository<,>))
            .InstancePerLifetimeScope();

        var domainServiceAssembly = typeof(PhoneDirectoryService).Assembly;
        builder.RegisterAssemblyTypes(domainServiceAssembly)
            .Where(t => t.Name.EndsWith("Service"))
            .AsImplementedInterfaces();

        var commandHandlersAssembly = typeof(PhoneDirectoryCommandHandler).Assembly;
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

        var queryHandlerAssembly = typeof(PhoneDirectoryQueryHandler).Assembly;
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
            var optionsBuilder = new DbContextOptionsBuilder<PhoneDirectoryManagementCommandContext>();
            optionsBuilder.UseSqlServer(ConnectionString);
            return new PhoneDirectoryManagementCommandContext(optionsBuilder.Options);
        })
            .As<DbContext>()
            .As<PhoneDirectoryManagementCommandContext>()
            .InstancePerLifetimeScope();

        builder.Register(_ =>
        {
            var optionsBuilder = new DbContextOptionsBuilder<PhoneDirectoryManagementQueryContext>();
            optionsBuilder.UseSqlServer(ConnectionString);
            return new PhoneDirectoryManagementQueryContext(optionsBuilder.Options);
        })
            .As<PhoneDirectoryManagementQueryContext>()
            .InstancePerDependency();

        var facadeAssembly = typeof(PhoneDirectoryCommandFacade).Assembly;
        builder.RegisterAssemblyTypes(facadeAssembly)
            .Where(t => t.Name.EndsWith("CommandFacade"))
            .InstancePerLifetimeScope()
            .EnableInterfaceInterceptors()
            .InterceptedBy(typeof(SecurityInterceptor))
            .AsImplementedInterfaces();

        var facadeQueryAssembly = typeof(PhoneDirectoryQueryFacade).Assembly;
        builder.RegisterAssemblyTypes(facadeQueryAssembly)
            .Where(t => t.Name.EndsWith("QueryFacade"))
            .InstancePerLifetimeScope()
            .EnableInterfaceInterceptors()
            .InterceptedBy(typeof(SecurityInterceptor))
            .AsImplementedInterfaces();

        base.Load(builder);
    }
}