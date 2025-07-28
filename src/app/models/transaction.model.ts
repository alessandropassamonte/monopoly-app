export interface Transaction {
    id: number;
    type: TransactionType;
    amount: number;
    fromPlayerName: string;
    toPlayerName: string;
    description: string;
    timestamp: string;
  }
  
  export enum TransactionType {
    PLAYER_TO_PLAYER = 'PLAYER_TO_PLAYER',
    PLAYER_TO_BANK = 'PLAYER_TO_BANK',
    BANK_TO_PLAYER = 'BANK_TO_PLAYER',
    PROPERTY_PURCHASE = 'PROPERTY_PURCHASE',
    RENT_PAYMENT = 'RENT_PAYMENT',
    TAX_PAYMENT = 'TAX_PAYMENT',
    SALARY = 'SALARY'
  }