/**
 * Validación accesible de formularios (la validación real está en PHP).
 * Marca el campo con aria-invalid, anuncia el error y le da el foco.
 */
import { anunciar } from './api.js';

const MAX_FOTO_BYTES = 800 * 1024;

export function validar(form, region) {
    const campos = form.querySelectorAll('input:not([type="hidden"]), textarea');
    campos.forEach(c => c.removeAttribute('aria-invalid'));

    for (const campo of campos) {
        const etiqueta = form.querySelector(`label[for="${campo.id}"]`).textContent.trim();
        let detalle = null;

        if (!campo.checkValidity()) {
            detalle = 'es obligatorio';
            if (campo.validity.typeMismatch) detalle = 'no tiene un formato válido';
            if (campo.validity.tooShort) detalle = `debe tener al menos ${campo.minLength} caracteres`;
        } else if (campo.type === 'file' && campo.files[0] && campo.files[0].size > MAX_FOTO_BYTES) {
            detalle = 'no puede pesar más de 800 KB';
        }

        if (detalle) {
            campo.setAttribute('aria-invalid', 'true');
            anunciar(region, `El campo "${etiqueta}" ${detalle}.`, 'error');
            campo.focus();
            return false;
        }
    }
    return true;
}
