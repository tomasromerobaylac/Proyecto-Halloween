// Prueba E2E solo con teclado (Tab / Shift+Tab / Enter / escritura) + axe-core en cada estado.
// Requisitos:  npm i playwright axe-core  &&  npx playwright install chromium
// Uso:         node tests/prueba_teclado.mjs http://localhost/halloween [carpeta_capturas]
// (usar una base recién importada: la prueba registra un usuario, vota y edita disfraces)
import { chromium } from 'playwright';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const BASE = process.argv[2] || 'http://localhost/halloween';
const OUT = process.argv[3] || './evidencia';
const CHROME = process.env.CHROME_PATH; // opcional: usar un Chrome ya instalado
fs.mkdirSync(OUT, { recursive: true });
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const browser = await chromium.launch(CHROME ? { executablePath: CHROME, args: ['--no-sandbox'] } : {});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on('dialog', d => { log.push(`   Diálogo de confirmación: "${d.message()}" -> Aceptar`); d.accept(); });
const log = [];
const axeResultados = {};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');

async function foco() {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return '(body)';
    const tag = el.tagName.toLowerCase();
    const txt = (el.innerText || el.getAttribute('aria-label') || el.labels?.[0]?.innerText || '').trim().replace(/\s+/g, ' ');
    const visible = getComputedStyle(el).outlineStyle !== 'none';
    return `<${tag}> ${txt}${visible ? '  [foco visible ✓]' : '  [SIN FOCO VISIBLE]'}`;
  });
}
async function tab(n = 1, shift = false) {
  for (let i = 0; i < n; i++) await page.keyboard.press(shift ? 'Shift+Tab' : 'Tab');
  return foco();
}
async function tabHasta(texto, max = 40) {
  for (let i = 0; i < max; i++) {
    const f = await tab();
    if (f.includes(texto)) return f;
  }
  throw new Error(`No se llegó con Tab a "${texto}"`);
}
async function axe(nombre) {
  await page.addScriptTag({ content: axeSrc });
  const r = await page.evaluate(async () => {
    const res = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] });
    return res.violations.map(v => `${v.id}: ${v.nodes.length} nodos`);
  });
  axeResultados[nombre] = r;
  log.push(`   axe-core (${nombre}): ${r.length === 0 ? '0 violaciones WCAG 2.1 AA' : r.join(', ')}`);
}
async function esperarTexto(sel, re) {
  await page.waitForFunction(([s, r]) => new RegExp(r).test(document.querySelector(s).textContent), [sel, re.source]);
  return (await page.locator(sel).textContent()).trim();
}
const foto = n => page.screenshot({ path: `${OUT}/${n}.png` });

// ---------- 1. Portada ----------
await page.goto(`${BASE}/index.html`);
await page.waitForSelector('#contenedor-disfraces button');
log.push('1) ORDEN DE TABULACIÓN EN index.html (sin sesión)');
for (let i = 1; i <= 7; i++) {
  log.push(`   Tab ${i}: ${await tab()}`);
  if (i === 1) await foto('01_skip_link');
}
await axe('portada sin sesión');

// ---------- 2. Votar sin sesión ----------
await page.goto(`${BASE}/index.html`);
await page.waitForSelector('#contenedor-disfraces button');
await tab(); await page.keyboard.press('Enter');
log.push(`2) VOTAR SIN SESIÓN: Enter en "Saltar al contenido" y Tab -> ${await tab()}`);
await foto('03_foco_boton_votar');
await page.keyboard.press('Enter');
log.push(`   aria-live: "${await esperarTexto('#aviso', /sesión/)}" (HTTP 401)`);
await foto('04_aviso_sin_sesion');
await axe('portada con aviso de error');

// ---------- 3. Registro ----------
log.push('3) REGISTRO SOLO CON TECLADO');
await tab(1, true); // Shift+Tab: del primer botón de votar vuelve a "Registrarse"
log.push(`   Shift+Tab: ${await foco()} -> Enter`);
await page.keyboard.press('Enter');
await page.waitForURL('**/registro.html');
log.push(`   Tab hasta el botón: ${await tabHasta('Registrarse')} -> Enter con el formulario vacío`);
await page.keyboard.press('Enter');
log.push(`   aria-live: "${await esperarTexto('#mensaje-form', /obligatorio/)}"; foco en: ${await foco()}`);
await foto('05_validacion_registro');
await axe('registro con error de validación');
await page.keyboard.type('Grupo Halloween');
await page.keyboard.press('Tab'); await page.keyboard.type('Calabaza2026');
await page.keyboard.press('Enter');
log.push(`   Nombre + contraseña + Enter -> aria-live: "${await esperarTexto('#mensaje-form', /exitoso/)}" (HTTP 201)`);
await foto('06_registro_ok');
await page.waitForURL('**/login.html');

// ---------- 4. Login ----------
log.push('4) LOGIN SOLO CON TECLADO');
log.push(`   Tab x3: ${await tab(3)}`);
await page.keyboard.type('Grupo Halloween');
await page.keyboard.press('Tab'); await page.keyboard.type('incorrecta'); await page.keyboard.press('Enter');
log.push(`   Contraseña errónea -> aria-live: "${await esperarTexto('#mensaje-form', /incorrectos/)}" (HTTP 401)`);
await foto('07_login_error');
await axe('login con error');
await tab(1, true);
await page.keyboard.press('Control+A'); await page.keyboard.type('Calabaza2026'); await page.keyboard.press('Enter');
await page.waitForURL('**/index.html');
log.push('   Contraseña correcta + Enter -> redirige a index.html');

