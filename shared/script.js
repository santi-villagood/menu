// ============ Datos de la URL: ?mesa=3 ============
const params = new URLSearchParams(location.search);
const mesa = params.get("mesa");

// ============ Utilidades ============
const formatoPrecio = new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", maximumFractionDigits: 0
});

// Crea elementos de forma segura (textContent evita inyectar HTML)
function el(tag, clase, texto) {
  const nodo = document.createElement(tag);
  if (clase) nodo.className = clase;
  if (texto) nodo.textContent = texto;
  return nodo;
}
const $ = id => document.getElementById(id);

// ============ Estado del pedido ============
let config = { activo: false, whatsapp: "" };
let pedido = {};   // { "0-1": { nombre, precio, cant } }
// La clave incluye la ruta, para que dos locales en el mismo dominio no se mezclen
const CLAVE = "pedido:" + location.pathname + ":" + (mesa || "sin-mesa");

try { pedido = JSON.parse(localStorage.getItem(CLAVE) || "{}"); } catch (e) { pedido = {}; }
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(pedido)); } catch (e) {} }

const items = () => Object.values(pedido);
const totalPlatos = () => items().reduce((s, i) => s + i.cant, 0);
const totalPrecio = () => items().reduce((s, i) => s + i.cant * i.precio, 0);

function cambiar(id, plato, delta) {
  const item = pedido[id] || { nombre: plato.nombre, precio: plato.precio, cant: 0 };
  item.cant += delta;
  if (item.cant <= 0) delete pedido[id]; else pedido[id] = item;
  guardar();
  refrescar();
}

// ============ Dibujar el menú ============
function crearControl(id, plato) {
  const caja = el("div", "control vacio");
  caja.dataset.id = id;

  const menos = el("button", "btn-cant menos", "−");
  menos.setAttribute("aria-label", "Quitar " + plato.nombre);
  menos.addEventListener("click", () => cambiar(id, plato, -1));

  const mas = el("button", "btn-cant mas", "+");
  mas.setAttribute("aria-label", "Agregar " + plato.nombre);
  mas.addEventListener("click", () => cambiar(id, plato, 1));

  caja.append(menos, el("span", "cant", "0"), mas);
  return caja;
}

function crearPlato(plato, id) {
  const caja = el("article", "plato");
  const linea = el("div", "plato-linea");
  linea.append(
    el("span", "plato-nombre", plato.nombre),
    el("span", "plato-relleno"),
    el("span", "plato-precio", formatoPrecio.format(plato.precio))
  );
  caja.append(linea);
  if (plato.descripcion) caja.append(el("p", "plato-desc", plato.descripcion));
  (plato.tags || []).forEach(t => caja.append(el("span", "tag", t)));
  if (config.activo) caja.append(crearControl(id, plato));
  return caja;
}

// Nombres simples en el JSON -> variables de colores del CSS
const COLORES = {
  principal: "--tinta",       // portada, textos y barra de pedido
  secundario: "--azulejo",    // títulos, botones y categorías
  acento: "--mostaza",        // etiquetas y detalle de la portada
  fondo: "--fondo"            // fondo de la página
};

function aplicarTema(tema) {
  const raiz = document.documentElement.style;
  Object.entries(tema || {}).forEach(([nombre, valor]) => {
    if (COLORES[nombre]) raiz.setProperty(COLORES[nombre], valor);
  });
}

function dibujarMenu(menu) {
  config = Object.assign(config, menu.pedidos || {});
  aplicarTema(menu.tema);

  document.title = "Menú · " + menu.local;
  $("local").textContent = menu.local;
  $("subtitulo").textContent = menu.subtitulo || "";
  $("actualizado").textContent = "Precios actualizados el " + menu.actualizado;

  if (menu.logo) {
    const logo = el("img", "logo");
    logo.src = menu.logo;
    logo.alt = "Logo de " + menu.local;
    $("portada").prepend(logo);
  }
  if (mesa) {
    $("mesa-etiqueta").textContent = "Mesa " + mesa;
    $("mesa-etiqueta").hidden = false;
  }

  const nav = $("categorias");
  const main = $("menu");

  menu.categorias.forEach((cat, i) => {
    const id = "cat-" + i;
    const enlace = el("a", "", cat.nombre);
    enlace.href = "#" + id;
    nav.append(enlace);

    const seccion = el("section", "seccion");
    seccion.id = id;
    seccion.append(el("h2", "", cat.nombre));
    cat.platos.forEach((p, j) => seccion.append(crearPlato(p, i + "-" + j)));
    main.append(seccion);
  });

  resaltarCategoriaActiva();
  configurarPanel();
  refrescar();
}

