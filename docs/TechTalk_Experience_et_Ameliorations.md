# TechTalk — Expérience utilisateur & pistes d'amélioration

> Basé sur le rapport de test fonctionnel end-to-end réalisé le 5 août 2026 sur `tech-talk-frontend.vercel.app`, avec le compte Google de Flavio.

## En bref

TechTalk se présente comme un **agrégateur de contenu tech façon « TikTok for tech »** : on scrolle un feed d'articles (au lieu d'une timeline classique), on les sauvegarde, on suit son profil et ses stats de lecture.

Le test a couvert 13 fonctionnalités. Verdict : **le parcours principal marche** (connexion → feed → sauvegarde → déconnexion), mais il reste **une faille de sécurité critique**, **2 bugs bloquants**, et plusieurs écarts entre ce que l'app promet et ce qu'elle livre réellement.

**Stack observée :**

| Composant | Valeur |
|---|---|
| Frontend | Vite + React (SPA), hébergé sur Vercel |
| Backend | API REST sur Render.com (free tier) |
| Auth | Google Identity Services + JWT maison |
| Design | Thème sombre, police Inter + JetBrains Mono, icônes SVG inline |
| Contenu actuel | 50 articles — TechCrunch (12) et Dev.to (38) uniquement |

---

## L'expérience, étape par étape

### 1. Arrivée sur la landing page
Sans être connecté, on tombe sur un hero « TikTok for tech — discover, scroll, learn » avec une modale Sign In / Sign Up (email/mot de passe ou Google). Une fois connecté via Google, l'app charge directement l'avatar et bascule sur le feed — pas de retour à la modale. C'est fluide.

### 2. Le feed principal
50 articles chargés d'un coup, chaque carte affichant source, date, temps de lecture estimé, titre, résumé et un bouton bookmark. L'effet recherché est celui d'un scroll façon TikTok : cliquer une carte la recentre à l'écran plutôt que d'ouvrir une nouvelle page.

**Point faible repéré :** le bouton *Read on TechCrunch ↗*, censé ouvrir l'article original dans un nouvel onglet, ne fait rien. C'est le point de sortie vers le vrai contenu — et il est cassé.

### 3. Bookmarks (Saved)
Fonctionne bien de bout en bout : sauvegarder une carte l'ajoute à la page *Saved*, cliquer à nouveau l'icône la retire. Le cycle create → list → delete a été validé côté API (201 / 200 / 200).

### 4. Le profil
Affiche 3 stats (Saved / Read / Streak) calculées à partir du localStorage, plus 5 centres d'intérêt pré-sélectionnés et un raccourci vers les réglages. Simple et clair.

### 5. Les réglages
On peut changer son nom d'affichage et cocher/décocher parmi 8 sujets d'intérêt. Le sélecteur de langue propose le français, mais il est désactivé (« Coming soon ») — l'interface reste 100 % en anglais.

### 6. La page About
Décrit le produit et annonce 4 sources de contenu : Dev.to, TechCrunch, **Reddit** et **YouTube**. Sauf qu'en pratique, seuls Dev.to et TechCrunch alimentent le feed. Reddit et YouTube n'existent nulle part ailleurs dans l'app.

### 7. La recherche
Une icône loupe révèle un champ de recherche full-text, avec debounce, qui interroge le backend et filtre côté serveur. Ça répond bien (200) et se vide proprement.

### 8. Les filtres All / Articles / Videos
*All* et *Articles* affichent les mêmes 50 résultats (logique, tout le contenu actuel est de type article). *Videos* affiche un état vide — cohérent avec l'absence totale de vidéos dans le dataset, mais ça confirme que ce filtre ne sert à rien pour l'instant.

### 9. Notifications (raccourci alt+T)
Le raccourci existe dans le code (aria-label « Notifications ») mais ne déclenche aucune action visible. Il n'y a en réalité aucun panneau de notifications implémenté.

