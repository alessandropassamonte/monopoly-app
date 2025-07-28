import { BehaviorSubject, Observable } from 'rxjs';
import { GameSession } from '../models/game-session.model';
import { Player } from '../models/player.model';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private currentSession = new BehaviorSubject<GameSession | null>(null);
  private currentPlayer = new BehaviorSubject<Player | null>(null);

  getCurrentSession(): Observable<GameSession | null> {
    return this.currentSession.asObservable();
  }

  setCurrentSession(session: GameSession | null): void {
    this.currentSession.next(session);
  }

  getCurrentPlayer(): Observable<Player | null> {
    return this.currentPlayer.asObservable();
  }

  setCurrentPlayer(player: Player | null): void {
    this.currentPlayer.next(player);
  }

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
