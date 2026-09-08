namespace OrderOrchestrator.Domain.Entities;

using OrderOrchestrator.Domain.Enums;

public class Order
{
    public Guid Id { get; private set; }
    public string CustomerName { get; private set; } = string.Empty;
    public string ProductId { get; private set; } = string.Empty;
    public int Quantity { get; private set; }
    public decimal TotalAmount { get; private set; }
    public OrderStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    protected Order() { }

    public Order(string customerName, string productId, int quantity, decimal totalAmount)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(customerName);
        ArgumentException.ThrowIfNullOrWhiteSpace(productId);

        if (quantity <= 0)
            throw new ArgumentOutOfRangeException(nameof(quantity), "Quantity must be greater than zero.");

        if (totalAmount < 0)
            throw new ArgumentOutOfRangeException(nameof(totalAmount), "Total amount cannot be negative.");

        Id = Guid.CreateVersion7();
        CustomerName = customerName;
        ProductId = productId;
        Quantity = quantity;
        TotalAmount = totalAmount;
        Status = OrderStatus.Pending;
        CreatedAt = DateTime.UtcNow;
    }

    public void MarkAsProcessed()
    {
        Status = OrderStatus.Processed;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkAsFailed()
    {
        Status = OrderStatus.Failed;
        UpdatedAt = DateTime.UtcNow;
    }
}
