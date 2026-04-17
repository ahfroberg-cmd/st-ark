// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { email, clinicName, role, inviteLink, existingUser } = await req.json()

    if (!email || !clinicName || !role || !inviteLink) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const roleText = role === "studierektor" ? "Studierektor" 
      : role === "huvudhandledare" ? "Huvudhandledare" 
      : "ST-läkare"

    const emailSubject = `Inbjudan till ${clinicName} på ST-ARK`
    
    let emailHtml = ''
    let emailText = ''

    if (existingUser) {
      emailHtml = `
        <h2>Du har blivit inbjuden till ${clinicName}!</h2>
        <p>Du har blivit inbjuden att gå med i <strong>${clinicName}</strong> som <strong>${roleText}</strong> på ST-ARK.</p>
        <p>Eftersom du redan har ett konto hos oss behöver du bara klicka på länken nedan för att acceptera inbjudan:</p>
        <p><a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Acceptera inbjudan</a></p>
        <p>När du klickar på länken kommer du till inloggningssidan. Efter inloggning kommer du automatiskt till rätt sida baserat på din roll.</p>
        <p>Länken är giltig i 7 dagar.</p>
        <p>Om du inte begärde denna inbjudan kan du ignorera detta mail.</p>
        <hr>
        <p style="color: #64748b; font-size: 12px;">Detta mail skickades från ST-ARK</p>
      `
      emailText = `Du har blivit inbjuden till ${clinicName}!\n\nDu har blivit inbjuden att gå med i ${clinicName} som ${roleText} på ST-ARK.\n\nEftersom du redan har ett konto hos oss behöver du bara klicka på länken nedan för att acceptera inbjudan:\n\n${inviteLink}\n\nNär du klickar på länken kommer du till inloggningssidan. Efter inloggning kommer du automatiskt till rätt sida baserat på din roll.\n\nLänken är giltig i 7 dagar.\n\nOm du inte begärde denna inbjudan kan du ignorera detta mail.`
    } else {
      emailHtml = `
        <h2>Välkommen till ST-ARK!</h2>
        <p>Du har blivit inbjuden att gå med i <strong>${clinicName}</strong> som <strong>${roleText}</strong> på ST-ARK.</p>
        <p>För att komma igång behöver du skapa ett konto. Klicka på länken nedan:</p>
        <p><a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Skapa konto och acceptera inbjudan</a></p>
        <p>När du klickar på länken kommer du till registreringssidan där din e-postadress redan är ifylld. Efter att du skapat ditt konto och verifierat din e-post kommer du automatiskt till rätt sida baserat på din roll (${roleText}).</p>
        <p>Länken är giltig i 7 dagar.</p>
        <p>Om du inte begärde denna inbjudan kan du ignorera detta mail.</p>
        <hr>
        <p style="color: #64748b; font-size: 12px;">Detta mail skickades från ST-ARK</p>
      `
      emailText = `Välkommen till ST-ARK!\n\nDu har blivit inbjuden att gå med i ${clinicName} som ${roleText} på ST-ARK.\n\nFör att komma igång behöver du skapa ett konto. Klicka på länken nedan:\n\n${inviteLink}\n\nNär du klickar på länken kommer du till registreringssidan där din e-postadress redan är ifylld. Efter att du skapat ditt konto och verifierat din e-post kommer du automatiskt till rätt sida baserat på din roll (${roleText}).\n\nLänken är giltig i 7 dagar.\n\nOm du inte begärde denna inbjudan kan du ignorera detta mail.`
    }

    // Send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev',
        to: [email],
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      console.error('Resend error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: error }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const data = await res.json()

    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        } 
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
