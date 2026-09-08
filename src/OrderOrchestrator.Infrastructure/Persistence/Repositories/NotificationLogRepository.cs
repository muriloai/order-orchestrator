namespace OrderOrchestrator.Infrastructure.Persistence.Repositories;

using Microsoft.EntityFrameworkCore;
using OrderOrchestrator.Domain.Entities;
using OrderOrchestrator.Domain.Interfaces;
using OrderOrchestrator.Infrastructure.Persistence;

public class NotificationLogRepository : INotificationLogRepository
{
    private readonly AppDbContext _context;

    public NotificationLogRepository(AppDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task AddAsync(NotificationLog log, CancellationToken cancellationToken = default)
    {
        await _context.NotificationLogs.AddAsync(log, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IEnumerable<NotificationLog>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.NotificationLogs.AsNoTracking().ToListAsync(cancellationToken);
    }
}
