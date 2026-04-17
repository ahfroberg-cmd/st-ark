"use client";

export default function AiAgentInfoModal(props: {
  open: boolean;
  tab: "information" | "säkerhet";
  onTabChange: (tab: "information" | "säkerhet") => void;
  onClose: () => void;
}) {
  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-[97] flex items-center justify-center bg-black/50 p-4"
      onClick={props.onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="m-0 text-lg font-extrabold text-slate-900">Info om API-nyckel</h2>
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
            title="Stäng"
          >
            Stäng
          </button>
        </header>

        <nav className="flex gap-1 border-b border-slate-200 bg-slate-50 px-2 pt-2">
          {[
            {
              id: "information" as const,
              label: "Information",
              info: "Hur AI i appen kopplas till en språkmodell via API, vad en API-nyckel är och hur du skaffar en nyckel.",
            },
            {
              id: "säkerhet" as const,
              label: "Säkerhet",
              info: "Hur nyckeln skyddas lokalt, vilka risker som finns och ditt eget ansvar.",
            },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => props.onTabChange(t.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:outline-none ${
                props.tab === t.id
                  ? "-mb-px border-x border-t border-slate-200 bg-white text-slate-900"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
              data-info={t.info}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="max-h-[75vh] overflow-auto overscroll-contain p-4 text-sm leading-relaxed text-slate-700">
          {props.tab === "information" ? (
            <div className="space-y-4">
              <p>
                Genom att koppla en API-nyckel kan du använda <strong>AI-kraft i appen</strong> via en{" "}
                <strong>språkmodell</strong> (en så kallad LLM, <em>large language model</em>): AI-agenten skickar
                din fråga till leverantören och visar svaret i chatten, tillsammans med funktioner som bygger på
                samma anrop.
              </p>
              <p>
                <strong>API</strong> är en förkortning av engelska <em>Application Programming Interface</em>.
                På svenska brukar man säga <strong>programmeringsgränssnitt</strong> eller{" "}
                <strong>apigränssnitt</strong>: det är regler och adresser som låter ett program prata med en
                tjänst på internet.
              </p>
              <p>
                En <strong>API-nyckel</strong> (eng. <em>API key</em>) är en hemlig textsträng som visar för
                leverantören att anrop kommer från ditt konto. Den fungerar ungefär som ett lösenord som bara
                maskiner använder. I den här appen heter funktionen ofta <strong>BYOK</strong> (
                <em>bring your own key</em> — &quot;ta med din egen nyckel&quot;): du kopplar din egen nyckel
                från t.ex. OpenAI, Anthropic eller Google så att AI-anrop går direkt mellan din webbläsare och
                den leverantören.
              </p>
              <p>
                När du aktiverar AI-agenten i ST-ARK används nyckeln för att skicka din konversation till den
                modell du valt (t.ex. gpt-4o). Du betalar (eller använder kredit) enligt leverantörens
                prislista — inte via ST-ARK.
              </p>
              <p className="font-semibold text-slate-800">Hur skaffar man en nyckel?</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>OpenAI:</strong> skapa konto på OpenAI, gå till API-nycklar och skapa en ny nyckel.{" "}
                  <a
                    className="text-sky-700 underline"
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                  >
                    platform.openai.com/api-keys
                  </a>
                </li>
                <li>
                  <strong>Anthropic (Claude):</strong> logga in i Anthropic Console och skapa en nyckel under
                  inställningar.{" "}
                  <a
                    className="text-sky-700 underline"
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noreferrer"
                  >
                    console.anthropic.com/settings/keys
                  </a>
                </li>
                <li>
                  <strong>Google Gemini:</strong> skapa nyckel i Google AI Studio.{" "}
                  <a
                    className="text-sky-700 underline"
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                  >
                    aistudio.google.com/app/apikey
                  </a>
                </li>
              </ul>
              <p className="text-xs text-slate-600">
                Följ alltid leverantörens aktuella användarvillkor och instruktioner. Namn på menyer kan ändras
                något över tid.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p>
                ST-ARK lagrar <strong>inte</strong> din API-nyckel på våra servrar. När du sparar den i
                inställningarna krypteras den med ditt valda lösenord och skrivs endast till{" "}
                <strong>lokal lagring i din webbläsare</strong> (på din enhet). Upplåsning sker i minnet i
                webbläsaren när du anger lösenordet. Anrop till AI-leverantören går från din webbläsare över
                HTTPS; vår backend ser inte din nyckel i det flödet.
              </p>
              <p>
                Det innebär att <strong>säkerheten vid din dator och i din webbläsare är avgörande</strong>. Om
                någon får tillgång till en olåst session, din enhet, eller om skadlig kod läser webbläsarens
                minne eller lagring, kan en nyckel i värsta fall missbrukas. Samma risk gäller om du råkar
                läcka nyckeln (t.ex. skärmdump, mejl, osäkert nätverk).
              </p>
              <p className="font-semibold text-slate-800">Hur kan du skydda dig?</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Använd ett <strong>starkt, unikt lösenord</strong> som krypterar nyckeln lokalt.</li>
                <li>
                  <strong>Lås sessionen</strong> när du lämnar datorn så att nyckeln rensas ur minnet tills du
                  anger lösenordet igen.
                </li>
                <li>
                  <strong>Ta bort sparad nyckel</strong> från webbläsaren om enheten kan vara komprometterad.
                </li>
                <li>
                  Dela aldrig API-nyckeln i chatt, kod eller offentliga forum; återkalla den hos leverantören
                  om du misstänker läckage.
                </li>
                <li>
                  Håll koll på <strong>kostnad och användning</strong> hos leverantören — missbruk av en
                  stulen nyckel kan ge kostnader på ditt konto där.
                </li>
              </ul>
              <p>
                <strong>Eget ansvar:</strong> Genom att använda BYOK accepterar du att du är ansvarig för din
                API-nyckel, ditt konto hos AI-leverantören, val av modell, innehåll i promptar och eventuella
                kostnader eller användningsgränser där. ST-ARK tillhandahåller verktyget att lagra nyckeln
                lokalt och anropa tjänster; vi kan inte se eller återställa ditt lösenord eller din nyckel.
              </p>
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                Använd inte funktionen på delade eller övervakade datorer om du hanterar känslig
                patientinformation, om inte din arbetsgivare och patientdatalagen tillåter det och du följer
                lokala rutiner.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
