namespace OrderOrchestrator.Application.DTOs;

using OrderOrchestrator.Domain.Enums;

public record CreateOrderResponse(
    Guid OrderId,
    string CustomerName,
    string ProductId,
    int Quantity,
    decimal TotalAmount,
    OrderStatus Status,
    DateTime CreatedAt
);
