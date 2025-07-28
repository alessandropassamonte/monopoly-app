// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';      // ← deve esserci
import { AppRoutingModule } from './app-routing.module';
import { IonicModule } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';


@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    RouterModule,                 // ← deve comparire qui
    AppRoutingModule,
    IonicModule.forRoot(),
    HttpClientModule,
    /* …altri moduli… */
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}