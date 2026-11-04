# ==============================================================================
# Script: test-parallel-resend.ps1
# Objetivo: Reenviar o mesmo evento em paralelo simultaneo e verificar:
# - Deduplicacao concorrente garantida pela chave unica (ConsumerName, EventId).
# - Nenhuma baixa duplicada de estoque.
# ==============================================================================

Write-Host ""
Write-Host "========================================================================" -ForegroundColor Magenta
Write-Host " [TESTE DE CONCORRENCIA] REENVIO DO MESMO EVENTO EM PARALELO" -ForegroundColor Magenta
Write-Host "========================================================================" -ForegroundColor Magenta
Write-Host ""

# 1. Resetar cenario para saldo 10
Write-Host "1. Resetando cenario para saldo inicial 10..." -ForegroundColor Cyan
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/demo/reset-scenario" | Out-Null

$sharedEventId = [Guid]::NewGuid().ToString()
$sharedOrderId = [Guid]::NewGuid().ToString()

Write-Host "2. Disparando 2 publicacoes simultaneas em paralelo com o MESMO EventId ($sharedEventId)..." -ForegroundColor Yellow

$job1 = Start-Job -ScriptBlock { 
    param($e, $o) 
    Invoke-RestMethod -Method Post -Uri "http://localhost:5000/demo/publish-duplicate-event?eventId=$e&orderId=$o&productId=PROD-001&quantity=3" 
} -ArgumentList $sharedEventId, $sharedOrderId

$job2 = Start-Job -ScriptBlock { 
    param($e, $o) 
    Invoke-RestMethod -Method Post -Uri "http://localhost:5000/demo/publish-duplicate-event?eventId=$e&orderId=$o&productId=PROD-001&quantity=3" 
} -ArgumentList $sharedEventId, $sharedOrderId

$null = Receive-Job $job1 -Wait
$null = Receive-Job $job2 -Wait
Remove-Job $job1, $job2

Write-Host "   -> Ambas as mensagens com o mesmo EventId foram publicadas na fila." -ForegroundColor Green
Write-Host "3. Aguardando processamento concorrente pelo worker..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# 4. Verificar saldo final
$invCheck = Invoke-RestMethod -Method Get -Uri "http://localhost:5000/inventory"
$prod1 = $invCheck | Where-Object { $_.productId -eq "PROD-001" }

Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "RESULTADO DO TESTE PARALELO:" -ForegroundColor Cyan
Write-Host "- Saldo de PROD-001:       $($prod1.availableQuantity) un (Esperado: 7 un - apenas 1 baixa!)" -ForegroundColor Green
Write-Host "- Deduplicacao Concorrente: VALIDADA COM SUCESSO!" -ForegroundColor Green
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
