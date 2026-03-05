import { Suspense } from "react";
import SoloPageClient from "./SoloPageClient";

export default function SoloPage() {
  return (
    <Suspense fallback={<main className="h-screen flex flex-col p-3 overflow-hidden" />}>
      <SoloPageClient />
    </Suspense>
  );
}
