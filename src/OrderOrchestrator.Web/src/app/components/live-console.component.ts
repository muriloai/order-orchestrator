import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignalRService } from '../services/signalr.service';

@Component({
  selector: 'app-live-console',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl font-mono text-xs flex flex-col h-full">
      <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-slate-400">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
          <span class="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
          <span class="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
          <span class="font-bold text-slate-300 ml-2">Console de Telemetria EDA (Pub/Sub Event Stream)</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-[11px] text-slate-500">{{ signalR.logs().length }} eventos</span>
          <button 
            (click)="signalR.clearLogs()" 
            class="text-[11px] text-slate-400 hover:text-white transition-colors underline"
          >
            Limpar
          </button>
        </div>
      </div>

      <div class="space-y-2 overflow-y-auto max-h-[350px] pr-1 select-text">
        @for (log of signalR.logs(); track log.id) {
          <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all">
            <div class="flex items-center justify-between text-[11px] mb-1">
              <div class="flex items-center gap-2">
                <span class="text-slate-500">[{{ log.timestamp | date:'HH:mm:ss.SSS' }}]</span>
                <span 
                  class="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold"
                  [ngClass]="{
                    'bg-orange-500/20 text-orange-400 border border-orange-500/30': log.stage === 'exchange',
                    'bg-sky-500/20 text-sky-400 border border-sky-500/30': log.stage === 'inventory_worker',
                    'bg-purple-500/20 text-purple-400 border border-purple-500/30': log.stage === 'notification_worker'
                  }"
                >
                  {{ log.stage }}
                </span>
                @if (log.routingKey) {
                  <span class="text-slate-400 text-[10px]">key: {{ log.routingKey }}</span>
                }
              </div>
            </div>
            <p class="text-slate-200 text-xs mt-0.5">{{ log.description }}</p>
            @if (log.data) {
              <div class="mt-1.5 p-2 rounded bg-black/50 text-[10px] text-emerald-400 overflow-x-auto">
                <pre>{{ log.data | json }}</pre>
              </div>
            }
          </div>
        } @empty {
          <div class="py-8 text-center text-slate-600 text-xs">
            Aguardando eventos do RabbitMQ... Dispare um pedido acima para ver os payloads transitando pelas filas!
          </div>
        }
      </div>
    </div>
  `
})
export class LiveConsoleComponent {
  readonly signalR = inject(SignalRService);
}
