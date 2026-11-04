import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../services/api.service';
import { SignalRService } from '../services/signalr.service';
import { Inventory } from '../models';

@Component({
  selector: 'app-inventory-cards',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 class="font-bold text-white text-base tracking-wide">Estoque em Tempo Real</h3>
          <span class="text-[11px] text-slate-400">Tabela <code>Inventories</code></span>
        </div>
        <button 
          (click)="loadInventory()" 
          class="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          title="Recarregar estoque"
        >
          <span>↻ Atualizar</span>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        @for (item of inventoryList(); track item.id) {
          <div class="p-4 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between relative overflow-hidden group hover:border-slate-700 transition-all">
            
            <!-- Top Line: Code & Status -->
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {{ item.productId }}
              </span>
              <span 
                class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                [ngClass]="{
                  'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30': item.availableQuantity > 20,
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30': item.availableQuantity > 0 && item.availableQuantity <= 20,
                  'bg-rose-500/20 text-rose-400 border border-rose-500/30': item.availableQuantity === 0
                }"
              >
                {{ item.availableQuantity > 20 ? 'Disponível' : (item.availableQuantity > 0 ? 'Estoque Baixo' : 'Esgotado') }}
              </span>
            </div>

            <!-- Product Name -->
            <div class="mt-3">
              <h4 class="font-semibold text-white text-sm tracking-tight">{{ item.productName }}</h4>
            </div>

            <!-- Quantity & Bar -->
            <div class="mt-4">
              <div class="flex items-baseline justify-between mb-1.5">
                <span class="text-2xl font-bold font-mono text-white tracking-tight">
                  {{ item.availableQuantity }}
                </span>
                <span class="text-[11px] text-slate-400">
                  capacidade: {{ getMaxCapacity(item.productId) }} un
                </span>
              </div>

              <!-- Progress Bar -->
              <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div 
                  class="h-full rounded-full transition-all duration-700"
                  [ngClass]="{
                    'bg-emerald-500': item.availableQuantity > 20,
                    'bg-amber-500': item.availableQuantity > 0 && item.availableQuantity <= 20,
                    'bg-rose-500': item.availableQuantity === 0
                  }"
                  [style.width.%]="getPercentage(item.availableQuantity, getMaxCapacity(item.productId))"
                ></div>
              </div>
            </div>

          </div>
        }
      </div>
    </div>
  `
})
export class InventoryCardsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly signalR = inject(SignalRService);

  readonly inventoryList = signal<Inventory[]>([]);

  constructor() {
    // Re-fetch whenever signalR triggers an inventory event
    effect(() => {
      this.signalR.inventoryEventTrigger();
      this.loadInventory();
    });
  }

  ngOnInit(): void {
    this.loadInventory();
  }

  loadInventory(): void {
    this.api.getInventory().subscribe({
      next: (data) => this.inventoryList.set(data),
      error: (e) => console.error('Erro ao carregar estoque:', e)
    });
  }

  getMaxCapacity(productId: string): number {
    switch (productId) {
      case 'PROD-001': return 100;
      case 'PROD-002': return 50;
      case 'PROD-003': return 30;
      default: return 100;
    }
  }

  getPercentage(qty: number, max: number): number {
    if (max <= 0) return 0;
    const p = (qty / max) * 100;
    return Math.min(Math.max(p, 0), 100);
  }
}
