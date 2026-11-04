using Microsoft.EntityFrameworkCore;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OrderOrchestrator.Application.Interfaces;
using OrderOrchestrator.Domain.Interfaces;
using OrderOrchestrator.Infrastructure.Messaging;
using OrderOrchestrator.Infrastructure.Observability;
using OrderOrchestrator.Infrastructure.Persistence;
using OrderOrchestrator.Infrastructure.Persistence.Repositories;
using OrderOrchestrator.Infrastructure.Workers;

var builder = Host.CreateApplicationBuilder(args);

const string serviceName = "inventory-worker";
const string serviceVersion = "1.0.0";
var otlpEndpoint = builder.Configuration["OpenTelemetry:OtlpEndpoint"] ?? "http://localhost:4317";

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' não encontrada.");

// Configurar EF Core com SQL Server
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);
});

// Injeção de Dependências
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IInventoryRepository, InventoryRepository>();
builder.Services.AddScoped<INotificationLogRepository, NotificationLogRepository>();
builder.Services.AddSingleton<IEventPublisher, RabbitMqPublisher>();

// Registrar o Hosted Service exclusivo do Worker de Estoque
builder.Services.AddHostedService<InventoryWorker>();

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
            .AddSource(TelemetryConstants.MessagingActivitySourceName)
            .AddSqlClientInstrumentation(options =>
            {
                options.RecordException = true;
            })
            .AddHttpClientInstrumentation()
            .AddOtlpExporter(opt => opt.Endpoint = new Uri(otlpEndpoint));
    })
    .WithMetrics(metrics =>
    {
        metrics
            .SetResourceBuilder(resourceBuilder)
            .AddMeter(TelemetryConstants.InventoryMeterName)
            .AddOtlpExporter(opt => opt.Endpoint = new Uri(otlpEndpoint));
    });

var host = builder.Build();

Console.Title = "OrderOrchestrator.Worker (inventory-worker)";
Console.WriteLine($"[inventory-worker] Inicializando worker de estoque com OpenTelemetry -> {otlpEndpoint}...");

await host.RunAsync();
