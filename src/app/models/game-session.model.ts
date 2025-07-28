import { Player } from "./player.model";

export interface GameSession {
    id: number;
    sessionCode: string;
    hostName: string;
    status: GameStatus;
    players: Player[];
    createdAt: string;
  }
  
  export enum GameStatus {
    WAITING = 'WAITING',
    IN_PROGRESS = 'IN_PROGRESS', 
    FINISHED = 'FINISHED'
  }