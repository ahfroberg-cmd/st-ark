"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import PusslaDinST from "@/components/PusslaDinST";

export default function PlaneraSTPage() {
  const params = useSearchParams();
  const startParam = params.get("start");
  const startYear = startParam ? Number(startParam) : undefined;
  const initialStartYear =
    Number.isFinite(startYear) && startYear! >= 1990 && startYear! <= 2100
      ? (startYear as number)
      : undefined;

  return (
    <main className="p-4 md:p-6">
      <PusslaDinST initialStartYear={initialStartYear} />
    </main>
  );
}