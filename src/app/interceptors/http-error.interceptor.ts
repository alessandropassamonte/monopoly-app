import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { LoadingController } from '@ionic/angular';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  private activeRequests = 0;
  private loading: HTMLIonLoadingElement | null = null;

  constructor(
    private loadingController: LoadingController,
    private notificationService: NotificationService
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Show loading for non-GET requests or specific endpoints
    const showLoading = this.shouldShowLoading(request);
    
    if (showLoading) {
      this.showLoading();
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        this.handleError(error);
        return throwError(error);
      }),
      finalize(() => {
        if (showLoading) {
          this.hideLoading();
        }
      })
    );
  }

  private shouldShowLoading(request: HttpRequest<any>): boolean {
    // Show loading for non-GET requests or specific GET requests
    if (request.method !== 'GET') {
      return true;
    }

    // Show loading for specific GET endpoints that might take time
    const loadingEndpoints = [
      '/properties/player/',
      '/transactions/',
      '/sessions/'
    ];

    return loadingEndpoints.some(endpoint => request.url.includes(endpoint));
  }

  private async showLoading() {
    this.activeRequests++;
    
    if (this.activeRequests === 1 && !this.loading) {
      this.loading = await this.loadingController.create({
        message: 'Caricamento...',
        spinner: 'crescent',
        duration: 10000 // Max 10 seconds
      });
      await this.loading.present();
    }
  }

  private async hideLoading() {
    this.activeRequests--;
    
    if (this.activeRequests <= 0 && this.loading) {
      await this.loading.dismiss();
      this.loading = null;
      this.activeRequests = 0;
    }
  }

  private handleError(error: HttpErrorResponse) {
    console.error('HTTP Error:', error);

    let errorMessage = 'Si è verificato un errore di connessione';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      switch (error.status) {
        case 400:
          errorMessage = error.error?.message || 'Richiesta non valida';
          break;
        case 401:
          errorMessage = 'Non autorizzato';
          break;
        case 403:
          errorMessage = 'Accesso negato';
          break;
        case 404:
          errorMessage = 'Risorsa non trovata';
          break;
        case 409:
          errorMessage = error.error?.message || 'Conflitto nei dati';
          break;
        case 500:
          errorMessage = 'Errore interno del server';
          break;
        case 0:
          errorMessage = 'Impossibile connettere al server';
          break;
        default:
          errorMessage = error.error?.message || `Errore ${error.status}`;
      }
    }

    // Don't show error toast for certain status codes that are handled by components
    const silentErrors = [401, 403, 404];
    if (!silentErrors.includes(error.status)) {
      this.notificationService.showErrorToast(errorMessage);
    }
  }
}

@Injectable()
export class HttpLoadingInterceptor implements HttpInterceptor {
  constructor(private loadingController: LoadingController) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Add custom headers if needed
    const modifiedRequest = request.clone({
      setHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    return next.handle(modifiedRequest);
  }
}