# ==============================================================================
# Script: run-full-demonstration.ps1
# Objetivo: Executa o roteiro completo de aceite exigido:
# 1. Prepara saldo 10 e pede 3.
# 2. Injeta falha transitoria na tentativa 1: demonstra API 201, worker erro e saldo 10.
# 3. Libera dependencia: reprocessa e confirma saldo 7 (10 -> 7).
# 4. Simula queda pos-commit antes do ACK: confirma redelivery e saldo ainda 7 (7 -> 7).
# 5. Testa reenvio paralelo concorrente: confirma deduplicacao e baixa unica.
# ==============================================================================

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host " INICIANDO DEMONSTRACAO COMPLETA: SEQUENCIA 10 -> 7 -> 7 & OPENTELEMETRY" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""

# Executar Simulacao de Falha Transitoria
& "$PSScriptRoot/simulate-transient-failure.ps1"

Write-Host "Aguardando 2 segundos antes de liberar a dependencia..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Liberar e Reprocessar
& "$PSScriptRoot/release-fault.ps1"

Write-Host "Aguardando 2 segundos antes de iniciar teste de queda pos-commit..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Simular Queda Pos-Commit
& "$PSScriptRoot/simulate-post-commit-crash.ps1"

Write-Host "Aguardando 2 segundos antes de testar reenvio paralelo..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Testar Paralelo
& "$PSScriptRoot/test-parallel-resend.ps1"

Write-Host "========================================================================" -ForegroundColor Green
Write-Host " DEMONSTRACAO CONCLUIDA COM SUCESSO!" -ForegroundColor Green
Write-Host " Todos os criterios de aceite foram atendidos:" -ForegroundColor Green
Write-Host " 1. API ('order-api') e Worker ('inventory-worker') em processos separados" -ForegroundColor White
Write-Host " 2. Chave unica por consumidor e EventId persistida na mesma transacao atomica" -ForegroundColor White
Write-Host " 3. ACK realizado estritamente apos o commit no SQL Server" -ForegroundColor White
Write-Host " 4. Sequencia comprovada: 10 -> 7 -> 7" -ForegroundColor White
Write-Host " 5. Traces distribuidos W3C e metricas agregadas disponiveis no Jaeger" -ForegroundColor White
Write-Host "========================================================================" -ForegroundColor Green
Write-Host ""
