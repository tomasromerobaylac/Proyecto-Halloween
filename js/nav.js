/**
 * Menú de cuenta compartido por index.html, subir.html y admin.html.
 * Consulta api/sesion.php y muestra los enlaces según el usuario.
 */
import { pedirApi, crear } from './api.js';

export async function obtenerSesion() {
    const r = await pedirApi('api/sesion.php');
    return r.ok ? r.datos : { autenticado: false, usuario: null, es_admin: false, voto_por: null };
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
        if (r.ok) alCerrarSesion();
    });
    li.append(salir);
    nav.append(li);
}
