namespace OrderOrchestrator.Infrastructure.Workers;

using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OpenTelemetry;
using OpenTelemetry.Context.Propagation;
using OpenTelemetry.Trace;
using OrderOrchestrator.Application.DTOs;
using OrderOrchestrator.Application.Interfaces;
using OrderOrchestrator.Domain.Entities;
using OrderOrchestrator.Domain.Interfaces;
using OrderOrchestrator.Infrastructure.Observability;
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
                    var propagationContext = Propagators.DefaultTextMapPropagator.Extract(
                        default,
                        ea.BasicProperties.Headers,
                        (headers, key) =>
                        {
                            if (headers != null && headers.TryGetValue(key, out var val))
                            {
                                if (val is byte[] bytes) return new[] { Encoding.UTF8.GetString(bytes) };
                                if (val is string str) return new[] { str };
                            }
                            return Enumerable.Empty<string>();
                        });

                    using var activity = TelemetryConstants.ActivitySource.StartActivity(
                        $"{QueueName} process",
                        ActivityKind.Consumer,
                        propagationContext.ActivityContext);

                    try
                    {
                        var json = Encoding.UTF8.GetString(ea.Body.ToArray());
                        var orderCreated = JsonSerializer.Deserialize<OrderCreatedEvent>(json, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });

                        if (orderCreated is not null)
                        {
                            if (activity is not null)
                            {
                                activity.SetTag("messaging.system", "rabbitmq");
                                activity.SetTag("messaging.destination.name", QueueName);
                                activity.SetTag("messaging.operation.type", "process");
                                activity.SetTag("order.id", orderCreated.OrderId.ToString());
                                activity.SetTag("event.id", orderCreated.EventId.ToString());
                            }

                            var notificationMessage = $"Notificação de pedido: Cliente {orderCreated.CustomerName}, seu pedido #{orderCreated.OrderId} de {orderCreated.Quantity}x {orderCreated.ProductId} (Total: R$ {orderCreated.TotalAmount:F2}) foi recebido e está em processamento.";

                            _logger.LogInformation(
                                "[NotificationWorker] Enviando e-mail para {Customer}: \"{Message}\" [TraceId: {TraceId}, SpanId: {SpanId}]",
                                orderCreated.CustomerName, notificationMessage, activity?.TraceId, activity?.SpanId);

                            using var scope = _scopeFactory.CreateScope();
                            var notificationRepo = scope.ServiceProvider.GetRequiredService<INotificationLogRepository>();
                            var notifier = scope.ServiceProvider.GetService<IEventStreamNotifier>();

                            var notificationLog = new NotificationLog(
                                orderCreated.OrderId,
                                orderCreated.CustomerName,
                                notificationMessage
                            );

                            await notificationRepo.AddAsync(notificationLog, stoppingToken);

                            if (notifier is not null)
                            {
                                await notifier.NotifyNotificationDispatchedAsync(
                                    orderCreated.OrderId,
                                    orderCreated.CustomerName,
                                    notificationMessage,
                                    stoppingToken
                                );
                            }
                        }

                        await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
                    }
                    catch (Exception ex)
                    {
                        activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
                        activity?.AddException(ex);
                        _logger.LogError(ex, "[NotificationWorker] Erro inesperado ao processar notificação. [TraceId: {TraceId}, SpanId: {SpanId}]", activity?.TraceId, activity?.SpanId);
                        await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: false);
                    }
                };

                await channel.BasicConsumeAsync(
                    queue: QueueName,
                    autoAck: false,
                    consumer: consumer,
                    cancellationToken: stoppingToken
                );

                _logger.LogInformation("[NotificationWorker] Ouvindo fila '{Queue}' vinculada ao padrão '{Key}'.", QueueName, RoutingKeyPattern);
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
