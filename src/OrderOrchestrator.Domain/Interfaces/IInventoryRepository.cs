namespace OrderOrchestrator.Domain.Interfaces;

using OrderOrchestrator.Domain.Entities;

public interface IInventoryRepository
{
    Task<Inventory?> GetByProductIdAsync(string productId, CancellationToken cancellationToken = default);
    Task UpdateAsync(Inventory inventory, CancellationToken cancellationToken = default);
    Task AddAsync(Inventory inventory, CancellationToken cancellationToken = default);
    Task<IEnumerable<Inventory>> GetAllAsync(CancellationToken cancellationToken = default);
}
