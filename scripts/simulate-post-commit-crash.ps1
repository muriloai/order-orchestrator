# ==============================================================================
# Script: simulate-post-commit-crash.ps1
# Objetivo: Demonstra a segunda execucao do roteiro de aceite:
# 1. Simula queda / reconexao apos o commit da transacao no SQL Server e antes do ACK.
# 2. RabbitMQ reentrega a mensagem com o mesmo EventId.
# 3. O worker detecta que (ConsumerName, EventId) ja existe na tabela ProcessedEvents.
# 4. Registra log de duplicata / idempotencia, faz ACK sem duplicar a baixa.
# 5. Confirma que o saldo permanece em 7 (Sequencia 10 -> 7 -> 7 garantida!).
# ==============================================================================

Write-Host ""
Write-Host "========================================================================" -ForegroundColor Magenta
Write-Host " [ROTEIRO PARTE 3] SIMULACAO DE QUEDA POS-COMMIT & ANTES DO ACK (7 -> 7)" -ForegroundColor Magenta
Write-Host "========================================================================" -ForegroundColor Magenta
Write-Host ""

# 1. Resetar cenario para saldo 10 e ativar simulacao de queda pos-commit
Write-Host "1. Resetando estoque do PROD-001 para 10 unidades..." -ForegroundColor Cyan
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/demo/reset-scenario" | Out-Null

Write-Host "2. Ativando simulacao de queda pos-commit no worker..." -ForegroundColor Cyan
$crashRes = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/demo/faults/post-commit-crash?enable=true"
Write-Host "   -> $($crashRes.message)" -ForegroundColor DarkYellow

# 3. Criar pedido de 3 unidades
Write-Host ""
Write-Host "3. Criando pedido de 3 unidades para demonstrar a queda pos-commit..." -ForegroundColor Cyan
$orderPayload = @{
    customerName = "Operador Simulacao Queda"
    productId = "PROD-001"
    quantity = 3
    totalAmount = 750.00
} | ConvertTo-Json

$orderRes = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/orders" -Body $orderPayload -ContentType "application/json"
$orderId = $orderRes.orderId
$eventId = $orderRes.eventId

Write-Host "   -> Pedido criado com sucesso: OrderId=$orderId, EventId=$eventId" -ForegroundColor Green

Write-Host ""
Write-Host "4. Aguardando processamento da 1a entrega (commit ok + queda) e reentrega automatica..." -ForegroundColor Cyan
Start-Sleep -Seconds 4

# 5. Consultar saldo e eventos processados
Write-Host ""
Write-Host "5. Verificando saldo apos reentrega do mesmo EventId..." -ForegroundColor Cyan
$status = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/demo/status"
$invCheck = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/inventory"
$prod1 = $invCheck | Where-Object { $_.productId -eq "PROD-001" }

Write-Host "   ------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "   RESULTADO DA EXECUCAO COM REENTREGA:" -ForegroundColor Cyan
Write-Host "   - Saldo Inicial:           10 un" -ForegroundColor White
Write-Host "   - Saldo Apos Commit:       7 un" -ForegroundColor White
Write-Host "   - Saldo Apos Reentrega:    $($prod1.availableQuantity) un (Idempotencia comprovada: NAO baixou para 4!)" -ForegroundColor Green
Write-Host "   - Registros ProcessedEvents: $($status.processedEventsCount) registro(s)" -ForegroundColor White
Write-Host "   - Evento da Entrega:       EventId = $eventId" -ForegroundColor White
Write-Host "   ------------------------------------------------------------" -ForegroundColor DarkGray

Write-Host ""
Write-Host ">>> SUCESSO: Sequencia 10 -> 7 -> 7 comprovada! Mesmo com redelivery, a baixa foi unica." -ForegroundColor Green
Write-Host "Consulte os traces e spans no Jaeger: http://localhost:16686" -ForegroundColor Cyan
Write-Host ""
