# Marie-Neiges plan — roadmap

Outil interne Ara3 Media × Marie-Neiges pour le plan brand + exécution contenu (mai–juillet 2026).
Stack : Next.js 14 App Router, Supabase (DB + Storage + Realtime), Tailwind, déployé sur Vercel.

## État actuel (2026-05-01)

Une seule page (`app/page.tsx`) qui contient maintenant 7 sections :

1. **Header + 5 piliers** — musique artsy, vibe naturelle, humour pince-sans-rire, qualité de chanson, artisanat/process.
2. **Principe directeur** — le contraste musique/personne.
3. **8 content buckets** — chaque bucket avec sa description, son highlight et une grille de **thumbnails IG** (scrape og:image via crawler UA + proxy same-origin, cache 24h).
4. **Sorties & audios** — embed SoundCloud du set privé `c'est pas grave si je pleure` + 3 releases listées (Emporte-moi · 27 mai, Maintenant · 20 août, EP · 25 sept).
5. **Submission queue** — drop bulk d'URLs IG, parse + dédupe, status `pending`/`liked`/`refused`, commentaire MN inline, thumbnail IG par row. Les reviewées sont collapsées sous un toggle.
6. **Calendrier de publication** — pool des aimées-non-placées à gauche, grille mois drag-and-drop à droite. Cards portent : thumbnail, URL, **bucket** (1-8), **production status** (draft / shot / edited / posted, badge coloré), commentaire. Click sur une card → modal détail avec édition complète.
7. **Drops MN** — MN upload directement vidéos *ou* photos depuis son device vers Supabase Storage. Chaque drop : player vidéo natif (ou `<img>` pour photos), note de MN, status review (à review / approuvé / changements demandés / refusé), commentaire planner avec auto-save 500ms.

Tout sync realtime via Supabase. Pas d'auth (outil partagé interne, RLS open).

## Ce qui reste à faire

- **Édition inline sur les day cards** du calendrier (présentement il faut ouvrir le modal)
- **Threaded comments** dans les drops MN (single field pour l'instant)
- **Conversion HEIC→JPEG** côté serveur pour drops photos iPhone (HEIC ne render que dans Safari)
- **Bump file size limit Storage** au-delà de 50MB pour vidéos plus longues / 4K
- **Drag-and-drop reorder** dans la même journée du calendrier
- **Promote en 1 click** : bouton "Ajouter au calendrier" sur une submission aimée (au lieu de devoir drag dans le pool puis dans le calendrier)
- **DnD mobile** : pas supporté pour le calendrier (HTML5 DnD natif desktop only — confirmé OK avec le user)

## Fichiers clés

- `app/page.tsx` — la page unique, ordre des sections
- `lib/content.ts` — source de vérité pour piliers / buckets / releases / preview SoundCloud
- `lib/supabase.ts` — client + types `SubmissionRow`, `ArtistVideoRow`, `ProductionStatus`
- `lib/instagram.ts` — fetch og:image avec UA `facebookexternalhit`
- `components/SubmissionQueue.tsx` — section 05
- `components/PlanCalendar.tsx` — section 06 (pool + grille + modal + bucket picker + status badges)
- `components/ArtistDrops.tsx` — section 07
- `components/BucketCard.tsx` — refs IG en grille thumbnails
- `components/ReleaseList.tsx` — cards de releases
- `app/api/ig-thumbnail/route.ts` — endpoint client : URL IG → bytes image
- `app/api/proxy-image/route.ts` — endpoint server : URL CDN IG → bytes image (utilisé par BucketCard)

## Migrations Supabase

| # | Fichier | Quoi |
|---|---|---|
| 0001 | `submissions.sql` | table `submissions` + trigger `set_updated_at` + RLS open + realtime |
| 0002 | `scheduled_for.sql` | colonne `scheduled_for date` pour le calendrier |
| 0003 | `bucket_id.sql` | colonne `bucket_id int` pour assigner aux 8 buckets |
| 0004 | `production_status.sql` | colonne `production_status` (`draft\|shot\|edited\|posted`) avec check constraint |
| 0005 | `artist_videos.sql` | table `artist_videos` + bucket Storage `artist-videos` (public) + 3 RLS policies sur `storage.objects` |

Toutes idempotentes (`if not exists` / `do $$ ... exception when duplicate_object then null`).

## Décisions d'archi

- **Pas d'auth** — outil partagé Ara3 + MN, RLS ouverts intentionnellement.
- **Source de vérité contenu** dans `lib/content.ts` (piliers, buckets, releases, preview set) — pas en DB.
- **IG thumbnails** : og:image scrape via UA `facebookexternalhit` (Instagram strip les meta tags pour les UAs desktop génériques), puis proxy same-origin via route handler avec `Cache-Control` agressif → Vercel CDN sert les bytes après le 1er hit.
- **Drag-and-drop natif HTML5** dans le calendrier — desktop only, suffisant pour le use case (build du plan se fait sur laptop).
- **Single-page** — pas de routing, tout dans `app/page.tsx`. Tant qu'il y a 7 sections, ça reste lisible.

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxx
```

Sans ça : la queue, le calendrier et les drops affichent un message d'erreur et restent désactivés gracefully.

## Historique

### Phase 1 — Plan statique initial
- Page Next.js + tokens Tailwind charcoal/offwhite/teal
- Piliers + principe + 8 buckets définis dans `lib/content.ts`
- Bucket #8 "creative concepts" ajouté

### Phase 2 — Submission queue
- Drop bulk IG URL parser, like/refuse, commentaire inline
- Migration localStorage → Supabase pour partager entre clients

### Phase 3 — Releases + SoundCloud preview (2026-05-01)
- 3 releases concrètes ajoutées
- Embed iframe du set privé (URL avec `secret_token` query param plutôt que dans le path, sinon le widget refuse)

### Phase 4 — Thumbnails IG (2026-05-01)
- BucketCard : refs IG passent de liste de liens à grille de thumbnails carrés
- SubmissionQueue : chaque row a un thumbnail à gauche
- Mécanique : og:image fetch avec UA `facebookexternalhit` (UA desktop normal renvoie un app shell vide), proxy same-origin avec cache 24h

### Phase 5 — Calendrier de publication (2026-05-01)
- Section 06 : pool gauche (aimées-non-placées) + grille mois droite
- Drag-and-drop natif entre pool et jours, et entre jours
- Bucket picker compact sur les day cards, full sur les pool cards
- Production status pipeline 4 étapes (draft → shot → edited → posted) avec badges colorés
- Modal détail au click avec édition commentaire (debounced), changement de status/bucket, "retour pool"
- Reviewed submissions collapsées sous toggle dans la queue

### Phase 6 — Drops MN (2026-05-01)
- Section 07 : upload direct depuis device vers Supabase Storage
- Support vidéos *et* photos (détection par extension client-side)
- Player natif `<video>` ou `<img>` selon le type
- Review pipeline : pending / approved / changes_requested / rejected
- Commentaire planner avec auto-save 500ms

## Notes pour la prochaine session

- Vérifier que toutes les migrations 0002-0005 ont bien été appliquées par le user dans le SQL Editor — il y a eu des aller-retours là-dessus (statuts qui ne saved pas → 0004 manquait ; bucket not found → 0005 manquait).
- Si HEIC devient un problème récurrent dans les drops MN, regarder `heic-decode` ou un pipeline de conversion server-side via une route `/api/convert-image`.
- Le project Supabase **n'est pas dans l'organisation EEC-PIO** : le MCP Supabase de la session ne le voit pas. Toute migration future doit être appliquée manuellement par le user.
