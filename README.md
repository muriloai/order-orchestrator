# Order Orchestrator

Microsserviço de processamento de pedidos baseado em arquitetura orientada a eventos.

## Tecnologias

* .NET 10
* C# 14
* RabbitMQ
* SQL Server
* Entity Framework Core
* Docker Compose

## Estrutura da Solução

* OrderOrchestrator.Domain. Regras centrais de negócio. Contratos de repositório. Entidades com identificadores Guid v7.
* OrderOrchestrator.Application. Casos de uso. Contratos de mensageria. DTOs.
* OrderOrchestrator.Infrastructure. Mapeamento relacional com EF Core. Implementação do publicador no RabbitMQ. Serviços em segundo plano.
* OrderOrchestrator.Api. Minimal APIs. Documentação Swagger. Inicialização do banco de dados.

## Mensageria

Exchange do tipo topic chamada order-events.

* Fila inventory-queue. Filtro order.created. Deduz estoque no banco. Marca pedido como processado.
* Fila notification-queue. Filtro order.#. Grava registro na tabela NotificationLogs.

## Como Executar

Iniciar os serviços no Docker.

```bash
docker compose up -d
```

Executar a API.

```bash
dotnet run --project src/OrderOrchestrator.Api --launch-profile http
```

## Endpoints HTTP

* POST /orders. Registra pedido. Publica evento na exchange.
* GET /orders/{id}. Retorna dados de um pedido.
* GET /orders. Retorna lista completa de pedidos.
* GET /inventory. Retorna estoque atualizado.
* GET /notifications. Retorna histórico de notificações.
* GET /. Interface Swagger UI.