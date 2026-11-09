/* =========================================================
   CONFIGURACIÓN — Panel de ziko.pro
   Mientras apiKey diga "PEGA_AQUI", el panel funciona en MODO DEMO.
   ========================================================= */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDSsyN8Jiv6gcOoXjI7ikel-KGtl7zG4Aw",
  authDomain: "zikopro.firebaseapp.com",
  projectId: "zikopro",
  storageBucket: "zikopro.firebasestorage.app",
  messagingSenderId: "680311424289",
  appId: "1:680311424289:web:01a4f9b8f4b28d6f4dea60"
};

window.APP = {
  web: "https://ziko.pro",   // dirección de tu web (para los enlaces de demo en WhatsApp y las capturas)

  /* EQUIPO Y PERMISOS — cada persona entra con su correo.
     "Administración" → todo · "Ventas" → demos, pedidos, clientes, caja y mensajes.
     Usa los MISMOS correos en firestore.rules. */
  equipo: [
    { email: "admin@ziko.pro", nombre: "Administración", rol: "Administración" },
    { email: "ventas@ziko.pro", nombre: "Ventas", rol: "Ventas" }
  ]
};
