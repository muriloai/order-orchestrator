namespace OrderOrchestrator.Infrastructure.Observability;

using System.Diagnostics;
using System.Diagnostics.Metrics;

public static class TelemetryConstants
{
    public const string MessagingActivitySourceName = "OrderOrchestrator.Messaging";
    public const string InventoryMeterName = "OrderOrchestrator.Inventory";

    public static readonly ActivitySource ActivitySource = new(MessagingActivitySourceName, "1.0.0");
    public static readonly Meter Meter = new(InventoryMeterName, "1.0.0");

    public static readonly Counter<long> AttemptsCounter = Meter.CreateCounter<long>(
        name: "inventory.order.processing.attempts",
        unit: "attempts",
        description: "Contador agregado de tentativas de processamento de pedidos no worker de estoque por resultado");

    public static void RecordAttempt(string status, string productId, int attempt = 1)
    {
        AttemptsCounter.Add(1,
            new KeyValuePair<string, object?>("status", status),
            new KeyValuePair<string, object?>("product_id", productId),
            new KeyValuePair<string, object?>("attempt", attempt));
    }
}
