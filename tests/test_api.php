<?php
/**
 * Pruebas automáticas de la API REST (caja negra).
 * Uso, con XAMPP encendido (desde la consola de Windows):
 *
 *     C:\xampp\php\php.exe C:\xampp\htdocs\halloween\tests\test_api.php http://localhost/halloween
 *
 * Conviene ejecutarlas con la base recién importada: crean un usuario de prueba,
 * votan, cargan un disfraz, lo editan y lo eliminan.
 * No necesita librerías externas: usa file_get_contents con stream context.
 */

if (!function_exists('mb_str_pad')) { // PHP < 8.3 (XAMPP)
    function mb_str_pad(string $s, int $n): string { return $s . str_repeat(' ', max(0, $n - mb_strlen($s))); }
}

$base = rtrim($argv[1] ?? 'http://localhost/halloween', '/');
$cookie = '';
$pasadas = 0;
$fallidas = 0;
$tiempos = [];

/** Hace una petición. $cuerpo puede ser array (JSON), ['multipart' => [...]] o string crudo. */
function pedir(string $metodo, string $ruta, $cuerpo = null): array
{
    global $base, $cookie;
    $cabeceras = ['Accept: application/json'];
    if ($cookie !== '') $cabeceras[] = "Cookie: $cookie";
    $contenido = '';

    if (is_array($cuerpo) && isset($cuerpo['multipart'])) {
        $limite = '----halloween' . bin2hex(random_bytes(6));
        foreach ($cuerpo['multipart'] as $campo => $valor) {
            $contenido .= "--$limite\r\n";
            if (is_array($valor)) { // archivo: [nombreArchivo, tipo, bytes]
                $contenido .= "Content-Disposition: form-data; name=\"$campo\"; filename=\"{$valor[0]}\"\r\n";
                $contenido .= "Content-Type: {$valor[1]}\r\n\r\n{$valor[2]}\r\n";
            } else {
                $contenido .= "Content-Disposition: form-data; name=\"$campo\"\r\n\r\n$valor\r\n";
            }
        }
        $contenido .= "--$limite--\r\n";
        $cabeceras[] = "Content-Type: multipart/form-data; boundary=$limite";
    } elseif (is_array($cuerpo)) {
        $contenido = json_encode($cuerpo);
        $cabeceras[] = 'Content-Type: application/json';
    } elseif (is_string($cuerpo)) {
        $contenido = $cuerpo;
        $cabeceras[] = 'Content-Type: application/json';
    }

    $ctx = stream_context_create(['http' => [
        'method'        => $metodo,
        'header'        => implode("\r\n", $cabeceras),
        'content'       => $contenido,
        'ignore_errors' => true,   // permite leer respuestas 4xx/5xx
        'timeout'       => 15,
    ]]);

    $t0 = microtime(true);
    $resp = @file_get_contents($base . $ruta, false, $ctx);
    $ms = (microtime(true) - $t0) * 1000;

    $codigo = 0;
    $tipo = '';
    foreach ($http_response_header ?? [] as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $codigo = (int) $m[1];
        if (preg_match('/^Content-Type:\s*([^;]+)/i', $h, $m)) $tipo = trim($m[1]);
        if (preg_match('/^Set-Cookie:\s*([^;]+)/i', $h, $m)) $cookie = $m[1];
    }
    return ['codigo' => $codigo, 'tipo' => $tipo, 'json' => json_decode((string) $resp, true), 'ms' => $ms];
}

function prueba(string $nombre, array $r, int $esperado, ?callable $extra = null): void
{
    global $pasadas, $fallidas, $tiempos;
    $tiempos[] = $r['ms'];
    $ok = $r['codigo'] === $esperado && ($extra === null || $extra($r));
    $ok ? $pasadas++ : $fallidas++;
    printf("%s %s esperado %d / obtenido %d  (%5.1f ms)\n",
        $ok ? '[OK]  ' : '[FAIL]', mb_str_pad($nombre, 52), $esperado, $r['codigo'], $r['ms']);
}

// Imagen PNG válida de 1x1 píxel para probar la subida de fotos
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==');
$usuario = 'tester_' . bin2hex(random_bytes(3));
$clave = 'ClaveSegura123';

echo "Probando API en $base\n" . str_repeat('-', 104) . "\n";

// --- Lectura (Read) y eficiencia
prueba('GET disfraces devuelve lista JSON',               pedir('GET', '/api/disfraces.php'), 200, fn($r) => is_array($r['json']) && count($r['json']) > 0);
prueba('GET un disfraz por id',                          pedir('GET', '/api/disfraces.php?id=1'), 200, fn($r) => $r['json']['id'] === 1);
prueba('GET disfraz inexistente',                        pedir('GET', '/api/disfraces.php?id=99999'), 404);
prueba('Foto guardada en la base (foto_blob)',           pedir('GET', '/api/foto.php?id=1'), 200, fn($r) => str_starts_with($r['tipo'], 'image/'));
prueba('PUT no permitido en disfraces',                  pedir('PUT', '/api/disfraces.php?id=1', []), 405);

