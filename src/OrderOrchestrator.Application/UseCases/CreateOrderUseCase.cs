namespace OrderOrchestrator.Application.UseCases;

using OrderOrchestrator.Application.DTOs;
using OrderOrchestrator.Application.Interfaces;
using OrderOrchestrator.Domain.Entities;
using OrderOrchestrator.Domain.Interfaces;

public class CreateOrderUseCase
{
    private readonly IOrderRepository _orderRepository;
    private readonly IEventPublisher _eventPublisher;

    public CreateOrderUseCase(IOrderRepository orderRepository, IEventPublisher eventPublisher)
    {
        _orderRepository = orderRepository ?? throw new ArgumentNullException(nameof(orderRepository));
        _eventPublisher = eventPublisher ?? throw new ArgumentNullException(nameof(eventPublisher));
    }

    public async Task<CreateOrderResponse> ExecuteAsync(CreateOrderRequest request, CancellationToken cancellationToken = default)
    {
        var order = new Order(
            request.CustomerName,
            request.ProductId,
            request.Quantity,
            request.TotalAmount
        );

        await _orderRepository.AddAsync(order, cancellationToken);

        var orderCreatedEvent = new OrderCreatedEvent(
            order.Id,
            order.CustomerName,
            order.ProductId,
            order.Quantity,
            order.TotalAmount,
            order.CreatedAt
        );

        await _eventPublisher.PublishAsync("order.created", orderCreatedEvent, cancellationToken);

        return new CreateOrderResponse(
            order.Id,
            order.CustomerName,
            order.ProductId,
            order.Quantity,
            order.TotalAmount,
            order.Status,
            order.CreatedAt
        );
    }
}
