# Déploiement — prout-app.vibecodestudio.io

Ce guide décrit le déploiement de Méthascore sur le VPS iTakecare via le
workflow GitHub Actions fourni (`.github/workflows/deploy.yml`).

## Architecture déployée

```
Internet ──▶ Reverse proxy du VPS (Traefik, TLS Let's Encrypt)
                      │  Host: prout-app.vibecodestudio.io
                      ▼
              conteneur « prout-app »  (Node + client React servi en statique)
                      │
                      ▼
              conteneur « prout-db »   (PostgreSQL 16, volume persistant)
```

Les deux conteneurs sont décrits dans `docker-compose.yml`. La base de données
est stockée sur le volume Docker `prout-db-data` (persistant entre les
redéploiements).

## 1. Prérequis sur le VPS

- **Docker** et le plugin **Docker Compose v2** installés.
- Un **reverse proxy** (Traefik) déjà en service, gérant les autres
  sous-domaines de `vibecodestudio.io`, attaché à un **réseau Docker externe**.
- Le nom de ce réseau (souvent `web` ou `proxy`) et celui du **certresolver**
  Traefik (souvent `le`) — à reporter dans les variables GitHub ci-dessous.

> Si le proxy n'est pas Traefik, voir la section 5.

## 2. DNS

Créer un enregistrement **A** :

```
prout-app.vibecodestudio.io.   A   76.13.0.189
```

(ou un CNAME vers le domaine déjà utilisé par les autres apps du VPS).

## 3. Clé SSH de déploiement

Sur un poste de confiance :

```bash
ssh-keygen -t ed25519 -f prout_deploy -C "github-actions prout-app"
```

Ajouter la **clé publique** (`prout_deploy.pub`) sur le VPS :

```bash
ssh-copy-id -i prout_deploy.pub root@76.13.0.189
# ou : ajouter son contenu à /root/.ssh/authorized_keys
```

La **clé privée** (`prout_deploy`) sera mise dans le secret `VPS_SSH_KEY`.

> Recommandé : créer un utilisateur dédié au déploiement plutôt que `root`, et
> désactiver l'authentification par mot de passe une fois la clé en place.

## 4. Secrets et variables GitHub

Dans le dépôt : **Settings → Secrets and variables → Actions**.

### Secrets (onglet « Secrets »)

| Nom | Valeur |
|-----|--------|
| `VPS_HOST` | `76.13.0.189` |
| `VPS_USERNAME` | `root` (ou l'utilisateur de déploiement) |
| `VPS_SSH_KEY` | contenu de la clé privée `prout_deploy` |
| `VPS_PORT` | `22` (optionnel) |
| `VPS_DEPLOY_PATH` | `/opt/ITCmdm/deploy` |
| `POSTGRES_PASSWORD` | un mot de passe fort généré pour la base |

### Variables (onglet « Variables »)

| Nom | Valeur |
|-----|--------|
| `APP_DOMAIN` | `prout-app.vibecodestudio.io` |
| `PROXY_NETWORK` | nom du réseau Docker externe du proxy (ex. `web`) |
| `CERT_RESOLVER` | nom du certresolver Traefik (ex. `le`) |

## 5. Lancer le déploiement

Le workflow se déclenche :

- **manuellement** : onglet **Actions → Déploiement VPS → Run workflow** ;
- **automatiquement** : à chaque push sur la branche `main`.

Le workflow copie le projet dans `<VPS_DEPLOY_PATH>/prout-app`, génère le
fichier `.env`, puis exécute `docker compose up -d --build`. Le premier
lancement crée le schéma PostgreSQL et un jeu de données de démonstration.

Vérification après déploiement :

```bash
ssh root@76.13.0.189 'cd /opt/ITCmdm/deploy/prout-app && docker compose ps'
curl -I https://prout-app.vibecodestudio.io
```

## 6. Si le reverse proxy n'est pas Traefik

Le `docker-compose.yml` utilise des labels Traefik. Adaptations possibles :

- **nginx-proxy / acme-companion** : remplacer les `labels` par les variables
  d'environnement `VIRTUAL_HOST`, `VIRTUAL_PORT=4000`, `LETSENCRYPT_HOST` et
  `LETSENCRYPT_EMAIL`, et garder l'app sur le réseau du proxy.
- **Nginx/Caddy manuel** : décommenter le bloc `ports: ["4000:4000"]` dans
  `docker-compose.yml`, retirer le réseau `proxy`, puis configurer un vhost qui
  reverse-proxie `prout-app.vibecodestudio.io` vers `127.0.0.1:4000`.

## 7. Maintenance

```bash
cd /opt/ITCmdm/deploy/prout-app

# Logs
docker compose logs -f app

# Sauvegarde de la base
docker compose exec db pg_dump -U prout prout > sauvegarde-$(date +%F).sql

# Restauration
cat sauvegarde.sql | docker compose exec -T db psql -U prout prout

# Mise à jour manuelle
docker compose up -d --build
```

## Déploiement manuel (sans GitHub Actions)

```bash
ssh root@76.13.0.189
mkdir -p /opt/ITCmdm/deploy/prout-app && cd $_
git clone <url-du-dépôt> .
cp .env.example .env && nano .env      # renseigner les valeurs
docker compose up -d --build
```
