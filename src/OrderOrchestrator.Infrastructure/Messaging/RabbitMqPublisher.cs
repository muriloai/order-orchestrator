namespace OrderOrchestrator.Infrastructure.Messaging;

using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenTelemetry;
using OpenTelemetry.Context.Propagation;
using OpenTelemetry.Trace;
using OrderOrchestrator.Application.DTOs;
using OrderOrchestrator.Application.Interfaces;
using OrderOrchestrator.Infrastructure.Observability;
using RabbitMQ.Client;

public class RabbitMqPublisher : IEventPublisher, IAsyncDisposable
{
    private const string ExchangeName = "order-events";
    private readonly ConnectionFactory _factory;
    private readonly ILogger<RabbitMqPublisher> _logger;
    private readonly IEventStreamNotifier? _notifier;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private IConnection? _connection;
    private IChannel? _channel;

    public RabbitMqPublisher(
        IConfiguration configuration,
        ILogger<RabbitMqPublisher> logger,
        IEventStreamNotifier? notifier = null)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _notifier = notifier;

        var host = configuration["RabbitMQ:HostName"] ?? "localhost";
        var port = int.TryParse(configuration["RabbitMQ:Port"], out var p) ? p : 5672;
        var user = configuration["RabbitMQ:UserName"] ?? "guest";
        var pass = configuration["RabbitMQ:Password"] ?? "guest";

        _factory = new ConnectionFactory
        {
            HostName = host,
            Port = port,
            UserName = user,
            Password = pass
        };
    }

    private async Task EnsureChannelAsync(CancellationToken cancellationToken)
    {
        if (_channel is { IsOpen: true })
            return;

        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            if (_channel is { IsOpen: true })
                return;

            _connection ??= await _factory.CreateConnectionAsync(cancellationToken);
            _channel = await _connection.CreateChannelAsync(cancellationToken: cancellationToken);

            await _channel.ExchangeDeclareAsync(
                exchange: ExchangeName,
                type: ExchangeType.Topic,
                durable: true,
                autoDelete: false,
                cancellationToken: cancellationToken
            );

            // Declare Dead Letter Exchange and Queue for unhandled/exhausted poison messages
            await _channel.ExchangeDeclareAsync(
                exchange: "order-events.dlx",
                type: ExchangeType.Topic,
                durable: true,
                autoDelete: false,
                cancellationToken: cancellationToken
            );

            await _channel.QueueDeclareAsync(
                queue: "inventory-dlq",
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: null,
                cancellationToken: cancellationToken
            );

            await _channel.QueueBindAsync(
                queue: "inventory-dlq",
                exchange: "order-events.dlx",
                routingKey: "#",
                cancellationToken: cancellationToken
            );
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task PublishAsync<T>(string routingKey, T eventMessage, CancellationToken cancellationToken = default) where T : class
    {
        await EnsureChannelAsync(cancellationToken);

        using var activity = TelemetryConstants.ActivitySource.StartActivity(
            $"{ExchangeName} publish",
            ActivityKind.Producer);

        Guid eventId = Guid.Empty;
        Guid orderId = Guid.Empty;

        if (eventMessage is OrderCreatedEvent orderCreated)
        {
            eventId = orderCreated.EventId;
            orderId = orderCreated.OrderId;
        }

        if (activity is not null)
        {
            activity.SetTag("messaging.system", "rabbitmq");
            activity.SetTag("messaging.destination.name", ExchangeName);
            activity.SetTag("messaging.operation.type", "publish");
            activity.SetTag("messaging.rabbitmq.destination.routing_key", routingKey);

            if (eventId != Guid.Empty)
            {
                activity.SetTag("messaging.message.id", eventId.ToString());
                activity.SetTag("event.id", eventId.ToString());
            }

            if (orderId != Guid.Empty)
            {
                activity.SetTag("messaging.message.conversation_id", orderId.ToString());
                activity.SetTag("order.id", orderId.ToString());
            }
        }

        var json = JsonSerializer.Serialize(eventMessage);
        var body = Encoding.UTF8.GetBytes(json);

        var props = new BasicProperties
        {
            ContentType = "application/json",
            DeliveryMode = DeliveryModes.Persistent,
            MessageId = eventId != Guid.Empty ? eventId.ToString() : Guid.NewGuid().ToString(),
            CorrelationId = orderId != Guid.Empty ? orderId.ToString() : null,
            Headers = new Dictionary<string, object?>()
        };

        // Injetar contexto W3C nos headers RabbitMQ na publicação
        var currentContext = activity?.Context ?? Activity.Current?.Context ?? default;
        if (currentContext != default)
        {
            var propagationContext = new PropagationContext(currentContext, Baggage.Current);
            Propagators.DefaultTextMapPropagator.Inject(
                propagationContext,
                props.Headers,
                (headers, key, value) =>
                {
                    headers[key] = Encoding.UTF8.GetBytes(value);
                });
        }

        if (eventId != Guid.Empty)
            props.Headers["x-event-id"] = Encoding.UTF8.GetBytes(eventId.ToString());
        if (orderId != Guid.Empty)
            props.Headers["x-order-id"] = Encoding.UTF8.GetBytes(orderId.ToString());

        if (_channel is null)
            throw new InvalidOperationException("RabbitMQ channel is not initialized.");

        try
        {
            await _channel.BasicPublishAsync(
                exchange: ExchangeName,
                routingKey: routingKey,
                mandatory: false,
                basicProperties: props,
                body: body,
                cancellationToken: cancellationToken
            );

            _logger.LogInformation(
                "[RabbitMqPublisher] Evento {EventName} publicado em '{Exchange}' [RoutingKey: {RoutingKey}, EventId: {EventId}, OrderId: {OrderId}, TraceId: {TraceId}, SpanId: {SpanId}].",
                typeof(T).Name, ExchangeName, routingKey, eventId, orderId, activity?.TraceId, activity?.SpanId);

            if (_notifier is not null && eventMessage is OrderCreatedEvent created)
            {
                await _notifier.NotifyOrderPublishedAsync(
                    created.OrderId,
                    created.ProductId,
                    created.Quantity,
                    created.TotalAmount,
                    created.CustomerName,
                    routingKey,
                    cancellationToken
                );
            }
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.AddException(ex);
            _logger.LogError(ex, "[RabbitMqPublisher] Erro ao publicar mensagem na exchange '{Exchange}'.", ExchangeName);
            throw;
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel is not null)
            await _channel.DisposeAsync();

        if (_connection is not null)
            await _connection.DisposeAsync();

        _semaphore.Dispose();
    }
}
