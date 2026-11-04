namespace OrderOrchestrator.Api.Services;

using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using OrderOrchestrator.Api.Hubs;
using OrderOrchestrator.Application.Interfaces;

public class SignalREventNotifier : IEventStreamNotifier
{
    private readonly IHubContext<OrderEventsHub> _hubContext;
    private readonly ILogger<SignalREventNotifier> _logger;

    public SignalREventNotifier(
        IHubContext<OrderEventsHub> hubContext,
        ILogger<SignalREventNotifier> logger)
    {
        _hubContext = hubContext ?? throw new ArgumentNullException(nameof(hubContext));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task NotifyOrderPublishedAsync(
        Guid orderId,
        string productId,
        int quantity,
        decimal totalAmount,
        string customerName,
        string routingKey,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var payload = new
            {
                orderId,
                productId,
                quantity,
                totalAmount,
                customerName,
                routingKey,
                exchange = "order-events",
                timestamp = DateTime.UtcNow
            };

            await _hubContext.Clients.All.SendAsync("OrderPublished", payload, cancellationToken);
            _logger.LogInformation("[SignalR] Broadcast OrderPublished emitido para pedido {OrderId}.", orderId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[SignalR] Erro ao transmitir evento OrderPublished.");
        }
    }

    public async Task NotifyInventoryProcessedAsync(
        Guid orderId,
        string productId,
        int quantity,
        int remainingStock,
        bool success,
        string message,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var payload = new
            {
                orderId,
                productId,
                quantity,
                remainingStock,
                success,
                message,
                queue = "inventory-queue",
                timestamp = DateTime.UtcNow
            };

            await _hubContext.Clients.All.SendAsync("InventoryProcessed", payload, cancellationToken);
            _logger.LogInformation("[SignalR] Broadcast InventoryProcessed emitido para pedido {OrderId}.", orderId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[SignalR] Erro ao transmitir evento InventoryProcessed.");
        }
    }

    public async Task NotifyNotificationDispatchedAsync(
        Guid orderId,
        string customerName,
        string message,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var payload = new
            {
                orderId,
                customerName,
                message,
                queue = "notification-queue",
                timestamp = DateTime.UtcNow
            };

            await _hubContext.Clients.All.SendAsync("NotificationDispatched", payload, cancellationToken);
            _logger.LogInformation("[SignalR] Broadcast NotificationDispatched emitido para pedido {OrderId}.", orderId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[SignalR] Erro ao transmitir evento NotificationDispatched.");
        }
    }
}
