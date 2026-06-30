import "server-only";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import ConversationsPageContent from "@/features/whatsapp-inbox/components/conversations-page-content";

/**
 * Control Tower › WhatsApp Conversations (Phase 2a). The unified inbox over the active org's
 * WhatsApp message pool: driver replies + delivery status, polled near-real-time. Data flows
 * client SWR → Next proxy routes → Quarkus /api/v1/orgs/{org}/whatsapp/conversations*.
 */
export default async function WhatsAppConversationsPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const dict = (dictionary.conversations as I18nRecord) ?? {};

  return (
    <RouteGuard requiredGroups={[]} fallbackPath={`/${lang}/shipping`}>
      <ConversationsPageContent dict={dict} locale={lang} />
    </RouteGuard>
  );
}
