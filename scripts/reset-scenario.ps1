# ==============================================================================
# Script: reset-scenario.ps1
# Objetivo: Prepara o cenário inicial com exatamente 10 unidades de PROD-001
# e limpa flags de simulação de falhas.
# ==============================================================================

Write-Host ">>> [RESET] Preparando cenário de teste inicial (Saldo = 10)..." -ForegroundColor Cyan

$response = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/demo/reset-scenario" -ContentType "application/json"
$response | ConvertTo-Json -Depth 4 | Write-Host -ForegroundColor Green

Write-Host ">>> Cenário pronto: PROD-001 com 10 unidades. Sequência esperada: 10 -> 7 -> 7." -ForegroundColor Yellow
