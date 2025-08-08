export const environment = {
  production: false, // 🔧 Imposta a true per build di produzione

  // // 🔧 URLs corretti per Railway (senza porta)
  // api_url: 'https://monopoly-server-production.up.railway.app/',
  // ws_uri: 'https://monopoly-server-production.up.railway.app', // Senza /ws, verrà aggiunto nel service
  // // 🔧 Host senza porta per Railway
  // host: 'monopoly-server-production.up.railway.app',

  // 🔧 Configurazioni locali commentate per riferimento
  // Decommentare per sviluppo locale:


    api_url: 'http://93.42.111.232:8090/',
    ws_uri: 'http://93.42.111.232:8090',
    host: '93.42.111.232',

websocket: {
    // Configurazioni specifiche per WSS
    debug: false,
    reconnectDelay: 5000,
    heartbeatIncoming: 25000,
    heartbeatOutgoing: 25000,
    connectionTimeout: 10000,
    maxReconnectAttempts: 10
  },

};
