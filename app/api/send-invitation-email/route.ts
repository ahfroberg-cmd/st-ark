import { NextResponse } from "next/server";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

type InvitationRole = "studierektor" | "huvudhandledare" | "st_lakare";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, clinicName, role, inviteLink, existingUser } = body as {
      email?: string;
      clinicName?: string;
      role?: InvitationRole;
      inviteLink?: string;
      existingUser?: boolean;
    };

    if (!email || !clinicName || !role || !inviteLink) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!resend) {
      return NextResponse.json(
        { error: "RESEND_API_KEY saknas på servern." },
        { status: 500 }
      );
    }

    const roleText =
      role === "studierektor"
        ? "Studierektor"
        : role === "huvudhandledare"
          ? "Huvudhandledare"
          : "ST-läkare";

    const subject = `Inbjudan till ${clinicName} på ST-ARK`;

    const html = existingUser
      ? `
        <h2>Du har blivit inbjuden till ${clinicName}!</h2>
        <p>Du har blivit inbjuden att gå med i <strong>${clinicName}</strong> som <strong>${roleText}</strong> på ST-ARK.</p>
        <p>Eftersom du redan har ett konto hos oss behöver du bara klicka på länken nedan för att acceptera inbjudan:</p>
        <p><a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Acceptera inbjudan</a></p>
        <p>När du klickar på länken kommer du till inloggningssidan. Efter inloggning kommer du automatiskt till rätt sida baserat på din roll.</p>
        <p>Länken är giltig i 7 dagar.</p>
        <p>Om du inte begärde denna inbjudan kan du ignorera detta mail.</p>
      `
      : `
        <h2>Välkommen till ST-ARK!</h2>
        <p>Du har blivit inbjuden att gå med i <strong>${clinicName}</strong> som <strong>${roleText}</strong> på ST-ARK.</p>
        <p>För att komma igång behöver du skapa ett konto. Klicka på länken nedan:</p>
        <p><a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Skapa konto och acceptera inbjudan</a></p>
        <p>När du klickar på länken kommer du till registreringssidan där din e-postadress redan är ifylld. Efter att du skapat ditt konto och verifierat din e-post kommer du automatiskt till rätt sida baserat på din roll (${roleText}).</p>
        <p>Länken är giltig i 7 dagar.</p>
        <p>Om du inte begärde denna inbjudan kan du ignorera detta mail.</p>
      `;

    const text = existingUser
      ? `Du har blivit inbjuden till ${clinicName}.\n\nDu har blivit inbjuden att gå med som ${roleText} på ST-ARK.\n\nAcceptera inbjudan här:\n${inviteLink}`
      : `Välkommen till ST-ARK.\n\nDu har blivit inbjuden att gå med i ${clinicName} som ${roleText}.\n\nSkapa konto och acceptera inbjudan här:\n${inviteLink}`;

    const result = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject,
      html,
      text,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, messageId: result.data?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
