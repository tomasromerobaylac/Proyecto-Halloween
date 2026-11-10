<?php
/**
 * Utilidades comunes de la API REST.
 * Centraliza: cabeceras JSON, códigos HTTP semánticos, lectura del body
 * y configuración segura de la sesión.
 */

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

/** Envía una respuesta JSON con el código HTTP indicado y termina. */
function responder(int $codigo, array $datos): void
{
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Atajo para errores: { "error": "mensaje" } */
function responderError(int $codigo, string $mensaje): void
{
    responder($codigo, ['error' => $mensaje]);
}

/** Restringe el endpoint a los métodos permitidos (405 si no coincide). */
function exigirMetodo(string ...$metodos): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'], $metodos, true)) {
        header('Allow: ' . implode(', ', $metodos));
        responderError(405, 'Método no permitido.');
    }
}

/** Lee el cuerpo JSON de la petición. 400 si no es JSON válido. */
function leerJson(): array
{
    $datos = json_decode(file_get_contents('php://input'), true);
    if (!is_array($datos)) {
        responderError(400, 'El cuerpo de la petición debe ser JSON válido.');
    }
    return $datos;
}

/** Inicia la sesión con cookies seguras (HttpOnly + SameSite). */
function iniciarSesion(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_start([
            'cookie_httponly' => true,
            'cookie_samesite' => 'Lax',
            'use_strict_mode' => true,
        ]);
    }
}
