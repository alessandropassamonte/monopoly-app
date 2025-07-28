import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, take } from 'rxjs/operators';
import { GameService } from '../services/game.service';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GameGuard implements CanActivate {

  constructor(
    private gameService: GameService,
    private apiService: ApiService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {
    
    const sessionCode = route.paramMap.get('sessionCode');
    
    if (!sessionCode) {
      this.redirectToHome('Codice sessione mancante');
      return false;
    }

    try {
      // Usa firstValueFrom con take(1) per evitare subscription infinite
      const currentSession = await firstValueFrom(
        this.gameService.getCurrentSession().pipe(take(1))
      );
      const currentPlayer = await firstValueFrom(
        this.gameService.getCurrentPlayer().pipe(take(1))
      );

      // Se abbiamo sessione e player che corrispondono alla route
      if (currentSession && currentPlayer && currentSession.sessionCode === sessionCode) {
        const playerInSession = currentSession.players.find(p => p.id === currentPlayer.id);
        if (playerInSession) {
          return true;
        }
      }

      // Altrimenti prova a caricare la sessione dal server
      const session = await firstValueFrom(this.apiService.getSession(sessionCode));
      
      if (!session) {
        this.redirectToHome('Sessione non trovata');
        return false;
      }

      // Verifica se il current player è parte di questa sessione
      if (currentPlayer) {
        const playerInSession = session.players.find(p => p.id === currentPlayer.id);
        if (playerInSession) {
          this.gameService.setCurrentSession(session);
          return true;
        }
      }
      
      // Player non fa parte di questa sessione
      this.redirectToHome('Non fai parte di questa sessione');
      return false;
      
    } catch (error) {
      console.error('Error in game guard:', error);
      this.redirectToHome('Errore nel caricamento della sessione');
      return false;
    }
  }

  private redirectToHome(message: string) {
    this.notificationService.showErrorToast(message);
    this.router.navigate(['/home']);
  }
}

@Injectable({
  providedIn: 'root'
})
export class LobbyGuard implements CanActivate {
  
  constructor(
    private gameService: GameService,
    private apiService: ApiService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {
    
    const sessionCode = route.paramMap.get('sessionCode');
    
    if (!sessionCode) {
      this.redirectToHome('Codice sessione mancante');
      return false;
    }

    try {
      const session = await firstValueFrom(this.apiService.getSession(sessionCode));
      
      if (!session) {
        this.redirectToHome('Sessione non trovata');
        return false;
      }

      // Aggiorna sempre la sessione corrente
      this.gameService.setCurrentSession(session);
      
      // Se il gioco è in corso, reindirizza alla pagina di gioco
      if (session.status === 'IN_PROGRESS') {
        console.log('Game already in progress, redirecting to game page');
        this.router.navigate(['/game', sessionCode]);
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('Error in lobby guard:', error);
      this.redirectToHome('Errore nel caricamento della sessione');
      return false;
    }
  }

  private redirectToHome(message: string) {
    this.notificationService.showErrorToast(message);
    this.router.navigate(['/home']);
  }
}