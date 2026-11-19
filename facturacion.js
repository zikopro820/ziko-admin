/* =========================================================
   ziko.pro · Panel — FACTURACIÓN ELECTRÓNICA (SUNAT)
   Usa el servidor «ziko-facturacion» (Firebase Cloud Functions).
   Modo PRUEBAS (beta de la SUNAT, sin valor tributario) o modo REAL (producción).
   ========================================================= */
const FACT = { emp: "ziko", region: "southamerica-east1", col: "fact_empresas" };
const REAL = emp => !!emp && emp.modo === "produccion";
const FACT_COMP = emp => `${FACT.col}/${FACT.emp}/${REAL(emp) ? "cpe" : "comprobantes"}`;   // los de prueba y los reales van separados
const TIPO_C = { "03": "BOLETA DE VENTA ELECTRÓNICA", "01": "FACTURA ELECTRÓNICA", "07": "NOTA DE CRÉDITO ELECTRÓNICA" };
const TIPO_N = { "03": "Boleta", "01": "Factura", "07": "Nota de crédito", "NV": "Nota de venta" };
TIPO_C.NV = "NOTA DE VENTA";
const FACT_NV = () => `${FACT.col}/${FACT.emp}/notas`;   // notas de venta: internas, no van a la SUNAT
const esNV = c => c.tipo === "NV";
const vale = c => ["aceptado", "observado"].includes(c.estado);
const DOC_ID = { "0": "Sin documento", "1": "DNI", "6": "RUC", "4": "Carné de extranjería", "7": "Pasaporte" };
const EST_C = { aceptado: ["Aceptada por SUNAT", "ok"], observado: ["Aceptada con observaciones", "warn"], rechazado: ["Rechazada", "bad"], pendiente: ["Pendiente de envío", "warn"], error: ["Error de envío", "bad"] };
const f2 = n => (Math.round((+n || 0) * 100) / 100).toFixed(2);
const nComp = c => `${c.serie}-${String(c.numero).padStart(8, "0")}`;
// Datos de ejemplo del emisor (los de la ficha RUC). Se guardan al pulsar «Guardar».
const EMISOR_EJ = { ruc: "10484978129", razon: "TAPIA APAZA WILSON", nombreComercial: "GUARDIAN360", direccion: "COM. LIVINCAYA S/N", departamento: "CUSCO", provincia: "CANCHIS", distrito: "SICUANI", ubigeo: "080601",
  telefono: "", email: "", serieB: "B001", serieF: "F001", serieNCB: "BC01", serieNCF: "FC01", serieNV: "NV01", igv: 18, afectacion: "10", modo: "beta", usuarios: [], activo: true };

