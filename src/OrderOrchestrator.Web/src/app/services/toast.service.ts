import { Injectable, signal } from '@angular/core';
import { ToastMessage } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  readonly toasts = signal<ToastMessage[]>([]);

  show(title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', durationMs = 4500): void {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: ToastMessage = {
      id,
      title,
      message,
      type,
      timestamp: new Date()
    };

    this.toasts.update(current => [toast, ...current]);

    if (durationMs > 0) {
      setTimeout(() => {
        this.remove(id);
      }, durationMs);
    }
  }

  info(title: string, message: string): void {
    this.show(title, message, 'info');
  }

  success(title: string, message: string): void {
    this.show(title, message, 'success');
  }

  warning(title: string, message: string): void {
    this.show(title, message, 'warning', 5500);
  }

  error(title: string, message: string): void {
    this.show(title, message, 'error', 6000);
  }

  remove(id: string): void {
    this.toasts.update(current => current.filter(t => t.id !== id));
  }

  clear(): void {
    this.toasts.set([]);
  }
}
