namespace OrderOrchestrator.Application.DTOs;

using System.Text.Json.Serialization;

public class OrderCreatedEvent
{
    public Guid EventId { get; set; }
    public Guid OrderId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string ProductId { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal TotalAmount { get; set; }
    public DateTime CreatedAt { get; set; }

    public OrderCreatedEvent() { }

    [JsonConstructor]
    public OrderCreatedEvent(
        Guid eventId,
        Guid orderId,
        string customerName,
        string productId,
        int quantity,
        decimal totalAmount,
        DateTime createdAt)
    {
        EventId = eventId;
        OrderId = orderId;
        CustomerName = customerName;
        ProductId = productId;
        Quantity = quantity;
        TotalAmount = totalAmount;
        CreatedAt = createdAt;
    }

    public OrderCreatedEvent(
        Guid orderId,
        string customerName,
        string productId,
        int quantity,
        decimal totalAmount,
        DateTime createdAt)
        : this(Guid.CreateVersion7(), orderId, customerName, productId, quantity, totalAmount, createdAt)
    {
    }
}
