
# Rapid Social Dashboard

A static, single-page dashboard that bundles your JSON datasets (Instagram, YouTube, Facebook, TikTok, Twitter) and renders:
- Summary cards by platform
- Engagement-by-platform bar chart
- Top posts table

## Run locally

Just open `index.html` in a browser. (Because data is inlined via `data.js`, no local server is required.)

## Quick deploy (pick one)

### Netlify (drag & drop)
1. Go to https://app.netlify.com/drop
2. Drag the whole folder to deploy instantly.

### Vercel
1. `vercel deploy` in this folder (if you have Vercel CLI), or
2. Create a new project in Vercel Dashboard and import this folder.

### GitHub Pages
1. Create a repo, commit this folder.
2. Enable **Pages** → **Deploy from branch** → `main` → `/`.
3. Your dashboard will be available at `https://<user>.github.io/<repo>/`.

## Files
- `index.html`: UI + layout (Tailwind + Chart.js via CDN)
- `data.js`: Bundled JSON data (auto-generated)
- `app.js`: Normalization, charting, table rendering

# social-dashboard
