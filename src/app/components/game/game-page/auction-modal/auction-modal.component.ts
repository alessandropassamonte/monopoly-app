// src/app/components/auction/auction-modal/auction-modal.component.ts
// QUESTO È UN COMPONENTE COMPLETAMENTE NUOVO

import { Component, OnInit, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ModalController, AlertController } from '@ionic/angular';
import { Property } from '@/models/property.model';
import { Player } from '@/models/player.model';
import { GameService } from '@/services/game.service';

interface Bid {
  player: Player;
  amount: number;
  timestamp: Date;
}

@Component({
  selector: 'app-auction-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './auction-modal.component.html',
  styleUrls: ['./auction-modal.component.scss']
})
export class AuctionModalComponent implements OnInit {
  @Input() property!: Property;
  @Input() players: Player[] = [];

  bids: Bid[] = [];
  currentBid: number = 0;
  highestBidder: Player | null = null;
  selectedBidderId: number | null = null;
  newBidAmount: number = 0;

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    public gameService: GameService
  ) {}

  ngOnInit() {
    if (this.property) {
      this.currentBid = this.property.price;
      this.newBidAmount = this.getMinimumBid();
    }
  }

  getMinimumBid(): number {
    return this.currentBid + 10; // Incremento minimo di 10€
  }

  canPlaceBid(): boolean {
    if (!this.selectedBidderId || !this.newBidAmount) return false;
    
    const player = this.players.find(p => p.id === this.selectedBidderId);
    if (!player) return false;
    
    return this.newBidAmount >= this.getMinimumBid() && 
           this.newBidAmount <= player.balance;
  }

  async placeBid() {
    if (!this.canPlaceBid()) return;

    const player = this.players.find(p => p.id === this.selectedBidderId);
    if (!player) return;

    // Aggiungi l'offerta
    const newBid: Bid = {
      player,
      amount: this.newBidAmount,
      timestamp: new Date()
    };

    this.bids.unshift(newBid); // Aggiungi in cima
    this.currentBid = this.newBidAmount;
    this.highestBidder = player;
    
    // Reset form
    this.newBidAmount = this.getMinimumBid();
    this.selectedBidderId = null;

    // Feedback visivo
    const alert = await this.alertController.create({
      header: 'Offerta Registrata',
      message: `${player.name} ha offerto ${this.gameService.formatCurrency(newBid.amount)}`,
      buttons: ['OK'],
      cssClass: 'quick-alert'
    });
    await alert.present();
    
    // Auto-dismiss dopo 1.5 secondi
    setTimeout(() => {
      alert.dismiss();
    }, 1500);
  }

  async endAuction() {
    if (this.bids.length === 0) {
      const alert = await this.alertController.create({
        header: 'Impossibile Aggiudicare',
        message: 'Nessuna offerta ricevuta. L\'asta verrà annullata.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const confirmation = await this.alertController.create({
      header: 'Conferma Aggiudicazione',
      message: `Aggiudicare "${this.property.name}" a ${this.highestBidder?.name} per ${this.gameService.formatCurrency(this.currentBid)}?`,
      buttons: [
        {
          text: 'Annulla',
          role: 'cancel'
        },
        {
          text: 'Aggiudica',
          handler: () => {
            this.completeAuction();
          }
        }
      ]
    });
    await confirmation.present();
  }

  private async completeAuction() {
    if (!this.highestBidder) return;

    await this.modalController.dismiss({
      completed: true,
      winner: this.highestBidder,
      finalBid: this.currentBid,
      property: this.property
    });
  }

  async cancelAuction() {
    const confirmation = await this.alertController.create({
      header: 'Annulla Asta',
      message: 'Sei sicuro di voler annullare l\'asta?',
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Sì, Annulla',
          handler: () => {
            this.modalController.dismiss({
              completed: false,
              cancelled: true
            });
          }
        }
      ]
    });
    await confirmation.present();
  }
}