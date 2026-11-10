/**
 * Capa de acceso a la API REST (fetch + JSON).
 * Todas las vistas usan esta función para hablar con el backend PHP.
 *
 *  - datos:      objeto que se envía como JSON
 *  - formulario: FormData (para formularios con archivos, multipart/form-data)
 */
export async function pedirApi(ruta, { metodo = 'GET', datos, formulario } = {}) {
    const opciones = {
        method: metodo,
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
    };
    if (formulario !== undefined) {
        opciones.body = formulario; // el navegador arma el multipart y su Content-Type
    } else if (datos !== undefined) {
        opciones.headers['Content-Type'] = 'application/json';
        opciones.body = JSON.stringify(datos);
    }

    let respuesta;
    try {
        respuesta = await fetch(ruta, opciones);
    } catch {
        return { ok: false, estado: 0, datos: { error: 'No hay conexión con el servidor.' } };
    }

    let cuerpo = {};
    try {
        cuerpo = await respuesta.json();
    } catch {
        cuerpo = { error: 'Respuesta inválida del servidor.' };
    }
    return { ok: respuesta.ok, estado: respuesta.status, datos: cuerpo };
}

/**
 * Escribe un mensaje en una región aria-live usando textContent
 * (nunca innerHTML: evita XSS y garantiza que el lector de pantalla lo lea).
 */
export function anunciar(region, mensaje, tipo = 'ok') {
    region.classList.remove('ok', 'error');
    region.textContent = '';
    // Pequeña pausa para que el lector de pantalla detecte el cambio aunque el texto se repita
    setTimeout(() => {
        region.classList.add(tipo);
        region.textContent = mensaje;
    }, 50);
}

/** Crea un elemento del DOM con texto seguro (textContent) y atributos. */
export function crear(etiqueta, { clase, texto, attrs = {} } = {}) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}
