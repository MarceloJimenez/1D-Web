# Retro theme rebuild — notas de instalación

Rediseño "machined plate": light = plata cepillada, dark = grafito (toggle manual, clave `localStorage.themeMode`). Cero dependencias: sin Bootstrap, jQuery, FontAwesome, Themify, flag-icons ni Google Fonts (tipografías del sistema: Tahoma + Georgia).

## Qué reemplaza esta carpeta

Copia sobre tu `source/` actual:

- `index.html`, `product.html`, `contact.html`, `privacy.html`
- `partials/header.htm`, `partials/footer.htm`
- `partials/blocks/`: `nav-3.htm`, `slider.htm`, `about-2.htm`, `service.htm`, `pricing.htm`, `clients.htm`, `portfolio.htm`, `portfolio-2.htm`, `call-to-action.htm`, `page-service.htm`, `page-contact.htm`, `contact.htm`, `footer.htm` (+ `consent.htm` y `schema-software.htm` sin cambios)
- `scss/style.scss` — ahora es un único archivo, CSS plano válido
- `js/script.js` — vanilla JS (menú móvil, dropdowns, scroll-top, toggle dark)
- `images/zused/sobrep3_02.jpg` — **nuevo**: la foto clásica del reporte con tubos (hero del index)

## Qué borrar del source/ viejo

- `source/plugins/` completo (bootstrap, jquery, fontawesome, themify, flag-icons, fonts) — ya nada los referencia
- `source/scss/_*.scss` y `source/scss/templates/` — reemplazados por el único `style.scss`

`js/checkout-attribution.js`, `lang/`, `images/` restantes, `1dnest.xml`, `sitemap.xml` y `favicon` quedan igual.

## Qué se conserva intacto

- GTM + Consent Mode (banner de cookies, mismo JS e IDs)
- Formulario web3forms + hCaptcha (misma access key)
- `checkout-attribution.js` y los eventos `addToCart*` de GTM
- Clases de tracking en CTAs: `btn-slider`, `btn-service`, `btn-quote`, `btn-buy-single`, `btn-buy-enterprise`, `btn-buy-dll`, `btn-portfolio`
- Schema.org, canonical, hreflang de los 8 idiomas, OG/Twitter
- Todas las claves `${{index.*}}$` existentes → los 8 idiomas compilan sin tocar los JSON
- IDs de anclas: `#about`, `#services-2`, `#pricing`, `#client-map`, `#contact`, `#footer`

## Notas sobre el build (gulpfile)

1. **critical:inject** busca el string exacto del par Bootstrap+style.css en el head; ya no existe, así que en producción simplemente no inyecta critical CSS y el build sigue (el CSS ahora es un solo archivo pequeño; si quieres, actualiza el string en `gulpfile.js` o elimina las tareas critical).
2. **PurgeCSS**: los estados dinámicos (`[data-theme="dark"]`, `.show`, `.reveal`, `.header-white`) van envueltos en `/*! purgecss start ignore */` dentro de `style.scss`, además del safelist existente. No hay que tocar el safelist.
3. **images:optimize** sigue generando las variantes webp (logo, hero3, capturas). `sobrep3_02.jpg` se sirve tal cual (28 KB).
4. El preload de `old-opti-pipes.webp` se quitó del header (esa imagen ya no se usa); el hero usa `fetchpriority="high"`.

## Pendiente / decisiones abiertas

- Modo dark: solo toggle manual (no sigue `prefers-color-scheme`), light por defecto.
- Textos hardcodeados en inglés (sin clave de traducción, añadirlas luego a los 8 JSON si se quiere): supra-título del hero ("Length cutting optimization software"), las 3 notas junto a los botones del hero, el botón "+ Information", "Windows 10 / 11 · v4.02" del nav y las etiquetas LCD ("EFF 98.6%", "READY").
- Árabe (/sa/) se sirve LTR como hasta ahora; un `dir="rtl"` real requeriría revisar el layout.
