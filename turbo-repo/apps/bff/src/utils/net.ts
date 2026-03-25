import net from "net";

interface IsPortReachableOptions {
  port: number;
  host?: string;
  timeout?: number;
}

export async function isPortReachable({port, host = "localhost", timeout = 1000}: IsPortReachableOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const socket = new net.Socket();

        const onError = () => {
            socket.destroy();
            reject();
        };

        socket.setTimeout(timeout);
        
        socket.once("timeout", onError);
        socket.once("error", onError);

        socket.connect(port, host, () => {
            socket.end();
            resolve();
        });
    });
};
