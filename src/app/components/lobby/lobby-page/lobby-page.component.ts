import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { firstValueFrom, take } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { GameService } from '../../../services/game.service';
import { WebSocketService } from '../../../services/websocket.service';
import { GameSession } from '../../../models/game-session.model';
import { Player, PlayerColor } from '../../../models/player.model';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby-page.component.html',
  styleUrls: ['./lobby-page.component.scss']
})
export class LobbyPageComponent implements OnInit, OnDestroy {
  sessionCode: string = '';
  currentSession: GameSession | null = null;
  currentPlayer: Player | null = null;
  isHost = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private apiService: ApiService,
    public gameService: GameService,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit() {
    this.sessionCode = this.route.snapshot.paramMap.get('sessionCode') || '';
    console.log('=== LOBBY INIT ===');
    console.log('Session code from route:', this.sessionCode);
    
    if (this.sessionCode) {
      this.initializeLobby();
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.webSocketService.disconnect();
  }

  async initializeLobby() {
    console.log('=== INITIALIZING LOBBY ===');
    
    // Prima sottoscrivi ai servizi
    this.subscribeToGameService();
    
    // Poi carica/verifica la sessione (SENZA subscription annidate)
    await this.loadAndVerifySession();
    
    // Setup WebSocket
    this.setupWebSocket();
    
    // Debug finale
    this.debugCurrentState();
  }

  subscribeToGameService() {
    // Sottoscrivi ai cambiamenti del current player
    this.subscriptions.push(
      this.gameService.getCurrentPlayer().subscribe((player: Player | null) => {
        console.log('=== PLAYER CHANGE ===');
        console.log('New current player:', player);
        console.log('Player isHost:', player?.host);
        
        this.currentPlayer = player;
        this.isHost = player?.host || false;
        
        console.log('Component isHost set to:', this.isHost);
      })
    );

    // Sottoscrivi ai cambiamenti della sessione
    this.subscriptions.push(
      this.gameService.getCurrentSession().subscribe((session: GameSession | null) => {
        console.log('=== SESSION CHANGE ===');
        console.log('New current session:', session);
        this.currentSession = session;
      })
    );
  }

  async loadAndVerifySession() {
    console.log('=== LOADING SESSION ===');
    
    try {
      // Carica sempre la sessione dal server per avere dati freschi
      console.log('Loading session from API:', this.sessionCode);
      const session = await firstValueFrom(this.apiService.getSession(this.sessionCode));
      
      if (!session) {
        console.error('Session not found on server');
        this.goBack();
        return;
      }
      
      console.log('Session loaded from API:', session);
      console.log('Session players:', session.players);
      
      // Aggiorna la sessione nel service
      this.gameService.setCurrentSession(session);
      
      // CORREZIONE: Verifica player con take(1) per evitare loop
      const currentPlayer = await firstValueFrom(
        this.gameService.getCurrentPlayer().pipe(take(1))
      );
      
      console.log('Current player from service:', currentPlayer);
      
      if (currentPlayer) {
        // Verifica che il player esista ancora nella sessione aggiornata
        const playerStillInSession = session.players.find(p => p.id === currentPlayer.id);
        
        if (playerStillInSession) {
          console.log('Existing player still valid, updating with fresh data:', playerStillInSession);
          
          // Solo aggiorna se i dati sono effettivamente cambiati
          if (this.playerDataChanged(currentPlayer, playerStillInSession)) {
            console.log('Player data changed, updating...');
            this.gameService.setCurrentPlayer(playerStillInSession);
          } else {
            console.log('Player data unchanged');
          }
        } else {
          console.warn('Existing player no longer in session, clearing');
          this.gameService.setCurrentPlayer(null);
          this.showPlayerSelectionIfNeeded(session);
        }
      } else {
        console.log('No existing player, checking if auto-detection is possible');
        this.showPlayerSelectionIfNeeded(session);
      }
      
    } catch (error) {
      console.error('Error loading session:', error);
      this.goBack();
    }
  }

  // Utility per verificare se i dati del player sono cambiati
  private playerDataChanged(oldPlayer: Player, newPlayer: Player): boolean {
    return oldPlayer.balance !== newPlayer.balance ||
           oldPlayer.propertiesCount !== newPlayer.propertiesCount ||
           oldPlayer.host !== newPlayer.host;
  }

  private async showPlayerSelectionIfNeeded(session: GameSession) {
    // Se c'è solo un player (creazione sessione), selezionalo automaticamente
    if (session.players.length === 1) {
      const singlePlayer = session.players[0];
      console.log('Auto-selecting single player:', singlePlayer);
      this.gameService.setCurrentPlayer(singlePlayer);
      return;
    }
    
    // Altrimenti mostra selezione manuale
    console.log('Multiple players found, manual selection available via UI');
  }

  setupWebSocket() {
    if (!this.sessionCode) return;
    
    console.log('=== SETTING UP WEBSOCKET ===');
    this.webSocketService.connect(this.sessionCode);
    
    this.subscriptions.push(
      this.webSocketService.getMessages().subscribe((message) => {
        if (message) {
          console.log('=== WEBSOCKET MESSAGE ===', message);
          this.handleWebSocketMessage(message);
        }
      })
    );
  }

  handleWebSocketMessage(message: any) {
    console.log('WebSocket message received:', message);
    
    switch (message.type) {
      case 'PLAYER_JOINED':
        console.log('Player joined, refreshing session');
        this.refreshSessionData();
        break;
      case 'GAME_STARTED':
        console.log('Game started, refreshing and potentially navigating');
        this.refreshSessionData();
        setTimeout(() => {
          if (this.currentSession?.status === 'IN_PROGRESS') {
            this.goToGame();
          }
        }, 1000);
        break;
      case 'GAME_ENDED':
        this.goBack();
        break;
    }
  }

  // Metodo separato per refresh senza loop
  private async refreshSessionData() {
    try {
      const session = await firstValueFrom(this.apiService.getSession(this.sessionCode));
      if (session) {
        console.log('Session refreshed via WebSocket');
        this.gameService.setCurrentSession(session);
        
        // Aggiorna anche il current player se necessario
        const currentPlayer = this.currentPlayer;
        if (currentPlayer) {
          const updatedPlayer = session.players.find(p => p.id === currentPlayer.id);
          if (updatedPlayer && this.playerDataChanged(currentPlayer, updatedPlayer)) {
            this.gameService.setCurrentPlayer(updatedPlayer);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing session data:', error);
    }
  }

  async startGame() {
    console.log('=== START GAME ATTEMPT ===');
    console.log('Current player:', this.currentPlayer);
    console.log('Is host:', this.isHost);
    
    if (!this.currentPlayer) {
      console.error('Cannot start game - no current player');
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Impossibile avviare la partita: giocatore non identificato',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    if (!this.isHost) {
      console.error('Cannot start game - not host');
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Solo l\'host può avviare la partita',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Avvio partita...'
    });
    await loading.present();

    try {
      console.log('Starting game with player ID:', this.currentPlayer.id);
      await firstValueFrom(this.apiService.startGame(this.sessionCode, this.currentPlayer.id));
      console.log('Game start request sent successfully');
    } catch (error) {
      console.error('Error starting game:', error);
      const alert = await this.alertController.create({
        header: 'Errore',
        message: 'Errore nell\'avvio della partita',
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      loading.dismiss();
    }
  }

  async endSession() {
    if (!this.currentPlayer || !this.isHost) {
      console.error('Cannot end session - not authorized');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Termina Sessione',
      message: 'Sei sicuro di voler terminare la sessione?',
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Termina',
          handler: async () => {
            if (this.currentPlayer) {
              try {
                await firstValueFrom(this.apiService.endSession(this.sessionCode, this.currentPlayer.id));
                this.gameService.clearStorage();
                this.goBack();
              } catch (error) {
                console.error('Error ending session:', error);
              }
            }
          }
        }
      ]
    });
    await alert.present();
  }

  goToGame() {
    this.router.navigate(['/game', this.sessionCode]);
  }

  goBack() {
    this.gameService.clearStorage();
    this.router.navigate(['/home']);
  }

  // Metodo per ottenere il colore del giocatore
  getPlayerColor(color: PlayerColor): string {
    const colorMap: { [key in PlayerColor]: string } = {
      [PlayerColor.RED]: '#e53e3e',
      [PlayerColor.BLUE]: '#3182ce',
      [PlayerColor.GREEN]: '#38a169',
      [PlayerColor.YELLOW]: '#d69e2e',
      [PlayerColor.PURPLE]: '#805ad5',
      [PlayerColor.ORANGE]: '#ff8c00',
      [PlayerColor.BLACK]: '#2d3748',
      [PlayerColor.WHITE]: '#f7fafc'
    };
    return colorMap[color] || '#ccc';
  }

  // Metodo di emergenza per selezionare manualmente il player (per debug/testing)
  setCurrentPlayer(player: Player): void {
    console.log('=== MANUAL PLAYER SELECTION ===');
    console.log('Manually setting current player to:', player);
    console.log('Player isHost flag:', player.host);
    
    this.gameService.setCurrentPlayer(player);
    
    // Salva anche nel localStorage per persistenza
    localStorage.setItem('monopoly_manual_selection', 'true');
    localStorage.setItem('monopoly_selected_player_id', player.id.toString());
  }

  // Debug method
  debugCurrentState(): void {
    console.log('=== CURRENT STATE DEBUG ===');
    console.log('Session code:', this.sessionCode);
    console.log('Current session:', this.currentSession);
    console.log('Current player:', this.currentPlayer);
    console.log('Is host:', this.isHost);
    console.log('Players in session:', this.currentSession?.players);
    
    // Debug localStorage
    console.log('=== LOCALSTORAGE DEBUG ===');
    console.log('monopoly_current_player:', localStorage.getItem('monopoly_current_player'));
    console.log('monopoly_player_id:', localStorage.getItem('monopoly_player_id'));
    console.log('monopoly_is_host:', localStorage.getItem('monopoly_is_host'));
    console.log('monopoly_debug_host_name:', localStorage.getItem('monopoly_debug_host_name'));
  }
}