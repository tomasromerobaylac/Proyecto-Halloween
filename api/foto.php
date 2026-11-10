<?php
/**
 * GET /api/foto.php?id=3
 * Devuelve la imagen del disfraz guardada en la columna foto_blob.
 * 200 imagen | 400 id inválido | 404 no existe | 500
 */
require_once __DIR__ . '/config/conexion.php';

exigirMetodo('GET');

$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($id === false || $id === null) {
    responderError(400, 'El identificador del disfraz no es válido.');
}

try {
    $stmt = obtenerConexion()->prepare('SELECT foto, foto_blob FROM disfraces WHERE id = ? AND eliminado = 0');
    $stmt->execute([$id]);
    $fila = $stmt->fetch();
} catch (PDOException $e) {
    error_log('[halloween] foto: ' . $e->getMessage());
    responderError(500, 'No se pudo obtener la foto.');
}

if (!$fila) {
    responderError(404, 'La foto solicitada no existe.');
}

header('Content-Type: ' . $fila['foto']);
header('Content-Length: ' . strlen($fila['foto_blob']));
header('Cache-Control: public, max-age=86400'); // la URL lleva ?v=..., cambia si cambia la foto
// Aunque alguien lograra guardar un archivo con código, el navegador no lo ejecuta
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox");
echo $fila['foto_blob'];
