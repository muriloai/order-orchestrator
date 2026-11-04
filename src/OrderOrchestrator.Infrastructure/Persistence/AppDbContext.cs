namespace OrderOrchestrator.Infrastructure.Persistence;

using Microsoft.EntityFrameworkCore;
using OrderOrchestrator.Domain.Entities;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Inventory> Inventories => Set<Inventory>();
    public DbSet<NotificationLog> NotificationLogs => Set<NotificationLog>();
    public DbSet<ProcessedEvent> ProcessedEvents => Set<ProcessedEvent>();
    public DbSet<SimulationState> SimulationStates => Set<SimulationState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Order>(entity =>
        {
            entity.ToTable("Orders");
            entity.HasKey(o => o.Id);
            entity.Property(o => o.CustomerName).IsRequired().HasMaxLength(200);
            entity.Property(o => o.ProductId).IsRequired().HasMaxLength(100);
            entity.Property(o => o.Quantity).IsRequired();
            entity.Property(o => o.TotalAmount).HasColumnType("decimal(18,2)").IsRequired();
            entity.Property(o => o.Status).HasConversion<string>().HasMaxLength(50).IsRequired();
            entity.Property(o => o.ProcessingAttempts).IsRequired().HasDefaultValue(0);
            entity.Property(o => o.LastProcessingError).HasMaxLength(1000);
            entity.Property(o => o.CreatedAt).IsRequired();
            entity.Property(o => o.UpdatedAt);
        });

        modelBuilder.Entity<Inventory>(entity =>
        {
            entity.ToTable("Inventories");
            entity.HasKey(i => i.Id);
            entity.HasIndex(i => i.ProductId).IsUnique();
            entity.Property(i => i.ProductId).IsRequired().HasMaxLength(100);
            entity.Property(i => i.ProductName).IsRequired().HasMaxLength(200);
            entity.Property(i => i.AvailableQuantity).IsRequired();
        });

        modelBuilder.Entity<NotificationLog>(entity =>
        {
            entity.ToTable("NotificationLogs");
            entity.HasKey(n => n.Id);
            entity.Property(n => n.OrderId).IsRequired();
            entity.Property(n => n.CustomerName).IsRequired().HasMaxLength(200);
            entity.Property(n => n.Message).IsRequired().HasMaxLength(1000);
            entity.Property(n => n.SentAt).IsRequired();
        });

        modelBuilder.Entity<ProcessedEvent>(entity =>
        {
            entity.ToTable("ProcessedEvents");
            entity.HasKey(p => new { p.ConsumerName, p.EventId });
            entity.Property(p => p.ConsumerName).IsRequired().HasMaxLength(100);
            entity.Property(p => p.EventId).IsRequired();
            entity.Property(p => p.OrderId).IsRequired();
            entity.Property(p => p.ProcessedAt).IsRequired();
            entity.HasIndex(p => p.OrderId);
        });

        modelBuilder.Entity<SimulationState>(entity =>
        {
            entity.ToTable("SimulationStates");
            entity.HasKey(s => s.Id);
            entity.Property(s => s.LastFaultTriggered).HasMaxLength(200);
            entity.Property(s => s.UpdatedAt).IsRequired();
        });
    }
}
