<?php
/**
 * POST /api/login.php   body: { "nombre": "...", "clave": "..." }
 * 200 Sesión iniciada | 400 Campos vacíos | 401 Credenciales incorrectas | 405 | 500
 */
require_once __DIR__ . '/config/conexion.php';
require_once __DIR__ . '/lib/auth.php';

exigirMetodo('POST');
iniciarSesion();

$datos  = leerJson();
$nombre = trim((string) ($datos['nombre'] ?? ''));
$clave  = (string) ($datos['clave'] ?? '');

if ($nombre === '' || $clave === '') {
    responderError(400, 'Completá el nombre de usuario y la contraseña.');
}

try {
    $pdo  = obtenerConexion();
    $stmt = $pdo->prepare('SELECT id, nombre, clave FROM usuarios WHERE nombre = ?');
    $stmt->execute([$nombre]);
    $usuario = $stmt->fetch();

    // Solo se acepta el hash BCRYPT (no hay comparación en texto plano)
    if (!$usuario || !password_verify($clave, $usuario['clave'])) {
        responderError(401, 'Usuario o contraseña incorrectos.'); // mensaje genérico: no revela qué falló
    }

    session_regenerate_id(true); // previene fijación de sesión
    $_SESSION['usuario_id']     = (int) $usuario['id'];
    $_SESSION['usuario_nombre'] = $usuario['nombre'];
    $_SESSION['es_admin']       = $usuario['nombre'] === ADMIN_USUARIO;

    responder(200, [
        'success'  => true,
        'usuario'  => $usuario['nombre'],
        'es_admin' => $_SESSION['es_admin'],
    ]);
} catch (PDOException $e) {
    error_log('[halloween] login: ' . $e->getMessage());
    responderError(500, 'Error interno al iniciar sesión.');
}
