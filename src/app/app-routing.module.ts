import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { HomePageModule } from './components/home/home-page/home.module';
import { LobbyPageModule } from './components/lobby/lobby-page/lobby.module';
import { GamePageModule } from './components/game/game-page/game.module';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => HomePageModule
  },
  {
    path: 'lobby/:sessionCode',
    loadChildren: () => LobbyPageModule
  },
  {
    path: 'game/:sessionCode',
    loadChildren: () => GamePageModule
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { 
      preloadingStrategy: PreloadAllModules,
      enableTracing: false
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}