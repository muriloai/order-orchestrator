namespace OrderOrchestrator.Application.DTOs;

public record CreateOrderRequest(
    string CustomerName,
    string ProductId,
    int Quantity,
    decimal TotalAmount
);
