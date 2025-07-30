

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
        console.log(`- ${p.propertyName}: ${p.houses} houses, hotel: ${p.hasHotel}, mortgaged: ${p.mortgaged}`)
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

  // Aggiungi questo metodo alla classe PropertiesModalComponent

  /**
   * Acquista una proprietà a un prezzo arbitrario specificato dall'utente
   */
  async purchasePropertyCustomPrice(property: Property) {
    if (!this.currentPlayer) {
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Giocatore non identificato',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    console.log('=== PURCHASE PROPERTY CUSTOM PRICE ===');
    console.log('Property:', property.name, 'Official Price:', property.price);
    console.log('Current player:', this.currentPlayer.name, 'Balance:', this.currentPlayer.balance);

    // Input per il prezzo personalizzato
    const priceAlert = await this.alertController.create({
      header: 'Prezzo Personalizzato',
      message: `Inserisci il prezzo per "${property.name}":Prezzo ufficiale: ${this.gameService.formatCurrency(property.price)}`,
      inputs: [
        {
          name: 'customPrice',
          type: 'number',
          placeholder: 'Inserisci prezzo (€)',
          min: 0,
          value: property.price // Precompila con il prezzo ufficiale
        }
      ],
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Continua',
          handler: async (data) => {
            const customPrice = parseFloat(data.customPrice);

            // Validazione prezzo
            if (isNaN(customPrice) || customPrice < 0) {
              const errorAlert = await this.alertController.create({
                header: 'Prezzo Non Valido',
                message: 'Inserisci un prezzo valido (numero positivo)',
                buttons: ['OK']
              });
              await errorAlert.present();
              return false; // Mantiene aperto il dialog
            }

            // Verifica fondi sufficienti
            if (this.currentPlayer!.balance < customPrice) {
              const insufficientFundsAlert = await this.alertController.create({
                header: 'Fondi Insufficienti',
                message: `Non hai abbastanza denaro per acquistare "${property.name}" a questo prezzo.\nPrezzo richiesto: ${this.gameService.formatCurrency(customPrice)}\nTuo saldo: ${this.gameService.formatCurrency(this.currentPlayer!.balance)}`,
                buttons: ['OK']
              });
              await insufficientFundsAlert.present();
              return false; // Mantiene aperto il dialog
            }

            // Conferma acquisto con prezzo personalizzato
            await this.confirmCustomPricePurchase(property, customPrice);
            return true;
          }
        }
      ]
    });
    await priceAlert.present();
  }

  /**
   * Conferma e esegue l'acquisto a prezzo personalizzato
   */
  private async confirmCustomPricePurchase(property: Property, customPrice: number) {
    const priceDifference = customPrice - property.price;
    const isPriceHigher = priceDifference > 0;
    const isPriceLower = priceDifference < 0;

    let warningMessage = '';
    if (isPriceHigher) {
      warningMessage = `\nStai pagando ${this.gameService.formatCurrency(priceDifference)} in più del prezzo ufficiale!`;
    } else if (isPriceLower) {
      warningMessage = `\nStai risparmiando ${this.gameService.formatCurrency(Math.abs(priceDifference))} rispetto al prezzo ufficiale!`;
    }

    const confirmation = await this.alertController.create({
      header: 'Conferma Acquisto Personalizzato',
      message: `Vuoi acquistare "${property.name}" per ${this.gameService.formatCurrency(customPrice)}?${warningMessage}\n\nPrezzo ufficiale: ${this.gameService.formatCurrency(property.price)}\nIl tuo saldo diventerà: ${this.gameService.formatCurrency(this.currentPlayer!.balance - customPrice)}`,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Acquista',
          handler: async () => {
            await this.executeCustomPricePurchase(property, customPrice);
          }
        }
      ]
    });
    await confirmation.present();
  }

  /**
   * Esegue l'acquisto a prezzo personalizzato
   * Nota: Potrebbe essere necessario creare un nuovo endpoint API o modificare quello esistente
   */
  private async executeCustomPricePurchase(property: Property, customPrice: number) {
    const loading = await this.loadingController.create({
      message: 'Acquisto in corso...'
    });
    await loading.present();

    try {
      console.log('=== EXECUTING CUSTOM PRICE PURCHASE ===');
      console.log('Property:', property.id, 'Player:', this.currentPlayer!.id, 'Custom Price:', customPrice);

      // Usa il nuovo endpoint per l'acquisto a prezzo personalizzato
      await firstValueFrom(this.apiService.purchasePropertyCustomPrice(property.id, this.currentPlayer!.id, customPrice));

      // Update the owned properties and available properties
      this.ownedPropertyIds.add(property.id);
      this.updateAvailableProperties();

      // Ricarica le proprietà del giocatore corrente
      await this.loadCurrentPlayerProperties();

      // Show success message
      const successAlert = await this.alertController.create({
        header: 'Acquisto Completato',
        message: `Hai acquistato "${property.name}" per ${this.gameService.formatCurrency(customPrice)}!`,
        buttons: ['OK']
      });
      await successAlert.present();

    } catch (error) {
      console.error('Custom price purchase error:', error);
      const errorAlert = await this.alertController.create({
        header: 'Errore Acquisto',
        message: 'Errore nell\'acquisto a prezzo personalizzato. Riprova.',
        buttons: ['OK']
      });
      await errorAlert.present();
    } finally {
      await loading.dismiss();
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
    console.log('=== INITIATING SINGLE PROPERTY TRANSFER ===');
    console.log('Property:', ownership.propertyName);

    // Verifica se la proprietà può essere trasferita
    if (ownership.houses > 0 || ownership.hasHotel) {
      const alert = await this.alertController.create({
        header: 'Impossibile Trasferire',
        message: `Non puoi trasferire "${ownership.propertyName}" perché ha edifici. Vendi prima case e hotel.`,
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    try {
      const session = await new Promise<any>((resolve, reject) => {
        this.gameService.getCurrentSession().subscribe({
          next: (session) => {
            if (session) {
              resolve(session);
            } else {
              reject(new Error('Sessione non disponibile'));
            }
          },
          error: (error) => reject(error)
        });
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

      // CORREZIONE: Modal semplificato senza stili inline
      await this.showSimpleTransferModal(ownership, availablePlayers);

    } catch (error) {
      console.error('Error getting current session:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Impossibile accedere alla sessione di gioco',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  // NUOVO: Modal semplificato senza stili CSS inline problematici
  private async showSimpleTransferModal(ownership: PropertyOwnership, availablePlayers: any[]) {
    const alert = await this.alertController.create({
      header: 'Trasferisci Proprietà',
      message: `Trasferimento di: ${ownership.propertyName}\nValore: ${this.gameService.formatCurrency(ownership.propertyPrice)}${ownership.mortgaged ? '\n⚠️ PROPRIETÀ IPOTECATA' : ''}`,
      inputs: [
        // Header destinatario - SENZA stili
        {
          name: 'destinatario-header',
          type: 'text',
          value: '--- SELEZIONA DESTINATARIO ---',
          disabled: true
        },
        // Destinatari
        ...availablePlayers.map((player: any, index: number) => ({
          name: 'newOwnerId',
          type: 'radio' as const,
          label: `${player.name} (${this.gameService.formatCurrency(player.balance)})`,
          value: player.id.toString(),
          checked: index === 0 // Seleziona automaticamente il primo
        })),

        // Header prezzo - SENZA stili
        {
          name: 'price-header',
          type: 'text',
          value: '--- SELEZIONA PREZZO ---',
          disabled: true
        },

        // Opzioni prezzo
        {
          name: 'priceType',
          type: 'radio',
          label: 'Regalo (gratuito)',
          value: 'gift',
          checked: true
        },
        {
          name: 'priceType',
          type: 'radio',
          label: 'Valore pieno proprietà',
          value: 'full',
          checked: false
        },
        {
          name: 'priceType',
          type: 'radio',
          label: 'Prezzo personalizzato',
          value: 'custom',
          checked: false
        },

        // Prezzo personalizzato
        {
          name: 'customPrice',
          type: 'number',
          placeholder: 'Inserisci prezzo personalizzato',
          min: 0,
          value: 0
        },

        // Descrizione
        {
          name: 'description',
          type: 'text',
          placeholder: 'Motivo del trasferimento',
          value: `Trasferimento ${ownership.propertyName}`
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
            console.log('=== TRANSFER FORM DATA ===', data);
            return await this.validateAndExecuteSimpleTransfer(data, ownership, availablePlayers);
          }
        }
      ]
    });
    await alert.present();
  }

  private async validateAndExecuteSimpleTransfer(
    data: any,
    ownership: PropertyOwnership,
    availablePlayers: any[]
  ): Promise<boolean> {
    console.log('=== VALIDATING SIMPLE TRANSFER ===', data);

    // Validazione destinatario
    if (!data.newOwnerId) {
      const errorAlert = await this.alertController.create({
        header: 'Errore',
        message: 'Seleziona il giocatore destinatario.',
        buttons: ['OK']
      });
      await errorAlert.present();
      return false;
    }

    const newOwner = availablePlayers.find(p => p.id.toString() === data.newOwnerId);
    if (!newOwner) {
      const errorAlert = await this.alertController.create({
        header: 'Errore',
        message: 'Destinatario non trovato.',
        buttons: ['OK']
      });
      await errorAlert.present();
      return false;
    }

    // Calcolo prezzo
    let price = 0;
    switch (data.priceType) {
      case 'gift':
        price = 0;
        break;
      case 'full':
        price = ownership.propertyPrice;
        break;
      case 'custom':
        price = parseFloat(data.customPrice) || 0;
        if (price < 0) {
          const errorAlert = await this.alertController.create({
            header: 'Prezzo Non Valido',
            message: 'Il prezzo non può essere negativo.',
            buttons: ['OK']
          });
          await errorAlert.present();
          return false;
        }
        break;
      default:
        price = 0;
    }

    // Verifica fondi del destinatario
    if (price > 0 && newOwner.balance < price) {
      const errorAlert = await this.alertController.create({
        header: 'Fondi Insufficienti',
        message: `${newOwner.name} non ha abbastanza denaro (${this.gameService.formatCurrency(newOwner.balance)}) per acquistare la proprietà al prezzo di ${this.gameService.formatCurrency(price)}.`,
        buttons: ['OK']
      });
      await errorAlert.present();
      return false;
    }

    // Conferma
    const confirmed = await this.showSimpleTransferConfirmation(ownership, newOwner, price, data.description);
    if (!confirmed) {
      return false;
    }

    // Esegui trasferimento
    return await this.executeSimplePropertyTransfer(ownership, newOwner.id, price, data.description);
  }

  private async executeSimplePropertyTransfer(
    ownership: PropertyOwnership,
    newOwnerId: number,
    price: number,
    description: string
  ): Promise<boolean> {

    let loading: any = null;

    try {
      loading = await this.loadingController.create({
        message: 'Trasferimento proprietà...'
      });
      await loading.present();

      console.log('=== EXECUTING SIMPLE PROPERTY TRANSFER ===');
      console.log('Ownership ID:', ownership.id);
      console.log('New Owner ID:', newOwnerId);
      console.log('Price:', price);

      const result = await firstValueFrom(
        this.apiService.transferProperty(
          ownership.id,
          newOwnerId,
          price > 0 ? price : undefined,
          description
        )
      );

      console.log('✅ Transfer completed successfully:', result);

      // Ricarica i dati
      await this.loadOwnedProperties();
      await this.loadCurrentPlayerProperties();

      // Ottieni nome del nuovo proprietario
      let newOwnerName = 'Giocatore';
      try {
        const session = await new Promise<any>((resolve) => {
          this.gameService.getCurrentSession().subscribe(session => resolve(session));
        });
        const newOwner = session?.players?.find((p: any) => p.id === newOwnerId);
        if (newOwner) {
          newOwnerName = newOwner.name;
        }
      } catch (error) {
        console.warn('Could not get new owner name:', error);
      }

      // Chiudi loading PRIMA dell'alert
      if (loading) {
        await loading.dismiss();
        loading = null;
      }

      // Mostra successo
      const alert = await this.alertController.create({
        header: 'Trasferimento Completato',
        message: `"${ownership.propertyName}" è stata trasferita con successo a ${newOwnerName}!`,
        buttons: ['OK']
      });
      await alert.present();

      return true;

    } catch (error) {
      console.error('❌ Transfer error:', error);

      // Chiudi loading PRIMA dell'alert di errore
      if (loading) {
        await loading.dismiss();
        loading = null;
      }

      let errorMessage = 'Errore durante il trasferimento.';
      if (error && typeof error === 'object') {
        if ((error as any).status === 400) {
          errorMessage = (error as any).error?.message || 'Dati non validi o fondi insufficienti.';
        } else if ((error as any).status === 404) {
          errorMessage = 'Proprietà o giocatore non trovato.';
        }
      }

      const alert = await this.alertController.create({
        header: 'Errore Trasferimento',
        message: errorMessage,
        buttons: ['OK']
      });
      await alert.present();

      return false;

    } finally {
      // Sicurezza: assicurati che loading sia sempre chiuso
      if (loading) {
        try {
          await loading.dismiss();
        } catch (e) {
          console.warn('Error dismissing loading:', e);
        }
      }
    }
  }

  // NUOVO: Conferma semplificata
  private async showSimpleTransferConfirmation(
    ownership: PropertyOwnership,
    newOwner: any,
    price: number,
    description: string
  ): Promise<boolean> {
    let message = `CONFERMA TRASFERIMENTO\n\n`;
    message += `Proprietà: ${ownership.propertyName}\n`;
    message += `Da: ${this.currentPlayer?.name}\n`;
    message += `A: ${newOwner.name}\n`;
    message += `Valore proprietà: ${this.gameService.formatCurrency(ownership.propertyPrice)}\n`;

    if (ownership.mortgaged) {
      message += `\n⚠️ PROPRIETÀ IPOTECATA\n`;
      message += `${newOwner.name} dovrà pagare il 10% per mantenere l'ipoteca\n`;
    }

    if (price > 0) {
      message += `\nPrezzo: ${this.gameService.formatCurrency(price)}`;
    } else {
      message += `\nTrasferimento gratuito`;
    }

    if (description && description.trim()) {
      message += `\n\nDescrizione: ${description}`;
    }

    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: 'Conferma Trasferimento',
        message,
        buttons: [
          {
            text: 'Annulla',
            handler: () => resolve(false)
          },
          {
            text: 'Conferma',
            handler: () => resolve(true)
          }
        ]
      });
      await alert.present();
    });
  }
  /**
   * NUOVO: Validazione ed esecuzione trasferimento singolo
   */

  private async validateAndExecuteSingleTransfer(
    data: any,
    ownership: PropertyOwnership,
    availablePlayers: any[]
  ): Promise<boolean> {
    console.log('=== VALIDATING SINGLE TRANSFER ===', data);

    // Validazione destinatario
    if (!data.newOwnerId) {
      await this.showTransferError('Destinatario Mancante', 'Seleziona il giocatore destinatario.');
      return false;
    }

    const newOwner = availablePlayers.find(p => p.id.toString() === data.newOwnerId);
    if (!newOwner) {
      await this.showTransferError('Errore', 'Destinatario non trovato.');
      return false;
    }

    // Calcolo prezzo
    let price = 0;
    switch (data.priceType) {
      case 'gift':
        price = 0;
        break;
      case 'full':
        price = ownership.propertyPrice;
        break;
      case 'custom':
        price = parseFloat(data.customPrice) || 0;
        if (price < 0) {
          await this.showTransferError('Prezzo Non Valido', 'Il prezzo non può essere negativo.');
          return false;
        }
        break;
      default:
        price = 0;
    }

    // Verifica fondi del destinatario
    if (price > 0 && newOwner.balance < price) {
      await this.showTransferError(
        'Fondi Insufficienti',
        `${newOwner.name} non ha abbastanza denaro (${this.gameService.formatCurrency(newOwner.balance)}) per acquistare la proprietà al prezzo di ${this.gameService.formatCurrency(price)}.`
      );
      return false;
    }

    // Mostra conferma
    const confirmed = await this.showSingleTransferConfirmation(ownership, newOwner, price, data.description);
    if (!confirmed) {
      return false;
    }

    // Esegui trasferimento
    return await this.executeSinglePropertyTransfer(ownership, newOwner.id, price, data.description);
  }
  private async executeSinglePropertyTransfer(
    ownership: PropertyOwnership,
    newOwnerId: number,
    price: number,
    description: string
  ): Promise<boolean> {

    let loading: any = null;

    try {
      // Crea il loading con controllo
      loading = await this.loadingController.create({
        message: 'Trasferimento proprietà...'
      });
      await loading.present();

      console.log('=== EXECUTING SINGLE PROPERTY TRANSFER ===');
      console.log('Ownership ID:', ownership.id);
      console.log('New Owner ID:', newOwnerId);
      console.log('Price:', price);

      // CORREZIONE: Usa il metodo API corretto con gestione errore migliorata
      const result = await firstValueFrom(
        this.apiService.transferProperty(ownership.id, newOwnerId, price > 0 ? price : undefined, description)
      );

      console.log('✅ Single transfer completed successfully:', result);

      // Ricarica i dati
      await this.loadOwnedProperties();
      await this.loadCurrentPlayerProperties();

      // CORREZIONE: Ottieni newOwner dalla sessione corrente
      let newOwnerName = 'Giocatore';
      try {
        const session = await new Promise<any>((resolve) => {
          this.gameService.getCurrentSession().subscribe(session => resolve(session));
        });
        const newOwner = session?.players?.find((p: any) => p.id === newOwnerId);
        if (newOwner) {
          newOwnerName = newOwner.name;
        }
      } catch (error) {
        console.warn('Could not get new owner name:', error);
      }

      // IMPORTANTE: Chiudi il loading PRIMA di mostrare l'alert
      if (loading) {
        await loading.dismiss();
        loading = null; // Prevenire doppia chiusura
      }

      // Mostra successo
      const alert = await this.alertController.create({
        header: '✅ Trasferimento Completato',
        message: `"${ownership.propertyName}" è stata trasferita con successo a ${newOwnerName}!`,
        buttons: ['OK']
      });
      await alert.present();

      return true; // Chiude il modal

    } catch (error) {
      console.error('❌ Single transfer error:', error);

      // IMPORTANTE: Chiudi il loading PRIMA di mostrare l'errore
      if (loading) {
        await loading.dismiss();
        loading = null; // Prevenire doppia chiusura
      }

      let errorMessage = 'Errore durante il trasferimento.';
      if (error && typeof error === 'object') {
        if ((error as any).status === 400) {
          errorMessage = (error as any).error?.message || 'Dati non validi o fondi insufficienti.';
        } else if ((error as any).status === 404) {
          errorMessage = 'Proprietà o giocatore non trovato.';
        }
      }

      const alert = await this.alertController.create({
        header: '❌ Errore Trasferimento',
        message: errorMessage,
        buttons: ['OK']
      });
      await alert.present();

      return false; // Mantiene aperto il modal

    } finally {
      // SICUREZZA: Assicurati che il loading sia sempre chiuso
      if (loading) {
        try {
          await loading.dismiss();
        } catch (e) {
          console.warn('Error dismissing loading:', e);
        }
      }
    }
  }

  /**
   * NUOVO: Mostra errore trasferimento
   */
  private async showTransferError(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: `❌ ${header}`,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }


  /**
   * NUOVO: Conferma trasferimento singolo
   */
  private async showSingleTransferConfirmation(
    ownership: PropertyOwnership,
    newOwner: any,
    price: number,
    description: string
  ): Promise<boolean> {
    let message = `🔄 CONFERMA TRASFERIMENTO\n\n`;
    message += `🏠 Proprietà: ${ownership.propertyName}\n`;
    message += `📤 Da: ${this.currentPlayer?.name}\n`;
    message += `📥 A: ${newOwner.name}\n`;
    message += `💎 Valore proprietà: ${this.gameService.formatCurrency(ownership.propertyPrice)}\n`;

    if (ownership.mortgaged) {
      message += `⚠️ PROPRIETÀ IPOTECATA\n`;
      message += `💸 ${newOwner.name} dovrà pagare il 10% (${this.gameService.formatCurrency(ownership.propertyPrice * 0.1)}) per mantenere l'ipoteca\n`;
    }

    if (price > 0) {
      message += `\n💰 Prezzo: ${this.gameService.formatCurrency(price)}`;
    } else {
      message += `\n🎁 Trasferimento gratuito`;
    }

    if (description && description.trim()) {
      message += `\n\n📝 ${description}`;
    }

    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: 'Conferma Trasferimento',
        message,
        buttons: [
          {
            text: 'Annulla',
            handler: () => resolve(false)
          },
          {
            text: 'Conferma',
            handler: () => resolve(true)
          }
        ]
      });
      await alert.present();
    });
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