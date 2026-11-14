import { PageHeader } from "@/components/page-header";
import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { BusinessSettingsForm } from "@/components/settings/business-settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireBusiness } from "@/lib/auth/current-business";
import { prisma } from "@/lib/db/prisma";
import { getActiveAiSettings, getBusinessSettings } from "@/lib/settings/service";

export default async function SettingsPage() {
  const business = await requireBusiness();
  const [settings, ai] = await Promise.all([
    getBusinessSettings(prisma, business.id),
    getActiveAiSettings(prisma, business.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Pengaturan" />

      <Card>
        <CardHeader>
          <CardTitle>Procurement</CardTitle>
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
