# OCR.space (server-side) – konfiguration

Av säkerhetsskäl ska API-nyckeln **inte** hårdkodas i koden och **inte** committas i git.

## Lokal utveckling (Next.js)

Skapa en fil `.env.local` i projektroten med:

```
OCR_SPACE_API_KEY=DIN_NYCKEL_HÄR
```

Starta om dev-servern efter ändring av miljövariabler.

## Vercel (production)

1. Gå till **Project Settings → Environment Variables**
2. Lägg till:
   - **Name**: `OCR_SPACE_API_KEY`
   - **Value**: din nyckel
   - **Environment**: Production (och ev. Preview/Development om du vill)
3. Deploya om (ny env laddas vid build).

## Hur det används i appen

Klienten anropar `POST /api/ocr-space` och servern vidarebefordrar bilden till OCR.space med nyckeln från `OCR_SPACE_API_KEY`.


