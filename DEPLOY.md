# Déploiement — prout-app.vibecodestudio.io

L'application se déploie **automatiquement** sur le VPS via GitHub Actions.
Tout est automatisé sauf **une seule chose**, à faire une fois.

## La seule étape à faire (1 minute)

Le déploiement a besoin du mot de passe du VPS pour s'y connecter. Pour des
raisons de sécurité, ce mot de passe doit être ajouté dans GitHub (et pas
dans le code) :

1. Aller sur le dépôt GitHub → onglet **Settings**
2. Menu de gauche : **Secrets and variables** → **Actions**
3. Bouton **New repository secret**
4. **Name** : `VPS_PASSWORD`
5. **Secret** : le mot de passe root du VPS
6. **Add secret**

C'est tout. Le reste (adresse du VPS, base de données, certificat HTTPS,
configuration Traefik) est géré automatiquement.

## Lancer le déploiement

- **Automatique** : à chaque push sur la branche `main`.
- **Manuel** : onglet **Actions** → **Déploiement VPS** → **Run workflow**.

Le workflow copie le projet sur le VPS, détecte la configuration du reverse
proxy Traefik, construit l'image Docker et démarre l'application avec sa base
PostgreSQL. Le premier lancement crée la base et un jeu de données de
démonstration.

## Ce que fait le déploiement automatiquement

- Connexion au VPS `76.13.0.189`, dossier `/opt/ITCmdm/deploy/prout-app`.
- Génération d'un mot de passe PostgreSQL fort (conservé entre les déploiements).
- Détection du réseau Docker, de l'entrypoint HTTPS et du certresolver de
  Traefik en s'alignant sur les applications déjà en place sur le VPS.
- Build de l'image et démarrage des conteneurs `prout-app` + `prout-db`.

## Vérification

Après un déploiement réussi : <https://prout-app.vibecodestudio.io>

Sur le VPS, pour diagnostiquer :

```bash
cd /opt/ITCmdm/deploy/prout-app
docker compose ps
docker compose logs --tail=50 app
```

## Sauvegarde de la base

```bash
cd /opt/ITCmdm/deploy/prout-app
docker compose exec db pg_dump -U prout prout > sauvegarde-$(date +%F).sql
```

## Sécurité — à faire après le premier déploiement

Le mot de passe root a transité par un canal non sécurisé. Il est recommandé :

1. de **changer le mot de passe root** du VPS, puis de mettre à jour le secret
   `VPS_PASSWORD` ;
2. à terme, de passer à une **authentification par clé SSH** (le workflow
   accepte aussi une clé : remplacer `password:` par `key:` dans
   `.github/workflows/deploy.yml` et créer le secret `VPS_SSH_KEY`).
