<?php
/**
 * GET /api/sesion.php
 * Informa si hay un usuario autenticado, si es administrador y si ya votó.
 * 200 { "autenticado": bool, "usuario": string|null, "es_admin": bool, "voto_por": int|null }
 */
require_once __DIR__ . '/config/conexion.php';

exigirMetodo('GET');
iniciarSesion();

if (!isset($_SESSION['usuario_id'])) {
    responder(200, ['autenticado' => false, 'usuario' => null, 'es_admin' => false, 'voto_por' => null]);
}

try {
    $stmt = obtenerConexion()->prepare('SELECT id_disfraz FROM votos WHERE id_usuario = ?');
    $stmt->execute([$_SESSION['usuario_id']]);
    $voto = $stmt->fetch();

    responder(200, [
        'autenticado' => true,
        'usuario'     => $_SESSION['usuario_nombre'],
        'es_admin'    => !empty($_SESSION['es_admin']),
        'voto_por'    => $voto ? (int) $voto['id_disfraz'] : null,
    ]);
} catch (PDOException $e) {
    error_log('[halloween] sesion: ' . $e->getMessage());
    responderError(500, 'No se pudo consultar la sesión.');
}
