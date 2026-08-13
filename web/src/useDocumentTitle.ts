import { useEffect } from "react";
import { useAuth } from "./auth";
import { useT } from "./i18n";

/** Browser tab: `<org> | <page>` (falls back to the app name if org is unknown). */
export function useDocumentTitle(page?: string | null) {
  const { org } = useAuth();
  const t = useT();
  const orgName = org?.name?.trim() || t("app.name");
  const suffix = page?.trim();
  const title = suffix ? `${orgName} | ${suffix}` : orgName;

  useEffect(() => {
    document.title = title;
  }, [title]);
}
