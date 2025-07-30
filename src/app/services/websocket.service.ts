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

  // AGGIUNTO: Tracciamento stato connessione
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.stompClient = new Client({
      // CORREZIONE: URL dinamico basato su window.location
      brokerURL: this.getWebSocketUrl(),
      connectHeaders: {},
      debug: (str) => {
        console.log('STOMP: ' + str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    // AGGIUNTO: Gestione eventi di connessione migliorata
    this.setupConnectionHandlers();
  }

  private getWebSocketUrl(): string {
    // Determina automaticamente l'URL WebSocket basato su window.location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = environment.host;
    const port = '8080'; // Porta del server Spring
    return `${protocol}//${host}:${port}/ws`;
  }

  private setupConnectionHandlers(): void {
    this.stompClient.onConnect = (frame) => {
      console.log('✅ WebSocket Connected: ' + frame);
      this.connectionStatus.next(true);
      this.reconnectAttempts = 0;

      // Riconnetti alla sessione se era attiva
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

forceCleanDisconnect(): void {
  console.log('🧹 Forcing clean WebSocket disconnect...');
  
  // Reset di tutte le variabili di stato
  this.currentSessionCode = null;
  this.reconnectAttempts = 0;
  
  // Disconnetti completamente
  if (this.stompClient) {
    try {
      this.stompClient.deactivate();
    } catch (error) {
      console.error('❌ Errore durante disconnessione forzata:', error);
    }
  }
  
  // Reset degli observable
  this.messageSubject.next(null);
  this.connectionStatus.next(false);
  
  console.log('✅ WebSocket clean disconnect completed');
}

connect(sessionCode: string): void {
  console.log(`🔌 Connecting to WebSocket for session: ${sessionCode}`);
  
  // AGGIUNTO: Se cambio sessione, disconnetti prima
  if (this.currentSessionCode && this.currentSessionCode !== sessionCode) {
    console.log('🔄 Different session detected, forcing clean disconnect');
    this.forceCleanDisconnect();
    // Piccolo delay per assicurarsi che tutto sia pulito
    setTimeout(() => {
      this.actualConnect(sessionCode);
    }, 100);
    return;
  }
  
  this.actualConnect(sessionCode);
}

// E sposta il codice originale del connect in questo metodo:
private actualConnect(sessionCode: string): void {
  this.currentSessionCode = sessionCode;
  
  // Disconnetti se già connesso
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
      // Subscribe to session updates
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

  getMessages(): Observable<WebSocketMessage | null> {
    return this.messageSubject.asObservable();
  }

  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus.asObservable();
  }

  // AGGIUNTO: Metodo per forzare la riconnessione
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

  // AGGIUNTO: Metodo per verificare lo stato
  isConnected(): boolean {
    return this.stompClient?.connected || false;
  }

  // AGGIUNTO: Metodo per ottenere la sessione corrente
  getCurrentSessionCode(): string | null {
    return this.currentSessionCode;
  }
}