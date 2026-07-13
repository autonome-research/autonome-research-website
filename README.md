# Autonome Research website

Static Vite website for [autonomeresearch.com](https://autonomeresearch.com), deployed to GitHub Pages. Blog and research content are authored in Markdown and may be edited through Pages CMS.

## Local development

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Vite prints the local URL. Content pages are generated before the development server starts.

Production validation:

```bash
npm run check     # sanitizer tests, generation, Vite build, internal-link validation
npm run preview   # preview dist/ after a build
```

## Content publishing

Markdown is the source of truth. Do not edit generated files under `blog/<slug>/` or `research/<slug>/`; `npm run generate` recreates them and removes stale generated routes.

### Pages CMS

1. Sign in at [pagescms.org](https://pagescms.org) with an authorized GitHub account.
2. Open `autonome-research/autonome-research-website`.
3. Choose **Blog posts** or **Research fields**.
4. Leave **Published** disabled while drafting.
5. Save edits, then enable **Published** when ready.
6. Pages CMS commits the Markdown to `main`; GitHub Actions validates and deploys it.

The CMS schema is in `.pages.yml`. Uploads belong in `public/uploads/` and are referenced as `/uploads/<file>`.

### Blog schema

Files live in `content/blog/<slug>.md` and require `title`, `articleTitle`, `slug`, `date` (`YYYY-MM-DD`), `summary`, and boolean `published` fields.

### Research schema

Files live in `content/research/<slug>.md` and require `title`, `slug`, `field`, unique integer `order`, `summary`, and boolean `published`. `status` is optional.

The build rejects malformed dates or slugs, duplicate routes or research ordering, unsafe Markdown HTML, missing assets, and broken internal links. Diagnostics identify the source file or emitted asset.

## Generated outputs

`npm run generate` creates:

- Blog and research indexes and detail pages
- `public/feed.xml`
- `public/sitemap.xml`
- `public/robots.txt`
- `.generated-content.json`, which limits stale-page cleanup to generator-owned routes

Generated detail HTML is committed currently so routes can be reviewed in pull requests, but Markdown remains authoritative.

## Deployment

`.github/workflows/deploy-pages.yml` runs `npm ci`, `npm run check`, and deploys `dist/`. Verify a deployment in the repository's **Actions** and **Settings → Pages** views, then check the home page, one article, `/feed.xml`, `/sitemap.xml`, and `/404.html`.

### Rollback

Revert the problematic commit on `main` and push the revert. The workflow redeploys the previous content. Do not rewrite shared history. If deployment itself fails, inspect the Actions log, reproduce with `npm ci && npm run check`, and repair before rerunning the workflow.

### Domain operations

DNS is externally owned in Squarespace Domains and email is managed by Google Workspace. Repository maintenance must not change DNS, MX, SPF, DKIM, DMARC, domain registration, GitHub organization settings, or other external accounts. Observe DNS with `dig` and Pages certificate state through GitHub; escalate account-level changes to a domain administrator. The production CNAME is stored in `public/CNAME`.

## Theme and accessibility

The initial theme follows a saved choice or the device preference before paint. Navigation and theme controls support keyboards, visible focus, Escape dismissal, and reduced-motion preferences.
