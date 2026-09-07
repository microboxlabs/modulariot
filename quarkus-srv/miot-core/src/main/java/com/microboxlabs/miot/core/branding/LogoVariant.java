package com.microboxlabs.miot.core.branding;

/**
 * Which ground a logo is drawn for.
 *
 * <p>A domain always has a {@link #LIGHT} logo and may have a {@link #DARK}
 * one. Two files rather than one because a wordmark inked for a light header
 * vanishes on a dark footer, and the same in reverse — the brands that care
 * ship both.
 */
public enum LogoVariant {
    LIGHT,
    DARK
}
