/**
 * Vista principal: podio, listado de disfraces y votación.
 * El DOM se construye con createElement + textContent (sin innerHTML).
 */
import { pedirApi, anunciar, crear } from './api.js';
import { obtenerSesion, renderNav, sesionGuardada } from './nav.js';

const contenedorTop = document.getElementById('contenedor-top');
const contenedorDisfraces = document.getElementById('contenedor-disfraces');
const aviso = document.getElementById('aviso');

let sesion = { autenticado: false, usuario: null, es_admin: false, voto_por: null };
let ocultarAviso;

function mostrarAviso(mensaje, tipo) {
    clearTimeout(ocultarAviso);
    anunciar(aviso, mensaje, tipo);
    ocultarAviso = setTimeout(() => { aviso.textContent = ''; }, 8000);
}

function crearImagen(d) {
    return crear('img', {
        attrs: { src: d.foto_url, alt: `Foto del disfraz ${d.nombre}`, width: '96', height: '96', loading: 'lazy' },
    });
}

/* ---------- Menú de cuenta ---------- */
async function alCerrarSesion() {
    sesion = { autenticado: false, usuario: null, es_admin: false, voto_por: null };
    renderNav(sesion, alCerrarSesion);
    await cargarDisfraces();
    document.querySelector('#nav-cuenta a')?.focus(); // el foco no se pierde al desaparecer el botón
    mostrarAviso('Cerraste sesión correctamente.', 'ok');
}

/* ---------- Podio y listado ---------- */
function renderPodio(disfraces) {
    const medallas = ['🥇', '🥈', '🥉'];
    const puestos = ['Primer puesto', 'Segundo puesto', 'Tercer puesto'];
    contenedorTop.replaceChildren();

    [...disfraces].sort((a, b) => b.votos - a.votos).slice(0, 3).forEach((d, i) => {
        const li = crear('li', { clase: 'podio-card' });
        const puesto = crear('span', { clase: 'puesto' });
        puesto.append(crear('span', { texto: medallas[i], attrs: { 'aria-hidden': 'true' } }),
                      crear('span', { clase: 'sr-only', texto: puestos[i] }));
        li.append(puesto, crearImagen(d), crear('h3', { texto: d.nombre }),
                  crear('p', { texto: `${d.votos} ${d.votos === 1 ? 'voto' : 'votos'}` }));
        contenedorTop.append(li);
    });
}

function renderListado(disfraces) {
    contenedorDisfraces.replaceChildren();

    disfraces.forEach(d => {
        const yaVotoEste = sesion.voto_por === d.id;
        const li = crear('li', { clase: yaVotoEste ? 'card votado' : 'card' });
        li.append(
            crearImagen(d),
            crear('h3', { texto: d.nombre }),
            crear('p', { texto: d.descripcion }),
            crear('p', { clase: 'votos', texto: `Votos: ${d.votos}` })
        );
        if (yaVotoEste) li.append(crear('p', { clase: 'etiqueta-votado', texto: '✔ Tu voto' }));

        // Botón nativo: enfocable con Tab y activable con Enter/Espacio
        const boton = crear('button', { attrs: { type: 'button', 'data-id': String(d.id) } });
        boton.append(document.createTextNode('Votar'), crear('span', { clase: 'sr-only', texto: ` por ${d.nombre}` }));
        boton.addEventListener('click', () => votar(d.id, d.nombre));
        li.append(boton);

        contenedorDisfraces.append(li);
    });
}

async function cargarDisfraces() {
    contenedorTop.setAttribute('aria-busy', 'true');
    contenedorDisfraces.setAttribute('aria-busy', 'true');

    const r = await pedirApi('api/disfraces.php');

    contenedorTop.setAttribute('aria-busy', 'false');
    contenedorDisfraces.setAttribute('aria-busy', 'false');

    if (!r.ok) {
        const msg = r.datos.error || 'Error al cargar los disfraces.';
        contenedorDisfraces.replaceChildren(crear('li', { clase: 'cargando', texto: msg }));
        contenedorTop.replaceChildren();
        mostrarAviso(msg, 'error');
        return;
    }
    renderPodio(r.datos);
    renderListado(r.datos);
}

/* ---------- Votación ---------- */
async function votar(disfrazId, nombre) {
    const r = await pedirApi('api/votar.php', { metodo: 'POST', datos: { disfraz_id: disfrazId } });

    if (r.ok) {
        sesion.voto_por = disfrazId;
        await cargarDisfraces();
        // Se devuelve el foco al botón del mismo disfraz (el DOM se regeneró)
        const boton = contenedorDisfraces.querySelector(`button[data-id="${disfrazId}"]`);
        boton?.focus({ preventScroll: true });
        boton?.scrollIntoView({ block: 'center', behavior: 'instant' }); // el aviso flotante nunca tapa el foco
        mostrarAviso(r.datos.mensaje || `Voto registrado para ${nombre}.`, 'ok');
        return;
    }
    const msg = r.estado === 401
        ? 'Tenés que iniciar sesión para votar. Usá el enlace "Iniciar sesión" del encabezado.'
        : (r.datos.error || 'Ocurrió un error al registrar el voto.');
    mostrarAviso(msg, 'error');
}

/* ---------- Inicio ---------- */
async function iniciar() {
    renderNav(sesionGuardada(), alCerrarSesion); // menú inmediato, sin esperar al servidor
    sesion = await obtenerSesion();
    renderNav(sesion, alCerrarSesion);
    await cargarDisfraces();
}

iniciar();
