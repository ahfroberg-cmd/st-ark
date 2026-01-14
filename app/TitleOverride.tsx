// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { useEffect } from "react";

export function TitleOverride() {
  useEffect(() => {
    // Sätt alltid fliktiteln till ST-ARK på klienten
    document.title = "ST-ARK";
  }, []);

  return null;
}
