package cl.streamhub.gps.model;

import org.eclipse.microprofile.openapi.annotations.extensions.Extension;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

import io.quarkus.runtime.annotations.RegisterForReflection;


@Schema(description = "Contact information")
@RegisterForReflection
public class Contact {
    @Schema(
        description = "Driver's phone number",
        example = "+1234567890",
        required = false,
        extensions = {@Extension(name = "x-order", value = "1", parseValue = true)} //
    )
    private String phone;

    @Schema(
        description = "Driver's email address",
        example = "johndoe@example.com",
        required = false,
        extensions = {@Extension(name = "x-order", value = "2", parseValue = true)} //
    )
    private String email;

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}
