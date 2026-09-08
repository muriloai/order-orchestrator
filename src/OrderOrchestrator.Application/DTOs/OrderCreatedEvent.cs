namespace OrderOrchestrator.Application.DTOs;

public record OrderCreatedEvent(
    Guid OrderId,
    string CustomerName,
    string ProductId,
    int Quantity,
    decimal TotalAmount,
    DateTime CreatedAt
);
