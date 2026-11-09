/* =========================================================
   ziko.pro — Datos de ejemplo y ajustes iniciales
   (este archivo es IGUAL en la web y en el panel)
   Lo que cambies en el PANEL reemplaza estos valores.
   ========================================================= */
window.ZK_AJUSTES = {
  nombre: "ziko.pro", razon: "ziko.pro", ruc: "",
  whatsapp: "51999999999", telefono: "+51 999 999 999", email: "contacto@ziko.pro",
  direccion: "Lima, Perú", horario: "Lun a Sáb: 9:00 a.m. – 8:00 p.m.",
  redes: { facebook: "", instagram: "", tiktok: "", youtube: "" },
  tipoCambio: 3.75,      // para cobrar en soles los planes en dólares
  adelantoPct: 50,       // % de adelanto al contratar un plan
  demoDias: 7,           // días que dura un código de demo
  // Pagos
  pagoYape: true, yapeQR: "", yapeNum: "999 999 999", yapeTitular: "ziko.pro",
  pagoPlin: true, plinQR: "", plinNum: "999 999 999", plinTitular: "ziko.pro",
  pagoTransf: true, cuentas: [
    { id: "bcp0", banco: "BCP", num: "191-00000000-0-00", cci: "002-191-000000000000-00", titular: "ziko.pro", url: "https://www.viabcp.com" }],
  contraEntrega: false, pagoOCR: true
};

