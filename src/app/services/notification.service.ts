import { Injectable } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor(
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  async showToast(message: string, color: 'success' | 'warning' | 'danger' | 'primary' = 'primary', duration: number = 2000) {
    const toast = await this.toastController.create({
      message,
      duration,
      color,
      position: 'top',
      buttons: [
        {
          text: 'Chiudi',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  async showSuccessToast(message: string) {
    await this.showToast(message, 'success');
  }

  async showErrorToast(message: string) {
    await this.showToast(message, 'danger', 3000);
  }

  async showWarningToast(message: string) {
    await this.showToast(message, 'warning');
  }

  async showConfirmAlert(
    header: string, 
    message: string, 
    confirmText: string = 'Conferma',
    cancelText: string = 'Annulla'
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header,
        message,
        buttons: [
          {
            text: cancelText,
            role: 'cancel',
            handler: () => resolve(false)
          },
          {
            text: confirmText,
            handler: () => resolve(true)
          }
        ]
      });
      await alert.present();
    });
  }

  async showInfoAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async showActionSheet(
    header: string, 
    buttons: Array<{
      text: string;
      icon?: string;
      handler?: () => void;
      role?: string;
    }>
  ) {
    const actionSheet = await this.alertController.create({
      header,
      buttons: buttons.map(button => ({
        text: button.text,
        icon: button.icon,
        handler: button.handler,
        role: button.role
      }))
    });
    await actionSheet.present();
  }

  // Utility method for handling API errors
  handleApiError(error: any, defaultMessage: string = 'Si è verificato un errore') {
    console.error('API Error:', error);
    
    let message = defaultMessage;
    
    if (error?.error?.message) {
      message = error.error.message;
    } else if (error?.message) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }

    this.showErrorToast(message);
  }

  // Show transaction notification
  async showTransactionNotification(
    type: 'transfer' | 'payment' | 'purchase',
    fromPlayer: string,
    toPlayer: string,
    amount: number,
    description?: string
  ) {
    let message = '';
    let color: 'success' | 'warning' | 'primary' = 'primary';

    switch (type) {
      case 'transfer':
        message = `💰 ${fromPlayer} → ${toPlayer}: €${amount}`;
        color = 'primary';
        break;
      case 'payment':
        if (fromPlayer === 'Banca') {
          message = `💳 ${toPlayer} riceve €${amount} dalla Banca`;
          color = 'success';
        } else {
          message = `💸 ${fromPlayer} paga €${amount} alla Banca`;
          color = 'warning';
        }
        break;
      case 'purchase':
        message = `🏠 ${toPlayer} acquista: ${description}`;
        color = 'success';
        break;
    }

    await this.showToast(message, color, 3000);
  }

  // Show game event notification
  async showGameEventNotification(event: string, player?: string) {
    let message = '';
    let color: 'success' | 'warning' | 'primary' = 'primary';

    switch (event) {
      case 'player_joined':
        message = `🎯 ${player} si è unito alla partita`;
        color = 'success';
        break;
      case 'game_started':
        message = `🎮 La partita è iniziata!`;
        color = 'success';
        break;
      case 'game_ended':
        message = `🏁 La partita è terminata`;
        color = 'warning';
        break;
      case 'player_bankrupt':
        message = `💔 ${player} è in bancarotta`;
        color = 'warning';
        break;
      default:
        message = event;
    }

    await this.showToast(message, color, 3000);
  }
}