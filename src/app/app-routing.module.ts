import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./components/home/home-page/home.module').then(m => m.HomePageModule)
  },
  {
    path: 'lobby/:sessionCode',
    loadChildren: () => import('./components/lobby/lobby-page/lobby.module').then(m => m.LobbyPageModule)
  },
  {
    path: 'game/:sessionCode',
    loadChildren: () => import('./components/game/game-page/game.module').then(m => m.GamePageModule)
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