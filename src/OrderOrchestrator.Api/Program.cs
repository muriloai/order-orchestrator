using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OrderOrchestrator.Api.Hubs;
using OrderOrchestrator.Api.Services;
using OrderOrchestrator.Application.DTOs;
using OrderOrchestrator.Application.Interfaces;
using OrderOrchestrator.Application.UseCases;
using OrderOrchestrator.Domain.Entities;
using OrderOrchestrator.Domain.Interfaces;
using OrderOrchestrator.Infrastructure.Messaging;
using OrderOrchestrator.Infrastructure.Observability;
using OrderOrchestrator.Infrastructure.Persistence;
using OrderOrchestrator.Infrastructure.Persistence.Repositories;
using OrderOrchestrator.Infrastructure.Workers;

var builder = WebApplication.CreateBuilder(args);

const string serviceName = "order-api";
const string serviceVersion = "1.0.0";
var otlpEndpoint = builder.Configuration["OpenTelemetry:OtlpEndpoint"] ?? "http://localhost:4317";

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' não encontrada.");

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:4200", "https://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddSignalR();
builder.Services.AddSingleton<IEventStreamNotifier, SignalREventNotifier>();

builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IInventoryRepository, InventoryRepository>();
builder.Services.AddScoped<INotificationLogRepository, NotificationLogRepository>();
builder.Services.AddSingleton<IEventPublisher, RabbitMqPublisher>();

builder.Services.AddScoped<CreateOrderUseCase>();

// NOTA DE ARQUITETURA: O InventoryWorker foi desacoplado e roda em seu próprio processo (OrderOrchestrator.Worker - "inventory-worker").
// A API hospeda apenas o NotificationWorker ou consumidores secundários para SignalR da UI.
builder.Services.AddHostedService<NotificationWorker>();

// OpenTelemetry Resource
var resourceBuilder = ResourceBuilder.CreateDefault()
    .AddService(serviceName: serviceName, serviceVersion: serviceVersion);

// Configuração do OpenTelemetry Logging com OTLP
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddOpenTelemetry(logging =>
{
    logging.SetResourceBuilder(resourceBuilder);
    logging.IncludeFormattedMessage = true;
    logging.IncludeScopes = true;
    logging.AddOtlpExporter(opt => opt.Endpoint = new Uri(otlpEndpoint));
});

// Configuração do OpenTelemetry Traces e Metrics
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing =>
    {
        tracing
            .SetResourceBuilder(resourceBuilder)
            .AddAspNetCoreInstrumentation(options =>
            {
                options.RecordException = true;
            })
            .AddHttpClientInstrumentation()
            .AddSqlClientInstrumentation(options =>
            {
                options.RecordException = true;
            })
            .AddSource(TelemetryConstants.MessagingActivitySourceName)
            .AddOtlpExporter(opt => opt.Endpoint = new Uri(otlpEndpoint));
    })
    .WithMetrics(metrics =>
    {
        metrics
            .SetResourceBuilder(resourceBuilder)
            .AddMeter(TelemetryConstants.InventoryMeterName)
            .AddOtlpExporter(opt => opt.Endpoint = new Uri(otlpEndpoint));
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new()
    {
        Title = "Order Orchestrator API",
        Version = "v1",
        Description = "Microsserviço de orquestração de pedidos com OpenTelemetry, RabbitMQ Topic Exchange e Worker desacoplado."
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    var retries = 10;
    while (retries > 0)
    {
        try
        {
            await db.Database.EnsureCreatedAsync();

            if (!await db.Inventories.AnyAsync())
            {
                db.Inventories.AddRange(
                    new Inventory("PROD-001", "Teclado Mecânico RGB", 10),
                    new Inventory("PROD-002", "Mouse Gamer Sem Fio", 50),
                    new Inventory("PROD-003", "Monitor 27 Polegadas 144Hz", 30)
                );
                await db.SaveChangesAsync();
                logger.LogInformation("Carga inicial de estoque criada com sucesso.");
            }

            if (!await db.SimulationStates.AnyAsync())
            {
                db.SimulationStates.Add(new SimulationState());
                await db.SaveChangesAsync();
            }

            logger.LogInformation("Banco de dados pronto para uso.");
            break;
        }
        catch (Exception ex)
        {
            retries--;
            if (retries == 0)
            {
                logger.LogWarning(ex, "Aviso: Não foi possível conectar ao SQL Server no bootstrap.");
                break;
            }
            logger.LogWarning(ex, "Aguardando SQL Server... Tentando novamente em 3s (restantes: {Retries}). Erro: {ErrorMessage}", retries, ex.Message);
            await Task.Delay(3000);
        }
    }
}

app.UseCors();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Order Orchestrator API v1");
    options.RoutePrefix = "swagger";
});

