import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div 
          class="pointer-events-auto transform transition-all duration-300 ease-out translate-y-0 opacity-100 flex items-start gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-md"
          [ngClass]="{
            'bg-slate-900/95 border-sky-500/40 text-sky-200': toast.type === 'info',
            'bg-emerald-950/95 border-emerald-500/50 text-emerald-200': toast.type === 'success',
            'bg-amber-950/95 border-amber-500/50 text-amber-200': toast.type === 'warning',
            'bg-rose-950/95 border-rose-500/50 text-rose-200': toast.type === 'error'
          }"
        >
          <div class="shrink-0 mt-0.5">
            @switch (toast.type) {
              @case ('info') {
                <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              @case ('success') {
                <svg class="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              @case ('warning') {
                <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
              @case ('error') {
                <svg class="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            }
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="font-semibold text-sm tracking-wide text-white">{{ toast.title }}</h4>
            <p class="text-xs mt-1 text-slate-300 leading-relaxed break-words">{{ toast.message }}</p>
            <span class="text-[10px] text-slate-400 mt-2 block">{{ toast.timestamp | date:'HH:mm:ss' }}</span>
          </div>
          <button 
            (click)="toastService.remove(toast.id)" 
            class="text-slate-400 hover:text-white transition-colors p-1 text-xs font-semibold"
            title="Fechar"
          >
            Fechar
          </button>
        </div>
      }
    </div>
  `
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
