namespace OrderOrchestrator.Domain.Entities;

public class SimulationState
{
    public int Id { get; set; }
    public bool FailTransientDbOnFirstAttempt { get; set; }
    public bool SimulatePostCommitCrash { get; set; }
    public string? LastFaultTriggered { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public void Reset()
    {
        FailTransientDbOnFirstAttempt = false;
        SimulatePostCommitCrash = false;
        LastFaultTriggered = null;
        UpdatedAt = DateTime.UtcNow;
    }
}
