// src/app/components/wealth/wealth-management-modal/wealth-management-modal.component.ts
// QUESTO È UN COMPONENTE COMPLETAMENTE NUOVO

import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AlertController, ModalController, LoadingController } from '@ionic/angular';
import { Player } from '@/models/player.model';
import { ApiService } from '@/services/api.service';
import { GameService } from '@/services/game.service';

interface PlayerWealth {
  player: Player;
  netWorth: number;
  liquidationValue: number;
  isLoading: boolean;
}

@Component({
  selector: 'app-wealth-management-modal',
  templateUrl: './wealth-management-modal.component.html',
  styleUrls: ['./wealth-management-modal.component.scss']
})
export class WealthManagementModalComponent implements OnInit {
  playersWealth: PlayerWealth[] = [];

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private apiService: ApiService,
    public gameService: GameService
  ) {}

  async ngOnInit() {
    await this.loadPlayersWealth();
  }

  private async loadPlayersWealth() {
    this.gameService.getCurrentSession().subscribe(async (session) => {
      if (session?.players) {
        this.playersWealth = session.players.map(player => ({
          player,
          netWorth: 0,
          liquidationValue: 0,
          isLoading: true
        }));

        // Carica i dati patrimoniali per ogni giocatore
        for (const wealth of this.playersWealth) {
          try {
            const [netWorth, liquidationValue] = await Promise.all([
              firstValueFrom(this.apiService.calculateNetWorth(wealth.player.id)),
              firstValueFrom(this.apiService.calculateLiquidationValue(wealth.player.id))
            ]);

            wealth.netWorth = netWorth;
            wealth.liquidationValue = liquidationValue;
          } catch (error) {
            console.error(`Error loading wealth for ${wealth.player.name}:`, error);
          } finally {
            wealth.isLoading = false;
          }
        }
      }
    });
  }

  async liquidatePlayerAssets(player: Player) {
    const confirmation = await this.alertController.create({
      header: 'Liquidazione Asset',
      message: `Vuoi liquidare tutti gli asset di ${player.name}? Questa azione venderà tutti gli edifici e ipotecherà tutte le proprietà.`,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Liquida',
          handler: async () => {
            await this.executeLiquidation(player);
          }
        }
      ]
    });
    await confirmation.present();
  }

  private async executeLiquidation(player: Player) {
    const loading = await this.loadingController.create({
      message: 'Liquidazione in corso...'
    });
    await loading.present();

    try {
      const result = await firstValueFrom(this.apiService.liquidateAssets(player.id));
      
      const alert = await this.alertController.create({
        header: 'Liquidazione Completata',
        message: `Asset liquidati per ${this.gameService.formatCurrency(result.liquidatedAmount)}`,
        buttons: ['OK']
      });
      await alert.present();

      // Ricarica i dati
      await this.loadPlayersWealth();
      
    } catch (error) {
      console.error('Liquidation error:', error);
      const alert = await this.alertController.create({
        header: 'Errore Liquidazione',
        message: 'Errore durante la liquidazione degli asset',
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      loading.dismiss();
    }
  }

  async showBankruptcyOptions(player: Player) {
    const otherPlayers = this.playersWealth
      .filter(w => w.player.id !== player.id)
      .map(w => w.player);

    const actionSheet = await this.alertController.create({
      header: `Bancarotta di ${player.name}`,
      message: 'Seleziona il tipo di bancarotta',
      inputs: [
        {
          name: 'creditorType',
          type: 'radio',
          label: 'Bancarotta verso la Banca',
          value: 'bank',
          checked: true
        },
        ...otherPlayers.map(creditor => ({
          name: 'creditorType',
          type: 'radio' as const,
          label: `Bancarotta verso ${creditor.name}`,
          value: `${creditor.id}`,
          checked: false
        }))
      ],
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Dichiara Bancarotta',
          handler: async (creditorType) => {
            if (creditorType) {
              await this.executeBankruptcy(player, creditorType === 'bank' ? null : creditorType);
            }
          }
        }
      ]
    });
    await actionSheet.present();
  }

  private async executeBankruptcy(player: Player, creditorId: number | null) {
    const loading = await this.loadingController.create({
      message: 'Gestione bancarotta...'
    });
    await loading.present();

    try {
      const result = await firstValueFrom(this.apiService.declareBankruptcy(player.id, creditorId));
      
      const alert = await this.alertController.create({
        header: 'Bancarotta Dichiarata',
        message: result.message,
        buttons: ['OK']
      });
      await alert.present();

      // Chiudi il modal e aggiorna i dati
      await this.dismiss();
      
    } catch (error) {
      console.error('Bankruptcy error:', error);
      const alert = await this.alertController.create({
        header: 'Errore Bancarotta',
        message: 'Errore durante la dichiarazione di bancarotta',
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      loading.dismiss();
    }
  }

  getTotalNetWorth(): number {
    return this.playersWealth.reduce((total, wealth) => total + wealth.netWorth, 0);
  }

  getTotalLiquidation(): number {
    return this.playersWealth.reduce((total, wealth) => total + wealth.liquidationValue, 0);
  }

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

  async dismiss() {
    await this.modalController.dismiss({
      refresh: true
    });
  }
}