window.ZK_SEMILLA = function () {
  const db = { ajustes: { general: JSON.parse(JSON.stringify(window.ZK_AJUSTES)) }, portafolio: {}, demo_links: {}, planes: {}, solicitudes: {}, accesos: {}, pedidos: {}, capturas: {}, movimientos: {}, mensajes: {} };
  const F = n => n ? "img/portafolio/" + n + ".jpg" : "";
  const P = [
    ["ferreteria", "Ferretería Ronald", "sistema", "Tienda online con panel administrativo: pedidos web, stock, venta en tienda, caja, clientes, pagos con Yape, Plin y transferencia, y recibos en PDF.", "ferreteria-ronald", true, true],
    ["nara", "NARA · Tienda de ropa", "sistema", "Tienda de moda con tallas y stock por talla, 4 fotos por prenda, Comprar ahora, pagos con captura, «Mis compras» y panel completo.", "", true, true],
    ["killa", "Killa Hospedaje", "sistema", "Reservas en línea con pago adelantado o completo, varias sedes, QR en cada habitación, tienda por sede y panel de recepción.", "", true, true],
    ["menteserena", "Mente Serena · Psicología", "sistema", "Citas en línea con pago, videollamadas, ficha del paciente y panel para el psicólogo.", "", true, false],
    ["guardian360", "Guardian360", "app", "App de seguridad ciudadana: alertas en tiempo real, monitoreo familiar con ubicación, asistente de voz y panel municipal y empresarial.", "guardian360", false, true],
    ["edureporte", "EduReporte", "app", "Gestión escolar: registra notas, controla la asistencia y mantén informados a los padres en tiempo real desde el celular.", "edureporte-web", false, false],
    ["bocadito", "Bocadito Express", "app", "App para pedir comidas rápidas, snacks y bebidas dentro de la universidad. Rápido, fácil y delicioso.", "bocadito-express", false, false],
    ["yavoy", "YaVoy", "app", "App de pedidos y delivery: comida, bodega, farmacia y más, con seguimiento del pedido en el mapa.", "yavoy", false, false],
    ["clinica", "Clínica Paredes", "web", "Página web para clínica: especialidades, médicos, reserva de citas y contacto directo.", "clinica-paredes", false, false],
    ["tapia", "Tapia", "tienda", "Tienda online multicategoría con Ofertas Flash, carrito y catálogo adaptable al celular.", "tapia-web", false, false],
    ["gamarra", "Tiendas Gamarra", "tienda", "Tienda online de ropa con ofertas, categorías y compra por WhatsApp.", "gamarra", false, false],
    ["pequenitos", "Pequeñitos", "tienda", "Tienda online de ropa para bebés con colecciones y categorías.", "pequenitos", false, false],
    ["lenceria", "Lencería Ana's", "tienda", "Tienda online de lencería con colecciones, ofertas y diseño elegante.", "lenceria-anas", false, false]
  ];
  P.forEach(([id, nombre, tipo, desc, foto, demo, destacado], i) => {
    db.portafolio[id] = { nombre, tipo, desc, foto: F(foto), link: "", demo, destacado, visible: true, orden: i };
    if (demo) db.demo_links[id] = { web: "", admin: "", usuario: "", clave: "", nota: "Entra al panel con el usuario de prueba. Todo lo que hagas es solo de prueba." };
  });
  db.planes = {
    basico: { nombre: "Básico", tipo: "Página web", precio: 180, moneda: "USD", nota: "Pago único", destacado: false, pagable: true, visible: true, orden: 0,
      items: ["Página web de 1 a 3 secciones", "Diseño adaptable a celulares", "Botón de WhatsApp", "SEO básico", "Enlace a redes sociales", "-Formulario de contacto", "-Panel administrativo"] },
    profesional: { nombre: "Profesional", tipo: "Página web", precio: 350, moneda: "USD", nota: "Pago único", destacado: true, pagable: true, visible: true, orden: 1,
      items: ["Hasta 6 páginas o secciones", "Diseño 100% personalizado", "Formulario de contacto", "Galería o catálogo", "SEO optimizado", "Google Maps y redes sociales", "-Panel administrativo"] },
    premium: { nombre: "Premium", tipo: "Sistema web o aplicación", precio: null, moneda: "USD", nota: "Según tu proyecto", destacado: false, pagable: false, visible: true, orden: 2,
      items: ["Tienda online, sistema web o aplicación", "Panel administrativo", "Base de datos", "Pagos con Yape, Plin y transferencia", "Usuarios, caja y reportes", "Capacitación incluida", "Soporte prioritario"] }
  };
  if (window.ZK_DEMO_DATOS !== false) {
    const now = Date.now(), h = n => new Date(now - n * 3600e3).toISOString(), hoy = new Date().toISOString().slice(0, 10);
    db.solicitudes["SD-DEMO1"] = { nombre: "Carlos Mendoza", celular: "987123456", sistema: "ferreteria", negocio: "Ferretería en Comas", estado: "nuevo", creado: h(2) };
    db.solicitudes["SD-DEMO2"] = { nombre: "Rosa Villanueva", celular: "987654000", sistema: "nara", negocio: "Tienda de ropa en Gamarra", estado: "nuevo", creado: h(5) };
    db.pedidos["ZK-DEMO01"] = { codigo: "ZK-DEMO01", plan: "profesional", items: [{ n: "Plan Profesional · Página web", precio: 1312.5, cant: 1 }], total: 1312.5, monto: 656.25, tipoPago: "adelanto", subtotal: 1312.5, envio: 0,
      nombre: "Luis Ramírez", celular: "987222111", email: "luis@correo.com", negocio: "Taller Ramírez", doc: "", comprobante: "Boleta", detalle: "Página para mi taller mecánico con galería de trabajos y botón de WhatsApp.",
      pago: "Yape", banco: "", operacion: "11223344", montoLeido: 656.25, coincide: true, estado: "por-validar", origen: "web", creado: h(1) };
    db.capturas["ZK-DEMO01"] = { pedido: "ZK-DEMO01", captura: "" };
    db.pedidos["ZK-DEMO02"] = { codigo: "ZK-DEMO02", plan: "basico", items: [{ n: "Plan Básico · Página web", precio: 675, cant: 1 }], total: 675, monto: 675, tipoPago: "total", subtotal: 675, envio: 0,
      nombre: "Ana Torres", celular: "987333222", email: "", negocio: "Pastelería Dulce Ana", doc: "", comprobante: "Boleta", detalle: "Página con catálogo de tortas.",
      pago: "Plin", estado: "desarrollo", pagado: 675, origen: "web", creado: h(30) };
    db.movimientos["MV-DEMO1"] = { fecha: hoy, hora: h(3), concepto: "Pago plan Básico · Ana Torres", monto: 675, metodo: "Plin", usuario: "Administración" };
    db.mensajes["MS-DEMO1"] = { nombre: "Jorge Salas", telefono: "987444555", asunto: "Sistema web", mensaje: "Hola, tengo una bodega y quiero un sistema con inventario y ventas. ¿Cuánto cuesta?", estado: "nuevo", creado: h(4) };
  }
  return db;
};
