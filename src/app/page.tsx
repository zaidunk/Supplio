import type { Metadata } from "next";
import LandingExperience from "./landing-experience";

export const metadata: Metadata = {
  title: "Supplio — Restock dan penawaran supplier untuk UMKM",
  description:
    "Supplio memantau stok, meminta penawaran supplier lewat Telegram, lalu membandingkan biaya agar Anda dapat menyetujui pembelian dengan jelas.",
};

export default function LandingPage() {
  return <LandingExperience />;
}
