"use strict";

const sass = require("gulp-sass")(require("sass"));
const gulp = require("gulp");
const sourcemaps = require("gulp-sourcemaps");
const fileinclude = require("gulp-file-include");
const autoprefixer = require("gulp-autoprefixer");
const cleanCSS = require("gulp-clean-css");
const purgecss = require("gulp-purgecss");
const bs = require("browser-sync").create();
const rimraf = require("rimraf");
const comments = require("gulp-header-comment");
const i18n = require ("./lib/index");
const sharp = require("sharp");
const pathModule = require("path");
const fs = require("fs");
const through = require("through2");

const isProd = process.env.NODE_ENV === "production";

// critical:extract lanza `critical`, que lanza Puppeteer, que lanza Chromium.
// Esas librerias crean promises que NO encadenan a lo que devuelven -- un
// `page.close()` contra un browser ya muerto, un waitForTarget interno -- y su
// rechazo llega aqui sin dueno. Relanzarlo mata el build entero y se quedan
// fuera critical:inject y css:purge: el sitio se publica sin CSS critico y sin
// purgar. Es el fallo de [[t0040-el-build-muere-al-azar-en-critical-extract]].
//
// Se reconoce por ORIGEN y nunca por el texto del mensaje. El filtro anterior
// exigia "Timed out" Y "browser" en el mensaje, y un crash de Chromium no trae
// ninguna de las dos, asi que pasaba de largo y mataba el build. El texto
// cambia con cada version de Chromium; el origen no.
//
// Dos senales, porque una sola no basta: la pila, cuando el rechazo la trae con
// frames de la libreria, y el hecho de que critical:extract haya arrancado --
// esta tarea es lo UNICO de este build que habla con Chromium, y sus fallos
// llegan precisamente despues de que la tarea haya terminado, que es lo que
// hace inservible cualquier ventana de tiempo corta.
let criticalArrancado = false;
const marcarCriticalArrancado = function () { criticalArrancado = true; };
const vieneDeLaTuberiaCritical = function (reason) {
  if (criticalArrancado) return true;
  const pila = (reason && reason.stack) || "";
  return pila.indexOf("node_modules/critical") !== -1 ||
         pila.indexOf("node_modules/puppeteer") !== -1;
};
const ignorarDeCritical = function (via, reason) {
  require("fancy-log")(
    "critical/Puppeteer: " + via + " ignorado, el build sigue:",
    (reason && reason.message) || reason);
};
process.on("unhandledRejection", function (reason) {
  if (vieneDeLaTuberiaCritical(reason)) return ignorarDeCritical("rechazo sin dueno", reason);
  setImmediate(function () { throw reason; });
});
// Y este es el camino por el que se moria de verdad, que el handler de arriba
// no ve: gulp corre cada tarea dentro de un `domain` (via async-done), y un
// rechazo sin dueno dentro de un domain activo se emite como 'error' del
// domain, no como unhandledRejection del proceso. Sin nadie escuchandolo se
// convierte en excepcion no capturada y el build muere -- exactamente el
// "Emitted 'error' event on Domain instance" que aparece en el crash de
// Chromium en puppeteer/lib/Launcher.js.
process.on("uncaughtException", function (err) {
  if (vieneDeLaTuberiaCritical(err)) return ignorarDeCritical("excepcion via domain", err);
  throw err;
});

var path = {
  src: {
    html: "source/*.html",
    others: "source/*.+(php|ico|png|xml)",
    htminc: "source/partials/**/*.htm",
    incdir: "source/partials/",
    plugins: "source/plugins/**/*.*",
    js: "source/js/*.js",
    scss: "source/scss/**/*.scss",
    images: "source/images/**/*.+(png|jpg|gif|svg|webp)",
    translation:"source/lang/**/*.json",
  },
  build: {
    dirBuild: "theme/",
    dirDev: "theme/",
  },
};

// HTML
gulp.task("html:build", function () {
  return gulp
    .src(path.src.html)
    .pipe(
      fileinclude({
        basepath: path.src.incdir,
      })
    )
    .pipe(gulp.dest(path.build.dirDev))
    .pipe(
      bs.reload({
        stream: true,
      })
    );
});

// SCSS
gulp.task("scss:build", function () {
  let stream = gulp
    .src(path.src.scss)
    .pipe(sourcemaps.init())
    .pipe(
      sass({
        outputStyle: isProd ? "compressed" : "expanded",
      }).on("error", sass.logError)
    )
    .pipe(autoprefixer());
  if (isProd) {
    stream = stream.pipe(cleanCSS({ compatibility: "ie11" }));
  }
  return stream
    .pipe(sourcemaps.write("/"))
    .pipe(gulp.dest(path.build.dirDev + "css/"))
    .pipe(
      bs.reload({
        stream: true,
      })
    );
});

// Javascript
gulp.task("js:build", function () {
  return gulp
    .src(path.src.js)
    .pipe(gulp.dest(path.build.dirDev + "js/"))
    .pipe(
      bs.reload({
        stream: true,
      })
    );
});

