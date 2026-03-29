# Video Scout

Top-Videos eines TikTok-Creators nach Views sortiert anzeigen — mit Replicator zum Speichern.

## Live-Demo starten (5 Minuten)

### Schritt 1 — TikHub API Key holen (kostenlos)

1. Geh auf **https://tikhub.io**
2. Klick auf **Sign Up** (kein Kreditkarte nötig)
3. Nach Login: **Dashboard → API Keys → Create**
4. Den Key kopieren (sieht aus wie: `eyJhbGci...`)

### Schritt 2 — Auf GitHub pushen

```bash
# Einmalig: GitHub Repo anlegen unter github.com/new (Public oder Private)
git init
git add .
git commit -m "Video Scout init"
git remote add origin https://github.com/DEIN-USERNAME/video-scout.git
git push -u origin main
```

### Schritt 3 — Auf Vercel deployen (kostenlos)

1. Geh auf **https://vercel.com** → Login mit GitHub
2. **New Project** → dein `video-scout` Repo auswählen
3. Bei **Environment Variables** klicken und eintragen:
   - Name: `TIKHUB_API_KEY`
   - Value: `dein-key-von-schritt-1`
4. **Deploy** klicken
5. Fertig — Vercel gibt dir eine URL wie `video-scout-xyz.vercel.app`

---

## Lokal testen

```bash
npm install
cp .env.local.example .env.local
# TIKHUB_API_KEY in .env.local eintragen
npm run dev
# → http://localhost:3456
```

## Was kostet das?

| Was | Kosten |
|-----|--------|
| Vercel Hosting | **0 €** |
| TikHub Signup Credits | **0 €** (reichen für Wochen) |
| Danach pro Creator-Scan | ~**0,01 €** |

## Features

- TikTok Creator-URL oder @username eingeben → alle Videos nach Views sortiert
- Filter nach Mindest-Views (10K / 100K / 500K / 1M+)
- Caption-Suche
- Sort by Views / Likes / Comments / Recent
- **Replicator**: Top-Videos merken, im Browser gespeichert (kein Account nötig)
- Export als JSON
- Demo-Modus ohne API Key