app.MapGet("/", () => Results.Redirect("/swagger"));

app.MapHub<OrderEventsHub>("/hubs/order-events");

app.MapPost("/orders", async (CreateOrderRequest request, CreateOrderUseCase useCase, CancellationToken cancellationToken) =>
{
    try
    {
        var response = await useCase.ExecuteAsync(request, cancellationToken);
        return Results.Created($"/orders/{response.OrderId}", response);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 500);
    }
})
.WithName("CreateOrder")
.WithSummary("Cria um novo pedido, persiste status Pending e publica evento order.created com EventId e rastreio W3C");

app.MapGet("/orders/{id:guid}", async (Guid id, IOrderRepository repository, CancellationToken cancellationToken) =>
{
    var order = await repository.GetByIdAsync(id, cancellationToken);
    return order is not null ? Results.Ok(order) : Results.NotFound();
})
.WithName("GetOrderById")
.WithSummary("Consulta um pedido por ID exibindo status e erros posteriores registrados pelo worker");

app.MapGet("/orders", async (IOrderRepository repository, CancellationToken cancellationToken) =>
{
    var orders = await repository.GetAllAsync(cancellationToken);
    return Results.Ok(orders);
})
.WithName("GetAllOrders")
.WithSummary("Lista todos os pedidos registrados");

app.MapGet("/inventory", async (IInventoryRepository repository, CancellationToken cancellationToken) =>
{
    var items = await repository.GetAllAsync(cancellationToken);
    return Results.Ok(items);
})
.WithName("GetInventory")
.WithSummary("Consulta estoque atual de todos os produtos");

app.MapPost("/inventory/reset", async (AppDbContext db, CancellationToken cancellationToken) =>
{
    db.Inventories.RemoveRange(db.Inventories);
    await db.SaveChangesAsync(cancellationToken);

    db.Inventories.AddRange(
        new Inventory("PROD-001", "Teclado Mecânico RGB", 100),
        new Inventory("PROD-002", "Mouse Gamer Sem Fio", 50),
        new Inventory("PROD-003", "Monitor 27 Polegadas 144Hz", 30)
    );
    await db.SaveChangesAsync(cancellationToken);

    var items = await db.Inventories.ToListAsync(cancellationToken);
    return Results.Ok(items);
})
.WithName("ResetInventory")
.WithSummary("Restaura o estoque inicial padrão dos produtos");

app.MapGet("/notifications", async (INotificationLogRepository repository, CancellationToken cancellationToken) =>
{
    var logs = await repository.GetAllAsync(cancellationToken);
    return Results.Ok(logs);
})
.WithName("GetNotificationLogs")
.WithSummary("Consulta os logs de notificações disparadas pelos workers");

// ==============================================================================
// ENDPOINTS DE DEMONSTRAÇÃO E ROTEIRO DE ACEITE (Cenário 10 -> 7 -> 7)
// ==============================================================================

app.MapPost("/demo/reset-scenario", async (AppDbContext db, CancellationToken cancellationToken) =>
{
    // Reseta estoque do produto da demonstração para exatamente 10 unidades
    var prod1 = await db.Inventories.FirstOrDefaultAsync(i => i.ProductId == "PROD-001", cancellationToken);
    if (prod1 is null)
    {
        prod1 = new Inventory("PROD-001", "Teclado Mecânico RGB", 10);
        db.Inventories.Add(prod1);
    }
    else
    {
        db.Inventories.Remove(prod1);
        await db.SaveChangesAsync(cancellationToken);
        prod1 = new Inventory("PROD-001", "Teclado Mecânico RGB", 10);
        db.Inventories.Add(prod1);
    }

    // Limpar simulação
    var sim = await db.SimulationStates.FirstOrDefaultAsync(cancellationToken);
    if (sim is null)
    {
        sim = new SimulationState();
        db.SimulationStates.Add(sim);
    }
    sim.Reset();

    await db.SaveChangesAsync(cancellationToken);

    return Results.Ok(new
    {
        message = "Cenário preparado com sucesso para demonstração!",
        product = "PROD-001",
        initialBalance = 10,
        expectedSequence = "10 -> 7 -> 7"
    });
})
.WithName("ResetScenario")
.WithSummary("Prepara o cenário inicial: PROD-001 com 10 unidades e falhas limpas");

