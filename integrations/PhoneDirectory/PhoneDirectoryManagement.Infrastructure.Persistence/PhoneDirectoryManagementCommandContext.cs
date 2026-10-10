// PhoneDirectoryManagement.Infrastructure/Persistence/PhoneDirectoryManagementCommandContext.cs
using Microsoft.EntityFrameworkCore;
using PhoneDirectoryManagement.Domain.PhoneDirectoryAgg;

namespace PhoneDirectoryManagement.Infrastructure.Persistence;

public class PhoneDirectoryManagementCommandContext(DbContextOptions<PhoneDirectoryManagementCommandContext> options)
    : DbContext(options)
{
    public DbSet<PhoneDirectoryEntry> PhoneDirectoryEntries { get; set; }
    public DbSet<PhoneDirectoryNumber> PhoneDirectoryNumbers { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PhoneDirectoryManagementCommandContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}