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
    public int ProcessingAttempts { get; private set; }
    public string? LastProcessingError { get; private set; }
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
        ProcessingAttempts = 0;
        CreatedAt = DateTime.UtcNow;
    }

    public void RecordProcessingAttempt(string? error = null)
    {
        ProcessingAttempts++;
        LastProcessingError = error;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkAsProcessed()
    {
        Status = OrderStatus.Processed;
        LastProcessingError = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkAsFailed(string? reason = null)
    {
        Status = OrderStatus.Failed;
        LastProcessingError = reason;
        UpdatedAt = DateTime.UtcNow;
    }
}
