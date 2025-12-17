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