// Images
gulp.task("images:build", function () {
  return gulp
    .src(path.src.images)
    .pipe(gulp.dest(path.build.dirDev + "images/"))
    .pipe(
      bs.reload({
        stream: true,
      })
    );
});

// Image optimization (production): WebP + responsive widths for LCP/savings
gulp.task("images:optimize", function (done) {
  const srcDir = pathModule.join(__dirname, "source/images/zused");
  const destDir = pathModule.join(__dirname, "theme/images/zused");
  if (!fs.existsSync(pathModule.join(__dirname, "theme/images"))) {
    return done();
  }
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const webpOpts = { quality: 82, effort: 4 };

  const jobs = [];

  // Logo: 1536x388 → max 396w (198*2 retina), WebP
  const logoSrc = pathModule.join(srcDir, "1D_Solutions_Horizontal.png");
  if (fs.existsSync(logoSrc)) {
    jobs.push(
      sharp(logoSrc)
        .resize(396, null, { withoutEnlargement: true })
        .webp(webpOpts)
        .toFile(pathModule.join(destDir, "1D_Solutions_Horizontal.webp"))
    );
  }

  // 1dSoftwareTest: 400w + 800w for ~350px display
  const softSrc = pathModule.join(srcDir, "1dSoftwareTest.webp");
  if (fs.existsSync(softSrc)) {
    jobs.push(sharp(softSrc).resize(400).webp(webpOpts).toFile(pathModule.join(destDir, "1dSoftwareTest-400w.webp")));
    jobs.push(sharp(softSrc).resize(800).webp(webpOpts).toFile(pathModule.join(destDir, "1dSoftwareTest-800w.webp")));
  }

  // hero3: 540w, 700w (~651px display), 1080w (2x)
  const heroSrc = pathModule.join(srcDir, "hero3.webp");
  if (fs.existsSync(heroSrc)) {
    jobs.push(sharp(heroSrc).resize(540).webp(webpOpts).toFile(pathModule.join(destDir, "hero3-540w.webp")));
    jobs.push(sharp(heroSrc).resize(700).webp(webpOpts).toFile(pathModule.join(destDir, "hero3-700w.webp")));
    jobs.push(sharp(heroSrc).resize(1080).webp(webpOpts).toFile(pathModule.join(destDir, "hero3-1080w.webp")));
  }

  // Graphic Layouts: 400w + 800w
  const graphicSrc = pathModule.join(srcDir, "Graphic Layouts_page-0001.webp");
  if (fs.existsSync(graphicSrc)) {
    jobs.push(sharp(graphicSrc).resize(400).webp(webpOpts).toFile(pathModule.join(destDir, "Graphic Layouts_page-0001-400w.webp")));
    jobs.push(sharp(graphicSrc).resize(800).webp(webpOpts).toFile(pathModule.join(destDir, "Graphic Layouts_page-0001-800w.webp")));
  }

  // Summary Info: 400w + 800w
  const summarySrc = pathModule.join(srcDir, "Summary Info_page-0001.webp");
  if (fs.existsSync(summarySrc)) {
    jobs.push(sharp(summarySrc).resize(400).webp(webpOpts).toFile(pathModule.join(destDir, "Summary Info_page-0001-400w.webp")));
    jobs.push(sharp(summarySrc).resize(800).webp(webpOpts).toFile(pathModule.join(destDir, "Summary Info_page-0001-800w.webp")));
  }

  if (jobs.length === 0) return done();
  Promise.all(jobs).then(function () { done(); }).catch(function (err) { done(err); });
});

// Plugins
gulp.task("plugins:build", function () {
  return gulp
    .src(path.src.plugins)
    .pipe(gulp.dest(path.build.dirDev + "plugins/"))
    .pipe(
      bs.reload({
        stream: true,
      })
    );
});

// Other files like favicon, php, sourcele-icon on root directory
gulp.task("others:build", function () {
  return gulp.src(path.src.others).pipe(gulp.dest(path.build.dirDev));
});

// Translation
gulp.task("translation:build", function() {
  var dest  = "./theme";
  var index = "./theme/*.html";
 
  return gulp
  .src(index)
    .pipe(i18n({
      createLangDirs: true,
      langDir: "./source/lang",
      defaultLang: "en",
      trace: true
    }))
    .pipe(gulp.dest(dest));
});

// Critical CSS (production only): extract above-the-fold CSS, then inject into HTML and load full CSS async.
// Requires Puppeteer (headless Chrome); if it fails or times out (e.g. in CI), build continues without critical inlining.
gulp.task("critical:extract", function (done) {
  if (!isProd) return done();
  marcarCriticalArrancado();
  const themeDir = pathModule.join(__dirname, "theme");
  const htmlSrc = "en/index.html";
  const cssOut = pathModule.join(themeDir, "css", "critical.css");
  const log = require("fancy-log");
  const timeoutMs = 10000;
  const timeout = new Promise(function (resolve) {
    setTimeout(function () { resolve("timeout"); }, timeoutMs);
  });
  const work = import("critical").then(function (criticalMod) {
    const critical = criticalMod.default || criticalMod;
    return critical.generate({
      base: themeDir,
      src: htmlSrc,
      target: { css: cssOut },
      dimensions: [{ width: 1300, height: 900 }, { width: 768, height: 1024 }],
      inline: false,
    });
  });
  Promise.race([work, timeout])
    .then(function (result) {
      if (result === "timeout") log("critical:extract skipped (timeout " + timeoutMs + "ms, Puppeteer may be unavailable).");
      done();
    })
    .catch(function (err) {
      log("critical:extract skipped (Puppeteer unavailable or failed):", err.message || err);
      done();
    });
});

