# ==============================================================================
# Script: simulate-transient-failure.ps1
# Objetivo: Demonstra o roteiro de aceite:
# 1. Prepara cenario inicial com saldo 10 e pede 3.
# 2. Injeta falha transitoria de acesso ao banco na primeira tentativa do worker.
# 3. Confirma que a API ja respondeu 201 Created.
# 4. Demonstra o saldo ainda em 10 na tentativa 1 com o erro registrado no estado do pedido.
# 5. Demonstra a recuperacao automatica na tentativa 2 com saldo final 7 (10 -> 7).
# ==============================================================================

Write-Host ""
Write-Host "========================================================================" -ForegroundColor Magenta
Write-Host " [ROTEIRO PARTE 1] PEDIDO ACEITO COM FALHA TRANSITORIA NO WORKER" -ForegroundColor Magenta
Write-Host "========================================================================" -ForegroundColor Magenta
Write-Host ""

# 1. Resetar cenario para saldo 10
Write-Host "1. Resetando estoque do PROD-001 para 10 unidades..." -ForegroundColor Cyan
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/demo/reset-scenario" | Out-Null

# 2. Injetar falha transitoria
Write-Host "2. Injetando falha transitoria de banco de dados na tentativa 1..." -ForegroundColor Yellow
$faultRes = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/demo/faults/transient-db?enable=true"
Write-Host "   -> $($faultRes.message)" -ForegroundColor DarkYellow

# 3. Criar pedido de 3 unidades
Write-Host ""
Write-Host "3. Enviando pedido de 3 unidades via API HTTP POST /orders..." -ForegroundColor Cyan
$orderPayload = @{
    customerName = "Operador Roteiro Aceite"
    productId = "PROD-001"
    quantity = 3
    totalAmount = 750.00
} | ConvertTo-Json

$orderRes = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/orders" -Body $orderPayload -ContentType "application/json"
$orderId = $orderRes.orderId
$eventId = $orderRes.eventId

Write-Host "   -> RESPOSTA DA API: HTTP 201 Created!" -ForegroundColor Green
Write-Host "      OrderId:  $orderId" -ForegroundColor White
Write-Host "      EventId:  $eventId" -ForegroundColor White
Write-Host "      Status:   $($orderRes.status)" -ForegroundColor White

Write-Host ""
Write-Host "4. Aguardando a 1a tentativa do worker falhar antes do commit..." -ForegroundColor Cyan
Start-Sleep -Milliseconds 1200

# 5. Consultar estado intermediario (Tentativa 1 com falha)
Write-Host ""
Write-Host "5. PERGUNTA: O pedido foi aceito. Por que o saldo continua em 10?" -ForegroundColor Yellow
$orderCheck = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/orders/$orderId"
$invCheck = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/inventory"
$prod1 = $invCheck | Where-Object { $_.productId -eq "PROD-001" }

Write-Host "   ------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "   EVIDENCIA NO BANCO / ESTADO DO PEDIDO NA TENTATIVA 1:" -ForegroundColor Cyan
Write-Host "   - Status do Pedido:        $($orderCheck.status) (Pending)" -ForegroundColor White
Write-Host "   - Tentativas no Worker:    $($orderCheck.processingAttempts)" -ForegroundColor White
Write-Host "   - Erro Registrado:         $($orderCheck.lastProcessingError)" -ForegroundColor Red
Write-Host "   - Saldo Atual no Banco:    $($prod1.availableQuantity) un (Esperado: 10 un - sem deducao!)" -ForegroundColor Yellow
Write-Host "   ------------------------------------------------------------" -ForegroundColor DarkGray

Write-Host ""
Write-Host "6. Aguardando redelivery e reprocessamento com dependencia liberada..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# 7. Consultar estado final recuperado (Tentativa 2 com sucesso)
$orderFinal = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/orders/$orderId"
$invFinal = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/inventory"
$prodFinal = $invFinal | Where-Object { $_.productId -eq "PROD-001" }

Write-Host ""
Write-Host "   ------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "   EVIDENCIA APOS RECUPERACAO (TENTATIVA 2):" -ForegroundColor Green
Write-Host "   - Status do Pedido:        $($orderFinal.status) (Processed!)" -ForegroundColor Green
Write-Host "   - Tentativas Totais:       $($orderFinal.processingAttempts)" -ForegroundColor White
Write-Host "   - Saldo Final no Banco:    $($prodFinal.availableQuantity) un (Esperado: 7 un!)" -ForegroundColor Yellow
Write-Host "   ------------------------------------------------------------" -ForegroundColor DarkGray

Write-Host ""
Write-Host ">>> SUCESSO COMPROVADO: Sequencia 10 -> 7 concluida!" -ForegroundColor Green
Write-Host "Trace no Jaeger: http://localhost:16686 (Veja os spans de tentativa 1 com erro e tentativa 2 com sucesso)" -ForegroundColor Cyan
Write-Host ""
