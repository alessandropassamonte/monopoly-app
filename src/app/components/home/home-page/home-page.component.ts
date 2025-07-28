
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { ApiService } from '../../../services/api.service';
import { GameService } from '../../../services/game.service';
import { PlayerColor } from '../../../models/player.model';

@Component({
  selector: 'app-home',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss']
})
export class HomePageComponent {
  constructor(
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private apiService: ApiService,
    private gameService: GameService
  ) {}

  async showCreateSessionModal() {
    const alert = await this.alertController.create({
      header: 'Crea Sessione',
      message: 'Inserisci il tuo nome per iniziare una nuova partita',
      inputs: [
        {
          name: 'hostName',
          type: 'text',
          placeholder: 'Nome Host',
          attributes: {
            maxLength: 20
          }
        }
      ],
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Crea',
          handler: (data: any) => {
            if (data.hostName?.trim()) {
              this.createSession(data.hostName.trim());
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async showJoinSessionModal() {
    const alert = await this.alertController.create({
      header: 'Unisciti alla Sessione',
      inputs: [
        {
          name: 'sessionCode',
          type: 'text',
          placeholder: 'Codice Sessione (4 cifre)',
          attributes: {
            maxLength: 4,
            pattern: '[0-9]{4}'
          }
        },
        {
          name: 'playerName', 
          type: 'text',
          placeholder: 'Il tuo nome',
          attributes: {
            maxLength: 20
          }
        }
      ],
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Unisciti',
          handler: (data) => {
            if (data.sessionCode?.trim() && data.playerName?.trim()) {
              this.joinSession(data.sessionCode.trim(), data.playerName.trim());
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async createSession(hostName: string) {
    const loading = await this.loadingController.create({
      message: 'Creazione sessione...'
    });
    await loading.present();

    try {
      const session = await this.apiService.createSession(hostName).toPromise();
      if (session) {
        this.gameService.setCurrentSession(session);
        const hostPlayer = session.players.find(p => p.isHost);
        if (hostPlayer) {
          this.gameService.setCurrentPlayer(hostPlayer);
        }
        this.router.navigate(['/lobby', session.sessionCode]);
      }
    } catch (error) {
      console.error('Error creating session:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Errore nella creazione della sessione',
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      loading.dismiss();
    }
  }

  async joinSession(sessionCode: string, playerName: string) {
    const loading = await this.loadingController.create({
      message: 'Accesso alla sessione...'
    });
    await loading.present();

    try {
      // Show color selection
      const colorAlert = await this.alertController.create({
        header: 'Scegli il tuo colore',
        inputs: Object.values(PlayerColor).map(color => ({
          name: 'color',
          type: 'radio',
          label: this.getColorLabel(color),
          value: color
        })),
        buttons: [
          {
            text: 'Annulla',
            role: 'cancel'
          },
          {
            text: 'Conferma',
            handler: async (selectedColor) => {
              if (selectedColor) {
                try {
                  const session = await this.apiService.joinSession(sessionCode, playerName, selectedColor).toPromise();
                  if (session) {
                    this.gameService.setCurrentSession(session);
                    const currentPlayer = session.players.find(p => p.name === playerName);
                    if (currentPlayer) {
                      this.gameService.setCurrentPlayer(currentPlayer);
                    }
                    this.router.navigate(['/lobby', sessionCode]);
                  }
                } catch (error) {
                  console.error('Error joining session:', error);
                  const errorAlert = await this.alertController.create({
                    header: 'Errore',
                    message: 'Errore nell\'accesso alla sessione. Verifica il codice o il colore scelto.',
                    buttons: ['OK']
                  });
                  await errorAlert.present();
                }
              }
              loading.dismiss();
            }
          }
        ]
      });
      loading.dismiss();
      await colorAlert.present();
    } catch (error) {
      loading.dismiss();
      console.error('Error joining session:', error);
    }
  }

  getColorLabel(color: PlayerColor): string {
    const labels: { [key in PlayerColor]: string } = {
      [PlayerColor.RED]: '🔴 Rosso',
      [PlayerColor.BLUE]: '🔵 Blu', 
      [PlayerColor.GREEN]: '🟢 Verde',
      [PlayerColor.YELLOW]: '🟡 Giallo',
      [PlayerColor.PURPLE]: '🟣 Viola',
      [PlayerColor.ORANGE]: '🟠 Arancione',
      [PlayerColor.BLACK]: '⚫ Nero',
      [PlayerColor.WHITE]: '⚪ Bianco'
    };
    return labels[color];
  }

}
