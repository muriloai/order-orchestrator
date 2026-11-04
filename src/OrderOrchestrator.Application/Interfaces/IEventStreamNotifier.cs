namespace OrderOrchestrator.Application.Interfaces;

public interface IEventStreamNotifier
{
    Task NotifyOrderPublishedAsync(
        Guid orderId,
        string productId,
        int quantity,
        decimal totalAmount,
        string customerName,
        string routingKey,
        CancellationToken cancellationToken = default);

    Task NotifyInventoryProcessedAsync(
        Guid orderId,
        string productId,
        int quantity,
        int remainingStock,
        bool success,
        string message,
        CancellationToken cancellationToken = default);

    Task NotifyNotificationDispatchedAsync(
        Guid orderId,
        string customerName,
        string message,
        CancellationToken cancellationToken = default);
}
