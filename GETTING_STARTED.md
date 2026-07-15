# Guide de démarrage rapide - TechTalk

Ce guide explique comment lancer et tester l'application TechTalk en local après avoir cloné le dépôt.

---

## 🛠 Prérequis

Assurez-vous d'avoir installé sur votre machine :
1. **Node.js** (v18 ou supérieur)
2. **NPM** (inclus avec Node)
3. **Docker** (recommandé pour lancer PostgreSQL facilement)

---

## 🚀 Étapes de lancement

### Étape 1 : Installer les dépendances du projet
Depuis la racine du projet (`TechTalk/`), installez toutes les dépendances du monorepo (frontend, backend et dépendances communes) :
```bash
npm install
```

### Étape 2 : Lancer la base de données PostgreSQL
Si vous avez Docker, lancez une instance PostgreSQL en arrière-plan avec cette commande simple :
```bash
docker run --name teachtalk-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=teachtalk_db -p 5432:5432 -d postgres:16-alpine
```
*Si vous utilisez une base de données PostgreSQL locale sans Docker, assurez-vous de créer une base de données nommée `teachtalk_db` sur le port `5432`.*

### Étape 3 : Configurer les variables d'environnement du Backend
1. Rendez-vous dans le dossier backend :
   ```bash
   cd apps/backend
   ```
2. Créez le fichier `.env` à partir de l'exemple :
   ```bash
   cp .env.example .env
   ```
   *Les valeurs par défaut configurées dans `.env.example` sont prêtes à l'emploi et se connectent directement au conteneur Docker lancé à l'étape 2.*

### Étape 4 : Initialiser la structure de la base de données
Toujours dans le dossier `apps/backend/`, appliquez le schéma de la base de données Drizzle :
```bash
npm run db:push
```

### Étape 5 : Lancer l'application en mode développement
Revenez à la racine du projet :
```bash
cd ../..
```

Lancez simultanément le **Frontend** et le **Backend** avec une seule commande :
```bash
npm run dev
```

*Alternativement, vous pouvez les lancer dans des terminaux séparés depuis la racine :*
* *Pour lancer le Backend uniquement : `npm run dev:backend`*
* *Pour lancer le Frontend uniquement : `npm run dev:frontend`*

---

## 🧪 Comment tester l'application ?

1. Ouvrez votre navigateur et accédez à l'adresse suivante : **[http://localhost:5173](http://localhost:5173)**.
2. Vous serez redirigé vers l'écran d'authentification.
3. Cliquez sur l'onglet **Sign Up** (Inscription) pour créer un compte utilisateur :
   * Remplissez le nom, l'e-mail et le mot de passe (doit comporter au moins 12 caractères, 1 chiffre, 1 majuscule, 1 minuscule et 1 caractère spécial).
   * Cliquez sur **Create Account**.
4. L'application vous connecte automatiquement et charge le tableau de bord.
5. **Flux de veille technique** : Vous devriez voir les articles récents automatiquement scrapés en arrière-plan depuis **Dev.to** et **TechCrunch**.
6. **Favoris (Saved)** : Cliquez sur l'icône de signet sur une carte pour l'ajouter à vos favoris, puis allez sur l'onglet *Saved* pour vérifier qu'elle y apparaît.
7. **Profil** : Allez sur l'onglet *Profile* pour vérifier que votre nom et votre adresse e-mail s'affichent correctement et que votre compteur de favoris est synchronisé.
8. **Lecteur vidéo** : Si une vidéo YouTube est disponible dans le flux, cliquez dessus pour ouvrir l'overlay de lecture et regarder la vidéo directement intégrée dans l'application.
