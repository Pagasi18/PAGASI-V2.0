#!/bin/bash
# Bumpea la versión cache-bust de todos los scripts en admin.html
# Para correr antes de cada git push: ./bump-version.sh
set -e
VERSION="$(date +%Y%m%d)-$(date +%H%M)"
echo "→ Bumpeando versión a: $VERSION"

# Usa perl para reemplazar TODOS los ?v=... por la nueva versión
# micuenta.html (portal del cliente) también se versiona: comparte el motor de
# cálculo con el admin y un arreglo ahí debe llegarle también a los clientes.
perl -i -pe "s|(\.js)\?v=[^\"\s]+|\1?v=$VERSION|g" admin.html
[ -f micuenta.html ] && perl -i -pe "s|(\.js)\?v=[^\"\s]+|\1?v=$VERSION|g" micuenta.html

COUNT=$(grep -c "\.js?v=$VERSION" admin.html)
echo "✓ $COUNT scripts actualizados a v=$VERSION (admin.html)"
if [ -f micuenta.html ]; then
  CP=$(grep -c "\.js?v=$VERSION" micuenta.html || true)
  echo "✓ $CP script(s) actualizados en micuenta.html"
fi
echo ""
echo "Listo para commit. Ahora hacé:"
echo "  git add admin.html && git commit -m 'Bump version' && git push"
