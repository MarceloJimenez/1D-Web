# 1DWeb

A modern, production-ready landing page for 1D-Solutions, featuring a robust multilanguage and automatic translation architecture.

---
**website:** [https://1d-solutions.com](https://1d-solutions.com)

## Features

- **Multilanguage Support**:  
  Serve your website in multiple languages (English, Spanish, Portuguese, French, Italian, German, Turkish, Arabic) with language-specific URLs and SEO-friendly `<link rel="alternate">` tags.
- **Automatic Translation Architecture**:  
  All content is managed via structured JSON files for each language in [`source/lang/`](source/lang/), enabling easy updates and consistency across translations.
- **Dynamic Content Injection**:  
  HTML templates use variable placeholders (e.g., `${{index.about.title1}}$`) that are automatically replaced with the correct language strings during the build process.
- **Gulp-based Build System**:  
  Automated build pipeline using [Gulp](https://gulpjs.com/) and a custom i18n plugin ([`lib/index.js`](lib/index.js)) to generate localized HTML files in the [`theme/`](theme/) directory.
- **SEO Optimization**:  
  Canonical and alternate language tags are injected automatically for proper indexing by search engines.
- **Easy to Extend**:  
  Add new languages by simply creating a new folder in [`source/lang/`](source/lang/) and providing the necessary translations.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/en/download/)
- [Gulp CLI](https://gulpjs.com/docs/en/getting-started/quick-start)

### Installation

```sh
npm install
```

### Development

```sh
npm run dev
```
This will start a local server with live reload and watch for changes.

### Production Build

```sh
npm run build
```
The final, production-ready files will be output to the [`theme/`](theme/) directory. The build uses `NODE_ENV=production` to minify CSS (Sass compressed + clean-css), run PurgeCSS on `theme/css/style.css`, and remove unused styles for faster load times.

---

## Performance

- **Script loading**: `script.js` is loaded only once, deferred in the footer (no blocking script in the head).
- **CSS**: Production build minifies and purges main CSS; Pe-icon (unused) was removed from the head. Icon sets in use: Font Awesome, Themify, flag-icons.
- **Images**: The `images:optimize` Gulp task (Sharp) generates WebP versions and responsive widths (400w/800w, 540w/1080w) for key assets (logo, hero, portfolio). HTML uses `<picture>`/`srcset`/`sizes`, `width`/`height`, and `loading="lazy"` where appropriate to reduce LCP and layout shift.
- **Render-blocking**: In production build, critical (above-the-fold) CSS is extracted and inlined in the `<head>`; Bootstrap and `style.css` then load asynchronously so they no longer block LCP. Font Awesome, Themify, flag-icons, and Google Fonts (Muli) already load async. Critical CSS extraction uses the `critical` package (Puppeteer); if Puppeteer is unavailable or times out (e.g. in CI), the build continues without inlining and Bootstrap/style.css remain blocking. Run `npm run build` on a machine with Chrome for full critical CSS inlining.

---

## Multilanguage & Translation Architecture

- **Language Files**:  
  All translatable content is stored in JSON files under [`source/lang/`](source/lang/), e.g., [`source/lang/en/index.json`](source/lang/en/index.json), [`source/lang/es/index.json`](source/lang/es/index.json), etc.
- **Template Placeholders**:  
  HTML templates use placeholders like `${{index.about.title1}}$` which are replaced at build time with the correct translation.
- **Automated Build**:  
  The Gulp pipeline (see [`gulpfile.js`](gulpfile.js)) processes each language, generating a localized HTML file for each language and page.
- **SEO Tags**:  
  Canonical and alternate language tags are automatically generated for each page, ensuring proper SEO and discoverability.

---

## Example

**Template Snippet:**
```html
<h4 class="mb-2">${{index.about.title1}}$</h4>
<p>${{index.about.par1}}$</p>
```

**English Output:**
```html
<h4 class="mb-2">Easy Operation</h4>
<p>Very simple and easy to use software. Can be put into production in minutes.</p>
```

**Spanish Output:**
```html
<h4 class="mb-2">Operación Fácil</h4>
<p>Software muy simple y fácil de usar. Puede ponerse en producción en minutos.</p>
```

---

## Adding a New Language

1. Create a new folder in [`source/lang/`](source/lang/) (e.g., `pl/` for Polish).
2. Add your translation JSON files (e.g., `index.json`).
3. Run the build process. The system will automatically generate localized pages.

---

## Useful Links

- [How to track multiple languages on a single domain (YouTube)](https://www.youtube.com/watch?time_continue=286&v=eaFC0AYRO2A&embeds_referring_euri=https%3A%2F%2Fchatgpt.com%2F&source_ve_path=MTM5MTE3LDEzOTExNywyODY2Ng)
- [Google Tag Manager Multilanguage Setup](https://support.google.com/tagmanager/answer/13438166)

---

## License

MIT

---

## Contact

For questions or support, please contact Marcelo Jiménez.