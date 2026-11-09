/* =========================================================
   ziko.pro — Panel · Vistas
   ========================================================= */
const VIEWS = {}; let VISTA = "inicio";
const TODOS = ["Administración", "Ventas"], ADM = ["Administración"];
const NAV = [
  ["inicio", "home", "Inicio", TODOS], ["demos", "key", "Solicitudes de demo", TODOS], ["pedidos", "bag", "Pedidos y proyectos", TODOS],
  ["clientes", "users", "Clientes", TODOS], ["caja", "cash", "Caja", TODOS], ["mensajes", "msg", "Mensajes", TODOS],
  ["portafolio", "grid", "Portafolio y demos", ADM], ["planes", "tag", "Planes y precios", ADM], ["reportes", "chart", "Reportes", ADM], ["ajustes", "gear", "Ajustes", ADM]
];
const puede = v => (NAV.find(n => n[0] === v) || [, , , []])[3].includes(YO().rol);
const LOGO = `<svg class="zk-logo" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="zl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a6fdb"/><stop offset="1" stop-color="#22c3be"/></linearGradient></defs><path d="M18 24h52L30 76h52" stroke="url(#zl)" stroke-width="13" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M62 12l14 12-14 12M38 64L24 76l14 12" stroke="currentColor" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const WEB = () => String(APP.web || "https://ziko.pro").replace(/\/$/, "");
const k9 = c => String(c || "").replace(/\D/g, "").slice(-9);
const fechaL = ms => new Date(ms).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
const recorta = (t, n) => { t = String(t || ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

/* ================= Sesión ================= */
function pantallaLogin() {
  document.body.innerHTML = `<main class="login"><form class="l-box" id="lf"><div class="l-logo">${LOGO}</div><h1>Panel · ziko.pro</h1><p>Entra con el correo de tu equipo.</p>
    ${DEMO ? `<div class="demo-n"><b>MODO DEMO</b> · elige con qué rol probar:</div>${fld("rol", "Entrar como", APP.equipo[0].email, { opts: APP.equipo.map(p => [p.email, `${p.nombre} · ${p.rol}`]) })}`
      : `${fld("email", "Correo", "", { type: "email", req: true, extra: 'autocomplete="username"' })}${fld("pass", "Contraseña", "", { type: "password", req: true, extra: 'autocomplete="current-password"' })}`}
    <p class="l-err" id="lErr" role="alert"></p><button class="btn btn-pri btn-lg">Entrar</button></form></main>`;
  $("#lf").addEventListener("submit", async e => {
    e.preventDefault(); const d = datosForm(e.currentTarget), err = $("#lErr");
    if (DEMO) { sessionStorage.setItem("zk_admin", d.rol); return iniciar(perfil(d.rol)); }
    try { const { au, auth } = await fb(); await au.signInWithEmailAndPassword(auth, d.email, d.pass); }
    catch (er) { err.textContent = /invalid|wrong|user-not-found/i.test(er.code || "") ? "Correo o contraseña incorrectos." : "No se pudo entrar: " + (er.code || er.message); }
  });
}
async function salir() { if (DEMO) sessionStorage.removeItem("zk_admin"); else { const { au, auth } = await fb(); await au.signOut(auth); } location.reload(); }
async function arrancar() {
  if (DEMO) { const e = sessionStorage.getItem("zk_admin"); return e && perfil(e) ? iniciar(perfil(e)) : pantallaLogin(); }
  const { au, auth } = await fb();
  au.onAuthStateChanged(auth, u => { if (!u) return pantallaLogin(); const p = perfil(u.email); if (!p) { document.body.innerHTML = `<main class="login"><div class="l-box"><h1>Sin permiso</h1><p>${esc(u.email)} no está en el equipo (firebase-config.js → equipo).</p><button class="btn btn-pri" onclick="salir()">Salir</button></div></main>`; return; } iniciar(p); });
}
async function iniciar(p) {
  USER = p; await cargarCatalogo();
  if (!CAT.port.length && esAdm() && !DEMO) VISTA = "ajustes";
  const nav = NAV.filter(n => n[3].includes(p.rol));
  document.body.innerHTML = `<div class="shell"><aside class="side" id="side"><div class="s-brand">${LOGO}<div><b></b><small>Panel administrativo</small></div></div>
      <nav class="s-nav">${nav.map(([k, i, t]) => `<button data-v="${k}">${ico(i)}<span>${t}</span><b class="cnt" id="cnt-${k}" hidden></b></button>`).join("")}</nav>
      <div class="s-user"><small>Sesión</small><b>${esc(p.nombre)}</b><span class="st mute">${esc(p.rol)}</span>${DEMO ? `<span class="st warn">MODO DEMO</span>` : ""}<a class="btn btn-light btn-sm" href="${esc(WEB())}" target="_blank" rel="noopener">${ico("arrow")} Ver la web</a><button class="btn btn-light btn-sm" id="salir">${ico("logout")} Salir</button></div></aside>
    <div class="main"><header class="tb"><button class="tb-m" id="menuB" aria-label="Menú">${ico("menu")}</button><span class="tb-f">${fmtF(HOY(), { weekday: "long", day: "numeric", month: "long" })}</span>
      <button class="btn btn-pri btn-sm" data-go="pedidos" data-nuevo="1">${ico("plus")} <span>Nuevo proyecto</span></button></header>
      <main id="view" class="view" tabindex="-1"></main></div></div>`;
  marcaPanel();
  $(".s-nav").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) go(b.dataset.v); });
  $("#salir").addEventListener("click", salir); $("#menuB").addEventListener("click", () => $("#side").classList.toggle("open"));
  document.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if (!g) return; if (g.dataset.nuevo) NUEVO_PROY = true; go(g.dataset.go); });
  go(puede(VISTA) ? VISTA : nav[0][0]); vigilar(); setInterval(vigilar, 20000);
}
async function go(v) {
  VISTA = v; $$(".s-nav button").forEach(b => b.setAttribute("aria-current", b.dataset.v === v ? "page" : "false")); $("#side")?.classList.remove("open");
  $("#view").innerHTML = `<div class="loading"><span class="spin"></span></div>`;
  try { await VIEWS[v](); if (!CAT.port.length && esAdm() && v !== "ajustes") $("#view").insertAdjacentHTML("afterbegin", `<div class="alert warn">${ico("alert")} <span><b>Tu web aún no tiene portafolio ni planes guardados.</b> Ve a Ajustes y pulsa «Cargar ejemplos» para empezar a editarlos.</span><button class="btn btn-pri btn-sm" data-go="ajustes">Ir a Ajustes</button></div>`); }
  catch (e) { console.error(e); $("#view").innerHTML = `<div class="empty">${ico("alert")}<p>No se pudo cargar: ${esc(e.message)}</p></div>`; }
}
const refrescar = () => go(VISTA);
let ULT = null;
async function vigilar() {
  try {
    const [sols, peds, msgs] = await Promise.all([DB.list("solicitudes", ["estado", "==", "nuevo"]), DB.list("pedidos", ["estado", "==", "por-validar"]), DB.list("mensajes", ["estado", "==", "nuevo"])]);
    const set = (k, n) => { const b = $("#cnt-" + k); if (b) { b.textContent = n; b.hidden = !n; } };
    set("demos", sols.length); set("pedidos", peds.length); set("mensajes", msgs.length);
    const n = sols.length + peds.length;
    if (ULT !== null && n > ULT) { beep(); toast(`🔔 ${n - ULT} aviso(s) nuevo(s): solicitud de demo o pago`); if (["inicio", "demos", "pedidos"].includes(VISTA)) VIEWS[VISTA](); }
    ULT = n;
  } catch (e) { console.warn("vigilar:", e.message); }
}
function movimiento(m) { return { op: "set", col: "movimientos", id: codigo("MV"), data: { fecha: HOY(), hora: new Date().toISOString(), usuario: YO().nombre, ...m, monto: r2(m.monto) } }; }
const faltanEnlaces = () => CAT.port.filter(p => p.demo && p.visible !== false && !(CAT.links[p.id] || {}).web);

/* ================= INICIO ================= */
VIEWS.inicio = async () => {
  await cargarCatalogo();
  const hoy = HOY(), [sols, peds, movs, msgs] = await Promise.all([DB.list("solicitudes"), DB.list("pedidos"), DB.list("movimientos", ["fecha", "==", hoy]), DB.list("mensajes", ["estado", "==", "nuevo"])]);
  const nuevas = sols.filter(s => s.estado === "nuevo").sort((a, b) => String(b.creado).localeCompare(a.creado)), act = peds.filter(p => ["por-validar", "confirmado", "desarrollo"].includes(p.estado));
  const porCobrar = peds.filter(p => ["confirmado", "desarrollo", "entregado"].includes(p.estado)).reduce((a, p) => a + saldoDe(p), 0), falt = faltanEnlaces();
  const K = [["Caja de hoy", S(movs.reduce((a, m) => a + m.monto, 0)), `${movs.length} movimiento(s)`], ["Demos por atender", nuevas.length, "esperan su código"], ["Pagos por validar", act.filter(p => p.estado === "por-validar").length, "con captura"], ["Proyectos en curso", act.filter(p => p.estado !== "por-validar").length, `${S(porCobrar)} por cobrar`]];
  $("#view").innerHTML = topBar(`Hola, ${esc(YO().nombre)}`, "Así va ziko.pro hoy.") + `
    ${falt.length && esAdm() ? `<div class="alert warn">${ico("alert")} <span>Faltan los enlaces de <b>${falt.map(p => esc(p.nombre)).join(", ")}</b>. Sin ellos, el cliente no verá la demo.</span><button class="btn btn-sm btn-light" data-go="portafolio">Completar</button></div>` : ""}
    <div class="kpis">${K.map(([a, b, c]) => `<div class="kpi"><span>${a}</span><b>${b}</b><small>${c}</small></div>`).join("")}</div>
    <div class="two"><section class="card"><div class="card-h"><h2>${ico("key")} Solicitudes de demo</h2><button class="btn btn-light btn-sm" data-go="demos">Ver todas</button></div>
      <ul class="lst">${nuevas.slice(0, 8).map(s => `<li><div><b>${esc(s.nombre)}</b><small>${esc(s.sistema === "todos" ? "Todos los sistemas" : portDe(s.sistema).nombre || s.sistema)} · ${hace(s.creado)}${s.negocio ? " · " + esc(recorta(s.negocio, 40)) : ""}</small></div><span class="st warn">Sin código</span></li>`).join("") || `<li class="muted">No hay solicitudes pendientes. 👍</li>`}</ul></section>
    <section class="card"><div class="card-h"><h2>${ico("bag")} Pedidos y proyectos</h2><button class="btn btn-light btn-sm" data-go="pedidos">Ver todos</button></div>
      <ul class="lst">${act.sort((a, b) => String(a.creado).localeCompare(b.creado)).slice(0, 8).map(p => `<li><div><b>${esc(p.nombre)} · ${S(p.total)}</b><small>${esc(p.codigo || p.id)} · ${esc((p.items || [])[0]?.n || "")}${saldoDe(p) && p.estado !== "por-validar" ? ` · saldo ${S(saldoDe(p))}` : ""}</small></div>${estP(p.estado)}</li>`).join("") || `<li class="muted">No hay proyectos en curso.</li>`}</ul></section></div>
    ${msgs.length ? `<div class="alert warn">${ico("msg")} <span>Tienes <b>${msgs.length}</b> mensaje(s) sin responder.</span><button class="btn btn-sm btn-light" data-go="mensajes">Ver</button></div>` : ""}`;
};

/* ================= SOLICITUDES DE DEMO Y CÓDIGOS ================= */
let DT = "nuevas";
const msgCodigo = a => {
  const sis = (a.demos || []).map(d => d.nombre).join(", ");
  return `Hola ${String(a.nombre || "").split(" ")[0]} 👋 te saluda *${NOMBRE()}*.\n\nTu código para probar ${(a.demos || []).length > 1 ? "nuestras demos" : "la demo"} (${sis}) es:\n\n*${a.codigo}*\n\n1️⃣ Entra a ${WEB()}/demo\n2️⃣ Escribe tu código y toca *Entrar*\n\nO entra directo aquí: ${WEB()}/demo?codigo=${a.codigo}\n\nVerás la web y el panel administrativo con su usuario y contraseña de prueba. Tu acceso vence el ${fechaL(a.venceMs)}.\n\n¿Alguna duda? Escríbenos por aquí 😊`;
};
const snapDemos = ids => ids.map(id => { const p = portDe(id), l = CAT.links[id] || {}; return { id, nombre: p.nombre || id, web: l.web || "", admin: l.admin || "", usuario: l.usuario || "", clave: l.clave || "", nota: l.nota || "" }; });
function formCodigo(s) {   // s = solicitud (o null para un código manual)
  const demos = CAT.port.filter(p => p.demo), pre = !s || s.sistema === "todos" ? demos.map(p => p.id) : [s.sistema];
  if (!demos.length) return toast("Primero marca qué trabajos tienen demo en «Portafolio y demos»", true);
  modal(s ? `Código para ${s.nombre}` : "Nuevo código de acceso", `${s ? `<p class="muted">${esc(s.celular)}${s.negocio ? " · " + esc(s.negocio) : ""} · pidió: <b>${esc(s.sistema === "todos" ? "todos los sistemas" : portDe(s.sistema).nombre || s.sistema)}</b></p>` : `<div class="g2">${fld("nombre", "Nombre", "", { req: true })}${fld("celular", "Celular (WhatsApp)", "", { req: true, type: "tel" })}</div>`}
    <span class="lbl">Demos que podrá ver</span><div class="chk-g">${demos.map(p => { const ok = !!(CAT.links[p.id] || {}).web; return `<label class="chk"><input type="checkbox" name="d_${esc(p.id)}" ${pre.includes(p.id) ? "checked" : ""}><span>${esc(p.nombre)}${ok ? "" : ` <small class="neg">· falta el enlace</small>`}</span></label>`; }).join("")}</div>
    <div class="g2">${fld("dias", "El código vence en (días)", +CAT.aj.demoDias || 7, { type: "number", extra: 'min="1" max="90"' })}${fld("enviar", "Abrir WhatsApp con el mensaje listo", true, { type: "checkbox" })}</div>`, async d => {
    const ids = demos.map(p => p.id).filter(id => d["d_" + id]); if (!ids.length) { toast("Marca al menos una demo", true); return false; }
    const venceMs = Date.now() + Math.max(1, +d.dias || 7) * 864e5, cod = codigo("ZD", 8);
    const a = { codigo: cod, nombre: s ? s.nombre : d.nombre, celular: s ? s.celular : d.celular, demos: snapDemos(ids), venceMs, vence: new Date(venceMs).toISOString(), activo: true, creado: new Date().toISOString(), solicitud: s ? s.id : "", por: YO().nombre };
    const ops = [{ op: "set", col: "accesos", id: cod, data: a, merge: false }]; if (s) ops.push({ op: "set", col: "solicitudes", id: s.id, data: { estado: "enviado", codigo: cod, enviado: a.creado, por: YO().nombre } });
    await DB.batch(ops); toast(`Código ${cod} creado`); if (d.enviar) abrirWA(a.celular, msgCodigo(a)); vigilar(); VIEWS.demos(); }, "Crear código");
}
VIEWS.demos = async () => {
  await cargarCatalogo();
  const [sols, accs] = await Promise.all([DB.list("solicitudes"), DB.list("accesos")]);
  sols.sort((a, b) => String(b.creado).localeCompare(a.creado)); accs.sort((a, b) => String(b.creado).localeCompare(a.creado));
  const A = {}; accs.forEach(a => A[a.id] = a);
  const TABS = [["nuevas", "Por atender", sols.filter(s => s.estado === "nuevo").length], ["enviadas", "Con código", sols.filter(s => s.estado === "enviado").length], ["codigos", "Códigos de acceso", accs.length], ["descartadas", "Descartadas", sols.filter(s => s.estado === "descartado").length]];
  const estA = a => a.activo === false ? `<span class="st bad">Desactivado</span>` : +a.venceMs < Date.now() ? `<span class="st mute">Vencido</span>` : `<span class="st ok">Activo · vence ${new Date(a.venceMs).toLocaleDateString("es-PE")}</span>`;
  let body = "";
  if (DT === "codigos") body = `<section class="card"><div class="tbl-w"><table class="tbl"><thead><tr><th>Código</th><th>Persona</th><th>Demos</th><th>Estado</th><th></th></tr></thead><tbody>
    ${accs.map(a => `<tr><td class="mono nw"><b>${esc(a.id)}</b><br><small class="muted">${hace(a.creado)}</small></td><td><b>${esc(a.nombre || "")}</b><br><small>${esc(a.celular || "")}</small></td><td><small>${(a.demos || []).map(d => esc(d.nombre)).join("<br>")}</small></td><td>${estA(a)}</td>
      <td><div class="acts-g"><button class="btn btn-wa btn-sm" data-aw="${esc(a.id)}" title="Reenviar por WhatsApp">${ico("wa")}</button><button class="btn btn-light btn-sm" data-ax="${esc(a.id)}">+${+CAT.aj.demoDias || 7} días</button><button class="btn btn-light btn-sm" data-au="${esc(a.id)}" title="Copiar los enlaces actuales del portafolio">Actualizar enlaces</button><button class="btn btn-light btn-sm ${a.activo === false ? "" : "danger"}" data-ao="${esc(a.id)}">${a.activo === false ? "Activar" : "Desactivar"}</button></div></td></tr>`).join("") || `<tr><td colspan="5" class="muted">Aún no hay códigos.</td></tr>`}</tbody></table></div></section>`;
  else { const l = sols.filter(s => DT === "nuevas" ? s.estado === "nuevo" : DT === "enviadas" ? s.estado === "enviado" : s.estado === "descartado");
    body = `<div class="peds">${l.map(s => { const a = A[s.codigo]; return `<article class="card ped ${s.estado === "nuevo" ? "nuevo" : ""}"><div class="ped-i">${ico("key")}</div><div class="ped-b">
      <div class="ped-h"><b>${esc(s.nombre)}</b><span class="muted">${hace(s.creado)}</span>${s.estado === "nuevo" ? `<span class="st warn">Sin código</span>` : s.estado === "enviado" ? (a ? estA(a) : `<span class="st ok">Enviado</span>`) : `<span class="st mute">Descartada</span>`}</div>
      <p>📱 <b>${esc(s.celular)}</b> · quiere probar <b>${esc(s.sistema === "todos" ? "todos los sistemas" : portDe(s.sistema).nombre || s.sistema)}</b>${s.negocio ? ` · 🏪 ${esc(s.negocio)}` : ""}</p>
      ${s.codigo ? `<p class="muted">Código <b class="mono">${esc(s.codigo)}</b>${s.enviado ? " · enviado " + hace(s.enviado) : ""}</p>` : ""}
      <div class="acts-g">${s.estado === "nuevo" ? `<button class="btn btn-pri btn-sm" data-sg="${esc(s.id)}">${ico("key")} Generar código y enviar</button><button class="btn btn-wa btn-sm" data-sw="${esc(s.id)}">${ico("wa")} Escribir</button><button class="btn btn-light btn-sm" data-sd="${esc(s.id)}">Descartar</button>`
        : s.estado === "enviado" ? `${a ? `<button class="btn btn-wa btn-sm" data-aw="${esc(a.id)}">${ico("wa")} Reenviar código</button>` : ""}<button class="btn btn-light btn-sm" data-sg="${esc(s.id)}">${ico("plus")} Nuevo código</button><button class="btn btn-light btn-sm" data-sw="${esc(s.id)}">${ico("wa")} ¿Le gustó?</button>`
        : `<button class="btn btn-light btn-sm" data-sr="${esc(s.id)}">Volver a «Por atender»</button>`}</div></div></article>`; }).join("") || vacio(DT === "nuevas" ? "No hay solicitudes por atender. 👍" : "Nada por aquí.")}</div>`; }
  $("#view").innerHTML = topBar("Solicitudes de demo", "Quienes pidieron probar un sistema desde la web. Genera su código y se lo envías por WhatsApp.", `<div class="seg">${TABS.map(([k, t, n]) => `<button class="${k === DT ? "on" : ""}" data-dt="${k}">${t} (${n})</button>`).join("")}</div><button class="btn btn-pri btn-sm" id="nCod">${ico("plus")} Código manual</button>`) + body;
  $("#nCod").addEventListener("click", () => formCodigo(null));
  $("#view").onclick = async e => {
    const t = e.target.closest("[data-dt]"); if (t) { DT = t.dataset.dt; return VIEWS.demos(); }
    const B = k => e.target.closest(`[data-${k}]`)?.dataset[k], sol = id => sols.find(x => x.id === id);
    if (B("sg")) return formCodigo(sol(B("sg")));
    if (B("sw")) { const s = sol(B("sw")); return abrirWA(s.celular, s.estado === "enviado" ? `Hola ${s.nombre.split(" ")[0]} 👋 te saluda *${NOMBRE()}*. ¿Pudiste probar la demo? ¿Qué te pareció? Si quieres, coordinamos una llamada para ver tu proyecto 😊` : `Hola ${s.nombre.split(" ")[0]} 👋 te saluda *${NOMBRE()}*. Recibimos tu solicitud para probar nuestra demo. `); }
    if (B("sd")) { await DB.set("solicitudes", B("sd"), { estado: "descartado" }); vigilar(); return VIEWS.demos(); }
    if (B("sr")) { await DB.set("solicitudes", B("sr"), { estado: "nuevo" }); vigilar(); return VIEWS.demos(); }
    const a = A[B("aw") || B("ax") || B("au") || B("ao")]; if (!a) return;
    if (B("aw")) { if (a.activo === false || +a.venceMs < Date.now()) return toast("Ese código está vencido o desactivado. Extiéndelo o actívalo primero.", true); return abrirWA(a.celular, msgCodigo({ ...a, codigo: a.id })); }
    if (B("ax")) { const v = Math.max(Date.now(), +a.venceMs) + (+CAT.aj.demoDias || 7) * 864e5; await DB.set("accesos", a.id, { venceMs: v, vence: new Date(v).toISOString(), activo: true }); toast("Código extendido hasta el " + new Date(v).toLocaleDateString("es-PE")); }
    if (B("au")) { await DB.set("accesos", a.id, { demos: snapDemos((a.demos || []).map(d => d.id)) }); toast("Enlaces actualizados en ese código"); }
    if (B("ao")) { await DB.set("accesos", a.id, { activo: a.activo === false }); toast(a.activo === false ? "Código activado" : "Código desactivado"); }
    VIEWS.demos();
  };
};

/* ================= PEDIDOS Y PROYECTOS ================= */
let PT = "pendientes", NUEVO_PROY = false;
const msgCliente = (p, t) => `Hola ${String(p.nombre || "").split(" ")[0]} 👋 te escribe *${NOMBRE()}*.\n\n${t}\n\n🧾 Proyecto *${p.codigo || p.id}* · ${(p.items || [])[0]?.n || ""}`;
VIEWS.pedidos = async () => {
  await cargarCatalogo();
  const todos = (await DB.list("pedidos")).sort((a, b) => String(b.creado).localeCompare(a.creado));
  const TABS = [["pendientes", "Pagos por validar", p => p.estado === "por-validar"], ["curso", "En curso", p => ["confirmado", "desarrollo"].includes(p.estado)], ["hist", "Entregados y anulados", p => ["entregado", "anulado", "rechazado"].includes(p.estado)]];
  if (PT === "pendientes" && !todos.some(TABS[0][2]) && todos.some(TABS[1][2])) PT = "curso";
  const tab = TABS.find(t => t[0] === PT), l = todos.filter(tab[2]).slice(0, 150);
  const ops = {}; todos.forEach(p => { if (p.operacion) ops[p.operacion] = (ops[p.operacion] || 0) + 1; });
  $("#view").innerHTML = topBar("Pedidos y proyectos", "Planes contratados en la web y proyectos que registras tú. Suena cuando llega un pago.", `<div class="seg">${TABS.map(([k, t, f]) => `<button class="${k === PT ? "on" : ""}" data-pt="${k}">${t} (${todos.filter(f).length})</button>`).join("")}</div><button class="btn btn-pri btn-sm" id="np">${ico("plus")} Nuevo proyecto</button>`) +
    (PT === "pendientes" && l.length ? `<div class="alert warn">${ico("alert")} <span>Antes de validar, <b>confirma en tu app de Yape/Plin o en tu banca que el dinero llegó</b>. Una captura se puede editar.</span></div>` : "") +
    `<div class="peds">${l.map(p => { const al = [];
      if (p.estado === "por-validar") { if (p.montoLeido == null) al.push(["warn", "No se pudo leer el monto de la captura."]); else if (p.coincide === false) al.push(["bad", `La captura dice ${S(p.montoLeido)} y debía pagar ${S(p.monto)}.`]); if (p.fechaOk === false) al.push(["bad", "La fecha de la captura no es de hoy."]); if (p.operacion && ops[p.operacion] > 1) al.push(["bad", "Número de operación repetido en otro pedido."]); }
      return `<article class="card ped ${esc(p.estado)}"><div class="ped-i">${ico(p.origen === "web" ? "bag" : "edit")}</div><div class="ped-b">
        <div class="ped-h"><b>${esc(p.nombre)}</b>${p.negocio ? `<span>${esc(p.negocio)}</span>` : ""}<span class="mono">${esc(p.codigo || p.id)}</span><span class="muted">${hace(p.creado)}</span>${estP(p.estado)}</div>
        <p>${(p.items || []).map(i => `<span class="it">${esc(i.n)}</span>`).join("")}${p.boleta ? ` <span class="st ok">🧾 ${esc(p.boleta)}</span>` : ""}</p>
        <div class="mny"><div><small>Total</small><b>${S(p.total)}</b></div><div><small>Pagado</small><b class="okc">${S(p.pagado || 0)}</b></div><div><small>${p.estado === "por-validar" ? "Dice que pagó" : "Saldo"}</small><b class="${p.estado !== "por-validar" && saldoDe(p) ? "neg" : ""}">${S(p.estado === "por-validar" ? p.monto : saldoDe(p))}</b></div>
          <div><small>Pago</small><b>${esc(p.pago || "—")}${p.banco ? " " + esc(p.banco) : ""}</b>${p.operacion ? `<small>op. ${esc(p.operacion)}</small>` : ""}</div></div>
        ${p.detalle ? `<p class="muted det">📝 ${esc(recorta(p.detalle, 220))}</p>` : ""}
        <p class="muted">📱 ${esc(p.celular || "")}${p.email ? " · ✉️ " + esc(p.email) : ""} · ${esc(p.comprobante || "")}${p.doc ? " " + esc(p.doc) : ""}${p.motivo ? " · Motivo: " + esc(p.motivo) : ""}</p>
        ${al.map(([c, t]) => `<div class="alert ${c} sm">${ico("alert")} ${t}</div>`).join("")}
        <div class="acts-g">${accionesPedido(p)}<button class="btn btn-light btn-sm" data-pa="pdf|${esc(p.id)}">${ico("file")} Recibo</button><button class="btn btn-light btn-sm" data-pa="boleta|${esc(p.id)}">🧾 ${p.boleta ? "Editar N°" : "N° de boleta"}</button><button class="btn btn-wa btn-sm" data-pa="wa|${esc(p.id)}">${ico("wa")}</button></div></div></article>`; }).join("") || vacio("No hay proyectos aquí.")}</div>`;
  $("#np").addEventListener("click", () => formProyecto());
  $("#view").onclick = async e => {
    const t = e.target.closest("[data-pt]"); if (t) { PT = t.dataset.pt; return VIEWS.pedidos(); }
    const b = e.target.closest("[data-pa]"); if (!b) return; const [a, id] = b.dataset.pa.split("|"), p = todos.find(x => x.id === id); if (p) accionPedido(a, p);
  };
  if (NUEVO_PROY) { NUEVO_PROY = false; formProyecto(); }
};
function accionesPedido(p) {
  const B = (a, t, c = "btn-light") => `<button class="btn ${c} btn-sm" data-pa="${a}|${esc(p.id)}">${t}</button>`;
  const cobrar = saldoDe(p) ? B("pago", `${ico("cash")} Registrar pago`) : "";
  return { "por-validar": B("validar", `${ico("check")} Ver captura y validar`, "btn-pri") + B("rechazar", "Rechazar"),
    confirmado: B("iniciar", `${ico("tool")} Iniciar desarrollo`, "btn-pri") + cobrar + B("anular", "Anular"),
    desarrollo: B("entregar", `${ico("check")} Entregar proyecto`, "btn-pri") + cobrar + B("anular", "Anular"),
    entregado: cobrar }[p.estado] || "";
}
async function accionPedido(a, p) {
  const id = p.id, upd = data => ({ op: "set", col: "pedidos", id, data: { ...data, actualizado: new Date().toISOString(), por: YO().nombre } }), fin = async (ops, msg, wa) => { await DB.batch(ops); toast(msg); if (wa) abrirWA(p.celular, wa); vigilar(); refrescar(); };
  const pagoNuevo = (monto, metodo) => { const pagos = [...(p.pagos || []), { fecha: new Date().toISOString(), monto: r2(monto), metodo }]; return { pagos, pagado: r2((+p.pagado || 0) + (+monto || 0)) }; };
  const plan = (p.items || [])[0]?.n || "proyecto";
  if (a === "pdf") return pdfRecibo(p);
  if (a === "wa") return abrirWA(p.celular, msgCliente(p, "Te escribimos sobre tu proyecto."));
  if (a === "boleta") return modal(`${p.comprobante || "Boleta"} electrónica · ${p.codigo || id}`, `<p class="muted">Cuando emitas la ${esc((p.comprobante || "boleta").toLowerCase())} en SUNAT, escribe aquí su número. Saldrá en el recibo PDF.</p>
      <div class="g2">${fld("comprobante", "Tipo", p.comprobante || "Boleta", { opts: ["Boleta", "Factura"] })}${fld("boleta", "Número (serie-correlativo)", p.boleta || "", { ph: "Ej. B001-000123" })}</div>`, async d =>
    fin([upd({ comprobante: d.comprobante, boleta: String(d.boleta || "").trim().toUpperCase().slice(0, 20) })], d.boleta ? "Número guardado" : "Número borrado"), "Guardar");
  if (a === "validar") { const c = await DB.get("capturas", id);
    return modal(`Validar pago · ${p.codigo || id}`, `${c && c.captura ? `<img class="zoom" src="${esc(c.captura)}" alt="Captura del pago">` : `<p class="muted">Sin imagen de captura.</p>`}
      <p>Confirma que llegaron <b>${S(p.monto)}</b> por ${esc(p.pago)}${p.banco ? " " + esc(p.banco) : ""}${p.operacion ? ` (op. ${esc(p.operacion)})` : ""}. ${p.tipoPago === "adelanto" ? `Es el <b>adelanto</b>; el saldo de ${S(p.total - p.monto)} se cobra al entregar.` : "Es el <b>pago completo</b>."}</p>
      <div class="g2">${fld("monto", "Monto recibido (S/)", p.monto, { type: "number", req: true, extra: 'min="0.1" step="0.01"' })}${fld("enviar", "Avisar al cliente por WhatsApp", true, { type: "checkbox" })}</div>`, async d => {
      const pg = pagoNuevo(d.monto, p.pago), ops = [upd({ estado: "confirmado", validado: new Date().toISOString(), ...pg }), movimiento({ concepto: `${p.tipoPago === "total" ? "Pago" : "Adelanto"} ${plan} · ${p.nombre}`, monto: d.monto, metodo: p.pago === "Transferencia" ? "Transferencia" : p.pago, pedido: id }), { op: "set", col: "capturas", id, data: { captura: "", revisado: true } }];
      await fin(ops, "Pago validado y registrado en caja", d.enviar ? msgCliente(p, `✅ Recibimos tu pago de ${S(d.monto)}. ¡Gracias por confiar en nosotros! En breve te escribimos para coordinar la reunión de inicio de tu proyecto.`) : null); }, "Validar pago"); }
  if (a === "rechazar") return modal("Rechazar pago", `${fld("motivo", "Motivo", "No llegó el pago", { full: true, opts: ["No llegó el pago", "El monto no coincide", "La captura no se lee", "La captura es de otro pago"] })}${fld("enviar", "Avisar por WhatsApp", true, { type: "checkbox" })}`, async d =>
    fin([upd({ estado: "rechazado", motivo: d.motivo })], "Pedido rechazado", d.enviar ? msgCliente(p, `No pudimos validar tu pago: ${d.motivo}. Escríbenos por aquí para ayudarte a completarlo.`) : null), "Rechazar");
  if (a === "iniciar") return fin([upd({ estado: "desarrollo", inicio: new Date().toISOString() })], "Proyecto en desarrollo", msgCliente(p, "🚀 ¡Empezamos con tu proyecto! Te iremos enviando avances por aquí."));
  if (a === "pago") return modal(`Registrar pago · ${p.codigo || id}`, `<p>Saldo pendiente <b>${S(saldoDe(p))}</b> de un total de ${S(p.total)}.</p><div class="g2">${fld("monto", "Monto recibido (S/)", saldoDe(p), { type: "number", req: true, extra: 'min="0.1" step="0.01"' })}${fld("metodo", "¿Cómo pagó?", "Yape", { opts: METODOS })}</div>`, async d => {
    if (+d.monto > saldoDe(p) + .01) { toast("El monto es mayor que el saldo", true); return false; }
    await fin([upd(pagoNuevo(d.monto, d.metodo)), movimiento({ concepto: `Pago ${plan} · ${p.nombre}`, monto: d.monto, metodo: d.metodo, pedido: id })], "Pago registrado en caja"); }, "Registrar");
  if (a === "entregar") return modal(`Entregar · ${p.codigo || id}`, `${saldoDe(p) ? `<p>Queda un saldo de <b>${S(saldoDe(p))}</b>.</p><div class="g2">${fld("cobrar", "Cobrar el saldo ahora", true, { type: "checkbox", full: true })}${fld("metodo", "¿Cómo pagó?", "Yape", { opts: METODOS })}</div>` : `<p>El proyecto está pagado por completo. ✅</p>`}
      ${fld("link", "Enlace del proyecto publicado (opcional)", "", { type: "url", full: true, ph: "https://…" })}${fld("enviar", "Avisar al cliente por WhatsApp", true, { type: "checkbox" })}`, async d => {
    const ops = [], s = saldoDe(p); let extra = {};
    if (s && d.cobrar) { extra = pagoNuevo(s, d.metodo); ops.push(movimiento({ concepto: `Saldo ${plan} · ${p.nombre}`, monto: s, metodo: d.metodo, pedido: id })); }
    ops.unshift(upd({ estado: "entregado", entregado: new Date().toISOString(), link: d.link || p.link || "", ...extra }));
    await fin(ops, "Proyecto entregado", d.enviar ? msgCliente(p, `🎉 ¡Tu proyecto está listo!${d.link ? "\n👉 " + d.link : ""}\n\nGracias por confiar en nosotros. Cualquier duda, aquí estamos.`) : null); }, "Entregar");
  if (a === "anular") return modal(`Anular ${p.codigo || id}`, `${fld("motivo", "Motivo", "", { full: true, ph: "Ej. el cliente desistió" })}${+p.pagado ? fld("devolver", `Registrar devolución de ${S(p.pagado)} en caja`, false, { type: "checkbox", full: true }) : ""}${fld("enviar", "Avisar por WhatsApp", false, { type: "checkbox" })}`, async d =>
    fin([upd({ estado: "anulado", motivo: d.motivo }), ...(d.devolver ? [movimiento({ concepto: `Devolución ${p.codigo || id} · ${p.nombre}`, monto: -p.pagado, metodo: p.pago || "Efectivo", pedido: id })] : [])], "Proyecto anulado", d.enviar ? msgCliente(p, `Tu proyecto fue anulado${d.motivo ? ": " + d.motivo : ""}.`) : null), "Anular");
}
function formProyecto() {
  const pl = CAT.planes;
  modal("Nuevo proyecto", `<p class="muted">Para clientes que te contrataron por WhatsApp, llamada o en persona.</p><div class="g2">
    ${fld("nombre", "Cliente", "", { req: true })}${fld("celular", "Celular", "", { req: true, type: "tel" })}${fld("negocio", "Negocio", "")}${fld("email", "Correo", "", { type: "email" })}
    ${fld("plan", "Plan", pl[0]?.id || "", { opts: [...pl.map(x => [x.id, x.nombre + (x.tipo ? " · " + x.tipo : "")]), ["otro", "Otro / a medida"]] })}${fld("desc", "Descripción (sale en el recibo)", "", { ph: "Ej. Sistema web para ferretería" })}
    ${fld("total", "Precio total (S/)", "", { type: "number", req: true, extra: 'min="1" step="0.01"' })}${fld("adelanto", "Ya pagó (S/)", "", { type: "number", extra: 'min="0" step="0.01"' })}
    ${fld("metodo", "¿Cómo pagó?", "Yape", { opts: METODOS })}${fld("comprobante", "Comprobante", "Boleta", { opts: ["Boleta", "Factura"] })}${fld("doc", "DNI / RUC", "")}
    ${fld("estado", "Estado", "confirmado", { opts: [["confirmado", "Confirmado (aún no empieza)"], ["desarrollo", "En desarrollo"], ["entregado", "Entregado"]] })}
    ${fld("detalle", "Detalle del proyecto", "", { type: "textarea", full: true, rows: 3 })}</div>`, async d => {
    const p = planDe(d.plan), cod = codigo("ZK"), ad = Math.max(0, +d.adelanto || 0), total = +d.total, now = new Date().toISOString();
    if (ad > total) { toast("Lo pagado no puede ser mayor que el total", true); return false; }
    const n = d.desc || (d.plan === "otro" ? "Proyecto a medida" : `Plan ${p.nombre}${p.tipo ? " · " + p.tipo : ""}`);
    const ped = { codigo: cod, plan: d.plan, items: [{ n, precio: r2(total), cant: 1 }], subtotal: r2(total), envio: 0, total: r2(total), monto: r2(ad), tipoPago: ad >= total ? "total" : "adelanto", nombre: d.nombre, celular: d.celular, negocio: d.negocio, email: d.email,
      doc: d.doc, comprobante: d.comprobante, detalle: d.detalle, pago: ad ? d.metodo : "", pagado: r2(ad), pagos: ad ? [{ fecha: now, monto: r2(ad), metodo: d.metodo }] : [], estado: d.estado, origen: "manual", creado: now, por: YO().nombre };
    await DB.batch([{ op: "set", col: "pedidos", id: cod, data: ped, merge: false }, ...(ad ? [movimiento({ concepto: `${ad >= total ? "Pago" : "Adelanto"} ${n} · ${d.nombre}`, monto: ad, metodo: d.metodo, pedido: cod })] : [])]);
    toast(`Proyecto ${cod} registrado`); PT = d.estado === "entregado" ? "hist" : "curso"; VIEWS.pedidos(); }, "Registrar", { wide: true });
}

/* ================= CLIENTES ================= */
let CQ = "";
VIEWS.clientes = async () => {
  const todos = (await DB.list("pedidos")).filter(p => p.celular), M = {};
  todos.filter(p => !["anulado", "rechazado"].includes(p.estado)).forEach(p => { const k = k9(p.celular); const c = M[k] || (M[k] = { k, nombre: p.nombre, celular: p.celular, negocio: p.negocio, doc: p.doc, n: 0, total: 0, pagado: 0, ult: "" }); c.n++; c.total += +p.total || 0; c.pagado += +p.pagado || 0; if (String(p.creado) > c.ult) { c.ult = p.creado; c.nombre = p.nombre; c.negocio = p.negocio || c.negocio; c.doc = p.doc || c.doc; } });
  const q = CQ.toLowerCase(), l = Object.values(M).filter(c => !q || [c.nombre, c.celular, c.doc, c.negocio].join(" ").toLowerCase().includes(q)).sort((a, b) => b.total - a.total);
  $("#view").innerHTML = topBar("Clientes", "Quienes te contrataron. Toca un cliente para ver sus proyectos y recibos.", `<input class="q" id="cq" placeholder="Buscar nombre, negocio, celular o RUC" value="${esc(CQ)}">`) +
    `<section class="card"><div class="tbl-w"><table class="tbl"><thead><tr><th>Cliente</th><th>Celular</th><th>Proyectos</th><th class="r">Total</th><th class="r">Saldo</th><th>Último</th><th></th></tr></thead><tbody>
    ${l.slice(0, 300).map(c => `<tr class="clk" data-cli="${esc(c.k)}"><td><b>${esc(c.nombre)}</b>${c.negocio ? `<small>${esc(c.negocio)}</small>` : ""}</td><td>${esc(c.celular)}</td><td>${c.n}${c.n > 1 ? ` <span class="st ok">Recurrente</span>` : ""}</td><td class="r">${S(c.total)}</td><td class="r ${c.total - c.pagado > 0 ? "neg" : ""}">${S(Math.max(0, c.total - c.pagado))}</td><td>${fmtF(c.ult)}</td>
      <td class="nw"><button class="btn btn-light btn-sm" data-cli="${esc(c.k)}">${ico("file")} Recibos</button> <button class="btn btn-wa btn-sm" data-wa="${esc(c.celular)}|${esc(c.nombre)}">${ico("wa")}</button></td></tr>`).join("") || `<tr><td colspan="7" class="muted">Aún no hay clientes.</td></tr>`}</tbody></table></div></section>`;
  $("#cq").addEventListener("change", e => { CQ = e.target.value; VIEWS.clientes(); });
  $("#view").onclick = e => { const b = e.target.closest("[data-wa]"); if (b) { const [cel, n] = b.dataset.wa.split("|"); return abrirWA(cel, `Hola ${n.split(" ")[0]} 👋 Te saluda *${NOMBRE()}*. `); }
    const r = e.target.closest("[data-cli]"); if (r && M[r.dataset.cli]) historialCliente(M[r.dataset.cli], todos.filter(p => k9(p.celular) === r.dataset.cli)); };
};
function historialCliente(c, ps) {
  ps = ps.sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
  const ok = ps.filter(p => !["anulado", "rechazado"].includes(p.estado));
  modal(`Proyectos de ${c.nombre}`, `<div class="hc-top"><div><small>Celular</small><b>${esc(c.celular)}</b></div><div><small>Negocio</small><b>${esc(c.negocio || "—")}</b></div><div><small>Total contratado</small><b>${S(ok.reduce((a, p) => a + (+p.total || 0), 0))}</b></div><div><small>Saldo</small><b>${S(ok.reduce((a, p) => a + saldoDe(p), 0))}</b></div></div>
    <div class="tbl-w"><table class="tbl"><thead><tr><th>Fecha</th><th>Código</th><th>Proyecto</th><th class="r">Total</th><th class="r">Pagado</th><th>Estado</th><th>Comprobante</th><th></th></tr></thead><tbody>
    ${ps.map(p => `<tr><td class="nw">${new Date(p.creado).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</td><td class="mono nw">${esc(p.codigo || p.id)}</td><td><small>${(p.items || []).map(i => esc(i.n)).join("<br>")}</small></td><td class="r nw"><b>${S(p.total)}</b></td><td class="r nw">${S(p.pagado || 0)}</td><td>${estP(p.estado)}</td>
      <td>${p.boleta ? `<b>${esc(p.boleta)}</b>` : `<span class="muted">${esc(p.comprobante || "Boleta")} sin N°</span>`}<br><button class="btn btn-light btn-sm" data-hb="${esc(p.id)}">🧾 ${p.boleta ? "Editar" : "Poner N°"}</button></td>
      <td><button class="btn btn-pri btn-sm" data-hp="${esc(p.id)}">${ico("file")} PDF</button></td></tr>`).join("")}</tbody></table></div>`, null, "", { wide: true, alAbrir: F => {
    F.onclick = e => { const b = e.target.closest("[data-hp],[data-hb]"); if (!b) return; e.preventDefault(); const p = ps.find(x => x.id === (b.dataset.hp || b.dataset.hb)); if (!p) return; if (b.dataset.hp) pdfRecibo(p); else accionPedido("boleta", p); };
  } });
}

/* ================= CAJA ================= */
let CAJA_F = null;
VIEWS.caja = async () => {
  CAJA_F = CAJA_F || HOY(); const l = (await DB.list("movimientos", ["fecha", "==", CAJA_F])).sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
  const ing = l.filter(m => m.monto > 0).reduce((a, m) => a + m.monto, 0), egr = l.filter(m => m.monto < 0).reduce((a, m) => a + m.monto, 0), por = {}; l.forEach(m => por[m.metodo] = (por[m.metodo] || 0) + m.monto);
  $("#view").innerHTML = topBar("Caja", "Pagos de clientes, gastos y compras (dominios, hosting, publicidad…).", `<input type="date" id="cf" value="${CAJA_F}" class="q"><button class="btn btn-light btn-sm" id="mov">${ico("plus")} Ingreso / gasto</button><button class="btn btn-light btn-sm" id="csv">${ico("download")} Excel (CSV)</button>`) + `
    <div class="kpis"><div class="kpi"><span>Saldo del día</span><b>${S(ing + egr)}</b><small>${l.length} movimiento(s)</small></div><div class="kpi"><span>Ingresos</span><b>${S(ing)}</b></div><div class="kpi"><span>Gastos</span><b class="neg">${S(egr)}</b></div>${METODOS.map(k => `<div class="kpi sm"><span>${k}</span><b>${S(por[k] || 0)}</b></div>`).join("")}</div>
    <section class="card"><div class="tbl-w"><table class="tbl"><thead><tr><th>Hora</th><th>Concepto</th><th>Método</th><th>Usuario</th><th class="r">Monto</th></tr></thead><tbody>
      ${l.map(m => `<tr><td>${fmtH(m.hora)}</td><td>${esc(m.concepto)}</td><td>${esc(m.metodo)}</td><td>${esc(m.usuario || "")}</td><td class="r ${m.monto < 0 ? "neg" : ""}">${S(m.monto)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">Sin movimientos este día.</td></tr>`}</tbody></table></div></section>`;
  $("#cf").addEventListener("change", e => { CAJA_F = e.target.value; VIEWS.caja(); });
  $("#csv").addEventListener("click", () => { const rows = [["Fecha", "Hora", "Concepto", "Método", "Usuario", "Monto"], ...l.map(m => [m.fecha, fmtH(m.hora), m.concepto, m.metodo, m.usuario || "", m.monto])];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv" })); a.download = `caja-${CAJA_F}.csv`; a.click(); });
  $("#mov").addEventListener("click", () => modal("Ingreso o gasto", `<div class="g2">${fld("tipo", "Tipo", "egreso", { opts: [["ingreso", "Ingreso"], ["egreso", "Gasto / compra"]] })}${fld("monto", "Monto (S/)", "", { type: "number", req: true, extra: 'min="0.1" step="0.1"' })}
    ${fld("concepto", "Concepto", "", { req: true, full: true, ph: "Ej. dominio .com de un cliente, hosting, publicidad en Facebook" })}${fld("metodo", "Método", "Yape", { opts: METODOS })}</div>`, async d => {
    await DB.batch([movimiento({ concepto: d.concepto, monto: d.tipo === "egreso" ? -d.monto : d.monto, metodo: d.metodo, fecha: CAJA_F })]); toast("Registrado"); VIEWS.caja(); }));
};

/* ================= MENSAJES Y RECLAMOS ================= */
VIEWS.mensajes = async () => {
  const l = (await DB.list("mensajes")).sort((a, b) => String(b.creado).localeCompare(a.creado));
  $("#view").innerHTML = topBar("Mensajes", "Lo que escriben en Contacto y en el Libro de Reclamaciones de la web.") +
    `<div class="peds">${l.map(m => { const rec = /reclamaciones/i.test(m.asunto || ""); return `<article class="card ped ${m.estado === "nuevo" ? "nuevo" : ""} ${rec ? "rechazado" : ""}"><div class="ped-i">${ico(rec ? "alert" : "msg")}</div><div class="ped-b"><div class="ped-h"><b>${esc(m.nombre)}</b><span class="st ${rec ? "bad" : "mute"}">${esc(m.asunto || "")}</span><span class="muted">${hace(m.creado)}</span>${m.estado === "nuevo" ? `<span class="st pri">Nuevo</span>` : `<span class="st ok">Atendido</span>`}</div>
      <p class="pre">${esc(m.mensaje)}</p><p class="muted">📱 ${esc(m.telefono || "sin teléfono")}</p>${rec ? `<div class="alert warn sm">${ico("alert")} Por ley debes responder un reclamo en un plazo máximo de 15 días hábiles.</div>` : ""}
      <div class="acts-g">${m.telefono ? `<button class="btn btn-wa btn-sm" data-mw="${esc(m.id)}">${ico("wa")} Responder</button>` : ""}${m.estado === "nuevo" ? `<button class="btn btn-light btn-sm" data-mo="${esc(m.id)}">${ico("check")} Marcar atendido</button>` : ""}<button class="btn btn-light btn-sm" data-md="${esc(m.id)}">${ico("trash")}</button></div></div></article>`; }).join("") || vacio("No hay mensajes.")}</div>`;
  $("#view").onclick = async e => { const w = e.target.closest("[data-mw]"), o = e.target.closest("[data-mo]"), d = e.target.closest("[data-md]"); const m = l.find(x => x.id === (w || o || d || {}).dataset?.[w ? "mw" : o ? "mo" : "md"]); if (!m) return;
    if (w) { abrirWA(m.telefono, `Hola ${m.nombre.split(" ")[0]} 👋 te escribe *${NOMBRE()}* por tu mensaje: «${String(m.mensaje).split("\n")[0].slice(0, 120)}»\n\n`); await DB.set("mensajes", m.id, { estado: "atendido" }); }
    if (o) await DB.set("mensajes", m.id, { estado: "atendido" }); if (d && confirm("¿Eliminar este mensaje?")) await DB.del("mensajes", m.id);
    vigilar(); VIEWS.mensajes(); };
};

/* ================= PORTAFOLIO Y DEMOS ================= */
VIEWS.portafolio = async () => {
  await cargarCatalogo();
  $("#view").innerHTML = topBar("Portafolio y demos", "Tus trabajos con su captura. En los que tienen demo pones los enlaces de la web y del panel con su usuario de prueba: solo se ven con un código.", `<button class="btn btn-pri btn-sm" id="nP">${ico("plus")} Trabajo</button>`) + `
    <section class="card"><ul class="lst cats">${CAT.port.map((p, i) => { const l = CAT.links[p.id] || {}; return `<li><span class="p-th wide" style="background-image:url('${esc(IMG(p.foto))}')">${p.foto ? "" : `<small>Sin captura</small>`}</span><div><b>${esc(p.nombre)}</b><small>${esc(TIPOS[p.tipo] || p.tipo)}${p.destacado ? " · ⭐ en el inicio" : ""}${p.visible === false ? " · oculto" : ""}</small>
      ${p.demo ? `<small>${l.web ? `<span class="st ok">Demo: web ✓</span> ${l.admin ? `<span class="st ok">panel ✓</span>` : `<span class="st warn">sin panel</span>`} ${l.usuario ? `<span class="st ok">usuario ✓</span>` : ""}` : `<span class="st bad">Demo sin enlaces</span>`}</small>` : ""}</div>
      <button class="btn btn-light btn-xs" data-up="${i}" ${i ? "" : "disabled"} aria-label="Subir">▲</button><button class="btn btn-light btn-xs" data-dn="${i}" ${i < CAT.port.length - 1 ? "" : "disabled"} aria-label="Bajar">▼</button><button class="btn btn-light btn-sm" data-ep="${esc(p.id)}">${ico("edit")}</button></li>`; }).join("") || `<li class="muted">Sin trabajos.</li>`}</ul></section>`;
  $("#nP").addEventListener("click", () => formPort());
  $("#view").onclick = async e => { const ep = e.target.closest("[data-ep]"), up = e.target.closest("[data-up]"), dn = e.target.closest("[data-dn]");
    if (ep) return formPort(portDe(ep.dataset.ep));
    if (up || dn) { const i = +(up || dn).dataset[up ? "up" : "dn"], j = up ? i - 1 : i + 1, l = CAT.port.slice(); [l[i], l[j]] = [l[j], l[i]]; await DB.batch(l.map((p, k) => ({ op: "set", col: "portafolio", id: p.id, data: { orden: k } }))); VIEWS.portafolio(); } };
};
function formPort(p) {
  const l = p ? CAT.links[p.id] || {} : {};
  modal(p ? p.nombre : "Nuevo trabajo", `<div class="g2">
    <div class="full"><span class="lbl">Captura de la web o app (horizontal, se ve arriba de la tarjeta)</span><div class="foto-up"><span id="pPrev" class="cap-prev" style="background-image:url('${esc(IMG(p?.foto))}')"></span><label class="btn btn-light btn-sm">${ico("camera")} Subir captura<input type="file" accept="image/*" id="pFile" hidden></label>${p?.foto ? `<button type="button" class="btn btn-light btn-sm" id="pFx">Quitar</button>` : ""}<input type="hidden" name="foto" value="${esc(p?.foto || "")}"></div></div>
    ${fld("nombre", "Nombre", p?.nombre || "", { req: true, ph: "Ej. Ferretería Ronald" })}${fld("tipo", "Tipo", p?.tipo || "sistema", { opts: Object.entries(TIPOS) })}
    ${fld("desc", "Descripción corta", p?.desc || "", { type: "textarea", full: true, rows: 3 })}
    ${fld("link", "Enlace del proyecto publicado (opcional, botón «Ver proyecto»)", p?.link || "", { type: "url", full: true, ph: "https://…" })}
    ${fld("destacado", "Mostrar en «Proyectos recientes» del inicio", !!p?.destacado, { type: "checkbox" })}${fld("visible", "Visible en la web", p ? p.visible !== false : true, { type: "checkbox" })}
    ${fld("demo", "Tiene DEMO (botón «Ver demo» + acceso con código)", !!p?.demo, { type: "checkbox", full: true })}
    <div class="full g2 demo-box" id="dBox">
      ${fld("web", "Enlace de la WEB de la demo", l.web || "", { type: "url", full: true, ph: "https://zikopro820.github.io/…" })}
      ${fld("admin", "Enlace del PANEL de la demo", l.admin || "", { type: "url", full: true, ph: "https://zikopro820.github.io/…-admin" })}
      ${fld("usuario", "Usuario de prueba del panel", l.usuario || "", { ph: "ventas@…" })}${fld("clave", "Contraseña de prueba", l.clave || "")}
      ${fld("nota", "Nota para quien prueba (opcional)", l.nota || "", { full: true })}
      <p class="muted sm full">🔒 Estos datos NO se ven en la web: solo los ve quien tiene un código válido. Usa un usuario «Ventas» de la demo, no el de Administración.</p></div></div>
    ${p ? `<button type="button" class="btn btn-light danger btn-sm" id="delP">${ico("trash")} Eliminar trabajo</button>` : ""}`, async d => {
    const id = p?.id || d.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\W+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "p" + Date.now().toString(36);
    if (!p && CAT.port.find(x => x.id === id)) { toast("Ya existe un trabajo con ese nombre", true); return false; }
    const data = { nombre: d.nombre, tipo: d.tipo, desc: d.desc, link: d.link, foto: d.foto, destacado: d.destacado, visible: d.visible, demo: d.demo, orden: p?.orden ?? CAT.port.length };
    if (JSON.stringify(data).length > 900000) { toast("La captura pesa demasiado", true); return false; }
    const ops = [{ op: "set", col: "portafolio", id, data, merge: false }];
    if (d.demo) ops.push({ op: "set", col: "demo_links", id, data: { web: d.web, admin: d.admin, usuario: d.usuario, clave: d.clave, nota: d.nota }, merge: false });
    await DB.batch(ops); toast("Guardado · ya se ve en la web" + (d.demo && !d.web ? " (falta el enlace de la demo)" : "")); VIEWS.portafolio(); }, "Guardar", { wide: true, alAbrir: F => {
    const sync = () => $("#dBox").hidden = !$("[name=demo]", F).checked; sync(); $("[name=demo]", F).addEventListener("change", sync);
    $("#pFile").addEventListener("change", async e => { const f = e.target.files[0]; if (!f) return; const u = await redimensionar(f, 1200, .72); $("[name=foto]", F).value = u; $("#pPrev").style.backgroundImage = `url('${u}')`; });
    $("#pFx")?.addEventListener("click", () => { $("[name=foto]", F).value = ""; $("#pPrev").style.backgroundImage = "none"; });
    $("#delP")?.addEventListener("click", async () => { if (!confirm(`¿Eliminar «${p.nombre}» del portafolio?`)) return; await DB.batch([{ op: "del", col: "portafolio", id: p.id }, { op: "del", col: "demo_links", id: p.id }]); cerrarModal(); toast("Eliminado"); VIEWS.portafolio(); }); } });
}

/* ================= PLANES Y PRECIOS ================= */
VIEWS.planes = async () => {
  await cargarCatalogo(); const tc = +CAT.aj.tipoCambio || 3.75;
  $("#view").innerHTML = topBar("Planes y precios", `Lo que se ve en Precios. Los planes «se pueden pagar en línea» llevan al pago con Yape/Plin/transferencia (tipo de cambio ${tc.toFixed(2)}, adelanto ${+CAT.aj.adelantoPct || 50}%).`, `<button class="btn btn-pri btn-sm" id="nPl">${ico("plus")} Plan</button>`) + `
    <div class="plans">${CAT.planes.map((p, i) => `<section class="card plan-c ${p.destacado ? "hi" : ""} ${p.visible === false ? "off" : ""}"><div class="card-h"><h2>${esc(p.nombre)}</h2>${p.destacado ? `<span class="st pri">Más popular</span>` : ""}</div>
      <small class="muted">${esc(p.tipo || "")}</small><b class="pl-p">${p.precio == null || p.precio === "" ? "A medida" : (p.moneda === "USD" ? "$" : "S/ ") + p.precio + " " + (p.moneda || "")}</b><small class="muted">${esc(p.nota || "")}${p.moneda === "USD" && p.precio ? ` · cobra ${S(p.precio * tc)}` : ""}</small>
      <ul>${(p.items || []).map(x => x.startsWith("-") ? `<li class="muted"><s>${esc(x.slice(1))}</s></li>` : `<li>${esc(x)}</li>`).join("")}</ul>
      <p>${p.pagable && p.precio ? `<span class="st ok">Pago en línea</span>` : `<span class="st mute">Botón «Cotizar»</span>`}${p.visible === false ? ` <span class="st bad">Oculto</span>` : ""}</p>
      <div class="acts-g"><button class="btn btn-light btn-xs" data-up="${i}" ${i ? "" : "disabled"}>◀</button><button class="btn btn-light btn-xs" data-dn="${i}" ${i < CAT.planes.length - 1 ? "" : "disabled"}>▶</button><button class="btn btn-light btn-sm" data-epl="${esc(p.id)}">${ico("edit")} Editar</button></div></section>`).join("") || vacio("Sin planes.")}</div>`;
  const form = p => modal(p ? p.nombre : "Nuevo plan", `<div class="g2">${fld("nombre", "Nombre", p?.nombre || "", { req: true, ph: "Ej. Profesional" })}${fld("tipo", "Para qué es", p?.tipo || "", { ph: "Página web, Sistema web…" })}
    ${fld("precio", "Precio (vacío = «A medida»)", p?.precio ?? "", { type: "number", extra: 'min="0" step="0.01"' })}${fld("moneda", "Moneda", p?.moneda || "USD", { opts: [["USD", "Dólares (USD)"], ["PEN", "Soles (S/)"]] })}
    ${fld("nota", "Nota bajo el precio", p?.nota || "Pago único", {})}${fld("items", "Qué incluye (uno por línea; empieza con «-» lo que NO incluye)", (p?.items || []).join("\n"), { type: "textarea", full: true, rows: 7 })}
    ${fld("pagable", "Se puede contratar y pagar en línea", p ? !!p.pagable : true, { type: "checkbox" })}${fld("destacado", "Marcar como «Más popular»", !!p?.destacado, { type: "checkbox" })}${fld("visible", "Visible en la web", p ? p.visible !== false : true, { type: "checkbox" })}</div>
    ${p ? `<button type="button" class="btn btn-light danger btn-sm" id="delPl">${ico("trash")} Eliminar plan</button>` : ""}`, async d => {
    const id = p?.id || d.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\W+/g, "-").replace(/^-|-$/g, "") || "plan" + Date.now().toString(36);
    if (!p && CAT.planes.find(x => x.id === id)) { toast("Ya existe un plan con ese nombre", true); return false; }
    await DB.set("planes", id, { nombre: d.nombre, tipo: d.tipo, precio: d.precio === "" ? null : +d.precio, moneda: d.moneda, nota: d.nota, items: String(d.items).split("\n").map(x => x.trim()).filter(Boolean), pagable: d.pagable, destacado: d.destacado, visible: d.visible, orden: p?.orden ?? CAT.planes.length }, false);
    toast("Plan guardado · ya se ve en la web"); VIEWS.planes(); }, "Guardar", { wide: true, alAbrir: () => { $("#delPl")?.addEventListener("click", async () => { if (!confirm(`¿Eliminar el plan «${p.nombre}»?`)) return; await DB.del("planes", p.id); cerrarModal(); VIEWS.planes(); }); } });
  $("#nPl").addEventListener("click", () => form());
  $("#view").onclick = async e => { const ep = e.target.closest("[data-epl]"), up = e.target.closest("[data-up]"), dn = e.target.closest("[data-dn]");
    if (ep) return form(planDe(ep.dataset.epl));
    if (up || dn) { const i = +(up || dn).dataset[up ? "up" : "dn"], j = up ? i - 1 : i + 1, l = CAT.planes.slice(); [l[i], l[j]] = [l[j], l[i]]; await DB.batch(l.map((p, k) => ({ op: "set", col: "planes", id: p.id, data: { orden: k } }))); VIEWS.planes(); } };
};

/* ================= REPORTES ================= */
VIEWS.reportes = async () => {
  await cargarCatalogo(); const d0 = addD(HOY(), -29);
  const [peds, movs, sols] = await Promise.all([DB.list("pedidos"), DB.list("movimientos", ["fecha", ">=", d0]), DB.list("solicitudes")]);
  const ok = peds.filter(p => !["anulado", "rechazado", "por-validar"].includes(p.estado)), mes = ok.filter(p => String(p.creado).slice(0, 10) >= d0), solM = sols.filter(s => String(s.creado).slice(0, 10) >= d0);
  const dias = [...Array(30)].map((_, i) => addD(d0, i)), porDia = dias.map(f => movs.filter(m => m.fecha === f && m.monto > 0).reduce((a, m) => a + m.monto, 0)), max = Math.max(1, ...porDia), tot = porDia.reduce((a, b) => a + b, 0);
  const clientesCel = new Set(peds.map(p => k9(p.celular))), conv = sols.filter(s => clientesCel.has(k9(s.celular))), porSis = {}; sols.forEach(s => { const k = s.sistema === "todos" ? "Todos" : portDe(s.sistema).nombre || s.sistema; porSis[k] = (porSis[k] || 0) + 1; });
  const porPlan = {}; ok.forEach(p => { const k = (p.items || [])[0]?.n || "Otro"; porPlan[k] = porPlan[k] || { c: 0, m: 0 }; porPlan[k].c++; porPlan[k].m += +p.total || 0; });
  const maxS = Math.max(1, ...Object.values(porSis));
  $("#view").innerHTML = topBar("Reportes", "Últimos 30 días.") + `
    <div class="kpis"><div class="kpi"><span>Ingresos</span><b>${S(tot)}</b><small>en caja</small></div><div class="kpi"><span>Proyectos vendidos</span><b>${mes.length}</b><small>${S(mes.reduce((a, p) => a + (+p.total || 0), 0))} contratados</small></div>
      <div class="kpi"><span>Por cobrar</span><b class="neg">${S(ok.reduce((a, p) => a + saldoDe(p), 0))}</b><small>saldos pendientes</small></div><div class="kpi"><span>Demos solicitadas</span><b>${solM.length}</b><small>${sols.length ? Math.round(conv.length / sols.length * 100) : 0}% se volvieron clientes</small></div></div>
    <section class="card"><div class="card-h"><h2>Ingresos por día</h2></div><div class="dias">${porDia.map((v, i) => `<div title="${fmtF(dias[i])}: ${S(v)}"><i style="height:${Math.max(2, v / max * 100)}%"></i><small>${+dias[i].slice(8) % 5 === 0 || i === 29 ? +dias[i].slice(8) : ""}</small></div>`).join("")}</div></section>
    <div class="two"><section class="card"><div class="card-h"><h2>Ventas por plan (total)</h2></div><table class="tbl"><tbody>${Object.entries(porPlan).sort((a, b) => b[1].m - a[1].m).map(([n, v]) => `<tr><td>${esc(n)}</td><td>${v.c}</td><td class="r">${S(v.m)}</td></tr>`).join("") || `<tr><td class="muted">Aún no hay ventas.</td></tr>`}</tbody></table></section>
      <section class="card"><div class="card-h"><h2>Demos más pedidas</h2></div><div class="bars">${Object.entries(porSis).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="bar-r"><span>${esc(c)}</span><div class="bar"><i style="width:${v / maxS * 100}%"></i></div><b>${v}</b></div>`).join("") || `<p class="muted">Aún no hay solicitudes.</p>`}</div>
        ${conv.length ? `<p class="muted sm">Se volvieron clientes: ${conv.slice(0, 8).map(s => esc(s.nombre)).join(", ")}</p>` : ""}</section></div>`;
};

/* ================= AJUSTES ================= */
VIEWS.ajustes = async () => {
  await cargarCatalogo(); const a = CAT.aj;
  $("#view").innerHTML = topBar("Ajustes", "Datos de ziko.pro que se ven en la web, en los recibos y en los mensajes.") + `
    ${!CAT.port.length || DEMO ? `<section class="card hi"><h2>${ico("download")} Cargar ejemplos</h2><p>Crea tu portafolio (con las capturas de tus trabajos) y los planes de ejemplo para empezar a editarlos. ${!CAT.port.length ? "<b>Tu web aún no tiene datos guardados.</b>" : ""}</p><button class="btn btn-pri" id="seed">Cargar ejemplos</button></section>` : ""}
    <form class="card" id="ajF">
      <h2>${ico("star")} Empresa</h2><div class="g2">${fld("nombre", "Nombre comercial", a.nombre, { req: true })}${fld("razon", "Razón social (recibos)", a.razon || "")}${fld("ruc", "RUC (recibos)", a.ruc || "")}</div>
      <h2>${ico("phone")} Contacto</h2><div class="g2">${fld("whatsapp", "WhatsApp (51 + número, sin espacios)", a.whatsapp, { req: true })}${fld("telefono", "Teléfono que se muestra", a.telefono)}${fld("email", "Correo", a.email)}${fld("horario", "Horario", a.horario)}
        ${fld("direccion", "Ciudad o dirección", a.direccion, { full: true })}
        ${["facebook", "instagram", "tiktok", "youtube"].map(k => fld(k, k[0].toUpperCase() + k.slice(1), (a.redes || {})[k] || "", { type: "url", ph: "https://… (vacío = no se muestra)" })).join("")}</div>
      <h2>${ico("key")} Demos y ventas</h2><div class="g2">${fld("demoDias", "Días que dura un código de demo", a.demoDias ?? 7, { type: "number", extra: 'min="1" max="90"' })}${fld("adelantoPct", "% de adelanto al contratar en línea", a.adelantoPct ?? 50, { type: "number", extra: 'min="10" max="100"' })}
        ${fld("tipoCambio", "Tipo de cambio (para cobrar en soles los planes en dólares)", a.tipoCambio ?? 3.75, { type: "number", extra: 'min="1" step="0.01"' })}</div>
      <h2>${ico("cash")} Pagos</h2><div class="g2">
        ${["yape", "plin"].map(k => { const N = k[0].toUpperCase() + k.slice(1); return `${fld("pago" + N, `Aceptar ${N}`, a["pago" + N] !== false, { type: "checkbox", full: true })}<div class="full qr-up"><span id="prev_${k}QR">${a[k + "QR"] ? `<img src="${esc(a[k + "QR"])}" alt="">` : ico("qr")}</span><label class="btn btn-light btn-sm">${ico("camera")} QR de ${N}<input type="file" accept="image/*" data-qr="${k}" hidden></label><input type="hidden" name="${k}QR" value="${esc(a[k + "QR"] || "")}">${fld(k + "Num", "Número", a[k + "Num"] || "")}${fld(k + "Titular", "A nombre de", a[k + "Titular"] || "")}</div>`; }).join("")}
        ${fld("pagoTransf", "Aceptar transferencias", a.pagoTransf !== false, { type: "checkbox" })}${fld("pagoOCR", "Leer las capturas automáticamente", a.pagoOCR !== false, { type: "checkbox" })}
        ${fld("cuentas", "Cuentas (banco | número | CCI | titular)", (a.cuentas || []).map(c => `${c.banco} | ${c.num} | ${c.cci} | ${c.titular}`).join("\n"), { type: "textarea", full: true, help: "Bancos con su color: BCP, Interbank, BBVA, Scotiabank, BanBif, Pichincha." })}</div>
      <div class="f-end"><button class="btn btn-pri">${ico("check")} Guardar ajustes</button></div></form>`;
  const F = $("#ajF");
  $$("[data-qr]", F).forEach(i => i.addEventListener("change", async e => { const f = e.target.files[0], k = e.target.dataset.qr; if (!f) return; const u = await redimensionar(f, 600, .92, "image/png"); $(`[name=${k}QR]`, F).value = u; $(`#prev_${k}QR`).innerHTML = `<img src="${u}" alt="">`; }));
  F.addEventListener("submit", async e => { e.preventDefault(); const d = datosForm(F), sp = t => String(t || "").split("\n").map(x => x.trim()).filter(Boolean);
    const URL_B = { BCP: "https://www.viabcp.com", Interbank: "https://interbank.pe", BBVA: "https://www.bbva.pe", Scotiabank: "https://www.scotiabank.com.pe", BanBif: "https://www.banbif.com.pe", Pichincha: "https://www.pichincha.pe" };
    const x = { ...d, redes: { facebook: d.facebook, instagram: d.instagram, tiktok: d.tiktok, youtube: d.youtube }, contraEntrega: false,
      cuentas: sp(d.cuentas).map((l, i) => { const [banco, num, cci, titular] = l.split("|").map(y => (y || "").trim()); return { id: (banco || "banco").toLowerCase().replace(/\W/g, "") + i, banco, num, cci, titular, url: URL_B[banco] || "" }; }),
      demoDias: Math.max(1, +d.demoDias || 7), adelantoPct: Math.min(100, Math.max(10, +d.adelantoPct || 50)), tipoCambio: +d.tipoCambio || 3.75, whatsapp: String(d.whatsapp).replace(/\D/g, "") };
    ["facebook", "instagram", "tiktok", "youtube"].forEach(k => delete x[k]);
    if (JSON.stringify(x).length > 900000) return toast("Las imágenes pesan demasiado.", true);
    await DB.set("ajustes", "general", x); Object.assign(CAT.aj, x); marcaPanel(); toast("Ajustes guardados · ya se ven en la web"); });
  $("#seed")?.addEventListener("click", async () => {
    if (!confirm(DEMO ? "En modo demo esto reinicia TODOS los datos de prueba. ¿Continuar?" : "Se creará el portafolio y los planes de ejemplo. ¿Continuar?")) return;
    if (DEMO) { localStorage.removeItem("zk_db"); LDB.get(); toast("Datos demo reiniciados"); await cargarCatalogo(); return go("inicio"); }
    window.ZK_DEMO_DATOS = false; const d = window.ZK_SEMILLA(), ops = [];
    if (!(await DB.get("ajustes", "general"))) ops.push({ op: "set", col: "ajustes", id: "general", data: window.ZK_AJUSTES });
    ["portafolio", "demo_links", "planes"].forEach(col => Object.entries(d[col] || {}).forEach(([id, v]) => ops.push({ op: "set", col, id, data: v })));
    await DB.batch(ops); toast("Ejemplos cargados"); await cargarCatalogo(); go("portafolio");
  });
};

arrancar();
