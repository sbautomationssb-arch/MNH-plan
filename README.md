# marie-neiges-plan

Mini-app Next.js 14 (App Router) pour le plan brand + content de Marie-Neiges.
Stack : Next.js 14, React 18, TypeScript, Tailwind. Zéro dépendance exotique.

## Structure

```
app/
  layout.tsx       — root layout, charge les fonts
  page.tsx         — la page principale
  globals.css      — Tailwind + tokens Ara3
components/
  BucketCard.tsx   — card réutilisable pour chaque bucket
lib/
  content.ts       — SOURCE DE VÉRITÉ. Tu updates les buckets/pillars ici.
```

## Run en local

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000.

## Deploy sur Vercel (option 1 — CLI)

```bash
npm i -g vercel
vercel          # lier le projet
vercel --prod   # ship en production
```

## Deploy sur Vercel (option 2 — GitHub)

1. Push le repo sur GitHub.
2. Sur vercel.com → New Project → Import le repo.
3. Framework auto-détecté : Next.js. Tu laisses les settings par défaut.
4. Deploy. Tu auras une URL `*.vercel.app` en 30 sec.

## Workflow Claude Code

Pour itérer vite depuis le terminal :

```bash
cd marie-neiges-plan
claude                  # lance la session Claude Code
```

Exemples de prompts utiles :
- "Ajoute un bucket #8 nommé [X] avec la description [Y] dans lib/content.ts"
- "Change le highlight teal dans BucketCard pour être plus subtil"
- "Ajoute une section timeline après les buckets"

Tous les changements de contenu se font dans `lib/content.ts`.
Tout ce qui est visuel/layout se fait dans `components/` et `app/page.tsx`.

## Tokens de brand (tailwind.config.ts)

- `charcoal` : `#1b1b1b`
- `offwhite` : `#f5f5f5`
- `teal` : `#04e0bc`
- `font-display` : Archivo Black (fallback Qanelas)
- `font-sans` : Inter

Garde ces tokens. Ils matchent le système Ara3 Media.
