import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../services/api.service';
import { SignalRService } from '../services/signalr.service';
import { Order, OrderStatus } from '../models';

@Component({
  selector: 'app-orders-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h3 class="font-bold text-white text-base tracking-wide">Pedidos Registrados</h3>
          <span class="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded-full">
            {{ orders().length }} pedidos
          </span>
        </div>
        <button 
          (click)="loadOrders()" 
          class="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          title="Recarregar pedidos"
        >
          <span>↻ Atualizar</span>
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-slate-800 text-slate-400 font-medium">
              <th class="py-3 px-3">ID (GUID)</th>
              <th class="py-3 px-3">Cliente</th>
              <th class="py-3 px-3">Produto</th>
              <th class="py-3 px-3 text-center">Qtd</th>
              <th class="py-3 px-3">Total</th>
              <th class="py-3 px-3">Status</th>
              <th class="py-3 px-3 text-right">Data/Hora</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 font-normal">
            @for (order of orders(); track order.id) {
              <tr class="hover:bg-slate-800/30 transition-colors">
                <td class="py-2.5 px-3 font-mono text-slate-400" [title]="order.id">
                  #{{ order.id.substring(0, 8) }}
                </td>
                <td class="py-2.5 px-3 font-semibold text-white">
                  {{ order.customerName }}
                </td>
                <td class="py-2.5 px-3 font-mono text-slate-300">
                  {{ order.productId }}
                </td>
                <td class="py-2.5 px-3 text-center font-bold text-white">
                  {{ order.quantity }}
                </td>
                <td class="py-2.5 px-3 font-mono text-emerald-400">
                  R$ {{ order.totalAmount | number:'1.2-2' }}
                </td>
                <td class="py-2.5 px-3">
                  <div class="flex flex-col items-start gap-1">
                    <span 
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      [ngClass]="getStatusBadgeClass(order.status, order.id)"
                    >
                      <span class="w-1.5 h-1.5 rounded-full" [ngClass]="getStatusDotClass(order.status, order.id)"></span>
                      {{ getStatusLabel(order.status, order.id) }}
                    </span>
                    @if (order.lastProcessingError) {
                      <span class="text-[10px] text-rose-400 font-mono max-w-[200px] truncate" [title]="order.lastProcessingError">
                        ⚠️ {{ order.lastProcessingError }}
                      </span>
                    }
                  </div>
                </td>
                <td class="py-2.5 px-3 text-right text-slate-400">
                  {{ order.createdAt | date:'HH:mm:ss dd/MM' }}
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="py-8 text-center text-slate-500">
                  Nenhum pedido registrado ainda. Clique em um botão de ação acima para criar o primeiro!
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class OrdersTableComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly signalR = inject(SignalRService);

  readonly orders = signal<Order[]>([]);

  constructor() {
    effect(() => {
      this.signalR.orderEventTrigger();
      this.loadOrders();
    });
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.api.getOrders().subscribe({
      next: (data) => {
        // Sort descending by createdAt
        const sorted = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.orders.set(sorted);
      },
      error: (e) => console.error('Erro ao buscar pedidos:', e)
    });
  }

  getStatusLabel(status: number | string, orderId?: string): string {
    if (orderId && this.signalR.isOrderPending(orderId)) {
      return 'Pendente (na fila)';
    }
    const s = String(status).toLowerCase();
    if (status === 0 || s === 'pending') return 'Pendente (na fila)';
    if (status === 1 || s === 'processed') return 'Processado';
    if (status === 2 || s === 'failed') return 'Falha (Estoque)';
    return String(status);
  }

  getStatusBadgeClass(status: number | string, orderId?: string): string {
    if (orderId && this.signalR.isOrderPending(orderId)) {
      return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }
    const s = String(status).toLowerCase();
    if (status === 0 || s === 'pending') {
      return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }
    if (status === 1 || s === 'processed') {
      return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    }
    if (status === 2 || s === 'failed') {
      return 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
    }
    return 'bg-slate-700 text-slate-300';
  }

  getStatusDotClass(status: number | string, orderId?: string): string {
    if (orderId && this.signalR.isOrderPending(orderId)) {
      return 'bg-amber-400 animate-pulse';
    }
    const s = String(status).toLowerCase();
    if (status === 0 || s === 'pending') return 'bg-amber-400 animate-pulse';
    if (status === 1 || s === 'processed') return 'bg-emerald-400';
    if (status === 2 || s === 'failed') return 'bg-rose-400';
    return 'bg-slate-400';
  }
}