### 10. Déconnexion
Propre : une modale de confirmation, suppression du token et des infos utilisateur, mais conservation de l'historique de lecture local pour le retrouver à la prochaine connexion. Retour net à la landing page.

---

## Ce qui fonctionne déjà bien

- Connexion Google fluide, sans friction
- Feed, recherche et bookmarks solides côté API (statuts HTTP cohérents)
- Sign out propre avec confirmation et nettoyage ciblé du localStorage
- Endpoint `/api/health` disponible pour le monitoring

---

## Ce qu'on peut ajouter ou améliorer

### 🔴 Sécurité — à traiter avant toute mise en public
Le backend accepte un token dont le payload a été modifié sans vérifier la signature. Concrètement, ça veut dire qu'en connaissant juste l'ID d'un utilisateur (visible dans les URLs/réponses API), n'importe qui peut se faire passer pour lui — voire s'attribuer un rôle admin, ou rendre son token éternellement valide. Le principe général : le backend doit **valider** la signature du token, pas seulement lire son contenu. C'est le genre de faille qu'un correcteur ou un jury sécurité repère en quelques minutes.

### 🟠 Fonctionnel — expérience cassée
- **Le lien vers l'article original ne fonctionne pas** — c'est pourtant la fonctionnalité de base d'un agrégateur (lire l'article complet ailleurs)
- **Aucun message d'erreur sur déconnexion forcée (401)** — l'utilisateur est éjecté silencieusement, sans comprendre pourquoi
- **Le tracking de lecture reste purement local** — pas de synchronisation avec le backend, donc stats perdues au moindre nettoyage de navigateur

### 🟡 Cohérence produit — promesses vs réalité
- Reddit et YouTube sont annoncés comme sources mais absents du feed réel
- Le filtre "Videos" n'a aucune utilité tant qu'il n'y a pas de vidéos
- Le français est proposé dans les réglages mais désactivé — autant le retirer temporairement ou l'activer

### 🟢 Petits détails à corriger
- Le raccourci notifications (alt+T) ne fait rien — soit l'implémenter, soit retirer sa trace dans l'UI
- Plusieurs boutons du header sont couverts par d'autres éléments (z-index mal géré) — invisible pour l'utilisateur humain mais révèle une CSS à nettoyer
- Pas de route `/api/auth/refresh` ni `/api/auth/me` — le token expire après 24h sans possibilité de le rafraîchir, donc déconnexion forcée régulière
- Cold start de ~30 secondes sur le backend (hébergement gratuit qui s'endort) — à anticiper si l'app doit être présentée en démo

---

## Priorités suggérées

| # | Priorité | Action | Effort estimé |
|---|---|---|---|
| 1 | 🔴 Critique | Vérifier réellement la signature du JWT côté backend | 0.5 jour |
| 2 | 🔴 Critique | Logger les tentatives de token invalide (401) pour audit | 0.5 jour |
| 3 | 🟠 Haute | Réparer le lien "Read on TechCrunch" | court |
| 4 | 🟠 Haute | Ajouter un endpoint de rafraîchissement de session | 1 jour |
| 5 | 🟠 Haute | Afficher un message clair en cas de déconnexion forcée | 0.5 jour |
| 6 | 🟡 Moyenne | Synchroniser l'historique de lecture avec le backend | 1 jour |
| 7 | 🟡 Moyenne | Aligner les sources annoncées (About) avec le contenu réel | selon choix |
| 8 | 🟢 Faible | Nettoyer aria-labels, z-index, filtre Videos inutile | quelques heures |

---

## En résumé

TechTalk a une base solide et une UX agréable sur le parcours principal. Les priorités à traiter d'abord sont la **sécurité du token** et le **lien de lecture cassé**, parce que ce sont les deux points qui touchent directement la confiance et l'utilité de l'app. Le reste — vidéos absentes, i18n, notifications — relève davantage de choix de scope à clarifier que de bugs à corriger dans l'urgence.
