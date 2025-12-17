# Instruktioner för att sätta upp Resend (Server-side E-post)

## Steg 1: Skapa ett Resend-konto

1. Gå till [resend.com](https://resend.com)
2. Klicka på "Sign Up" och skapa ett konto
3. Verifiera din e-postadress

## Steg 2: Hämta API-nyckel

1. Logga in på Resend
2. Gå till "API Keys" i menyn
3. Klicka på "Create API Key"
4. Ge nyckeln ett namn (t.ex. "ST-ARK Production")
5. Kopiera API-nyckeln (den visas bara en gång!)

## Steg 3: Verifiera din domän (valfritt men rekommenderat)

För produktion bör du verifiera din egen domän:

1. Gå till "Domains" i Resend
2. Klicka på "Add Domain"
3. Följ instruktionerna för att lägga till DNS-poster
4. När domänen är verifierad kan du använda e-postadresser som `noreply@din-domän.se`

**OBS:** Om du inte verifierar en domän kan du använda `onboarding@resend.dev` för testning, men detta är begränsat.

## Steg 4: Lägg till miljövariabler

### För lokal utveckling:

1. Skapa eller öppna filen `.env.local` i projektets rotkatalog
2. Lägg till följande rader:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=din-email@din-domän.se
```

**OBS:** Om du inte har verifierat en domän ännu, använd:
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev
```

### För produktion (Vercel/Netlify/etc.):

1. Logga in på din hosting-plattform
2. Gå till projektets inställningar
3. Hitta "Environment Variables" eller "Miljövariabler"
4. Lägg till:
   - `RESEND_API_KEY` = din API-nyckel från Resend
   - `RESEND_FROM_EMAIL` = din verifierade e-postadress

## Steg 5: Testa

1. Starta om din utvecklingsserver (`npm run dev`)
2. Gå till kontaktformuläret i applikationen
3. Fyll i formuläret och skicka
4. Kontrollera att du får e-postmeddelandet

## Felsökning

### E-post skickas inte

1. Kontrollera att `RESEND_API_KEY` är korrekt i `.env.local`
2. Kontrollera Resend-dashboard för eventuella fel
3. Kontrollera konsolen i webbläsaren för felmeddelanden

### "Invalid API key"

- Kontrollera att API-nyckeln är korrekt kopierad (inga extra mellanslag)
- Se till att API-nyckeln inte har gått ut eller blivit raderad i Resend

### "Domain not verified"

- Om du använder din egen domän måste den vara verifierad i Resend
- Använd `onboarding@resend.dev` för testning om du inte har verifierat en domän

## Kostnad

- **Gratis nivå:** 3,000 e-post per månad
- **Betalda planer:** Börjar från $20/månad för 50,000 e-post

För de flesta applikationer räcker den gratis nivån gott och väl!

## Ytterligare information

- [Resend Dokumentation](https://resend.com/docs)
- [Resend API Referens](https://resend.com/docs/api-reference)
