package com.microboxlabs.miot.cli;

import io.quarkus.picocli.runtime.annotations.TopCommand;
import picocli.CommandLine;

@TopCommand
@CommandLine.Command(
        name = "miot",
        description = "ModularIoT Platform CLI",
        mixinStandardHelpOptions = true,
        subcommands = {
                AllCommand.class,
                FleetCommand.class,
                StatusCommand.class
        }
)
public class MiotCli implements Runnable {

    @Override
    public void run() {
        CommandLine.usage(this, System.out);
    }
}
