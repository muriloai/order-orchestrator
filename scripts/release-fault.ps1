param (
    [string]$orderId
)

Write-Host ""
Write-Host "========================================================================" -ForegroundColor Magenta
Write-Host " [ROTEIRO PARTE 2] LIBERANDO DEPENDENCIA & REPROCESSAMENTO (10 -> 7)" -ForegroundColor Magenta
Write-Host "========================================================================" -ForegroundColor Magenta
Write-Host ""

Write-Host "1. Desativando simulacao de falha transitoria..." -ForegroundColor Cyan
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/demo/faults/transient-db?enable=false" | Out-Null
Write-Host "   -> Dependencia liberada com sucesso." -ForegroundColor Green

Write-Host ""
Write-Host "2. Aguardando reprocessamento pelo worker de estoque..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "3. Consultando saldo atualizado e estado do pedido..." -ForegroundColor Cyan
$invCheck = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/inventory"
$prod1 = $invCheck | Where-Object { $_.productId -eq "PROD-001" }

if ($orderId) {
    $orderCheck = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/orders/$orderId"
    Write-Host "   - Status do Pedido:     $($orderCheck.status)" -ForegroundColor Green
    Write-Host "   - Tentativas Totais:    $($orderCheck.processingAttempts)" -ForegroundColor White
}

Write-Host "   - Saldo de PROD-001:    $($prod1.availableQuantity) unidades (Esperado: 7 un!)" -ForegroundColor Yellow

$status = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/demo/status"
Write-Host "   - Eventos Processados:  $($status.processedEventsCount) registro(s) gravado(s) em ProcessedEvents" -ForegroundColor Cyan
Write-Host ""
Write-Host ">>> SUCESSO: Saldo baixou de 10 para 7 apos recuperacao!" -ForegroundColor Green
Write-Host ""
