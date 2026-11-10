<?php
/**
 * POST /api/registro.php   body: { "nombre": "...", "clave": "..." }
 * 201 Usuario creado | 400 Datos inválidos | 409 Nombre ya registrado | 405 | 500
 */
require_once __DIR__ . '/config/conexion.php';

exigirMetodo('POST');

$datos  = leerJson();
$nombre = trim((string) ($datos['nombre'] ?? ''));
$clave  = (string) ($datos['clave'] ?? '');

if ($nombre === '' || $clave === '') {
    responderError(400, 'Completá el nombre de usuario y la contraseña.');
}
if (mb_strlen($nombre) < 3 || mb_strlen($nombre) > 50) {
    responderError(400, 'El nombre de usuario debe tener entre 3 y 50 caracteres.');
}
if (strlen($clave) < 8) {
    responderError(400, 'La contraseña debe tener al menos 8 caracteres.');
}

try {
    $pdo  = obtenerConexion();
    $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE nombre = ?');
    $stmt->execute([$nombre]);
    if ($stmt->fetch()) {
        responderError(409, 'Ese nombre de usuario ya está registrado.');
    }

    // OWASP A02: la contraseña nunca se guarda en texto plano
    $hash = password_hash($clave, PASSWORD_BCRYPT);

    $pdo->prepare('INSERT INTO usuarios (nombre, clave) VALUES (?, ?)')
        ->execute([$nombre, $hash]);

    responder(201, ['success' => true, 'mensaje' => '¡Registro exitoso! Ya podés iniciar sesión.']);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        responderError(409, 'Ese nombre de usuario ya está registrado.');
    }
    error_log('[halloween] registro: ' . $e->getMessage());
    responderError(500, 'Error interno al registrar el usuario.');
}
