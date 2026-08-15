#!/usr/bin/env bash
# Compara el sitio publicado con lo que produce este repositorio.
#
# POR QUÉ EXISTE
#
# El sitio se publica subiendo la carpeta theme/ por FTP, y a veces se edita
# directamente en el servidor. Eso significa que producción puede ir por delante
# del repositorio sin que aquí quede ni rastro. Publicar sin mirar sobrescribe
# esos cambios en silencio.
#
# Correr esto ANTES de publicar. Si dice que no hay diferencias de contenido,
# subir es seguro. Si las hay, son cambios hechos en el servidor que hay que
# traer a source/ primero — si no, se pierden.
#
# Uso:  bash scripts/diff-produccion.sh [--detalle]

set -euo pipefail

SITIO="https://1d-solutions.com"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

DETALLE="no"
[[ "${1:-}" == "--detalle" ]] && DETALLE="si"

IDIOMAS=("" de/ en/ es/ fr/ it/ pt/ sa/ tr/)
PAGINAS=(index.html product.html contact.html)

# ------------------------------------------------------- diferencias aceptadas
#
# Estas líneas difieren A PROPÓSITO y no deben contarse como divergencia:
#
#  1. El CSS crítico incrustado y la carga diferida de Bootstrap. Es la mejora de
#     rendimiento del repositorio, que aún no se ha publicado. Cuando se publique,
#     estas exclusiones dejarán de hacer falta.
#  2. El <script> de checkout-attribution.js, que adjunta los identificadores de
#     GA4 y Google Ads a los enlaces de PayPro. Mismo caso: en el repo, aún no
#     publicado.
#
# Cuando algo de esto llegue al servidor, borrar su línea de aquí. Si la lista se
# queda vacía, mejor: significa que repositorio y producción coinciden del todo.
ACEPTADAS='^[[:space:]]*<style>:root\{--blue|Critical CSS \(blocking\)|Full Bootstrap \+ style\.css load async|rel="preload".*as="style"|<noscript><link rel="stylesheet"|<link rel="stylesheet" href="\.\./(plugins/bootstrap/bootstrap\.min|css/style)\.css">|checkout-attribution|Carries the GA4 client id|checkout URL, so the purchase|to this visit\. See source/js'

normalizar() {
  # Quita espacios al final y líneas vacías, que cambian sin significar nada.
  sed 's/[[:space:]]*$//' "$1" | grep -Ev "$ACEPTADAS" | grep -v '^$'
}

printf '\n\033[1mConstruyendo desde source/\033[0m\n'
(cd "$RAIZ" && npm run build >/dev/null 2>&1)
printf '  hecho\n'

printf '\n\033[1mComparando %s con theme/\033[0m\n\n' "$SITIO"

total=0
divergentes=0
faltantes=0

for idioma in "${IDIOMAS[@]}"; do
  for pagina in "${PAGINAS[@]}"; do
    ruta="${idioma}${pagina}"
    local_="${RAIZ}/theme/${ruta}"

    if [[ ! -f "$local_" ]]; then
      printf '  \033[33m?\033[0m /%-20s no existe en el build\n' "$ruta"
      continue
    fi

    codigo=$(curl -s -m 20 -o "${TMP}/vivo.html" -w '%{http_code}' "${SITIO}/${ruta}")
    if [[ "$codigo" != "200" ]]; then
      printf '  \033[33m?\033[0m /%-20s el servidor responde %s\n' "$ruta" "$codigo"
      faltantes=$((faltantes + 1))
      continue
    fi

    n=$(diff <(normalizar "${TMP}/vivo.html") <(normalizar "$local_") | grep -c '^[<>]' || true)
    total=$((total + n))

    if (( n > 0 )); then
      divergentes=$((divergentes + 1))
      printf '  \033[31m✗\033[0m /%-20s %s líneas distintas\n' "$ruta" "$n"
      if [[ "$DETALLE" == "si" ]]; then
        diff <(normalizar "${TMP}/vivo.html") <(normalizar "$local_") \
          | sed 's/^/      /' | head -30
        printf '\n'
      fi
    fi
  done
done

printf '\n'
if (( total == 0 )); then
  printf '  \033[32m✓ producción y repositorio dicen lo mismo\033[0m\n'
  printf '    Publicar es seguro.\n\n'
  exit 0
fi

printf '  \033[31m✗ %s páginas divergen, %s líneas en total\033[0m\n\n' "$divergentes" "$total"
printf '  El símbolo < es lo que hay PUBLICADO, > es lo que produce este repo.\n'
printf '  Las líneas con < que no reconozcas son ediciones hechas en el servidor:\n'
printf '  llévalas a source/ ANTES de publicar, o se perderán.\n\n'
printf '  Ver el detalle:  bash scripts/diff-produccion.sh --detalle\n\n'
exit 1
