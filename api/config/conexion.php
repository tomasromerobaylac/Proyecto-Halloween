<?php
/**
 * Capa de datos: conexión PDO a MySQL.
 * Los valores por defecto corresponden a XAMPP (root sin contraseña).
 * Pueden sobreescribirse con variables de entorno sin tocar el código.
 */
require_once __DIR__ . '/../lib/respuesta.php';

function obtenerConexion(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $host    = getenv('DB_HOST') ?: 'localhost';
    $db      = getenv('DB_NAME') ?: 'halloween';
    $user    = getenv('DB_USER') ?: 'root';
    $pass    = getenv('DB_PASS') ?: '';
    $charset = 'utf8mb4';

    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $opciones = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION, // toda falla lanza PDOException
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,                  // prepared statements reales (anti SQLi)
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $opciones);
    } catch (PDOException $e) {
        error_log('[halloween] Error de conexión: ' . $e->getMessage());
        responderError(500, 'No se pudo conectar con la base de datos.');
    }
    return $pdo;
}
