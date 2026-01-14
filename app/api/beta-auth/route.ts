// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

import { NextResponse } from "next/server";
import { sanitizeString } from "@/lib/validation";

// Lösenordet lagras i miljövariabel för säkerhet
const BETA_PASSWORD = process.env.BETA_PASSWORD || "st-ark-beta-2024";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    // Sanitera input
    const sanitizedPassword = sanitizeString(password, 100);

    if (!sanitizedPassword) {
      return NextResponse.json(
        { success: false, error: "Lösenord krävs" },
        { status: 400 }
      );
    }

    // Jämför lösenord (enkel jämförelse - för beta är detta tillräckligt)
    if (sanitizedPassword === BETA_PASSWORD) {
      return NextResponse.json({
        success: true,
        message: "Autentisering lyckades",
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Felaktigt lösenord" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Beta auth error:", error);
    return NextResponse.json(
      { success: false, error: "Ett fel uppstod" },
      { status: 500 }
    );
  }
}
