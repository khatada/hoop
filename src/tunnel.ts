import http = require("http");
import ws = require("ws");
import * as url from "url";
import * as querystring from "querystring";
import { EventEmitter } from "events";
import logger from "./logger";
import { uniqueId } from "./util";

export interface Tunnel {
    ws: ws;
    channel: string;
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

export class TunnelRequest extends EventEmitter {
    readonly id: string;
    readonly tunnel: Tunnel;
    static readonly MESSAGE_ID_HEADER = 8;
    static readonly MESSAGE_COMMAND_HEADER = 1;

    constructor(tunnel: Tunnel) {
        super();
        this.id = uniqueId(TunnelRequest.MESSAGE_ID_HEADER);
        this.tunnel = tunnel;
        this.onMessage = this.onMessage.bind(this);
        this.tunnel.ws.on("message", this.onMessage);
    }

    dispose() {
        if(this.tunnel.ws) { 
            this.tunnel.ws.removeListener("message", this.onMessage);
        }
    }

    header(method: string, headers: Object, path: string, query: string): void {
        const idBuffer = new Buffer(this.id);
        const commandBuffer = new Buffer("h");
        const dataBuffer = new Buffer(JSON.stringify({ method, headers, path, query }));
        const buffer = Buffer.concat([idBuffer, commandBuffer, dataBuffer]);
        this.sendToClient(buffer);
    }

    send(data: Buffer): void {
        const idBuffer = new Buffer(this.id);
        const commandBuffer = new Buffer("s");
        const buffer = Buffer.concat([idBuffer, commandBuffer, data]);
        this.sendToClient(buffer);
    }

    end(): void {
        const idBuffer = new Buffer(this.id);
        const commandBuffer = new Buffer("e");
        const buffer = Buffer.concat([idBuffer, commandBuffer]);
        this.sendToClient(buffer);
    }

    abort(): void {
        const idBuffer = new Buffer(this.id);
        const commandBuffer = new Buffer("a");
        const buffer = Buffer.concat([idBuffer, commandBuffer]);
        this.sendToClient(buffer);
    }

    private onMessage(data: Buffer) {
        if(data && data.length > TunnelRequest.MESSAGE_ID_HEADER) {
            try {
                const idBuffer = data.slice(0, TunnelRequest.MESSAGE_ID_HEADER);
                const id = idBuffer.toString();
                if (id === this.id) {
                    const commandBuffer = data.slice(TunnelRequest.MESSAGE_ID_HEADER, TunnelRequest.MESSAGE_ID_HEADER + TunnelRequest.MESSAGE_COMMAND_HEADER);
                    const command = commandBuffer.toString();
                    if (command === "h") {
                        const headerBuffer = data.slice(TunnelRequest.MESSAGE_ID_HEADER + TunnelRequest.MESSAGE_COMMAND_HEADER);
                        const headers = JSON.parse(headerBuffer.toString());
                        this.emit("header", headers);
                    } else if (command === "s") {
                        const dataBuffer = data.slice(TunnelRequest.MESSAGE_ID_HEADER + TunnelRequest.MESSAGE_COMMAND_HEADER);
                        this.emit("data", dataBuffer);
                    } else if (command === "e") {
                        this.emit("end");
                        this.dispose();
                    } else if (command === "a") {
                        this.emit("abort");
                        this.dispose();
                    } else {
                        this.emit("error", new Error(`Unsupported command is received. command=${command}`));
                        this.dispose();
                    }
                }
            } catch (error) {
                this.emit("error", error);
                this.dispose();
            }
        }
    }

    private sendToClient(buffer: Buffer): void {
        if (this.tunnel.ws){
            this.tunnel.ws.send(buffer, (error) => {
                if (error) {
                    this.emit("error", error);
                    this.dispose();
                }
            });
        }
    }
}

export class TunnelServer {
    private wsServer: ws.Server;
    private tunnels: Tunnel[] = [];
    readonly authToken: string;

    constructor(httpServer: http.Server, authToken: string) {
        this.wsServer = new ws.Server({ server: httpServer });
        this.authToken = authToken;

        this.onConnection = this.onConnection.bind(this);
        this.onError = this.onError.bind(this);
        this.wsServer.on("connection", this.onConnection);
        this.wsServer.on("error", this.onError);
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

    private extractChannelFromURL(wsURL: string): string {
        const parsed = url.parse(wsURL);
        const match = parsed.path.match(/.*\/hoop\/([^\/|^?]*).*/);
        if (match) {
            return match[1];
        } else {
            return null;
        }
    }

    private authConnection(wsURL: string): boolean {
        const queryText = url.parse(wsURL).query;
        const query = querystring.parse(queryText);
        return query.auth === this.authToken;
    }

    private onConnection(ws: ws, req: http.IncomingMessage): void {
        const channel = this.extractChannelFromURL(req.url);
        if(channel && this.authConnection(req.url)) {
            this.tunnels.push({
                ws: ws,
                channel: channel
            });
            logger.info(`New connection. channel=${channel}`);
            ws.on("close", this.onClose.bind(this, ws));
            ws.on("error", this.onConnectionError.bind(this, ws));
        } else {
            logger.info(`Authentication failed. channel=${channel}`);
            ws.close();
        }
    }

    private onError(error: Error) {
        logger.warn("WS server error", error);
    }

    private onClose(ws: ws) {
        ws.removeAllListeners();
        const exist = this.tunnels.find(tunnel => tunnel.ws === ws);
        if (exist) {
            this.tunnels = this.tunnels.filter(tunnel => tunnel !== exist);
            logger.info(`Connection closed. channel=${exist.channel}`);
        }
    }

    private onConnectionError(ws: ws, error: Error) {
        logger.warn(error);
        ws.close();
        this.onClose(ws);
    }

    request(channel: string): TunnelRequest {
        const tunnel = this.tunnels.find(tunnel => tunnel.channel === channel);
        if (tunnel) {
            return new TunnelRequest(tunnel);
        } else {
            return null;
        }
    }
}