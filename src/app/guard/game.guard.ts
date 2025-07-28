import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { GameService } from '../services/game.service';
import { ApiService } from '../services/api.service';
import { NotificationService } from '../services/notification.service';

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

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    const sessionCode = route.paramMap.get('sessionCode');
    
    if (!sessionCode) {
      this.redirectToHome('Codice sessione mancante');
      return false;
    }

    // Check if we have current session and player data
    return new Observable<boolean>(observer => {
      this.gameService.getCurrentSession().subscribe(currentSession => {
        this.gameService.getCurrentPlayer().subscribe(currentPlayer => {
          
          // If we have session and player data, verify they match the route
          if (currentSession && currentPlayer) {
            if (currentSession.sessionCode === sessionCode) {
              observer.next(true);
              observer.complete();
              return;
            }
          }

          // Otherwise, try to load session from API
          this.apiService.getSession(sessionCode).pipe(
            map(session => {
              if (session) {
                // Session exists, but we need to check if current user is part of it
                if (currentPlayer) {
                  const playerInSession = session.players.find(p => p.id === currentPlayer.id);
                  if (playerInSession) {
                    this.gameService.setCurrentSession(session);
                    return true;
                  }
                }
                
                // User not part of this session, redirect to home
                this.redirectToHome('Non fai parte di questa sessione');
                return false;
              } else {
                this.redirectToHome('Sessione non trovata');
                return false;
              }
            }),
            catchError(error => {
              console.error('Error loading session:', error);
              this.redirectToHome('Errore nel caricamento della sessione');
              return of(false);
            })
          ).subscribe(result => {
            observer.next(result);
            observer.complete();
          });
        });
      });
    });
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

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    const sessionCode = route.paramMap.get('sessionCode');
    
    if (!sessionCode) {
      this.redirectToHome('Codice sessione mancante');
      return false;
    }

    return this.apiService.getSession(sessionCode).pipe(
      map(session => {
        if (session) {
          this.gameService.setCurrentSession(session);
          
          // If game is in progress, redirect to game page
          if (session.status === 'IN_PROGRESS') {
            this.router.navigate(['/game', sessionCode]);
            return false;
          }
          
          return true;
        } else {
          this.redirectToHome('Sessione non trovata');
          return false;
        }
      }),
      catchError(error => {
        console.error('Error in lobby guard:', error);
        this.redirectToHome('Errore nel caricamento della sessione');
        return of(false);
      })
    );
  }

  private redirectToHome(message: string) {
    this.notificationService.showErrorToast(message);
    this.router.navigate(['/home']);
  }
}