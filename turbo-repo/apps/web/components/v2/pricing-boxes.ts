// Datos de precios ModularIoT — derivados del portafolio de costos real (GCP billing, 153 días).
// Costo mensual por caja, familia operacional (misma taxonomía que síntomas) y volumen real.
// Generado desde iniciativas/portafolio-costos-modular. No editar a mano.

export const REF_FLOTA = 5000;
export const MARGEN_DEFAULT = 92.8;
export const PILAR_MARGEN: Record<string, number> = { sintomas: 95.5 };

export const FAMILIES = ["Seguridad vial y conducción", "Seguridad patrimonial y geográfica", "Salud del vehículo y mantenimiento", "Eficiencia operacional y planificación", "Seguridad de carga, bodega y personas", "Observabilidad de datos"] as const;

export interface Caja { label: string; tecnico: string; costoMes: number; volMes: number | null; familia: number; }
export interface Pilar { id: string; nombre: string; unidad: string; costoMes: number; req: boolean; desc: string; items: Caja[]; }

export const PILARES: Pilar[] = [
  {
    "id": "ingesta",
    "nombre": "Ingesta GPS Core",
    "unidad": "señal GPS",
    "costoMes": 1103.61,
    "req": true,
    "desc": "Señales GPS y sensores en tiempo real. Base de la plataforma.",
    "items": [
      {
        "label": "Captura de cambios (CDC) hacia downstream",
        "tecnico": "",
        "costoMes": 416.06,
        "volMes": null,
        "familia": 5
      },
      {
        "label": "Backbone de mensajeria (Apache Pulsar)",
        "tecnico": "",
        "costoMes": 373.74,
        "volMes": null,
        "familia": 5
      },
      {
        "label": "Publicador HTTP -> Pulsar (entrada de señales)",
        "tecnico": "",
        "costoMes": 117.87,
        "volMes": null,
        "familia": 5
      },
      {
        "label": "API de ultima señal por asset (lastsignal)",
        "tecnico": "",
        "costoMes": 58.95,
        "volMes": null,
        "familia": 5
      },
      {
        "label": "API de tracking AVL (Automatic Vehicle Location)",
        "tecnico": "",
        "costoMes": 58.95,
        "volMes": null,
        "familia": 5
      },
      {
        "label": "Consumidor Pulsar -> escritura a asset_data/last_signal_data",
        "tecnico": "",
        "costoMes": 42.79,
        "volMes": null,
        "familia": 5
      },
      {
        "label": "Proxy de conexion a Cloud SQL",
        "tecnico": "",
        "costoMes": 35.25,
        "volMes": null,
        "familia": 5
      }
    ]
  },
  {
    "id": "sintomas",
    "nombre": "Síntomas / Torre de Control",
    "unidad": "síntoma",
    "costoMes": 984.57,
    "req": false,
    "desc": "Más de 30 reglas de detección con severidad, asignación y trazabilidad.",
    "items": [
      {
        "label": "Control de Proceso por Geocercas",
        "tecnico": "Proxy: 2x atraso de plan",
        "costoMes": 107.98,
        "volMes": 6289,
        "familia": 3
      },
      {
        "label": "Exceso de velocidad estandar",
        "tecnico": "Speed Limit Standard",
        "costoMes": 54.01,
        "volMes": 31310,
        "familia": 0
      },
      {
        "label": "Exceso de velocidad customizado",
        "tecnico": "Speed Limit Custom",
        "costoMes": 54.01,
        "volMes": 9037,
        "familia": 0
      },
      {
        "label": "Ausencia de Amarre y Sujecion",
        "tecnico": "Check Load Securing Absence",
        "costoMes": 54.01,
        "volMes": 1,
        "familia": 4
      },
      {
        "label": "Perdida de señal",
        "tecnico": "Lost Signal",
        "costoMes": 54.0,
        "volMes": 292554,
        "familia": 2
      },
      {
        "label": "Boton de panico",
        "tecnico": "Sos Button",
        "costoMes": 54.0,
        "volMes": 4,
        "familia": 4
      },
      {
        "label": "Conduccion maxima continua",
        "tecnico": "Continuous Drive Check",
        "costoMes": 53.99,
        "volMes": 3145,
        "familia": 0
      },
      {
        "label": "Pernoctacion en zona de riesgo",
        "tecnico": "Night Risk Stay",
        "costoMes": 53.99,
        "volMes": 237,
        "familia": 1
      },
      {
        "label": "Asistencia en Ruta",
        "tecnico": "Assistance Button",
        "costoMes": 53.99,
        "volMes": 3,
        "familia": 4
      },
      {
        "label": "Amarre y Sujecion Deficiente",
        "tecnico": "(sin eventos en el periodo)",
        "costoMes": 53.99,
        "volMes": 0,
        "familia": 4
      },
      {
        "label": "Atraso de Plan",
        "tecnico": "Proxy: horas de conduccion",
        "costoMes": 53.99,
        "volMes": 3145,
        "familia": 3
      },
      {
        "label": "Adelanto de Plan",
        "tecnico": "Proxy: horas de conduccion",
        "costoMes": 53.99,
        "volMes": 3145,
        "familia": 3
      },
      {
        "label": "Descanso minimo continuo",
        "tecnico": "Continuous Resting Check",
        "costoMes": 53.98,
        "volMes": 1142,
        "familia": 0
      },
      {
        "label": "Movimiento en horario",
        "tecnico": "Off Hours Driving",
        "costoMes": 53.98,
        "volMes": 654,
        "familia": 1
      },
      {
        "label": "Detencion en zona de riesgo",
        "tecnico": "Risk Zone Stop",
        "costoMes": 53.97,
        "volMes": 650,
        "familia": 1
      },
      {
        "label": "Sobre-estadia en Origen/Destino",
        "tecnico": "Proxy: zona de riesgo",
        "costoMes": 53.97,
        "volMes": 650,
        "familia": 3
      },
      {
        "label": "Mantenimiento de vehiculo",
        "tecnico": "Vehicle Maintenance",
        "costoMes": 24.64,
        "volMes": 8256,
        "familia": 2
      },
      {
        "label": "Cruce en Area no Permitida",
        "tecnico": "Restricted Area Crossing",
        "costoMes": 5.26,
        "volMes": 196,
        "familia": 1
      },
      {
        "label": "Ralenti del motor",
        "tecnico": "Engine Idle",
        "costoMes": 5.26,
        "volMes": 1763,
        "familia": 3
      },
      {
        "label": "Frenado brusco",
        "tecnico": "Harsh Breaking",
        "costoMes": 4.48,
        "volMes": 1502,
        "familia": 0
      },
      {
        "label": "Falla de carga de bateria",
        "tecnico": "Charging Failure",
        "costoMes": 3.79,
        "volMes": 1268,
        "familia": 2
      },
      {
        "label": "Uso de EPP",
        "tecnico": "Missing Protective Equipment",
        "costoMes": 3.74,
        "volMes": 32,
        "familia": 4
      },
      {
        "label": "Hombre Maquina",
        "tecnico": "(sin eventos en el periodo)",
        "costoMes": 3.74,
        "volMes": 0,
        "familia": 4
      },
      {
        "label": "Desvio anticipado de ETA",
        "tecnico": "Deviation_Eta_Early",
        "costoMes": 3.18,
        "volMes": 1065,
        "familia": 3
      },
      {
        "label": "Pernoctacion en zona no autorizada",
        "tecnico": "No Authorized Zone Stop",
        "costoMes": 2.63,
        "volMes": 883,
        "familia": 1
      },
      {
        "label": "Giro brusco",
        "tecnico": "Harsh Turn",
        "costoMes": 2.24,
        "volMes": 751,
        "familia": 0
      },
      {
        "label": "Desvio retardado de ETA",
        "tecnico": "Deviation_Eta_Late",
        "costoMes": 1.74,
        "volMes": 584,
        "familia": 3
      },
      {
        "label": "Aceleracion brusca",
        "tecnico": "Harsh Acceleration",
        "costoMes": 1.51,
        "volMes": 505,
        "familia": 0
      },
      {
        "label": "Bateria baja",
        "tecnico": "Battery Low",
        "costoMes": 1.43,
        "volMes": 479,
        "familia": 2
      },
      {
        "label": "Check Engine (falla de motor)",
        "tecnico": "Check Engine",
        "costoMes": 1.08,
        "volMes": 363,
        "familia": 2
      },
      {
        "label": "Rotacion de doble conductor",
        "tecnico": "Double Driver Rotation Check",
        "costoMes": 1.02,
        "volMes": 341,
        "familia": 0
      },
      {
        "label": "Fatiga y somnolencia (sensor)",
        "tecnico": "Fatigue And Drowsiness Sensor",
        "costoMes": 0.73,
        "volMes": 246,
        "familia": 0
      },
      {
        "label": "Sobrecalentamiento del motor",
        "tecnico": "Engine Overheat",
        "costoMes": 0.23,
        "volMes": 79,
        "familia": 2
      },
      {
        "label": "Fatiga y somnolencia (evento)",
        "tecnico": "Fatigue And Drowsiness",
        "costoMes": 0.01,
        "volMes": 4,
        "familia": 0
      },
      {
        "label": "Proximidad a paso fronterizo",
        "tecnico": "Near Border Crossing",
        "costoMes": 0.01,
        "volMes": 3,
        "familia": 1
      }
    ]
  },
  {
    "id": "integraciones",
    "nombre": "Integraciones",
    "unidad": "evento de integración",
    "costoMes": 1050.91,
    "req": false,
    "desc": "Workflows, webhooks, bóveda de evidencia y APIs hacia tus sistemas.",
    "items": [
      {
        "label": "Alfresco ECM - resource directory",
        "tecnico": "",
        "costoMes": 483.91,
        "volMes": null,
        "familia": 3
      },
      {
        "label": "Automatizacion de flujos (GAMA, RFID, webhooks)",
        "tecnico": "",
        "costoMes": 388.73,
        "volMes": null,
        "familia": 3
      },
      {
        "label": "Autenticacion/autorizacion",
        "tecnico": "",
        "costoMes": 59.49,
        "volMes": null,
        "familia": 3
      },
      {
        "label": "Servidor MCP (agentes IA)",
        "tecnico": "",
        "costoMes": 59.47,
        "volMes": null,
        "familia": 3
      },
      {
        "label": "API Gateway",
        "tecnico": "",
        "costoMes": 59.31,
        "volMes": null,
        "familia": 3
      }
    ]
  },
  {
    "id": "video",
    "nombre": "Video en Vivo / HLS",
    "unidad": "frame",
    "costoMes": 617.22,
    "req": false,
    "desc": "Streaming continuo desde cámaras y dashcams, con contexto por evento.",
    "items": [
      {
        "label": "Generacion HLS desde frames (FFmpeg)",
        "tecnico": "",
        "costoMes": 531.92,
        "volMes": null,
        "familia": 4
      },
      {
        "label": "Verificacion de dispositivos offline",
        "tecnico": "",
        "costoMes": 58.97,
        "volMes": null,
        "familia": 4
      },
      {
        "label": "Limpieza de ventana movil 24h",
        "tecnico": "",
        "costoMes": 26.33,
        "volMes": null,
        "familia": 4
      }
    ]
  }
];

export const markupPilar = (id: string, margenDefault = MARGEN_DEFAULT) => {
  const m = PILAR_MARGEN[id] ?? margenDefault;
  return 1 / (1 - m / 100);
};
