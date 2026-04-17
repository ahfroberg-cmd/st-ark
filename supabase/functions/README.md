# Supabase Edge Functions

## Setup

1. Installera Supabase CLI:
```bash
npm install -g supabase
```

2. Logga in på Supabase:
```bash
supabase login
```

3. Länka projektet (om inte redan gjort):
```bash
supabase link --project-ref <your-project-ref>
```

## Deploy Edge Function

För att deploya `send-invitation-email` funktionen:

```bash
supabase functions deploy send-invitation-email
```

## Sätt miljövariabler

Edge Functions behöver tillgång till Resend API-nyckel:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
supabase secrets set RESEND_FROM_EMAIL=din-email@din-domän.se
```

Eller använd `onboarding@resend.dev` för testning:
```bash
supabase secrets set RESEND_FROM_EMAIL=onboarding@resend.dev
```

## Testa lokalt

```bash
supabase functions serve send-invitation-email --env-file .env.local
```

## Funktioner

### send-invitation-email

Skickar inbjudningsmail via Resend när en superadmin bjuder in en användare till en klinik.

**Input:**
- `email`: Mottagarens email
- `clinicName`: Klinikens namn
- `role`: Användarens roll (studierektor, huvudhandledare, st_lakare)
- `inviteLink`: Länk till accept-invite sidan
- `existingUser`: Boolean om användaren redan finns

**Output:**
- `success`: Boolean
- `messageId`: Resend message ID
