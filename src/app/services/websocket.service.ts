import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Client } from '@stomp/stompjs';
import { WebSocketMessage } from '../models/websocket-message.model';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private stompClient: Client;
  private messageSubject = new BehaviorSubject<WebSocketMessage | null>(null);
  private connectionStatus = new BehaviorSubject<boolean>(false);

  constructor() {
    this.stompClient = new Client({
      // Usa WebSocket nativo invece di SockJS
      brokerURL: 'ws://localhost:8080/ws',
      connectHeaders: {},
      debug: (str) => {
        console.log('STOMP: ' + str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });
  }

  connect(sessionCode: string): void {
    this.stompClient.onConnect = (frame) => {
      console.log('Connected: ' + frame);
      this.connectionStatus.next(true);
      
      // Subscribe to session updates
      this.stompClient.subscribe(`/topic/session/${sessionCode}`, (message) => {
        const wsMessage: WebSocketMessage = JSON.parse(message.body);
        this.messageSubject.next(wsMessage);
      });
    };

    this.stompClient.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
      this.connectionStatus.next(false);
    };

    this.stompClient.onWebSocketError = (error) => {
      console.error('WebSocket connection error:', error);
      this.connectionStatus.next(false);
    };

    this.stompClient.activate();
  }

  disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.connectionStatus.next(false);
    }
  }

  getMessages(): Observable<WebSocketMessage | null> {
    return this.messageSubject.asObservable();
  }

  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus.asObservable();
  }
}