export interface WebSocketMessage {
    type: string;
    sessionCode: string;
    data: any;
    timestamp: string;
  }