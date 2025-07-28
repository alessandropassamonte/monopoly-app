export interface Property {
    id: number;
    name: string;
    price: number;
    rent: number;
    colorGroup: PropertyColor;
    type: PropertyType;
  }
  
  export interface PropertyOwnership {
    id: number;
    propertyId: number;
    propertyName: string;
    propertyPrice: number;
    propertyType: PropertyType;
    colorGroup: PropertyColor;
    houses: number;
    hasHotel: boolean;
    isMortgaged: boolean;
    currentRent: number;
    purchasedAt: string;
  }
  
  export enum PropertyColor {
    BROWN = 'BROWN',
    LIGHT_BLUE = 'LIGHT_BLUE',
    PINK = 'PINK',
    ORANGE = 'ORANGE', 
    RED = 'RED',
    YELLOW = 'YELLOW',
    GREEN = 'GREEN',
    DARK_BLUE = 'DARK_BLUE'
  }
  
  export enum PropertyType {
    STREET = 'STREET',
    RAILROAD = 'RAILROAD',
    UTILITY = 'UTILITY',
    SPECIAL = 'SPECIAL'
  }
  