# ==============================================================================
# Script de Criação da Solução .NET 10 - OrderOrchestrator
# Clean Architecture: Domain, Application, Infrastructure, Api, Worker
# ==============================================================================

Write-Host "Iniciando criação da solução OrderOrchestrator (.NET 10)..." -ForegroundColor Cyan

# 1. Criação da Solution
dotnet new sln -n OrderOrchestrator --force

# 2. Criação dos Projetos (Clean Architecture)
Write-Host "Criando projetos da Clean Architecture..." -ForegroundColor Cyan
dotnet new classlib -n OrderOrchestrator.Domain -o src/OrderOrchestrator.Domain -f net10.0 --force
dotnet new classlib -n OrderOrchestrator.Application -o src/OrderOrchestrator.Application -f net10.0 --force
dotnet new classlib -n OrderOrchestrator.Infrastructure -o src/OrderOrchestrator.Infrastructure -f net10.0 --force
dotnet new webapi -n OrderOrchestrator.Api -o src/OrderOrchestrator.Api -f net10.0 --force
dotnet new worker -n OrderOrchestrator.Worker -o src/OrderOrchestrator.Worker -f net10.0 --force

# 3. Adicionar projetos à Solution
Write-Host "Adicionando projetos à solution..." -ForegroundColor Cyan
dotnet sln OrderOrchestrator.sln add src/OrderOrchestrator.Domain/OrderOrchestrator.Domain.csproj
dotnet sln OrderOrchestrator.sln add src/OrderOrchestrator.Application/OrderOrchestrator.Application.csproj
dotnet sln OrderOrchestrator.sln add src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj
dotnet sln OrderOrchestrator.sln add src/OrderOrchestrator.Api/OrderOrchestrator.Api.csproj
dotnet sln OrderOrchestrator.sln add src/OrderOrchestrator.Worker/OrderOrchestrator.Worker.csproj

# Caso o .NET 10 tenha criado .slnx
if (Test-Path "OrderOrchestrator.slnx") {
    dotnet sln OrderOrchestrator.slnx add src/OrderOrchestrator.Domain/OrderOrchestrator.Domain.csproj
    dotnet sln OrderOrchestrator.slnx add src/OrderOrchestrator.Application/OrderOrchestrator.Application.csproj
    dotnet sln OrderOrchestrator.slnx add src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj
    dotnet sln OrderOrchestrator.slnx add src/OrderOrchestrator.Api/OrderOrchestrator.Api.csproj
    dotnet sln OrderOrchestrator.slnx add src/OrderOrchestrator.Worker/OrderOrchestrator.Worker.csproj
}

# 4. Configurar Referências entre Projetos
Write-Host "Configurando referências de projetos..." -ForegroundColor Cyan
dotnet add src/OrderOrchestrator.Application/OrderOrchestrator.Application.csproj reference src/OrderOrchestrator.Domain/OrderOrchestrator.Domain.csproj
dotnet add src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj reference src/OrderOrchestrator.Domain/OrderOrchestrator.Domain.csproj
dotnet add src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj reference src/OrderOrchestrator.Application/OrderOrchestrator.Application.csproj
dotnet add src/OrderOrchestrator.Api/OrderOrchestrator.Api.csproj reference src/OrderOrchestrator.Application/OrderOrchestrator.Application.csproj
dotnet add src/OrderOrchestrator.Api/OrderOrchestrator.Api.csproj reference src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj
dotnet add src/OrderOrchestrator.Worker/OrderOrchestrator.Worker.csproj reference src/OrderOrchestrator.Domain/OrderOrchestrator.Domain.csproj
dotnet add src/OrderOrchestrator.Worker/OrderOrchestrator.Worker.csproj reference src/OrderOrchestrator.Application/OrderOrchestrator.Application.csproj
dotnet add src/OrderOrchestrator.Worker/OrderOrchestrator.Worker.csproj reference src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj

# 5. Instalação dos Pacotes NuGet
Write-Host "Instalando pacotes NuGet..." -ForegroundColor Cyan
dotnet add src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj package Microsoft.EntityFrameworkCore.SqlServer --version 10.0.11
dotnet add src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj package Microsoft.EntityFrameworkCore.Design --version 10.0.11
dotnet add src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj package RabbitMQ.Client --version 7.2.2
dotnet add src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj package Microsoft.Extensions.Hosting.Abstractions --version 10.0.2
dotnet add src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj package OpenTelemetry --version 1.20.1
dotnet add src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj package OpenTelemetry.Extensions.Hosting --version 1.20.1
dotnet add src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj package OpenTelemetry.Exporter.OpenTelemetryProtocol --version 1.20.1
dotnet add src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj package OpenTelemetry.Instrumentation.SqlClient --version 1.20.1
dotnet add src/OrderOrchestrator.Infrastructure/OrderOrchestrator.Infrastructure.csproj package OpenTelemetry.Instrumentation.Http --version 1.20.1

dotnet add src/OrderOrchestrator.Api/OrderOrchestrator.Api.csproj package Microsoft.EntityFrameworkCore.Design --version 10.0.11
dotnet add src/OrderOrchestrator.Api/OrderOrchestrator.Api.csproj package Swashbuckle.AspNetCore --version 10.2.3
dotnet add src/OrderOrchestrator.Api/OrderOrchestrator.Api.csproj package OpenTelemetry.Instrumentation.AspNetCore --version 1.20.1

# 6. Limpeza de arquivos de template padrão
Remove-Item -Path "src/OrderOrchestrator.Domain/Class1.cs" -ErrorAction SilentlyContinue
Remove-Item -Path "src/OrderOrchestrator.Application/Class1.cs" -ErrorAction SilentlyContinue
Remove-Item -Path "src/OrderOrchestrator.Infrastructure/Class1.cs" -ErrorAction SilentlyContinue
Remove-Item -Path "src/OrderOrchestrator.Worker/Worker.cs" -ErrorAction SilentlyContinue

Write-Host "Solução OrderOrchestrator criada com sucesso!" -ForegroundColor Green
