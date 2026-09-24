package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.core.selectable.Selectable;
import com.microboxlabs.miot.core.selectable.SelectableDefaults;
import com.microboxlabs.miot.core.selectable.SelectableOption;
import com.microboxlabs.miot.core.selectable.SelectionMode;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.ArrayList;
import java.util.List;

/**
 * The treatment-form lists an organization starts with, seeded by the core
 * selectables service. Same lists and wording the treatment forms shipped
 * with. Option ids are stable so actions recorded against them keep
 * resolving; {@code call_result} uses the ids the call form already keys its
 * labels on.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class TreatmentFormSelectables implements SelectableDefaults {

    static final String SYSTEM_ACTOR = "system:defaults";

    public static final String RESULT_COMMITS = "result_commits";
    public static final String RESULT_CORRECTED = "result_corrected";
    public static final String RESULT_REJECTS = "result_rejects";
    public static final String RESULT_NO_ANSWER = "result_no_answer";
    public static final String RESULT_VOICEMAIL = "result_voicemail";

    @Override
    public List<Selectable> forTenant(String tenantCode) {
        List<Selectable> out = new ArrayList<>();
        out.add(new Selectable(tenantCode, "who_to_call", "A quién llamar",
                "Destinatario de la llamada. Cualquiera distinto del conductor se registra como escalamiento"
                        + " propuesto por el operador.",
                SelectionMode.SINGLE, options("who_to_call",
                        new String[] {"Conductor", "Conductor asignado al viaje"},
                        new String[] {"Transportista / Jefe de transporte", ""},
                        new String[] {"Jefe de operaciones", ""},
                        new String[] {"Jefe mina", ""},
                        new String[] {"Otro", "Detallar en la nota"}),
                SYSTEM_ACTOR, null));
        out.add(new Selectable(tenantCode, "call_result", "Resultado de la llamada",
                "Desenlace del contacto telefónico.", SelectionMode.SINGLE, List.of(
                        new SelectableOption(RESULT_COMMITS, "Contesta — se compromete a corregir", ""),
                        new SelectableOption(RESULT_CORRECTED, "Contesta — condición ya corregida", ""),
                        new SelectableOption(RESULT_REJECTS, "Contesta — rechaza o discute", ""),
                        new SelectableOption(RESULT_NO_ANSWER, "No contesta", ""),
                        new SelectableOption(RESULT_VOICEMAIL, "Buzón de voz / apagado", "")),
                SYSTEM_ACTOR, null));
        out.add(new Selectable(tenantCode, "call_tags", "Etiquetas de llamada",
                "Etiquetas opcionales para clasificar el tratamiento.", SelectionMode.MULTIPLE,
                options("call_tags",
                        new String[] {"Ruta con problemas", ""},
                        new String[] {"Conductor problemático", ""},
                        new String[] {"Prueba", ""}),
                SYSTEM_ACTOR, null));
        out.add(new Selectable(tenantCode, "ignore_reason", "Motivo para ignorar",
                "Por qué el evento es real pero no requiere gestión. Alimenta el bucle de calibración.",
                SelectionMode.SINGLE, options("ignore_reason",
                        new String[] {"Falso positivo — mapa/límite incorrecto", ""},
                        new String[] {"Zona de sombra GPS conocida", ""},
                        new String[] {"Maniobra justificada (adelantamiento)", ""},
                        new String[] {"Condición operativa autorizada", ""},
                        new String[] {"Síntoma duplicado", ""},
                        new String[] {"Otro (detallar en la nota)", ""}),
                SYSTEM_ACTOR, null));
        out.add(new Selectable(tenantCode, "ignore_duration", "Duración de la omisión",
                "Por cuánto tiempo se silencia la condición.", SelectionMode.SINGLE,
                options("ignore_duration",
                        new String[] {"5 minutos", ""},
                        new String[] {"30 minutos", ""},
                        new String[] {"1 hora", ""},
                        new String[] {"2 horas", ""},
                        new String[] {"Indefinidamente", ""}),
                SYSTEM_ACTOR, null));
        out.add(new Selectable(tenantCode, "invalidate_reason", "Motivo de invalidación",
                "Por qué el síntoma NO es real (dato o regla). Es la etiqueta de aprendizaje del motor.",
                SelectionMode.SINGLE, options("invalidate_reason",
                        new String[] {"Dato GPS incorrecto", ""},
                        new String[] {"Mapa/límite incorrecto", ""},
                        new String[] {"Regla mal calibrada", ""},
                        new String[] {"Síntoma duplicado", ""},
                        new String[] {"Otro (detallar en la nota)", ""}),
                SYSTEM_ACTOR, null));
        return out;
    }

    private static List<SelectableOption> options(String key, String[]... entries) {
        List<SelectableOption> out = new ArrayList<>();
        for (int i = 0; i < entries.length; i++) {
            out.add(new SelectableOption(key + "_" + (i + 1), entries[i][0], entries[i][1]));
        }
        return out;
    }
}
