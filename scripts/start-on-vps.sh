#!/usr/bin/env bash
# Exécuté sur le VPS : charge l'image, configure et démarre l'application,
# puis vérifie le routage par le reverse proxy.
set -e
cd /opt/ITCmdm/deploy/prout-app

echo "## Chargement de l'image"
timeout 600 docker load -i prout-app-image.tar.gz
rm -f prout-app-image.tar.gz

[ -f .postgres_password ] || openssl rand -hex 24 > .postgres_password

echo
echo "## Détection de la configuration Traefik"
TRAEFIK=$(docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower($0) ~ /traefik/ {print $1; exit}')
PROXY_NETWORK=""
if [ -n "$TRAEFIK" ]; then
  PROXY_NETWORK=$(docker inspect "$TRAEFIK" \
    -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' \
    | grep -vE '^(bridge|host|none|)$' | head -1)
fi
LABELS=$(docker ps -q | xargs -r docker inspect -f '{{json .Config.Labels}}' 2>/dev/null || true)
CERT_RESOLVER=$(printf '%s' "$LABELS" | grep -oE '"traefik[^"]*certresolver":"[^"]+"' | head -1 | sed -E 's/.*:"([^"]+)"/\1/')
HTTPS_ENTRYPOINT=$(printf '%s' "$LABELS" | grep -oE '"traefik[^"]*entrypoints":"[^"]+"' | sed -E 's/.*:"([^"]+)"/\1/' | grep -iE 'secure|https|443' | head -1)
: "${PROXY_NETWORK:=web}"
: "${CERT_RESOLVER:=le}"
: "${HTTPS_ENTRYPOINT:=websecure}"
echo "Conteneur Traefik : ${TRAEFIK:-introuvable}"
echo "Réseau retenu      : $PROXY_NETWORK"
echo "Entrypoint HTTPS   : $HTTPS_ENTRYPOINT"
echo "Certresolver       : $CERT_RESOLVER"

echo
echo "## Labels Traefik d'une application voisine (référence)"
for c in $(docker ps --format '{{.Names}}'); do
  case "$c" in *prout*|*traefik*) continue ;; esac
  ref=$(docker inspect "$c" -f '{{json .Config.Labels}}' 2>/dev/null | tr ',' '\n' | grep -i 'traefik\.' || true)
  if [ -n "$ref" ]; then echo "[$c]"; echo "$ref"; break; fi
done

cat > .env <<EOF
APP_DOMAIN=prout-app.vibecodestudio.io
POSTGRES_USER=prout
POSTGRES_DB=prout
POSTGRES_PASSWORD=$(cat .postgres_password)
PROXY_NETWORK=${PROXY_NETWORK}
CERT_RESOLVER=${CERT_RESOLVER}
HTTPS_ENTRYPOINT=${HTTPS_ENTRYPOINT}
EOF
chmod 600 .env

echo
echo "## Démarrage des conteneurs"
timeout 420 docker compose up -d --no-build --remove-orphans
docker compose ps

echo
echo "## Vérification"
sleep 12
echo -n "Application (réponse interne) : "
docker exec prout-app wget -qO- --timeout=10 http://localhost:4000/api/health 2>&1 || echo "(pas de réponse)"
echo -n "Routage Traefik HTTPS        : "
curl -sk -o /dev/null -w 'HTTP %{http_code}\n' --max-time 20 \
  -H 'Host: prout-app.vibecodestudio.io' https://localhost 2>&1 || echo "(échec)"
echo "DEPLOIEMENT-OK"
