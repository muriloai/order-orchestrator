namespace OrderOrchestrator.Infrastructure.Workers;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OrderOrchestrator.Application.DTOs;
using OrderOrchestrator.Domain.Entities;
using OrderOrchestrator.Domain.Interfaces;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

public class NotificationWorker : BackgroundService
{
    private const string ExchangeName = "order-events";
    private const string QueueName = "notification-queue";
    private const string RoutingKeyPattern = "order.#";

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<NotificationWorker> _logger;

    public NotificationWorker(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<NotificationWorker> logger)
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
                    routingKey: RoutingKeyPattern,
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
                            var notificationMessage = $"Notificação de pedido: Cliente {orderCreated.CustomerName}, seu pedido #{orderCreated.OrderId} de {orderCreated.Quantity}x {orderCreated.ProductId} (Total: R$ {orderCreated.TotalAmount:F2}) foi recebido e está em processamento.";

                            _logger.LogInformation("[NotificationWorker] Enviando e-mail para {Customer}: \"{Message}\"",
                                orderCreated.CustomerName, notificationMessage);

                            using var scope = _scopeFactory.CreateScope();
                            var notificationRepo = scope.ServiceProvider.GetRequiredService<INotificationLogRepository>();

                            var log = new NotificationLog(
                                orderCreated.OrderId,
                                orderCreated.CustomerName,
                                notificationMessage
                            );

                            await notificationRepo.AddAsync(log, stoppingToken);
                        }

                        await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[NotificationWorker] Erro inesperado ao processar mensagem da fila '{Queue}'.", QueueName);
                        await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: false);
                    }
                };

                await channel.BasicConsumeAsync(
                    queue: QueueName,
                    autoAck: false,
                    consumer: consumer,
                    cancellationToken: stoppingToken
                );

                _logger.LogInformation("[NotificationWorker] Ouvindo fila '{Queue}' vinculada ao padrão '{Pattern}'.", QueueName, RoutingKeyPattern);
                await Task.Delay(Timeout.Infinite, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[NotificationWorker] Falha de conexão com RabbitMQ. Nova tentativa em 5s...");
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
