import { Injectable, inject, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { ToastService } from './toast.service';
import { PubSubLogEntry, DidacticStepInfo } from '../models';

export interface MessageCounters {
  published: number;
  inventoryProcessed: number;
  notificationProcessed: number;
}

interface EnqueuedStep {
  type: 'publish' | 'inventory' | 'notification';
  orderId: string;
  data: any;
  receivedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private readonly toast = inject(ToastService);
  private hubConnection?: signalR.HubConnection;

  readonly connectionStatus = signal<'connected' | 'connecting' | 'disconnected'>('disconnected');
  readonly counters = signal<MessageCounters>({
    published: 0,
    inventoryProcessed: 0,
    notificationProcessed: 0
  });

  readonly activeNode = signal<string | null>(null);
  readonly logs = signal<PubSubLogEntry[]>([]);

  readonly orderEventTrigger = signal<number>(0);
  readonly inventoryEventTrigger = signal<number>(0);
  readonly notificationEventTrigger = signal<number>(0);

  // Didactic Step-by-Step Pacing signals
  readonly delaySeconds = signal<number>(5);
  readonly isPlaying = signal<boolean>(false);
  readonly currentStep = signal<DidacticStepInfo | null>(null);
  readonly pendingStepsCount = signal<number>(0);
  readonly pendingOrderIds = signal<Set<string>>(new Set());

  private stepQueue: EnqueuedStep[] = [];
  private isProcessingQueue = false;
  private abortCurrentTimer = false;

  isOrderPending(orderId: string): boolean {
    return this.pendingOrderIds().has(orderId);
  }

  setDelay(seconds: number): void {
    this.delaySeconds.set(seconds);
    if (seconds === 0) {
      this.skipCurrentStep();
    }
  }

  skipCurrentStep(): void {
    this.abortCurrentTimer = true;
  }

  startConnection(): void {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    this.connectionStatus.set('connecting');

    const baseUrl = (typeof window !== 'undefined' && window.location.port !== '4200' && window.location.port !== '') 
      ? window.location.origin 
      : 'http://localhost:5000';

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${baseUrl}/hubs/order-events`, {
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.registerHandlers();

    this.hubConnection
      .start()
      .then(() => {
        this.connectionStatus.set('connected');
        this.toast.success('SignalR Conectado', 'Conexão em tempo real estabelecida com o backend!');
      })
      .catch((err) => {
        this.connectionStatus.set('disconnected');
        console.warn('[SignalR] Falha ao conectar ao hub:', err);
      });

    this.hubConnection.onreconnecting(() => this.connectionStatus.set('connecting'));
    this.hubConnection.onreconnected(() => {
      this.connectionStatus.set('connected');
      this.toast.info('SignalR Reconectado', 'A transmissão de eventos em tempo real foi restaurada.');
    });
    this.hubConnection.onclose(() => this.connectionStatus.set('disconnected'));
  }

  private registerHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.on('OrderPublished', (data: any) => {
      this.enqueueStep({
        type: 'publish',
        orderId: String(data.orderId),
        data,
        receivedAt: new Date()
      });
    });

    this.hubConnection.on('InventoryProcessed', (data: any) => {
      this.enqueueStep({
        type: 'inventory',
        orderId: String(data.orderId),
        data,
        receivedAt: new Date()
      });
    });

    this.hubConnection.on('NotificationDispatched', (data: any) => {
      this.enqueueStep({
        type: 'notification',
        orderId: String(data.orderId),
        data,
        receivedAt: new Date()
      });
    });
  }

  private enqueueStep(step: EnqueuedStep): void {
    this.stepQueue.push(step);
    this.pendingStepsCount.set(this.stepQueue.length);
    this.processStepQueue();
  }

  private async processStepQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;
    this.isPlaying.set(true);

    try {
      while (this.stepQueue.length > 0) {
        const step = this.stepQueue.shift()!;
        this.pendingStepsCount.set(this.stepQueue.length);
        await this.executeStep(step);
      }
    } finally {
      this.isProcessingQueue = false;
      this.isPlaying.set(false);
      this.currentStep.set(null);
      this.activeNode.set(null);
    }
  }

  private async executeStep(step: EnqueuedStep): Promise<void> {
    const shortId = step.orderId.substring(0, 8);

    if (step.type === 'publish') {
      // 1. Mark order as pending in didactic state
      this.pendingOrderIds.update(set => {
        const next = new Set(set);
        next.add(step.orderId);
        return next;
      });

      // 2. Increment counters
      this.counters.update(c => ({ ...c, published: c.published + 1 }));

      // 3. Add to live console log
      this.addLog({
        id: Math.random().toString(36).substring(2, 9),
        stage: 'exchange',
        routingKey: step.data.routingKey || 'order.created',
        description: `[Etapa 1/3] Pedido #${shortId} registrado como 'Pendente' e publicado na Topic Exchange 'order-events' (${step.data.quantity}x ${step.data.productId})`,
        data: step.data,
        timestamp: new Date()
      });

      // 4. Toast notification
      this.toast.info(
        'Etapa 1/3: Publicação no RabbitMQ',
        `Pedido #${shortId} (${step.data.customerName}) registrado no SQL Server como 'Pendente' e despachado na Topic Exchange 'order-events' [key: ${step.data.routingKey}].`
      );

      // 5. Trigger order table reload so order appears as 'Pendente'
      this.orderEventTrigger.update(v => v + 1);

      // 6. Run visual timer (e.g. 5 seconds)
      await this.runStepTimer({
        orderId: step.orderId,
        stepNumber: 1,
        totalSteps: 3,
        title: 'Etapa 1 de 3: Publicação na Topic Exchange (order-events)',
        stageName: 'PRODUCER & TOPIC EXCHANGE',
        description: `O endpoint POST /orders gravou o pedido #${shortId} no SQL Server como 'Pendente' e publicou a mensagem com routing key '${step.data.routingKey}'. A exchange está avaliando as routing keys para entregar o evento às filas bound.`,
        nodeId1: 'producer',
        nodeId2: 'exchange',
        subStage1: 'producer_transit',
        subStage2: 'exchange_routing',
        routingKey: step.data.routingKey || 'order.created',
        customerName: step.data.customerName,
        productId: step.data.productId,
        quantity: step.data.quantity,
        amount: step.data.totalAmount,
        productInfo: `${step.data.quantity}x ${step.data.productId}`,
        rawPayload: step.data
      });

    } else if (step.type === 'inventory') {
      // 1. Remove order from pending set (now processed or failed)
      this.pendingOrderIds.update(set => {
        const next = new Set(set);
        next.delete(step.orderId);
        return next;
      });

      // 2. Increment counters
      this.counters.update(c => ({ ...c, inventoryProcessed: c.inventoryProcessed + 1 }));

      const isSuccess = step.data.success === true;

      // 3. Add to live console log
      this.addLog({
        id: Math.random().toString(36).substring(2, 9),
        stage: 'inventory_worker',
        routingKey: 'order.created',
        description: `[Etapa 2/3] InventoryWorker: ${step.data.message || 'Processamento de estoque concluído'} (Pedido #${shortId})`,
        data: step.data,
        timestamp: new Date()
      });

      // 4. Toast notification
      if (isSuccess) {
        this.toast.success(
          'Etapa 2/3: Estoque Atualizado',
          `InventoryWorker consumiu 'inventory-queue'. Saldo de ${step.data.productId}: ${step.data.remainingStock} un. Pedido #${shortId} alterado para 'Processado'.`
        );
      } else {
        this.toast.warning(
          'Etapa 2/3: Falha de Estoque',
          `InventoryWorker consumiu 'inventory-queue'. Estoque insuficiente para ${step.data.productId}. Pedido #${shortId} alterado para 'Falha'.`
        );
      }

      // 5. Trigger inventory cards and orders table reload
      this.inventoryEventTrigger.update(v => v + 1);
      this.orderEventTrigger.update(v => v + 1);

      // 6. Run visual timer (e.g. 5 seconds)
      await this.runStepTimer({
        orderId: step.orderId,
        stepNumber: 2,
        totalSteps: 3,
        title: 'Etapa 2 de 3: Consumo da Fila de Estoque (inventory-queue)',
        stageName: 'FILA 1 & INVENTORY WORKER',
        description: isSuccess
          ? `A mensagem foi bufferizada em 'inventory-queue' e puxada pelo InventoryWorker. O worker deduziu o estoque no SQL Server e marcou o pedido #${shortId} como 'Processado'.`
          : `O InventoryWorker detectou saldo insuficiente para ${step.data.productId}. O pedido #${shortId} foi atualizado para 'Falha'.`,
        nodeId1: 'inventory_queue',
        nodeId2: 'inventory_worker',
        subStage1: 'inventory_buffering',
        subStage2: 'inventory_consuming',
        routingKey: 'order.created',
        productId: step.data.productId,
        quantity: step.data.quantity,
        remainingStock: step.data.remainingStock,
        success: isSuccess,
        message: step.data.message,
        productInfo: `${step.data.productId} (Saldo: ${step.data.remainingStock})`,
        rawPayload: step.data
      });

    } else if (step.type === 'notification') {
      // 1. Increment counters
      this.counters.update(c => ({ ...c, notificationProcessed: c.notificationProcessed + 1 }));

      // 2. Add to live console log
      this.addLog({
        id: Math.random().toString(36).substring(2, 9),
        stage: 'notification_worker',
        routingKey: 'order.#',
        description: `[Etapa 3/3] NotificationWorker: Notificação emitida para ${step.data.customerName} via wildcard 'order.#' (Pedido #${shortId})`,
        data: step.data,
        timestamp: new Date()
      });

      // 3. Toast notification
      this.toast.info(
        'Etapa 3/3: Notificação Gerada',
        `NotificationWorker consumiu 'notification-queue' (binding curinga order.#). E-mail emitido para ${step.data.customerName} e salvo na tabela NotificationLogs.`
      );

      // 4. Trigger notifications feed reload
      this.notificationEventTrigger.update(v => v + 1);

      // 5. Run visual timer (e.g. 5 seconds)
      await this.runStepTimer({
        orderId: step.orderId,
        stepNumber: 3,
        totalSteps: 3,
        title: 'Etapa 3 de 3: Consumo da Fila de Notificações (notification-queue)',
        stageName: 'FILA 2 & NOTIFICATION WORKER',
        description: `A mensagem foi bufferizada em 'notification-queue' (binding curinga 'order.#') e consumida pelo NotificationWorker, que registrou o envio de e-mail ao cliente na tabela NotificationLogs.`,
        nodeId1: 'notification_queue',
        nodeId2: 'notification_worker',
        subStage1: 'notification_buffering',
        subStage2: 'notification_consuming',
        routingKey: 'order.#',
        customerName: step.data.customerName,
        message: step.data.message,
        rawPayload: step.data
      });

      // 6. Cycle completion toast
      this.toast.success(
        'Ciclo EDA Concluído',
        `Todas as 3 etapas do fluxo de mensageria foram finalizadas com sucesso para o pedido #${shortId}!`
      );
    }
  }

  private async runStepTimer(info: {
    orderId: string;
    stepNumber: number;
    totalSteps: number;
    title: string;
    stageName: string;
    description: string;
    nodeId1: string;
    nodeId2: string;
    subStage1: 'producer_transit' | 'exchange_routing' | 'inventory_buffering' | 'inventory_consuming' | 'notification_buffering' | 'notification_consuming';
    subStage2: 'producer_transit' | 'exchange_routing' | 'inventory_buffering' | 'inventory_consuming' | 'notification_buffering' | 'notification_consuming';
    routingKey?: string;
    customerName?: string;
    productId?: string;
    quantity?: number;
    amount?: number;
    success?: boolean;
    remainingStock?: number;
    message?: string;
    productInfo?: string;
    rawPayload?: any;
  }): Promise<void> {
    const totalSec = this.delaySeconds();

    if (totalSec <= 0) {
      this.activeNode.set(info.nodeId2);
      this.currentStep.set(null);
      return;
    }

    const halfSec = Math.ceil(totalSec / 2);
    this.abortCurrentTimer = false;

    for (let s = totalSec; s > 0; s--) {
      if (this.abortCurrentTimer) {
        this.abortCurrentTimer = false;
        break;
      }

      const currentNode = s > halfSec ? info.nodeId1 : info.nodeId2;
      const currentSubStage = s > halfSec ? info.subStage1 : info.subStage2;
      this.activeNode.set(currentNode);

      this.currentStep.set({
        orderId: info.orderId,
        stepNumber: info.stepNumber,
        totalSteps: info.totalSteps,
        title: info.title,
        stageName: info.stageName,
        description: info.description,
        nodeId: currentNode,
        subStage: currentSubStage,
        remainingSeconds: s,
        totalSeconds: totalSec,
        routingKey: info.routingKey,
        customerName: info.customerName,
        productId: info.productId,
        quantity: info.quantity,
        amount: info.amount,
        success: info.success,
        remainingStock: info.remainingStock,
        message: info.message,
        productInfo: info.productInfo,
        rawPayload: info.rawPayload
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private addLog(entry: PubSubLogEntry): void {
    this.logs.update(current => [entry, ...current.slice(0, 49)]);
  }

  clearLogs(): void {
    this.logs.set([]);
  }

  resetCounters(): void {
    this.counters.set({
      published: 0,
      inventoryProcessed: 0,
      notificationProcessed: 0
    });
  }
}

