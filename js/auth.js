/**
 * Lógica compartida de login.html y registro.html.
 * El endpoint y la página de destino se leen de los atributos data-* del formulario.
 */
import { pedirApi, anunciar } from './api.js';
import { validar } from './formulario.js';
import { guardarSesion } from './nav.js';

const form = document.getElementById('form-auth');
const mensaje = document.getElementById('mensaje-form');
const boton = form.querySelector('button[type="submit"]');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validar(form, mensaje)) return;

    const datos = Object.fromEntries(new FormData(form));
    boton.disabled = true;
    anunciar(mensaje, 'Enviando…', 'ok');

    const r = await pedirApi(form.dataset.endpoint, { metodo: 'POST', datos });
    boton.disabled = false;

    if (r.ok) {
        if (r.datos.usuario) guardarSesion({ autenticado: true, usuario: r.datos.usuario, es_admin: r.datos.es_admin });
        const texto = r.datos.mensaje || `¡Bienvenido, ${r.datos.usuario}! Redirigiendo…`;
        anunciar(mensaje, texto, 'ok');
        setTimeout(() => { window.location.href = form.dataset.destino; }, 1500);
    } else {
        anunciar(mensaje, r.datos.error || 'No se pudo completar la operación.', 'error');
        boton.focus();
    }
});
