import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order, Inventory, NotificationLog, CreateOrderRequest, CreateOrderResponse } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    if (typeof window !== 'undefined' && window.location.origin) {
      if (window.location.port !== '4200' && window.location.port !== '') {
        return window.location.origin;
      }
    }
    return 'http://localhost:5000';
  }

  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.baseUrl}/orders`);
  }

  getOrderById(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.baseUrl}/orders/${id}`);
  }

  createOrder(request: CreateOrderRequest): Observable<CreateOrderResponse> {
    return this.http.post<CreateOrderResponse>(`${this.baseUrl}/orders`, request);
  }

  getInventory(): Observable<Inventory[]> {
    return this.http.get<Inventory[]>(`${this.baseUrl}/inventory`);
  }

  resetInventory(): Observable<Inventory[]> {
    return this.http.post<Inventory[]>(`${this.baseUrl}/inventory/reset`, {});
  }

  getNotifications(): Observable<NotificationLog[]> {
    return this.http.get<NotificationLog[]>(`${this.baseUrl}/notifications`);
  }

  resetScenario(): Observable<any> {
    return this.http.post(`${this.baseUrl}/demo/reset-scenario`, {});
  }

  toggleTransientDbFault(enable: boolean): Observable<any> {
    return this.http.post(`${this.baseUrl}/demo/faults/transient-db?enable=${enable}`, {});
  }

  togglePostCommitCrash(enable: boolean): Observable<any> {
    return this.http.post(`${this.baseUrl}/demo/faults/post-commit-crash?enable=${enable}`, {});
  }

  getDemoStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}/demo/status`);
  }
}
