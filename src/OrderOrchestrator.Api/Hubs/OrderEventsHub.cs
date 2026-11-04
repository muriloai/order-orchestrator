namespace OrderOrchestrator.Api.Hubs;

using Microsoft.AspNetCore.SignalR;

public class OrderEventsHub : Hub
{
    public async Task SendMessage(string user, string message)
    {
        await Clients.All.SendAsync("ReceiveMessage", user, message);
    }
}
