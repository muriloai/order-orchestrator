using Microsoft.EntityFrameworkCore;
using OrderOrchestrator.Application.DTOs;
using OrderOrchestrator.Application.Interfaces;
using OrderOrchestrator.Application.UseCases;
using OrderOrchestrator.Domain.Entities;
using OrderOrchestrator.Domain.Interfaces;
using OrderOrchestrator.Infrastructure.Messaging;
using OrderOrchestrator.Infrastructure.Persistence;
using OrderOrchestrator.Infrastructure.Persistence.Repositories;
using OrderOrchestrator.Infrastructure.Workers;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' não encontrada.");

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString, sqlOptions =>
    {
        sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(5),
            errorNumbersToAdd: null);
    });
});

builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IInventoryRepository, InventoryRepository>();
builder.Services.AddScoped<INotificationLogRepository, NotificationLogRepository>();
builder.Services.AddSingleton<IEventPublisher, RabbitMqPublisher>();

builder.Services.AddScoped<CreateOrderUseCase>();

builder.Services.AddHostedService<InventoryWorker>();
builder.Services.AddHostedService<NotificationWorker>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new()
    {
        Title = "Order Orchestrator API",
        Version = "v1",
        Description = "Microsserviço de orquestração de pedidos com EDA (RabbitMQ Topic Exchange) e Clean Architecture em .NET 10"
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
                    new Inventory("PROD-001", "Teclado Mecânico RGB", 100),
                    new Inventory("PROD-002", "Mouse Gamer Sem Fio", 50),
                    new Inventory("PROD-003", "Monitor 27 Polegadas 144Hz", 30)
                );
                await db.SaveChangesAsync();
                logger.LogInformation("Carga inicial de estoque criada com sucesso.");
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
            logger.LogWarning("Aguardando SQL Server... Tentando novamente em 3s (restantes: {Retries}).", retries);
            await Task.Delay(3000);
        }
    }
}

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Order Orchestrator API v1");
    options.RoutePrefix = string.Empty;
});

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
.WithSummary("Cria um novo pedido e publica evento order.created");

app.MapGet("/orders/{id:guid}", async (Guid id, IOrderRepository repository, CancellationToken cancellationToken) =>
{
    var order = await repository.GetByIdAsync(id, cancellationToken);
    return order is not null ? Results.Ok(order) : Results.NotFound();
})
.WithName("GetOrderById")
.WithSummary("Consulta um pedido por ID");

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

app.MapGet("/notifications", async (INotificationLogRepository repository, CancellationToken cancellationToken) =>
{
    var logs = await repository.GetAllAsync(cancellationToken);
    return Results.Ok(logs);
})
.WithName("GetNotificationLogs")
.WithSummary("Consulta os logs de notificações disparadas pelos workers");

app.Run();
