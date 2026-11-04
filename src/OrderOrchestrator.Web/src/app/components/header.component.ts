import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignalRService } from '../services/signalr.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-40 px-6 py-4">
      <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <!-- Logo & Title -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="font-bold text-lg text-white tracking-tight">Order Orchestrator</h1>
              <span class="text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                EDA Simulator • Angular 22
              </span>
            </div>
            <p class="text-xs text-slate-400">Microsserviço com RabbitMQ Topic Exchange, Workers e Clean Architecture (.NET 10)</p>
          </div>
        </div>

        <!-- Badges & Navigation -->
        <div class="flex items-center flex-wrap gap-2 sm:gap-3 text-xs">
          <!-- SignalR Status -->
          <div 
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
            [ngClass]="{
              'bg-emerald-950/60 border-emerald-500/40 text-emerald-300': signalR.connectionStatus() === 'connected',
              'bg-amber-950/60 border-amber-500/40 text-amber-300': signalR.connectionStatus() === 'connecting',
              'bg-rose-950/60 border-rose-500/40 text-rose-300': signalR.connectionStatus() === 'disconnected'
            }"
          >
            <span class="w-2 h-2 rounded-full animate-pulse" [ngClass]="{
              'bg-emerald-400': signalR.connectionStatus() === 'connected',
              'bg-amber-400': signalR.connectionStatus() === 'connecting',
              'bg-rose-400': signalR.connectionStatus() === 'disconnected'
            }"></span>
            <span>SignalR: <strong>{{ signalR.connectionStatus() | uppercase }}</strong></span>
          </div>

          <!-- RabbitMQ Topic Badge -->
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-orange-500/30 bg-orange-950/40 text-orange-300 font-mono text-[11px]">
            <span class="w-2 h-2 rounded-full bg-orange-400"></span>
            <span>Exchange: <strong>order-events (topic)</strong></span>
          </div>

          <!-- Quick Link to Swagger -->
          <a 
            [href]="swaggerUrl" 
            target="_blank" 
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white transition-all shadow-sm"
            title="Abrir documentação Swagger da API"
          >
            <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Swagger API</span>
            <span class="text-[10px] text-slate-400">↗</span>
          </a>

          <!-- Quick Link to RabbitMQ Management -->
          <a 
            href="http://localhost:15672" 
            target="_blank" 
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white transition-all shadow-sm"
            title="Abrir RabbitMQ Management UI (guest/guest)"
          >
            <svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span>RabbitMQ UI</span>
            <span class="text-[10px] text-slate-400">↗</span>
          </a>

          <!-- Quick Link to Jaeger UI (OpenTelemetry) -->
          <a 
            href="http://localhost:16686" 
            target="_blank" 
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/40 hover:text-cyan-200 transition-all shadow-sm"
            title="Abrir Jaeger UI (OpenTelemetry Traces)"
          >
            <svg class="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Jaeger Traces</span>
            <span class="text-[10px] text-cyan-400">↗</span>
          </a>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {
  readonly signalR = inject(SignalRService);

  get swaggerUrl(): string {
    if (typeof window !== 'undefined' && window.location.origin) {
      if (window.location.port !== '4200' && window.location.port !== '') {
        return `${window.location.origin}/swagger`;
      }
    }
    return 'http://localhost:5000/swagger';
  }
}
