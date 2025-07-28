import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Property, PropertyOwnership, PropertyType } from '../../../models/property.model';
import { AlertController, ModalController } from '@ionic/angular';
import { ApiService } from '../../../services/api.service';
import { GameService } from '../../../services/game.service';
import { Player } from '../../../models/player.model';

@Component({
  selector: 'app-properties-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './properties-modal.component.html',
  styleUrls: ['./properties-modal.component.scss']
})
export class PropertiesModalComponent implements OnInit {
  selectedSegment = 'available';
  availableProperties: Property[] = [];
  allProperties: Property[] = [];
  playerProperties: PropertyOwnership[] = [];
  players: Player[] = [];
  selectedPlayerId: number | null = null;
  ownedPropertyIds: Set<number> = new Set();

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private apiService: ApiService,
    public gameService: GameService
  ) {}

  ngOnInit() {
    this.loadAllProperties();
    this.loadPlayers();
    this.loadOwnedProperties();
  }

  async loadAllProperties() {
    try {
      this.allProperties = await this.apiService.getAllProperties().toPromise() || [];
      this.updateAvailableProperties();
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  }

  async loadOwnedProperties() {
    try {
      this.ownedPropertyIds.clear();
      
      // Get all players' properties to determine which are owned
      for (const player of this.players) {
        const properties = await this.apiService.getPlayerProperties(player.id).toPromise() || [];
        properties.forEach(prop => this.ownedPropertyIds.add(prop.propertyId));
      }
      
      this.updateAvailableProperties();
    } catch (error) {
      console.error('Error loading owned properties:', error);
    }
  }

  updateAvailableProperties() {
    this.availableProperties = this.allProperties.filter(
      property => !this.ownedPropertyIds.has(property.id)
    );
  }

  loadPlayers() {
    this.gameService.getCurrentSession().subscribe((session: any) => {
      if (session) {
        this.players = session.players;
        if (this.players.length > 0 && !this.selectedPlayerId) {
          this.selectedPlayerId = this.players[0].id;
          this.loadPlayerProperties();
        }
      }
    });
  }

  async loadPlayerProperties() {
    if (!this.selectedPlayerId) return;
    
    try {
      this.playerProperties = await this.apiService.getPlayerProperties(this.selectedPlayerId).toPromise() || [];
    } catch (error) {
      console.error('Error loading player properties:', error);
    }
  }

  segmentChanged() {
    if (this.selectedSegment === 'owned' && this.players.length > 0) {
      if (!this.selectedPlayerId) {
        this.selectedPlayerId = this.players[0].id;
      }
      this.loadPlayerProperties();
    } else if (this.selectedSegment === 'available') {
      this.loadOwnedProperties();
    }
  }

  async purchaseProperty(property: Property) {
    const availablePlayers = this.players.filter(player => player.balance >= property.price);
    
    if (availablePlayers.length === 0) {
      const alert = await this.alertController.create({
        header: 'Impossibile Acquistare',
        message: 'Nessun giocatore ha fondi sufficienti per questa proprietà.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Acquista Proprietà',
      message: `Seleziona il giocatore che vuole acquistare "${property.name}" per ${this.gameService.formatCurrency(property.price)}`,
      inputs: availablePlayers.map(player => ({
        name: 'playerId',
        type: 'radio',
        label: `${player.name} (${this.gameService.formatCurrency(player.balance)})`,
        value: player.id,
        checked: false
      })),
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Acquista',
          handler: async (playerId: any) => {
            if (playerId) {
              await this.executePurchase(property, playerId);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private async executePurchase(property: Property, playerId: number) {
    try {
      await this.apiService.purchaseProperty(property.id, playerId).toPromise();
      
      // Update the owned properties and available properties
      this.ownedPropertyIds.add(property.id);
      this.updateAvailableProperties();
      
      // If viewing the purchasing player's properties, refresh them
      if (this.selectedPlayerId === playerId) {
        this.loadPlayerProperties();
      }

      // Show success message
      const player = this.players.find(p => p.id === playerId);
      const successAlert = await this.alertController.create({
        header: 'Acquisto Completato',
        message: `${player?.name} ha acquistato "${property.name}"!`,
        buttons: ['OK']
      });
      await successAlert.present();
      
    } catch (error) {
      console.error('Purchase error:', error);
      const errorAlert = await this.alertController.create({
        header: 'Errore Acquisto',
        message: 'Errore nell\'acquisto. Verifica i fondi disponibili.',
        buttons: ['OK']
      });
      await errorAlert.present();
    }
  }

  async buildHouse(ownership: PropertyOwnership) {
    const confirmation = await this.alertController.create({
      header: 'Costruisci Casa',
      message: `Vuoi costruire una casa su "${ownership.propertyName}"?`,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Costruisci',
          handler: async () => {
            await this.executeBuildHouse(ownership);
          }
        }
      ]
    });
    await confirmation.present();
  }

  private async executeBuildHouse(ownership: PropertyOwnership) {
    try {
      await this.apiService.buildHouse(ownership.id).toPromise();
      this.loadPlayerProperties();
      
      const alert = await this.alertController.create({
        header: 'Casa Costruita',
        message: `Casa costruita su "${ownership.propertyName}"!`,
        buttons: ['OK']
      });
      await alert.present();
    } catch (error) {
      console.error('Build house error:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Impossibile costruire la casa. Verifica i requisiti (monopolio del gruppo, fondi sufficienti).',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async buildHotel(ownership: PropertyOwnership) {
    const confirmation = await this.alertController.create({
      header: 'Costruisci Hotel',
      message: `Vuoi costruire un hotel su "${ownership.propertyName}"? Questo sostituirà le 4 case esistenti.`,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Costruisci',
          handler: async () => {
            await this.executeBuildHotel(ownership);
          }
        }
      ]
    });
    await confirmation.present();
  }

  private async executeBuildHotel(ownership: PropertyOwnership) {
    try {
      await this.apiService.buildHotel(ownership.id).toPromise();
      this.loadPlayerProperties();
      
      const alert = await this.alertController.create({
        header: 'Hotel Costruito',
        message: `Hotel costruito su "${ownership.propertyName}"!`,
        buttons: ['OK']
      });
      await alert.present();
    } catch (error) {
      console.error('Build hotel error:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Impossibile costruire l\'hotel. Verifica di avere 4 case e fondi sufficienti.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async mortgageProperty(ownership: PropertyOwnership) {
    const mortgageValue = ownership.propertyPrice / 2;
    
    const alert = await this.alertController.create({
      header: 'Ipoteca Proprietà',
      message: `Vuoi ipotecare "${ownership.propertyName}"? Riceverai ${this.gameService.formatCurrency(mortgageValue)}.`,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Ipoteca',
          handler: async () => {
            await this.executeMortgage(ownership);
          }
        }
      ]
    });
    await alert.present();
  }

  private async executeMortgage(ownership: PropertyOwnership) {
    try {
      await this.apiService.mortgageProperty(ownership.id).toPromise();
      this.loadPlayerProperties();
      
      const alert = await this.alertController.create({
        header: 'Proprietà Ipotecata',
        message: `"${ownership.propertyName}" è stata ipotecata!`,
        buttons: ['OK']
      });
      await alert.present();
    } catch (error) {
      console.error('Mortgage error:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Impossibile ipotecare. Rimuovi prima case/hotel.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async redeemProperty(ownership: PropertyOwnership) {
    const redeemCost = ownership.propertyPrice * 0.55;
    
    const alert = await this.alertController.create({
      header: 'Riscatta Proprietà',
      message: `Vuoi riscattare "${ownership.propertyName}"? Costo: ${this.gameService.formatCurrency(redeemCost)}.`,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Riscatta',
          handler: async () => {
            await this.executeRedeem(ownership);
          }
        }
      ]
    });
    await alert.present();
  }

  private async executeRedeem(ownership: PropertyOwnership) {
    try {
      await this.apiService.redeemProperty(ownership.id).toPromise();
      this.loadPlayerProperties();
      
      const alert = await this.alertController.create({
        header: 'Proprietà Riscattata',
        message: `"${ownership.propertyName}" è stata riscattata!`,
        buttons: ['OK']
      });
      await alert.present();
    } catch (error) {
      console.error('Redeem error:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Fondi insufficienti per il riscatto.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  getPropertyTypeLabel(type: PropertyType): string {
    const labels: { [key in PropertyType]: string } = {
      [PropertyType.STREET]: 'Strada',
      [PropertyType.RAILROAD]: 'Stazione',
      [PropertyType.UTILITY]: 'Società',
      [PropertyType.SPECIAL]: 'Speciale'
    };
    return labels[type] || type;
  }

  getHousesArray(count: number): number[] {
    return Array(count).fill(0);
  }

  async dismiss() {
    await this.modalController.dismiss({
      refresh: true
    });
  }
}