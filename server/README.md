# `server/` — archivos que viven en el servidor, no en el build

`gulp` construye `theme/` a partir de `source/`. Lo que hay en esta carpeta **no
pasa por el build**: son archivos que se editan a mano en `public_html` y que
antes sólo existían en el servidor, sin copia en el repositorio ni forma de saber
si alguien los había cambiado.

| Archivo | Va a | Cómo |
| --- | --- | --- |
| `htaccess.txt` | `public_html/.htaccess` | **Se añade al final del que ya existe.** Ver abajo. |
| `robots.txt` | `public_html/robots.txt` | Reemplaza al actual (sólo cambia `http://` por `https://` en la línea del sitemap). |

---

## Lo primero: YA HAY un `.htaccess` en el servidor

Comprobado el 2026-08-15. La redirección de `http://` a `https://` **conserva la
ruta y los parámetros**:

```
http://1d-solutions.com/es/product.html  →  https://1d-solutions.com/es/product.html
http://1d-solutions.com/contact.html?a=1 →  https://1d-solutions.com/contact.html?a=1
```

Eso es `mod_rewrite` con `%{REQUEST_URI}`, que es exactamente lo que escribe
cPanel al activar «Forzar HTTPS». Un redirector del hosting mandaría todo a la
raíz. Conclusión doble: existe un `.htaccess`, y `AllowOverride` está activo (si
no lo estuviera, ningún `.htaccess` haría nada).

**Si se reemplaza ese archivo, el sitio deja de forzar HTTPS.** El contenido de
`htaccess.txt` se pega **al final**, sin borrar lo que haya encima.

## Qué hace exactamente `htaccess.txt`

No toca el contenido del sitio ni renombra nada. Cuatro cosas:

1. **Añade cabeceras de seguridad** a la respuesta (HSTS, `X-Frame-Options`,
   `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
2. **Añade una CSP en modo informe.** `Report-Only` no bloquea nada: sólo escribe
   avisos en la consola del navegador. No puede romper el sitio por definición.
3. **Redirige con 301 las cuatro páginas de `/1dnest/`**. Son las únicas URLs
   cuyo comportamiento cambia. Ninguna página viva pasa por ahí.
4. **Deniega el acceso** a `.env`, `.git*`, `package.json`, `gulpfile.js`, `*.zip`
   y similares. Hoy ninguno existe en `public_html`; es una red para el día en que
   alguien suba una carpeta de más.

Todo va dentro de bloques `<IfModule>`: si un módulo no está cargado, Apache se
salta el bloque en vez de dar error.

## Probado antes de subirlo

El 2026-08-15 se levantó un Apache 2.4.67 local con `AllowOverride All`, este
`.htaccess` puesto y el bloque de «Forzar HTTPS» de cPanel encima, para
reproducir el servidor real. Resultados:

- Las seis cabeceras salen, también en las respuestas 301.
- `/es/index.html`, `/css/`, `/js/`, los SVG de banderas, los `.exe` de
  `/_downloads/`, `robots.txt`, `sitemap.xml`, `privacy.html` y `favicon.ico` →
  **200**. No se bloquea nada que el sitio sirva.
- `.env`, `.htaccess`, `package.json`, `theme.zip` → **403**.
- Las cuatro URLs de `/1dnest/` → **301** a su destino correcto.
- El forzado de HTTPS preexistente sigue funcionando.

La prueba encontró un fallo real que la revisión a ojo no vio: la regla comodín
usaba `Redirect`, que casa por prefijo y **añade al destino lo que sobra de la
ruta**, de modo que `/1dnest/otra.html` acababa en `.../es/index.htmlotra.html`.
Se corrigió con `RedirectMatch`. Por eso se prueba en vez de revisar.

## Instalación

1. cPanel → **Administrador de archivos** → `public_html`.
2. Configuración → **Mostrar archivos ocultos**. Sin esto el `.htaccess` no
   aparece en la lista.
3. **Copia de seguridad primero**: clic derecho sobre `.htaccess` → *Copy* →
   guardarlo como `.htaccess.backup`. Es la marcha atrás de un clic.
4. Clic derecho → *Edit* sobre `.htaccess`, ir al final del contenido y pegar
   `htaccess.txt` entero debajo. **No borrar nada de lo que ya hay.**
5. Guardar.

**Al pegar la línea de la CSP no la partas en varias.** Es larguísima a
propósito: Apache admite cortar líneas con `\` al final, pero si el editor deja
un espacio detrás de la barra, Apache falla y el sitio devuelve 500. Una sola
línea no tiene ese problema.

## Comprobar

```bash
curl -sI https://1d-solutions.com/ | grep -i "strict-transport\|x-frame\|x-content\|referrer"
curl -sI https://1d-solutions.com/1dnest/product.html | head -3    # debe dar 301
curl -s -o /dev/null -w "%{http_code}\n" https://1d-solutions.com/  # debe dar 200
```

Si no sale ninguna cabecera pero el sitio funciona, el `.htaccess` no está donde
debe. Si el sitio devuelve **500**, hay un error de sintaxis: ver más abajo.

## Marcha atrás

Un `.htaccess` con un error de sintaxis devuelve **500 en todas las páginas al
instante**, y el arreglo es igual de instantáneo: borrar el bloque pegado (o
restaurar `.htaccess.backup`) y guardar. No hay caché, no hay despliegue que
esperar, no hay estado que reconstruir — Apache lee el archivo en cada petición.

**La única pieza que no revierte sola es HSTS.** Un navegador que reciba esa
cabecera usará HTTPS con este dominio durante un año aunque mañana se quite del
servidor. No es un problema aquí —el sitio ya fuerza HTTPS y el certificado se
renueva solo— pero conviene saberlo: es lo único de esta lista con efecto
persistente en el visitante. Si algún día hubiese que servir algo por HTTP puro,
esa cabecera lo impediría.
