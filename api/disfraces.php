<?php
/**
 * Recurso REST "disfraces"
 *
 *  GET    /api/disfraces.php            Lista de disfraces activos          200
 *  GET    /api/disfraces.php?id=3       Un disfraz                          200 | 404
 *  POST   /api/disfraces.php            Crear (usuario logueado)            201 | 400 | 401
 *  POST   /api/disfraces.php?id=3       Editar (solo admin)                 200 | 400 | 401 | 403 | 404
 *         (se usa POST y no PUT porque PHP solo procesa formularios
 *          con archivos multipart/form-data cuando llegan por POST)
 *  DELETE /api/disfraces.php?id=3       Eliminar (solo admin, borrado lógico) 200 | 401 | 403 | 404
 *
 *  Los formularios de alta y edición se envían como multipart/form-data:
 *  nombre, descripcion y foto (archivo de imagen, opcional al editar).
 */
require_once __DIR__ . '/config/conexion.php';
require_once __DIR__ . '/lib/auth.php';

const MAX_FOTO_BYTES = 800 * 1024; // XAMPP limita los paquetes de MySQL a 1 MB
const TIPOS_FOTO     = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

exigirMetodo('GET', 'POST', 'DELETE');

$id = null;
if (isset($_GET['id'])) {
    $id = filter_var($_GET['id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false) {
        responderError(400, 'El identificador del disfraz no es válido.');
    }
}

/** Convierte una fila de la BD en el JSON público (sin el BLOB). */
function aJson(array $d): array
{
    return [
        'id'          => (int) $d['id'],
        'nombre'      => $d['nombre'],
        'descripcion' => $d['descripcion'],
        'votos'       => (int) $d['votos'],
        // la versión cambia cuando cambia la foto, así el navegador no muestra una vieja
        'foto_url'    => 'api/foto.php?id=' . $d['id'] . '&v=' . $d['version'],
    ];
}

/** Valida nombre y descripción del formulario. */
function leerCampos(): array
{
    $nombre      = trim((string) ($_POST['nombre'] ?? ''));
    $descripcion = trim((string) ($_POST['descripcion'] ?? ''));

    if ($nombre === '' || $descripcion === '') {
        responderError(400, 'Completá el nombre y la descripción del disfraz.');
    }
    if (mb_strlen($nombre) > 50) {
        responderError(400, 'El nombre no puede superar los 50 caracteres.');
    }
    if (mb_strlen($descripcion) > 500) {
        responderError(400, 'La descripción no puede superar los 500 caracteres.');
    }
    return [$nombre, $descripcion];
}

/**
 * Valida la imagen subida y devuelve [tipo MIME, bytes].
 * Devuelve null si no se subió ningún archivo y no es obligatorio.
 */
function leerFoto(bool $obligatoria): ?array
{
    $archivo = $_FILES['foto'] ?? null;

    if (!$archivo || $archivo['error'] === UPLOAD_ERR_NO_FILE) {
        if ($obligatoria) {
            responderError(400, 'Elegí una foto del disfraz.');
        }
        return null;
    }
    if ($archivo['error'] === UPLOAD_ERR_INI_SIZE || $archivo['error'] === UPLOAD_ERR_FORM_SIZE
        || $archivo['size'] > MAX_FOTO_BYTES) {
        responderError(400, 'La foto no puede pesar más de 800 KB.');
    }
    if ($archivo['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($archivo['tmp_name'])) {
        responderError(400, 'No se pudo subir la foto. Probá de nuevo.');
    }

    // No se confía en la extensión ni en el tipo que manda el navegador:
    // getimagesize() lee el contenido y confirma que sea una imagen real.
    $info = @getimagesize($archivo['tmp_name']);
    if ($info === false || !in_array($info['mime'], TIPOS_FOTO, true)) {
        responderError(400, 'El archivo debe ser una imagen JPG, PNG, GIF o WEBP.');
    }

    return [$info['mime'], file_get_contents($archivo['tmp_name'])];
}

try {
    $pdo    = obtenerConexion();
    $metodo = $_SERVER['REQUEST_METHOD'];

    // ---------- GET: listar o ver uno ----------
    if ($metodo === 'GET') {
        $sql = 'SELECT id, nombre, descripcion, votos, CRC32(foto_blob) AS version
                  FROM disfraces WHERE eliminado = 0';
        if ($id !== null) {
            $stmt = $pdo->prepare($sql . ' AND id = ?');
            $stmt->execute([$id]);
            $d = $stmt->fetch();
            if (!$d) {
                responderError(404, 'El disfraz solicitado no existe.');
            }
            responder(200, aJson($d));
        }
        $stmt = $pdo->prepare($sql . ' ORDER BY votos DESC, nombre ASC');
        $stmt->execute();
        responder(200, array_map('aJson', $stmt->fetchAll()));
    }

    // ---------- POST sin id: crear ----------
    if ($metodo === 'POST' && $id === null) {
        exigirLogin(); // cualquier usuario registrado puede subir su disfraz
        [$nombre, $descripcion] = leerCampos();
        [$tipo, $bytes]         = leerFoto(true);

        $stmt = $pdo->prepare(
            'INSERT INTO disfraces (nombre, descripcion, votos, foto, foto_blob, eliminado)
             VALUES (?, ?, 0, ?, ?, 0)'
        );
        $stmt->bindValue(1, $nombre);
        $stmt->bindValue(2, $descripcion);
        $stmt->bindValue(3, $tipo);
        $stmt->bindValue(4, $bytes, PDO::PARAM_LOB);
        $stmt->execute();

        responder(201, [
            'success' => true,
            'id'      => (int) $pdo->lastInsertId(),
            'mensaje' => 'Disfraz "' . $nombre . '" cargado correctamente.',
        ]);
    }

    // A partir de acá (editar y eliminar) solo puede el administrador
    exigirAdmin();
    if ($id === null) {
        responderError(400, 'Falta el identificador del disfraz.');
    }

    $stmt = $pdo->prepare('SELECT nombre FROM disfraces WHERE id = ? AND eliminado = 0');
    $stmt->execute([$id]);
    $actual = $stmt->fetch();
    if (!$actual) {
        responderError(404, 'El disfraz solicitado no existe.');
    }

    // ---------- POST con id: editar ----------
    if ($metodo === 'POST') {
        [$nombre, $descripcion] = leerCampos();
        $foto = leerFoto(false); // al editar, la foto es opcional

        if ($foto === null) {
            $pdo->prepare('UPDATE disfraces SET nombre = ?, descripcion = ? WHERE id = ?')
                ->execute([$nombre, $descripcion, $id]);
        } else {
            $stmt = $pdo->prepare('UPDATE disfraces SET nombre = ?, descripcion = ?, foto = ?, foto_blob = ? WHERE id = ?');
            $stmt->bindValue(1, $nombre);
            $stmt->bindValue(2, $descripcion);
            $stmt->bindValue(3, $foto[0]);
            $stmt->bindValue(4, $foto[1], PDO::PARAM_LOB);
            $stmt->bindValue(5, $id, PDO::PARAM_INT);
            $stmt->execute();
        }
        responder(200, ['success' => true, 'mensaje' => 'Disfraz "' . $nombre . '" actualizado.']);
    }

    // ---------- DELETE: borrado lógico (columna eliminado) ----------
    $pdo->prepare('UPDATE disfraces SET eliminado = 1 WHERE id = ?')->execute([$id]);
    responder(200, ['success' => true, 'mensaje' => 'Disfraz "' . $actual['nombre'] . '" eliminado.']);

} catch (PDOException $e) {
    error_log('[halloween] disfraces: ' . $e->getMessage());
    responderError(500, 'Error interno al procesar los disfraces.');
}
