#!/usr/bin/env bash
# Exécuté sur le VPS : charge l'image transférée et démarre l'application.
set -e
cd /opt/ITCmdm/deploy/prout-app

echo "## Chargement de l'image"
timeout 600 docker load -i prout-app-image.tar.gz
rm -f prout-app-image.tar.gz

[ -f .postgres_password ] || openssl rand -hex 24 > .postgres_password

# Réseau du reverse proxy : détecté depuis le conteneur Traefik en service.
echo "## Détection du réseau du reverse proxy"
TRAEFIK=$(docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower($0) ~ /traefik/ {print $1; exit}')
PROXY_NETWORK=""
if [ -n "$TRAEFIK" ]; then
  PROXY_NETWORK=$(docker inspect "$TRAEFIK" \
    -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' \
    | grep -vE '^(bridge|host|none|)$' | head -1)
fi
echo "Conteneur Traefik : ${TRAEFIK:-introuvable}"
echo "Réseaux Docker existants :"
docker network ls --format '  - {{.Name}}'
echo "Réseau proxy retenu : ${PROXY_NETWORK:-web (défaut)}"
: "${PROXY_NETWORK:=web}"

cat > .env <<EOF
APP_DOMAIN=prout-app.vibecodestudio.io
POSTGRES_USER=prout
POSTGRES_DB=prout
POSTGRES_PASSWORD=$(cat .postgres_password)
PROXY_NETWORK=${PROXY_NETWORK}
CERT_RESOLVER=le
HTTPS_ENTRYPOINT=websecure
EOF
chmod 600 .env

echo "## Démarrage des conteneurs"
timeout 420 docker compose up -d --no-build --remove-orphans
docker compose ps
echo "DEPLOIEMENT-OK"
