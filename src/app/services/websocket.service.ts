

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Client } from '@stomp/stompjs';
import { WebSocketMessage } from '../models/websocket-message.model';
import { environment } from 'src/environment';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private stompClient: Client;
  private messageSubject = new BehaviorSubject<WebSocketMessage | null>(null);
  private connectionStatus = new BehaviorSubject<boolean>(false);
  private currentSessionCode: string | null = null;

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.stompClient = new Client({
      brokerURL: this.getWebSocketUrl(),
      connectHeaders: {},
      debug: (str) => {
        console.log('STOMP: ' + str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    this.setupConnectionHandlers();
  }

  private getWebSocketUrl(): string {
    // 🔧 FIX: Usa ws_uri dall'environment invece di costruire l'URL
    if (environment.ws_uri) {
      // Assicurati che usi il protocollo corretto
      const wsUrl = environment.ws_uri.replace('http://', 'ws://').replace('https://', 'wss://');
      return `${wsUrl}/ws`;
    }

    // Fallback per sviluppo locale
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = environment.host || window.location.hostname;
    
    // 🔧 FIX: Non includere porta per deployment di produzione
    const isProduction = environment.production || host.includes('railway.app');
    if (isProduction) {
      return `${protocol}//${host}/ws`;
    } else {
      // Solo per sviluppo locale
      return `${protocol}//${host}:8080/ws`;
    }
  }

  private setupConnectionHandlers(): void {
    this.stompClient.onConnect = (frame) => {
      console.log('✅ WebSocket Connected: ' + frame);
      this.connectionStatus.next(true);
      this.reconnectAttempts = 0;

      if (this.currentSessionCode) {
        this.subscribeToSession(this.currentSessionCode);
      }
    };

    this.stompClient.onStompError = (frame) => {
      console.error('❌ STOMP error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
      this.connectionStatus.next(false);
      this.handleConnectionError();
    };

    this.stompClient.onWebSocketError = (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.connectionStatus.next(false);
      this.handleConnectionError();
    };

    this.stompClient.onWebSocketClose = (event) => {
      console.log('🔌 WebSocket connection closed:', event);
      this.connectionStatus.next(false);
      this.handleConnectionError();
    };
  }

  private handleConnectionError(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.currentSessionCode) {
      this.reconnectAttempts++;
      console.log(`🔄 Tentativo riconnessione ${this.reconnectAttempts}/${this.maxReconnectAttempts} in 5 secondi...`);

      setTimeout(() => {
        if (this.currentSessionCode) {
          this.connect(this.currentSessionCode);
        }
      }, 5000);
    } else {
      console.error('❌ Raggiunto limite massimo tentativi riconnessione');
    }
  }

  connect(sessionCode: string): void {
    console.log(`🔌 Connecting to WebSocket for session: ${sessionCode}`);
    console.log(`🔗 WebSocket URL: ${this.getWebSocketUrl()}`);
    
    if (this.currentSessionCode && this.currentSessionCode !== sessionCode) {
      console.log('🔄 Different session detected, forcing clean disconnect');
      this.forceCleanDisconnect();
      setTimeout(() => {
        this.actualConnect(sessionCode);
      }, 100);
      return;
    }
    
    this.actualConnect(sessionCode);
  }

  private actualConnect(sessionCode: string): void {
    this.currentSessionCode = sessionCode;
    
    if (this.stompClient.connected) {
      this.disconnect();
    }

    try {
      this.stompClient.activate();
    } catch (error) {
      console.error('❌ Errore attivazione WebSocket:', error);
      this.handleConnectionError();
    }
  }

  private subscribeToSession(sessionCode: string): void {
    if (!this.stompClient.connected) {
      console.warn('⚠️ WebSocket non connesso, impossibile sottoscrivere');
      return;
    }

    try {
      this.stompClient.subscribe(`/topic/session/${sessionCode}`, (message) => {
        try {
          const wsMessage: WebSocketMessage = JSON.parse(message.body);
          console.log('📨 Messaggio WebSocket ricevuto:', wsMessage);
          this.messageSubject.next(wsMessage);
        } catch (parseError) {
          console.error('❌ Errore parsing messaggio WebSocket:', parseError);
        }
      });

      console.log(`✅ Sottoscritto ai messaggi della sessione: ${sessionCode}`);
    } catch (error) {
      console.error('❌ Errore sottoscrizione WebSocket:', error);
    }
  }

  disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...');
    this.currentSessionCode = null;
    this.reconnectAttempts = 0;

    if (this.stompClient) {
      try {
        this.stompClient.deactivate();
      } catch (error) {
        console.error('❌ Errore disconnessione WebSocket:', error);
      }
    }

    this.connectionStatus.next(false);
  }

  forceCleanDisconnect(): void {
    console.log('🧹 Forcing clean WebSocket disconnect...');
    
    this.currentSessionCode = null;
    this.reconnectAttempts = 0;
    
    if (this.stompClient) {
      try {
        this.stompClient.deactivate();
      } catch (error) {
        console.error('❌ Errore durante disconnessione forzata:', error);
      }
    }
    
    this.messageSubject.next(null);
    this.connectionStatus.next(false);
    
    console.log('✅ WebSocket clean disconnect completed');
  }

  getMessages(): Observable<WebSocketMessage | null> {
    return this.messageSubject.asObservable();
  }

  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus.asObservable();
  }

  forceReconnect(): void {
    console.log('🔄 Forzando riconnessione WebSocket...');
    if (this.currentSessionCode) {
      this.disconnect();
      setTimeout(() => {
        if (this.currentSessionCode) {
          this.connect(this.currentSessionCode);
        }
      }, 1000);
    }
  }

  isConnected(): boolean {
    return this.stompClient?.connected || false;
  }

  getCurrentSessionCode(): string | null {
    return this.currentSessionCode;
  }
}