/**
 * subir.html: un usuario registrado carga su disfraz con foto.
 * El formulario se envía como FormData (multipart/form-data) a POST api/disfraces.php.
 */
import { pedirApi, anunciar } from './api.js';
import { obtenerSesion, renderNav, sesionGuardada } from './nav.js';
import { validar } from './formulario.js';

const form = document.getElementById('form-disfraz');
const sinSesion = document.getElementById('sin-sesion');
const mensaje = document.getElementById('mensaje-form');
const boton = form.querySelector('button[type="submit"]');

function mostrarSegunSesion(sesion) {
    form.hidden = !sesion.autenticado;
    sinSesion.hidden = sesion.autenticado;
}

async function iniciar() {
    const alSalir = () => { window.location.href = 'index.html'; };
    renderNav(sesionGuardada(), alSalir); // menú inmediato, sin esperar al servidor
    mostrarSegunSesion(sesionGuardada());
    const sesion = await obtenerSesion();
    renderNav(sesion, alSalir);
    mostrarSegunSesion(sesion);
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validar(form, mensaje)) return;

    boton.disabled = true;
    anunciar(mensaje, 'Subiendo el disfraz…', 'ok');

    const r = await pedirApi('api/disfraces.php', { metodo: 'POST', formulario: new FormData(form) });
    boton.disabled = false;

    if (r.ok) {
        anunciar(mensaje, `${r.datos.mensaje} Redirigiendo al inicio…`, 'ok');
        form.reset();
        setTimeout(() => { window.location.href = 'index.html'; }, 2000);
    } else {
        anunciar(mensaje, r.datos.error || 'No se pudo subir el disfraz.', 'error');
        boton.focus();
    }
});

iniciar();
