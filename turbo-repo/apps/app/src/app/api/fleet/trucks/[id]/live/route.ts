import { NextResponse } from "next/server";
import { requireAuth } from "../../../../utils/alfresco-crud-client";
import { fetchLiveTripByAsset } from "../../../../utils/pgrest-client";

/**
 * ¿Está el camión EN VIAJE ahora? — alimenta el estado operacional del
 * SuperProfile (misma fuente live_trip que usa la regla "manda el viaje"
 * del mantenedor AMS). 200 siempre; {enViaje:false} cuando no hay trip.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;
  const { id } = await params;
  try {
    const trip = await fetchLiveTripByAsset(decodeURIComponent(id));
    return NextResponse.json({
      enViaje: !!trip,
      tripId: trip?.trip_id ?? null,
    });
  } catch {
    // fuente del gemelo caída ≠ error de página: se degrada a "sin dato"
    return NextResponse.json({ enViaje: false, tripId: null, degradado: true });
  }
}
