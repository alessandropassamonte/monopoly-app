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
  RENT_PAYMENT = 'RENT_PAYMENT', // NUOVO - per distinguere dagli altri trasferimenti
  TAX_PAYMENT = 'TAX_PAYMENT',
  SALARY = 'SALARY',
  BUILDING_SALE = 'BUILDING_SALE', // NUOVO - vendita case/hotel
  PROPERTY_TRANSFER = 'PROPERTY_TRANSFER', // NUOVO - trasferimenti tra giocatori
  LIQUIDATION = 'LIQUIDATION', // NUOVO - liquidazioni forzate
  AUCTION_PURCHASE = 'AUCTION_PURCHASE' // NUOVO - acquisti tramite asta
}