// ============ Pedido: barra, panel y WhatsApp ============
function textoPedido() {
  const lineas = items().map(i => i.cant + " x " + i.nombre);
  const nota = $("nota").value.trim();
  return [
    "Pedido - " + (mesa ? "Mesa " + mesa : "Sin mesa"),
    ...lineas,
    nota ? "Aclaraciones: " + nota : "",
    "Total: " + formatoPrecio.format(totalPrecio())
  ].filter(Boolean).join("\n");
}

function refrescar() {
  if (!config.activo) return;

  // Contadores de cada plato
  document.querySelectorAll(".control").forEach(c => {
    const cant = pedido[c.dataset.id] ? pedido[c.dataset.id].cant : 0;
    c.querySelector(".cant").textContent = cant;
    c.classList.toggle("vacio", cant === 0);
  });

  // Barra inferior
  const barra = $("barra-pedido");
  const hay = totalPlatos() > 0;
  barra.hidden = !hay;
  barra.textContent = "Ver pedido · " + totalPlatos() + " · " + formatoPrecio.format(totalPrecio());

  // Panel
  const lista = $("panel-lista");
  lista.replaceChildren();
  items().forEach(i => {
    const fila = el("div", "panel-item");
    fila.append(el("span", "", i.cant + " x " + i.nombre), el("span", "", formatoPrecio.format(i.cant * i.precio)));
    lista.append(fila);
  });
  $("panel-total").textContent = formatoPrecio.format(totalPrecio());
  if (!hay) $("panel").hidden = true;

  // Botón de WhatsApp (solo si el local cargó su número)
  const wsp = $("btn-wsp");
  if (config.whatsapp) {
    wsp.hidden = false;
    wsp.href = "https://wa.me/" + config.whatsapp + "?text=" + encodeURIComponent(textoPedido());
  }
}

function configurarPanel() {
  if (!config.activo) return;
  $("panel-mesa").textContent = mesa ? "Mesa " + mesa : "Mostrale esta pantalla al mozo";
  $("panel-ayuda").textContent = mesa
    ? "Mostrale esta pantalla al mozo para confirmar tu pedido."
    : "Pedile al mozo que te tome el pedido con esta lista.";

  $("barra-pedido").addEventListener("click", () => { $("panel").hidden = false; });
  $("cerrar").addEventListener("click", () => { $("panel").hidden = true; });
  $("panel").addEventListener("click", e => { if (e.target === $("panel")) $("panel").hidden = true; });
  $("nota").addEventListener("input", refrescar);
  $("vaciar").addEventListener("click", () => {
    pedido = {};
    guardar();
    refrescar();
  });
}

// ============ Categoría activa al scrollear ============
function resaltarCategoriaActiva() {
  const nav = $("categorias");
  const enlaces = Array.from(document.querySelectorAll(".categorias a"));
  const secciones = Array.from(document.querySelectorAll(".seccion"));
  let bloqueadoPorClic = false;
  let temporizador;
  let idActivo = "";

  function activar(id) {
    if (id === idActivo) return;
    idActivo = id;
    enlaces.forEach(a => a.classList.toggle("activa", a.hash === "#" + id));
    const activo = document.querySelector(".categorias a.activa");
    if (activo && nav) {
      nav.scrollLeft = activo.offsetLeft - (nav.clientWidth / 2) + (activo.offsetWidth / 2);
    }
  }

  enlaces.forEach(enlace => {
    enlace.addEventListener("click", () => {
      bloqueadoPorClic = true;
      activar(enlace.hash.slice(1));
      clearTimeout(temporizador);
      temporizador = setTimeout(() => { bloqueadoPorClic = false; }, 800);
    });
  });

  window.addEventListener("scroll", () => {
    if (bloqueadoPorClic || secciones.length === 0) return;
    const alFinal = window.innerHeight + Math.round(window.scrollY) >= document.documentElement.scrollHeight - 10;
    if (alFinal) { activar(secciones[secciones.length - 1].id); return; }

    let actual = secciones[0].id;
    for (const seccion of secciones) {
      if (seccion.getBoundingClientRect().top <= 130) actual = seccion.id;
    }
    activar(actual);
  }, { passive: true });

  if (secciones.length > 0) activar(secciones[0].id);
}

// ============ Cargar los datos: se edita SOLO menu.json ============
fetch("menu.json")
  .then(r => r.json())
  .then(dibujarMenu)
  .catch(() => {
    const aviso = el("p", "error", "No se pudo cargar el menú. Si abriste index.html con doble clic, probá con la extensión Live Server de VS Code o subilo a GitHub Pages.");
    document.body.prepend(aviso);
  });
