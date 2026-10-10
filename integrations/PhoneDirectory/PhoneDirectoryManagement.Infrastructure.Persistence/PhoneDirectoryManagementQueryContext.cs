// PhoneDirectoryManagement.Infrastructure/Persistence/PhoneDirectoryManagementQueryContext.cs
using Microsoft.EntityFrameworkCore;
using PhoneDirectoryManagement.Domain.PhoneDirectoryAgg;

namespace PhoneDirectoryManagement.Infrastructure.Persistence;

public class PhoneDirectoryManagementQueryContext(DbContextOptions<PhoneDirectoryManagementQueryContext> options)
    : DbContext(options)
{
    public DbSet<PhoneDirectoryEntry> PhoneDirectoryEntries { get; set; }
    public DbSet<PhoneDirectoryNumber> PhoneDirectoryNumbers { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PhoneDirectoryManagementQueryContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}