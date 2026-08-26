#!/usr/bin/env bash
# Saca de public_html todo lo que no es el sitio web ni el canal de descargas
# activo, y lo guarda en ~/_privado CONSERVÁNDOLO (nada se borra).
#
# POR QUÉ
#   public_html es la raíz web: todo lo que hay dentro es descargable por
#   cualquiera con la URL. Con los años se acumularon ahí cosas del dueño que no
#   son la web (bases de datos de ventas, fuente, instaladores viejos, sitios
#   anteriores...). Esto las mueve FUERA del alcance de la web pero las deja en
#   el hosting, accesibles por cPanel/FTP, con la MISMA estructura de carpetas.
#
# QUÉ HACE
#   Crea ~/_privado (fuera de public_html, no servida por Apache) y mueve ahí,
#   con `mv` (reversible, nunca `rm`), todo lo que no esté en la lista de lo que
#   se queda. Preserva la ruta relativa: public_html/z-OLD/ -> _privado/z-OLD/,
#   public_html/_downloads/Pro/ -> _privado/_downloads/Pro/, etc.
#
# QUÉ SE QUEDA EN public_html
#   - El sitio: index/product/contact/privacy.html, css/ js/ plugins/ images/
#     y los idiomas de/en/es/fr/it/pt/sa/tr (en en/ y pt/ solo las 4 páginas).
#   - Config y verificación: .htaccess, robots.txt, sitemap.xml, los archivos
#     google*/Bing/Norton, las páginas de error *.shtml, ActivationCode.pdf.
#   - 1dnest.xml (PAD del canal shareware): obsoleto, se reescribe en el futuro
#     (ver vault/notes/pad-file-1dnest); se conserva en su sitio.
#   - El canal de descargas ACTIVO en _downloads/: el instalador enlazado,
#     1dn402_25/26.*, y las carpetas entp/ cutdll/ pci/ (builds por cliente).
#   Los ._* de macOS y .DS_Store se dejan en su sitio (basura inocua).
#
# USO
#   bash scripts/sacar-a-privado.sh              # dry-run: dice qué movería
#   bash scripts/sacar-a-privado.sh --ejecutar   # mueve de verdad
#
# REVERTIR
#   Mover de vuelta lo que haga falta desde ~/_privado a public_html (misma ruta).
#
# NOTA TÉCNICA
#   El hosting (GoDaddy/CloudLinux/CageFS) no expone /dev/fd, así que este script
#   evita la sustitución de procesos `< <(...)` y usa un archivo temporal.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="${RAIZ}/scripts/publicar.env"
[[ -f "$CONF" ]] || { echo "Falta scripts/publicar.env"; exit 1; }
# shellcheck source=/dev/null
source "$CONF"
: "${DESTINO:?falta DESTINO en scripts/publicar.env}"

EJECUTAR="no"
for a in "$@"; do case "$a" in
  --ejecutar) EJECUTAR="si" ;;
  *) echo "argumento no reconocido: $a"; exit 2 ;;
esac; done

ssh -o BatchMode=yes -o ConnectTimeout=20 "$DESTINO" "EJECUTAR=$EJECUTAR bash -s" <<'REMOTE'
export TERM=dumb
set -uo pipefail
PH=/home/t7p7g22cas4i/public_html
PRIV=/home/t7p7g22cas4i/_privado
[ -d "$PH" ] || { echo "No existe $PH"; exit 1; }

KEEP_ROOT_FILES="index.html product.html contact.html privacy.html .htaccess robots.txt sitemap.xml ActivationCode.pdf google83ac7eff16bc4f86.html google47fdf353adccc503.html BingSiteAuth.xml nortonsw_cb193730-0fa6-0.html 400.shtml 401.shtml 403.shtml 404.shtml 413.shtml 500.shtml 1dnest.xml"
KEEP_ROOT_DIRS="css js plugins images de en es fr it pt sa tr _downloads"
KEEP_DL="1DNest_software_version_402.exe 1dn402_25.zip 1dn402_26.zip 1dn402_26.exe entp cutdll pci"

in_list(){ local t="$1"; shift; for x in "$@"; do [ "$t" = "$x" ] && return 0; done; return 1; }
is_apple(){ case "$(basename "$1")" in ._*|.DS_Store) return 0;; *) return 1;; esac; }

moved=0; ausente=0
mover(){ # $1 = ruta relativa a PH
  local rel="$1" src="$PH/$1"
  if [ ! -e "$src" ]; then printf '   (ausente) %s\n' "$rel"; ausente=$((ausente+1)); return; fi
  local dest="$PRIV/$(dirname "$rel")"
  if [ "${EJECUTAR:-no}" = si ]; then
    mkdir -p "$dest"; mv -n "$src" "$dest/" && { printf '   movido   %s\n' "$rel"; moved=$((moved+1)); }
  else
    printf '   [dry]    %s\n' "$rel"; moved=$((moved+1))
  fi
}

TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT

echo "== carpetas de la raíz =="
( cd "$PH" && find . -maxdepth 1 -mindepth 1 -type d | sed 's|^\./||' ) > "$TMP"
while IFS= read -r d; do in_list "$d" $KEEP_ROOT_DIRS && continue; mover "$d"; done < "$TMP"

echo "== archivos sueltos de la raíz =="
( cd "$PH" && find . -maxdepth 1 -mindepth 1 ! -type d | sed 's|^\./||' ) > "$TMP"
while IFS= read -r f; do is_apple "$f" && continue; in_list "$f" $KEEP_ROOT_FILES && continue; mover "$f"; done < "$TMP"

echo "== en/ (borradores viejos) =="
for f in en/index1.html en/product1.html; do mover "$f"; done

echo "== pt/ (extras zombis, salvo las 4 páginas actuales) =="
( cd "$PH" && ls -A pt ) > "$TMP"
while IFS= read -r f; do
  is_apple "pt/$f" && continue
  case "$f" in index.html|product.html|contact.html|privacy.html) continue;; esac
  mover "pt/$f"
done < "$TMP"

echo "== images/ =="
mover images/Logo1DSolutions.jpg

echo "== _downloads/ (todo salvo el canal activo) =="
( cd "$PH" && ls -A _downloads ) > "$TMP"
while IFS= read -r f; do
  is_apple "_downloads/$f" && continue
  in_list "$f" $KEEP_DL && continue
  mover "_downloads/$f"
done < "$TMP"

echo
if [ "${EJECUTAR:-no}" = si ]; then
  echo "LISTO: $moved movidos a _privado, $ausente ausentes."
else
  echo "DRY-RUN: $moved se moverían, $ausente ausentes. (No se ha tocado nada.)"
  echo "Para ejecutar:  bash scripts/sacar-a-privado.sh --ejecutar"
fi
REMOTE