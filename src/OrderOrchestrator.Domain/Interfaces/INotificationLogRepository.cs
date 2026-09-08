namespace OrderOrchestrator.Domain.Interfaces;

using OrderOrchestrator.Domain.Entities;

public interface INotificationLogRepository
{
    Task AddAsync(NotificationLog log, CancellationToken cancellationToken = default);
    Task<IEnumerable<NotificationLog>> GetAllAsync(CancellationToken cancellationToken = default);
}
