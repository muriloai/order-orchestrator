namespace OrderOrchestrator.Infrastructure.Messaging;

using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OrderOrchestrator.Application.Interfaces;
using RabbitMQ.Client;

public class RabbitMqPublisher : IEventPublisher, IAsyncDisposable
{
    private const string ExchangeName = "order-events";
    private readonly ConnectionFactory _factory;
    private readonly ILogger<RabbitMqPublisher> _logger;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private IConnection? _connection;
    private IChannel? _channel;

    public RabbitMqPublisher(IConfiguration configuration, ILogger<RabbitMqPublisher> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

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
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task PublishAsync<T>(string routingKey, T eventMessage, CancellationToken cancellationToken = default) where T : class
    {
        await EnsureChannelAsync(cancellationToken);

        var json = JsonSerializer.Serialize(eventMessage);
        var body = Encoding.UTF8.GetBytes(json);

        var props = new BasicProperties
        {
            ContentType = "application/json",
            DeliveryMode = DeliveryModes.Persistent
        };

        if (_channel is null)
            throw new InvalidOperationException("RabbitMQ channel is not initialized.");

        await _channel.BasicPublishAsync(
            exchange: ExchangeName,
            routingKey: routingKey,
            mandatory: false,
            basicProperties: props,
            body: body,
            cancellationToken: cancellationToken
        );

        _logger.LogInformation("Evento {EventName} publicado em '{Exchange}' com routing key '{RoutingKey}'.",
            typeof(T).Name, ExchangeName, routingKey);
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel is not null)
            await _channel.DisposeAsync();

        if (_connection is not null)
            await _connection.DisposeAsync();

        _semaphore.Dispose();
        GC.SuppressFinalize(this);
    }
}
