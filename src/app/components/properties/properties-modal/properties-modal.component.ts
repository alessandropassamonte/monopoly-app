

import { Component, OnInit, Input } from '@angular/core';
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
  @Input() currentPlayerOnly: boolean = true;
  
  selectedSegment = 'available';
  availableProperties: Property[] = [];
  filteredAvailableProperties: Property[] = []; // NUOVO: Lista filtrata
  allProperties: Property[] = [];
  currentPlayerProperties: PropertyOwnership[] = [];
  filteredCurrentPlayerProperties: PropertyOwnership[] = []; // NUOVO: Lista filtrata
  currentPlayer: Player | null = null;
  ownedPropertyIds: Set<number> = new Set();

  // NUOVO: Variabili per la ricerca
  searchTerm: string = '';
  ownedSearchTerm: string = '';

  // Loading states
  isLoadingProperties = false;
  isLoadingPlayerProperties = false;

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private apiService: ApiService,
    public gameService: GameService
  ) { }

  async ngOnInit() {
    console.log('=== PROPERTIES MODAL INIT (With Search) ===');
    await this.initializeModal();
  }

  async initializeModal() {
    const loading = await this.loadingController.create({
      message: 'Caricamento proprietà...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // Ottieni il giocatore corrente
      await this.loadCurrentPlayer();
      
      if (!this.currentPlayer) {
        throw new Error('Giocatore corrente non identificato');
      }

      // Load all data in parallel
      await Promise.all([
        this.loadAllProperties(),
        this.loadOwnedProperties()
      ]);

      // Carica le proprietà del giocatore corrente
      await this.loadCurrentPlayerProperties();

      console.log('Modal initialization completed');
      console.log('All properties:', this.allProperties.length);
      console.log('Available properties:', this.availableProperties.length);
      console.log('Current player properties:', this.currentPlayerProperties.length);

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

  async loadCurrentPlayer() {
    return new Promise<void>((resolve) => {
      this.gameService.getCurrentPlayer().subscribe((player: Player | null) => {
        this.currentPlayer = player;
        console.log('Current player loaded:', this.currentPlayer?.name);
        resolve();
      });
    });
  }

  async loadAllProperties() {
    try {
      console.log('=== LOADING ALL PROPERTIES ===');
      this.isLoadingProperties = true;

      const properties = await firstValueFrom(this.apiService.getAllProperties());
      this.allProperties = properties || [];

      console.log('All properties loaded:', this.allProperties.length);
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

      // Ottieni la sessione corrente per tutti i giocatori
      const session = await new Promise<any>((resolve) => {
        this.gameService.getCurrentSession().subscribe(session => resolve(session));
      });

      if (!session?.players) {
        console.log('No session or players available');
        return;
      }

      // Get all players' properties to determine which are owned
      for (const player of session.players) {
        try {
          const properties = await firstValueFrom(this.apiService.getPlayerProperties(player.id));
          const propertiesList = properties || [];
          propertiesList.forEach(prop => {
            this.ownedPropertyIds.add(prop.propertyId);
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
    this.availableProperties = this.allProperties.filter(
      property => !this.ownedPropertyIds.has(property.id)
    );
    console.log('Available properties after filter:', this.availableProperties.length);
    
    // AGGIUNTO: Applica filtro di ricerca
    this.applyAvailablePropertiesFilter();
  }

  async loadCurrentPlayerProperties() {
    if (!this.currentPlayer) {
      console.log('No current player, clearing properties');
      this.currentPlayerProperties = [];
      this.filteredCurrentPlayerProperties = [];
      return;
    }

    try {
      console.log('=== LOADING CURRENT PLAYER PROPERTIES ===');
      console.log('Loading properties for current player:', this.currentPlayer.name);

      this.isLoadingPlayerProperties = true;
      const properties = await firstValueFrom(this.apiService.getPlayerProperties(this.currentPlayer.id));
      this.currentPlayerProperties = properties || [];

      console.log('Current player properties loaded:', this.currentPlayerProperties.length);
      this.currentPlayerProperties.forEach(p =>
        console.log(`- ${p.propertyName}: ${p.houses} houses, hotel: ${p.hasHotel}, mortgaged: ${p.isMortgaged}`)
      );

      // AGGIUNTO: Applica filtro di ricerca
      this.applyOwnedPropertiesFilter();

    } catch (error) {
      console.error('Error loading current player properties:', error);
      this.currentPlayerProperties = [];
      this.filteredCurrentPlayerProperties = [];

      const errorAlert = await this.alertController.create({
        header: 'Errore',
        message: 'Errore nel caricamento delle tue proprietà',
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

    if (this.selectedSegment === 'owned') {
      this.loadCurrentPlayerProperties();
    } else if (this.selectedSegment === 'available') {
      this.loadOwnedProperties();
    }
  }

  // ============================================
  // NUOVO: Metodi per la ricerca
  // ============================================
  
  /**
   * Applica il filtro di ricerca alle proprietà disponibili
   */
  applyAvailablePropertiesFilter() {
    if (!this.searchTerm.trim()) {
      this.filteredAvailableProperties = [...this.availableProperties];
      return;
    }

    const term = this.searchTerm.toLowerCase().trim();
    this.filteredAvailableProperties = this.availableProperties.filter(property => {
      return property.name.toLowerCase().includes(term) ||
             property.colorGroup.toLowerCase().includes(term) ||
             property.type.toLowerCase().includes(term) ||
             this.getPropertyTypeLabel(property.type).toLowerCase().includes(term);
    });

    console.log(`Filtered available properties: ${this.filteredAvailableProperties.length}/${this.availableProperties.length}`);
  }

  /**
   * Applica il filtro di ricerca alle proprietà possedute
   */
  applyOwnedPropertiesFilter() {
    if (!this.ownedSearchTerm.trim()) {
      this.filteredCurrentPlayerProperties = [...this.currentPlayerProperties];
      return;
    }

    const term = this.ownedSearchTerm.toLowerCase().trim();
    this.filteredCurrentPlayerProperties = this.currentPlayerProperties.filter(property => {
      return property.propertyName.toLowerCase().includes(term) ||
             property.colorGroup.toLowerCase().includes(term) ||
             property.propertyType.toLowerCase().includes(term) ||
             this.getPropertyTypeLabel(property.propertyType).toLowerCase().includes(term);
    });

    console.log(`Filtered owned properties: ${this.filteredCurrentPlayerProperties.length}/${this.currentPlayerProperties.length}`);
  }

  /**
   * Handler per il cambiamento del termine di ricerca (proprietà disponibili)
   */
  onSearchTermChange() {
    console.log('Search term changed:', this.searchTerm);
    this.applyAvailablePropertiesFilter();
  }

  /**
   * Handler per il cambiamento del termine di ricerca (proprietà possedute)
   */
  onOwnedSearchTermChange() {
    console.log('Owned search term changed:', this.ownedSearchTerm);
    this.applyOwnedPropertiesFilter();
  }

  /**
   * Pulisce il filtro di ricerca
   */
  clearSearch() {
    this.searchTerm = '';
    this.applyAvailablePropertiesFilter();
  }

  /**
   * Pulisce il filtro di ricerca per proprietà possedute
   */
  clearOwnedSearch() {
    this.ownedSearchTerm = '';
    this.applyOwnedPropertiesFilter();
  }

  // ============================================
  // Acquisto proprietà (invariato)
  // ============================================
  async purchaseProperty(property: Property) {
    if (!this.currentPlayer) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Giocatore non identificato',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    console.log('=== PURCHASE PROPERTY (Current Player Only) ===');
    console.log('Property:', property.name, 'Price:', property.price);
    console.log('Current player:', this.currentPlayer.name, 'Balance:', this.currentPlayer.balance);

    // Verifica fondi sufficienti
    if (this.currentPlayer.balance < property.price) {
      const alert = await this.alertController.create({
        header: 'Fondi Insufficienti',
        message: `Non hai abbastanza denaro per acquistare "${property.name}".\nCosto: ${this.gameService.formatCurrency(property.price)}\nTuo saldo: ${this.gameService.formatCurrency(this.currentPlayer.balance)}`,
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    // Conferma acquisto
    const confirmation = await this.alertController.create({
      header: 'Conferma Acquisto',
      message: `Vuoi acquistare "${property.name}" per ${this.gameService.formatCurrency(property.price)}?\n\nIl tuo saldo diventerà: ${this.gameService.formatCurrency(this.currentPlayer.balance - property.price)}`,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Acquista',
          handler: async () => {
            await this.executePurchase(property, this.currentPlayer!.id);
          }
        }
      ]
    });
    await confirmation.present();
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

      // Ricarica le proprietà del giocatore corrente
      await this.loadCurrentPlayerProperties();

      // Show success message
      const successAlert = await this.alertController.create({
        header: 'Acquisto Completato',
        message: `Hai acquistato "${property.name}"!`,
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

  // ============================================
  // Azioni proprietà (invariate)
  // ============================================
  async buildHouse(ownership: PropertyOwnership) {
    const houseCost = this.getHouseCost(ownership.colorGroup);
    const confirmation = await this.alertController.create({
      header: 'Costruisci Casa',
      message: `Vuoi costruire una casa su "${ownership.propertyName}"?\nCosto: ${this.gameService.formatCurrency(houseCost)}`,
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
      await this.loadCurrentPlayerProperties();

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
      await this.loadCurrentPlayerProperties();

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
      await this.loadCurrentPlayerProperties();

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
      await this.loadCurrentPlayerProperties();

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

  async sellHouse(ownership: PropertyOwnership) {
    const houseCost = this.getHouseCost(ownership.colorGroup);
    const sellPrice = houseCost / 2;

    const confirmation = await this.alertController.create({
      header: 'Vendi Casa',
      message: `Vuoi vendere una casa da "${ownership.propertyName}"?\nIncasso: ${this.gameService.formatCurrency(sellPrice)}`,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Vendi',
          handler: async () => {
            await this.executeSellHouse(ownership);
          }
        }
      ]
    });
    await confirmation.present();
  }

  private async executeSellHouse(ownership: PropertyOwnership) {
    const loading = await this.loadingController.create({
      message: 'Vendita casa...'
    });
    await loading.present();

    try {
      await firstValueFrom(this.apiService.sellHouse(ownership.id));
      await this.loadCurrentPlayerProperties();

      const alert = await this.alertController.create({
        header: 'Casa Venduta',
        message: `Casa venduta da "${ownership.propertyName}"!`,
        buttons: ['OK']
      });
      await alert.present();
    } catch (error) {
      console.error('Sell house error:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Impossibile vendere la casa. Verifica la costruzione equilibrata.',
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      loading.dismiss();
    }
  }

  async sellHotel(ownership: PropertyOwnership) {
    const hotelCost = this.getHouseCost(ownership.colorGroup);
    const sellPrice = hotelCost / 2;

    const confirmation = await this.alertController.create({
      header: 'Vendi Hotel',
      message: `Vuoi vendere l'hotel da "${ownership.propertyName}"?\nIncasso: ${this.gameService.formatCurrency(sellPrice)}\nRiceverai 4 case in cambio.`,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Vendi',
          handler: async () => {
            await this.executeSellHotel(ownership);
          }
        }
      ]
    });
    await confirmation.present();
  }

  private async executeSellHotel(ownership: PropertyOwnership) {
    const loading = await this.loadingController.create({
      message: 'Vendita hotel...'
    });
    await loading.present();

    try {
      await firstValueFrom(this.apiService.sellHotel(ownership.id));
      await this.loadCurrentPlayerProperties();

      const alert = await this.alertController.create({
        header: 'Hotel Venduto',
        message: `Hotel venduto da "${ownership.propertyName}"! Ora hai 4 case.`,
        buttons: ['OK']
      });
      await alert.present();
    } catch (error) {
      console.error('Sell hotel error:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Impossibile vendere l\'hotel.',
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      loading.dismiss();
    }
  }

  // ============================================
  // Trasferimento proprietà (invariato)
  // ============================================
  async transferProperty(ownership: PropertyOwnership) {
    // Ottieni la sessione corrente per trovare gli altri giocatori
    const session = await new Promise<any>((resolve) => {
      this.gameService.getCurrentSession().subscribe(session => resolve(session));
    });

    if (!session?.players) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Sessione non disponibile',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const availablePlayers = session.players.filter((p: any) => p.id !== this.currentPlayer?.id);

    if (availablePlayers.length === 0) {
      const alert = await this.alertController.create({
        header: 'Impossibile Trasferire',
        message: 'Non ci sono altri giocatori disponibili.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const alert = await this.alertController.create({
      header: `Trasferisci "${ownership.propertyName}"`,
      message: 'Seleziona il nuovo proprietario e il prezzo (opzionale)',
      inputs: [
        {
          name: 'newOwnerId',
          type: 'radio' as const,
          label: 'Nuovo Proprietario',
          value: '',
          checked: false
        },
        ...availablePlayers.map((player: any) => ({
          name: 'newOwnerId',
          type: 'radio' as const,
          label: `${player.name} (${this.gameService.formatCurrency(player.balance)})`,
          value: `${player.id}`,  
          checked: false
        })),
        {
          name: 'price',
          type: 'number' as const,
          placeholder: 'Prezzo (lascia vuoto per regalo)',
          min: 0
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
            if (data.newOwnerId) {
              await this.executeTransferProperty(ownership, data.newOwnerId, data.price);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private async executeTransferProperty(ownership: PropertyOwnership, newOwnerId: number, price?: number) {
    const loading = await this.loadingController.create({
      message: 'Trasferimento proprietà...'
    });
    await loading.present();

    try {
      await firstValueFrom(this.apiService.transferProperty(ownership.id, newOwnerId, price));

      await this.loadOwnedProperties();
      await this.loadCurrentPlayerProperties();

      const alert = await this.alertController.create({
        header: 'Proprietà Trasferita',
        message: `"${ownership.propertyName}" è stata trasferita con successo!`,
        buttons: ['OK']
      });
      await alert.present();
    } catch (error) {
      console.error('Transfer property error:', error);
      const alert = await this.alertController.create({
        header: 'Errore Trasferimento',
        message: 'Errore nel trasferimento. Verifica i fondi disponibili.',
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      loading.dismiss();
    }
  }

  // ============================================
  // Utility functions
  // ============================================
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

  private getHouseCost(colorGroup: string): number {
    const costs: { [key: string]: number } = {
      'BROWN': 50,
      'LIGHT_BLUE': 50,
      'PINK': 100,
      'ORANGE': 100,
      'RED': 150,  
      'YELLOW': 150,
      'GREEN': 200,
      'DARK_BLUE': 200
    };
    return costs[colorGroup] || 100;
  }

  async dismiss() {
    await this.modalController.dismiss({
      refresh: true
    });
  }
}