app.MapPost("/demo/faults/transient-db", async (bool enable, AppDbContext db, CancellationToken cancellationToken) =>
{
    var sim = await db.SimulationStates.FirstOrDefaultAsync(cancellationToken);
    if (sim is null)
    {
        sim = new SimulationState();
        db.SimulationStates.Add(sim);
    }
    sim.FailTransientDbOnFirstAttempt = enable;
    sim.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync(cancellationToken);

    return Results.Ok(new
    {
        message = enable
            ? "Falha transitória ativada no worker (Tentativa 1 simulará erro de banco antes do commit)."
            : "Falha transitória desativada.",
        failTransientDbOnFirstAttempt = enable
    });
})
.WithName("ToggleTransientDbFault")
.WithSummary("Injeta ou desativa falha transitória de acesso ao banco antes do commit");

app.MapPost("/demo/faults/post-commit-crash", async (bool enable, AppDbContext db, CancellationToken cancellationToken) =>
{
    var sim = await db.SimulationStates.FirstOrDefaultAsync(cancellationToken);
    if (sim is null)
    {
        sim = new SimulationState();
        db.SimulationStates.Add(sim);
    }
    sim.SimulatePostCommitCrash = enable;
    sim.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync(cancellationToken);

    return Results.Ok(new
    {
        message = enable
            ? "Queda pós-commit ativada (Worker comitará no SQL Server mas cairá/rejeitará ANTES do ACK para simular reentrega)."
            : "Queda pós-commit desativada.",
        simulatePostCommitCrash = enable
    });
})
.WithName("TogglePostCommitCrashFault")
.WithSummary("Injeta simulação de queda após commit da transação e antes do ACK");

app.MapGet("/demo/status", async (AppDbContext db, CancellationToken cancellationToken) =>
{
    var inventory = await db.Inventories.FirstOrDefaultAsync(i => i.ProductId == "PROD-001", cancellationToken);
    var processedCount = await db.ProcessedEvents.CountAsync(cancellationToken);
    var processedEvents = await db.ProcessedEvents
        .OrderByDescending(p => p.ProcessedAt)
        .Take(5)
        .ToListAsync(cancellationToken);
    var sim = await db.SimulationStates.FirstOrDefaultAsync(cancellationToken);
    var recentOrders = await db.Orders
        .OrderByDescending(o => o.CreatedAt)
        .Take(5)
        .ToListAsync(cancellationToken);

    return Results.Ok(new
    {
        productId = "PROD-001",
        currentBalance = inventory?.AvailableQuantity ?? 0,
        processedEventsCount = processedCount,
        simulationState = sim,
        recentOrders,
        recentProcessedEvents = processedEvents
    });
})
.WithName("GetDemoStatus")
.WithSummary("Retorna o estado persistido do cenário: saldo de estoque, deduplicação e pedidos");

app.MapPost("/demo/publish-duplicate-event", async (Guid eventId, Guid orderId, string productId, int quantity, IEventPublisher publisher, CancellationToken cancellationToken) =>
{
    var evt = new OrderCreatedEvent(
        eventId,
        orderId,
        "Cliente Teste Reenvio",
        productId,
        quantity,
        quantity * 100m,
        DateTime.UtcNow
    );

    await publisher.PublishAsync("order.created", evt, cancellationToken);
    return Results.Ok(new
    {
        message = "Evento duplicado publicado diretamente na fila para testar deduplicação/idempotência.",
        eventId,
        orderId
    });
})
.WithName("PublishDuplicateEvent")
.WithSummary("Publica manualmente um evento com EventId idêntico para testar idempotência");

app.Run();