gulp.task("critical:inject", function () {
  if (!isProd) {
    return gulp.src(path.build.dirDev + "**/*.html", { allowEmpty: true }).pipe(gulp.dest(path.build.dirDev));
  }
  const criticalPath = pathModule.join(__dirname, "theme", "css", "critical.css");
  if (!fs.existsSync(criticalPath)) {
    return gulp.src(path.build.dirDev + "**/*.html").pipe(gulp.dest(path.build.dirDev));
  }
  let criticalCss = fs.readFileSync(criticalPath, "utf8");
  criticalCss = criticalCss.replace(/<\/style>/gi, "\\u003c/style>");
  const block =
    "  <!-- Critical CSS (blocking): layout and main styles only -->\n  <link rel=\"stylesheet\" href=\"../plugins/bootstrap/bootstrap.min.css\">\n  <link rel=\"stylesheet\" href=\"../css/style.css\">";
  const replacement =
    "  <style>" + criticalCss + "</style>\n  <!-- Full Bootstrap + style.css load async (do not block LCP) -->\n  <link rel=\"preload\" href=\"../plugins/bootstrap/bootstrap.min.css\" as=\"style\" onload=\"this.onload=null;this.rel='stylesheet'\">\n  <noscript><link rel=\"stylesheet\" href=\"../plugins/bootstrap/bootstrap.min.css\"></noscript>\n  <link rel=\"preload\" href=\"../css/style.css\" as=\"style\" onload=\"this.onload=null;this.rel='stylesheet'\">\n  <noscript><link rel=\"stylesheet\" href=\"../css/style.css\"></noscript>";
  return gulp
    .src(path.build.dirDev + "**/*.html")
    .pipe(
      through.obj(function (file, enc, cb) {
        if (file.isBuffer()) {
          let html = file.contents.toString("utf8");
          if (html.indexOf(block) !== -1) {
            html = html.replace(block, replacement);
            file.contents = Buffer.from(html, "utf8");
          }
        }
        this.push(file);
        cb();
      })
    )
    .pipe(gulp.dest(path.build.dirDev));
});

// PurgeCSS (production only): remove unused CSS from style.css
gulp.task("css:purge", function () {
  if (!isProd) {
    return gulp.src(path.build.dirDev + "css/style.css", { allowEmpty: true }).pipe(gulp.dest(path.build.dirDev + "css/"));
  }
  return gulp
    .src(path.build.dirDev + "css/style.css")
    .pipe(
      purgecss({
        content: ["theme/**/*.html"],
        safelist: {
          standard: [
            "collapse", "show", "navbar-collapse", "dropdown-menu",
            "dropdown-toggle", "fade", "header-white", "reveal"
          ],
          deep: [/dropdown/, /^navbar/, /^scroll/]
        }
      })
    )
    .pipe(gulp.dest(path.build.dirDev + "css/"));
});

// Clean Build Folder
gulp.task("clean", function (cb) {
  rimraf("./theme", cb);
});


// Watch Task
gulp.task("watch:build", function () {
  gulp.watch(path.src.html, gulp.series("html:build"));
  gulp.watch(path.src.htminc, gulp.series("html:build"));
  gulp.watch(path.src.translation, gulp.series("html:build"));

  gulp.watch(path.src.html, gulp.series("translation:build"));
  gulp.watch(path.src.htminc, gulp.series("translation:build"));
  gulp.watch(path.src.translation, gulp.series("translation:build"));

  gulp.watch(path.src.scss, gulp.series("scss:build"));
  gulp.watch(path.src.js, gulp.series("js:build"));
  gulp.watch(path.src.images, gulp.series("images:build"));
  gulp.watch(path.src.plugins, gulp.series("plugins:build"));


});

// Dev Task
gulp.task(
  "default",
  gulp.series(
    "clean",
    "html:build",
    "js:build",
    "scss:build",
    "images:build",
    "images:optimize",
    "plugins:build",
    "others:build",
    "translation:build",
    gulp.parallel("watch:build", function () {
      bs.init({
        server: {
          baseDir: path.build.dirDev,
        },
      });
    })
  )
);

// Build Task (use NODE_ENV=production for minified + purged CSS + image optimization + critical CSS)
gulp.task(
  "build",
  gulp.series(
    "html:build",
    "js:build",
    "scss:build",
    "images:build",
    "images:optimize",
    "plugins:build",
    "others:build",
    "translation:build",
    "critical:extract",
    "critical:inject",
    "css:purge"
  )
);



