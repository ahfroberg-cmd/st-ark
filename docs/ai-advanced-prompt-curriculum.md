# AI Advanced Prompt Curriculum

This prompt bank is used to harden the agent for advanced real-world orchestration.
The runtime prompt now includes:

- 100 advanced prompts
- 100 middle-layer prompts (between micro-actions and broad blocks)

## Strategy

- Prefer micro-maneuvers for precision (`select_*`, `update_selected_*`, `save_selected_*`, `open_window`, `set_iup_tab`).
- Use broad blocks for large restructuring (`plan_*`, `shift_*`, `sync_*`).
- Chain actions in phases: analyze -> draft -> apply -> verify -> adjust.
- Never handle contact information (phone, email, address, personal id).

## Advanced Prompt Set (Representative)

1. "Inspireras av kollegorna och planera hela min ST med mer tyngd på psykos."
2. "Lägg en komplett ST-plan från SR-mallar men gör kurserna jämnare över hela perioden."
3. "Planera om allt så jag får två kurser per termin och inga luckor i delmål."
4. "Flytta alla kurser en månad framåt och behåll samma balans per halvår."
5. "Ta bort den valda kursen och ersätt den med suicidologi i samma termin."
6. "Byt sista Journal club till en kurs i suicidologi och spara."
7. "Analysera delmålskatalogen och täck allt med cirka tio kurser."
8. "Gör en mjuk omplanering: först analysera, sen justera stegvis utan stora hopp."
9. "Skapa ny klinisk placering och koppla rimliga delmål, sedan spara."
10. "Rensa valda placeringen och lägg in ny mellan samma datum."
11. "Planera kurser månadsvis under nästa år men behåll totalt antal."
12. "Öppna IUP delmål och visa vad som saknas för kurser."
13. "Kör SR-mallar och justera sedan kursfrekvens till två per halvår."
14. "Planera hela ST från början men prioritera akuta områden tidigt."
15. "Gör en defensiv plan där du verifierar efter varje större steg."
16. "Skanna hela appen, föreslå bästa nästa plansteg och kör första steget."
17. "Ta bort kursen som börjar i april 2027 och skapa ersättningskurs i maj."
18. "Flytta allt bakåt två månader om tidslinjen blir för tät."
19. "Gör om kursen i maj till utbildningsmoment med ny beskrivning."
20. "Synka alla kurser så de får rätt delmål direkt."
21. "Planera flera kurser men med extra tyngd på suicidologi och neuropsykiatri."
22. "Skapa en balanserad plan med två kurser per halvår och kontrollera målmatchning."
23. "Lägg in SR-bas först, därefter målstyrda METIS-kurser."
24. "Optimera kurser för delmålstäckning utan att skapa överlapp."
25. "Öppna rapport, sedan profil, och återgå till kursfil."
26. "Flytta bara kurserna framåt och håll placeringar oförändrade."
27. "Om något krockar, gör om planen med mindre steg och försök igen."
28. "Kombinera kolleginspiration med målbild och skapa en realistisk slutplan."
29. "Jämna ut alla kurser över år istället för termin."
30. "Bygg en plan i tre faser: grund, fördjupning, repetition."
31. "Förstärk fokus på psykos i första halvan och beroende i andra halvan."
32. "Ta bort vald placering, skapa ny placering och spara."
33. "Planera målstyrt men med lägre frekvens första året."
34. "Skapa tätare kurspaket inför specialistansökan."
35. "Kör en snabb baseline-plan och förbättra sedan med delmålskontroll."
36. "Planera om med hänsyn till tidigare kurshistorik."
37. "Sätt upp en robust plan med fallback om ett steg misslyckas."
38. "Justera enstaka kurs manuellt men behåll global fördelning."
39. "Börja i IUP delmål, återgå till kurs och korrigera luckor."
40. "Ta fram en helhetsplan inspirerad av toppkollegor, men anpassad till mig."

## Full 100 + 100 Source

The full generated banks are defined in:

- `lib/ai/promptCurriculum.ts`
  - `ADVANCED_PROMPT_BANK_100`
  - `MIDDLE_ACTION_PROMPT_BANK_100`

## Execution Patterns

- Pattern A (Global): `summarize_*` -> `plan_*` -> `plan_timeline_distribution` -> `sync_course_milestones`
- Pattern B (Surgical): `select_*` -> `update_selected_*` -> `save_selected_*`
- Pattern C (Replace): `delete_selected_*` -> `create_*_from_range`
- Pattern D (Recovery): run failed plan remainder with alternative ordering
