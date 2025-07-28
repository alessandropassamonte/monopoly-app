import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, ModalController, ActionSheetController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { Transaction } from '../../../models/transaction.model';
import { Player } from '../../../models/player.model';
import { WebSocketService } from '../../../services/websocket.service';
import { GameService } from '../../../services/game.service';
import { ApiService } from '../../../services/api.service';
import { GameSession } from '../../../models/game-session.model';
import { PropertiesModalComponent } from '../../properties/properties-modal/properties-modal.component';
import { WealthManagementModalComponent } from './wealth-management-modal/wealth-management-modal.component';

@Component({
  selector: 'app-game',
  templateUrl: './game-page.component.html',
  styleUrls: ['./game-page.component.scss']
})
export class GamePageComponent implements OnInit, OnDestroy {
  sessionCode: string = '';
  currentSession: GameSession | null = null;
  currentPlayer: Player | null = null;
  recentTransactions: Transaction[] = [];
  selectedPlayer: Player | null = null;
  private subscriptions: Subscription[] = [];
  loadingController: any;

  constructor(
    private route: ActivatedRoute,
    private alertController: AlertController,
    private modalController: ModalController,
    private actionSheetController: ActionSheetController,
    private apiService: ApiService,
    public gameService: GameService,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit() {
    this.sessionCode = this.route.snapshot.paramMap.get('sessionCode') || '';
    console.log('=== GAME PAGE INIT ===');
    console.log('Session code:', this.sessionCode);
    
    if (this.sessionCode) {
      this.initializeGamePage();
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async initializeGamePage() {
    console.log('=== INITIALIZING GAME PAGE ===');
    
    // Subscribe to game service observables
    this.subscribeToGameService();
    
    // Load initial data
    await this.loadGameData();
    
    // Setup WebSocket
    this.setupWebSocket();
  }

  subscribeToGameService() {
    // Subscribe to current session changes
    this.subscriptions.push(
      this.gameService.getCurrentSession().subscribe((session: GameSession | null) => {
        console.log('=== SESSION UPDATED IN GAME ===');
        console.log('New session:', session);
        console.log('Session players:', session?.players);
        this.currentSession = session;
      })
    );

    // Subscribe to current player changes
    this.subscriptions.push(
      this.gameService.getCurrentPlayer().subscribe((player: Player | null) => {
        console.log('=== PLAYER UPDATED IN GAME ===');
        console.log('New current player:', player);
        this.currentPlayer = player;
      })
    );
  }

  async loadGameData() {
    try {
      console.log('=== LOADING GAME DATA ===');
      
      // Load session data
      const session = await firstValueFrom(this.apiService.getSession(this.sessionCode));
      if (session) {
        console.log('Session loaded from API:', session);
        console.log('Session players:', session.players);
        this.gameService.setCurrentSession(session);
      } else {
        console.error('No session found');
        return;
      }

      // Load transactions
      await this.refreshTransactions();

    } catch (error) {
      console.error('Error loading game data:', error);
    }
  }

  setupWebSocket() {
    if (!this.sessionCode) return;
    
    console.log('=== SETTING UP WEBSOCKET FOR GAME ===');
    this.webSocketService.connect(this.sessionCode);
    
    this.subscriptions.push(
      this.webSocketService.getMessages().subscribe((message) => {
        if (message) {
          console.log('=== WEBSOCKET MESSAGE IN GAME ===', message);
          this.handleWebSocketMessage(message);
        }
      })
    );
  }

  handleWebSocketMessage(message: any) {
    switch (message.type) {
      case 'BALANCE_UPDATE':
        console.log('Balance updated, reloading data');
        this.loadGameData();
        break;
      case 'PROPERTY_PURCHASED':
        console.log('Property purchased, refreshing transactions');
        this.refreshTransactions();
        break;
      case 'GAME_ENDED':
        // Handle game end
        break;
    }
  }

  async refreshTransactions() {
    try {
      console.log('=== REFRESHING TRANSACTIONS ===');
      const transactions = await firstValueFrom(this.apiService.getTransactions(this.sessionCode));
      this.recentTransactions = transactions || [];
      console.log('Transactions loaded:', this.recentTransactions.length);
    } catch (error) {
      console.error('Error loading transactions:', error);
      this.recentTransactions = [];
    }
  }

  selectPlayer(player: Player) {
    console.log('Player selected:', player);
    this.selectedPlayer = player;
  }

  async showTransferModal() {
    if (!this.currentSession?.players?.length) {
      console.error('No players available');
      return;
    }

    console.log('=== SHOWING TRANSFER MODAL ===');
    console.log('Available players:', this.currentSession.players);

    const alert = await this.alertController.create({
      header: 'Trasferimento Denaro',
      inputs: [
        {
          name: 'fromPlayer',
          type: 'text',
          placeholder: 'Seleziona giocatore mittente',
          value: this.currentPlayer?.name || ''
        },
        {
          name: 'toPlayer', 
          type: 'text',
          placeholder: 'Seleziona giocatore destinatario'
        },
        {
          name: 'amount',
          type: 'number',
          placeholder: 'Importo',
          min: 1
        },
        {
          name: 'description',
          type: 'text',
          placeholder: 'Descrizione',
          value: 'Trasferimento'
        }
      ],
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Mostra Selezione',
          handler: () => {
            this.showTransferWithSelects();
          }
        }
      ]
    });
    await alert.present();
  }

  async selectFromPlayerForTransfer(fromPlayer: Player) {
    // Create action sheet for TO player selection (exclude fromPlayer)
    const availablePlayers = this.currentSession!.players.filter(p => p.id !== fromPlayer.id);
    
    const toPlayerSheet = await this.actionSheetController.create({
      header: `${fromPlayer.name} trasferisce denaro a:`,
      buttons: [
        ...availablePlayers.map(player => ({
          text: `${player.name}`,
          handler: () => {
            this.showTransferAmountModal(fromPlayer, player);
          }
        })),
        {
          text: 'Annulla',
          role: 'cancel'
        }
      ]
    });
    await toPlayerSheet.present();
  }

  async showTransferAmountModal(fromPlayer: Player, toPlayer: Player) {
    const alert = await this.alertController.create({
      header: 'Importo Trasferimento',
      message: `${fromPlayer.name} → ${toPlayer.name}`,
      inputs: [
        {
          name: 'amount',
          type: 'number',
          placeholder: 'Importo da trasferire',
          min: 1,
          max: fromPlayer.balance
        },
        {
          name: 'description',
          type: 'text',
          placeholder: 'Descrizione (opzionale)',
          value: 'Trasferimento'
        }
      ],
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Trasferisci',
          handler: (data) => {
            if (data.amount && data.amount > 0) {
              this.performTransfer(fromPlayer.id, toPlayer.id, data.amount, data.description || 'Trasferimento');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async performTransfer(fromPlayerId: number, toPlayerId: number, amount: number, description: string) {
    try {
      console.log('=== PERFORMING TRANSFER ===');
      console.log('From:', fromPlayerId, 'To:', toPlayerId, 'Amount:', amount);
      
      await firstValueFrom(this.apiService.transferMoney(fromPlayerId, toPlayerId, amount, description));
      console.log('Transfer completed successfully');
    } catch (error) {
      console.error('Transfer error:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Errore nel trasferimento. Verifica i fondi disponibili.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }


  async showBankAmountModal(player: Player, isFromBank: boolean) {
    const alert = await this.alertController.create({
      header: isFromBank ? 'Pagamento dalla Banca' : 'Pagamento alla Banca',
      message: `Giocatore: ${player.name}`,
      inputs: [
        {
          name: 'amount',
          type: 'number',
          placeholder: 'Importo',
          min: 1,
          max: isFromBank ? undefined : player.balance
        },
        {
          name: 'description',
          type: 'text',
          placeholder: 'Descrizione',
          value: isFromBank ? 'Pagamento dalla Banca' : 'Pagamento alla Banca'
        }
      ],
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Conferma',
          handler: (data) => {
            if (data.amount && data.amount > 0) {
              this.performBankPayment(player.id, data.amount, data.description, isFromBank);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async performBankPayment(playerId: number, amount: number, description: string, isFromBank: boolean) {
    try {
      console.log('=== PERFORMING BANK PAYMENT ===');
      console.log('Player:', playerId, 'Amount:', amount, 'From bank:', isFromBank);
      
      if (isFromBank) {
        await firstValueFrom(this.apiService.payFromBank(playerId, amount, description));
      } else {
        await firstValueFrom(this.apiService.payToBank(playerId, amount, description));
      }
      console.log('Bank payment completed successfully');
    } catch (error) {
      console.error('Bank payment error:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Errore nel pagamento. Verifica i fondi disponibili.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async showPropertiesModal() {
    console.log('=== OPENING PROPERTIES MODAL ===');
    const modal = await this.modalController.create({
      component: PropertiesModalComponent,
      cssClass: 'properties-modal'
    });
    
    await modal.present();
    
    const { data } = await modal.onDidDismiss();
    if (data?.refresh) {
      console.log('Refreshing game data after properties modal');
      this.loadGameData();
    }
  }

  async showFullTransactionsList() {
    const alert = await this.alertController.create({
      header: 'Tutte le Transazioni',
      message: this.buildTransactionsText(),
      cssClass: 'transactions-alert',
      buttons: [
        {
          text: 'Esporta',
          handler: () => {
            this.exportTransactions();
          }
        },
        {
          text: 'Chiudi',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
  }

  async showPropertiesOverview() {
    if (!this.currentSession?.players) return;

    let overviewText = '';
    for (const player of this.currentSession.players) {
      try {
        const properties = await firstValueFrom(this.apiService.getPlayerProperties(player.id));
        const propertiesList = properties || [];
        overviewText += `\n${player.name} (${propertiesList.length} proprietà):\n`;
        
        if (propertiesList.length === 0) {
          overviewText += '  - Nessuna proprietà\n';
        } else {
          propertiesList.forEach(prop => {
            let status = '';
            if (prop.isMortgaged) status += ' [IPOTECATA]';
            if (prop.hasHotel) status += ' [HOTEL]';
            else if (prop.houses > 0) status += ` [${prop.houses} CASE]`;
            
            overviewText += `  - ${prop.propertyName}${status}\n`;
          });
        }
      } catch (error) {
        console.error(`Error loading properties for ${player.name}:`, error);
        overviewText += `  - Errore nel caricamento\n`;
      }
    }

    const alert = await this.alertController.create({
      header: 'Riepilogo Proprietà',
      message: overviewText,
      cssClass: 'properties-overview-alert',
      buttons: ['OK']
    });
    await alert.present();
  }

  async showGameStatistics() {
    if (!this.currentSession?.players) return;

    try {
      const allTransactions = await firstValueFrom(this.apiService.getTransactions(this.sessionCode));
      const transactionsList = allTransactions || [];
      
      let stats = 'STATISTICHE PARTITA\n\n';
      
      // Player statistics
      this.currentSession.players.forEach(player => {
        const playerTransactions = transactionsList.filter(t => 
          t.fromPlayerName === player.name || t.toPlayerName === player.name
        );
        
        const received = transactionsList
          .filter(t => t.toPlayerName === player.name)
          .reduce((sum, t) => sum + t.amount, 0);
          
        const paid = transactionsList
          .filter(t => t.fromPlayerName === player.name)
          .reduce((sum, t) => sum + t.amount, 0);

        stats += `${player.name}:\n`;
        stats += `  Saldo: ${this.gameService.formatCurrency(player.balance)}\n`;
        stats += `  Proprietà: ${player.propertiesCount}\n`;
        stats += `  Ricevuto: ${this.gameService.formatCurrency(received)}\n`;
        stats += `  Pagato: ${this.gameService.formatCurrency(paid)}\n`;
        stats += `  Transazioni: ${playerTransactions.length}\n\n`;
      });

      // Game statistics
      const totalTransactions = transactionsList.length;
      const totalMoney = transactionsList.reduce((sum, t) => sum + t.amount, 0);
      
      stats += `TOTALI:\n`;
      stats += `Transazioni: ${totalTransactions}\n`;
      stats += `Volume scambi: ${this.gameService.formatCurrency(totalMoney)}\n`;

      const alert = await this.alertController.create({
        header: 'Statistiche Partita',
        message: stats,
        cssClass: 'stats-alert',
        buttons: ['OK']
      });
      await alert.present();
    } catch (error) {
      console.error('Error calculating statistics:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Errore nel calcolo delle statistiche',
        buttons: ['OK']
      });
      await alert.present();
    }
  }


  async showRentCalculator() {
    const alert = await this.alertController.create({
      header: 'Calcolatore Affitto',
      inputs: [
        {
          name: 'propertyName',
          type: 'text',
          placeholder: 'Nome proprietà'
        },
        {
          name: 'diceRoll',
          type: 'number',
          placeholder: 'Risultato dadi (per società)',
          value: 7,
          min: 2,
          max: 12
        }
      ],
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Calcola',
          handler: async (data) => {
            if (data.propertyName) {
              try {
                const properties = await firstValueFrom(this.apiService.getAllProperties());
                const propertiesList = properties || [];
                const property = propertiesList.find(p => 
                  p.name.toLowerCase().includes(data.propertyName.toLowerCase())
                );
                
                if (property) {
                  const rent = await firstValueFrom(this.apiService.calculateRent(property.id, data.diceRoll || 7));
                  const rentAlert = await this.alertController.create({
                    header: 'Affitto Calcolato',
                    message: `${property.name}\nAffitto: ${this.gameService.formatCurrency(rent || 0)}`,
                    buttons: ['OK']
                  });
                  await rentAlert.present();
                } else {
                  const errorAlert = await this.alertController.create({
                    header: 'Errore',
                    message: 'Proprietà non trovata',
                    buttons: ['OK']
                  });
                  await errorAlert.present();
                }
              } catch (error) {
                console.error('Error calculating rent:', error);
              }
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private buildTransactionsText(): string {
    let text = '';
    this.recentTransactions.forEach((transaction, index) => {
      text += `${index + 1}. ${transaction.description}\n`;
      text += `   ${transaction.fromPlayerName} → ${transaction.toPlayerName}\n`;
      text += `   ${this.gameService.formatCurrency(transaction.amount)}\n`;
      text += `   ${this.formatTime(transaction.timestamp)}\n\n`;
    });
    return text || 'Nessuna transazione';
  }

  private exportTransactions() {
    const csvContent = this.buildCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `monopoly-transactions-${this.sessionCode}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private buildCSVContent(): string {
    let csv = 'Timestamp,From,To,Amount,Description,Type\n';
    this.recentTransactions.forEach(t => {
      csv += `${t.timestamp},${t.fromPlayerName},${t.toPlayerName},${t.amount},"${t.description}",${t.type}\n`;
    });
    return csv;
  }

  getTransactionClass(transaction: Transaction): string {
    return `transaction-${transaction.type.toLowerCase().replace('_', '-')}`;
  }

  getAmountClass(transaction: Transaction): string {
    if (transaction.type === 'BANK_TO_PLAYER') return 'amount-positive';
    if (transaction.type === 'PLAYER_TO_BANK') return 'amount-negative';
    return 'amount-neutral';
  }

  formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Metodi di supporto per il design moderno
  getPlayerColorHex(color: string): string {
    const colorMap: { [key: string]: string } = {
      'RED': '#e53e3e',
      'BLUE': '#3182ce',
      'GREEN': '#38a169',
      'YELLOW': '#d69e2e',
      'PURPLE': '#805ad5',
      'ORANGE': '#ff8c00',
      'BLACK': '#2d3748',
      'WHITE': '#f7fafc'
    };
    return colorMap[color] || '#ccc';
  }

  darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

 getTransactionBg(transaction: Transaction): string {
    const bgMap: { [key: string]: string } = {
      'PLAYER_TO_PLAYER': '#ebf8ff',
      'PLAYER_TO_BANK': '#fed7d7',
      'BANK_TO_PLAYER': '#f0fff4',
      'PROPERTY_PURCHASE': '#f7fafc',
      'RENT_PAYMENT': '#fef5e7',
      'TAX_PAYMENT': '#fed7d7',
      'SALARY': '#f0fff4'
    };
    return bgMap[transaction.type] || '#f7fafc';
  }

getTransactionIcon(transaction: Transaction): string {
  const iconMap: { [key: string]: string } = {
    'PLAYER_TO_PLAYER': 'swap-horizontal',
    'PLAYER_TO_BANK': 'arrow-up',
    'BANK_TO_PLAYER': 'arrow-down',
    'PROPERTY_PURCHASE': 'business',
    'RENT_PAYMENT': 'home', // NUOVO
    'TAX_PAYMENT': 'receipt',
    'SALARY': 'cash',
    'BUILDING_SALE': 'construct', // NUOVO
    'PROPERTY_TRANSFER': 'git-branch', // NUOVO
    'LIQUIDATION': 'warning', // NUOVO
    'AUCTION_PURCHASE': 'hammer' // NUOVO
  };
  return iconMap[transaction.type] || 'document';
}

// NELLA FUNZIONE getTransactionColor, aggiungi i nuovi casi:
getTransactionColor(transaction: Transaction): string {
  const colorMap: { [key: string]: string } = {
    'PLAYER_TO_PLAYER': '#3182ce',
    'PLAYER_TO_BANK': '#e53e3e',
    'BANK_TO_PLAYER': '#38a169',
    'PROPERTY_PURCHASE': '#805ad5',
    'RENT_PAYMENT': '#dc2626', // NUOVO - rosso per affitti
    'TAX_PAYMENT': '#e53e3e',
    'SALARY': '#38a169',
    'BUILDING_SALE': '#f59e0b', // NUOVO - arancione per vendite
    'PROPERTY_TRANSFER': '#805ad5', // NUOVO - viola per trasferimenti
    'LIQUIDATION': '#dc2626', // NUOVO - rosso per liquidazioni
    'AUCTION_PURCHASE': '#f59e0b' // NUOVO - arancione per aste
  };
  return colorMap[transaction.type] || '#4a5568';
}

  getAmountColor(transaction: Transaction): string {
    if (transaction.type === 'BANK_TO_PLAYER' || transaction.type === 'SALARY') {
      return '#38a169'; // Verde per entrate
    }
    if (transaction.type === 'PLAYER_TO_BANK' || transaction.type === 'TAX_PAYMENT') {
      return '#e53e3e'; // Rosso per uscite
    }
    return '#2d3748'; // Grigio scuro per trasferimenti
  }

  /**
   * NUOVO: Modal per pagamento affitti
   */
  async showRentPaymentModal() {
    if (!this.currentSession?.players) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Nessun giocatore disponibile',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    // Pre-seleziona il giocatore corrente come pagatore
    const defaultPayerId = this.currentPlayer?.id;

    const alert = await this.alertController.create({
      header: 'Pagamento Affitto',
      message: 'Seleziona la proprietà e il giocatore che deve pagare',
      inputs: [
        {
          name: 'propertyName',
          type: 'text',
          placeholder: 'Nome proprietà (es. Via Roma)'
        },
        {
          name: 'diceRoll',
          type: 'number',
          placeholder: 'Risultato dadi (solo per società)',
          value: 7,
          min: 2,
          max: 12
        }
      ],
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Seleziona Giocatore',
          handler: async (data) => {
            if (data.propertyName) {
              await this.showRentPlayerSelection(data.propertyName, data.diceRoll || 7, defaultPayerId);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private async showRentPlayerSelection(propertyName: string, diceRoll: number, defaultPayerId?: number) {
    try {
      const properties = await firstValueFrom(this.apiService.getAllProperties());
      const property = properties.find(p => 
        p.name.toLowerCase().includes(propertyName.toLowerCase())
      );
      
      if (!property) {
        const alert = await this.alertController.create({
          header: 'Errore',
          message: 'Proprietà non trovata',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // Calcola l'affitto previsto
      const estimatedRent = await firstValueFrom(this.apiService.calculateRent(property.id, diceRoll));
      
      if (estimatedRent <= 0) {
        const alert = await this.alertController.create({
          header: 'Nessun Affitto',
          message: 'Questa proprietà non genera affitto (non posseduta o ipotecata)',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // Seleziona il giocatore che paga (pre-seleziona quello corrente)
      const actionSheet = await this.actionSheetController.create({
        header: `Chi paga l'affitto per "${property.name}"?`,
        subHeader: `Affitto stimato: ${this.gameService.formatCurrency(estimatedRent)}`,
        buttons: [
          ...this.currentSession!.players.map(player => ({
            text: `${player.name} (${this.gameService.formatCurrency(player.balance)})` + 
                  (player.id === defaultPayerId ? ' ⭐ TU' : ''),
            handler: () => {
              this.executeRentPayment(property.id, player.id, diceRoll, property.name);
            }
          })),
          {
            text: 'Annulla',
            role: 'cancel'
          }
        ]
      });
      await actionSheet.present();

    } catch (error) {
      console.error('Error finding property for rent:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Errore nella ricerca della proprietà',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  private async executeRentPayment(propertyId: number, tenantPlayerId: number, diceRoll: number, propertyName: string) {
    const loading = await this.loadingController.create({
      message: 'Pagamento affitto...'
    });
    await loading.present();

    try {
      const transaction = await firstValueFrom(this.apiService.payRent(propertyId, tenantPlayerId, diceRoll));
      
      console.log('Rent payment completed:', transaction);
      
      const tenant = this.currentSession?.players.find(p => p.id === tenantPlayerId);
      const alert = await this.alertController.create({
        header: 'Affitto Pagato',
        message: `${tenant?.name} ha pagato ${this.gameService.formatCurrency(transaction.amount)} per "${propertyName}"`,
        buttons: ['OK']
      });
      await alert.present();
      
    } catch (error) {
      console.error('Rent payment error:', error);
      let errorMessage = 'Errore nel pagamento dell\'affitto';
      
      if (error instanceof Error && error.message) {
        errorMessage = error.message;
      }
      
      const alert = await this.alertController.create({
        header: 'Errore Pagamento',
        message: errorMessage,
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      loading.dismiss();
    }
  }

  // AGGIORNA le funzioni esistenti per pre-selezionare il giocatore corrente:

  async showTransferWithSelects() {
    if (!this.currentSession?.players?.length) return;

    // Pre-seleziona il giocatore corrente come mittente se disponibile
    const defaultFromPlayer = this.currentPlayer;

    // Create action sheet for FROM player selection
    const fromPlayerButtons = this.currentSession.players.map(player => ({
      text: `${player.name} (${this.gameService.formatCurrency(player.balance)})` + 
            (player.id === defaultFromPlayer?.id ? ' ⭐ TU' : ''),
      handler: () => {
        this.selectFromPlayerForTransfer(player);
      }
    }));

    // Se c'è un giocatore corrente, mettilo in cima
    if (defaultFromPlayer) {
      const currentPlayerButton = fromPlayerButtons.find(btn => 
        btn.text.includes(defaultFromPlayer.name)
      );
      if (currentPlayerButton) {
        fromPlayerButtons.splice(fromPlayerButtons.indexOf(currentPlayerButton), 1);
        fromPlayerButtons.unshift(currentPlayerButton);
      }
    }

    const fromPlayerSheet = await this.actionSheetController.create({
      header: 'Chi trasferisce il denaro?',
      buttons: [
        ...fromPlayerButtons,
        {
          text: 'Annulla',
          role: 'cancel'
        }
      ]
    });
    await fromPlayerSheet.present();
  }

  async showBankPaymentModal(type: 'FROM_BANK' | 'TO_BANK') {
    if (!this.currentSession?.players?.length) return;

    const isFromBank = type === 'FROM_BANK';
    console.log('=== SHOWING BANK PAYMENT MODAL ===');
    console.log('Type:', type, 'Players available:', this.currentSession.players.length);

    // Pre-seleziona il giocatore corrente se disponibile
    const defaultPlayer = this.currentPlayer;

    // Crea i pulsanti con il giocatore corrente evidenziato
    const playerButtons = this.currentSession.players.map(player => ({
      text: `${player.name} (${this.gameService.formatCurrency(player.balance)})` + 
            (player.id === defaultPlayer?.id ? ' ⭐ TU' : ''),
      handler: () => {
        this.showBankAmountModal(player, isFromBank);
      }
    }));

    // Se c'è un giocatore corrente, mettilo in cima
    if (defaultPlayer) {
      const currentPlayerButton = playerButtons.find(btn => 
        btn.text.includes(defaultPlayer.name)
      );
      if (currentPlayerButton) {
        playerButtons.splice(playerButtons.indexOf(currentPlayerButton), 1);
        playerButtons.unshift(currentPlayerButton);
      }
    }

    // Create action sheet for player selection
    const actionSheet = await this.actionSheetController.create({
      header: isFromBank ? 'Chi riceve denaro dalla Banca?' : 'Chi paga denaro alla Banca?',
      buttons: [
        ...playerButtons,
        {
          text: 'Annulla',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  // AGGIORNA la funzione showMenu esistente:
  async showMenu() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Menu',
      buttons: [
        {
          text: 'Paga Affitto',
          icon: 'home',
          handler: () => {
            this.showRentPaymentModal();
          }
        },
        {
          text: 'Gestione Patrimonio',
          icon: 'analytics',
          handler: () => {
            this.showWealthManagementModal();
          }
        },
        {
          text: 'Visualizza Tutte le Transazioni',
          icon: 'list',
          handler: () => {
            this.showFullTransactionsList();
          }
        },
        {
          text: 'Riepilogo Proprietà',
          icon: 'business',
          handler: () => {
            this.showPropertiesOverview();
          }
        },
        {
          text: 'Statistiche Partita',
          icon: 'trending-up',
          handler: () => {
            this.showGameStatistics();
          }
        },
        {
          text: 'Calcolatore Affitto',
          icon: 'calculator',
          handler: () => {
            this.showRentCalculator();
          }
        },
        {
          text: 'Annulla',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  /**
   * NUOVO: Modal per gestione patrimonio e bancarotta
   */
  async showWealthManagementModal() {
    console.log('=== OPENING WEALTH MANAGEMENT MODAL ===');
    const modal = await this.modalController.create({
      component: WealthManagementModalComponent,
      cssClass: 'wealth-modal'
    });
    
    await modal.present();
    
    const { data } = await modal.onDidDismiss();
    if (data?.refresh) {
      console.log('Refreshing game data after wealth management modal');
      this.loadGameData();
    }
  }
}