# Déploiement — prout-app.vibecodestudio.io

L'application se déploie sur le VPS via le workflow GitHub Actions
**« Déploiement VPS »** (`.github/workflows/deploy.yml`).

## Principe

```
GitHub Actions : build de l'image Docker  ──▶  transfert sur le VPS
                                                     │
                                       docker compose up (app + PostgreSQL)
                                                     │
                              reverse proxy Traefik du VPS ──▶ HTTPS
```

L'image est construite sur l'infrastructure GitHub puis transférée prête à
l'emploi : le VPS ne compile rien.

## Prérequis

1. **Secret GitHub** `VPS_PASSWORD` (Settings → Secrets and variables →
   Actions) : le mot de passe SSH du VPS.
2. **DNS** : `prout-app.vibecodestudio.io` pointant vers le VPS.
3. Sur le VPS : Docker + Docker Compose, et un reverse proxy **Traefik**
   déjà en service sur un réseau Docker partagé.

## Déployer

Onglet **Actions → Déploiement VPS → Run workflow**.

Le workflow construit l'image, la transfère dans `/opt/ITCmdm/deploy/prout-app`,
génère le fichier `.env` (mot de passe PostgreSQL généré une fois et conservé)
puis démarre les conteneurs `prout-app` + `prout-db`.

## Configuration Traefik

`docker-compose.yml` route le sous-domaine via des labels Traefik. Trois
valeurs doivent correspondre à la configuration Traefik du VPS, dans le
fichier `.env` généré au déploiement :

| Variable | Rôle | Valeur par défaut |
|----------|------|-------------------|
| `PROXY_NETWORK` | réseau Docker partagé avec Traefik | détecté automatiquement |
| `HTTPS_ENTRYPOINT` | entrypoint HTTPS de Traefik | `websecure` |
| `CERT_RESOLVER` | résolveur de certificats Let's Encrypt | `le` |

Si les autres applications du VPS utilisent d'autres noms, ajuster ces
valeurs dans `deploy.yml`.

## Vérification

Après un déploiement réussi : <https://prout-app.vibecodestudio.io>

Sur le VPS :

```bash
cd /opt/ITCmdm/deploy/prout-app
docker compose ps
docker compose logs --tail=50 app
```
