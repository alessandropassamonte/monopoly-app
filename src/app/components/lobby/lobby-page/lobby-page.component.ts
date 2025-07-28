
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { GameService } from '../../../services/game.service';
import { WebSocketService } from '../../../services/websocket.service';
import { GameSession } from '../../../models/game-session.model';
import { Player } from '../../../models/player.model';


@Component({
  selector: 'app-lobby',
  templateUrl: './lobby-page.component.html',
  styleUrls: ['./lobby-page.component.scss']
})
export class LobbyPageComponent implements OnInit, OnDestroy {
  sessionCode!: string;
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
    this.sessionCode = this.route.snapshot.paramMap.get('sessionCode')!;
    this.loadSession();
    this.setupWebSocket();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.webSocketService.disconnect();
  }

  async loadSession() {
    try {
      const session = await this.apiService.getSession(this.sessionCode).toPromise();
      if (session) {
        this.currentSession = session;
        this.gameService.setCurrentSession(session);

        // Determine current player and host status
        this.subscriptions.push(
          this.gameService.getCurrentPlayer().subscribe((player : any) => {
            this.currentPlayer = player;
            this.isHost = player?.isHost || false;
          })
        );
      }
    } catch (error) {
      console.error('Error loading session:', error);
      this.goBack();
    }
  }

  setupWebSocket() {
    this.webSocketService.connect(this.sessionCode);
    
    this.subscriptions.push(
      this.webSocketService.getMessages().subscribe((message : any) => {
        if (message) {
          this.handleWebSocketMessage(message);
        }
      })
    );
  }

  handleWebSocketMessage(message: any) {
    switch (message.type) {
      case 'PLAYER_JOINED':
        this.loadSession(); // Refresh session data
        break;
      case 'GAME_STARTED':
        this.loadSession();
        break;
      case 'GAME_ENDED':
        this.goBack();
        break;
    }
  }

  async startGame() {
    if (!this.currentPlayer || !this.isHost) return;

    const loading = await this.loadingController.create({
      message: 'Avvio partita...'
    });
    await loading.present();

    try {
      await this.apiService.startGame(this.sessionCode, this.currentPlayer.id).toPromise();
      // WebSocket will handle the update
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
    if (!this.currentPlayer || !this.isHost) return;

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
            try {
              await this.apiService.endSession(this.sessionCode, this.currentPlayer!.id).toPromise();
              this.goBack();
            } catch (error) {
              console.error('Error ending session:', error);
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
    this.router.navigate(['/home']);
  }
}

