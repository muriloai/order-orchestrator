export interface Order {
  id: string;
  customerName: string;
  productId: string;
  quantity: number;
  totalAmount: number;
  status: number | string;
  processingAttempts?: number;
  lastProcessingError?: string;
  createdAt: string;
  updatedAt?: string;
}

export enum OrderStatus {
  Pending = 0,
  Processed = 1,
  Failed = 2
}

export interface Inventory {
  id: string;
  productId: string;
  productName: string;
  availableQuantity: number;
}

export interface NotificationLog {
  id: string;
  orderId: string;
  customerName: string;
  message: string;
  sentAt: string;
}

export interface CreateOrderRequest {
  customerName: string;
  productId: string;
  quantity: number;
  totalAmount: number;
}

export interface CreateOrderResponse {
  orderId: string;
  customerName: string;
  productId: string;
  quantity: number;
  totalAmount: number;
  status: number | string;
  createdAt: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
}

export interface PubSubLogEntry {
  id: string;
  stage: 'producer' | 'exchange' | 'inventory_queue' | 'notification_queue' | 'inventory_worker' | 'notification_worker';
  routingKey?: string;
  description: string;
  data: any;
  timestamp: Date;
}

export interface DidacticStepInfo {
  orderId: string;
  stepNumber: number;
  totalSteps: number;
  title: string;
  stageName: string;
  description: string;
  nodeId: string;
  subStage?: 'producer_transit' | 'exchange_routing' | 'inventory_buffering' | 'inventory_consuming' | 'notification_buffering' | 'notification_consuming';
  remainingSeconds: number;
  totalSeconds: number;
  routingKey?: string;
  customerName?: string;
  productId?: string;
  quantity?: number;
  productInfo?: string;
  amount?: number;
  success?: boolean;
  remainingStock?: number;
  message?: string;
  rawPayload?: any;
}