// --- Registro (validaciones y códigos semánticos)
prueba('Registro con JSON inválido',                     pedir('POST', '/api/registro.php', '{malformado'), 400);
prueba('Registro con campos vacíos',                     pedir('POST', '/api/registro.php', ['nombre' => '', 'clave' => '']), 400);
prueba('Registro con contraseña corta',                  pedir('POST', '/api/registro.php', ['nombre' => $usuario, 'clave' => '123']), 400);
prueba('Registro correcto',                              pedir('POST', '/api/registro.php', ['nombre' => $usuario, 'clave' => $clave]), 201);
prueba('Registro con nombre repetido -> conflicto',      pedir('POST', '/api/registro.php', ['nombre' => $usuario, 'clave' => $clave]), 409);

// --- Seguridad sin sesión
prueba('Votar sin sesión -> no autorizado',              pedir('POST', '/api/votar.php', ['disfraz_id' => 1]), 401);
prueba('Subir disfraz sin sesión -> no autorizado',      pedir('POST', '/api/disfraces.php', ['multipart' => ['nombre' => 'X', 'descripcion' => 'Y', 'foto' => ['a.png', 'image/png', $png]]]), 401);
prueba('Eliminar sin sesión -> no autorizado',           pedir('DELETE', '/api/disfraces.php?id=1'), 401);
prueba('Login con contraseña incorrecta',                pedir('POST', '/api/login.php', ['nombre' => $usuario, 'clave' => 'incorrecta']), 401);
prueba('Intento de inyección SQL en login',              pedir('POST', '/api/login.php', ['nombre' => "' OR '1'='1' -- ", 'clave' => "' OR '1'='1"]), 401);

// --- Usuario común
prueba('Login correcto (usuario común)',                 pedir('POST', '/api/login.php', ['nombre' => $usuario, 'clave' => $clave]), 200, fn($r) => $r['json']['es_admin'] === false);
prueba('Votar con id inválido',                          pedir('POST', '/api/votar.php', ['disfraz_id' => 'abc']), 400);
prueba('Votar disfraz inexistente',                      pedir('POST', '/api/votar.php', ['disfraz_id' => 99999]), 404);
prueba('Voto válido',                                    pedir('POST', '/api/votar.php', ['disfraz_id' => 1]), 200);
prueba('Segundo voto del mismo usuario -> conflicto',    pedir('POST', '/api/votar.php', ['disfraz_id' => 2]), 409);
prueba('Subir archivo que no es imagen',                 pedir('POST', '/api/disfraces.php', ['multipart' => ['nombre' => 'Falso', 'descripcion' => 'Prueba', 'foto' => ['virus.png', 'image/png', '<?php echo 1; ?>']]]), 400);
prueba('Subir disfraz sin foto',                         pedir('POST', '/api/disfraces.php', ['multipart' => ['nombre' => 'Sin foto', 'descripcion' => 'Prueba']]), 400);
$alta = pedir('POST', '/api/disfraces.php', ['multipart' => ['nombre' => 'Momia de prueba', 'descripcion' => 'Vendas y polvo', 'foto' => ['momia.png', 'image/png', $png]]]);
prueba('Usuario sube su disfraz con foto (Create)',      $alta, 201);
$nuevoId = (int) ($alta['json']['id'] ?? 0);
prueba('Editar siendo usuario común -> prohibido',       pedir('POST', "/api/disfraces.php?id=$nuevoId", ['multipart' => ['nombre' => 'X', 'descripcion' => 'Y']]), 403);
prueba('Eliminar siendo usuario común -> prohibido',     pedir('DELETE', "/api/disfraces.php?id=$nuevoId"), 403);
prueba('Cerrar sesión',                                  pedir('POST', '/api/logout.php'), 200);

// --- Administrador (CRUD)
prueba('Login del administrador',                        pedir('POST', '/api/login.php', ['nombre' => 'admin', 'clave' => 'Admin2026!']), 200, fn($r) => $r['json']['es_admin'] === true);
prueba('Admin edita nombre y descripción (Update)',      pedir('POST', "/api/disfraces.php?id=$nuevoId", ['multipart' => ['nombre' => 'Momia editada', 'descripcion' => 'Nueva descripción']]), 200);
prueba('El cambio se guardó',                            pedir('GET', "/api/disfraces.php?id=$nuevoId"), 200, fn($r) => $r['json']['nombre'] === 'Momia editada');
prueba('Admin edita con nombre vacío',                   pedir('POST', "/api/disfraces.php?id=$nuevoId", ['multipart' => ['nombre' => '', 'descripcion' => 'X']]), 400);
prueba('Admin elimina el disfraz (Delete)',              pedir('DELETE', "/api/disfraces.php?id=$nuevoId"), 200);
prueba('El disfraz eliminado ya no aparece',             pedir('GET', "/api/disfraces.php?id=$nuevoId"), 404);
prueba('Cerrar sesión del administrador',                pedir('POST', '/api/logout.php'), 200);

echo str_repeat('-', 104) . "\n";
printf("Resultado: %d pasadas, %d fallidas. Tiempo promedio %.1f ms, máximo %.1f ms\n",
    $pasadas, $fallidas, array_sum($tiempos) / count($tiempos), max($tiempos));
exit($fallidas === 0 ? 0 : 1);
