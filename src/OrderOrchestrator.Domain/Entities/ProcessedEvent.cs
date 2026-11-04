namespace OrderOrchestrator.Domain.Entities;

public class ProcessedEvent
{
    public string ConsumerName { get; private set; } = string.Empty;
    public Guid EventId { get; private set; }
    public Guid OrderId { get; private set; }
    public DateTime ProcessedAt { get; private set; }

    protected ProcessedEvent() { }

    public ProcessedEvent(string consumerName, Guid eventId, Guid orderId, DateTime processedAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(consumerName);
        if (eventId == Guid.Empty) throw new ArgumentException("EventId cannot be empty.", nameof(eventId));
        if (orderId == Guid.Empty) throw new ArgumentException("OrderId cannot be empty.", nameof(orderId));

        ConsumerName = consumerName;
        EventId = eventId;
        OrderId = orderId;
        ProcessedAt = processedAt;
    }
}
