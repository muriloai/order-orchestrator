namespace OrderOrchestrator.Domain.Entities;

public class NotificationLog
{
    public Guid Id { get; private set; }
    public Guid OrderId { get; private set; }
    public string CustomerName { get; private set; } = string.Empty;
    public string Message { get; private set; } = string.Empty;
    public DateTime SentAt { get; private set; }

    protected NotificationLog() { }

    public NotificationLog(Guid orderId, string customerName, string message)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(customerName);
        ArgumentException.ThrowIfNullOrWhiteSpace(message);

        Id = Guid.CreateVersion7();
        OrderId = orderId;
        CustomerName = customerName;
        Message = message;
        SentAt = DateTime.UtcNow;
    }
}
