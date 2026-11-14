import type { Metadata } from "next";
import { MascotGuide } from "@/components/mascot/mascot-guide";
import LandingExperience from "./landing-experience";
import { LANDING_MASCOT_SECTIONS } from "./landing-mascot";

export const metadata: Metadata = {
  title: "Supplio",
  description:
    "Supplio memantau stok, meminta penawaran supplier lewat Telegram, lalu membandingkan biaya agar Anda dapat menyetujui pembelian dengan jelas.",
};

export default function LandingPage() {
  return (
    <>
      <LandingExperience />
      <MascotGuide sections={LANDING_MASCOT_SECTIONS} />
    </>
  );
}
