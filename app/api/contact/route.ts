//
// Copyright 2024 ST-ARK
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { sanitizeString, validateEmail } from "@/lib/validation";

// Email-adressen är hårdkodad här men syns inte i klientkoden
const CONTACT_EMAIL = "a.h.froberg@gmail.com";

// Initiera Resend (fallback till mailto om API-nyckel saknas)
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Från-adress måste vara verifierad i Resend (eller använda Resend's domän)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export async function POST(request: Request) {
  try {
    // Rate limiting: max 5 requests per minut per IP
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`contact:${clientIp}`, 5, 60000); // 5 requests per minut
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "För många förfrågningar. Försök igen senare.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetTime / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const { name, email, message } = body;
    
    // Sanitera och validera input
    const sanitizedName = sanitizeString(name, 200);
    const sanitizedEmail = sanitizeString(email, 200);
    const sanitizedMessage = sanitizeString(message, 5000);

    // Validera input
    if (!sanitizedName || !sanitizedEmail || !sanitizedMessage) {
      return NextResponse.json(
        { error: "Alla fält måste fyllas i" },
        { status: 400 }
      );
    }

    // Validera email-format
    if (!validateEmail(sanitizedEmail)) {
      return NextResponse.json(
        { error: "Ogiltig e-postadress" },
        { status: 400 }
      );
    }

    // Skicka email via Resend om API-nyckel finns, annars fallback till mailto
    if (resend) {
      try {
        const emailSubject = `Kontakt från ST-ARK: ${sanitizedName}`;
        const emailBody = `Meddelande från: ${sanitizedName}\nE-post: ${sanitizedEmail}\n\nMeddelande:\n${sanitizedMessage}`;

        const result = await resend.emails.send({
          from: FROM_EMAIL,
          to: CONTACT_EMAIL,
          replyTo: sanitizedEmail,
          subject: emailSubject,
          text: emailBody,
        });

        if (result.error) {
          console.error("Resend error:", result.error);
          return NextResponse.json(
            { error: "Kunde inte skicka e-post. Försök igen senare." },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: "Meddelandet har skickats! Du får svar så snart som möjligt.",
        });
      } catch (error) {
        console.error("E-post skickande fel:", error);
        return NextResponse.json(
          { error: "Ett fel uppstod när meddelandet skulle skickas" },
          { status: 500 }
        );
      }
    } else {
      // Fallback till mailto om Resend inte är konfigurerat
      const subject = encodeURIComponent(`Kontakt från ST-ARK: ${sanitizedName}`);
      const bodyText = encodeURIComponent(
        `Meddelande från: ${sanitizedName}\nE-post: ${sanitizedEmail}\n\nMeddelande:\n${sanitizedMessage}`
      );
      const mailtoLink = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${bodyText}`;

      return NextResponse.json({
        success: true,
        mailtoLink,
        message: "Klicka på länken för att öppna din e-postklient",
      });
    }
  } catch (error) {
    console.error("Kontaktformulär fel:", error);
    return NextResponse.json(
      { error: "Ett fel uppstod när meddelandet skulle skickas" },
      { status: 500 }
    );
  }
}
