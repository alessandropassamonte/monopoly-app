import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameSession } from '../models/game-session.model';
import { Player } from '../models/player.model';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private currentSession = new BehaviorSubject<GameSession | null>(null);
  private currentPlayer = new BehaviorSubject<Player | null>(null);
  private isInitialized = false;

  constructor() {
    // Ripristina automaticamente i dati salvati UNA SOLA VOLTA
    if (!this.isInitialized) {
      this.restoreFromStorage();
      this.isInitialized = true;
    }
  }

  getCurrentSession(): Observable<GameSession | null> {
    return this.currentSession.asObservable();
  }

  setCurrentSession(session: GameSession | null): void {
    console.log('=== SETTING CURRENT SESSION ===');
    console.log('Session:', session);
    console.log('Session players:', session?.players);
    
    // Evita aggiornamenti inutili
    const currentSessionValue = this.currentSession.value;
    if (this.sessionsEqual(currentSessionValue, session)) {
      console.log('Session unchanged, skipping update');
      return;
    }
    
    this.currentSession.next(session);
    
    // Salva nel localStorage
    if (session) {
      localStorage.setItem('monopoly_current_session', JSON.stringify(session));
      localStorage.setItem('monopoly_session_code', session.sessionCode);
    } else {
      localStorage.removeItem('monopoly_current_session');
      localStorage.removeItem('monopoly_session_code');
    }
  }

  getCurrentPlayer(): Observable<Player | null> {
    return this.currentPlayer.asObservable();
  }

  setCurrentPlayer(player: Player | null): void {
    console.log('=== SETTING CURRENT PLAYER ===');
    console.log('Player:', player);
    console.log('Player isHost:', player?.host);
    
    // Evita aggiornamenti inutili
    const currentPlayerValue = this.currentPlayer.value;
    if (this.playersEqual(currentPlayerValue, player)) {
      console.log('Player unchanged, skipping update');
      return;
    }
    
    this.currentPlayer.next(player);
    
    // Salva nel localStorage con logging dettagliato
    if (player) {
      const playerData = {
        id: player.id,
        name: player.name,
        host: player.host,
        color: player.color,
        balance: player.balance
      };
      
      console.log('Saving player data to localStorage:', playerData);
      
      localStorage.setItem('monopoly_current_player', JSON.stringify(playerData));
      localStorage.setItem('monopoly_player_id', player.id.toString());
      localStorage.setItem('monopoly_player_name', player.name);
      localStorage.setItem('monopoly_is_host', player.host.toString());
      localStorage.setItem('monopoly_player_color', player.color);
      
      // Timestamp per debug
      localStorage.setItem('monopoly_player_set_timestamp', new Date().toISOString());
    } else {
      console.log('Clearing player data from localStorage');
      localStorage.removeItem('monopoly_current_player');
      localStorage.removeItem('monopoly_player_id');
      localStorage.removeItem('monopoly_player_name');
      localStorage.removeItem('monopoly_is_host');
      localStorage.removeItem('monopoly_player_color');
      localStorage.removeItem('monopoly_player_set_timestamp');
    }
  }

  // Utility per confrontare sessioni
  private sessionsEqual(session1: GameSession | null, session2: GameSession | null): boolean {
    if (!session1 && !session2) return true;
    if (!session1 || !session2) return false;
    
    return session1.id === session2.id &&
           session1.sessionCode === session2.sessionCode &&
           session1.status === session2.status &&
           session1.players.length === session2.players.length &&
           JSON.stringify(session1.players.map(p => ({ id: p.id, balance: p.balance, propertiesCount: p.propertiesCount }))) ===
           JSON.stringify(session2.players.map(p => ({ id: p.id, balance: p.balance, propertiesCount: p.propertiesCount })));
  }

  // Utility per confrontare players
  private playersEqual(player1: Player | null, player2: Player | null): boolean {
    if (!player1 && !player2) return true;
    if (!player1 || !player2) return false;
    
    return player1.id === player2.id &&
           player1.name === player2.name &&
           player1.balance === player2.balance &&
           player1.color === player2.color &&
           player1.host === player2.host &&
           player1.propertiesCount === player2.propertiesCount;
  }

  // Ripristina automaticamente i dati dal localStorage
  private restoreFromStorage(): void {
    console.log('=== RESTORING FROM STORAGE ===');
    
    try {
      // Ripristina sessione
      const savedSession = localStorage.getItem('monopoly_current_session');
      if (savedSession) {
        const session = JSON.parse(savedSession) as GameSession;
        console.log('Restored session from storage:', session);
        this.currentSession.next(session);
      } else {
        console.log('No saved session found');
      }

      // Ripristina player
      const savedPlayer = localStorage.getItem('monopoly_current_player');
      if (savedPlayer) {
        const player = JSON.parse(savedPlayer) as Player;
        console.log('Restored player from storage:', player);
        console.log('Restored player isHost:', player.host);
        
        // Log timestamp di quando è stato salvato
        const timestamp = localStorage.getItem('monopoly_player_set_timestamp');
        console.log('Player was saved at:', timestamp);
        
        this.currentPlayer.next(player);
      } else {
        console.log('No saved player found');
      }
      
      // Debug completo localStorage
      this.debugLocalStorage();
      
    } catch (error) {
      console.error('Error restoring from storage:', error);
      this.clearStorage();
    }
  }

  // Debug completo del localStorage
  debugLocalStorage(): void {
    console.log('=== LOCALSTORAGE COMPLETE DEBUG ===');
    const keys = [
      'monopoly_current_session',
      'monopoly_session_code', 
      'monopoly_current_player',
      'monopoly_player_id',
      'monopoly_player_name',
      'monopoly_is_host',
      'monopoly_player_color',
      'monopoly_player_set_timestamp',
      'monopoly_debug_host_name',
      'monopoly_debug_session_players',
      'monopoly_manual_selection',
      'monopoly_selected_player_id'
    ];
    
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      console.log(`${key}:`, value);
    });
  }

  // RIMOSSO: updateCurrentPlayerInSession() - causava potenziali loop

  // Verifica se il giocatore corrente fa parte della sessione corrente
  validateCurrentPlayer(): boolean {
    const session = this.currentSession.value;
    const player = this.currentPlayer.value;
    
    console.log('=== VALIDATING CURRENT PLAYER ===');
    console.log('Session:', session?.sessionCode);
    console.log('Player:', player?.name);
    
    if (!session || !player) {
      console.log('Validation failed: missing session or player');
      return false;
    }

    const playerInSession = session.players.find(p => p.id === player.id);
    const isValid = !!playerInSession;
    
    console.log('Player found in session:', playerInSession);
    console.log('Validation result:', isValid);
    
    return isValid;
  }

  // Trova un player per nome nella sessione corrente
  findPlayerByName(name: string): Player | null {
    const session = this.currentSession.value;
    if (!session) return null;
    
    return session.players.find(p => 
      p.name.toLowerCase() === name.toLowerCase()
    ) || null;
  }

  // Trova l'host della sessione corrente
  findHostPlayer(): Player | null {
    const session = this.currentSession.value;
    if (!session) return null;
    
    const host = session.players.find(p => p.host === true);
    console.log('Found host player:', host);
    return host || null;
  }

  // Pulisce tutti i dati
  clearStorage(): void {
    console.log('=== CLEARING ALL GAME STORAGE ===');
    
    const keysToRemove = [
      'monopoly_current_session',
      'monopoly_session_code',
      'monopoly_current_player',
      'monopoly_player_id',
      'monopoly_player_name',
      'monopoly_is_host',
      'monopoly_player_color',
      'monopoly_player_set_timestamp',
      'monopoly_debug_host_name',
      'monopoly_debug_session_players',
      'monopoly_debug_session_players_join',
      'monopoly_debug_join_name',
      'monopoly_debug_join_color',
      'monopoly_manual_selection',
      'monopoly_selected_player_id'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    this.currentSession.next(null);
    this.currentPlayer.next(null);
    
    console.log('Storage cleared completely');
  }

  // Utility methods
  getPlayerColorClass(color: string): string {
    const colorMap: { [key: string]: string } = {
      'RED': 'player-red',
      'BLUE': 'player-blue', 
      'GREEN': 'player-green',
      'YELLOW': 'player-yellow',
      'PURPLE': 'player-purple',
      'ORANGE': 'player-orange',
      'BLACK': 'player-black',
      'WHITE': 'player-white'
    };
    return colorMap[color] || 'player-default';
  }

  getPropertyColorClass(color: string): string {
    const colorMap: { [key: string]: string } = {
      'BROWN': 'property-brown',
      'LIGHT_BLUE': 'property-light-blue',
      'PINK': 'property-pink',
      'ORANGE': 'property-orange',
      'RED': 'property-red', 
      'YELLOW': 'property-yellow',
      'GREEN': 'property-green',
      'DARK_BLUE': 'property-dark-blue'
    };
    return colorMap[color] || 'property-default';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(amount);
  }
}