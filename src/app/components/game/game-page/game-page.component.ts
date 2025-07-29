

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, ModalController, ActionSheetController, LoadingController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { Transaction } from '../../../models/transaction.model';
import { Player } from '../../../models/player.model';
import { PropertyOwnership } from '../../../models/property.model';
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

  constructor(
    private route: ActivatedRoute,
    private alertController: AlertController,
    private modalController: ModalController,
    private actionSheetController: ActionSheetController,
    private loadingController: LoadingController,
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
        this.currentSession = session;
        // AGGIUNTO: Sincronizza automaticamente current player quando cambia la sessione
        this.syncCurrentPlayerData();
      })
    );

    // Subscribe to current player changes
    this.subscriptions.push(
      this.gameService.getCurrentPlayer().subscribe((player: Player | null) => {
        console.log('=== PLAYER UPDATED IN GAME ===');
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
        this.syncCurrentPlayerData(); // AGGIUNTO: Sincronizza current player
        break;
      case 'PROPERTY_PURCHASED':
        console.log('Property purchased, refreshing transactions');
        this.refreshTransactions();
        this.syncCurrentPlayerData(); // AGGIUNTO: Sincronizza current player
        break;
      case 'GAME_ENDED':
        // Handle game end
        break;
    }
  }

  // NUOVO: Metodo per sincronizzare i dati del current player con la sessione aggiornata
  private syncCurrentPlayerData() {
    if (!this.currentPlayer || !this.currentSession) return;
    
    // Trova il player aggiornato nella sessione corrente
    const updatedPlayer = this.currentSession.players.find(p => p.id === this.currentPlayer!.id);
    if (updatedPlayer) {
      console.log('Syncing current player data:', updatedPlayer);
      this.gameService.setCurrentPlayer(updatedPlayer);
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

  // ============================================
  // NUOVO: Pagamento affitto migliorato - Step 1: Selezione giocatore
  // ============================================
  async showRentPaymentModal() {
    if (!this.currentPlayer) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Giocatore non identificato',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    if (!this.currentSession?.players) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Sessione non disponibile',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    // Filtra gli altri giocatori (escluso quello corrente)
    const otherPlayers = this.currentSession.players.filter(p => p.id !== this.currentPlayer!.id);

    if (otherPlayers.length === 0) {
      const alert = await this.alertController.create({
        header: 'Nessun Proprietario',
        message: 'Non ci sono altri giocatori da cui pagare affitto.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    // Step 1: Selezione del proprietario
    const actionSheet = await this.actionSheetController.create({
      header: `${this.currentPlayer.name} paga affitto a:`,
      subHeader: `Scegli il proprietario`,
      buttons: [
        ...otherPlayers.map(player => ({
          text: `${player.name} (${player.propertiesCount} proprietà)`,
          handler: () => {
            this.showPlayerPropertiesForRent(player);
          }
        })),
        {
          text: 'Annulla',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  // Step 2: Selezione della proprietà del giocatore scelto
  private async showPlayerPropertiesForRent(owner: Player) {
    const loading = await this.loadingController.create({
      message: `Caricamento proprietà di ${owner.name}...`
    });
    await loading.present();

    try {
      const properties = await firstValueFrom(this.apiService.getPlayerProperties(owner.id));
      const propertiesList = properties || [];
      
      // Filtra solo proprietà non ipotecate
      const rentableProperties = propertiesList.filter(prop => !prop.isMortgaged);

      loading.dismiss();

      if (rentableProperties.length === 0) {
        const alert = await this.alertController.create({
          header: 'Nessuna Proprietà Affittabile',
          message: `${owner.name} non ha proprietà disponibili per l'affitto (tutte ipotecate).`,
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // NUOVO: Crea modal con ricerca per selezione proprietà
      await this.showRentablePropertiesModal(owner, rentableProperties);

    } catch (error) {
      loading.dismiss();
      console.error('Error loading player properties:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Errore nel caricamento delle proprietà',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  // NUOVO: Modal con ricerca per proprietà affittabili
  private async showRentablePropertiesModal(owner: Player, properties: PropertyOwnership[]) {
    const alert = await this.alertController.create({
      header: `Proprietà di ${owner.name}`,
      message: 'Seleziona la proprietà per pagare l\'affitto',
      cssClass: 'rent-properties-modal',
      inputs: [
        {
          name: 'searchTerm',
          type: 'text',
          placeholder: '🔍 Cerca proprietà...',
          attributes: {
            style: 'margin-bottom: 1rem; padding: 0.8rem; border: 2px solid #e2e8f0; border-radius: 8px;'
          }
        },
        {
          name: 'selectedProperty',
          type: 'radio',
          label: 'Seleziona Proprietà',
          value: '',
          checked: false
        },
        ...properties.map(prop => {
          const rentInfo = this.calculateDisplayRent(prop);
          return {
            name: 'selectedProperty',
            type: 'radio' as const,
            label: `${prop.propertyName} - ${this.gameService.formatCurrency(rentInfo.rent)} ${rentInfo.description}`,
            value: `${prop.propertyId}`,
            checked: false
          };
        }),
        {
          name: 'diceRoll',
          type: 'number',
          placeholder: 'Risultato dadi (per società)',
          value: 7,
          min: 2,
          max: 12,
          attributes: {
            style: 'margin-top: 1rem; padding: 0.8rem; border: 2px solid #e2e8f0; border-radius: 8px;'
          }
        }
      ],
      buttons: [
        {
          text: 'Indietro',
          handler: () => {
            this.showRentPaymentModal(); // Torna alla selezione giocatore
          }
        },
        {
          text: 'Paga Affitto',
          handler: async (data) => {
            if (data.selectedProperty) {
              const selectedProp = properties.find(p => p.propertyId == data.selectedProperty);
              if (selectedProp) {
                await this.executeRentPayment(selectedProp, data.diceRoll || 7);
              }
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // Utility per calcolare affitto da mostrare
  private calculateDisplayRent(property: PropertyOwnership): {rent: number, description: string} {
    if (property.propertyType === 'UTILITY') {
      return {
        rent: 7 * 4, // Esempio con dadi 7
        description: '(con dadi 7)'
      };
    }
    
    let description = '';
    if (property.hasHotel) {
      description = '(Hotel)';
    } else if (property.houses > 0) {
      description = `(${property.houses} case)`;
    } else {
      description = '(base)';
    }
    
    return {
      rent: property.currentRent,
      description
    };
  }

  private async executeRentPayment(property: PropertyOwnership, diceRoll: number) {
    const loading = await this.loadingController.create({
      message: 'Pagamento affitto...'
    });
    await loading.present();

    try {
      const transaction = await firstValueFrom(
        this.apiService.payRent(property.propertyId, this.currentPlayer!.id, diceRoll)
      );
      
      const alert = await this.alertController.create({
        header: 'Affitto Pagato',
        message: `Hai pagato ${this.gameService.formatCurrency(transaction.amount)} per "${property.propertyName}"`,
        buttons: ['OK']
      });
      await alert.present();
      
    } catch (error) {
      console.error('Rent payment error:', error);
      const alert = await this.alertController.create({
        header: 'Errore Pagamento',
        message: 'Errore nel pagamento dell\'affitto. Verifica i fondi disponibili.',
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      loading.dismiss();
    }
  }

  // ============================================
  // Trasferimento denaro semplificato
  // ============================================
  async showTransferModal() {
    if (!this.currentPlayer) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Giocatore non identificato',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    if (!this.currentSession?.players?.length) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Nessun giocatore disponibile',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    console.log('=== SHOWING SIMPLIFIED TRANSFER MODAL ===');
    console.log('Current player (sender):', this.currentPlayer);

    // Filteriamo gli altri giocatori (escluso quello corrente)
    const availableRecipients = this.currentSession.players.filter(p => p.id !== this.currentPlayer!.id);

    if (availableRecipients.length === 0) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Non ci sono altri giocatori a cui trasferire denaro',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    // Mostra selezione destinatario
    const actionSheet = await this.actionSheetController.create({
      header: `${this.currentPlayer.name} trasferisce denaro a:`,
      subHeader: `Saldo disponibile: ${this.gameService.formatCurrency(this.currentPlayer.balance)}`,
      buttons: [
        ...availableRecipients.map(player => ({
          text: `${player.name} (${this.gameService.formatCurrency(player.balance)})`,
          handler: () => {
            this.showTransferAmountModal(player);
          }
        })),
        {
          text: 'Annulla',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async showTransferAmountModal(toPlayer: Player) {
    if (!this.currentPlayer) return;

    const alert = await this.alertController.create({
      header: 'Trasferimento Denaro',
      message: `Da: ${this.currentPlayer.name}\nA: ${toPlayer.name}`,
      inputs: [
        {
          name: 'amount',
          type: 'number',
          placeholder: 'Importo da trasferire',
          min: 1,
          max: this.currentPlayer.balance
        },
        {
          name: 'description',
          type: 'text',
          placeholder: 'Descrizione (opzionale)',
          value: `Trasferimento a ${toPlayer.name}`
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
              this.performTransfer(this.currentPlayer!.id, toPlayer.id, data.amount, data.description || 'Trasferimento');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async performTransfer(fromPlayerId: number, toPlayerId: number, amount: number, description: string) {
    const loading = await this.loadingController.create({
      message: 'Trasferimento in corso...'
    });
    await loading.present();

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
    } finally {
      loading.dismiss();
    }
  }

  // ============================================
  // Pagamenti banca semplificati
  // ============================================
  async showBankPaymentFromBankModal() {
    if (!this.currentPlayer) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Giocatore non identificato',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Ricevi dalla Banca',
      message: `Giocatore: ${this.currentPlayer.name}`,
      inputs: [
        {
          name: 'amount',
          type: 'number',
          placeholder: 'Importo da ricevere',
          min: 1
        },
        {
          name: 'description',
          type: 'text',
          placeholder: 'Descrizione',
          value: 'Pagamento dalla Banca'
        }
      ],
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Ricevi',
          handler: (data) => {
            if (data.amount && data.amount > 0) {
              this.performBankPayment(this.currentPlayer!.id, data.amount, data.description, true);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async showBankPaymentToBankModal() {
    if (!this.currentPlayer) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Giocatore non identificato',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Paga alla Banca',
      message: `Giocatore: ${this.currentPlayer.name}\nSaldo: ${this.gameService.formatCurrency(this.currentPlayer.balance)}`,
      inputs: [
        {
          name: 'amount',
          type: 'number',
          placeholder: 'Importo da pagare',
          min: 1,
          max: this.currentPlayer.balance
        },
        {
          name: 'description',
          type: 'text',
          placeholder: 'Descrizione',
          value: 'Pagamento alla Banca'
        }
      ],
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Paga',
          handler: (data) => {
            if (data.amount && data.amount > 0) {
              this.performBankPayment(this.currentPlayer!.id, data.amount, data.description, false);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async performBankPayment(playerId: number, amount: number, description: string, isFromBank: boolean) {
    const loading = await this.loadingController.create({
      message: isFromBank ? 'Ricevendo dalla Banca...' : 'Pagando alla Banca...'
    });
    await loading.present();

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
    } finally {
      loading.dismiss();
    }
  }

  // ============================================
  // AGGIORNATO: Modal proprietà con player preselezionato
  // ============================================
  async showPropertiesModal() {
    console.log('=== OPENING PROPERTIES MODAL ===');
    const modal = await this.modalController.create({
      component: PropertiesModalComponent,
      cssClass: 'properties-modal',
      componentProps: {
        currentPlayerOnly: true // Passa parametro per limitare alle azioni del giocatore corrente
      }
    });
    
    await modal.present();
    
    const { data } = await modal.onDidDismiss();
    if (data?.refresh) {
      console.log('Refreshing game data after properties modal');
      this.loadGameData();
    }
  }

  // ============================================
  // NUOVO: Modal per trasferimento multiplo proprietà
  // ============================================
  async showMultiPropertyTransferModal() {
    if (!this.currentPlayer) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Giocatore non identificato',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    try {
      const loading = await this.loadingController.create({
        message: 'Caricamento proprietà...'
      });
      await loading.present();

      const properties = await firstValueFrom(this.apiService.getPlayerProperties(this.currentPlayer.id));
      const propertiesList = properties || [];

      // Filtra proprietà senza edifici (requisito per trasferimento)
      const transferableProperties = propertiesList.filter(p => p.houses === 0 && !p.hasHotel);

      loading.dismiss();

      if (transferableProperties.length === 0) {
        const alert = await this.alertController.create({
          header: 'Nessuna Proprietà Trasferibile',
          message: 'Non hai proprietà senza edifici da trasferire.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // Mostra modal di trasferimento multiplo
      await this.showMultiTransferSelectionModal(transferableProperties);

    } catch (error) {
      console.error('Error loading properties for transfer:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Errore nel caricamento delle proprietà',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  private async showMultiTransferSelectionModal(properties: PropertyOwnership[]) {
    // Ottieni lista altri giocatori
    const otherPlayers = this.currentSession?.players.filter(p => p.id !== this.currentPlayer?.id) || [];

    if (otherPlayers.length === 0) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Non ci sono altri giocatori disponibili.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Trasferimento Multiplo Proprietà',
      message: 'Seleziona proprietà, destinatario e importo',
      cssClass: 'multi-transfer-modal',
      inputs: [
        // Selezione giocatore destinatario
        {
          name: 'recipientId',
          type: 'radio',
          label: 'Destinatario',
          value: '',
          checked: false
        },
        ...otherPlayers.map(player => ({
          name: 'recipientId',
          type: 'radio' as const,
          label: `${player.name} (${this.gameService.formatCurrency(player.balance)})`,
          value: `${player.id}`,
          checked: false
        })),
        
        // Separatore
        {
          name: 'separator1',
          type: 'text',
          value: '─────── PROPRIETÀ DA TRASFERIRE ───────',
          disabled: true,
          attributes: {
            readonly: true,
            style: 'text-align: center; font-weight: bold; background: #f0f0f0; border: none;'
          }
        },

        // Proprietà selezionabili (checkbox)
        ...properties.map(prop => ({
          name: 'selectedProperties',
          type: 'checkbox' as const,
          label: `${prop.propertyName} (${this.gameService.formatCurrency(prop.propertyPrice)})${prop.isMortgaged ? ' [IPOTECATA]' : ''}`,
          value: `${prop.id}`,
          checked: false
        })),

        // Separatore
        {
          name: 'separator2',
          type: 'text',
          value: '─────── COMPENSO MONETARIO ───────',
          disabled: true,
          attributes: {
            readonly: true,
            style: 'text-align: center; font-weight: bold; background: #f0f0f0; border: none;'
          }
        },

        // Importo da trasferire
        {
          name: 'transferAmount',
          type: 'number',
          placeholder: 'Importo da ricevere/pagare (+ ricevi, - paghi)',
          value: 0
        },
        {
          name: 'description',
          type: 'text',
          placeholder: 'Descrizione dello scambio',
          value: 'Scambio negoziato proprietà'
        }
      ],
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Trasferisci',
          handler: async (data) => {
            await this.executeMultiPropertyTransfer(data, properties);
          }
        }
      ]
    });
    await alert.present();
  }

  private async executeMultiPropertyTransfer(data: any, allProperties: PropertyOwnership[]) {
    // Validazione
    if (!data.recipientId) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Seleziona un destinatario',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    if (!data.selectedProperties || data.selectedProperties.length === 0) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Seleziona almeno una proprietà',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const selectedIds = Array.isArray(data.selectedProperties) ? data.selectedProperties : [data.selectedProperties];
    const selectedProperties = allProperties.filter(p => selectedIds.includes(p.id.toString()));
    const transferAmount = parseFloat(data.transferAmount) || 0;
    const recipientId = parseInt(data.recipientId);

    // Conferma dell'operazione
    const recipient = this.currentSession?.players.find(p => p.id === recipientId);
    const totalValue = selectedProperties.reduce((sum, p) => sum + p.propertyPrice, 0);

    let confirmMessage = `TRASFERIMENTO MULTIPLO\n\n`;
    confirmMessage += `Destinatario: ${recipient?.name}\n`;
    confirmMessage += `Proprietà (${selectedProperties.length}):\n`;
    selectedProperties.forEach(p => {
      confirmMessage += `• ${p.propertyName} (${this.gameService.formatCurrency(p.propertyPrice)})\n`;
    });
    confirmMessage += `\nValore totale proprietà: ${this.gameService.formatCurrency(totalValue)}\n`;
    
    if (transferAmount > 0) {
      confirmMessage += `Riceverai: ${this.gameService.formatCurrency(transferAmount)}\n`;
    } else if (transferAmount < 0) {
      confirmMessage += `Pagherai: ${this.gameService.formatCurrency(Math.abs(transferAmount))}\n`;
    }

    const confirmation = await this.alertController.create({
      header: 'Conferma Trasferimento',
      message: confirmMessage,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Conferma',
          handler: async () => {
            await this.performMultiPropertyTransfer(selectedProperties, recipientId, transferAmount, data.description);
          }
        }
      ]
    });
    await confirmation.present();
  }

  private async performMultiPropertyTransfer(
    properties: PropertyOwnership[], 
    recipientId: number, 
    transferAmount: number,
    description: string
  ) {
    const loading = await this.loadingController.create({
      message: 'Trasferimento in corso...'
    });
    await loading.present();

    try {
      console.log('=== PERFORMING MULTI PROPERTY TRANSFER ===');
      
      // 1. Trasferisci tutte le proprietà
      for (const property of properties) {
        await firstValueFrom(this.apiService.transferProperty(property.id, recipientId, 0));
      }

      // 2. Gestisci il compenso monetario se presente
      if (transferAmount !== 0) {
        if (transferAmount > 0) {
          // Il current player riceve denaro dal destinatario
          await firstValueFrom(this.apiService.transferMoney(
            recipientId, 
            this.currentPlayer!.id, 
            transferAmount, 
            `Compenso per ${description}`
          ));
        } else {
          // Il current player paga denaro al destinatario
          await firstValueFrom(this.apiService.transferMoney(
            this.currentPlayer!.id, 
            recipientId, 
            Math.abs(transferAmount), 
            `Pagamento per ${description}`
          ));
        }
      }

      // 3. Ricarica i dati
      await this.loadGameData();

      const alert = await this.alertController.create({
        header: 'Trasferimento Completato',
        message: `${properties.length} proprietà trasferite con successo!`,
        buttons: ['OK']
      });
      await alert.present();

    } catch (error) {
      console.error('Multi transfer error:', error);
      const alert = await this.alertController.create({
        header: 'Errore Trasferimento',
        message: 'Errore durante il trasferimento. Alcune operazioni potrebbero non essere state completate.',
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      loading.dismiss();
    }
  }

  // ============================================
  // Funzioni di utilità e altre funzionalità esistenti
  // ============================================
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

  // ============================================
  // AGGIORNATO: Menu con nuove azioni
  // ============================================
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
          text: 'Trasferimento Multiplo Proprietà',
          icon: 'git-branch',
          handler: () => {
            this.showMultiPropertyTransferModal();
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

  // ============================================
  // Utility functions
  // ============================================
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
      'RENT_PAYMENT': 'home',
      'TAX_PAYMENT': 'receipt',
      'SALARY': 'cash',
      'BUILDING_SALE': 'construct',
      'PROPERTY_TRANSFER': 'git-branch',
      'LIQUIDATION': 'warning',
      'AUCTION_PURCHASE': 'hammer'
    };
    return iconMap[transaction.type] || 'document';
  }

  getTransactionColor(transaction: Transaction): string {
    const colorMap: { [key: string]: string } = {
      'PLAYER_TO_PLAYER': '#3182ce',
      'PLAYER_TO_BANK': '#e53e3e',
      'BANK_TO_PLAYER': '#38a169',
      'PROPERTY_PURCHASE': '#805ad5',
      'RENT_PAYMENT': '#dc2626',
      'TAX_PAYMENT': '#e53e3e',
      'SALARY': '#38a169',
      'BUILDING_SALE': '#f59e0b',
      'PROPERTY_TRANSFER': '#805ad5',
      'LIQUIDATION': '#dc2626',
      'AUCTION_PURCHASE': '#f59e0b'
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
}