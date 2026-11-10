<?php
/**
 * Autenticación y autorización.
 * El administrador es el usuario cuyo nombre coincide con ADMIN_USUARIO
 * (se crea con el script database/halloween.sql).
 */
require_once __DIR__ . '/respuesta.php';

const ADMIN_USUARIO = 'admin';

/** 401 si no hay sesión iniciada. Devuelve el id del usuario. */
function exigirLogin(): int
{
    iniciarSesion();
    if (!isset($_SESSION['usuario_id'])) {
        responderError(401, 'Tenés que iniciar sesión.');
    }
    return (int) $_SESSION['usuario_id'];
}

/** 401 sin sesión, 403 si el usuario no es administrador. */
function exigirAdmin(): int
{
    $id = exigirLogin();
    if (empty($_SESSION['es_admin'])) {
        responderError(403, 'Solo el administrador puede hacer esta acción.');
    }
    return $id;
}
