import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { GameGuard, LobbyGuard } from './guard/game.guard';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./components/home/home-page/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'lobby/:sessionCode',
    loadChildren: () => import('./components/lobby/lobby-page/lobby.module').then( m => m.LobbyPageModule),
    canActivate: [LobbyGuard]
  },
  {
    path: 'game/:sessionCode',
    loadChildren: () => import('./components/game/game-page/game.module').then( m => m.GamePageModule),
    canActivate: [GameGuard]
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
      enableTracing: false // Set to true for debugging
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}