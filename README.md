# B2B AI Lead Machine

## Démarrage local

1. Installer les dépendances :
```
npm install
```

2. Copier `.env.local.example` en `.env.local` et remplir avec tes vraies clés (Supabase + Anthropic)

3. Lancer le serveur de dev :
```
npm run dev
```

4. Ouvrir : http://localhost:3000/diagnostic/test

## Déploiement

1. Push ce projet sur un repo GitHub
2. Sur Vercel : "Add New Project" → importer ce repo GitHub
3. Dans Vercel → Settings → Environment Variables : ajouter les 3 variables du `.env.local`
4. Deploy
