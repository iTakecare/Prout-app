#!/usr/bin/env bash
# Exécuté sur le VPS : charge l'image transférée et démarre l'application.
set -e
cd /opt/ITCmdm/deploy/prout-app

timeout 600 docker load -i prout-app-image.tar.gz
rm -f prout-app-image.tar.gz

[ -f .postgres_password ] || openssl rand -hex 24 > .postgres_password

# Réseau Docker partagé avec le reverse proxy Traefik.
PROXY_NETWORK=$(docker network ls --format '{{.Name}}' | grep -Ei 'web|proxy|traefik' | head -1)

cat > .env <<EOF
APP_DOMAIN=prout-app.vibecodestudio.io
POSTGRES_USER=prout
POSTGRES_DB=prout
POSTGRES_PASSWORD=$(cat .postgres_password)
PROXY_NETWORK=${PROXY_NETWORK:-web}
CERT_RESOLVER=le
HTTPS_ENTRYPOINT=websecure
EOF
chmod 600 .env

timeout 420 docker compose up -d --no-build --remove-orphans
docker compose ps
