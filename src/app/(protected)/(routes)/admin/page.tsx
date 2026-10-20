import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";

// Minimal placeholder landing page for the protected area (post-login
// redirect target, see components/auth/signin-form.tsx). Replace with your
// project's real dashboard.
export default async function AdminDashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-wide">{t("title")}</h1>
        <p className="mt-1 text-base text-muted-foreground">{t("description")}</p>
      </div>
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">{t("empty.title")}</p>
            <p className="text-xs text-muted-foreground">{t("empty.description")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
