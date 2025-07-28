import { BehaviorSubject, Observable } from 'rxjs';
import * as SockJS from 'sockjs-client';
import * as Stomp from 'stompjs';
import { WebSocketMessage } from '../models/websocket-message.model';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private stompClient: any;
  private messageSubject = new BehaviorSubject<WebSocketMessage | null>(null);
  private connectionStatus = new BehaviorSubject<boolean>(false);

  constructor() {}

  connect(sessionCode: string): void {
    const socket = new SockJS('http://localhost:8080/ws');
    this.stompClient = Stomp.over(socket);
    
    this.stompClient.connect({}, () => {
      this.connectionStatus.next(true);
      
      // Subscribe to session updates
      this.stompClient.subscribe(`/topic/session/${sessionCode}`, (message: any) => {
        const wsMessage: WebSocketMessage = JSON.parse(message.body);
        this.messageSubject.next(wsMessage);
      });
    }, (error: any) => {
      console.error('WebSocket connection error:', error);
      this.connectionStatus.next(false);
    });
  }

  disconnect(): void {
    if (this.stompClient) {
      this.stompClient.disconnect();
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