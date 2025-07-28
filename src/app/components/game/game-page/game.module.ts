import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { GamePageComponent } from './game-page.component';
import { GamePageRoutingModule } from './game-routing.module';
import { PropertiesModalComponent } from '../../properties/properties-modal/properties-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GamePageRoutingModule,
    PropertiesModalComponent
  ],
  declarations: [GamePageComponent]
})
export class GamePageModule {}