import { Player } from "@/models/player.model";
import { PropertyOwnership } from "@/models/property.model";
import { ApiService } from "@/services/api.service";
import { GameService } from "@/services/game.service";
import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AlertController, IonicModule, LoadingController, ModalController } from "@ionic/angular";
import { firstValueFrom } from "rxjs";

export interface TradeOffer {
  properties: PropertyOwnership[];
  compensationType: 'none' | 'receive' | 'pay';
  compensationAmount: number;
  description: string;
}

@Component({
  selector: 'app-trade-modal',
  templateUrl: './trade-modal.component.html',
  styleUrls: ['./trade-modal.component.scss']
})
export class TradeModalComponent implements OnInit {
  @Input() currentPlayer!: Player;
  @Input() availableProperties: PropertyOwnership[] = [];
  @Input() otherPlayers: Player[] = [];

  // Stato del modal
  selectedRecipient: Player | null = null;
  selectedProperties: PropertyOwnership[] = [];
  compensationType: 'none' | 'receive' | 'pay' = 'none';
  compensationAmount: number = 0;
  description: string = 'Scambio negoziato';

  // UI State
  isLoading: boolean = false;
  searchTerm: string = '';

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private gameService: GameService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    console.log('=== TRADE MODAL INIT ===');
    console.log('Current Player:', this.currentPlayer);
    console.log('Available Properties:', this.availableProperties.length);
    console.log('Other Players:', this.otherPlayers.length);
  }

  // Getter per proprietà filtrate
  get filteredProperties(): PropertyOwnership[] {
    if (!this.searchTerm.trim()) {
      return this.availableProperties;
    }
    
    const term = this.searchTerm.toLowerCase();
    return this.availableProperties.filter(property => 
      property.propertyName.toLowerCase().includes(term)
    );
  }

  // Calcolo del valore totale delle proprietà selezionate
  get totalPropertiesValue(): number {
    return this.selectedProperties.reduce((total, prop) => total + prop.propertyPrice, 0);
  }

  // Calcolo del bilancio finale dello scambio
  get finalCompensation(): number {
    switch (this.compensationType) {
      case 'receive':
        return this.compensationAmount;
      case 'pay':
        return -this.compensationAmount;
      default:
        return 0;
    }
  }

  // Verifica se lo scambio è valido
  get isTradeValid(): boolean {

    const hasRecipient = !!this.selectedRecipient;
    const hasProperties = this.selectedProperties.length > 0;
    const hasValidCompensation = this.compensationAmount >= 0;

    

    // Verifica fondi se deve pagare
    let hasSufficientFunds = true;
    if (this.compensationType === 'pay' && this.compensationAmount > 0) {
      hasSufficientFunds = this.currentPlayer.balance >= this.compensationAmount;
    }
    if (this.compensationType === 'receive' && this.compensationAmount > 0) {
      hasSufficientFunds = this.selectedRecipient ? 
        this.selectedRecipient.balance >= this.compensationAmount : false;
    }

    console.log('Trade Validity Check:', 
      hasRecipient, 
      hasProperties, 
      hasValidCompensation,
      hasSufficientFunds
    );

    return hasRecipient && hasProperties && hasValidCompensation && hasSufficientFunds;
  }

  // Selezione/Deselezione destinatario
  selectRecipient(player: Player) {
    this.selectedRecipient = this.selectedRecipient?.id === player.id ? null : player;
  }

  // Selezione/Deselezione proprietà
  toggleProperty(property: PropertyOwnership) {
    const index = this.selectedProperties.findIndex(p => p.id === property.id);
    
    if (index >= 0) {
      // Rimuovi dalla selezione
      this.selectedProperties.splice(index, 1);
    } else {
      // Aggiungi alla selezione
      this.selectedProperties.push(property);
    }
  }

  // Verifica se una proprietà è selezionata
  isPropertySelected(property: PropertyOwnership): boolean {
    return this.selectedProperties.some(p => p.id === property.id);
  }

  // Reset delle selezioni
  resetSelections() {
    this.selectedRecipient = null;
    this.selectedProperties = [];
    this.compensationType = 'none';
    this.compensationAmount = 0;
    this.description = 'Scambio negoziato';
    this.searchTerm = '';
  }

  // Chiudi modal
  async dismiss() {
    await this.modalController.dismiss();
  }

  // Conferma ed esegui lo scambio
  async confirmTrade() {
    if (!this.isTradeValid) {
      await this.showError('Dati dello scambio non validi');
      return;
    }

    const confirmed = await this.showConfirmationDialog();
    if (!confirmed) return;

    await this.executeTrade();
  }

  // Dialog di conferma
  private async showConfirmationDialog(): Promise<boolean> {
    const recipient = this.selectedRecipient!;
    const propertiesCount = this.selectedProperties.length;
    const totalValue = this.totalPropertiesValue;
    const compensation = this.finalCompensation;

    let message = `\n🏠 **Proprietà da trasferire:** ${propertiesCount}\n`;
    message += `💎 **Valore totale:** ${this.gameService.formatCurrency(totalValue)}\n`;
    message += `👤 **Destinatario:** ${recipient.name}\n\n`;

    // Lista proprietà
    message += `\n**Proprietà incluse:**\n`;
    this.selectedProperties.forEach(prop => {
      const status = prop.mortgaged ? ' [IPOTECATA]' : '';
      message += `• ${prop.propertyName}${status} (${this.gameService.formatCurrency(prop.propertyPrice)})\n`;
    });

    // Compenso
    message += `\n💰 **Compenso monetario:**\n`;
    if (compensation > 0) {
      message += `\nTu riceverai: ${this.gameService.formatCurrency(compensation)}\n`;
    } else if (compensation < 0) {
      message += `\nTu pagherai: ${this.gameService.formatCurrency(Math.abs(compensation))}\n`;
    } else {
      message += `\nNessun compenso monetario\n`;
    }

    // Descrizione
    if (this.description.trim()) {
      message += `\n\n📝 **Note:** ${this.description}`;
    }

    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: '🤝 Conferma Scambio',
        message,
        buttons: [
          {
            text: 'Annulla',
            role: 'cancel',
            handler: () => resolve(false)
          },
          {
            text: 'Conferma Scambio',
            cssClass: 'alert-button-confirm',
            handler: () => resolve(true)
          }
        ]
      });
      await alert.present();
    });
  }

  // Esecuzione dello scambio
  private async executeTrade() {
    if (!this.selectedRecipient || this.selectedProperties.length === 0) return;

    const loading = await this.loadingController.create({
      message: 'Esecuzione scambio...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      console.log('=== EXECUTING TRADE ===');
      console.log('Properties:', this.selectedProperties.map(p => p.propertyName));
      console.log('Recipient:', this.selectedRecipient.name);
      console.log('Compensation:', this.finalCompensation);
      console.log('Description:', this.description);

      const ownershipIds = this.selectedProperties.map(p => p.id);

      // Chiamata API per il trasferimento multiplo
      const result = await firstValueFrom(
        this.apiService.transferMultipleProperties(
          ownershipIds,
          this.selectedRecipient.id,
          this.finalCompensation,
          this.description
        )
      );

      console.log('✅ Trade completed successfully:', result);

      await loading.dismiss();

      // Mostra successo
      await this.showSuccess(this.selectedRecipient.name, this.selectedProperties.length);

      // Chiudi modal con successo
      await this.modalController.dismiss({
        success: true,
        propertiesTransferred: this.selectedProperties.length,
        recipient: this.selectedRecipient.name
      });

    } catch (error) {
      console.error('❌ Trade execution error:', error);
      
      await loading.dismiss();
      
      let errorMessage = 'Errore durante lo scambio.';
      if (error && typeof error === 'object') {
        const errorObj = error as any;
        if (errorObj.status === 400) {
          errorMessage = errorObj.error?.message || 'Dati non validi o fondi insufficienti.';
        } else if (errorObj.status === 404) {
          errorMessage = 'Proprietà o giocatore non trovato.';
        } else if (errorObj.status === 500) {
          errorMessage = 'Errore del server. Riprova più tardi.';
        }
      }

      await this.showError(errorMessage);
    }
  }

  // Mostra messaggio di successo
  private async showSuccess(recipientName: string, propertiesCount: number) {
    const alert = await this.alertController.create({
      header: '✅ Scambio Completato',
      message: `${propertiesCount} proprietà trasferite con successo a ${recipientName}!`,
      buttons: ['Ottimo!']
    });
    await alert.present();
  }

  // Mostra messaggio di errore
  private async showError(message: string) {
    const alert = await this.alertController.create({
      header: '❌ Errore',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}