/* ---------- Llamar al servidor (o simularlo en modo demo) ---------- */
let FNX = null;
async function servidor(nombre, data) {
  if (DEMO) return simular(nombre, data);
  if (APP.factURL) {   // servidor de pruebas en Vercel
    const { auth } = await fb(), u = auth.currentUser; if (!u) throw new Error("Vuelve a iniciar sesión");
    let r; try { r = await fetch(`${String(APP.factURL).replace(/\/$/, "")}/${nombre}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + await u.getIdToken() }, body: JSON.stringify(data) }); }
    catch (e) { throw new Error("No se pudo conectar con el servidor de facturación. Revisa la dirección factURL."); }
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || `Error ${r.status} del servidor de facturación`); return j.data;
  }
  if (!FNX) { const f = await import(`https://www.gstatic.com/firebasejs/${FB_V}/firebase-functions.js`); await fb(); const app = await import(`https://www.gstatic.com/firebasejs/${FB_V}/firebase-app.js`); FNX = { f, fns: f.getFunctions(app.getApp(), FACT.region) }; }
  try { return (await FNX.f.httpsCallable(FNX.fns, nombre, { timeout: 120000 })(data)).data; }
  catch (e) { const m = e.code === "functions/not-found" || e.code === "functions/internal" && /not found|404/i.test(e.message) ? "El servidor de facturación todavía no está publicado (revisa el paso de GitHub Actions)." : e.message; throw new Error(m); }
}
// Modo demo: calcula igual que el servidor, pero no envía nada
async function simular(nombre, d) {
  const emp = await DB.get(FACT.col, FACT.emp); if (!emp) throw new Error("Primero guarda los datos del emisor");
  const col = FACT_COMP(emp), CORR = REAL(emp) ? "corrP" : "corr";
  if (nombre === "credenciales") { if (!d.pfx || !d.pfxClave || !d.solUsuario || !d.solClave) throw new Error("Completa todos los datos"); const prod = { listo: true, usuario: d.solUsuario.toUpperCase(), certVence: "2029-11-18", actualizado: new Date().toISOString() }; await DB.set(FACT.col, FACT.emp, { prod }); return { ok: true, ...prod }; }
  if (REAL(emp) && !(emp.prod || {}).listo && !["notaVenta", "anularNota"].includes(nombre)) throw new Error("Falta subir el certificado y el usuario secundario SOL (botón «Modo real»)");
  if (nombre === "emitirPago") { const p = await DB.get("pedidos", d.pedidoId), ya = (p.cpes || {})[d.idx]; if (ya && ya.id) throw new Error(`Ese pago ya tiene comprobante ${ya.id}`);
    const tipo = d.tipo || (p.comprobante === "Factura" ? "01" : "03"), cli = d.cliente || {};
    const c = await simular("emitir", { tipo, cliente: cli.num ? cli : { nombre: cli.nombre }, items: [{ desc: conceptoPagoTxt(p, d.idx), cant: 1, precio: +p.pagos[d.idx].monto }], celular: p.celular, pedido: p.codigo || p.id });
    await DB.set("pedidos", p.id, { cpes: { ...(p.cpes || {}), [d.idx]: { ...c, emisor: { ruc: emp.ruc, razon: emp.razon, nombreComercial: emp.nombreComercial || "", direccion: emp.direccion, distrito: emp.distrito, provincia: emp.provincia, departamento: emp.departamento } } }, boleta: c.id, comprobante: tipo === "01" ? "Factura" : "Boleta" });
    return c; }
  if (nombre === "notaVenta") { const serie = emp.serieNV || "NV01", numero = ((emp.corrNV || {})[serie] || 0) + 1; await DB.set(FACT.col, FACT.emp, { corrNV: { ...(emp.corrNV || {}), [serie]: numero } });
    const tasa = emp.afectacion === "10" ? (emp.igv || 18) / 100 : 0; let t = 0; const items = d.items.map((it, k) => { const tot = Math.round(it.precio * it.cant * 100) / 100; t += tot; return { n: k + 1, desc: it.desc, cant: it.cant, precio: it.precio, total: tot }; });
    const g = Math.round(t / (1 + tasa) * 100) / 100, ahora = new Date(Date.now() - 5 * 3600e3).toISOString();
    const c = { id: `${serie}-${String(numero).padStart(8, "0")}`, tipo: "NV", serie, numero, fecha: ahora.slice(0, 10), hora: ahora.slice(11, 19), cliente: d.cliente.num ? { tipoDoc: d.cliente.tipoDoc || "1", num: d.cliente.num, nombre: (d.cliente.nombre || "-").toUpperCase() } : { tipoDoc: "0", num: "-", nombre: (d.cliente.nombre || "CLIENTES VARIOS").toUpperCase() },
      items, gravada: g, igv: Math.round((t - g) * 100) / 100, total: Math.round(t * 100) / 100, letras: `${f2(t)} SOLES (demo)`, estado: "interna", celular: d.celular || "", usuario: YO().email, creado: new Date().toISOString() };
    await DB.set(FACT_NV(), c.id, c); return c; }
  if (nombre === "anularNota") { await DB.set(FACT_NV(), d.id, { anulado: "ANULADA", motivoAnulacion: (d.motivo || "ANULACIÓN").toUpperCase() }); return { ...(await DB.get(FACT_NV(), d.id)) }; }
  if (nombre === "consultar") { const c = await DB.get(col, d.id); await DB.set(col, d.id, { estado: "aceptado", codigo: "0", mensaje: "(DEMO) La SUNAT lo tiene aceptado", consulta: "0004 (DEMO)" }); return { ...c, estado: "aceptado", respuesta: "aceptado" }; }
  if (nombre === "reenviar") { const c = await DB.get(col, d.id); await DB.set(col, d.id, { estado: "aceptado", mensaje: "(DEMO) reenviada" }); return { ...c, estado: "aceptado" }; }
  if (nombre === "anular") { const o = await DB.get(col, d.id); if (o.anulado) throw new Error("Ya fue anulado con " + o.anulado);
    const serie = o.tipo === "01" ? emp.serieNCF || "FC01" : emp.serieNCB || "BC01", numero = ((emp[CORR] || {})[serie] || 0) + 1; await DB.set(FACT.col, FACT.emp, { [CORR]: { ...(emp[CORR] || {}), [serie]: numero } });
    const id = `${serie}-${String(numero).padStart(8, "0")}`, c = { ...o, id, tipo: "07", serie, numero, anula: o.id, anulado: "", refDoc: { id: `${o.serie}-${o.numero}`, tipo: o.tipo, motivo: (d.motivo || "ANULACION DE LA OPERACION").toUpperCase() }, mensaje: "(DEMO) Nota de crédito simulada", creado: new Date().toISOString() };
    await DB.set(col, id, c); await DB.set(col, o.id, { anulado: id }); return c; }
  const tasa = emp.afectacion === "10" ? (emp.igv || 18) / 100 : 0; let g = 0, i = 0, t = 0;
  const items = d.items.map((it, k) => { const tot = Math.round(it.precio * it.cant * 100) / 100, val = Math.round(tot / (1 + tasa) * 100) / 100; g += val; i += tot - val; t += tot; return { n: k + 1, desc: it.desc, cant: it.cant, precio: it.precio, valor: val, igv: Math.round((tot - val) * 100) / 100, total: tot, unidad: "NIU" }; });
  if (d.tipo === "03" && !d.cliente.num && t > 700) throw new Error("Si la boleta pasa de S/ 700 debes poner el DNI del cliente");
  if (d.tipo === "01" && String(d.cliente.num || "").length !== 11) throw new Error("La factura necesita el RUC del cliente (11 dígitos)");
  const serie = d.tipo === "01" ? emp.serieF : emp.serieB, numero = ((emp[CORR] || {})[serie] || 0) + 1; await DB.set(FACT.col, FACT.emp, { [CORR]: { ...(emp[CORR] || {}), [serie]: numero } });
  const ahora = new Date(Date.now() - 5 * 3600e3).toISOString(), fecha = ahora.slice(0, 10), hora = ahora.slice(11, 19), hash = btoa(String(Math.random())).slice(0, 27) + "=";
  const cli = d.cliente.num ? { tipoDoc: d.cliente.tipoDoc, num: d.cliente.num, nombre: (d.cliente.nombre || "-").toUpperCase(), direccion: d.cliente.direccion || "" } : { tipoDoc: "0", num: "-", nombre: ((d.cliente || {}).nombre || "CLIENTES VARIOS").toUpperCase(), direccion: "" };
  const c = { id: `${serie}-${String(numero).padStart(8, "0")}`, tipo: d.tipo, serie, numero, fecha, hora, moneda: "PEN", cliente: cli, items, gravada: Math.round(g * 100) / 100, igv: Math.round(i * 100) / 100, total: Math.round(t * 100) / 100,
    letras: `${f2(t)} SOLES (demo)`, hash, modo: REAL(emp) ? "produccion" : "beta", estado: "aceptado", codigo: "0", mensaje: "(DEMO) Simulado. Con Firebase real se envía al ambiente de pruebas de la SUNAT.", notas: [],
    qr: `${emp.ruc}|${d.tipo}|${serie}|${numero}|${f2(i)}|${f2(t)}|${fecha}|${cli.tipoDoc}|${cli.num}|${hash}|`, celular: d.celular || "", pedido: d.pedido || "", usuario: YO().email, creado: new Date().toISOString() };
  await DB.set(col, c.id, c); return c;
}

/* ---------- Ticket (58 / 80 mm) para ticketera, o A4 / PDF ---------- */
let QRLIB = null;
function cargarQR() {
  if (window.qrcode) return Promise.resolve(); if (QRLIB) return QRLIB;
  return (QRLIB = new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"; s.onload = ok; s.onerror = () => { QRLIB = null; no(new Error("No se pudo cargar el QR")); }; document.head.appendChild(s); }));
}
async function qrDataURL(texto) { try { await cargarQR(); const q = window.qrcode(0, "M"); q.addData(texto); q.make(); return q.createDataURL(5, 0); } catch (e) { return ""; } }
async function ticket(c, emp, ancho = 80) {
  const w = window.open("", "_blank"); if (!w) return toast("Permite las ventanas emergentes para imprimir", true);
  w.document.write("<p style='font:14px sans-serif;text-align:center;margin-top:40px'>Preparando el comprobante…</p>");
  const qr = c.tipo === "NV" ? "" : await qrDataURL(c.qr);
  const papel = ancho === "A4" ? "A4" : `${ancho}mm auto`, cuerpo = ancho === "A4" ? "190mm" : ancho === 58 ? "48mm" : "72mm", fs = ancho === 58 ? "10.5px" : "12px";
  const nv = esNV(c), prueba = !nv && c.modo !== "produccion";
  const filas = c.items.map(l => `<tr><td colspan="3">${esc(l.desc)}</td></tr><tr><td>${l.cant} x ${f2(l.precio)}</td><td></td><td class="r">${f2(l.total)}</td></tr>`).join("");
  w.document.open(); w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(nComp(c))}</title>
  <style>@page{size:${papel};margin:${ancho === "A4" ? "12mm" : "2mm"}}*{box-sizing:border-box}body{margin:0 auto;width:${cuerpo};font:${fs}/1.35 "Courier New",monospace;color:#000;background:#fff}
  .c{text-align:center}.b{font-weight:700}.r{text-align:right}hr{border:0;border-top:1px dashed #000;margin:6px 0}table{width:100%;border-collapse:collapse}td{vertical-align:top;padding:1px 0}
  .t{font-size:1.15em}.prueba{border:2px solid #000;padding:4px;margin:6px 0;text-align:center;font-weight:700}#qr{display:flex;justify-content:center;margin:6px 0}#qr img{width:${ancho === 58 ? 110 : 130}px;height:auto;image-rendering:pixelated}
  .nv{border:2px solid #000;padding:5px;margin:6px 0;text-align:center;font-weight:700;font-size:1.05em}.no-print{margin:12px 0;text-align:center}@media print{.no-print{display:none}}</style></head><body>
  ${prueba ? `<div class="prueba">*** PRUEBA · SIN VALOR TRIBUTARIO ***</div>` : ""}
  <div class="c"><div class="b t">${esc(emp.nombreComercial || emp.razon)}</div>${emp.nombreComercial ? `<div>${esc(emp.razon)}</div>` : ""}<div>RUC ${esc(emp.ruc)}</div>
  <div>${esc(emp.direccion)}${emp.distrito ? " - " + esc(emp.distrito) : ""}${emp.provincia ? " - " + esc(emp.provincia) : ""}${emp.departamento ? " - " + esc(emp.departamento) : ""}</div>${emp.telefono ? `<div>Tel. ${esc(emp.telefono)}</div>` : ""}</div><hr>
  <div class="c b">${TIPO_C[c.tipo]}<br>${esc(nComp(c))}</div>${nv ? `<div class="nv">NO VÁLIDO COMO COMPROBANTE DE PAGO<br><small>Documento interno · no se envía a la SUNAT</small></div>` : ""}${nv && c.anulado ? `<div class="nv">*** ANULADA ***</div>` : ""}<hr>
  ${c.tipo === "07" && c.refDoc ? `<div>Doc. que modifica: ${esc(c.refDoc.id)}</div><div>Motivo: ${esc(c.refDoc.motivo || "ANULACIÓN DE LA OPERACIÓN")}</div>` : ""}<div>Fecha: ${esc(c.fecha.split("-").reverse().join("/"))} ${esc(c.hora)}</div><div>Cliente: ${esc(c.cliente.nombre)}</div>${c.cliente.num !== "-" ? `<div>${DOC_ID[c.cliente.tipoDoc] || "Doc."}: ${esc(c.cliente.num)}</div>` : ""}${c.cliente.direccion ? `<div>Dir.: ${esc(c.cliente.direccion)}</div>` : ""}<hr>
  <table>${filas}</table><hr>
  <table><tr><td>${emp.afectacion === "20" ? "OP. EXONERADA" : "OP. GRAVADA"}</td><td class="r">S/ ${f2(c.gravada)}</td></tr><tr><td>IGV (${emp.afectacion === "20" ? 0 : emp.igv || 18}%)</td><td class="r">S/ ${f2(c.igv)}</td></tr><tr class="b t"><td>TOTAL</td><td class="r">S/ ${f2(c.total)}</td></tr></table>
  <div>SON: ${esc(c.letras)}</div><hr>
  ${nv ? `<div class="c">Si necesita boleta o factura electrónica, solicítela al momento de su compra.</div><hr>` : `<div id="qr">${qr ? `<img src="${qr}" alt="Código QR">` : ""}</div><div class="c" style="word-break:break-all">Resumen: ${esc(c.hash)}</div>
  <div class="c">Representación impresa de la ${TIPO_C[c.tipo].toLowerCase()}.<br>Consulte su validez en www.sunat.gob.pe</div><hr>`}
  <div class="c">¡Gracias por su compra!<br><small>Emitido con Facturación ziko.pro</small></div>
  <div class="no-print"><button onclick="print()" style="padding:10px 18px;font-size:15px">🖨️ Imprimir</button></div>
  <script>window.onload=function(){setTimeout(function(){print()},300)};<\/script></body></html>`);
  w.document.close();
}

/* ---------- Pantalla principal ---------- */
VIEWS.facturacion = async () => {
  await cargarCatalogo();
  const emp = await DB.get(FACT.col, FACT.emp);
  if (!emp) {
    $("#view").innerHTML = topBar("Facturación electrónica", "Boletas y facturas electrónicas enviadas a la SUNAT.") + `<section class="card hi"><h2>${ico("file")} Primer paso: datos del emisor</h2>
      <p>Revisa tus datos tal como figuran en tu ficha RUC de la SUNAT y guárdalos. Empezamos en <b>modo PRUEBAS</b> (ambiente beta de la SUNAT): las boletas no tienen valor tributario.</p>
      <button class="btn btn-pri" id="fEmi">${ico("edit")} Revisar y guardar datos</button></section>`;
    $("#fEmi").onclick = () => formEmisor({ ...EMISOR_EJ, usuarios: APP.equipo.map(p => p.email) });
    return;
  }
  const l = [...await DB.list(FACT_COMP(emp)), ...await DB.list(FACT_NV())].sort((a, b) => String(b.fecha + b.hora).localeCompare(a.fecha + a.hora) || b.numero - a.numero);
  const hoy = HOY(), dHoy = l.filter(c => c.fecha === hoy && ["01", "03"].includes(c.tipo) && vale(c) && !c.anulado), nvHoy = l.filter(c => c.fecha === hoy && esNV(c) && !c.anulado), malos = l.filter(c => ["rechazado", "pendiente", "error"].includes(c.estado));
  const prueba = !REAL(emp), prod = emp.prod || {};
  $("#view").innerHTML = topBar("Facturación electrónica", `${esc(emp.razon)} · RUC ${esc(emp.ruc)}`,
    `<button class="btn btn-pri btn-sm" data-nuevo="03">${ico("plus")} Nueva boleta</button><button class="btn btn-light btn-sm" data-nuevo="01">${ico("plus")} Nueva factura</button><button class="btn btn-light btn-sm" data-nuevo="NV">${ico("plus")} Nota de venta</button>${esAdm() ? `<button class="btn btn-light btn-sm" id="fCert">${ico("lock")} Modo real</button><button class="btn btn-light btn-sm" id="fEmi">${ico("gear")} Datos del emisor</button>` : ""}`) + `
    ${prueba ? `<div class="alert warn">${ico("alert")} <span><b>MODO PRUEBAS (beta de la SUNAT).</b> Todo se envía al ambiente de pruebas: sirve para comprobar que la SUNAT acepta los comprobantes, pero <b>no tienen valor tributario</b>. ${prod.listo ? ` Tu certificado ya está guardado: cuando quieras emitir boletas reales, ve a «Datos del emisor» y elige <b>REAL</b>.` : ` Para emitir boletas reales, sube tu certificado y tu usuario secundario en <b>«Modo real»</b>.`}</span></div>`
      : `<div class="alert ok">${ico("check")} <span><b>MODO REAL.</b> Los comprobantes se envían a la SUNAT y tienen valor tributario. Usuario ${esc(emp.ruc)} ${esc(prod.usuario || "")} · certificado vigente hasta ${esc(fLarga(prod.certVence))}.</span></div>`}
    <div class="kpis neon"><div class="kpi"><span>Vendido hoy (aceptado)</span><b>${S(dHoy.reduce((a, c) => a + c.total, 0))}</b><small>${dHoy.length} comprobante(s)</small></div>
      <div class="kpi"><span>Emitidos</span><b>${l.filter(c => !esNV(c)).length}</b><small>Boletas ${l.filter(c => c.tipo === "03").length} · Facturas ${l.filter(c => c.tipo === "01").length} · NC ${l.filter(c => c.tipo === "07").length}</small></div>
      <div class="kpi"><span>Por revisar</span><b class="${malos.length ? "neg" : ""}">${malos.length}</b><small>rechazados / pendientes</small></div>
      <div class="kpi"><span>Notas de venta hoy</span><b>${S(nvHoy.reduce((a, c) => a + c.total, 0))}</b><small>${nvHoy.length} nota(s) · no van a la SUNAT</small></div></div>
    <section class="card"><div class="tbl-w"><table class="tbl"><thead><tr><th>Comprobante</th><th>Fecha</th><th>Cliente</th><th class="r">Total</th><th>SUNAT</th><th></th></tr></thead><tbody>
      ${l.map(c => { const e = esNV(c) ? ["No se envía a la SUNAT", "mute"] : EST_C[c.estado] || [c.estado, "mute"]; return `<tr><td><b>${esc(nComp(c))}</b><br><small class="muted">${TIPO_N[c.tipo] || ""}${c.tipo === "07" && c.refDoc ? ` de ${esc(c.refDoc.id)}` : ""}</small>${c.anulado ? `<br><span class="st bad">${esNV(c) ? "Anulada" : `Anulada · ${esc(c.anulado)}`}</span>` : ""}</td><td>${esc(c.fecha.split("-").reverse().join("/"))}<br><small class="muted">${esc(c.hora.slice(0, 5))}</small></td>
        <td>${esc(c.cliente.nombre)}<br><small class="muted">${c.cliente.num !== "-" ? `${DOC_ID[c.cliente.tipoDoc] || ""} ${esc(c.cliente.num)}` : ""}</small></td><td class="r">${S(c.total)}</td>
        <td><span class="st ${e[1]}">${e[0]}</span>${c.mensaje && c.estado !== "aceptado" ? `<br><small class="muted">${c.codigo ? `[${esc(c.codigo)}] ` : ""}${esc(recorta(c.mensaje, 70))}</small>` : ""}${c.consulta && c.estado !== "aceptado" ? `<br><small class="muted">Consulta SUNAT: ${esc(recorta(c.consulta, 70))}</small>` : ""}</td>
        <td class="acts-g"><button class="btn btn-light btn-sm" data-t80="${esc(c.id)}" title="Ticket 80 mm">${ico("print")} 80</button><button class="btn btn-light btn-sm" data-t58="${esc(c.id)}" title="Ticket 58 mm">58</button><button class="btn btn-light btn-sm" data-a4="${esc(c.id)}" title="Hoja A4 / PDF">A4</button>
          <button class="btn btn-light btn-sm" data-ver="${esc(c.id)}">${ico("file")}</button>${["pendiente", "error"].includes(c.estado) ? `${REAL(emp) ? `<button class="btn btn-light btn-sm" data-cq="${esc(c.id)}" title="Pregunta a la SUNAT si ya lo registró">Consultar SUNAT</button>` : ""}<button class="btn btn-pri btn-sm" data-re="${esc(c.id)}">Reenviar</button>` : ""}${(esNV(c) || (c.tipo !== "07" && vale(c))) && !c.anulado ? `<button class="btn btn-light btn-sm" data-an="${esc(c.id)}" title="${esNV(c) ? "Anular nota de venta" : "Anular con nota de crédito"}">Anular</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="6" class="muted">Aún no emites comprobantes. Pulsa «Nueva boleta» para hacer tu primera prueba.</td></tr>`}</tbody></table></div></section>`;
  if ($("#fEmi")) $("#fEmi").onclick = () => formEmisor(emp);
  if ($("#fCert")) $("#fCert").onclick = () => formCertificado(emp);
  $("#view").onclick = async e => {
    const b = e.target.closest("button"); if (!b) return; const id = b.dataset.t80 || b.dataset.t58 || b.dataset.a4 || b.dataset.ver || b.dataset.re || b.dataset.an || b.dataset.cq, c = l.find(x => x.id === id);
    if (b.dataset.nuevo) return b.dataset.nuevo === "NV" ? formNotaVenta(emp) : formComprobante(b.dataset.nuevo, emp);
    if (!c) return;
    if (b.dataset.t80) return ticket(c, emp, 80); if (b.dataset.t58) return ticket(c, emp, 58); if (b.dataset.a4) return ticket(c, emp, "A4");
    if (b.dataset.ver) return verComprobante(c, emp);
    if (b.dataset.an) return esNV(c) ? formAnularNV(c, emp) : formAnular(c, emp);
    if (b.dataset.cq) { b.disabled = true; b.textContent = "Consultando…"; try { const r = await servidor("consultar", { empresaId: FACT.emp, id: c.id });
        const txt = { aceptado: "La SUNAT lo tiene ACEPTADO ✓", rechazado: "La SUNAT lo RECHAZÓ", noexiste: "La SUNAT todavía NO lo tiene registrado: usa «Reenviar»", baja: "Está dado de baja en la SUNAT" }[r.respuesta] || `SUNAT: ${r.respuestaCodigo} ${r.respuestaMensaje}`;
        toast(`${nComp(c)}: ${vale(r) ? "Aceptada por SUNAT ✓" : txt}`, !vale(r)); } catch (er) { toast(er.message, true); } VIEWS.facturacion(); return; }
    if (b.dataset.re) { b.disabled = true; b.textContent = "Enviando…"; try { const r = await servidor("reenviar", { empresaId: FACT.emp, id: c.id }); toast(`${nComp(c)}: ${(EST_C[r.estado] || [r.estado])[0]}`, !["aceptado", "observado"].includes(r.estado)); } catch (er) { toast(er.message, true); } VIEWS.facturacion(); }
  };
};

function verComprobante(c, emp) {
  const F0 = $("#mF"); if (F0) { F0.oninput = null; F0.onclick = null; }
  const e = esNV(c) ? ["Nota de venta interna · no se envía a la SUNAT · no es comprobante de pago", "mute"] : EST_C[c.estado] || [c.estado, "mute"];
  modal(`${TIPO_N[c.tipo] || ""} ${nComp(c)}`, `<div class="alert ${e[1] === "ok" ? "" : e[1]}"><b>${e[0]}</b>${c.codigo ? ` · código ${esc(c.codigo)}` : ""}<br>${esc(c.mensaje || "")}${c.consulta ? `<br><small>Última consulta a la SUNAT: ${esc(c.consulta)}</small>` : ""}</div>
    ${(c.notas || []).length ? `<p><b>Observaciones de la SUNAT:</b></p><ul>${c.notas.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
    ${c.tipo === "07" && c.refDoc ? `<p><b>Anula:</b> ${esc(c.refDoc.id)} · ${esc(c.refDoc.motivo || "")}</p>` : ""}${c.anulado ? `<div class="alert bad sm">Este comprobante fue anulado con la nota de crédito ${esc(c.anulado)}.</div>` : ""}
    <p><b>Cliente:</b> ${esc(c.cliente.nombre)} ${c.cliente.num !== "-" ? `· ${DOC_ID[c.cliente.tipoDoc] || ""} ${esc(c.cliente.num)}` : ""}</p>
    <div class="tbl-w"><table class="tbl"><thead><tr><th>Descripción</th><th class="r">Cant.</th><th class="r">P. unit.</th><th class="r">Total</th></tr></thead><tbody>${c.items.map(l => `<tr><td>${esc(l.desc)}</td><td class="r">${l.cant}</td><td class="r">${f2(l.precio)}</td><td class="r">${f2(l.total)}</td></tr>`).join("")}</tbody></table></div>
    <p class="r">Op. gravada ${S(c.gravada)} · IGV ${S(c.igv)} · <b>Total ${S(c.total)}</b></p><p class="muted">Emitido por ${esc(c.usuario || "")}${c.hash ? ` · resumen (hash) ${esc(c.hash)}` : ""}</p>
    <div class="acts-g"><button type="button" class="btn btn-pri btn-sm" id="vT80">${ico("print")} Ticket 80 mm</button><button type="button" class="btn btn-light btn-sm" id="vT58">Ticket 58 mm</button><button type="button" class="btn btn-light btn-sm" id="vA4">A4 / imprimir</button><button type="button" class="btn btn-wa btn-sm" id="vWA">${ico("wa")} Enviar por WhatsApp</button><button type="button" class="btn btn-light btn-sm" id="vPDF">${ico("download")} PDF ${navigator.canShare ? "/ compartir" : ""}</button>${!DEMO && !esNV(c) ? `<button type="button" class="btn btn-light btn-sm" id="vX">${ico("download")} XML</button>` : ""}</div>`, null, "", { wide: true,
    alAbrir: () => { $("#vWA").onclick = () => enviarWA(c, emp); $("#vPDF").onclick = () => compartirPDF(c, emp);
      $("#vT80").onclick = () => ticket(c, emp, 80); $("#vT58").onclick = () => ticket(c, emp, 58); $("#vA4").onclick = () => ticket(c, emp, "A4");
      if ($("#vX")) $("#vX").onclick = async () => { const full = await DB.get(FACT_COMP(emp), c.id); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([full.xml || ""], { type: "application/xml" })); a.download = `${emp.ruc}-${c.tipo}-${c.serie}-${c.numero}.xml`; a.click(); }; } });
}

function formEmisor(e) {
  const F0 = $("#mF"); if (F0) { F0.oninput = null; F0.onclick = null; }
  modal("Datos del emisor (como en tu ficha RUC)", `<div class="g2">
    ${fld("ruc", "RUC", e.ruc, { req: true, extra: 'inputmode="numeric" maxlength="11" pattern="\\d{11}"' })}${fld("razon", "Apellidos y nombres o razón social", e.razon, { req: true })}
    ${fld("nombreComercial", "Nombre comercial (opcional)", e.nombreComercial, { help: "Sale arriba en el ticket. Usa el que registraste en la SUNAT." })}${fld("telefono", "Teléfono (sale en el ticket)", e.telefono)}
    ${fld("direccion", "Dirección fiscal", e.direccion, { req: true, full: true, ph: "Ej. COM. LIVINCAYA S/N" })}
    ${fld("departamento", "Departamento", e.departamento, { req: true })}${fld("provincia", "Provincia", e.provincia, { req: true })}${fld("distrito", "Distrito", e.distrito, { req: true })}${fld("ubigeo", "Ubigeo (6 dígitos)", e.ubigeo, { req: true, extra: 'inputmode="numeric" maxlength="6"', help: "Está en tu ficha RUC." })}
    ${fld("serieB", "Serie de boletas", e.serieB || "B001", { req: true, extra: 'maxlength="4"' })}${fld("serieF", "Serie de facturas", e.serieF || "F001", { req: true, extra: 'maxlength="4"' })}
    ${fld("serieNCB", "Serie de notas de crédito de boletas", e.serieNCB || "BC01", { req: true, extra: 'maxlength="4"' })}${fld("serieNCF", "Serie de notas de crédito de facturas", e.serieNCF || "FC01", { req: true, extra: 'maxlength="4"' })}${fld("serieNV", "Serie de notas de venta (internas)", e.serieNV || "NV01", { req: true, extra: 'maxlength="4"' })}
    ${fld("afectacion", "IGV de tus ventas", e.afectacion || "10", { opts: [["10", "Gravado con IGV (lo normal)"], ["20", "Exonerado de IGV (ej. Amazonía)"]], help: "Si no sabes, pregúntale a tu contador." })}${fld("igv", "Tasa de IGV (%)", e.igv ?? 18, { type: "number", extra: 'min="0" max="30" step="1"' })}
    ${fld("usuarios", "Correos que pueden emitir (separados por coma)", (e.usuarios || []).join(", "), { full: true, help: "Deben ser usuarios del panel (Firebase Authentication)." })}
    ${fld("modo", "Ambiente", e.modo || "beta", { opts: [["beta", "PRUEBAS (beta de la SUNAT) · sin valor tributario"], ...((e.prod || {}).listo ? [["produccion", "REAL (producción) · con valor tributario"]] : [])], full: true,
      help: (e.prod || {}).listo ? "En REAL cada boleta llega a la SUNAT y vale tributariamente. Los de prueba quedan aparte y la numeración real empieza en 1." : "Para elegir REAL primero sube tu certificado y usuario secundario en «Modo real»." })}</div>`, async d => {
    if (!/^\d{11}$/.test(d.ruc)) return toast("El RUC debe tener 11 dígitos", true), false;
    if (!/^\d{6}$/.test(d.ubigeo)) return toast("El ubigeo debe tener 6 dígitos", true), false;
    if (!/^B[A-Z0-9]{3}$/.test(d.serieB.toUpperCase()) || !/^F[A-Z0-9]{3}$/.test(d.serieF.toUpperCase())) return toast("Las series deben ser de 4 caracteres: B001 para boletas y F001 para facturas", true), false;
    if (!/^B[A-Z0-9]{3}$/.test(d.serieNCB.toUpperCase()) || !/^F[A-Z0-9]{3}$/.test(d.serieNCF.toUpperCase())) return toast("Series de notas de crédito: BC01 (boletas) y FC01 (facturas)", true), false;
    if (d.modo === "produccion" && e.modo !== "produccion" && !confirm("Vas a pasar a MODO REAL: desde ahora cada boleta y factura se envía a la SUNAT y tiene valor tributario. ¿Continuar?")) return false;
    d.serieNCB = d.serieNCB.toUpperCase(); d.serieNCF = d.serieNCF.toUpperCase(); d.serieNV = (d.serieNV || "NV01").toUpperCase().slice(0, 4);
    await DB.set(FACT.col, FACT.emp, { ...d, serieB: d.serieB.toUpperCase(), serieF: d.serieF.toUpperCase(), razon: d.razon.toUpperCase(), direccion: d.direccion.toUpperCase(), igv: +d.igv || 18,
      usuarios: d.usuarios.split(/[,\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean), activo: true, actualizado: new Date().toISOString() });
    toast("Datos del emisor guardados"); VIEWS.facturacion();
  }, "Guardar", { wide: true });
}

function formComprobante(tipo, emp) {
  const fac = tipo === "01";
  modal(fac ? "Nueva factura electrónica" : "Nueva boleta electrónica", `<div class="g2">
    ${fac ? `<input type="hidden" name="tipoDoc" value="6">` : fld("tipoDoc", "Documento del cliente", "0", { opts: [["0", "Sin documento (menos de S/ 700)"], ["1", "DNI"], ["4", "Carné de extranjería"], ["7", "Pasaporte"]] })}
    ${fld("num", fac ? "RUC del cliente" : "Número de documento", "", { req: fac, extra: `inputmode="numeric" ${fac ? 'maxlength="11"' : 'maxlength="15"'}` })}
    ${fld("nombre", fac ? "Razón social del cliente" : "Nombre del cliente", "", { req: fac, full: !fac ? false : true })}${fac ? fld("direccion", "Dirección del cliente", "", { full: true }) : ""}${fld("celular", "Celular del cliente (opcional, para enviarla por WhatsApp)", "", { extra: 'inputmode="tel" maxlength="15"', full: true })}</div>
    <h3 class="sub">Productos o servicios <small class="muted">(precio CON IGV, como lo cobras · escribe o elige de tu portafolio)</small></h3>
    <div id="fIt"></div><button type="button" class="btn btn-light btn-sm" id="fAdd">${ico("plus")} Agregar línea</button>
    <div class="fact-tot" id="fTot"></div>${catalogoHTML()}`, async (d, F) => {
    const items = $$(".f-it", F).map(r => ({ desc: $(".f-d", r).value.trim(), cant: +$(".f-c", r).value, precio: +$(".f-p", r).value })).filter(i => i.desc || i.precio);
    if (!items.length) return toast("Agrega al menos un producto", true), false;
    if (items.some(i => !i.desc || !(i.cant > 0) || !(i.precio > 0))) return toast("Revisa los productos: descripción, cantidad y precio", true), false;
    if (!fac && d.tipoDoc === "1" && !/^\d{8}$/.test(d.num)) return toast("El DNI debe tener 8 dígitos", true), false;
    if (fac && !/^\d{11}$/.test(d.num)) return toast("El RUC del cliente debe tener 11 dígitos", true), false;
    const cliente = d.num ? { tipoDoc: fac ? "6" : (d.tipoDoc === "0" ? "1" : d.tipoDoc), num: d.num, nombre: d.nombre, direccion: d.direccion || "" } : {};
    $("#mOk").textContent = "Enviando a la SUNAT…";
    const c = await servidor("emitir", { empresaId: FACT.emp, tipo, cliente, items, celular: d.celular || "" });
    const e = EST_C[c.estado] || [c.estado];
    toast(`${nComp(c)} · ${e[0]}`, !["aceptado", "observado"].includes(c.estado));
    cerrarModal(); await VIEWS.facturacion(); verComprobante(c, emp); return false;
  }, "Emitir y enviar a SUNAT", { wide: true, alAbrir: F => {
    const fila = () => { $("#fIt", F).insertAdjacentHTML("beforeend", `<div class="f-it"><input class="f-d" list="catFact" placeholder="Escribe o elige del catálogo" maxlength="250"><input class="f-c" type="number" value="1" min="0.01" step="0.01" aria-label="Cantidad"><input class="f-p" type="number" min="0" step="0.01" placeholder="Precio S/" aria-label="Precio con IGV"><button type="button" class="btn btn-light btn-sm f-x" aria-label="Quitar">${ico("x")}</button></div>`); tot(); };
    const tot = () => { if (!$("#fTot", F)) return; const t = $$(".f-it", F).reduce((a, r) => a + (+$(".f-c", r).value || 0) * (+$(".f-p", r).value || 0), 0), tasa = emp.afectacion === "10" ? (emp.igv || 18) / 100 : 0, g = t / (1 + tasa);
      $("#fTot", F).innerHTML = `<span>Op. gravada ${S(g)}</span><span>IGV ${S(t - g)}</span><b>Total ${S(t)}</b>${!fac && t > 700 && !$("[name=num]", F).value ? `<em>Pasa de S/ 700: pon el DNI del cliente</em>` : ""}`; };
    $("#fAdd", F).onclick = fila; F.oninput = tot; F.onclick = e => { const x = e.target.closest(".f-x"); if (x && $$(".f-it", F).length > 1) { x.parentElement.remove(); tot(); } };
    fila(); catalogoEnlazar(F);
  } });
}

/* ---------- Modo real: certificado .pfx y usuario secundario SOL ---------- */
function formCertificado(emp) {
  const F0 = $("#mF"); if (F0) { F0.oninput = null; F0.onclick = null; }
  const p = emp.prod || {};
  modal("Modo real · certificado y usuario SOL", `${p.listo ? `<div class="alert ok sm">${ico("check")} Ya tienes guardado el usuario <b>${esc(p.usuario)}</b> y un certificado vigente hasta <b>${esc(fLarga(p.certVence))}</b>. Solo vuelve a subirlos si cambiaron.</div>` : ""}
    <p>Se guardan <b>cifrados</b> en el servidor de facturación: nadie puede leerlos desde la web ni desde Firebase.</p>
    <div class="g2"><label class="fld full"><span>Certificado digital (.pfx o .p12) *</span><input type="file" name="archivo" accept=".pfx,.p12,application/x-pkcs12" required></label>
    ${fld("pfxClave", "Contraseña del certificado", "", { type: "password", req: true, extra: 'autocomplete="off"' })}
    ${fld("solUsuario", "Usuario secundario SOL", p.usuario || "FACTURA1", { req: true, help: `Solo el usuario (ej. FACTURA1), sin el RUC ${esc(emp.ruc)}.` })}
    ${fld("solClave", "Clave del usuario secundario", "", { type: "password", req: true, extra: 'autocomplete="new-password"' })}</div>`, async (d, F) => {
    const file = $("[name=archivo]", F).files[0]; if (!file) return toast("Elige el archivo del certificado", true), false;
    if (file.size > 150000) return toast("Ese archivo es muy grande para ser un certificado", true), false;
    const pfx = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(file); });
    $("#mOk").textContent = "Guardando…";
    const r = await servidor("credenciales", { empresaId: FACT.emp, pfx, pfxClave: d.pfxClave, solUsuario: d.solUsuario, solClave: d.solClave });
    toast(`Listo: usuario ${r.usuario} · certificado hasta ${fLarga(r.certVence)}`); VIEWS.facturacion();
  }, "Guardar cifrado", { wide: true });
}

/* ---------- Anular con nota de crédito ---------- */
function formAnular(c, emp) {
  const F0 = $("#mF"); if (F0) { F0.oninput = null; F0.onclick = null; }
  modal(`Anular ${TIPO_N[c.tipo].toLowerCase()} ${nComp(c)}`, `<p>Se emitirá una <b>nota de crédito</b> por el total (${S(c.total)}) y se enviará a la SUNAT. ${REAL(emp) ? "<b>Es real: no se puede deshacer.</b>" : "(Modo pruebas)"}</p>
    ${fld("motivo", "Motivo", "ANULACIÓN DE LA OPERACIÓN", { req: true, full: true, ph: "Ej. Error en el precio, devolución del producto" })}`, async d => {
    $("#mOk").textContent = "Enviando a la SUNAT…";
    const n = await servidor("anular", { empresaId: FACT.emp, id: c.id, motivo: d.motivo });
    toast(`Nota de crédito ${nComp(n)} · ${(EST_C[n.estado] || [n.estado])[0]}`, !vale(n));
    cerrarModal(); await VIEWS.facturacion(); verComprobante(n, emp); return false;
  }, "Emitir nota de crédito");
}

/* ---------- Nota de venta (interna, no va a la SUNAT) ---------- */
function formNotaVenta(emp) {
  const F0 = $("#mF"); if (F0) { F0.oninput = null; F0.onclick = null; }
  modal("Nueva nota de venta", `<div class="alert warn sm">${ico("alert")} <span><b>Documento interno:</b> no se envía a la SUNAT y <b>no es comprobante de pago</b>. Por regla general debes emitir boleta; consulta con tu contador cuándo usar la nota de venta.</span></div>
    <div class="g2">${fld("tipoDoc", "Documento del cliente (opcional)", "0", { opts: [["0", "Sin documento"], ["1", "DNI"], ["6", "RUC"], ["4", "Carné de extranjería"], ["7", "Pasaporte"]] })}
    ${fld("num", "Número de documento", "", { extra: 'inputmode="numeric" maxlength="15"' })}${fld("nombre", "Nombre del cliente (opcional)", "", { full: true })}${fld("celular", "Celular del cliente (opcional, para enviarla por WhatsApp)", "", { extra: 'inputmode="tel" maxlength="15"', full: true })}</div>
    <h3 class="sub">Productos o servicios <small class="muted">(precio final, como lo cobras)</small></h3>
    <div id="fIt"></div><button type="button" class="btn btn-light btn-sm" id="fAdd">${ico("plus")} Agregar línea</button><div class="fact-tot" id="fTot"></div>${catalogoHTML()}`, async (d, F) => {
    const items = $$(".f-it", F).map(r => ({ desc: $(".f-d", r).value.trim(), cant: +$(".f-c", r).value, precio: +$(".f-p", r).value })).filter(i => i.desc || i.precio);
    if (!items.length) return toast("Agrega al menos un producto", true), false;
    if (items.some(i => !i.desc || !(i.cant > 0) || !(i.precio > 0))) return toast("Revisa los productos: descripción, cantidad y precio", true), false;
    const cliente = d.num && d.tipoDoc !== "0" ? { tipoDoc: d.tipoDoc, num: d.num, nombre: d.nombre } : { nombre: d.nombre };
    $("#mOk").textContent = "Guardando…";
    const c = await servidor("notaVenta", { empresaId: FACT.emp, cliente, items, celular: d.celular || "" });
    toast(`Nota de venta ${nComp(c)} guardada`); cerrarModal(); await VIEWS.facturacion(); verComprobante(c, emp); return false;
  }, "Guardar nota de venta", { wide: true, alAbrir: F => {
    const fila = () => { $("#fIt", F).insertAdjacentHTML("beforeend", `<div class="f-it"><input class="f-d" list="catFact" placeholder="Escribe o elige del catálogo" maxlength="250"><input class="f-c" type="number" value="1" min="0.01" step="0.01" aria-label="Cantidad"><input class="f-p" type="number" min="0" step="0.01" placeholder="Precio S/" aria-label="Precio"><button type="button" class="btn btn-light btn-sm f-x" aria-label="Quitar">${ico("x")}</button></div>`); tot(); };
    const tot = () => { if (!$("#fTot", F)) return; const t = $$(".f-it", F).reduce((a, r) => a + (+$(".f-c", r).value || 0) * (+$(".f-p", r).value || 0), 0); $("#fTot", F).innerHTML = `<b>Total ${S(t)}</b>`; };
    $("#fAdd", F).onclick = fila; F.oninput = tot; F.onclick = e => { const x = e.target.closest(".f-x"); if (x && $$(".f-it", F).length > 1) { x.parentElement.remove(); tot(); } };
    fila(); catalogoEnlazar(F);
  } });
}
function formAnularNV(c, emp) {
  const F0 = $("#mF"); if (F0) { F0.oninput = null; F0.onclick = null; }
  modal(`Anular nota de venta ${nComp(c)}`, `<p>La nota quedará marcada como <b>ANULADA</b> (no se borra). Total: ${S(c.total)}.</p>${fld("motivo", "Motivo", "ANULACIÓN", { req: true, full: true })}`, async d => {
    await servidor("anularNota", { empresaId: FACT.emp, id: c.id, motivo: d.motivo }); toast(`${nComp(c)} anulada`); VIEWS.facturacion();
  }, "Anular nota");
}

/* ---------- Catálogo: portafolio, planes y servicios para elegir al hacer un comprobante ---------- */
function catalogoFact() {
  const tc = +CAT.aj.tipoCambio || 3.75, sol = (v, m) => r2(m === "PEN" ? +v : +v * tc), L = [];
  CAT.port.filter(p => p.visible !== false).forEach(p => {
    if (+p.precio > 0) L.push([`${p.nombre} · ${(p.tipo || "sistema") === "sistema" ? "compra completa" : TIPOS[p.tipo] || "proyecto"}`, sol(p.precio, p.moneda)]);
    if ((p.tipo || "sistema") === "sistema" && p.demo && p.mensualActivo !== false) L.push([`${p.nombre} · plan mensual`, r2(+p.mensual || +CAT.aj.mensual || 120)]);
  });
  CAT.planes.filter(p => p.visible !== false && +p.precio > 0).forEach(p => L.push([`Plan ${p.nombre} · ${p.tipo || "Página web"}`, sol(p.precio, p.moneda)]));
  if (+CAT.aj.instalacion > 0) L.push(["Instalación con dominio propio", r2(+CAT.aj.instalacion)]);
  return L;
}
function catalogoHTML() { return `<datalist id="catFact">${catalogoFact().map(([n, v]) => `<option value="${esc(n)}">${S(v)}</option>`).join("")}</datalist>`; }
function catalogoEnlazar(F) {
  const M = new Map(catalogoFact());
  F.addEventListener("change", e => { const d = e.target.closest(".f-d"); if (!d || !M.has(d.value)) return; const p = $(".f-p", d.parentElement); p.value = M.get(d.value); p.dispatchEvent(new Event("input", { bubbles: true })); });
}

/* ---------- Comprobante por cada PAGO de un pedido (adelanto, saldo, mensualidad) ---------- */
function conceptoPagoTxt(p, idx) {
  const pagos = p.pagos || [], hasta = pagos.slice(0, idx + 1).reduce((a, x) => a + (+x.monto || 0), 0), total = +p.total || 0;
  const t = p.modalidad === "mensual" ? (idx === 0 ? `Primer mes${p.dominio ? " + instalación" : ""}` : "Mensualidad") : hasta >= total - .01 ? (idx === 0 ? "Pago total" : "Pago final (saldo)") : (idx === 0 ? "Adelanto" : "Pago a cuenta");
  return `${t} · ${(p.items || []).map(i => i.n).filter(Boolean).join(" + ") || "Proyecto web"} · Pedido ${p.codigo || p.id}`.slice(0, 250);
}
// Bloque que va dentro de cada pedido: un renglón por pago, con su boleta o el botón para emitirla
function bloqueCpe(p) {
  const pagos = p.pagos || []; if (!pagos.length) return "";
  const fac = p.comprobante === "Factura";
  return `<div class="cpe-b"><b>🧾 Comprobantes SUNAT</b>${pagos.map((x, i) => { const c = (p.cpes || {})[i], e = c && c.id ? EST_C[c.estado] || [c.estado, "mute"] : null;
    return `<div class="cpe-r"><span>${esc(conceptoPagoTxt(p, i).split(" · ")[0])} · ${S(x.monto)}<small>${x.fecha ? fLarga(x.fecha) : ""}${x.metodo ? " · " + esc(x.metodo) : ""}</small></span>
      ${c && c.id ? `<span class="st ${c.anulado ? "bad" : e[1]}">${esc(c.id)} · ${c.anulado ? "Anulada" : e[0]}</span><button class="btn btn-light btn-xs" data-pa="cpever|${esc(p.id)}|${i}">Ver / imprimir</button><button class="btn btn-wa btn-xs" data-pa="cpewa|${esc(p.id)}|${i}" title="Enviar por WhatsApp">${ico("wa")}</button>`
        : c && c.estado === "emitiendo" ? `<span class="st warn">Emitiendo…</span>`
        : `<button class="btn btn-pri btn-xs" data-pa="cpe|${esc(p.id)}|${i}">Emitir ${fac ? "factura" : "boleta"}</button>`}</div>`; }).join("")}</div>`;
}
async function accionCpe(a, p, idx) {
  const emp = await DB.get(FACT.col, FACT.emp);
  if (!emp) return toast("Primero configura «Facturación SUNAT» (datos del emisor)", true);
  const i = +idx, pago = (p.pagos || [])[i]; if (!pago) return toast("Ese pago no existe", true);
  if (a === "cpewa") { const c = (p.cpes || {})[i]; return c && c.id ? enviarWA({ ...c, celular: p.celular, pedido: p.codigo || p.id }, emp, p.nombre) : null; }
  if (a === "cpever") { const c = (p.cpes || {})[i]; const full = c && c.id ? await DB.get(FACT_COMP(emp), c.id) : null; return verComprobante(full || c, emp); }
  const doc = String(p.doc || "").replace(/\D/g, ""), fac0 = p.comprobante === "Factura";
  modal(`Emitir comprobante · ${p.codigo || p.id}`, `${REAL(emp) ? "" : `<div class="alert warn sm">${ico("alert")} Modo PRUEBAS: se envía al ambiente de pruebas de la SUNAT.</div>`}
    <p><b>${esc(conceptoPagoTxt(p, i))}</b><br>Monto: <b>${S(pago.monto)}</b>${pago.metodo ? ` · ${esc(pago.metodo)}` : ""}</p>
    <div class="g2">${fld("tipo", "Comprobante", fac0 ? "01" : "03", { opts: [["03", "Boleta"], ["01", "Factura"]], help: `El cliente pidió: ${esc(p.comprobante || "Boleta")}` })}
    ${fld("num", "DNI o RUC del cliente", doc, { extra: 'inputmode="numeric" maxlength="11"', help: "Factura: RUC de 11 dígitos. Boleta: DNI (obligatorio si pasa de S/ 700)." })}
    ${fld("nombre", "Nombre o razón social", fac0 ? p.negocio || p.nombre : p.nombre, { req: true, full: true })}${fld("direccion", "Dirección (solo factura, opcional)", "", { full: true })}</div>`, async d => {
    const n = String(d.num || "").replace(/\D/g, "");
    if (d.tipo === "01" && n.length !== 11) return toast("Para factura necesitas el RUC de 11 dígitos", true), false;
    if (n && ![8, 11].includes(n.length)) return toast("El DNI tiene 8 dígitos y el RUC 11", true), false;
    $("#mOk").textContent = "Enviando a la SUNAT…";
    const cliente = n ? { tipoDoc: n.length === 11 ? "6" : "1", num: n, nombre: d.nombre, direccion: d.direccion } : { nombre: d.nombre };
    const c = await servidor("emitirPago", { empresaId: FACT.emp, pedidoId: p.id, idx: i, tipo: d.tipo, cliente });
    toast(`${nComp(c)} · ${(EST_C[c.estado] || [c.estado])[0]}`, !vale(c)); cerrarModal(); refrescar(); verComprobante(c, emp); return false;
  }, "Emitir y enviar a SUNAT", { wide: true });
}

/* ---------- Enviar el comprobante por WhatsApp y generar el PDF ---------- */
const WEB_FACT = () => String((window.APP && APP.web) || "https://ziko.pro").replace(/\/$/, "");
function textoWA(c, emp, nombre) {
  const quien = String(nombre || (c.cliente && c.cliente.nombre !== "CLIENTES VARIOS" ? c.cliente.nombre : "") || "").split(" ")[0];
  const tipo = c.tipo === "NV" ? "Nota de venta" : `${TIPO_N[c.tipo] || "Comprobante"} electrónica`;
  return `Hola${quien ? " " + quien.charAt(0) + quien.slice(1).toLowerCase() : ""} 👋 te escribe *${emp.nombreComercial || emp.razon}*.\n\nTe enviamos tu *${tipo} ${nComp(c)}* por *S/ ${f2(c.total)}* (${String(c.fecha).split("-").reverse().join("/")}).`
    + (c.pedido && c.tipo !== "NV" ? `\n\nPuedes verla y descargarla en PDF aquí:\n${WEB_FACT()}/mis-compras?c=${encodeURIComponent(c.pedido)}` : "\n\nTe la adjuntamos en PDF.")
    + (c.tipo !== "NV" && c.modo === "produccion" ? `\n\nTambién puedes validarla en www.sunat.gob.pe con RUC ${emp.ruc}.` : "") + "\n\n¡Gracias por tu compra! 🙌";
}
function enviarWA(c, emp, nombre) {
  const num = String(c.celular || "").replace(/\D/g, "");
  if (!num) toast("No tiene celular guardado: elige el contacto en WhatsApp", true);
  abrirWA(num, textoWA(c, emp, nombre));
}
async function pdfComprobante(c, emp) {
  const J = await jsPDF_(), doc = new J({ unit: "mm", format: "a4" }), W = 210, M = 16, nv = esNV(c);
  const T = (t, x, y, o) => doc.text(String(t ?? ""), x, y, o), F = (b, z, col = 20) => { doc.setFont("helvetica", b ? "bold" : "normal"); doc.setFontSize(z); doc.setTextColor(col); };
  let y = 18;
  if (!nv && c.modo !== "produccion") { doc.setDrawColor(180, 83, 9); doc.setLineDashPattern([1.5, 1], 0); doc.rect(M, 8, W - 2 * M, 7); doc.setLineDashPattern([], 0); F(1, 9, 120); T("COMPROBANTE DE PRUEBA · SIN VALOR TRIBUTARIO", W / 2, 13, { align: "center" }); y = 24; }
  F(1, 14); T(emp.nombreComercial || emp.razon, M, y); F(0, 9, 60);
  const dir = doc.splitTextToSize([emp.direccion, emp.distrito, emp.provincia, emp.departamento].filter(Boolean).join(" - "), 100);
  if (emp.nombreComercial) T(emp.razon, M, y + 5); doc.text(dir, M, y + (emp.nombreComercial ? 10 : 5)); if (emp.telefono) T("Tel. " + emp.telefono, M, y + 15);
  doc.setDrawColor(20); doc.setLineWidth(.6); doc.roundedRect(W - M - 72, y - 6, 72, 24, 2, 2); F(1, 10.5);
  T("RUC " + emp.ruc, W - M - 36, y, { align: "center" }); doc.text(doc.splitTextToSize(TIPO_C[c.tipo], 66), W - M - 36, y + 6, { align: "center" }); T(nComp(c), W - M - 36, y + (TIPO_C[c.tipo].length > 26 ? 15 : 11), { align: "center" });
  y += 26;
  if (nv) { doc.setDrawColor(20); doc.rect(M, y, W - 2 * M, 9); F(1, 10.5); T("NO VÁLIDO COMO COMPROBANTE DE PAGO · documento interno", W / 2, y + 6, { align: "center" }); y += 14; }
  if (c.anulado) { doc.setDrawColor(180, 35, 24); doc.rect(M, y, W - 2 * M, 8); F(1, 10, 140); T("ANULADO" + (nv ? "" : " CON " + c.anulado), W / 2, y + 5.5, { align: "center" }); y += 13; }
  F(0, 9.5); const cl = c.cliente || {};
  T(`Fecha de emisión: ${String(c.fecha).split("-").reverse().join("/")} ${c.hora || ""}`, M, y); y += 5.5;
  T(`Cliente: ${cl.nombre || ""}${cl.num && cl.num !== "-" ? ` · ${DOC_ID[cl.tipoDoc] || "Doc."} ${cl.num}` : ""}`, M, y); y += 5.5;
  if (c.tipo === "07" && c.refDoc) { T(`Documento que modifica: ${c.refDoc.id} · Motivo: ${c.refDoc.motivo || ""}`, M, y); y += 5.5; }
  y += 3; doc.setFillColor(242, 245, 249); doc.rect(M, y, W - 2 * M, 8, "F"); F(1, 9);
  T("Cant.", M + 2, y + 5.5); T("Descripción", M + 18, y + 5.5); T("P. unit.", W - M - 32, y + 5.5, { align: "right" }); T("Importe", W - M - 2, y + 5.5, { align: "right" }); y += 13; F(0, 9.5);
  (c.items || []).forEach(l => { const d = doc.splitTextToSize(String(l.desc || ""), 105); T(l.cant, M + 2, y); doc.text(d, M + 18, y); T(f2(l.precio), W - M - 32, y, { align: "right" }); T(f2(l.total), W - M - 2, y, { align: "right" }); y += 5 * d.length + 2; });
  y += 2; doc.setDrawColor(210); doc.line(M, y, W - M, y); y += 7;
  const fila = (a, b, bold) => { F(bold, bold ? 11.5 : 9.5); T(a, W - M - 40, y, { align: "right" }); T(b, W - M - 2, y, { align: "right" }); y += bold ? 7 : 5.5; };
  fila(emp.afectacion === "20" ? "Op. exonerada" : "Op. gravada", "S/ " + f2(c.gravada)); fila(`IGV (${emp.afectacion === "20" ? 0 : emp.igv || 18}%)`, "S/ " + f2(c.igv)); fila("TOTAL", "S/ " + f2(c.total), 1);
  F(0, 9.5); doc.text(doc.splitTextToSize("SON: " + (c.letras || ""), W - 2 * M), M, y + 2); y += 12;
  if (!nv) { const qr = await qrDataURL(c.qr); if (qr) doc.addImage(qr, "PNG", M, y, 32, 32); F(0, 8.5, 80);
    doc.text(doc.splitTextToSize(`Representación impresa de la ${TIPO_C[c.tipo].toLowerCase()}. Resumen: ${c.hash || ""}. Consulte su validez en www.sunat.gob.pe`, W - 2 * M - 40), M + 38, y + 8); y += 38; }
  F(0, 8, 120); T("Emitido con Facturación ziko.pro", W / 2, 287, { align: "center" });
  return new File([doc.output("blob")], `${emp.ruc}-${c.tipo}-${nComp(c)}.pdf`, { type: "application/pdf" });
}
async function compartirPDF(c, emp) {
  let file; try { file = await pdfComprobante(c, emp); } catch (e) { console.error(e); return toast("No se pudo generar el PDF", true); }
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: nComp(c), text: textoWA(c, emp) }); return; } catch (e) { if (e.name === "AbortError") return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("PDF descargado: adjúntalo en WhatsApp Web 📎");
}
