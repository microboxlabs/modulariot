import "server-only";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import { RouteGuard } from "@/features/auth/components/route-guard";
import PlacesPageContent from "@/features/settings-admin/components/places-page-content";

/**
 * Settings › Lugares de interés (PT4-b2).
 *
 * F3 portado del laboratorio: el mapa es la pantalla — lugares (círculo,
 * con proyección automática a geofences), categorías y trayectos. Para
 * orgs carrier: capa global read-only + sus objetos contra cuotas 600/9.
 * Datos vía /api/atc/rpc/* (PostgREST :3011, atc_dev) con tenant server-side.
 */
export default async function PlacesPage({ params }: ParamsWithLang) {
  const { lang } = await params;
  return (
    <RouteGuard
      path="/users/settings/places"
      fallbackPath={`/${lang}/shipping`}
    >
      <PlacesPageContent />
    </RouteGuard>
  );
}
