import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { ToastService } from '../services/toast.service';
import { CreateOrderRequest } from '../models';

@Component({
  selector: 'app-action-buttons',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <h3 class="font-bold text-white text-base tracking-wide">Painel de Ações e Simulação</h3>
        </div>
        <button 
          (click)="toggleCustomForm()" 
          class="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5"
        >
          <span>{{ showCustomForm() ? 'Fechar Formulário' : '+ Pedido Personalizado' }}</span>
        </button>
      </div>

      <!-- Quick 1-Click Action Buttons -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        
        <!-- Button 1: Teclado -->
        <button
          (click)="createPresetOrder('PROD-001', 'Ana Silva', 1, 250.00)"
          [disabled]="isLoading()"
          class="flex flex-col text-left p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/30 hover:border-emerald-500/60 transition-all group disabled:opacity-50"
        >
          <div class="flex items-center justify-between w-full">
            <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Sucesso</span>
          </div>
          <span class="font-semibold text-white text-xs mt-2 group-hover:text-emerald-300 transition-colors">Comprar Teclado</span>
          <span class="text-[11px] text-slate-400">1x PROD-001 • R$ 250</span>
        </button>

        <!-- Button 2: Mouse -->
        <button
          (click)="createPresetOrder('PROD-002', 'Bruno Costa', 2, 240.00)"
          [disabled]="isLoading()"
          class="flex flex-col text-left p-3.5 rounded-xl border border-sky-500/30 bg-sky-950/20 hover:bg-sky-900/30 hover:border-sky-500/60 transition-all group disabled:opacity-50"
        >
          <div class="flex items-center justify-between w-full">
            <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400">Sucesso</span>
          </div>
          <span class="font-semibold text-white text-xs mt-2 group-hover:text-sky-300 transition-colors">Comprar Mouse</span>
          <span class="text-[11px] text-slate-400">2x PROD-002 • R$ 240</span>
        </button>

        <!-- Button 3: Stock Exhaustion (Failure test) -->
        <button
          (click)="createPresetOrder('PROD-003', 'Carlos Eduardo', 999, 1498500.00)"
          [disabled]="isLoading()"
          class="flex flex-col text-left p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/20 hover:bg-rose-900/30 hover:border-rose-500/60 transition-all group disabled:opacity-50"
        >
          <div class="flex items-center justify-between w-full">
            <svg class="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">Falha Controlada</span>
          </div>
          <span class="font-semibold text-white text-xs mt-2 group-hover:text-rose-300 transition-colors">Estouro de Estoque</span>
          <span class="text-[11px] text-slate-400">999x PROD-003 (Rejeição)</span>
        </button>

        <!-- Button 4: Burst 5 Orders -->
        <button
          (click)="executeBurst()"
          [disabled]="isLoading()"
          class="flex flex-col text-left p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/20 hover:bg-amber-900/30 hover:border-amber-500/60 transition-all group disabled:opacity-50"
        >
          <div class="flex items-center justify-between w-full">
            <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Concorrência</span>
          </div>
          <span class="font-semibold text-white text-xs mt-2 group-hover:text-amber-300 transition-colors">Rajada (Burst 5x)</span>
          <span class="text-[11px] text-slate-400">Dispara 5 pedidos rápidos</span>
        </button>

        <!-- Button 5: Reset Inventory -->
        <button
          (click)="resetInventory()"
          [disabled]="isLoading()"
          class="flex flex-col text-left p-3.5 rounded-xl border border-slate-700 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-600 transition-all group disabled:opacity-50"
        >
          <div class="flex items-center justify-between w-full">
            <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">Reset</span>
          </div>
          <span class="font-semibold text-white text-xs mt-2 group-hover:text-white transition-colors">Restaurar Estoque</span>
          <span class="text-[11px] text-slate-400">Volta saldos para 100, 50, 30</span>
        </button>

      </div>

      <!-- Specialized Section: Recorte Cenário 10 -> 7 -> 7 -->
      <div class="mt-4 pt-4 border-t border-slate-800">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span class="text-xs font-bold text-cyan-300 tracking-wide uppercase font-mono">
              Laboratório do Recorte: Sequência 10 → 7 → 7 & OpenTelemetry
            </span>
          </div>
          <span class="text-[11px] text-slate-400">Worker de estoque em processo isolado ("inventory-worker")</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <button
            (click)="setupScenario10()"
            [disabled]="isLoading()"
            class="p-2.5 rounded-lg border border-cyan-500/30 bg-cyan-950/20 hover:bg-cyan-900/30 text-left transition-all disabled:opacity-50"
          >
            <div class="text-[10px] font-bold text-cyan-400">PASSO 1</div>
            <div class="text-xs font-semibold text-white">Preparar Saldo 10</div>
            <div class="text-[10px] text-slate-400">Define PROD-001 em 10 un.</div>
          </button>

          <button
            (click)="triggerTransientFault()"
            [disabled]="isLoading()"
            class="p-2.5 rounded-lg border border-amber-500/30 bg-amber-950/20 hover:bg-amber-900/30 text-left transition-all disabled:opacity-50"
          >
            <div class="text-[10px] font-bold text-amber-400">PASSO 2</div>
            <div class="text-xs font-semibold text-white">Injetar Falha DB</div>
            <div class="text-[10px] text-slate-400">Tentativa 1 falha antes do commit</div>
          </button>

          <button
            (click)="createPresetOrder('PROD-001', 'Operador Auditoria', 3, 750.00)"
            [disabled]="isLoading()"
            class="p-2.5 rounded-lg border border-indigo-500/30 bg-indigo-950/20 hover:bg-indigo-900/30 text-left transition-all disabled:opacity-50"
          >
            <div class="text-[10px] font-bold text-indigo-400">PASSO 3</div>
            <div class="text-xs font-semibold text-white">Pedir 3 Unidades</div>
            <div class="text-[10px] text-slate-400">API aceita (Saldo continua 10)</div>
          </button>

          <button
            (click)="releaseFault()"
            [disabled]="isLoading()"
            class="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/30 text-left transition-all disabled:opacity-50"
          >
            <div class="text-[10px] font-bold text-emerald-400">PASSO 4</div>
            <div class="text-xs font-semibold text-white">Liberar Dependência</div>
            <div class="text-[10px] text-slate-400">Worker reprocessa (Saldo vira 7)</div>
          </button>

          <button
            (click)="triggerPostCommitCrash()"
            [disabled]="isLoading()"
            class="p-2.5 rounded-lg border border-purple-500/30 bg-purple-950/20 hover:bg-purple-900/30 text-left transition-all disabled:opacity-50"
          >
            <div class="text-[10px] font-bold text-purple-400">PASSO 5</div>
            <div class="text-xs font-semibold text-white">Queda Pós-Commit</div>
            <div class="text-[10px] text-slate-400">Commit ok, reentrega, saldo 7</div>
          </button>
        </div>
      </div>

      <!-- Expandable Custom Order Form -->
      @if (showCustomForm()) {
        <div class="mt-4 pt-4 border-t border-slate-800 bg-slate-950/40 p-4 rounded-xl border">
          <h4 class="text-xs font-semibold text-white mb-3">Novo Pedido Personalizado</h4>
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label class="block text-[11px] text-slate-400 mb-1">Nome do Cliente</label>
              <input 
                type="text" 
                [(ngModel)]="customCustomer" 
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                placeholder="Ex: Maria Santos"
              />
            </div>
            <div>
              <label class="block text-[11px] text-slate-400 mb-1">Produto</label>
              <select 
                [(ngModel)]="customProduct" 
                (change)="onProductChange()"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="PROD-001">PROD-001 • Teclado Mecânico (R$ 250)</option>
                <option value="PROD-002">PROD-002 • Mouse Gamer (R$ 120)</option>
                <option value="PROD-003">PROD-003 • Monitor 27 Pol (R$ 1500)</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] text-slate-400 mb-1">Quantidade</label>
              <input 
                type="number" 
                min="1" 
                [(ngModel)]="customQuantity" 
                (input)="calculateTotal()"
                class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div class="flex items-end">
              <button
                (click)="submitCustomOrder()"
                [disabled]="isLoading() || !customCustomer.trim() || customQuantity <= 0"
                class="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enviar (R$ {{ customTotal | number:'1.2-2' }})
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ActionButtonsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly isLoading = signal<boolean>(false);
  readonly showCustomForm = signal<boolean>(false);

  customCustomer = 'Cliente Teste';
  customProduct = 'PROD-001';
  customQuantity = 1;
  customTotal = 250.00;

  toggleCustomForm(): void {
    this.showCustomForm.update(v => !v);
  }

  onProductChange(): void {
    this.calculateTotal();
  }

  calculateTotal(): void {
    let unitPrice = 250.00;
    if (this.customProduct === 'PROD-002') unitPrice = 120.00;
    if (this.customProduct === 'PROD-003') unitPrice = 1500.00;
    this.customTotal = unitPrice * (this.customQuantity || 1);
  }

  createPresetOrder(productId: string, customer: string, qty: number, total: number): void {
    const req: CreateOrderRequest = {
      customerName: customer,
      productId,
      quantity: qty,
      totalAmount: total
    };

    this.sendOrder(req);
  }

  submitCustomOrder(): void {
    const req: CreateOrderRequest = {
      customerName: this.customCustomer,
      productId: this.customProduct,
      quantity: this.customQuantity,
      totalAmount: this.customTotal
    };

    this.sendOrder(req);
  }

  private sendOrder(req: CreateOrderRequest): void {
    this.isLoading.set(true);
    this.api.createOrder(req).subscribe({
      next: () => {
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.error('Erro ao Criar Pedido', err.error?.error || err.message || 'Falha ao conectar à API');
      }
    });
  }

  async executeBurst(): Promise<void> {
    this.isLoading.set(true);
    this.toast.info('Disparando Rajada', 'Enviando 5 pedidos para a fila com pequenos intervalos...');

    const customers = ['Lucas burst #1', 'Mariana burst #2', 'Rafael burst #3', 'Juliana burst #4', 'Pedro burst #5'];
    const products = ['PROD-001', 'PROD-002', 'PROD-001', 'PROD-002', 'PROD-003'];
    const quantities = [1, 2, 1, 1, 1];
    const prices = [250, 240, 250, 120, 1500];

    for (let i = 0; i < 5; i++) {
      this.api.createOrder({
        customerName: customers[i],
        productId: products[i],
        quantity: quantities[i],
        totalAmount: prices[i]
      }).subscribe({
        error: (e) => console.error('Erro na rajada:', e)
      });
      await new Promise(r => setTimeout(r, 400));
    }

    this.isLoading.set(false);
  }

  resetInventory(): void {
    this.isLoading.set(true);
    this.api.resetInventory().subscribe({
      next: () => {
        this.isLoading.set(false);
        this.toast.success('Estoque Restaurado', 'Produtos reabastecidos para as quantidades originais (100, 50, 30).');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.error('Erro ao Restaurar Estoque', err.message);
      }
    });
  }

  setupScenario10(): void {
    this.isLoading.set(true);
    this.api.resetScenario().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.toast.info('Cenário 10 → 7 → 7 Preparado', 'PROD-001 definido com exatamente 10 unidades. Falhas limpas.');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.error('Erro ao preparar cenário', err.message);
      }
    });
  }

  triggerTransientFault(): void {
    this.isLoading.set(true);
    this.api.toggleTransientDbFault(true).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.toast.warning('Falha DB Ativada', 'O InventoryWorker simulará falha transitória de acesso ao banco na tentativa 1 antes do commit.');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.error('Erro ao injetar falha', err.message);
      }
    });
  }

  releaseFault(): void {
    this.isLoading.set(true);
    this.api.toggleTransientDbFault(false).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.toast.success('Dependência Liberada', 'Falha transitória removida. Worker processará a reentrega com sucesso para saldo 7.');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.error('Erro ao liberar falha', err.message);
      }
    });
  }

  triggerPostCommitCrash(): void {
    this.isLoading.set(true);
    this.api.togglePostCommitCrash(true).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.toast.warning('Queda Pós-Commit Ativada', 'No próximo pedido, o worker comitará a baixa no SQL Server, mas simulará queda antes do ACK.');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.error('Erro ao ativar queda pós-commit', err.message);
      }
    });
  }
}
