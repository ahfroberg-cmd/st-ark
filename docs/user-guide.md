# ST-ARK Användarguide

## Innehåll

1. [Komma igång](#komma-igång)
2. [Profil](#profil)
3. [Tidslinje – Pussla din ST](#tidslinje--pussla-din-st)
4. [Aktiviteter](#aktiviteter)
5. [Kurser](#kurser)
6. [Delmål](#delmål)
7. [Attestering](#attestering)
8. [Kommentarer](#kommentarer)
9. [Filter och sökning](#filter-och-sökning)
10. [Backup – Spara och Importera](#backup--spara-och-importera)
11. [GDPR – Persondata](#gdpr--persondata)
12. [Intyg och export](#intyg-och-export)
13. [IUP (Individuell utbildningsplan)](#iup)
14. [Specialistansökan](#specialistansökan)
15. [Studierektor-vy](#studierektor-vy)

---

## Komma igång

1. Navigera till ST-ARK i din webbläsare.
2. Ange beta-lösenordet om du uppmanas.
3. Fyll i din profil (namn, specialitet, startdatum, målversion 2015/2021).
4. Du skickas vidare till **Pussla din ST** – huvudvyn.

> All data sparas lokalt i din webbläsare (IndexedDB). Ingen data skickas till en server om du inte explicit exporterar den.

---

## Profil

Öppna profilen via **Profil**-knappen i verktygsfältet.

- **Namn** och **Specialitet** – obligatoriska fält.
- **Målversion** – välj 2015 eller 2021 (påverkar vilka delmål som visas).
- **BT-startdatum** (2021) / **ST-startdatum** (2015) – används för att beräkna tidslinjen.
- **Slutdatum för BT** – kan anges manuellt, annars beräknas det till 24 månader efter BT-start.
- **Handledare** – namn och kontaktuppgifter till din huvudhandledare.

---

## Tidslinje – Pussla din ST

Huvudvyn visar en horisontell tidslinje med alla dina aktiviteter och kurser.

- **Övre spåret** – klinisk tjänstgöring, vetenskapligt arbete, ledighet m.m.
- **Undre spåret** – kurser.
- **Röd linje** – beräknat slutdatum baserat på din faktiska tjänstgöring.
- **Gröna trianglar** – handledningstillfällen (om aktiverade).

### Skapa aktivitet

Klicka i det övre spåret på det datum du vill lägga till en aktivitet.

### Skapa kurs

Klicka i det undre spåret på det datum du vill lägga till en kurs.

---

## Aktiviteter

Varje aktivitet har följande fält:

- **Typ** – Klinisk tjänstgöring, Auskultation, Vetenskapligt arbete, Förbättringsarbete, Forskning, Föräldraledighet, Sjukskrivning, Annan ledighet.
- **Platsnamn/Beskrivning** – fri text.
- **Start- och slutdatum** – väljs med datumväljaren.
- **Sysselsättningsgrad (%)** – hur stor del av heltid.
- **Handledare** – namn, specialitet och tjänsteställe (visas inte för ledigheter).
- **Delmål** – vilka BT-/ST-delmål som uppfylls.

Klicka på en aktivitet i listan eller tidslinjen för att öppna detaljvyn.

---

## Kurser

Varje kurs har:

- **Kursnamn** – väljs från METIS-lista (psykiatri) eller fri text.
- **Kursledare** – namn.
- **Start- och slutdatum**.
- **Intygsdatum** – datum för kursintyg.
- **Delmål** – vilka BT-/ST-delmål som uppfylls.

---

## Delmål

### BT-delmål (2021)

18 delmål som ska uppfyllas under bastjänstgöringen.

### ST-delmål

Specialitetsspecifika delmål. Varje delmål kan ha krav på:

- **Klinisk tjänstgöring/arbete** – uppfylls genom placeringar.
- **Kurs** – uppfylls genom kurser.

### Delmålssammanfattning

Under aktivitets- och kurslistorna visas en kompakt sammanfattning med:

- Progressbar för BT (om 2021) och ST.
- Antal uppfyllda / totalt antal.
- Antal återstående delmål.

---

## Attestering

Handledare eller studierektor kan attestera (godkänna) aktiviteter och kurser.

### Attestera

1. Öppna en aktivitet eller kurs i detaljvyn.
2. Klicka **Attestera**.
3. Ange namn på den som attesterar.
4. Aktiviteten markeras med en grön "Attesterad av"-badge.

### Återkalla attestering

1. Klicka **Återkalla** bredvid attesteringsbadgen.
2. Bekräfta i dialogen.
3. En gul badge visar att attesteringen har återkallats.

> Attestering sparas med aktiviteten/kursen och inkluderas i JSON-backup.

---

## Kommentarer

Varje aktivitet och kurs har en kommentarssektion.

1. Expandera **Kommentarer (N)** under attesteringen.
2. Skriv en kommentar i textfältet.
3. Tryck **Enter** för att spara.

Kommentarer visar författare, datum och eventuell roll.

---

## Filter och sökning

Både aktivitetslistan och kurslistan har ett sökfält i rubriken.

- **Aktiviteter** – söker i platsnamn, typ, beskrivning, handledare.
- **Kurser** – söker i kursnamn, anteckning, stad, kursledare.

Skriv i sökfältet för att filtrera listan i realtid.

---

## Backup – Spara och Importera

### Spara backup

1. Klicka på **Spara**-knappen (diskett-ikon) eller tryck **Cmd/Ctrl + Enter**.
2. En `.json`-fil laddas ner med all din data.

### Importera backup

1. Klicka **Öppna sparad fil** och välj en `.json`-backup.
2. Data importeras och ersätter/sammanfogas med befintlig data.

> Alla ändringar loggas i en intern audit-logg för spårbarhet.

---

## GDPR – Persondata

I profilsidan finns GDPR-funktioner längst ned:

### Exportera mina data

Klicka **Exportera mina data** för att ladda ner en JSON-fil med all persondata som lagras i appen.

### Radera all min data

1. Klicka **Radera all min data**.
2. Bekräfta genom att skriva "RADERA" i dialogrutan.
3. All data i IndexedDB raderas permanent.

> **Varning:** Radering kan inte ångras. Säkerhetskopiera först om du vill behålla data.

---

## Intyg och export

Dubbelklicka på en aktivitet i listan för att generera intyg:

- **Delmål i BT** – för BT-fasade aktiviteter.
- **Tjänstgöringsintyg** – för ST-aktiviteter.
- **STA3-intyg** – specialistintyg.

Intyg genereras som PDF baserat på profildata och aktivitetens delmål.

---

## IUP

Klicka **IUP** i verktygsfältet för att öppna din Individuella Utbildningsplan.

Flikar:
- **Handledning** – handledningstillfällen.
- **Progression** – progressionsöversikt.
- **Planering** – framtida planering.
- **Delmål** – delmålsöversikt.
- **Rapport** – sammanfattande rapport.

---

## Specialistansökan

Klicka **Specialistansökan** för att sammanställa din ansökan om specialistkompetens. Alla aktiviteter, kurser och delmål sammanfattas i ett formulär.

---

## Studierektor-vy

Nås via `/studierektor`. Här kan studierektorer:

- Se och hantera sina ST-läkare.
- Importera/exportera studentdata.
- Granska tidslinjer och delmålsuppfyllnad.

---

## Teknisk information

- **Datalagring** – IndexedDB via Dexie.js, helt klientsida.
- **Säkerhet** – Security headers (X-Frame-Options, HSTS, CSP-liknande), betaskydd.
- **PWA** – Appen kan installeras som Progressive Web App.
- **Audit-logg** – Alla CRUD-operationer loggas lokalt i IndexedDB.
