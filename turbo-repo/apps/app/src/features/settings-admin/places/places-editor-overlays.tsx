"use client";

import { DeleteConfirmModal } from "@/features/task-forms/components/task-bento-form/components/side-data/multimedia-manager.tsx/viewer/modals/delete-confirm-modal";
import PlaceForm from "./place-form";
import TrayectoForm from "./trayecto-form";
import VersionDialog from "./version-dialog";
import MapCreateMenu from "./map-create-menu";
import PlaceBadgeMenu from "./place-badge-menu";
import PlaceBadgeTooltip from "./place-badge-tooltip";
import PolygonDrawToolbar from "./polygon-draw-toolbar";
import { esPoligonoLibre } from "./geofence-editor";
import {
  actualizarInner,
  innerComoForm,
  innerEnEdicion,
} from "./inner-geofences";
import {
  cancelarDibujo,
  deshacer,
  puedeDeshacer,
  puedeRehacer,
  puedeTerminar,
  rehacer,
  seguirDibujando,
  terminar,
} from "./polygon-draw";
import {
  puedeConfirmar,
  puedeDeshacerRecorrido,
  puedeRehacerRecorrido,
  puntosUbicados,
} from "./recorrido";
import type { PlacesWorkspace } from "./use-places-workspace";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { Dispatch, SetStateAction } from "react";
import type { FormLugar } from "./places.types";

function InnerPolygonToolbar({
  form,
  setForm,
}: {
  form: FormLugar;
  setForm: Dispatch<SetStateAction<FormLugar>>;
}) {
  const inner = innerEnEdicion(form);
  if (!inner || inner.geom !== "polygon" || !esPoligonoLibre(inner))
    return null;
  if (inner.vertices.length === 0 && !puedeDeshacer(innerComoForm(inner))) {
    return null;
  }
  const innerForm = innerComoForm(inner);
  const patch = (fn: (f: FormLugar) => FormLugar) =>
    setForm((f) => actualizarInner(f, inner.id, fn));
  return (
    <PolygonDrawToolbar
      puntos={inner.vertices.length}
      cerrado={inner.cerrado}
      onSeguir={() => patch(seguirDibujando)}
      puedeTerminar={puedeTerminar(innerForm)}
      onTerminar={() => patch(terminar)}
      puedeDeshacer={puedeDeshacer(innerForm)}
      puedeRehacer={puedeRehacer(innerForm)}
      onDeshacer={() => patch(deshacer)}
      onRehacer={() => patch(rehacer)}
      onCancelar={() => patch(cancelarDibujo)}
    />
  );
}

/** Barra del recorrido: deshacer/rehacer, confirmar o volver a editar. */
function TrayectoDrawToolbar({ ws }: { ws: PlacesWorkspace }) {
  const { tray } = ws;
  const puntos = puntosUbicados(tray).length;
  const deshacer = puedeDeshacerRecorrido(tray);
  const rehacer = puedeRehacerRecorrido(tray);
  if (puntos === 0 && !deshacer && !rehacer) return null;
  return (
    <PolygonDrawToolbar
      variante="trayecto"
      puntos={puntos}
      cerrado={tray.confirmado}
      puedeTerminar={puedeConfirmar(tray)}
      puedeDeshacer={deshacer}
      puedeRehacer={rehacer}
      onTerminar={ws.confirmarTrayecto}
      onSeguir={ws.editarPuntosTrayecto}
      onDeshacer={ws.deshacerTrayecto}
      onRehacer={ws.rehacerTrayecto}
      onCancelar={ws.borrarPuntosTrayecto}
    />
  );
}

const STACKED_FORM =
  "relative top-auto right-auto max-h-[min(42vh,420px)] w-full shrink-0";
const STACKED_FORM_CREAR =
  "relative top-auto right-auto flex h-full min-h-0 w-full max-h-none flex-col";

function LugarFormCard({
  ws,
  className,
  dict,
}: {
  ws: PlacesWorkspace;
  className?: string;
  dict?: I18nRecord;
}) {
  return (
    <PlaceForm
      className={className}
      dict={dict}
      form={ws.form}
      setForm={ws.setForm}
      cats={ws.cats ?? []}
      guardando={ws.guardando}
      msg={ws.msg}
      token={ws.MAPBOX_TOKEN}
      cerca={ws.centroMapa}
      onUbicar={ws.ubicarEnMapa}
      paso={ws.pasoLugar}
      onContinuar={ws.continuarAInteriores}
      onGuardar={() => void ws.guardarLugar()}
      version={ws.versionDe("lugar", ws.form.place_id)}
      onBack={ws.volverAGeocerca}
      onClose={ws.cerrarForm}
    />
  );
}

