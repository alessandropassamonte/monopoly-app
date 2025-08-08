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
  private maxReconnectAttempts = environment.websocket?.maxReconnectAttempts || 10;
  private reconnectDelay = environment.websocket?.reconnectDelay || 5000;

  constructor() {
    this.initializeWebSocketClient();
  }

  private initializeWebSocketClient(): void {
      interface WebSocketConfig {
        debug?: boolean;
        heartbeatIncoming?: number;
        heartbeatOutgoing?: number;
        connectionTimeout?: number;
        maxReconnectAttempts?: number;
        reconnectDelay?: number;
      }
      
      const wsConfig: WebSocketConfig = environment.websocket || {};
      
      this.stompClient = new Client({
      brokerURL: this.getWebSocketUrl(),
      connectHeaders: {},
      debug: wsConfig.debug ? (str) => console.log('🔍 STOMP:', str) : undefined,
      
      // ⚠️ Configurazioni critiche per HTTPS/WSS
      reconnectDelay: this.reconnectDelay,
      heartbeatIncoming: wsConfig.heartbeatIncoming || 25000,
      heartbeatOutgoing: wsConfig.heartbeatOutgoing || 25000,
      
      // ✅ Configurazioni aggiuntive per stabilità
      connectionTimeout: wsConfig.connectionTimeout || 10000,
      
      // Configurazione WebSocket per HTTPS
      webSocketFactory: () => {
        const ws = new WebSocket(this.getWebSocketUrl());
        
        // Headers aggiuntivi per HTTPS
        ws.addEventListener('open', () => {
          console.log('✅ WebSocket nativo aperto');
        });
        
        ws.addEventListener('error', (error) => {
          console.error('❌ WebSocket nativo errore:', error);
        });
        
        return ws;
      }
    });

    this.setupConnectionHandlers();
  }

  private getWebSocketUrl(): string {
    // ✅ Usa direttamente l'URL configurato nell'environment
    if (environment.ws_uri) {
      console.log('🔗 Connessione WebSocket a:', environment.ws_uri);
      return environment.ws_uri;
    }

    // Fallback per sviluppo locale
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = environment.host || window.location.hostname;
    const port = environment.production ? '' : ':8080';
    
    const wsUrl = `${protocol}//${host}${port}/ws`;
    console.log('🔗 Fallback WebSocket URL:', wsUrl);
    return wsUrl;
  }

  private setupConnectionHandlers(): void {
    this.stompClient.onConnect = (frame) => {
      console.log('✅ WebSocket Connesso:', frame);
      this.connectionStatus.next(true);
      this.reconnectAttempts = 0;

      if (this.currentSessionCode) {
        this.subscribeToSession(this.currentSessionCode);
      }
    };

    this.stompClient.onStompError = (frame) => {
      console.error('❌ STOMP Errore:', frame.headers['message']);
      console.error('Dettagli:', frame.body);
      this.connectionStatus.next(false);
      this.handleConnectionError();
    };

    this.stompClient.onWebSocketError = (error) => {
      console.error('❌ WebSocket Errore:', error);
      this.connectionStatus.next(false);
      this.handleConnectionError();
    };

    this.stompClient.onWebSocketClose = (event) => {
      console.log('🔌 WebSocket Chiuso:', event);
      this.connectionStatus.next(false);
      
      // Non riconnettere automaticamente se la chiusura è intenzionale
      if (event.code !== 1000) { // 1000 = chiusura normale
        this.handleConnectionError();
      }
    };

    // ✅ Handler aggiuntivo per disconnect
    this.stompClient.onDisconnect = (frame) => {
      console.log('🔌 STOMP Disconnesso:', frame);
      this.connectionStatus.next(false);
    };
  }

  private handleConnectionError(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1); // Exponential backoff
      
      console.log(`🔄 Tentativo riconnessione ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay/1000}s...`);

      setTimeout(() => {
        if (this.currentSessionCode && !this.stompClient.connected) {
          console.log('🔄 Riconnessione WebSocket...');
          this.connect(this.currentSessionCode);
        }
      }, delay);
    } else {
      console.error('❌ Impossibile riconnettersi dopo', this.maxReconnectAttempts, 'tentativi');
      // Potresti emettere un evento per informare l'UI
      this.messageSubject.next({
        type: 'CONNECTION_FAILED',
        sessionCode: this.currentSessionCode || '',
        data: { message: 'Connessione persa. Ricarica la pagina.' },
        timestamp: new Date().toISOString()
      });
    }
  }

  connect(sessionCode: string): void {
    this.currentSessionCode = sessionCode;
    
    if (this.stompClient.connected) {
      console.log('✅ WebSocket già connesso');
      this.subscribeToSession(sessionCode);
      return;
    }

    console.log('🔗 Connessione WebSocket per sessione:', sessionCode);
    this.stompClient.activate();
  }

  disconnect(): void {
    console.log('🔌 Disconnessione WebSocket...');
    this.currentSessionCode = null;
    this.reconnectAttempts = 0;
    
    if (this.stompClient.connected) {
      this.stompClient.deactivate();
    }
    
    this.connectionStatus.next(false);
  }

  private subscribeToSession(sessionCode: string): void {
    if (!this.stompClient.connected) {
      console.warn('⚠️ STOMP non connesso, impossibile sottoscriversi');
      return;
    }

    console.log('📡 Sottoscrizione alla sessione:', sessionCode);
    
    this.stompClient.subscribe(`/topic/session/${sessionCode}`, (message) => {
      try {
        const wsMessage: WebSocketMessage = JSON.parse(message.body);
        console.log('📩 Messaggio ricevuto:', wsMessage.type);
        this.messageSubject.next(wsMessage);
      } catch (error) {
        console.error('❌ Errore parsing messaggio WebSocket:', error);
      }
    });
  }

  // Metodi pubblici
  getMessages(): Observable<WebSocketMessage | null> {
    return this.messageSubject.asObservable();
  }

  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus.asObservable();
  }

  isConnected(): boolean {
    return this.stompClient.connected;
  }

  // Metodo per forzare la riconnessione
  forceReconnect(): void {
    console.log('🔄 Riconnessione forzata...');
    this.reconnectAttempts = 0;
    this.disconnect();
    
    if (this.currentSessionCode) {
      setTimeout(() => {
        this.connect(this.currentSessionCode!);
      }, 1000);
    }
  }
}