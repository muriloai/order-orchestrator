import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../services/api.service';
import { SignalRService } from '../services/signalr.service';
import { NotificationLog } from '../models';

@Component({
  selector: 'app-notification-feed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm flex flex-col h-full">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h3 class="font-bold text-white text-base tracking-wide">Mural de Notificações</h3>
          <span class="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded-full">
            {{ notifications().length }} enviadas
          </span>
        </div>
        <button 
          (click)="loadNotifications()" 
          class="text-xs text-slate-400 hover:text-white transition-colors p-1"
          title="Recarregar notificações"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div class="space-y-3 overflow-y-auto max-h-[350px] pr-1">
        @for (item of notifications(); track item.id) {
          <div class="p-3.5 rounded-xl border border-violet-500/20 bg-violet-950/20 hover:border-violet-500/40 transition-all text-xs">
            <div class="flex items-center justify-between mb-1.5">
              <span class="font-semibold text-violet-300 flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {{ item.customerName }}
              </span>
              <span class="text-[10px] text-slate-400 font-mono">
                {{ item.sentAt | date:'HH:mm:ss' }}
              </span>
            </div>
            <p class="text-slate-300 leading-relaxed text-[11px] bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80">
              {{ item.message }}
            </p>
            <div class="mt-2 flex items-center justify-between text-[10px] text-slate-500">
              <span>Pedido: <strong class="text-slate-400 font-mono">#{{ item.orderId.substring(0, 8) }}</strong></span>
              <span class="text-violet-400 font-mono">notification-queue &rarr; worker</span>
            </div>
          </div>
        } @empty {
          <div class="py-8 text-center text-slate-500 text-xs">
            Nenhuma notificação enviada ainda. Ao criar um pedido, o <code>NotificationWorker</code> emitirá uma notificação aqui!
          </div>
        }
      </div>
    </div>
  `
})
export class NotificationFeedComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly signalR = inject(SignalRService);

  readonly notifications = signal<NotificationLog[]>([]);

  constructor() {
    effect(() => {
      this.signalR.notificationEventTrigger();
      this.loadNotifications();
    });
  }

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.api.getNotifications().subscribe({
      next: (data) => {
        const sorted = [...data].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
        this.notifications.set(sorted);
      },
      error: (e) => console.error('Erro ao buscar notificações:', e)
    });
  }
}
