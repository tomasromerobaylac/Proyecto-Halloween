/**
 * admin.html: CRUD de disfraces (solo administrador).
 *   Crear    -> POST   api/disfraces.php          (FormData con foto)
 *   Leer     -> GET    api/disfraces.php
 *   Editar   -> POST   api/disfraces.php?id=N     (FormData, foto opcional)
 *   Eliminar -> DELETE api/disfraces.php?id=N     (borrado lógico)
 * La API vuelve a verificar que el usuario sea administrador (403 si no lo es).
 */
import { pedirApi, anunciar, crear } from './api.js';
import { obtenerSesion, renderNav, sesionGuardada } from './nav.js';
import { validar } from './formulario.js';

const panel = document.getElementById('panel');
const sinPermiso = document.getElementById('sin-permiso');
const form = document.getElementById('form-disfraz');
const tituloForm = document.getElementById('titulo-form');
const tituloTabla = document.getElementById('titulo-tabla');
const inputNombre = document.getElementById('nombre');
const inputDescripcion = document.getElementById('descripcion');
const inputFoto = document.getElementById('foto');
const ayudaFoto = document.getElementById('ayuda-foto');
const btnGuardar = document.getElementById('btn-guardar');
const btnCancelar = document.getElementById('btn-cancelar');
const tabla = document.getElementById('tabla-disfraces');
const aviso = document.getElementById('aviso');

let editandoId = null;   // null = modo "agregar"
let ocultarAviso;

function mostrarAviso(mensaje, tipo) {
    clearTimeout(ocultarAviso);
    anunciar(aviso, mensaje, tipo);
    ocultarAviso = setTimeout(() => { aviso.textContent = ''; }, 8000);
}

/* ---------- Modo agregar / editar ---------- */
function modoAgregar() {
    editandoId = null;
    form.reset();
    form.querySelectorAll('[aria-invalid]').forEach(c => c.removeAttribute('aria-invalid'));
    tituloForm.textContent = 'Agregar disfraz';
    btnGuardar.textContent = 'Agregar disfraz';
    inputFoto.required = true;
    inputFoto.setAttribute('aria-required', 'true');
    ayudaFoto.textContent = 'JPG, PNG, GIF o WEBP, hasta 800 KB.';
    btnCancelar.hidden = true;
}

function modoEditar(d) {
    editandoId = d.id;
    inputNombre.value = d.nombre;
    inputDescripcion.value = d.descripcion;
    inputFoto.value = '';
    inputFoto.required = false;
    inputFoto.setAttribute('aria-required', 'false');
    ayudaFoto.textContent = 'Opcional: elegí una foto solo si querés reemplazar la actual. JPG, PNG, GIF o WEBP, hasta 800 KB.';
    tituloForm.textContent = `Editar disfraz: ${d.nombre}`;
    btnGuardar.textContent = 'Guardar cambios';
    btnCancelar.hidden = false;
    inputNombre.focus(); // el lector anuncia el campo; el título indica qué se edita
    mostrarAviso(`Editando "${d.nombre}".`, 'ok');
}

/* ---------- Tabla (Read) ---------- */
async function cargarTabla() {
    const r = await pedirApi('api/disfraces.php');
    tabla.replaceChildren();

    if (!r.ok) {
        mostrarAviso(r.datos.error || 'No se pudieron cargar los disfraces.', 'error');
        return;
    }
    if (r.datos.length === 0) {
        const fila = crear('tr');
        fila.append(crear('td', { texto: 'No hay disfraces cargados.', attrs: { colspan: '5' } }));
        tabla.append(fila);
        return;
    }

    r.datos.forEach(d => {
        const fila = crear('tr');
        const celdaFoto = crear('td');
        celdaFoto.append(crear('img', {
            attrs: { src: d.foto_url, alt: `Foto del disfraz ${d.nombre}`, width: '56', height: '56', loading: 'lazy' },
        }));

        const editar = crear('button', { clase: 'btn-secundario', attrs: { type: 'button', 'data-editar': String(d.id) } });
        editar.append(document.createTextNode('Editar'), crear('span', { clase: 'sr-only', texto: ` ${d.nombre}` }));
        editar.addEventListener('click', () => modoEditar(d));

        const eliminar = crear('button', { clase: 'btn-peligro', attrs: { type: 'button' } });
        eliminar.append(document.createTextNode('Eliminar'), crear('span', { clase: 'sr-only', texto: ` ${d.nombre}` }));
        eliminar.addEventListener('click', () => borrar(d));

        const acciones = crear('td', { clase: 'acciones' });
        acciones.append(editar, eliminar);

        fila.append(celdaFoto, crear('td', { texto: d.nombre }), crear('td', { texto: d.descripcion }),
                    crear('td', { texto: String(d.votos) }), acciones);
        tabla.append(fila);
    });
}

/* ---------- Crear / Editar ---------- */
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validar(form, aviso)) return;

    const id = editandoId;
    const ruta = id === null ? 'api/disfraces.php' : `api/disfraces.php?id=${id}`;
    btnGuardar.disabled = true;
    const r = await pedirApi(ruta, { metodo: 'POST', formulario: new FormData(form) });
    btnGuardar.disabled = false;

    if (!r.ok) {
        mostrarAviso(r.datos.error || 'No se pudo guardar el disfraz.', 'error');
        btnGuardar.focus();
        return;
    }
    modoAgregar();
    await cargarTabla();
    // Después de editar, el foco vuelve al botón "Editar" de esa fila; después de agregar, al formulario
    const destino = id === null ? inputNombre : tabla.querySelector(`button[data-editar="${id}"]`);
    destino?.focus({ preventScroll: true });
    destino?.scrollIntoView({ block: 'center', behavior: 'instant' }); // el aviso flotante no tapa el foco
    mostrarAviso(r.datos.mensaje, 'ok');
});

btnCancelar.addEventListener('click', () => {
    const id = editandoId;
    modoAgregar();
    tabla.querySelector(`button[data-editar="${id}"]`)?.focus();
    mostrarAviso('Edición cancelada.', 'ok');
});

/* ---------- Eliminar ---------- */
async function borrar(d) {
    // confirm() es un diálogo nativo: accesible por teclado y para lectores de pantalla
    if (!window.confirm(`¿Eliminar el disfraz "${d.nombre}"? Ya no se mostrará en la votación.`)) return;

    const r = await pedirApi(`api/disfraces.php?id=${d.id}`, { metodo: 'DELETE' });
    if (!r.ok) {
        mostrarAviso(r.datos.error || 'No se pudo eliminar el disfraz.', 'error');
        return;
    }
    if (editandoId === d.id) modoAgregar();
    await cargarTabla();
    tituloTabla.focus(); // la fila desapareció: el foco pasa al título de la tabla
    mostrarAviso(r.datos.mensaje, 'ok');
}

/* ---------- Inicio ---------- */
async function iniciar() {
    const alSalir = () => { window.location.href = 'index.html'; };
    renderNav(sesionGuardada(), alSalir); // menú inmediato, sin esperar al servidor
    const sesion = await obtenerSesion();
    renderNav(sesion, alSalir);

    if (!sesion.es_admin) {
        sinPermiso.hidden = false; // "Esta página es solo para el administrador"
        return;
    }
    panel.hidden = false;
    await cargarTabla();
}

iniciar();
