Object.defineProperty(exports, "__esModule", { value: true });
const ws = require("ws");
const uuid = require("uuid");
const events_1 = require("events");
class TunnelServer {
    constructor(httpServer, timeout) {
        this.tunnels = [];
        this.timeout = 3000;
        this.wsServer = new ws.Server({ server: httpServer });
        this.timeout = timeout;
        this.onConnection = this.onConnection.bind(this);
        this.wsServer.on("connection", this.onConnection);
    }
    dispose() {
        this.tunnels.forEach(tunnel => {
            tunnel.ws.removeAllListeners();
            tunnel.ws.close();
        });
        this.tunnels = [];
        if (this.wsServer) {
            this.wsServer.removeAllListeners();
            this.wsServer.close();
            this.wsServer = null;
        }
    }
    onConnection(ws, req) {
        this.tunnels.push({
            ws: ws,
            channel: null,
            bus: new events_1.EventEmitter()
        });
        ws.on("message", this.onMessage.bind(this, ws));
        ws.on("close", this.onClose.bind(this, ws));
    }
    onMessage(ws, message) {
        try {
            const json = JSON.parse(message);
            if (json.command === "set-name") {
                const tunnel = this.tunnels.find(tunnel => tunnel.ws === ws);
                if (tunnel) {
                    tunnel.channel = json.channel;
                }
            }
            if (json.session) {
                const tunnel = this.tunnels.find(tunnel => tunnel.ws === ws);
                if (tunnel) {
                    tunnel.bus.emit(json.session, json);
                }
            }
        }
        catch (error) {
            console.error(error);
        }
    }
    onClose(ws) {
        this.tunnels = this.tunnels.filter(tunnel => tunnel.ws !== ws);
    }
    request(channel, data) {
        return new Promise((resolve, reject) => {
            const tunnel = this.tunnels.find(tunnel => tunnel.channel === channel);
            if (tunnel) {
                const session = uuid();
                const message = {
                    command: "request",
                    session: session,
                    data: data,
                    channel: channel
                };
                console.log(message);
                tunnel.ws.send(JSON.stringify(message));
                tunnel.bus.once(session, (receive) => {
                    clearTimeout(timer);
                    if (receive.command === "response") {
                        resolve(receive.data);
                    }
                    else {
                        reject(receive.error);
                    }
                });
                const timer = setTimeout(() => {
                    tunnel.bus.removeAllListeners(session);
                    reject(new Error("Request tunnel timeout"));
                }, this.timeout);
            }
            else {
                reject(new Error("channel is not found"));
            }
        });
    }
}
exports.TunnelServer = TunnelServer;
