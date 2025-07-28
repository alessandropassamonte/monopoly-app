import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { Property, PropertyOwnership, PropertyType } from '../../../models/property.model';
import { AlertController, ModalController, LoadingController } from '@ionic/angular';
import { ApiService } from '../../../services/api.service';
import { GameService } from '../../../services/game.service';
import { Player } from '../../../models/player.model';
import { CommonModule } from '@angular/common';

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
  
  // Loading states
  isLoadingProperties = false;
  isLoadingPlayerProperties = false;

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private apiService: ApiService,
    public gameService: GameService
  ) {}

  async ngOnInit() {
    console.log('=== PROPERTIES MODAL INIT ===');
    await this.initializeModal();
  }

  async initializeModal() {
    const loading = await this.loadingController.create({
      message: 'Caricamento proprietà...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // Load all data in parallel
      await Promise.all([
        this.loadPlayers(),
        this.loadAllProperties()
      ]);
      
      // After loading players and properties, load ownership data
      await this.loadOwnedProperties();
      
      console.log('Modal initialization completed');
      console.log('All properties:', this.allProperties.length);
      console.log('Available properties:', this.availableProperties.length);
      console.log('Players:', this.players.length);
      
    } catch (error) {
      console.error('Error initializing properties modal:', error);
      const errorAlert = await this.alertController.create({
        header: 'Errore',
        message: 'Errore nel caricamento delle proprietà',
        buttons: [{
          text: 'OK',
          handler: () => this.dismiss()
        }]
      });
      await errorAlert.present();
    } finally {
      loading.dismiss();
    }
  }

  async loadAllProperties() {
    try {
      console.log('=== LOADING ALL PROPERTIES ===');
      this.isLoadingProperties = true;
      
      const properties = await firstValueFrom(this.apiService.getAllProperties());
      this.allProperties = properties || [];
      
      console.log('All properties loaded:', this.allProperties.length);
      this.allProperties.forEach(p => console.log(`- ${p.name} (${p.type}): ${p.price}`));
      
      this.updateAvailableProperties();
    } catch (error) {
      console.error('Error loading all properties:', error);
      this.allProperties = [];
    } finally {
      this.isLoadingProperties = false;
    }
  }

  async loadOwnedProperties() {
    try {
      console.log('=== LOADING OWNED PROPERTIES ===');
      this.ownedPropertyIds.clear();
      
      if (this.players.length === 0) {
        console.log('No players available, skipping owned properties loading');
        return;
      }
      
      // Get all players' properties to determine which are owned
      for (const player of this.players) {
        try {
          const properties = await firstValueFrom(this.apiService.getPlayerProperties(player.id));
          const propertiesList = properties || [];
          console.log(`Player ${player.name} owns ${propertiesList.length} properties`);
          propertiesList.forEach(prop => {
            this.ownedPropertyIds.add(prop.propertyId);
            console.log(`- Owned: ${prop.propertyName} (ID: ${prop.propertyId})`);
          });
        } catch (playerError) {
          console.error(`Error loading properties for player ${player.name}:`, playerError);
        }
      }
      
      console.log('Total owned properties:', this.ownedPropertyIds.size);
      this.updateAvailableProperties();
    } catch (error) {
      console.error('Error loading owned properties:', error);
    }
  }

  updateAvailableProperties() {
    console.log('=== UPDATING AVAILABLE PROPERTIES ===');
    console.log('All properties count:', this.allProperties.length);
    console.log('Owned properties count:', this.ownedPropertyIds.size);
    
    this.availableProperties = this.allProperties.filter(
      property => !this.ownedPropertyIds.has(property.id)
    );
    
    console.log('Available properties after filter:', this.availableProperties.length);
    this.availableProperties.forEach(p => console.log(`- Available: ${p.name}`));
  }

  loadPlayers() {
    console.log('=== LOADING PLAYERS ===');
    
    this.gameService.getCurrentSession().subscribe((session) => {
      if (session?.players) {
        this.players = session.players;
        console.log('Players loaded from session:', this.players.length);
        this.players.forEach(p => console.log(`- Player: ${p.name} (${p.balance})`));
        
        if (this.players.length > 0 && !this.selectedPlayerId) {
          // Auto-select current player if available
          this.gameService.getCurrentPlayer().subscribe(currentPlayer => {
            if (currentPlayer) {
              this.selectedPlayerId = currentPlayer.id;
              console.log('Auto-selected current player:', currentPlayer.name);
            } else {
              this.selectedPlayerId = this.players[0].id;
              console.log('Auto-selected first player:', this.players[0].name);
            }
            this.loadPlayerProperties();
          });
        }
      } else {
        console.error('No session or players found');
        this.players = [];
      }
    });
  }

  async loadPlayerProperties() {
    if (!this.selectedPlayerId) {
      console.log('No player selected, clearing properties');
      this.playerProperties = [];
      return;
    }
    
    try {
      console.log('=== LOADING PLAYER PROPERTIES ===');
      console.log('Loading properties for player ID:', this.selectedPlayerId);
      
      this.isLoadingPlayerProperties = true;
      const properties = await firstValueFrom(this.apiService.getPlayerProperties(this.selectedPlayerId));
      this.playerProperties = properties || [];
      
      console.log('Player properties loaded:', this.playerProperties.length);
      this.playerProperties.forEach(p => 
        console.log(`- ${p.propertyName}: ${p.houses} houses, hotel: ${p.hasHotel}, mortgaged: ${p.isMortgaged}`)
      );
      
    } catch (error) {
      console.error('Error loading player properties:', error);
      this.playerProperties = [];
      
      const errorAlert = await this.alertController.create({
        header: 'Errore',
        message: 'Errore nel caricamento delle proprietà del giocatore',
        buttons: ['OK']
      });
      await errorAlert.present();
    } finally {
      this.isLoadingPlayerProperties = false;
    }
  }

  segmentChanged() {
    console.log('=== SEGMENT CHANGED ===');
    console.log('New segment:', this.selectedSegment);
    
    if (this.selectedSegment === 'owned' && this.players.length > 0) {
      if (!this.selectedPlayerId) {
        // Try to auto-select current player
        this.gameService.getCurrentPlayer().subscribe(currentPlayer => {
          if (currentPlayer) {
            this.selectedPlayerId = currentPlayer.id;
          } else {
            this.selectedPlayerId = this.players[0].id;
          }
          this.loadPlayerProperties();
        });
      } else {
        this.loadPlayerProperties();
      }
    } else if (this.selectedSegment === 'available') {
      this.loadOwnedProperties();
    }
  }

  async purchaseProperty(property: Property) {
    console.log('=== PURCHASE PROPERTY ===');
    console.log('Property:', property.name, 'Price:', property.price);
    
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

    // Create action sheet for player selection
    const actionSheet = await this.alertController.create({
      header: `Acquista "${property.name}"`,
      message: `Prezzo: ${this.gameService.formatCurrency(property.price)}`,
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
    await actionSheet.present();
  }

  private async executePurchase(property: Property, playerId: number) {
    const loading = await this.loadingController.create({
      message: 'Acquisto in corso...'
    });
    await loading.present();

    try {
      console.log('=== EXECUTING PURCHASE ===');
      console.log('Property:', property.id, 'Player:', playerId);
      
      await firstValueFrom(this.apiService.purchaseProperty(property.id, playerId));
      
      // Update the owned properties and available properties
      this.ownedPropertyIds.add(property.id);
      this.updateAvailableProperties();
      
      // If viewing the purchasing player's properties, refresh them
      if (this.selectedPlayerId === playerId) {
        await this.loadPlayerProperties();
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
    } finally {
      loading.dismiss();
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
    const loading = await this.loadingController.create({
      message: 'Costruzione casa...'
    });
    await loading.present();

    try {
      await firstValueFrom(this.apiService.buildHouse(ownership.id));
      await this.loadPlayerProperties();
      
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
    } finally {
      loading.dismiss();
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
    const loading = await this.loadingController.create({
      message: 'Costruzione hotel...'
    });
    await loading.present();

    try {
      await firstValueFrom(this.apiService.buildHotel(ownership.id));
      await this.loadPlayerProperties();
      
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
    } finally {
      loading.dismiss();
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
    const loading = await this.loadingController.create({
      message: 'Ipoteca in corso...'
    });
    await loading.present();

    try {
      await firstValueFrom(this.apiService.mortgageProperty(ownership.id));
      await this.loadPlayerProperties();
      
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
    } finally {
      loading.dismiss();
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
    const loading = await this.loadingController.create({
      message: 'Riscatto in corso...'
    });
    await loading.present();

    try {
      await firstValueFrom(this.apiService.redeemProperty(ownership.id));
      await this.loadPlayerProperties();
      
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
    } finally {
      loading.dismiss();
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

  getPropertyColorHex(colorGroup: string): string {
    const colorMap: { [key: string]: string } = {
      'BROWN': '#8b4513',
      'LIGHT_BLUE': '#87ceeb',
      'PINK': '#ff69b4',
      'ORANGE': '#ff8c00',
      'RED': '#dc143c',
      'YELLOW': '#ffd700',
      'GREEN': '#228b22',
      'DARK_BLUE': '#191970'
    };
    return colorMap[colorGroup] || '#6b7280';
  }

  async dismiss() {
    await this.modalController.dismiss({
      refresh: true
    });
  }
}