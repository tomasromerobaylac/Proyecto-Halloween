# Ficha de Autoevaluación de Calidad ISO/IEC 25010

**Proyecto:** La Web del Terror Accesible (Desafío Halloween)
**Integrantes:** Leandro Acosta, Santiago Romero Baylac, Tomás Romero Baylac
**Fecha:** 10/11/2026

| # | Característica | Evidencia técnica en el código | Estado |
|---|---|---|---|
| 1 | **Adecuación funcional** | El backend en PHP guarda usuarios, votos y disfraces en MySQL usando PDO (`api/config/conexion.php`). Funcionan registro y login con nombre de usuario, votación con un voto por usuario, carga de disfraces con foto y el CRUD del administrador. Se respetaron las tablas de la consigna. | Cumple |
| 2 | **Eficiencia de desempeño** | Según `tests/test_api.php`, la API responde en 9 ms de promedio y 71 ms como máximo (el máximo es BCRYPT, lento a propósito). Lighthouse da 100 en rendimiento en las 5 páginas. | Cumple |
| 3 | **Compatibilidad** | Las páginas HTML no tienen PHP y solo se comunican con la API por `fetch()`. La API devuelve JSON (y la imagen en `foto.php`). | Cumple |
| 4 | **Fiabilidad** | Todas las consultas están dentro de `try/catch (PDOException)`. Se devuelven los códigos 200, 201, 400, 401, 403, 404, 405, 409 y 500. El voto usa transacción con `rollBack()`. El detalle de los errores va a `error_log()`. Pasan las 33 pruebas automáticas. | Cumple |
| 5 | **Seguridad (OWASP)** | Contraseñas con `password_hash(..., PASSWORD_BCRYPT)`. Sentencias preparadas en todas las consultas (probado con `' OR '1'='1`). `.textContent` en lugar de `innerHTML`. `session_regenerate_id()`, cookie `HttpOnly` y `SameSite`. Fotos validadas por contenido con `getimagesize()`. Editar y eliminar solo para el administrador (403). | Cumple |
| 6 | **Usabilidad / accesibilidad** | Lighthouse Accesibilidad 100/100 en `index`, `login`, `registro`, `subir` y `admin`. axe-core sin violaciones en 9 estados. Todo el sitio, incluida la administración, se usa solo con Tab y Enter. | Cumple |
| 7 | **Mantenibilidad** | Código en capas: conexión (`api/config`), utilidades y permisos (`api/lib`), endpoints (`api/*.php`), acceso a la API (`js/api.js`), un script por página y una sola hoja de estilos. Script SQL, pruebas y documentación en el repositorio Git. | Cumple |

## Característica que exigió más trabajo

**Seguridad.** El código original guardaba las contraseñas en texto plano y tenía dos sistemas de login que no eran compatibles. Rehicimos el registro y el login con BCRYPT y nombre de usuario, como pide la consigna. Al agregar la carga de fotos aparecieron riesgos nuevos: validamos cada imagen por su contenido y no por la extensión, y separamos los permisos con `exigirLogin()` y `exigirAdmin()` para que solo el administrador pueda editar y eliminar.
