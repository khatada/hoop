import http = require("http");
import ws = require("ws");
import uuid = require("uuid");
import { EventEmitter } from "events";

function uniqueId(n: number = 8): string {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    let id = "";
    for(let i=0 ; i<n ; i++) {
        const char = letters[Math.floor(Math.random() * letters.length)];
        id += char;
    }
    return id;
}

export interface Tunnel {
    ws: ws;
    channel: string;
    bus: EventEmitter;
}

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "OPTIONS" | "HEAD";

export interface RestData {
    method: Method;
    path: string;
    headers: object;
    body?: object;
    status?: number;
}

export interface TunnelMessage {
    command: string;
    session: string;
    data?: RestData,
    channel: string;
    error?: any;
}

export class TunnelRequest {
    readonly id: string;
    readonly tunnel: Tunnel;
    constructor(id: string, tunnel: Tunnel) {
        this.id = id;
        this.tunnel = tunnel;
    }

    header(method: string, headers: Object): void {
        const idBuffer = new Buffer(this.id);
        const commandBuffer = new Buffer("h");
        const dataBuffer = new Buffer(JSON.stringify({method, headers}));
        const buffer = Buffer.concat([idBuffer, commandBuffer, dataBuffer]);
        this.tunnel.ws.send(buffer);
    }

    send(data: Buffer): void {
        const idBuffer = new Buffer(this.id);
        const commandBuffer = new Buffer("s");
        const buffer = Buffer.concat([idBuffer, commandBuffer, data]);
        this.tunnel.ws.send(buffer);
    }

    end(): void {
        const idBuffer = new Buffer(this.id);
        const commandBuffer = new Buffer("e");
        const buffer = Buffer.concat([idBuffer, commandBuffer]);
        this.tunnel.ws.send(buffer);
    }

    abort(): void {
        const idBuffer = new Buffer(this.id);
        const commandBuffer = new Buffer("a");
        const buffer = Buffer.concat([idBuffer, commandBuffer]);
        this.tunnel.ws.send(buffer);
    }
}

export class TunnelServer {
    private wsServer: ws.Server;
    private tunnels: Tunnel[] = [];
    private timeout: number = 3000;

    constructor(httpServer: http.Server, options: { timeout: number }) {
        this.wsServer = new ws.Server({ server: httpServer });
        this.timeout = options.timeout;

        this.onConnection = this.onConnection.bind(this);
        this.wsServer.on("connection", this.onConnection);
    }

    dispose(): void {
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

    private onConnection(ws: ws, req: http.IncomingMessage): void {
        this.tunnels.push({
            ws: ws,
            channel: null,
            bus: new EventEmitter()
        });
        ws.on("message", this.onMessage.bind(this, ws));
        ws.on("close", this.onClose.bind(this, ws));
    }

    private onMessage(ws: ws, message: string): void {
        try {
            const json: TunnelMessage = JSON.parse(message);
            if (json.command === "subscribe") {
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
        } catch (error) {
            console.error(error);
        }
    }

    private onClose(ws: ws) {
        ws.removeAllListeners();
        this.tunnels = this.tunnels.filter(tunnel => tunnel.ws !== ws);
    }

    request(channel: string): TunnelRequest {
        const tunnel = this.tunnels.find(tunnel => tunnel.channel === channel);
        if(tunnel) {
            const id = uniqueId();
            return new TunnelRequest(id, tunnel);
        } else {
            return null;
        }
    }
}