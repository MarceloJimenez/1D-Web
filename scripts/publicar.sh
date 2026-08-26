#!/usr/bin/env bash
# Publica el sitio en el hosting de GoDaddy por SSH, con rsync.
#
# POR QUÉ EXISTE
#
# Hasta 2026-08 el sitio se publicaba comprimiendo el contenido de theme/ y
# subiendo el zip por cPanel → Administrador de archivos: lento, manual y con
# trampas (comprimir la carpeta en vez de su contenido publica en /theme/ y no
# publica nada). Esto lo reduce a una orden, y convierte el comparador en una
# barrera en vez de una costumbre: no se sube nada sin mirar antes qué hay
# publicado, porque el sitio también se edita directamente en el servidor.
#
# QUÉ HACE
#
#   1. Construye desde source/ y compara con producción (diff-produccion.sh).
#   2. Si hay divergencias, SE DETIENE. Las líneas «<» que no reconozcas son
#      ediciones hechas en el servidor: llévalas a source/ o se perderán.
#      Si todas las diferencias son lo que vienes a publicar, relanza con
#      --confirmo.
#   3. Sube theme/ por rsync. Nunca con --delete: el servidor tiene archivos
#      que este repositorio no genera (.htaccess, Docus/, _downloads/...).
#   4. Vuelve a comparar SIN reconstruir, para verificar que lo que sirve
#      producción es exactamente el build que se acaba de subir.
#
# QUÉ NO HACE
#
#   No toca .htaccess ni robots.txt (viven en server/ y se suben a mano, a
#   propósito: un .htaccess malo tumba el sitio entero y el comparador no lo
#   cubre). Tampoco borra nada del servidor, nunca.
#
# Uso:    bash scripts/publicar.sh [--confirmo]
# Config: scripts/publicar.env — copiar de publicar.env.ejemplo. No se commitea.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="${RAIZ}/scripts/publicar.env"

CONFIRMO="no"
for arg in "$@"; do
  case "$arg" in
    --confirmo) CONFIRMO="si" ;;
    *) printf 'argumento no reconocido: %s\n' "$arg"; exit 2 ;;
  esac
done

# ------------------------------------------------------------------- config
if [[ ! -f "$CONF" ]]; then
  cat <<'FIN'

  Falta scripts/publicar.env — la configuración SSH del hosting.

  Cómo crearla:
    1. cp scripts/publicar.env.ejemplo scripts/publicar.env
    2. Rellenar DESTINO y RUTA_REMOTA (las instrucciones están dentro).

  Está en .gitignore a propósito: no debe commitearse.

FIN
  exit 1
fi

# shellcheck source=/dev/null
source "$CONF"
: "${DESTINO:?falta DESTINO en scripts/publicar.env}"
: "${RUTA_REMOTA:?falta RUTA_REMOTA en scripts/publicar.env}"

# ----------------------------------------------------------------- conexión
# BatchMode: si la clave no está autorizada, falla en vez de pedir contraseña.
# Así el script nunca se queda colgado esperando teclado, lo lance quien lo lance.
printf '\n\033[1mComprobando la conexión con %s\033[0m\n' "$DESTINO"
if ! salida=$(ssh -o BatchMode=yes -o ConnectTimeout=15 "$DESTINO" \
    "command -v rsync >/dev/null 2>&1 && echo RSYNC_OK; [ -d $RUTA_REMOTA ] && echo DIR_OK" 2>&1); then
  printf '\n  \033[31mNo hay conexión SSH con %s\033[0m\n' "$DESTINO"
  printf '  ssh dijo: %s\n\n' "$salida"
  cat <<'FIN'
  Posibles causas, en orden de probabilidad:
    - SSH sin activar en el hosting: cPanel → «SSH Access» → Enable.
    - La clave pública no está autorizada: cPanel → SSH Access →
      Manage SSH Keys → Import + Authorize, o bien `ssh-copy-id <DESTINO>`.
      (Este script usa BatchMode y no pide contraseña, a propósito.)
    - DESTINO mal escrito en scripts/publicar.env.

FIN
  exit 1
fi
grep -q RSYNC_OK <<<"$salida" || {
  printf '  \033[31mEl servidor no tiene rsync\033[0m — habría que publicar por sftp/lftp en su lugar.\n\n'
  exit 1
}
grep -q DIR_OK <<<"$salida" || {
  printf '  \033[31mNo existe %s en el servidor\033[0m — revisar RUTA_REMOTA en scripts/publicar.env.\n\n' "$RUTA_REMOTA"
  exit 1
}
printf '  conexión, rsync y %s: bien\n' "$RUTA_REMOTA"

# ----------------------------------------------------------------- barrera
if ! bash "${RAIZ}/scripts/diff-produccion.sh"; then
  if [[ "$CONFIRMO" == "no" ]]; then
    cat <<'FIN'
  ── publicar.sh se detiene aquí ─────────────────────────────────────────

  Hay diferencias entre producción y el repositorio. Antes de publicar:

    - Ver el detalle:  bash scripts/diff-produccion.sh --detalle
    - Las líneas «<» que NO reconozcas son ediciones hechas en el servidor.
      Llévalas a source/ primero, o se perderán al publicar.
    - Si todas las diferencias son lo que vienes a publicar:

        bash scripts/publicar.sh --confirmo

FIN
    exit 1
  fi
  printf '\n  --confirmo: se publica asumiendo que reconoces todas las diferencias.\n'
fi

# ------------------------------------------------------------------- subida
# Sin --delete, siempre. Se excluyen los zips porque theme/ arrastra alguno
# (Archive.zip) que no pinta nada en producción.
printf '\n\033[1mSubiendo theme/ a %s:%s\033[0m\n' "$DESTINO" "$RUTA_REMOTA"
rsync -rlvzc \
  --exclude '.DS_Store' --exclude 'Thumbs.db' --exclude '*.zip' \
  "${RAIZ}/theme/" "${DESTINO}:${RUTA_REMOTA}/"

# ------------------------------------------------------------ verificación
# Compara otra vez, contra el MISMO build que se acaba de subir (--sin-build).
printf '\n\033[1mVerificando lo publicado\033[0m\n'
if bash "${RAIZ}/scripts/diff-produccion.sh" --sin-build; then
  printf '  \033[32m✓ publicado y verificado\033[0m\n\n'
else
  printf '  \033[31m✗ lo que sirve producción no coincide con el build subido.\033[0m\n'
  printf '  Puede ser caché del servidor: espera un minuto y repite\n'
  printf '    bash scripts/diff-produccion.sh --sin-build\n\n'
  exit 1
fi
