# Méthascore — Biométhanisation & CRM Waste-end

Application full-stack pour **estimer le potentiel d'une unité de
biométhanisation de déchets alimentaires** sur site et **piloter le cycle
commercial** de la vente de solutions [Waste-end](https://www.waste-end.com),
du lead entrant à la gestion après-vente.

Cible : petits et moyens producteurs de déchets alimentaires — restaurants,
écoles, maisons de repos, hôpitaux, cuisines de collectivité — qui traitent
leurs déchets sur place au lieu de les faire collecter et incinérer.

## Ce que fait l'application

1. **Moteur de calcul de biométhanisation** — à partir du gisement de déchets
   alimentaires d'un établissement (tonnages annuels par type de déchet),
   estime :
   - la production de méthane (CH₄) et de biogaz,
   - la chaleur valorisable sur site (cuisine, eau chaude),
   - le digestat (engrais naturel) produit,
   - le CO₂ évité par rapport à l'incinération,
   - les économies annuelles (collecte évitée + énergie),
   - un **score de pertinence** (0-100 %) du projet, avec le détail des
     facteurs (volume de déchets, incitatif économique, régularité, place
     disponible, débouché chaleur, qualité méthanogène).

2. **CRM avec pipeline commercial** — chaque prospect (lead) avance dans un
   pipeline : Nouveau lead → Qualifié → Étude technique → Proposition →
   Négociation → Gagné/Installation → En service/Suivi (ou Perdu).

3. **Gestion après-vente** — tickets de suivi & SAV sur les installations en
   service, journal des interactions commerciales, études rattachées au lead.

## Architecture

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 + Vite + TypeScript + React Router |
| Backend | Node + Express + TypeScript |
| Base de données | PostgreSQL 16 (`pg`) |
| Déploiement | Docker + Docker Compose, CI/CD GitHub Actions |

## Démarrage en local

Une base PostgreSQL est nécessaire. Le plus simple, via Docker :

```bash
cp .env.example .env          # renseigner POSTGRES_PASSWORD
docker compose up -d db       # démarre PostgreSQL sur le port 5432
npm install                   # installe server + client (workspaces)
npm run dev                    # API (port 4000) + client (port 5173)
```

Puis ouvrir http://localhost:5173. Le schéma est créé et alimenté avec un jeu
de données de démonstration au premier lancement.

> Le serveur lit `DATABASE_URL` (défaut :
> `postgres://prout:prout@localhost:5432/prout`).

### Build de production

```bash
npm run build      # build du client + compilation du serveur
npm start          # le serveur sert l'API et le front sur le port 4000
```

### Déploiement sur le VPS

L'application se déploie sur `prout-app.vibecodestudio.io` via le workflow
GitHub Actions. Voir **[DEPLOY.md](./DEPLOY.md)** pour la procédure complète
(secrets GitHub, DNS, reverse proxy).

## API principale

| Méthode | Route | Rôle |
|--------|-------|------|
| `GET` | `/api/meta` | Référentiel des déchets + étapes du pipeline |
| `POST` | `/api/calc` | Calcul de biométhanisation sans persistance |
| `GET/POST` | `/api/leads` | Liste / création de leads |
| `GET/PUT/DELETE` | `/api/leads/:id` | Détail / mise à jour / suppression |
| `PATCH` | `/api/leads/:id/stage` | Changement d'étape du pipeline |
| `POST` | `/api/leads/:id/assessments` | Étude de faisabilité rattachée |
| `POST` | `/api/leads/:id/activities` | Journal des interactions |
| `POST` | `/api/leads/:id/tickets` | Tickets de suivi / SAV |
| `GET` | `/api/dashboard` | Indicateurs agrégés du pipeline |

## Modèle de calcul

Par type de déchet : `CH₄ = tonnage × MS × MO × potentiel méthanogène`.

Puis : biogaz, énergie primaire (PCI du CH₄), chaleur valorisable (rendement
chaudière × débouché sur site), digestat, CO₂ évité vs incinération (0,124 t
CO₂ par tonne de déchets, étude Bruxelles Environnement) et économies.

Les caractéristiques de référence des déchets alimentaires (matière sèche,
matière organique, potentiel méthanogène) sont des ordres de grandeur issus de
la littérature technique sur la digestion anaérobie des biodéchets. Elles sont
centralisées dans `server/src/calc.ts` et peuvent être affinées.
