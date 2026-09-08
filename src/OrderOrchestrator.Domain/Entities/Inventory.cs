namespace OrderOrchestrator.Domain.Entities;

public class Inventory
{
    public Guid Id { get; private set; }
    public string ProductId { get; private set; } = string.Empty;
    public string ProductName { get; private set; } = string.Empty;
    public int AvailableQuantity { get; private set; }

    protected Inventory() { }

    public Inventory(string productId, string productName, int initialQuantity)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(productId);
        ArgumentException.ThrowIfNullOrWhiteSpace(productName);

        if (initialQuantity < 0)
            throw new ArgumentOutOfRangeException(nameof(initialQuantity), "Initial quantity cannot be negative.");

        Id = Guid.CreateVersion7();
        ProductId = productId;
        ProductName = productName;
        AvailableQuantity = initialQuantity;
    }

    public bool DeductStock(int quantity)
    {
        if (quantity <= 0 || AvailableQuantity < quantity)
            return false;

        AvailableQuantity -= quantity;
        return true;
    }

    public void AddStock(int quantity)
    {
        if (quantity <= 0)
            throw new ArgumentOutOfRangeException(nameof(quantity), "Quantity to add must be positive.");

        AvailableQuantity += quantity;
    }
}
