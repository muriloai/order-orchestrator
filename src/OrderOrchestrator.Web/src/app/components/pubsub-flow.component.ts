import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignalRService } from '../services/signalr.service';

@Component({
  selector: 'app-pubsub-flow',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
      <!-- Ambient Glows -->
      <div class="absolute -top-32 -right-32 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Top Control Bar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/10">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="font-bold text-white text-base tracking-wide">Trilha e Topologia Física do Pub/Sub (RabbitMQ)</h2>
              <span class="text-[11px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                order-events [Topic Exchange]
              </span>
            </div>
            <p class="text-xs text-slate-400">Assista ao vivo a trilha física, a bifurcação de decisão, os buffers das filas, o consumo dos workers e as gravações no SQL Server.</p>
          </div>
        </div>

        <!-- Controls: Speed Selector, Payload Inspector, Reset -->
        <div class="flex items-center flex-wrap gap-2 text-xs">
          <span class="text-slate-400 font-medium">Ritmo da Etapa:</span>
          
          <div class="inline-flex rounded-xl border border-slate-700 bg-slate-950/80 p-0.5 shadow-inner">
            <button
              (click)="signalR.setDelay(5)"
              class="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5"
              [ngClass]="{
                'bg-emerald-600 text-white shadow-md shadow-emerald-600/30': signalR.delaySeconds() === 5,
                'text-slate-400 hover:text-white': signalR.delaySeconds() !== 5
              }"
              title="Intervalo padrão de 5 segundos por etapa para demonstração clara"
            >
              <span>5s (Didático)</span>
            </button>
            <button
              (click)="signalR.setDelay(2)"
              class="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5"
              [ngClass]="{
                'bg-cyan-600 text-white shadow-md shadow-cyan-600/30': signalR.delaySeconds() === 2,
                'text-slate-400 hover:text-white': signalR.delaySeconds() !== 2
              }"
              title="Ritmo acelerado de 2 segundos"
            >
              <span>2s (Rápido)</span>
            </button>
            <button
              (click)="signalR.setDelay(0)"
              class="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5"
              [ngClass]="{
                'bg-indigo-600 text-white shadow-md shadow-indigo-600/30': signalR.delaySeconds() === 0,
                'text-slate-400 hover:text-white': signalR.delaySeconds() !== 0
              }"
              title="Processamento em tempo real instantâneo"
            >
              <span>0s (Instantâneo)</span>
            </button>
          </div>

          @if (signalR.pendingStepsCount() > 0) {
            <span class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold">
              {{ signalR.pendingStepsCount() }} etapas na fila
            </span>
          }

          <button 
            (click)="togglePayloadInspector()"
            class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors flex items-center gap-1.5"
            title="Inspecionar corpo JSON da mensagem"
          >
            <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span>{{ showPayloadInspector() ? 'Fechar Payload' : 'Ver Payload JSON' }}</span>
          </button>

          <button 
            (click)="signalR.resetCounters()" 
            class="text-[11px] text-slate-500 hover:text-slate-300 underline ml-1"
            title="Zerar contadores"
          >
            Zerar contadores
          </button>
        </div>
      </div>

      <!-- Prominent Active Stage Showcase Banner -->
      @if (signalR.currentStep(); as step) {
        <div class="mb-6 p-4 rounded-2xl border border-emerald-500/50 bg-gradient-to-r from-emerald-950/50 via-slate-900/90 to-cyan-950/50 shadow-xl relative overflow-hidden animate-fade-in">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Etapa {{ step.stepNumber }} de {{ step.totalSteps }}
              </span>
              <span class="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
                {{ step.stageName }}
              </span>
              <h3 class="font-bold text-white text-sm tracking-wide">{{ step.title }}</h3>
            </div>

            <!-- Timer & Skip Button -->
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold">
                <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Próxima etapa em: {{ step.remainingSeconds }}s</span>
              </div>
              <button
                (click)="signalR.skipCurrentStep()"
                class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition-colors"
                title="Avançar imediatamente"
              >
                Avançar &rarr;
              </button>
            </div>
          </div>

          <!-- Progress Countdown Bar -->
          <div class="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mb-3">
            <div 
              class="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 transition-all duration-1000 ease-linear rounded-full"
              [style.width.%]="getProgressPercentage()"
            ></div>
          </div>

          <!-- Explanation Text -->
          <p class="text-xs text-slate-200 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            {{ step.description }}
          </p>

          <div class="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span>Pedido: <strong class="text-slate-200 font-mono">#{{ step.orderId.substring(0, 8) }}</strong></span>
            @if (step.customerName) {
              <span>• Cliente: <strong class="text-slate-200">{{ step.customerName }}</strong></span>
            }
            @if (step.routingKey) {
              <span>• Routing Key: <code class="text-orange-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{{ step.routingKey }}</code></span>
            }
            @if (step.productInfo) {
              <span>• Detalhe: <strong class="text-emerald-300 font-mono">{{ step.productInfo }}</strong></span>
            }
          </div>
        </div>
      } @else {
        <!-- Standby Banner -->
        <div class="mb-6 p-4 rounded-2xl border border-slate-800 bg-slate-950/40 text-xs text-slate-400 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
            <span>
              <strong>Modo Didático Ativo ({{ signalR.delaySeconds() }}s por etapa):</strong> 
              Clique em qualquer botão de compra acima para iniciar o fluxo. Cada etapa aguardará {{ signalR.delaySeconds() }}s enquanto você visualiza a trilha, a decisão da exchange, o buffer da fila e a gravação no SQL Server.
            </span>
          </div>
          <span class="text-[11px] font-mono text-slate-500 hidden lg:inline">Broker: RabbitMQ (Topic) • DB: SQL Server 2022</span>
        </div>
      }

      <!-- Collapsible Live Message Payload Inspector -->
      @if (showPayloadInspector()) {
        <div class="mb-6 p-4 rounded-2xl border border-slate-700 bg-slate-950/90 shadow-inner">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
              <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Payload JSON da Mensagem em Trânsito (RabbitMQ Message Body)
            </span>
            <span class="text-[10px] text-slate-500 font-mono">Content-Type: application/json</span>
          </div>
          <pre class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">{{ getFormattedPayload() }}</pre>
        </div>
      }

      <!-- ========================================================================= -->
      <!-- O DADO EM TRÂNSITO: CÁPSULA LUMINOSA DO PACOTE (ACTIVE MOVING PACKET)     -->
      <!-- ========================================================================= -->
      @if (signalR.currentStep(); as step) {
        <div class="mb-6 p-3 rounded-xl border border-slate-700 bg-slate-950/80 shadow-lg flex items-center justify-between gap-3 text-xs animate-pulse">
          <div class="flex items-center gap-2.5 flex-wrap">
            <span class="w-2.5 h-2.5 rounded-full" [ngClass]="getPacketColorClass(step.subStage)"></span>
            <span class="font-bold text-white uppercase tracking-wide text-[11px]">Pacote em Movimento:</span>
            <div class="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-emerald-400 font-bold text-[11px]">
              ID: #{{ step.orderId.substring(0, 8) }}
            </div>
            <span class="text-slate-500">•</span>
            <span class="text-slate-200 font-medium">{{ getSubStageLabel(step.subStage) }}</span>
          </div>

          <div class="flex items-center gap-2 text-[11px] font-mono">
            <span class="text-slate-400">Chave:</span>
            <span class="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-orange-300">{{ step.routingKey || 'order.created' }}</span>
          </div>
        </div>
      }

      <!-- ========================================================================= -->
      <!-- A TRILHA PRINCIPAL: ARQUITETURA VISUAL COMPLETA COM DUTOS E RESULTANTES   -->
      <!-- ========================================================================= -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch relative">

        <!-- ================================================================= -->
        <!-- 1. PRODUCER (OrderOrchestrator.Api) (col 1-3)                     -->
        <!-- ================================================================= -->
        <div 
          class="xl:col-span-3 flex flex-col justify-between p-4 rounded-2xl border transition-all duration-500 relative"
          [ngClass]="{
            'bg-emerald-950/60 border-emerald-400 ring-2 ring-emerald-400/50 shadow-xl shadow-emerald-500/20 scale-[1.02] animate-pulse-glow-emerald': signalR.activeNode() === 'producer',
            'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700': signalR.activeNode() !== 'producer'
          }"
        >
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PRODUCER</span>
              @if (signalR.activeNode() === 'producer') {
                <span class="text-[10px] font-bold text-emerald-400 animate-pulse flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Despachando...
                </span>
              } @else {
                <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              }
            </div>

            <h3 class="font-bold text-white mt-2 text-sm">OrderOrchestrator.Api</h3>
            <p class="text-[11px] text-slate-400 mt-1">
              Recebe <code>POST /orders</code>, grava o pedido no SQL Server como <code>Pending</code> e publica o evento.
            </p>

            <!-- Trilha de Saída e Pacote Emitido -->
            <div class="mt-4 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[10px]">
              <div class="flex items-center justify-between text-slate-400 mb-1.5">
                <span>Duto de Publicação:</span>
                <span class="font-mono text-emerald-400 font-bold" [ngClass]="signalR.activeNode() === 'producer' ? 'animate-pulse' : ''">
                  {{ signalR.activeNode() === 'producer' ? 'Emitindo Pacote' : 'Aguardando Disparo' }}
                </span>
              </div>

              <!-- Duto Laser -->
              <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div 
                  class="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-700 rounded-full"
                  [ngClass]="signalR.activeNode() === 'producer' ? 'w-full animate-beam-fast' : 'w-1'"
                ></div>
              </div>

              @if (signalR.activeNode() === 'producer') {
                <div class="mt-2 text-[10px] font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 p-1.5 rounded flex items-center justify-between animate-pulse">
                  <span>Pacote: #{{ getActiveOrderId() }}</span>
                  <span class="text-[9px] bg-emerald-500/20 px-1 rounded">order.created</span>
                </div>
              }
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span class="text-slate-500">Publicações Totais:</span>
            <span class="font-mono font-bold text-emerald-400">{{ signalR.counters().published }}</span>
          </div>
        </div>

        <!-- ================================================================= -->
        <!-- 2. A BIFURCAÇÃO E SUA DECISÃO: TOPIC EXCHANGE (col 4-6)           -->
        <!-- ================================================================= -->
        <div 
          class="xl:col-span-3 flex flex-col justify-between p-4 rounded-2xl border transition-all duration-500 relative"
          [ngClass]="{
            'bg-orange-950/60 border-orange-400 ring-2 ring-orange-400/50 shadow-xl shadow-orange-500/20 scale-[1.02] animate-pulse-glow-orange': signalR.activeNode() === 'exchange',
            'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700': signalR.activeNode() !== 'exchange'
          }"
        >
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">TOPIC EXCHANGE</span>
              @if (signalR.activeNode() === 'exchange') {
                <span class="text-[10px] font-bold text-orange-400 animate-pulse flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping"></span>
                  Avaliando Decisão...
                </span>
              } @else {
                <svg class="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              }
            </div>

            <h3 class="font-bold text-white mt-2 text-sm">order-events</h3>
            <p class="text-[11px] text-slate-400 mt-1">
              Inspeciona a routing key do pacote e executa o algoritmo de decisão para cada fila vinculada.
            </p>

            <!-- PAINEL DA BIFURCAÇÃO E SUA DECISÃO -->
            <div class="mt-3 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-[10px]">
              <div class="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800">
                <span class="font-semibold text-slate-300">Decisão de Roteamento:</span>
                <span class="font-mono text-orange-300 font-bold">key: order.created</span>
              </div>

              <!-- Decisão Branch 1 (Estoque) -->
              <div class="p-2 rounded-lg border transition-all"
                [ngClass]="isExchangeBranchActive('inventory') ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-200' : 'border-slate-800 bg-slate-950/60 text-slate-400'"
              >
                <div class="flex items-center justify-between font-mono">
                  <span class="font-bold text-cyan-300">Trilha A (Estoque):</span>
                  <span class="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">order.created</span>
                </div>
                <div class="mt-1 flex items-center justify-between text-[10px]">
                  <span>Teste: chave == binding?</span>
                  <span class="font-bold" [ngClass]="isExchangeBranchActive('inventory') ? 'text-cyan-400' : 'text-slate-500'">
                    {{ isExchangeBranchActive('inventory') ? 'MATCH EXATO (Duplica)' : 'Aguardando' }}
                  </span>
                </div>
              </div>

              <!-- Decisão Branch 2 (Notificações) -->
              <div class="p-2 rounded-lg border transition-all"
                [ngClass]="isExchangeBranchActive('notification') ? 'border-violet-500/60 bg-violet-950/40 text-violet-200' : 'border-slate-800 bg-slate-950/60 text-slate-400'"
              >
                <div class="flex items-center justify-between font-mono">
                  <span class="font-bold text-violet-300">Trilha B (Notificação):</span>
                  <span class="text-[9px] px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300">order.#</span>
                </div>
                <div class="mt-1 flex items-center justify-between text-[10px]">
                  <span>Teste: chave combina com wildcard?</span>
                  <span class="font-bold" [ngClass]="isExchangeBranchActive('notification') ? 'text-violet-400' : 'text-slate-500'">
                    {{ isExchangeBranchActive('notification') ? 'MATCH CURINGA (Duplica)' : 'Aguardando' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span class="text-slate-500">Decisões Executadas:</span>
            <span class="font-mono font-bold text-orange-400">{{ signalR.counters().published }}</span>
          </div>
        </div>

        <!-- ================================================================= -->
        <!-- 3 & 4. AS FILAS, CONSUMERS E RESULTANTES NO BANCO (col 7-12)      -->
        <!-- ================================================================= -->
        <div class="xl:col-span-6 flex flex-col gap-4">

          <!-- ============================================================= -->
          <!-- CIRCUITO A: TRILHA SUPERIOR ➔ FILA 1 ➔ WORKER 1 ➔ SQL SERVER  -->
          <!-- ============================================================= -->
          <div class="p-4 rounded-2xl border border-cyan-500/30 bg-slate-950/70 shadow-lg flex flex-col gap-3 relative">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <span class="text-xs font-bold text-cyan-400 flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                Circuito A: Estoque (Dedução de Saldo & Status do Pedido)
              </span>
              <span class="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
                Binding: order.created
              </span>
            </div>

            <!-- Pipeline Trilha A (Fila + Worker + SQL Server Sink) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              <!-- FILA 1: inventory-queue (Buffer Real) -->
              <div 
                class="p-3 rounded-xl border transition-all duration-500 flex flex-col justify-between"
                [ngClass]="{
                  'bg-cyan-950/60 border-cyan-400 ring-2 ring-cyan-400/50 shadow-md shadow-cyan-500/20 animate-pulse-glow-cyan': isQueueActive('inventory'),
                  'bg-slate-900/60 border-slate-800 text-slate-300': !isQueueActive('inventory')
                }"
              >
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">FILA 1</span>
                    <span class="text-[10px] font-mono text-slate-400">inventory-queue</span>
                  </div>

                  <!-- Visual FIFO Buffer Slot -->
                  <div class="mt-2 p-2 rounded-lg bg-slate-950/90 border border-slate-800">
                    <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>Buffer FIFO:</span>
                      <span class="font-mono text-[10px]" [ngClass]="isQueueActive('inventory') ? 'text-cyan-400 font-bold' : 'text-slate-500'">
                        {{ isQueueActive('inventory') ? '1 msg (WAIT ACK)' : '0 msgs' }}
                      </span>
                    </div>

                    <div class="h-7 rounded border border-slate-800 bg-slate-900/80 flex items-center px-1.5 overflow-hidden">
                      @if (isQueueActive('inventory')) {
                        <div class="w-full bg-cyan-950/80 border border-cyan-500/60 rounded px-2 py-0.5 text-[10px] font-mono text-cyan-300 flex items-center justify-between animate-pulse">
                          <span class="truncate">#{{ getActiveOrderId() }}</span>
                          <span class="text-[8px] bg-cyan-500/30 px-1 rounded text-cyan-200">WAIT ACK</span>
                        </div>
                      } @else {
                        <span class="text-[10px] text-slate-600 font-mono italic">Buffer vazio</span>
                      }
                    </div>
                  </div>
                </div>

                <div class="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Entrega:</span>
                  <span class="font-mono text-cyan-400">order.created</span>
                </div>
              </div>

              <!-- CONSUMER: InventoryWorker -->
              <div 
                class="p-3 rounded-xl border transition-all duration-500 flex flex-col justify-between"
                [ngClass]="{
                  'bg-sky-950/60 border-sky-400 ring-2 ring-sky-400/50 shadow-md shadow-sky-500/20 animate-pulse-glow-cyan': isWorkerActive('inventory'),
                  'bg-slate-900/60 border-slate-800 text-slate-300': !isWorkerActive('inventory')
                }"
              >
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">CONSUMER</span>
                    <span class="text-[10px] font-mono text-slate-400">InventoryWorker</span>
                  </div>

                  <!-- Active Worker Status -->
                  <div class="mt-2 p-2 rounded-lg bg-slate-950/90 border border-slate-800">
                    <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>Execução:</span>
                      <span class="font-mono text-[10px]" [ngClass]="isWorkerActive('inventory') ? 'text-sky-400 font-bold' : 'text-slate-500'">
                        {{ isWorkerActive('inventory') ? 'Consumindo...' : 'Pronto' }}
                      </span>
                    </div>

                    @if (isWorkerActive('inventory')) {
                      <div class="text-[10px] text-sky-300 font-mono bg-sky-950/80 border border-sky-500/40 rounded px-1.5 py-1 flex items-center gap-1.5 animate-pulse">
                        <svg class="w-3.5 h-3.5 text-sky-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span class="truncate">Deduzindo Estoque</span>
                      </div>
                    } @else {
                      <div class="text-[10px] text-slate-600 font-mono italic">Worker ocioso</div>
                    }
                  </div>
                </div>

                <div class="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Processados:</span>
                  <span class="font-mono text-sky-400 font-bold">{{ signalR.counters().inventoryProcessed }}</span>
                </div>
              </div>

              <!-- A RESULTANTE NO BANCO: SQL Server SINK (Inventories & Orders) -->
              <div class="p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between"
                [ngClass]="isWorkerActive('inventory') ? 'border-sky-500/40 bg-sky-950/20' : ''"
              >
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">RESULTANTE NO DB</span>
                    <svg class="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>

                  <div class="mt-2 space-y-1.5 text-[10px] font-mono">
                    <div class="p-1.5 rounded bg-slate-950/90 border border-slate-800">
                      <span class="text-slate-500 block">Tabela [Inventories]:</span>
                      <span class="text-sky-300 font-bold" *ngIf="isWorkerActive('inventory')">
                        UPDATE AvailableQty -1
                      </span>
                      <span class="text-slate-600" *ngIf="!isWorkerActive('inventory')">Aguardando commit</span>
                    </div>

                    <div class="p-1.5 rounded bg-slate-950/90 border border-slate-800">
                      <span class="text-slate-500 block">Tabela [Orders]:</span>
                      <span class="text-emerald-400 font-bold" *ngIf="isWorkerActive('inventory')">
                        Status &rarr; Processado
                      </span>
                      <span class="text-slate-600" *ngIf="!isWorkerActive('inventory')">Aguardando commit</span>
                    </div>
                  </div>
                </div>

                <div class="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
                  <span>Banco: SQL Server</span>
                </div>
              </div>

            </div>
          </div>

          <!-- ============================================================= -->
          <!-- CIRCUITO B: TRILHA INFERIOR ➔ FILA 2 ➔ WORKER 2 ➔ SQL SERVER  -->
          <!-- ============================================================= -->
          <div class="p-4 rounded-2xl border border-violet-500/30 bg-slate-950/70 shadow-lg flex flex-col gap-3 relative">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <span class="text-xs font-bold text-violet-400 flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-violet-400"></span>
                Circuito B: Notificações (Auditoria, Simulação de E-mail & Log)
              </span>
              <span class="text-[10px] font-mono text-violet-300 bg-violet-950/60 border border-violet-500/30 px-2 py-0.5 rounded">
                Binding: order.# (Wildcard)
              </span>
            </div>

            <!-- Pipeline Trilha B (Fila + Worker + SQL Server Sink) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              <!-- FILA 2: notification-queue (Buffer Real) -->
              <div 
                class="p-3 rounded-xl border transition-all duration-500 flex flex-col justify-between"
                [ngClass]="{
                  'bg-violet-950/60 border-violet-400 ring-2 ring-violet-400/50 shadow-md shadow-violet-500/20 animate-pulse-glow-purple': isQueueActive('notification'),
                  'bg-slate-900/60 border-slate-800 text-slate-300': !isQueueActive('notification')
                }"
              >
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">FILA 2</span>
                    <span class="text-[10px] font-mono text-slate-400">notification-queue</span>
                  </div>

                  <!-- Visual FIFO Buffer Slot -->
                  <div class="mt-2 p-2 rounded-lg bg-slate-950/90 border border-slate-800">
                    <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>Buffer FIFO:</span>
                      <span class="font-mono text-[10px]" [ngClass]="isQueueActive('notification') ? 'text-violet-400 font-bold' : 'text-slate-500'">
                        {{ isQueueActive('notification') ? '1 msg (WAIT ACK)' : '0 msgs' }}
                      </span>
                    </div>

                    <div class="h-7 rounded border border-slate-800 bg-slate-900/80 flex items-center px-1.5 overflow-hidden">
                      @if (isQueueActive('notification')) {
                        <div class="w-full bg-violet-950/80 border border-violet-500/60 rounded px-2 py-0.5 text-[10px] font-mono text-violet-300 flex items-center justify-between animate-pulse">
                          <span class="truncate">#{{ getActiveOrderId() }}</span>
                          <span class="text-[8px] bg-violet-500/30 px-1 rounded text-violet-200">WAIT ACK</span>
                        </div>
                      } @else {
                        <span class="text-[10px] text-slate-600 font-mono italic">Buffer vazio</span>
                      }
                    </div>
                  </div>
                </div>

                <div class="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Wildcard:</span>
                  <span class="font-mono text-violet-400">order.#</span>
                </div>
              </div>

              <!-- CONSUMER: NotificationWorker -->
              <div 
                class="p-3 rounded-xl border transition-all duration-500 flex flex-col justify-between"
                [ngClass]="{
                  'bg-purple-950/60 border-purple-400 ring-2 ring-purple-400/50 shadow-md shadow-purple-500/20 animate-pulse-glow-purple': isWorkerActive('notification'),
                  'bg-slate-900/60 border-slate-800 text-slate-300': !isWorkerActive('notification')
                }"
              >
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">CONSUMER</span>
                    <span class="text-[10px] font-mono text-slate-400">NotificationWorker</span>
                  </div>

                  <!-- Active Worker Status -->
                  <div class="mt-2 p-2 rounded-lg bg-slate-950/90 border border-slate-800">
                    <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>Execução:</span>
                      <span class="font-mono text-[10px]" [ngClass]="isWorkerActive('notification') ? 'text-purple-400 font-bold' : 'text-slate-500'">
                        {{ isWorkerActive('notification') ? 'Disparando...' : 'Pronto' }}
                      </span>
                    </div>

                    @if (isWorkerActive('notification')) {
                      <div class="text-[10px] text-purple-300 font-mono bg-purple-950/80 border border-purple-500/40 rounded px-1.5 py-1 flex items-center gap-1.5 animate-pulse">
                        <svg class="w-3.5 h-3.5 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span class="truncate">Disparando E-mail</span>
                      </div>
                    } @else {
                      <div class="text-[10px] text-slate-600 font-mono italic">Worker ocioso</div>
                    }
                  </div>
                </div>

                <div class="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Notificados:</span>
                  <span class="font-mono text-purple-400 font-bold">{{ signalR.counters().notificationProcessed }}</span>
                </div>
              </div>

              <!-- A RESULTANTE NO BANCO: SQL Server SINK (NotificationLogs) -->
              <div class="p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between"
                [ngClass]="isWorkerActive('notification') ? 'border-purple-500/40 bg-purple-950/20' : ''"
              >
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">RESULTANTE NO DB</span>
                    <svg class="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>

                  <div class="mt-2 space-y-1.5 text-[10px] font-mono">
                    <div class="p-1.5 rounded bg-slate-950/90 border border-slate-800">
                      <span class="text-slate-500 block">Tabela [NotificationLogs]:</span>
                      <span class="text-purple-300 font-bold" *ngIf="isWorkerActive('notification')">
                        INSERT INTO NotificationLogs
                      </span>
                      <span class="text-slate-600" *ngIf="!isWorkerActive('notification')">Aguardando commit</span>
                    </div>

                    <div class="p-1.5 rounded bg-slate-950/90 border border-slate-800">
                      <span class="text-slate-500 block">Canal de E-mail:</span>
                      <span class="text-purple-400 font-bold" *ngIf="isWorkerActive('notification')">
                        SMTP Simulado Enviado
                      </span>
                      <span class="text-slate-600" *ngIf="!isWorkerActive('notification')">Aguardando disparo</span>
                    </div>
                  </div>
                </div>

                <div class="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
                  <span>Banco: SQL Server</span>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>

      <!-- Flow Legend Bar -->
      <div class="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div class="flex items-center gap-4 flex-wrap">
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/50"></span>
            1. POST /orders (Trilha 1 &rarr; Exchange)
          </span>
          <span class="text-slate-600">&rarr;</span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded bg-orange-500/20 border border-orange-500/50"></span>
            2. Topic Exchange (Bifurcação & Decisão de Bindings)
          </span>
          <span class="text-slate-600">&rarr;</span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded bg-cyan-500/20 border border-cyan-500/50"></span>
            3. Fila 1 &rarr; InventoryWorker &rarr; SQL Server (Inventories/Orders)
          </span>
          <span class="text-slate-600">&rarr;</span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded bg-violet-500/20 border border-violet-500/50"></span>
            4. Fila 2 &rarr; NotificationWorker &rarr; SQL Server (NotificationLogs)
          </span>
        </div>
        <div class="text-[11px] font-mono text-slate-500">
          Clean Architecture & EDA em .NET 10 + RabbitMQ 3
        </div>
      </div>
    </div>
  `
})
export class PubSubFlowComponent {
  readonly signalR = inject(SignalRService);
  readonly showPayloadInspector = signal<boolean>(false);

  togglePayloadInspector(): void {
    this.showPayloadInspector.update(v => !v);
  }

  getProgressPercentage(): number {
    const step = this.signalR.currentStep();
    if (!step || step.totalSeconds <= 0) return 0;
    const elapsed = step.totalSeconds - step.remainingSeconds + 1;
    return Math.min(Math.max((elapsed / step.totalSeconds) * 100, 0), 100);
  }

  getActiveOrderId(): string {
    const step = this.signalR.currentStep();
    return step ? step.orderId.substring(0, 8) : '--------';
  }

  isExchangeBranchActive(branch: 'inventory' | 'notification'): boolean {
    const step = this.signalR.currentStep();
    if (!step) return false;
    if (branch === 'inventory') {
      return step.stepNumber === 1 || step.stepNumber === 2;
    }
    if (branch === 'notification') {
      return step.stepNumber === 1 || step.stepNumber === 3;
    }
    return false;
  }

  isQueueActive(type: 'inventory' | 'notification'): boolean {
    const step = this.signalR.currentStep();
    if (!step) return false;
    if (type === 'inventory') {
      return step.subStage === 'inventory_buffering' || step.nodeId === 'inventory_queue';
    }
    if (type === 'notification') {
      return step.subStage === 'notification_buffering' || step.nodeId === 'notification_queue';
    }
    return false;
  }

  isWorkerActive(type: 'inventory' | 'notification'): boolean {
    const step = this.signalR.currentStep();
    if (!step) return false;
    if (type === 'inventory') {
      return step.subStage === 'inventory_consuming' || step.nodeId === 'inventory_worker';
    }
    if (type === 'notification') {
      return step.subStage === 'notification_consuming' || step.nodeId === 'notification_worker';
    }
    return false;
  }

  getPacketColorClass(subStage?: string): string {
    switch (subStage) {
      case 'producer_transit': return 'bg-emerald-400';
      case 'exchange_routing': return 'bg-orange-400';
      case 'inventory_buffering': return 'bg-cyan-400';
      case 'inventory_consuming': return 'bg-sky-400';
      case 'notification_buffering': return 'bg-violet-400';
      case 'notification_consuming': return 'bg-purple-400';
      default: return 'bg-emerald-400';
    }
  }

  getSubStageLabel(subStage?: string): string {
    switch (subStage) {
      case 'producer_transit': return 'Trilha 1: Trafegando da API para a Topic Exchange (order-events)';
      case 'exchange_routing': return 'Bifurcação: Topic Exchange testando bindings e duplicando pacotes';
      case 'inventory_buffering': return 'Trilha A: Mensagem aguardando no buffer da [inventory-queue]';
      case 'inventory_consuming': return 'Consumer A: InventoryWorker consumindo e comitando no SQL Server';
      case 'notification_buffering': return 'Trilha B: Mensagem aguardando no buffer da [notification-queue]';
      case 'notification_consuming': return 'Consumer B: NotificationWorker consumindo e gravando NotificationLogs';
      default: return 'Processamento ativo';
    }
  }

  getFormattedPayload(): string {
    const step = this.signalR.currentStep();
    if (step && step.rawPayload) {
      return JSON.stringify(step.rawPayload, null, 2);
    }
    return JSON.stringify({
      status: 'Aguardando publicação de pedido...',
      exchange: 'order-events',
      type: 'topic',
      queues: ['inventory-queue', 'notification-queue']
    }, null, 2);
  }
}



