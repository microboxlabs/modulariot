package com.microboxlabs.miot.teltonika.mapping;

/**
 * FMB AVL IDs used by the mapper. Source, firmware FMB.Ver.03.29.00 and newer:
 * https://wiki.teltonika-gps.com/view/FMB920_Teltonika_Data_Sending_Parameters_ID
 */
public final class TeltonikaIo {

    public static final int DIGITAL_INPUT_1 = 1;
    public static final int DIGITAL_INPUT_2 = 2;
    public static final int DIGITAL_INPUT_3 = 3;
    /** Larger models only (FMB640 and similar). */
    public static final int DIGITAL_INPUT_4 = 4;
    /** Analog input 1, mV. */
    public static final int ANALOG_INPUT_1 = 9;
    /** mV; models with a second analog input. */
    public static final int ANALOG_INPUT_2 = 10;
    /** SIM ICCID, most significant part. Format to be confirmed on a real device. */
    public static final int ICCID_1 = 11;
    /** SIM ICCID, least significant part. Format to be confirmed on a real device. */
    public static final int ICCID_2 = 14;
    /** Meters. */
    public static final int TOTAL_ODOMETER = 16;
    /** mG, signed. */
    public static final int AXIS_X = 17;
    public static final int AXIS_Y = 18;
    public static final int AXIS_Z = 19;
    /** 0 to 5. */
    public static final int GSM_SIGNAL = 21;
    /** External (vehicle) voltage, mV. */
    public static final int EXTERNAL_VOLTAGE = 66;
    /** Internal battery voltage, mV. */
    public static final int BATTERY_VOLTAGE = 67;
    /** 0 off, 1 on with fix, 2 on without fix, 3 sleep, 4 on with fix but invalid data. */
    public static final int GNSS_STATUS = 69;
    /** iButton ID, 8 bytes. 0 when no key is present. */
    public static final int IBUTTON = 78;
    public static final int DATA_MODE = 80;
    /** Coefficient x 10. */
    public static final int GNSS_PDOP = 181;
    /** Coefficient x 10. */
    public static final int GNSS_HDOP = 182;
    /** Meters. */
    public static final int TRIP_ODOMETER = 199;
    public static final int SLEEP_MODE = 200;
    public static final int GSM_CELL_ID = 205;
    public static final int GSM_AREA_CODE = 206;
    /** 0 off, 1 on. */
    public static final int IGNITION = 239;
    /** 0 off, 1 on. */
    public static final int MOVEMENT = 240;
    /** MCC followed by MNC, e.g. 73001. */
    public static final int ACTIVE_GSM_OPERATOR = 241;
    /** 0 steady, 1 towing. */
    public static final int TOWING = 246;
    /** Crash trace type, 1 to 6. */
    public static final int CRASH_DETECTION = 247;
    /** 0 jamming stop, 1 jamming start. */
    public static final int JAMMING = 249;
    /** 0 battery present, 1 battery unplugged. */
    public static final int UNPLUG = 252;
    /** 1 harsh acceleration, 2 harsh braking, 3 harsh cornering. */
    public static final int GREEN_DRIVING_TYPE = 253;
    /** g x 100 for acceleration and braking; rad/s x 100 for cornering with GPS source. */
    public static final int GREEN_DRIVING_VALUE = 254;
    /** km/h at the start and at the end of over speeding. */
    public static final int OVER_SPEEDING = 255;

    private TeltonikaIo() {
    }
}
