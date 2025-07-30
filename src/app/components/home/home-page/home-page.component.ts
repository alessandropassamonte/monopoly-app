import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { GameService } from '../../../services/game.service';
import { PlayerColor } from '../../../models/player.model';

@Component({
  selector: 'app-home',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss']
})
export class HomePageComponent implements OnInit {
  
  constructor(
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private apiService: ApiService,
    private gameService: GameService
  ) {}

  ngOnInit() {
    // Pulisci i dati della sessione precedente quando torni alla home
    this.gameService.clearStorage();
  }

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
    console.log('=== CREATING NEW SESSION ===');
    console.log('Host name:', hostName);
    
    // IMPORTANTE: Forza reset completo prima di creare nuova sessione
    this.gameService.clearStorage();
    
    // Piccolo delay per assicurarsi che il clear sia completato
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const session = await firstValueFrom(this.apiService.createSession(hostName));
    
    if (session) {
      console.log('✅ Session created successfully:', session);
      console.log('Session players:', session.players);
      
      // Imposta la nuova sessione
      this.gameService.setCurrentSession(session);
      
      // Trova e imposta l'host player
      let hostPlayer = session.players.find(p => p.host === true);
      
      // Fallback: se non trova l'host con flag, cerca per nome
      if (!hostPlayer) {
        hostPlayer = session.players.find(p => p.name === hostName);
        console.warn('Host found by name instead of host flag:', hostPlayer);
      }
      
      // Fallback finale: prendi il primo player
      if (!hostPlayer && session.players.length > 0) {
        hostPlayer = session.players[0];
        console.warn('Using first player as fallback host:', hostPlayer);
      }
      
      if (hostPlayer) {
        console.log('✅ Setting host player:', hostPlayer);
        console.log('Host player isHost property:', hostPlayer.host);
        
        // Salva nel localStorage per debug e persistenza
        localStorage.setItem('monopoly_debug_host_name', hostName);
        localStorage.setItem('monopoly_debug_session_players', JSON.stringify(session.players));
        
        this.gameService.setCurrentPlayer(hostPlayer);
        
        // Naviga alla lobby (WebSocket verrà gestito dalla lobby)
        this.router.navigate(['/lobby', session.sessionCode]);
      } else {
        throw new Error('Impossibile identificare il player host nella sessione creata');
      }
    } else {
      throw new Error('Session creation returned null');
    }
  } catch (error) {
    console.error('❌ Error creating session:', error);
    const alert = await this.alertController.create({
      header: 'Errore',
      message: 'Errore nella creazione della sessione. Riprova.',
      buttons: ['OK']
    });
    await alert.present();
  } finally {
    loading.dismiss();
  }
}

  async joinSession(sessionCode: string, playerName: string) {
    const loading = await this.loadingController.create({
      message: 'Verifica sessione...'
    });
    await loading.present();

    try {
      // Prima verifica che la sessione esista
      const existingSession = await firstValueFrom(this.apiService.getSession(sessionCode));
      if (!existingSession) {
        throw new Error('Sessione non trovata');
      }

      // Verifica che il nome non sia già preso
      const nameExists = existingSession.players.some(p => p.name.toLowerCase() === playerName.toLowerCase());
      if (nameExists) {
        throw new Error('Nome già utilizzato in questa sessione');
      }

      loading.dismiss();

      // Mostra selezione colore
      const colorAlert = await this.alertController.create({
        header: 'Scegli il tuo colore',
        message: `Unisciti alla sessione ${sessionCode} come ${playerName}`,
        inputs: this.getAvailableColors(existingSession).map(color => ({
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
                await this.executeJoinSession(sessionCode, playerName, selectedColor);
              }
            }
          }
        ]
      });
      await colorAlert.present();

    } catch (error) {
      loading.dismiss();
      console.error('Error joining session:', error);
      
      let errorMessage = 'Errore nell\'accesso alla sessione';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      const errorAlert = await this.alertController.create({
        header: 'Errore',
        message: errorMessage,
        buttons: ['OK']
      });
      await errorAlert.present();
    }
  }

  private async executeJoinSession(sessionCode: string, playerName: string, selectedColor: PlayerColor) {
    const loading = await this.loadingController.create({
      message: 'Accesso alla sessione...'
    });
    await loading.present();

    try {
      console.log('Joining session:', sessionCode, 'as:', playerName, 'color:', selectedColor);
      
      const session = await firstValueFrom(this.apiService.joinSession(sessionCode, playerName, selectedColor));
      
      if (session) {
        console.log('Successfully joined session:', session);
        console.log('Session players after join:', session.players);
        
        // Salva la sessione
        this.gameService.setCurrentSession(session);
        
        // CORREZIONE: Trova il current player con più precisione
        let currentPlayer = session.players.find(p => 
          p.name === playerName && p.color === selectedColor
        );
        
        // Fallback: cerca solo per nome
        if (!currentPlayer) {
          currentPlayer = session.players.find(p => p.name === playerName);
          console.warn('Player found by name only:', currentPlayer);
        }
        
        if (currentPlayer) {
          console.log('Current player found and set:', currentPlayer);
          console.log('Current player isHost property:', currentPlayer.host);
          
          // Salva nel localStorage per debug
          localStorage.setItem('monopoly_debug_join_name', playerName);
          localStorage.setItem('monopoly_debug_join_color', selectedColor);
          localStorage.setItem('monopoly_debug_session_players_join', JSON.stringify(session.players));
          
          this.gameService.setCurrentPlayer(currentPlayer);
          
          // Naviga alla lobby
          this.router.navigate(['/lobby', sessionCode]);
        } else {
          throw new Error(`Impossibile trovare il player ${playerName} nella sessione dopo il join`);
        }
      } else {
        throw new Error('Join session returned null');
      }
    } catch (error) {
      console.error('Error executing join session:', error);
      
      let errorMessage = 'Errore nell\'accesso alla sessione';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      const errorAlert = await this.alertController.create({
        header: 'Errore',
        message: errorMessage,
        buttons: ['OK']
      });
      await errorAlert.present();
    } finally {
      loading.dismiss();
    }
  }

  private getAvailableColors(session: any): PlayerColor[] {
    const usedColors = session.players.map((p: any) => p.color);
    return Object.values(PlayerColor).filter(color => !usedColors.includes(color));
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