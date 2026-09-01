# Rendre le dépôt GitHub privé

Ce document explique comment passer le dépôt GitHub `ElDamoss/FitnessTracker` en **privé** depuis le tableau de bord GitHub, ainsi que les conséquences de ce changement.

> ⚠️ Cette opération se fait **manuellement** dans l'interface GitHub. Aucune action automatique n'est réalisée par l'application.

## Étapes — Passer le dépôt en privé

1. Va sur https://github.com et connecte-toi avec le compte propriétaire du dépôt (**ElDamoss**).
2. Ouvre le dépôt : `ElDamoss/FitnessTracker` (ou directement https://github.com/ElDamoss/FitnessTracker).
3. Clique sur l'onglet **Settings** (Paramètres), en haut à droite de la page du dépôt.
4. Fais défiler la page tout en bas jusqu'à la section **Danger Zone** (Zone de danger).
5. Repère la ligne **Change repository visibility** (Modifier la visibilité du dépôt) et clique sur le bouton **Change visibility**.
6. Sélectionne l'option **Make private** / **Private**.
7. GitHub demande une confirmation : **tape le nom complet du dépôt** (`ElDamoss/FitnessTracker`) dans le champ prévu.
8. Valide en cliquant sur le bouton de confirmation (**I understand, change repository visibility** / bouton rouge).

Le dépôt est désormais privé.

## Conséquences

### Visibilité du code source
- Le code source **ne sera plus visible publiquement**. Personne ne pourra le cloner, le copier ou le consulter sans y être explicitement autorisé.
- Le dépôt disparaît des résultats de recherche publics et des pages de profil publiques.

### Impact sur le déploiement
- Le site **pwa-v1** en production sur **fitnesstracker.bzh** est déployé via **Cloudflare Pages**.
- Passer le dépôt en privé **ne casse PAS le site déjà déployé** : la version en ligne continue de fonctionner normalement.
- En revanche, il faut **vérifier que l'intégration Cloudflare Pages ↔ GitHub a toujours l'autorisation d'accéder au dépôt privé**. Si l'application GitHub de Cloudflare perd l'accès, les **futurs déploiements automatiques** (à chaque push) ne se déclencheront plus.
- Si besoin, **réautorise l'application GitHub de Cloudflare** : dans Cloudflare Pages → projet → *Settings* → *Builds & deployments* / *Git integration*, ou côté GitHub dans *Settings* → *Applications* → *Installed GitHub Apps* → Cloudflare Pages, et accorde l'accès au dépôt `ElDamoss/FitnessTracker`.
- Après réautorisation, vérifie qu'un nouveau push déclenche bien un déploiement.

### Liens publics
- Les **liens publics vers le code** (issues, pull requests, fichiers, releases, etc.) deviendront **inaccessibles** aux personnes non autorisées. Toute personne sans droit d'accès verra une page « 404 / introuvable ».

### Collaborateurs
- Les collaborateurs devront être **ajoutés explicitement** au dépôt pour continuer à y accéder.
- Pour les ajouter : dépôt → **Settings** → **Collaborators** (Collaborateurs) → **Add people** → saisir leur identifiant GitHub et choisir leur niveau d'accès.
