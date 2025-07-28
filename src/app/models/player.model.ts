export interface Player {
    id: number;
    name: string;
    balance: number;
    color: PlayerColor;
    isHost: boolean;
    propertiesCount: number;
  }
  
  export enum PlayerColor {
    RED = 'RED',
    BLUE = 'BLUE', 
    GREEN = 'GREEN',
    YELLOW = 'YELLOW',
    PURPLE = 'PURPLE',
    ORANGE = 'ORANGE',
    BLACK = 'BLACK',
    WHITE = 'WHITE'
  }