function TrayectoFormCard({
  ws,
  className,
  dict,
}: {
  ws: PlacesWorkspace;
  className?: string;
  dict?: I18nRecord;
}) {
  return (
    <TrayectoForm
      className={className}
      dict={dict}
      token={ws.MAPBOX_TOKEN}
      cerca={ws.centroMapa}
      onRecorrido={ws.aplicarRecorrido}
      eligiendoPuntoId={ws.puntoMapaId}
      onElegirEnMapa={ws.elegirPuntoEnMapa}
      resaltadoId={ws.hoverPuntoId}
      onHoverPunto={ws.setHoverPuntoId}
      paso={ws.pasoTrayecto}
      onPaso={ws.cambiarPasoTrayecto}
      onTipo={ws.cambiarTipoTrayecto}
      onTipoPunto={ws.cambiarTipoPuntoTray}
      distanciaM={ws.distanciaTrayectoM}
      tray={ws.tray}
      setTray={ws.setTray}
      guardando={ws.guardando}
      msg={ws.msg}
      onSave={ws.guardarOContinuarTrayecto}
      version={ws.versionDe("trayecto", ws.tray.id)}
      onClose={ws.cerrarForm}
    />
  );
}

/** Este modal no se cierra solo al confirmar: se cierra y luego se borra. */
function confirmarYCerrar(ws: PlacesWorkspace) {
  const accion = ws.confirmacion?.accion;
  ws.setConfirmacion(null);
  accion?.();
}

export function PlacesEditorOverlays({
  ws,
  stacked = false,
  dict,
}: {
  ws: PlacesWorkspace;
  stacked?: boolean;
  dict?: I18nRecord;
}) {
  const formClass = stacked ? STACKED_FORM : undefined;
  const form = (
    <>
      {ws.modo === "lugar" && (
        <LugarFormCard ws={ws} className={formClass} dict={dict} />
      )}
      {ws.modo === "trayecto" && (
        <TrayectoFormCard ws={ws} className={formClass} dict={dict} />
      )}
    </>
  );

  return (
    <>
      {ws.menu && (
        <MapCreateMenu
          x={ws.menu.x}
          y={ws.menu.y}
          onCrearLugar={ws.crearLugarAqui}
          onCrearTrayecto={ws.crearTrayectoAqui}
          onClose={ws.cerrarMenu}
        />
      )}
      {/* tooltip del badge bajo el mouse (no con un menú abierto) */}
      {ws.tooltipBadge && !ws.menu && !ws.menuLugar && (
        <PlaceBadgeTooltip
          badge={ws.tooltipBadge.badge}
          x={ws.tooltipBadge.x}
          y={ws.tooltipBadge.y}
        />
      )}
      {ws.menuLugar && (
        <PlaceBadgeMenu
          x={ws.menuLugar.x}
          y={ws.menuLugar.y}
          nombre={ws.menuLugar.lugar.name}
          onConfigurar={ws.configurarDesdeMenu}
          onEliminar={ws.eliminarDesdeMenu}
          onClose={ws.cerrarMenuLugar}
        />
      )}
      {ws.modo === "lugar" &&
        ws.pasoLugar === "interiores" &&
        innerEnEdicion(ws.form) && (
          <InnerPolygonToolbar form={ws.form} setForm={ws.setForm} />
        )}
      {ws.modo === "lugar" &&
        ws.pasoLugar === "geocerca" &&
        esPoligonoLibre(ws.form) &&
        (ws.form.vertices.length > 0 ||
          puedeDeshacer(ws.form) ||
          puedeRehacer(ws.form)) && (
          <PolygonDrawToolbar
            puntos={ws.form.vertices.length}
            cerrado={ws.form.cerrado}
            onSeguir={ws.seguirPoligono}
            puedeTerminar={puedeTerminar(ws.form)}
            onTerminar={ws.terminarPoligono}
            puedeDeshacer={puedeDeshacer(ws.form)}
            puedeRehacer={puedeRehacer(ws.form)}
            onDeshacer={ws.deshacerPunto}
            onRehacer={ws.rehacerPunto}
            onCancelar={ws.cancelarPoligono}
          />
        )}
      {ws.modo === "trayecto" && ws.pasoTrayecto === "recorrido" && (
        <TrayectoDrawToolbar ws={ws} />
      )}
      {!stacked && form}
      <DeleteConfirmModal
        show={ws.confirmacion !== null}
        onClose={() => ws.setConfirmacion(null)}
        onConfirm={() => confirmarYCerrar(ws)}
        fileName={ws.confirmacion?.nombre ?? ""}
        title={ws.confirmacion?.titulo}
        description={null}
        dictionary={dict ?? {}}
      />
      {/* guardar una geocerca o trayecto editado: tipo de actualización */}
      <VersionDialog
        pendiente={ws.versionPendiente}
        guardando={ws.guardando}
        onCancelar={ws.cancelarVersion}
        onConfirmar={ws.confirmarVersion}
      />
    </>
  );
}

function formPantallaCompleta(ws: PlacesWorkspace) {
  return ws.modo === "lugar" || ws.modo === "trayecto";
}

export function PlacesStackedFormCards({
  ws,
  dict,
}: {
  ws: PlacesWorkspace;
  dict?: I18nRecord;
}) {
  const formClass = formPantallaCompleta(ws)
    ? STACKED_FORM_CREAR
    : STACKED_FORM;
  return (
    <>
      {ws.modo === "lugar" && (
        <LugarFormCard ws={ws} className={formClass} dict={dict} />
      )}
      {ws.modo === "trayecto" && (
        <TrayectoFormCard ws={ws} className={formClass} dict={dict} />
      )}
    </>
  );
}
