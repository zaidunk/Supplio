import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { BusinessSettingsForm } from "@/components/settings/business-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";
import { getActiveAiSettings, getBusinessSettings } from "@/lib/settings/service";

export default async function SettingsPage() {
  const business = await requireBusiness();
  const [settings, ai] = await Promise.all([
    getBusinessSettings(prisma, business.id),
    getActiveAiSettings(prisma, business.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-extrabold tracking-[-0.03em] text-blue-700">Pengaturan</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pengadaan</CardTitle>
          <CardDescription>
            Restock dan permintaan penawaran berjalan otomatis; tidak ada persetujuan untuk memulainya. Anda hanya
            memberi persetujuan akhir atas rekomendasi pembelian. Request kedaluwarsa dalam{" "}
            {getServerEnv().PROCUREMENT_REQUEST_EXPIRY_HOURS} jam (diatur di environment).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessSettingsForm
            defaultRestockBudget={settings.defaultRestockBudget}
            responseTimeoutMinutes={settings.responseTimeoutMinutes}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personalisasi AI</CardTitle>
        </CardHeader>
        <CardContent>
          <AiSettingsForm
            version={ai.version}
            communicationTone={ai.communicationTone}
            negotiationStyle={ai.negotiationStyle}
            customInstructions={ai.customInstructions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
