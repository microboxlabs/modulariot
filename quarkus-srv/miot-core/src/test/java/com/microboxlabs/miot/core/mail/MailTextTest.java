package com.microboxlabs.miot.core.mail;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class MailTextTest {

    @Test
    void paragraphsAreSeparatedAndTheHeadIsDropped() {
        String html = "<html><head><title>T</title><style>p{color:red}</style></head><body>"
                + "<p>Hola   <strong>Ana</strong></p><p>Segunda<br>línea</p></body></html>";

        assertEquals("Hola Ana\n\nSegunda\nlínea\n", MailText.of(html));
    }

    @Test
    void aLinkShowsItsTargetUnlessItIsTheText() {
        String html = "<p><a href=\"https://x.test/i?a=1&amp;b=2\" style=\"x\">Aceptar</a></p>"
                + "<p><a href='https://x.test/i'>https://x.test/i</a></p>";

        assertEquals("Aceptar (https://x.test/i?a=1&b=2)\n\nhttps://x.test/i\n", MailText.of(html));
    }

    @Test
    void entitiesAreDecoded() {
        assertEquals("Tom & Jerry's <b>\n", MailText.of("Tom &amp; Jerry&#39;s &lt;b&gt;"));
        assertEquals("Invitación ñ ó © &unknown; & x\n",
                MailText.of("Invitaci&oacute;n &ntilde; &#243; &copy; &unknown; & x"));
    }

    @Test
    void commentsAreDropped() {
        assertEquals("Visible\n", MailText.of("<!-- <p>Old promo</p> --><p>Visible</p><!--[if mso]>Outlook<![endif]-->"));
    }

    @Test
    void tableCellsAreSeparated() {
        assertEquals("Name\nValue\n", MailText.of("<table><tr><td>Name</td><td>Value</td></tr></table>"));
    }

    @Test
    void attributesAreReadInOrder() {
        assertEquals("https://x.test/a", MailText.attribute("a data-href=\"no\" href = \"https://x.test/a\"", "href"));
        assertEquals("u", MailText.attribute("a href=u class=x", "href"));
        assertEquals(null, MailText.attribute("a data-href=\"no\"", "href"));
    }
}
