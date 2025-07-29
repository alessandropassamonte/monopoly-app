// src/app/services/api.service.ts
// VERSIONE AGGIORNATA con metodi migliorati

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GameSession } from '../models/game-session.model';
import { PlayerColor } from '../models/player.model';
import { Transaction } from '../models/transaction.model';
import { Property, PropertyOwnership } from '../models/property.model';
import { environment } from 'src/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // private readonly baseUrl = 'http://localhost:8080/api';
  private readonly baseUrl = environment.api_url + 'api';

  constructor(private http: HttpClient) { }

  // ============================================
  // Game Session APIs
  // ============================================
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

  // ============================================
  // Bank APIs - Semplificati per UX migliore
  // ============================================
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

  // ============================================
  // Property APIs - Ottimizzati per UX
  // ============================================
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

  // ============================================
  // NUOVO: APIs per pagamento affitti semplificato
  // ============================================

  /**
   * Pagamento affitto con calcolo automatico
   */
  payRent(propertyId: number, tenantPlayerId: number, diceRoll: number = 7): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.baseUrl}/properties/${propertyId}/pay-rent`, {
      tenantPlayerId,
      diceRoll
    });
  }

  /**
   * NUOVO: Ottieni tutte le proprietà affittabili (non ipotecate) degli altri giocatori
   */
  getRentablePropertiesForPlayer(currentPlayerId: number): Observable<{
    propertyId: number;
    propertyName: string;
    ownerName: string;
    ownerId: number;
    propertyType: string;
    colorGroup: string;
    estimatedRent: number;
    houses: number;
    hasHotel: boolean;
  }[]> {
    return this.http.get<{
      propertyId: number;
      propertyName: string;
      ownerName: string;
      ownerId: number;
      propertyType: string;
      colorGroup: string;
      estimatedRent: number;
      houses: number;
      hasHotel: boolean;
    }[]>(`${this.baseUrl}/properties/rentable/${currentPlayerId}`);
  }

  /**
   * NUOVO: Verifica se una proprietà può essere affittata
   */
  canPayRentForProperty(propertyId: number): Observable<{
    canPayRent: boolean;
    reason?: string;
    estimatedRent: number;
    ownerName: string;
  }> {
    return this.http.get<{
      canPayRent: boolean;
      reason?: string;
      estimatedRent: number;
      ownerName: string;
    }>(`${this.baseUrl}/properties/${propertyId}/rent-info`);
  }

  // ============================================
  // Vendita edifici
  // ============================================

  /**
   * Vendita casa
   */
  sellHouse(ownershipId: number): Observable<PropertyOwnership> {
    return this.http.post<PropertyOwnership>(`${this.baseUrl}/properties/ownership/${ownershipId}/sell-house`, {});
  }

  /**
   * Vendita hotel
   */
  sellHotel(ownershipId: number): Observable<PropertyOwnership> {
    return this.http.post<PropertyOwnership>(`${this.baseUrl}/properties/ownership/${ownershipId}/sell-hotel`, {});
  }

  /**
   * Trasferimento proprietà tra giocatori
   */
  transferProperty(ownershipId: number, newOwnerId: number, price?: number, description?: string): Observable<PropertyOwnership> {
    return this.http.post<PropertyOwnership>(`${this.baseUrl}/properties/ownership/${ownershipId}/transfer`, {
      newOwnerId,
      price: price || null,
      description: description || 'Trasferimento proprietà'
    });
  }

  /**
   * Ottieni tutte le proprietà possedute in una sessione
   */
  getSessionProperties(sessionCode: string): Observable<PropertyOwnership[]> {
    return this.http.get<PropertyOwnership[]>(`${this.baseUrl}/properties/session/${sessionCode}`);
  }

  // ============================================
  // NUOVO: APIs semplificate per building costs
  // ============================================

  /**
   * NUOVO: Ottieni il costo di costruzione per un gruppo colore
   */
  getBuildingCostForProperty(propertyId: number): Observable<{
    houseCost: number;
    hotelCost: number;
    sellPrice: number;
  }> {
    return this.http.get<{
      houseCost: number;
      hotelCost: number;
      sellPrice: number;
    }>(`${this.baseUrl}/properties/${propertyId}/building-costs`);
  }

  /**
   * NUOVO: Verifica se un giocatore può costruire su una proprietà
   */
  canBuildOnProperty(ownershipId: number): Observable<{
    canBuildHouse: boolean;
    canBuildHotel: boolean;
    canSellHouse: boolean;
    canSellHotel: boolean;
    reasons: string[];
  }> {
    return this.http.get<{
      canBuildHouse: boolean;
      canBuildHotel: boolean;
      canSellHouse: boolean;
      canSellHotel: boolean;
      reasons: string[];
    }>(`${this.baseUrl}/properties/ownership/${ownershipId}/building-options`);
  }

  // ============================================
  // Bankruptcy APIs
  // ============================================

  /**
   * Calcola il valore di liquidazione di un giocatore
   */
  calculateLiquidationValue(playerId: number): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/bankruptcy/liquidation-value/${playerId}`);
  }

  /**
   * Calcola il patrimonio netto di un giocatore
   */
  calculateNetWorth(playerId: number): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/bankruptcy/net-worth/${playerId}`);
  }

  /**
   * Liquidazione forzata degli asset
   */
  liquidateAssets(playerId: number): Observable<{ liquidatedAmount: number, message: string }> {
    return this.http.post<{ liquidatedAmount: number, message: string }>(`${this.baseUrl}/bankruptcy/liquidate/${playerId}`, {});
  }

  /**
   * Dichiarazione di bancarotta
   */
  declareBankruptcy(bankruptPlayerId: number, creditorPlayerId?: number): Observable<{ status: string, message: string }> {
    return this.http.post<{ status: string, message: string }>(`${this.baseUrl}/bankruptcy/declare`, {
      bankruptPlayerId,
      creditorPlayerId: creditorPlayerId || null
    });
  }

  /**
   * Verifica bancarotta per un debito specifico
   */
  checkBankruptcy(playerId: number, debtAmount: number): Observable<{
    isBankrupt: boolean,
    liquidationValue: number,
    debtAmount: number,
    shortfall: number
  }> {
    return this.http.get<{
      isBankrupt: boolean,
      liquidationValue: number,
      debtAmount: number,
      shortfall: number
    }>(`${this.baseUrl}/bankruptcy/check/${playerId}/${debtAmount}`);
  }

  // ============================================
  // NUOVO: APIs per statistiche e reportistica
  // ============================================

  /**
   * NUOVO: Ottieni statistiche complete di un giocatore
   */
  getPlayerStats(playerId: number): Observable<{
    balance: number;
    netWorth: number;
    propertiesCount: number;
    monopoliesCount: number;
    totalIncome: number;
    totalExpenses: number;
    averageRent: number;
  }> {
    return this.http.get<{
      balance: number;
      netWorth: number;
      propertiesCount: number;
      monopoliesCount: number;
      totalIncome: number;
      totalExpenses: number;
      averageRent: number;
    }>(`${this.baseUrl}/players/${playerId}/stats`);
  }

  /**
   * NUOVO: Ottieni riepilogo completo di una sessione
   */
  getSessionSummary(sessionCode: string): Observable<{
    totalTransactions: number;
    totalMoney: number;
    gameLength: string;
    playersStats: Array<{
      playerId: number;
      playerName: string;
      balance: number;
      propertiesCount: number;
      totalTransactions: number;
    }>;
    propertyDistribution: {
      [colorGroup: string]: {
        totalProperties: number;
        ownedProperties: number;
        owners: string[];
      };
    };
  }> {
    return this.http.get<{
      totalTransactions: number;
      totalMoney: number;
      gameLength: string;
      playersStats: Array<{
        playerId: number;
        playerName: string;
        balance: number;
        propertiesCount: number;
        totalTransactions: number;
      }>;
      propertyDistribution: {
        [colorGroup: string]: {
          totalProperties: number;
          ownedProperties: number;
          owners: string[];
        };
      };
    }>(`${this.baseUrl}/sessions/${sessionCode}/summary`);
  }

  // ============================================
  // NUOVO: APIs per quick actions
  // ============================================

  /**
   * NUOVO: Quick transfer - trasferimento veloce tra giocatori comuni
   */
  quickTransfer(fromPlayerId: number, toPlayerId: number, amount: number): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.baseUrl}/bank/quick-transfer`, {
      fromPlayerId,
      toPlayerId,
      amount,
      description: 'Trasferimento veloce'
    });
  }

  /**
   * NUOVO: Pagamento veloce alla banca con descrizioni predefinite
   */
  quickBankPayment(playerId: number, amount: number, type: 'TAX' | 'FINE' | 'CARD' | 'OTHER'): Observable<Transaction> {
    const descriptions = {
      'TAX': 'Pagamento tasse',
      'FINE': 'Multa',
      'CARD': 'Carta Imprevisti/Probabilità',
      'OTHER': 'Pagamento vario'
    };

    return this.http.post<Transaction>(`${this.baseUrl}/bank/pay-to-bank`, {
      playerId,
      amount,
      description: descriptions[type]
    });
  }

  /**
   * NUOVO: Incasso veloce dalla banca con descrizioni predefinite
   */
  quickBankIncome(playerId: number, amount: number, type: 'SALARY' | 'CARD' | 'DIVIDEND' | 'OTHER'): Observable<Transaction> {
    const descriptions = {
      'SALARY': 'Stipendio (Casella VIA)',
      'CARD': 'Carta Imprevisti/Probabilità',
      'DIVIDEND': 'Dividendi',
      'OTHER': 'Incasso vario'
    };

    return this.http.post<Transaction>(`${this.baseUrl}/bank/pay-from-bank`, {
      playerId,
      amount,
      description: descriptions[type]
    });
  }

  // ============================================
  // NUOVO: APIs per validazioni
  // ============================================

  /**
   * NUOVO: Valida se un'azione è possibile prima di eseguirla
   */
  validateAction(action: {
    type: 'TRANSFER' | 'PURCHASE' | 'BUILD' | 'SELL' | 'MORTGAGE' | 'RENT';
    playerId: number;
    targetId?: number;
    amount?: number;
  }): Observable<{
    isValid: boolean;
    canProceed: boolean;
    warnings: string[];
    errors: string[];
    estimatedCost?: number;
    resultingBalance?: number;
  }> {
    return this.http.post<{
      isValid: boolean;
      canProceed: boolean;
      warnings: string[];
      errors: string[];
      estimatedCost?: number;
      resultingBalance?: number;
    }>(`${this.baseUrl}/validation/action`, action);
  }

  // ============================================
  // NUOVO: APIs per report e export
  // ============================================

  /**
   * NUOVO: Esporta dati di gioco in formato CSV
   */
  exportGameData(sessionCode: string, format: 'CSV' | 'JSON' = 'CSV'): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/export/${sessionCode}?format=${format}`, {
      responseType: 'blob'
    });
  }

  /**
   * NUOVO: Genera report PDF della partita
   */
  generateGameReport(sessionCode: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/export/${sessionCode}/report`, {
      responseType: 'blob'
    });
  }

  transferMultipleProperties(
    ownershipIds: number[],
    newOwnerId: number,
    compensationAmount?: number,
    description?: string
  ): Observable<PropertyOwnership[]> {
    return this.http.post<PropertyOwnership[]>(`${this.baseUrl}/properties/transfer-multiple`, {
      ownershipIds,
      newOwnerId,
      compensationAmount: compensationAmount || 0,
      description: description || 'Scambio negoziato proprietà'
    });
  }

  /**
 * NUOVO: Verifica possibilità trasferimento
 */
  canTransferProperty(ownershipId: number): Observable<{
    canTransfer: boolean;
    hasBuildings: boolean;
    isMortgaged: boolean;
    reasons: string[];
  }> {
    return this.http.get<{
      canTransfer: boolean;
      hasBuildings: boolean;
      isMortgaged: boolean;
      reasons: string[];
    }>(`${this.baseUrl}/properties/ownership/${ownershipId}/transfer-info`);
  }
}