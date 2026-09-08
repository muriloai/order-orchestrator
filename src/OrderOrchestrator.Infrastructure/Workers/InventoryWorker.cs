namespace OrderOrchestrator.Infrastructure.Workers;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OrderOrchestrator.Application.DTOs;
using OrderOrchestrator.Domain.Interfaces;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

public class InventoryWorker : BackgroundService
{
    private const string ExchangeName = "order-events";
    private const string QueueName = "inventory-queue";
    private const string RoutingKey = "order.created";

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<InventoryWorker> _logger;

    public InventoryWorker(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<InventoryWorker> logger)
    {
        _scopeFactory = scopeFactory ?? throw new ArgumentNullException(nameof(scopeFactory));
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var host = _configuration["RabbitMQ:HostName"] ?? "localhost";
        var port = int.TryParse(_configuration["RabbitMQ:Port"], out var p) ? p : 5672;
        var user = _configuration["RabbitMQ:UserName"] ?? "guest";
        var pass = _configuration["RabbitMQ:Password"] ?? "guest";

        var factory = new ConnectionFactory
        {
            HostName = host,
            Port = port,
            UserName = user,
            Password = pass
        };

        IConnection? connection = null;
        IChannel? channel = null;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                connection = await factory.CreateConnectionAsync(stoppingToken);
                channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);

                await channel.ExchangeDeclareAsync(
                    exchange: ExchangeName,
                    type: ExchangeType.Topic,
                    durable: true,
                    autoDelete: false,
                    cancellationToken: stoppingToken
                );

                await channel.QueueDeclareAsync(
                    queue: QueueName,
                    durable: true,
                    exclusive: false,
                    autoDelete: false,
                    arguments: null,
                    cancellationToken: stoppingToken
                );

                await channel.QueueBindAsync(
                    queue: QueueName,
                    exchange: ExchangeName,
                    routingKey: RoutingKey,
                    cancellationToken: stoppingToken
                );

                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.ReceivedAsync += async (_, ea) =>
                {
                    try
                    {
                        var json = Encoding.UTF8.GetString(ea.Body.ToArray());
                        var orderCreated = JsonSerializer.Deserialize<OrderCreatedEvent>(json, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });

                        if (orderCreated is not null)
                        {
                            using var scope = _scopeFactory.CreateScope();
                            var inventoryRepo = scope.ServiceProvider.GetRequiredService<IInventoryRepository>();
                            var orderRepo = scope.ServiceProvider.GetRequiredService<IOrderRepository>();

                            var order = await orderRepo.GetByIdAsync(orderCreated.OrderId, stoppingToken);
                            var inventory = await inventoryRepo.GetByProductIdAsync(orderCreated.ProductId, stoppingToken);

                            if (inventory is not null && inventory.DeductStock(orderCreated.Quantity))
                            {
                                await inventoryRepo.UpdateAsync(inventory, stoppingToken);
                                order?.MarkAsProcessed();
                                _logger.LogInformation(
                                    "[InventoryWorker] Pedido {OrderId} processado. Estoque restante de {ProductId}: {Balance}.",
                                    orderCreated.OrderId, orderCreated.ProductId, inventory.AvailableQuantity);
                            }
                            else
                            {
                                order?.MarkAsFailed();
                                _logger.LogWarning(
                                    "[InventoryWorker] Estoque insuficiente ou inexistente para {ProductId}. Pedido {OrderId} marcado como falha.",
                                    orderCreated.ProductId, orderCreated.OrderId);
                            }

                            if (order is not null)
                                await orderRepo.UpdateAsync(order, stoppingToken);
                        }

                        await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[InventoryWorker] Erro inesperado ao processar mensagem da fila '{Queue}'.", QueueName);
                        await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: false);
                    }
                };

                await channel.BasicConsumeAsync(
                    queue: QueueName,
                    autoAck: false,
                    consumer: consumer,
                    cancellationToken: stoppingToken
                );

                _logger.LogInformation("[InventoryWorker] Ouvindo fila '{Queue}' vinculada ao tema '{Key}'.", QueueName, RoutingKey);
                await Task.Delay(Timeout.Infinite, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[InventoryWorker] Falha de conexão com RabbitMQ. Nova tentativa em 5s...");
                await Task.Delay(5000, stoppingToken);
            }
            finally
            {
                if (channel is not null)
                    await channel.DisposeAsync();
                if (connection is not null)
                    await connection.DisposeAsync();
            }
        }
    }
}
