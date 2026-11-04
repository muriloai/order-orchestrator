namespace OrderOrchestrator.Infrastructure.Workers;

using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
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
using OrderOrchestrator.Infrastructure.Observability;
using OrderOrchestrator.Infrastructure.Persistence;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

public class InventoryWorker : BackgroundService
{
    public const string ConsumerName = "InventoryWorker";
    private const string ExchangeName = "order-events";
    private const string QueueName = "inventory-queue";
    private const string RoutingKey = "order.created";
    private const string DlxExchangeName = "order-events.dlx";
    private const string DlqRoutingKey = "inventory.dlq";
    private const int MaxRetries = 3;

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

        while (!stoppingToken.IsCancellationRequested)
        {
            IConnection? connection = null;
            IChannel? channel = null;

            try
            {
                connection = await factory.CreateConnectionAsync(stoppingToken);
                channel = await connection.CreateChannelAsync(cancellationToken: stoppingToken);

                // Declare topic exchange
                await channel.ExchangeDeclareAsync(
                    exchange: ExchangeName,
                    type: ExchangeType.Topic,
                    durable: true,
                    autoDelete: false,
                    cancellationToken: stoppingToken
                );

                // Declare DLX
                await channel.ExchangeDeclareAsync(
                    exchange: DlxExchangeName,
                    type: ExchangeType.Topic,
                    durable: true,
                    autoDelete: false,
                    cancellationToken: stoppingToken
                );

                // Declare DLQ
                await channel.QueueDeclareAsync(
                    queue: "inventory-dlq",
                    durable: true,
                    exclusive: false,
                    autoDelete: false,
                    arguments: null,
                    cancellationToken: stoppingToken
                );

                await channel.QueueBindAsync(
                    queue: "inventory-dlq",
                    exchange: DlxExchangeName,
                    routingKey: "#",
                    cancellationToken: stoppingToken
                );

                // Declare inventory queue with dead-letter config
                var queueArgs = new Dictionary<string, object?>
                {
                    ["x-dead-letter-exchange"] = DlxExchangeName,
                    ["x-dead-letter-routing-key"] = DlqRoutingKey
                };

                await channel.QueueDeclareAsync(
                    queue: QueueName,
                    durable: true,
                    exclusive: false,
                    autoDelete: false,
                    arguments: queueArgs,
                    cancellationToken: stoppingToken
                );

                await channel.QueueBindAsync(
                    queue: QueueName,
                    exchange: ExchangeName,
                    routingKey: RoutingKey,
                    cancellationToken: stoppingToken
                );

                // Fair dispatch
                await channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 10, global: false, cancellationToken: stoppingToken);

                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.ReceivedAsync += async (_, ea) =>
                {
                    await ProcessMessageAsync(channel, ea, stoppingToken);
                };

                await channel.BasicConsumeAsync(
                    queue: QueueName,
                    autoAck: false,
                    consumer: consumer,
                    cancellationToken: stoppingToken
                );

                _logger.LogInformation("[InventoryWorker] Conectado e ouvindo fila '{Queue}' vinculada ao tópico '{Key}'.", QueueName, RoutingKey);
                await Task.Delay(Timeout.Infinite, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[InventoryWorker] Falha de conexão ou erro no worker. Nova tentativa em 4s...");
                await Task.Delay(4000, stoppingToken);
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

    private async Task ProcessMessageAsync(IChannel channel, BasicDeliverEventArgs ea, CancellationToken stoppingToken)
    {
        // 1. Extrair contexto de trace W3C dos headers RabbitMQ
        var extractedContext = Propagators.DefaultTextMapPropagator.Extract(
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

        // 2. Extrair contagem de tentativas do cabeçalho x-attempt-count
        int attempt = 1;
        if (ea.BasicProperties.Headers != null && ea.BasicProperties.Headers.TryGetValue("x-attempt-count", out var rawAttempt))
        {
            if (rawAttempt is byte[] attemptBytes && int.TryParse(Encoding.UTF8.GetString(attemptBytes), out var parsedAttempt))
                attempt = parsedAttempt;
            else if (rawAttempt is int iAttempt)
                attempt = iAttempt;
        }
        else if (ea.Redelivered)
        {
            attempt = 2;
        }

        // 3. Desserializar evento para capturar IDs
        string rawJson = string.Empty;
        OrderCreatedEvent? orderCreated = null;
        try
        {
            rawJson = Encoding.UTF8.GetString(ea.Body.ToArray());
            orderCreated = JsonSerializer.Deserialize<OrderCreatedEvent>(rawJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[InventoryWorker] Payload inválido recebido na fila '{Queue}'. Enviando para DLQ.", QueueName);
            await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: false);
            return;
        }

        if (orderCreated is null)
        {
            await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
            return;
        }

        // 4. Iniciar Activity com o contexto de criação como pai. Cada tentativa ganha seu próprio SpanId.
        using var activity = TelemetryConstants.ActivitySource.StartActivity(
            $"{QueueName} process",
            ActivityKind.Consumer,
            extractedContext.ActivityContext);

        if (activity is not null)
        {
            activity.SetTag("messaging.system", "rabbitmq");
            activity.SetTag("messaging.destination.name", QueueName);
            activity.SetTag("messaging.operation.type", "process");
            activity.SetTag("messaging.message.id", orderCreated.EventId.ToString());
            activity.SetTag("messaging.message.conversation_id", orderCreated.OrderId.ToString());
            activity.SetTag("order.id", orderCreated.OrderId.ToString());
            activity.SetTag("event.id", orderCreated.EventId.ToString());
            activity.SetTag("inventory.attempt", attempt);
            activity.SetTag("messaging.rabbitmq.delivery_tag", ea.DeliveryTag.ToString());
            activity.SetTag("messaging.rabbitmq.redelivered", ea.Redelivered);
        }

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notifier = scope.ServiceProvider.GetService<IEventStreamNotifier>();

        _logger.LogInformation(
            "[InventoryWorker] [Tentativa {Attempt}] Recebido evento {EventId} do pedido {OrderId} ({Quantity}x {ProductId}). TraceId: {TraceId}, SpanId: {SpanId}.",
            attempt, orderCreated.EventId, orderCreated.OrderId, orderCreated.Quantity, orderCreated.ProductId, activity?.TraceId, activity?.SpanId);

        try
        {
            // Consultar flags de simulação no banco
            var simState = await db.SimulationStates.FirstOrDefaultAsync(stoppingToken);

            // 5. Iniciar transação relacional para persistir deduplicação e baixa de forma atômica
            await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted, stoppingToken);

            // 6. Verificar idempotência: já processamos este (ConsumerName, EventId)?
            var alreadyProcessed = await db.ProcessedEvents.AnyAsync(
                p => p.ConsumerName == ConsumerName && p.EventId == orderCreated.EventId,
                stoppingToken);

            if (alreadyProcessed)
            {
                _logger.LogInformation(
                    "[InventoryWorker] IDEMPOTÊNCIA ACIONADA: Evento {EventId} já processado pelo consumidor {ConsumerName} para o Pedido {OrderId}. Ignorando baixa duplicada. Saldo mantido. TraceId: {TraceId}, SpanId: {SpanId}.",
                    orderCreated.EventId, ConsumerName, orderCreated.OrderId, activity?.TraceId, activity?.SpanId);

                TelemetryConstants.RecordAttempt("duplicate", orderCreated.ProductId, attempt);
                await transaction.RollbackAsync(stoppingToken);

                // ACK após confirmação de idempotência
                await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
                return;
            }

            // SIMULAÇÃO: Falha transitória de acesso ao banco na primeira tentativa
            if (simState is { FailTransientDbOnFirstAttempt: true } && attempt == 1)
            {
                simState.FailTransientDbOnFirstAttempt = false; // Libera automaticamente a dependência após a primeira tentativa
                simState.LastFaultTriggered = $"Falha transitória na tentativa 1 para o pedido {orderCreated.OrderId}";
                simState.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(stoppingToken);

                _logger.LogWarning(
                    "[InventoryWorker] [FALHA TRANSITÓRIA INJETADA] Simulando erro temporário de banco de dados na Tentativa 1 para o Pedido {OrderId}. TraceId: {TraceId}, SpanId: {SpanId}.",
                    orderCreated.OrderId, activity?.TraceId, activity?.SpanId);

                throw new InvalidOperationException("Falha transitória simulada: Conexão com o SQL Server recusada/timeout na primeira tentativa.");
            }

            // Buscar dados com lock implícito na transação
            var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == orderCreated.OrderId, stoppingToken);
            var inventory = await db.Inventories.FirstOrDefaultAsync(i => i.ProductId == orderCreated.ProductId, stoppingToken);

            if (inventory is not null && inventory.DeductStock(orderCreated.Quantity))
            {
                order?.MarkAsProcessed();
                order?.RecordProcessingAttempt(null);

                // Registrar o processamento do evento para garantir idempotência atômica
                var processedRecord = new ProcessedEvent(ConsumerName, orderCreated.EventId, orderCreated.OrderId, DateTime.UtcNow);
                db.ProcessedEvents.Add(processedRecord);

                await db.SaveChangesAsync(stoppingToken);

                // Commit da transação no SQL Server
                await transaction.CommitAsync(stoppingToken);

                _logger.LogInformation(
                    "[InventoryWorker] SUCESSO: Transação comitada no banco. Pedido {OrderId} processado. Estoque restante de {ProductId}: {Balance} un. TraceId: {TraceId}, SpanId: {SpanId}.",
                    orderCreated.OrderId, orderCreated.ProductId, inventory.AvailableQuantity, activity?.TraceId, activity?.SpanId);

                // SIMULAÇÃO: Queda após commit e antes do ACK
                if (simState is { SimulatePostCommitCrash: true })
                {
                    simState.SimulatePostCommitCrash = false; // Desativa para a próxima entrega
                    simState.LastFaultTriggered = $"Queda simulada após commit para o pedido {orderCreated.OrderId}";
                    simState.UpdatedAt = DateTime.UtcNow;
                    await db.SaveChangesAsync(stoppingToken);

                    _logger.LogWarning(
                        "[InventoryWorker] [QUEDA SIMULADA PÓS-COMMIT] Transação COMMITADA com sucesso no SQL Server (Saldo={Balance}), mas processo caiu ANTES do ACK! Mensagem sendo devolvida ao RabbitMQ para reentrega.",
                        inventory.AvailableQuantity);

                    // Reenfileirar para que o RabbitMQ reentregue com o mesmo EventId
                    await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: true);
                    return;
                }

                // 7. ACK APÓS COMMIT
                await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
                TelemetryConstants.RecordAttempt("success", orderCreated.ProductId, attempt);

                if (notifier is not null)
                {
                    await notifier.NotifyInventoryProcessedAsync(
                        orderCreated.OrderId,
                        orderCreated.ProductId,
                        orderCreated.Quantity,
                        inventory.AvailableQuantity,
                        true,
                        $"Estoque do produto {orderCreated.ProductId} atualizado! Saldo restante: {inventory.AvailableQuantity} un.",
                        stoppingToken
                    );
                }
            }
            else
            {
                // Saldo insuficiente
                order?.MarkAsFailed($"Estoque insuficiente para {orderCreated.ProductId} (Disponível: {inventory?.AvailableQuantity ?? 0}, Solicitado: {orderCreated.Quantity}).");
                order?.RecordProcessingAttempt("Estoque insuficiente.");

                var processedRecord = new ProcessedEvent(ConsumerName, orderCreated.EventId, orderCreated.OrderId, DateTime.UtcNow);
                db.ProcessedEvents.Add(processedRecord);

                await db.SaveChangesAsync(stoppingToken);
                await transaction.CommitAsync(stoppingToken);

                await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
                TelemetryConstants.RecordAttempt("insufficient_stock", orderCreated.ProductId, attempt);

                _logger.LogWarning(
                    "[InventoryWorker] Estoque insuficiente para {ProductId}. Pedido {OrderId} marcado como falha. TraceId: {TraceId}, SpanId: {SpanId}.",
                    orderCreated.ProductId, orderCreated.OrderId, activity?.TraceId, activity?.SpanId);

                if (notifier is not null)
                {
                    await notifier.NotifyInventoryProcessedAsync(
                        orderCreated.OrderId,
                        orderCreated.ProductId,
                        orderCreated.Quantity,
                        inventory?.AvailableQuantity ?? 0,
                        false,
                        $"Estoque insuficiente para {orderCreated.ProductId}. Pedido rejeitado.",
                        stoppingToken
                    );
                }
            }
        }
        catch (DbUpdateException dbEx) when (dbEx.InnerException is SqlException sqlEx && (sqlEx.Number == 2627 || sqlEx.Number == 2601))
        {
            // Concorrência detectada: chave duplicada na tabela ProcessedEvents em caso de execução paralela simultânea
            _logger.LogInformation(
                "[InventoryWorker] CONCORRÊNCIA DETECTADA: Violação de chave primária para EventId {EventId}. Deduplicação paralela garantida pelo SQL Server. Enviando ACK. TraceId: {TraceId}, SpanId: {SpanId}.",
                orderCreated.EventId, activity?.TraceId, activity?.SpanId);

            TelemetryConstants.RecordAttempt("duplicate", orderCreated.ProductId, attempt);
            await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.AddException(ex);

            _logger.LogError(
                ex,
                "[InventoryWorker] [FALHA NA TENTATIVA {Attempt}] Erro ao processar mensagem do pedido {OrderId}. TraceId: {TraceId}, SpanId: {SpanId}.",
                attempt, orderCreated.OrderId, activity?.TraceId, activity?.SpanId);

            TelemetryConstants.RecordAttempt("transient_failure", orderCreated.ProductId, attempt);

            // Registrar falha no estado do pedido para visibilidade do operador
            try
            {
                using var errScope = _scopeFactory.CreateScope();
                var errDb = errScope.ServiceProvider.GetRequiredService<AppDbContext>();
                var orderToUpdate = await errDb.Orders.FirstOrDefaultAsync(o => o.Id == orderCreated.OrderId, stoppingToken);
                if (orderToUpdate is not null)
                {
                    orderToUpdate.RecordProcessingAttempt($"[Tentativa {attempt}] {ex.Message}");
                    await errDb.SaveChangesAsync(stoppingToken);
                }
            }
            catch (Exception recordEx)
            {
                _logger.LogWarning(recordEx, "[InventoryWorker] Não foi possível atualizar estado de erro do pedido {OrderId}.", orderCreated.OrderId);
            }

            // Política de reentrega limitada
            if (attempt < MaxRetries)
            {
                var nextAttempt = attempt + 1;
                _logger.LogWarning(
                    "[InventoryWorker] Reenfileirando evento {EventId} para reentrega (Tentativa {NextAttempt}/{MaxRetries})...",
                    orderCreated.EventId, nextAttempt, MaxRetries);

                // Aguarda um pequeno backoff demonstrativo antes da reentrega
                await Task.Delay(2500, stoppingToken);

                // Re-publicar com tentativa incrementada e trace context preservado
                var retryProps = new BasicProperties
                {
                    ContentType = "application/json",
                    DeliveryMode = DeliveryModes.Persistent,
                    MessageId = ea.BasicProperties.MessageId ?? orderCreated.EventId.ToString(),
                    CorrelationId = ea.BasicProperties.CorrelationId ?? orderCreated.OrderId.ToString(),
                    Headers = new Dictionary<string, object?>()
                };

                if (ea.BasicProperties.Headers != null)
                {
                    foreach (var kvp in ea.BasicProperties.Headers)
                        retryProps.Headers[kvp.Key] = kvp.Value;
                }

                retryProps.Headers["x-attempt-count"] = Encoding.UTF8.GetBytes(nextAttempt.ToString());

                // Manter contexto de rastreio W3C original
                var currentContext = activity?.Context ?? Activity.Current?.Context ?? default;
                if (currentContext != default)
                {
                    var propagationContext = new PropagationContext(currentContext, Baggage.Current);
                    Propagators.DefaultTextMapPropagator.Inject(
                        propagationContext,
                        retryProps.Headers,
                        (headers, key, val) => headers[key] = Encoding.UTF8.GetBytes(val));
                }

                await channel.BasicPublishAsync(
                    exchange: ExchangeName,
                    routingKey: RoutingKey,
                    mandatory: false,
                    basicProperties: retryProps,
                    body: ea.Body,
                    cancellationToken: stoppingToken
                );

                // ACK da mensagem antiga para evitar loop duplicado
                await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
            }
            else
            {
                // Falha permanente: destino observável (DLQ)
                _logger.LogError(
                    "[InventoryWorker] [FALHA PERMANENTE] Limite de {MaxRetries} tentativas excedido para o Pedido {OrderId}. Encaminhando para DLQ observável '{DlxExchange}'.",
                    MaxRetries, orderCreated.OrderId, DlxExchangeName);

                TelemetryConstants.RecordAttempt("permanent_failure", orderCreated.ProductId, attempt);

                try
                {
                    using var deadScope = _scopeFactory.CreateScope();
                    var deadDb = deadScope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var deadOrder = await deadDb.Orders.FirstOrDefaultAsync(o => o.Id == orderCreated.OrderId, stoppingToken);
                    if (deadOrder is not null)
                    {
                        deadOrder.MarkAsFailed($"Falha permanente no worker após {MaxRetries} tentativas: {ex.Message}");
                        await deadDb.SaveChangesAsync(stoppingToken);
                    }
                }
                catch { }

                // Publicar diretamente na DLQ para inspeção
                var dlqProps = new BasicProperties
                {
                    ContentType = "application/json",
                    DeliveryMode = DeliveryModes.Persistent,
                    MessageId = ea.BasicProperties.MessageId,
                    CorrelationId = ea.BasicProperties.CorrelationId,
                    Headers = ea.BasicProperties.Headers != null ? new Dictionary<string, object?>(ea.BasicProperties.Headers) : new Dictionary<string, object?>()
                };
                dlqProps.Headers["x-death-reason"] = Encoding.UTF8.GetBytes(ex.Message);
                dlqProps.Headers["x-death-attempts"] = Encoding.UTF8.GetBytes(attempt.ToString());

                await channel.BasicPublishAsync(
                    exchange: DlxExchangeName,
                    routingKey: DlqRoutingKey,
                    mandatory: false,
                    basicProperties: dlqProps,
                    body: ea.Body,
                    cancellationToken: stoppingToken
                );

                await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
            }
        }
    }
}
