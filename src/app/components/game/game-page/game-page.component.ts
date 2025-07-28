import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Transaction } from '../../../models/transaction.model';
import { Player } from '../../../models/player.model';
import { WebSocketService } from '../../../services/websocket.service';
import { GameService } from '../../../services/game.service';
import { ApiService } from '../../../services/api.service';
import { GameSession } from '../../../models/game-session.model';
import { PropertiesModalComponent } from '../../properties/properties-modal/properties-modal.component';

@Component({
  selector: 'app-game',
  templateUrl: './game-page.component.html',
  styleUrls: ['./game-page.component.scss']
})
export class GamePageComponent implements OnInit, OnDestroy {
  sessionCode!: string;
  currentSession: GameSession | null = null;
  currentPlayer: Player | null = null;
  recentTransactions: Transaction[] = [];
  selectedPlayer: Player | null = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private alertController: AlertController,
    private modalController: ModalController,
    private apiService: ApiService,
    public gameService: GameService,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit() {
    this.sessionCode = this.route.snapshot.paramMap.get('sessionCode')!;
    this.loadGameData();
    this.setupWebSocket();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async loadGameData() {
    try {
      // Load session
      const session = await this.apiService.getSession(this.sessionCode).toPromise();
      if (session) {
        this.currentSession = session;
        this.gameService.setCurrentSession(session);
      }

      // Load transactions
      await this.refreshTransactions();

      // Subscribe to current player
      this.subscriptions.push(
        this.gameService.getCurrentPlayer().subscribe((player: any) => {
          this.currentPlayer = player;
        })
      );
    } catch (error) {
      console.error('Error loading game data:', error);
    }
  }

  setupWebSocket() {
    this.webSocketService.connect(this.sessionCode);
    
    this.subscriptions.push(
      this.webSocketService.getMessages().subscribe((message: any) => {
        if (message) {
          this.handleWebSocketMessage(message);
        }
      })
    );
  }

  handleWebSocketMessage(message: any) {
    switch (message.type) {
      case 'BALANCE_UPDATE':
        this.loadGameData(); // Refresh all data
        break;
      case 'PROPERTY_PURCHASED':
        this.refreshTransactions();
        break;
      case 'GAME_ENDED':
        // Handle game end
        break;
    }
  }

  async refreshTransactions() {
    try {
      this.recentTransactions = await this.apiService.getTransactions(this.sessionCode).toPromise() || [];
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }

  selectPlayer(player: Player) {
    this.selectedPlayer = player;
  }

  async showTransferModal() {
    if (!this.currentSession) return;

    const alert = await this.alertController.create({
      header: 'Trasferimento Denaro',
      inputs: [
        {
          name: 'fromPlayer',
          type: 'text',
          placeholder: 'Da giocatore (nome)',
        },
        {
          name: 'toPlayer', 
          type: 'text',
          placeholder: 'A giocatore (nome)',
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
          text: 'Trasferisci',
          handler: (data) => {
            if (data.fromPlayer && data.toPlayer && data.amount) {
              this.performTransfer(data.fromPlayer, data.toPlayer, data.amount, data.description);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async performTransfer(fromPlayerName: string, toPlayerName: string, amount: number, description: string) {
    if (!this.currentSession) return;

    const fromPlayer = this.currentSession.players.find(p => p.name.toLowerCase() === fromPlayerName.toLowerCase());
    const toPlayer = this.currentSession.players.find(p => p.name.toLowerCase() === toPlayerName.toLowerCase());

    if (!fromPlayer || !toPlayer) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Giocatori non trovati',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    try {
      await this.apiService.transferMoney(fromPlayer.id, toPlayer.id, amount, description).toPromise();
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

  async showBankPaymentModal(type: 'FROM_BANK' | 'TO_BANK') {
    if (!this.currentSession) return;

    const isFromBank = type === 'FROM_BANK';
    const alert = await this.alertController.create({
      header: isFromBank ? 'Ricevi dalla Banca' : 'Paga alla Banca',
      inputs: [
        {
          name: 'player',
          type: 'text',
          placeholder: 'Nome giocatore',
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
            if (data.player && data.amount) {
              this.performBankPayment(data.player, data.amount, data.description, isFromBank);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async performBankPayment(playerName: string, amount: number, description: string, isFromBank: boolean) {
    if (!this.currentSession) return;

    const player = this.currentSession.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
    if (!player) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Giocatore non trovato',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    try {
      if (isFromBank) {
        await this.apiService.payFromBank(player.id, amount, description).toPromise();
      } else {
        await this.apiService.payToBank(player.id, amount, description).toPromise();
      }
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
    const modal = await this.modalController.create({
      component: PropertiesModalComponent,
      cssClass: 'properties-modal'
    });
    
    await modal.present();
    
    const { data } = await modal.onDidDismiss();
    if (data?.refresh) {
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
    if (!this.currentSession) return;

    let overviewText = '';
    for (const player of this.currentSession.players) {
      try {
        const properties = await this.apiService.getPlayerProperties(player.id).toPromise() || [];
        overviewText += `\n${player.name} (${properties.length} proprietà):\n`;
        
        if (properties.length === 0) {
          overviewText += '  - Nessuna proprietà\n';
        } else {
          properties.forEach(prop => {
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
    if (!this.currentSession) return;

    try {
      const allTransactions = await this.apiService.getTransactions(this.sessionCode).toPromise() || [];
      
      let stats = 'STATISTICHE PARTITA\n\n';
      
      // Player statistics
      this.currentSession.players.forEach(player => {
        const playerTransactions = allTransactions.filter(t => 
          t.fromPlayerName === player.name || t.toPlayerName === player.name
        );
        
        const received = allTransactions
          .filter(t => t.toPlayerName === player.name)
          .reduce((sum, t) => sum + t.amount, 0);
          
        const paid = allTransactions
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
      const totalTransactions = allTransactions.length;
      const totalMoney = allTransactions.reduce((sum, t) => sum + t.amount, 0);
      
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

  async showMenu() {
    const actionSheet = await this.alertController.create({
      header: 'Menu',
      buttons: [
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
          icon: 'analytics',
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
                const properties = await this.apiService.getAllProperties().toPromise() || [];
                const property = properties.find(p => 
                  p.name.toLowerCase().includes(data.propertyName.toLowerCase())
                );
                
                if (property) {
                  const rent = await this.apiService.calculateRent(property.id, data.diceRoll || 7).toPromise();
                  const rentAlert = await this.alertController.create({
                    header: 'Affitto Calcolato',
                    message: `${property.name}\nAffitto: ${this.gameService.formatCurrency(rent)}`,
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
}