package com.microboxlabs.miot.integrations.template;

/**
 * A payload template uses syntax this renderer cannot faithfully reproduce, or refers to
 * a variable root that does not exist.
 *
 * <p>Raised at <b>save</b> time, not dispatch time. The settings UI previews templates with
 * a full Handlebars engine; this renderer implements only variable substitution. Refusing
 * the difference when the binding is stored is what keeps the preview honest — a template
 * that would render differently in production never reaches storage.
 */
public class TemplateSyntaxException extends RuntimeException {

    public TemplateSyntaxException(String message) {
        super(message);
    }
}
