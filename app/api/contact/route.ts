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

// Email-adressen är hårdkodad här men syns inte i klientkoden
const CONTACT_EMAIL = "a.h.froberg@gmail.com";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, message } = body;

    // Validera input
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Alla fält måste fyllas i" },
        { status: 400 }
      );
    }

    // Validera email-format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Ogiltig e-postadress" },
        { status: 400 }
      );
    }

    // Skicka email via mailto-länk (enklaste lösningen utan extern mailtjänst)
    // I produktion skulle man använda en mailtjänst som SendGrid, Resend, etc.
    const subject = encodeURIComponent(`Kontakt från ST-ARK: ${name}`);
    const bodyText = encodeURIComponent(
      `Meddelande från: ${name}\nE-post: ${email}\n\nMeddelande:\n${message}`
    );
    const mailtoLink = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${bodyText}`;

    // För nu returnerar vi mailto-länken så att klienten kan öppna den
    // I framtiden kan man integrera en riktig mailtjänst här
    return NextResponse.json({
      success: true,
      mailtoLink,
      message: "Klicka på länken för att öppna din e-postklient",
    });
  } catch (error) {
    console.error("Kontaktformulär fel:", error);
    return NextResponse.json(
      { error: "Ett fel uppstod när meddelandet skulle skickas" },
      { status: 500 }
    );
  }
}
