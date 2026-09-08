namespace OrderOrchestrator.Infrastructure.Persistence.Repositories;

using Microsoft.EntityFrameworkCore;
using OrderOrchestrator.Domain.Entities;
using OrderOrchestrator.Domain.Interfaces;
using OrderOrchestrator.Infrastructure.Persistence;

public class InventoryRepository : IInventoryRepository
{
    private readonly AppDbContext _context;

    public InventoryRepository(AppDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task<Inventory?> GetByProductIdAsync(string productId, CancellationToken cancellationToken = default)
    {
        return await _context.Inventories.FirstOrDefaultAsync(i => i.ProductId == productId, cancellationToken);
    }

    public async Task UpdateAsync(Inventory inventory, CancellationToken cancellationToken = default)
    {
        _context.Inventories.Update(inventory);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task AddAsync(Inventory inventory, CancellationToken cancellationToken = default)
    {
        await _context.Inventories.AddAsync(inventory, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IEnumerable<Inventory>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Inventories.AsNoTracking().ToListAsync(cancellationToken);
    }
}
