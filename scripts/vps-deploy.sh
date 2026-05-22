#!/usr/bin/env bash
# Exécuté sur le VPS via SSH par le workflow de déploiement.
# Diagnostic, nettoyage, chargement de l'image et démarrage des conteneurs.
# Chaque commande sensible est bornée par un délai pour ne jamais bloquer.

DEPLOY_DIR=/opt/ITCmdm/deploy/prout-app
cd "$DEPLOY_DIR" || { echo "FATAL: dossier $DEPLOY_DIR introuvable"; exit 1; }

echo "===== 1. ÉTAT DU VPS ====="
timeout 20 df -h / "$DEPLOY_DIR" 2>&1 || echo "(df: bloqué)"
echo
timeout 20 free -h 2>&1 || echo "(free: bloqué)"
echo
timeout 20 uptime 2>&1 || echo "(uptime: bloqué)"
echo
echo "-- service Docker --"
timeout 25 systemctl is-active docker 2>&1 || echo "(docker: inactif ou bloqué)"
echo "-- conteneurs --"
timeout 45 docker ps -a --format '{{.Names}} | {{.Status}}' 2>&1 || echo "(docker ps: bloqué)"
echo "-- espace utilisé par Docker --"
timeout 45 docker system df 2>&1 || echo "(docker system df: bloqué)"

echo
echo "===== 2. NETTOYAGE ====="
timeout 120 docker image prune -f 2>&1 || echo "(image prune: bloqué/timeout)"
timeout 180 docker builder prune -af 2>&1 || echo "(builder prune: bloqué/timeout)"

echo
echo "===== 3. CHARGEMENT DE L'IMAGE ====="
ls -lah prout-app-image.tar.gz 2>&1 || echo "(image absente)"
if timeout 480 docker load -i prout-app-image.tar.gz 2>&1; then
  echo "Image chargée."
  rm -f prout-app-image.tar.gz
else
  echo "ECHEC: docker load (timeout ou erreur)"
fi
docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' 2>/dev/null | grep prout-app \
  || echo "(image prout-app non présente)"

echo
echo "===== 4. CONFIGURATION TRAEFIK ====="
TRAEFIK="$(docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower($0) ~ /traefik/ {print $1; exit}')"
PROXY_NETWORK=""
if [ -n "$TRAEFIK" ]; then
  echo "Conteneur Traefik détecté : $TRAEFIK"
  PROXY_NETWORK="$(docker inspect "$TRAEFIK" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | grep -vE '^(bridge|host|none|)$' | head -1)"
else
  echo "Aucun conteneur Traefik détecté."
fi
LABELS="$(docker ps -q | xargs -r docker inspect -f '{{json .Config.Labels}}' 2>/dev/null || true)"
CERT_RESOLVER="$(printf '%s' "$LABELS" | grep -oE 'tls\.certresolver":"[^"]+' | head -1 | sed 's/.*"//')"
HTTPS_ENTRYPOINT="$(printf '%s' "$LABELS" | grep -oE 'routers\.[^"]+\.entrypoints":"[^"]+' | head -1 | sed 's/.*"//')"
PROXY_NETWORK="${PROXY_NETWORK:-web}"
CERT_RESOLVER="${CERT_RESOLVER:-le}"
HTTPS_ENTRYPOINT="${HTTPS_ENTRYPOINT:-websecure}"
echo "→ réseau=$PROXY_NETWORK  entrypoint=$HTTPS_ENTRYPOINT  certresolver=$CERT_RESOLVER"
echo "-- réseaux Docker --"
docker network ls 2>&1 || true

if [ ! -f .postgres_password ]; then
  (openssl rand -hex 24 2>/dev/null || date +%s%N | sha256sum | cut -c1-48) > .postgres_password
fi
{
  echo "APP_DOMAIN=prout-app.vibecodestudio.io"
  echo "POSTGRES_USER=prout"
  echo "POSTGRES_DB=prout"
  echo "POSTGRES_PASSWORD=$(cat .postgres_password)"
  echo "PROXY_NETWORK=$PROXY_NETWORK"
  echo "CERT_RESOLVER=$CERT_RESOLVER"
  echo "HTTPS_ENTRYPOINT=$HTTPS_ENTRYPOINT"
} > .env
chmod 600 .env
echo "Fichier .env généré."

echo
echo "===== 5. DÉMARRAGE DES CONTENEURS ====="
if timeout 360 docker compose up -d --no-build --remove-orphans 2>&1; then
  echo "docker compose up : OK"
else
  echo "ECHEC: docker compose up (timeout ou erreur)"
fi

echo
echo "===== 6. ÉTAT FINAL ====="
timeout 30 docker compose ps 2>&1 || echo "(compose ps: bloqué)"
echo "-- logs application --"
timeout 40 docker compose logs --tail=40 app 2>&1 || echo "(logs app: bloqué)"
echo "-- logs base de données --"
timeout 30 docker compose logs --tail=15 db 2>&1 || echo "(logs db: bloqué)"
echo
echo "===== FIN ====="
