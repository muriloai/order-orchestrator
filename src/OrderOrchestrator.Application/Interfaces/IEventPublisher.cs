namespace OrderOrchestrator.Application.Interfaces;

public interface IEventPublisher
{
    Task PublishAsync<T>(string routingKey, T eventMessage, CancellationToken cancellationToken = default) where T : class;
}
