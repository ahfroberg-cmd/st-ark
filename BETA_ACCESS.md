# Beta-tillgång och lösenord

## Lösenord för testning

Standardlösenordet är: `st-ark-beta-2024`

## Ändra lösenord

För att ändra lösenordet:

1. Öppna `.env.local` i projektets rotkatalog
2. Ändra värdet för `BETA_PASSWORD`:
   ```
   BETA_PASSWORD=ditt-nya-lösenord
   ```
3. Starta om utvecklingsservern

## För produktion

När du deployar till produktion (Vercel/Netlify/etc.):

1. Lägg till `BETA_PASSWORD` som miljövariabel i din hosting-plattform
2. Använd ett starkt lösenord för produktion

## Hur det fungerar

- Användare måste logga in med lösenordet för att komma åt applikationen
- Autentisering sparas i `sessionStorage` (gäller tills webbläsaren stängs)
- Om användaren stänger webbläsaren måste de logga in igen
- Lösenordet valideras på servern för säkerhet

## Ta bort beta-skydd

När applikationen är klar för allmän användning:

1. Ta bort `<BetaGuard>` från `app/layout.tsx`
2. Ta bort beta-login-sidan (`app/beta-login/`)
3. Ta bort API-route (`app/api/beta-auth/`)
4. Ta bort BetaGuard-komponenten (`components/BetaGuard.tsx`)
