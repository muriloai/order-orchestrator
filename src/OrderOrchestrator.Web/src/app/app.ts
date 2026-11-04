import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header.component';
import { PubSubFlowComponent } from './components/pubsub-flow.component';
import { ActionButtonsComponent } from './components/action-buttons.component';
import { InventoryCardsComponent } from './components/inventory-cards.component';
import { OrdersTableComponent } from './components/orders-table.component';
import { NotificationFeedComponent } from './components/notification-feed.component';
import { LiveConsoleComponent } from './components/live-console.component';
import { ToastContainerComponent } from './components/toast-container.component';
import { SignalRService } from './services/signalr.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    PubSubFlowComponent,
    ActionButtonsComponent,
    InventoryCardsComponent,
    OrdersTableComponent,
    NotificationFeedComponent,
    LiveConsoleComponent,
    ToastContainerComponent
  ],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly signalR = inject(SignalRService);

  ngOnInit(): void {
    this.signalR.startConnection();
  }
}
