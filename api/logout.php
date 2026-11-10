<?php
/**
 * POST /api/logout.php
 * 200 Sesión cerrada | 405
 */
require_once __DIR__ . '/lib/respuesta.php';

exigirMetodo('POST');
iniciarSesion();

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}
session_destroy();

responder(200, ['success' => true, 'mensaje' => 'Sesión cerrada.']);
