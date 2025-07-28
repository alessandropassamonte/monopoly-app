import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GameSession } from '../models/game-session.model';
import { PlayerColor } from '../models/player.model';
import { Transaction } from '../models/transaction.model';
import { Property, PropertyOwnership } from '../models/property.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient) {}

  // Game Session APIs
  createSession(hostName: string): Observable<GameSession> {
    return this.http.post<GameSession>(`${this.baseUrl}/sessions`, { hostName });
  }

  getSession(sessionCode: string): Observable<GameSession> {
    return this.http.get<GameSession>(`${this.baseUrl}/sessions/${sessionCode}`);
  }

  joinSession(sessionCode: string, playerName: string, color: PlayerColor): Observable<GameSession> {
    return this.http.post<GameSession>(`${this.baseUrl}/sessions/${sessionCode}/join`, {
      playerName,
      color
    });
  }

  startGame(sessionCode: string, hostPlayerId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/sessions/${sessionCode}/start`, {
      hostPlayerId
    });
  }

  endSession(sessionCode: string, hostPlayerId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/sessions/${sessionCode}?hostPlayerId=${hostPlayerId}`);
  }

  // Bank APIs
  transferMoney(fromPlayerId: number, toPlayerId: number, amount: number, description: string): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.baseUrl}/bank/transfer`, {
      fromPlayerId,
      toPlayerId, 
      amount,
      description
    });
  }

  payToBank(playerId: number, amount: number, description: string): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.baseUrl}/bank/pay-to-bank`, {
      playerId,
      amount,
      description
    });
  }

  payFromBank(playerId: number, amount: number, description: string): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.baseUrl}/bank/pay-from-bank`, {
      playerId,
      amount,
      description
    });
  }

  getTransactions(sessionCode: string): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${this.baseUrl}/bank/transactions/${sessionCode}`);
  }

  // Property APIs
  getAllProperties(): Observable<Property[]> {
    return this.http.get<Property[]>(`${this.baseUrl}/properties`);
  }

  purchaseProperty(propertyId: number, playerId: number): Observable<PropertyOwnership> {
    return this.http.post<PropertyOwnership>(
      `${this.baseUrl}/properties/${propertyId}/purchase?playerId=${playerId}`, 
      {}
    );
  }

  getPlayerProperties(playerId: number): Observable<PropertyOwnership[]> {
    return this.http.get<PropertyOwnership[]>(`${this.baseUrl}/properties/player/${playerId}`);
  }

  mortgageProperty(ownershipId: number): Observable<PropertyOwnership> {
    return this.http.post<PropertyOwnership>(`${this.baseUrl}/properties/ownership/${ownershipId}/mortgage`, {});
  }

  redeemProperty(ownershipId: number): Observable<PropertyOwnership> {
    return this.http.post<PropertyOwnership>(`${this.baseUrl}/properties/ownership/${ownershipId}/redeem`, {});
  }

  buildHouse(ownershipId: number): Observable<PropertyOwnership> {
    return this.http.post<PropertyOwnership>(`${this.baseUrl}/properties/ownership/${ownershipId}/build-house`, {});
  }

  buildHotel(ownershipId: number): Observable<PropertyOwnership> {
    return this.http.post<PropertyOwnership>(`${this.baseUrl}/properties/ownership/${ownershipId}/build-hotel`, {});
  }

  calculateRent(propertyId: number, diceRoll: number = 7): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/properties/${propertyId}/rent?diceRoll=${diceRoll}`);
  }
}