export const environment = {
  production: false, // 🔧 Imposta a true per build di produzione
  
  // // 🔧 URLs corretti per Railway (senza porta)
  api_url: 'https://monopoly-server-production.up.railway.app/',
  ws_uri: 'https://monopoly-server-production.up.railway.app', // Senza /ws, verrà aggiunto nel service
  
  // 🔧 Host senza porta per Railway
  host: 'monopoly-server-production.up.railway.app',
  
  // 🔧 Configurazioni locali commentate per riferimento
  // Decommentare per sviluppo locale:

  // api_url: 'http://localhost:8080/',
  // ws_uri: 'http://localhost:8080',
  // host: 'localhost',
 
};