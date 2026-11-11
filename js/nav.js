/**
 * Menú de cuenta compartido por index.html, subir.html y admin.html.
 * Consulta api/sesion.php y muestra los enlaces según el usuario.
 */
import { pedirApi, crear } from './api.js';

const CLAVE = 'halloween_sesion';
const SIN_SESION = { autenticado: false, usuario: null, es_admin: false, voto_por: null };

/**
 * Última sesión conocida, guardada en el navegador.
 * Sirve solo para dibujar el menú correcto apenas carga la página (sin saltos de diseño).
 * No da ningún permiso: la API vuelve a verificar la sesión en cada pedido.
 */
export function sesionGuardada() {
    try {
        return JSON.parse(localStorage.getItem(CLAVE)) || SIN_SESION;
    } catch {
        return SIN_SESION;
    }
}

export function guardarSesion(sesion) {
    try {
        localStorage.setItem(CLAVE, JSON.stringify({
            autenticado: sesion.autenticado, usuario: sesion.usuario, es_admin: sesion.es_admin,
        }));
    } catch { /* sin almacenamiento disponible: no pasa nada */ }
}

export async function obtenerSesion() {
    const r = await pedirApi('api/sesion.php');
    const sesion = r.ok ? r.datos : SIN_SESION;
    guardarSesion(sesion);
    return sesion;
}

function enlace(href, texto, actual) {
    const li = crear('li');
    const a = crear('a', { clase: 'btn btn-secundario', texto, attrs: { href } });
    if (actual) a.setAttribute('aria-current', 'page');
    li.append(a);
    return li;
}

/**
 * Dibuja el menú en <ul id="nav-cuenta">.
 * alCerrarSesion se ejecuta después de un logout exitoso.
 */
export function renderNav(sesion, alCerrarSesion) {
    const nav = document.getElementById('nav-cuenta');
    const pagina = location.pathname.split('/').pop() || 'index.html';
    nav.replaceChildren();

    if (!sesion.autenticado) {
        nav.append(enlace('login.html', 'Iniciar sesión'), enlace('registro.html', 'Registrarse'));
        return;
    }

    nav.append(crear('li', { clase: 'saludo', texto: `Hola, ${sesion.usuario}` }));
    nav.append(enlace('subir.html', 'Subir mi disfraz', pagina === 'subir.html'));
    if (sesion.es_admin) {
        nav.append(enlace('admin.html', 'Administración', pagina === 'admin.html'));
    }

    const li = crear('li');
    const salir = crear('button', { clase: 'btn btn-secundario', texto: 'Cerrar sesión', attrs: { type: 'button' } });
    salir.addEventListener('click', async () => {
        const r = await pedirApi('api/logout.php', { metodo: 'POST' });
        if (r.ok) {
            guardarSesion(SIN_SESION);
            alCerrarSesion();
        }
    });
    li.append(salir);
    nav.append(li);
}
