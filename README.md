# iDermaCare

React storefront for **iDermaCare** — authentic SADOER, Hero Mighty Patch and SOME BY MI skincare in Pakistan. Live at https://idermacare.com.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase URL and anon key
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## What is included

- Storefront: home, shop, product pages, gallery, blog, order tracking, cart and checkout (cash on delivery, WhatsApp confirmation).
- Admin at `/admin`: products, orders, customers, inventory, promotions, and a content editor for storefront text and photos.
- Supabase backend: tables and row-level security in `supabase/migrations`, the `orders` Edge Function in `supabase/functions`.
- SEO: every public page is pre-rendered at build time with its own title, description, canonical link, social tags and structured data; `sitemap.xml` and `robots.txt` are generated.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Build to `dist/` (also writes the sitemap and pre-rendered pages) |
| `npm test` | Unit tests |
| `npm run e2e` | Browser tests (Playwright) |
| `npm run db:deploy-functions` | Deploy the Supabase Edge Functions |

## Deploy

Upload the contents of `dist/` to `public_html` on Hostinger. `public/.htaccess` is included in the build and handles redirects (www and http to https), app routes, and the 404 page.
