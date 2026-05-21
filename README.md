# Méthascore — Méthanisation & CRM Waste-end

Application full-stack pour **estimer la probabilité de méthanisation** de
gisements de déchets organiques et **piloter le cycle commercial** de la vente
de solutions [Waste-end](https://www.waste-end.com), du lead entrant à la
gestion après-vente.

## Ce que fait l'application

1. **Moteur de calcul de méthanisation** — à partir d'un gisement de déchets
   organiques (tonnages annuels par substrat), estime :
   - la production de méthane (CH₄) et de biogaz,
   - l'énergie primaire, l'électricité / chaleur (cogénération) ou le
     biométhane injecté,
   - la recette énergétique annuelle et le CO₂ évité,
   - une **probabilité de faisabilité** (0-100 %) avec le détail des facteurs
     (taille du gisement, qualité méthanogène, co-digestion, débouché
     énergétique, foncier, incitatif économique, régularité).

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
| Base de données | SQLite (`better-sqlite3`) — fichier `server/data/crm.db` |

> SQLite est une base de données SQL réelle, sans serveur à administrer. Le
> schéma et les requêtes restent standard : un passage à PostgreSQL ne demande
> que de remplacer la couche d'accès `server/src/db.ts`.

## Démarrage

```bash
npm install        # installe server + client (workspaces)
npm run dev        # lance l'API (port 4000) et le client (port 5173)
```

Puis ouvrir http://localhost:5173. La base est créée et alimentée avec un jeu
de données de démonstration au premier lancement.

### Production

```bash
npm run build      # build du client + compilation du serveur
npm start          # le serveur sert l'API et le front sur le port 4000
```

## API principale

| Méthode | Route | Rôle |
|--------|-------|------|
| `GET` | `/api/meta` | Référentiel substrats + étapes du pipeline |
| `POST` | `/api/calc` | Calcul de méthanisation sans persistance |
| `GET/POST` | `/api/leads` | Liste / création de leads |
| `GET/PUT/DELETE` | `/api/leads/:id` | Détail / mise à jour / suppression |
| `PATCH` | `/api/leads/:id/stage` | Changement d'étape du pipeline |
| `POST` | `/api/leads/:id/assessments` | Étude de méthanisation rattachée |
| `POST` | `/api/leads/:id/activities` | Journal des interactions |
| `POST` | `/api/leads/:id/tickets` | Tickets de suivi / SAV |
| `GET` | `/api/dashboard` | Indicateurs agrégés du pipeline |

## Modèle de calcul

Par substrat : `CH₄ = tonnage × MS × MO × potentiel méthanogène`.

Les caractéristiques de référence des substrats (matière sèche, matière
organique, potentiel méthanogène) sont des ordres de grandeur issus de la
littérature technique. Elles sont centralisées dans `server/src/calc.ts` et
peuvent être affinées par substrat.