// ---------- 5. Votar ----------
log.push('5) VOTAR CON SESIÓN');
await page.waitForSelector('#contenedor-disfraces button');
await tab(); await page.keyboard.press('Enter');
log.push(`   Saltar contenido + Tab x2: ${await tab(2)} -> Enter`);
await page.keyboard.press('Enter');
log.push(`   aria-live: "${await esperarTexto('#aviso', /Voto registrado/)}"`);
log.push(`   Tras re-renderizar, el foco vuelve a: ${await foco()}`);
await foto('08_voto_ok');
await axe('portada con sesión y voto');
await tab(); await page.keyboard.press('Enter');
log.push(`   Segundo voto -> aria-live: "${await esperarTexto('#aviso', /Ya emitiste/)}" (HTTP 409)`);

// ---------- 6. Subir mi disfraz ----------
log.push('6) SUBIR MI DISFRAZ (usuario registrado)');
await page.goto(`${BASE}/index.html`);
await page.waitForSelector('#contenedor-disfraces button');
log.push(`   Tab hasta: ${await tabHasta('Subir mi disfraz')} -> Enter`);
await page.keyboard.press('Enter');
await page.waitForURL('**/subir.html');
await page.waitForSelector('#form-disfraz:not([hidden])');
log.push(`   Tab hasta: ${await tabHasta('Nombre del disfraz')}`);
await page.keyboard.type('Momia del Desierto');
await page.keyboard.press('Tab'); await page.keyboard.type('Vendas viejas, polvo de arena y ojos brillantes.');
log.push(`   Tab: ${await tab()}  (Enter/Espacio abre el selector de archivos del sistema)`);
await page.locator('#foto').setInputFiles({ name: 'momia.png', mimeType: 'image/png', buffer: PNG });
await axe('subir disfraz');
await foto('09_subir_disfraz');
log.push(`   Tab: ${await tab()} -> Enter`);
await page.keyboard.press('Enter');
log.push(`   aria-live: "${await esperarTexto('#mensaje-form', /cargado/)}" (HTTP 201)`);
await page.waitForURL('**/index.html');

// ---------- 7. Admin.html sin permiso ----------
await page.goto(`${BASE}/admin.html`);
await page.waitForSelector('#sin-permiso:not([hidden])');
log.push('7) admin.html con un usuario común -> se muestra "Esta página es solo para el administrador"');
await axe('admin sin permiso');

// ---------- 8. Cerrar sesión ----------
await page.goto(`${BASE}/index.html`);
await page.waitForSelector('#contenedor-disfraces button');
log.push(`8) CERRAR SESIÓN: Tab hasta ${await tabHasta('Cerrar sesión')} -> Enter`);
await page.keyboard.press('Enter');
log.push(`   aria-live: "${await esperarTexto('#aviso', /Cerraste/)}"; foco pasa a: ${await foco()}`);

// ---------- 9. Administrador: CRUD ----------
log.push('9) ADMINISTRADOR (CRUD) SOLO CON TECLADO');
await page.goto(`${BASE}/login.html`);
await tab(3); await page.keyboard.type('admin');
await page.keyboard.press('Tab'); await page.keyboard.type('Admin2026!'); await page.keyboard.press('Enter');
await page.waitForURL('**/index.html');
await page.waitForSelector('#nav-cuenta a[href="admin.html"]');
log.push(`   Login admin. Tab hasta: ${await tabHasta('Administración')} -> Enter`);
await page.keyboard.press('Enter');
await page.waitForURL('**/admin.html');
await page.waitForSelector('#tabla-disfraces button');
await axe('admin panel');
await foto('10_admin_panel');
log.push(`   Tab hasta: ${await tabHasta('Editar Momia del Desierto')} -> Enter`);
await page.keyboard.press('Enter');
log.push(`   Modo edición. Título: "${await page.locator('#titulo-form').textContent()}"; foco en: ${await foco()}`);
await page.keyboard.press('Control+A'); await page.keyboard.type('Momia Faraónica');
await tabHasta('Guardar cambios'); await page.keyboard.press('Enter');
log.push(`   Guardar -> aria-live: "${await esperarTexto('#aviso', /actualizado/)}" (Update)`);
log.push(`   El foco vuelve a: ${await foco()}`);
await foto('11_admin_editado');
await axe('admin después de editar');
log.push(`   Tab: ${await tab()} -> Enter`);
await page.keyboard.press('Enter');
log.push(`   aria-live: "${await esperarTexto('#aviso', /eliminado/)}" (Delete, borrado lógico)`);
log.push(`   El foco pasa a: ${await foco()}`);
await foto('12_admin_eliminado');

fs.writeFileSync(`${OUT}/prueba_teclado.txt`, log.join('\n') + '\n');
fs.writeFileSync(`${OUT}/axe.json`, JSON.stringify(axeResultados, null, 2));
console.log(log.join('\n'));
await browser.close();
