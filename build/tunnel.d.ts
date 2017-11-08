/// <reference types="ws" />
/// <reference types="node" />
import http = require("http");
import ws = require("ws");
import { EventEmitter } from "events";
export interface Tunnel {
    ws: ws;
    channel: string;
    bus: EventEmitter;
}
export declare type Method = "GET" | "POST" | "PUT" | "DELETE";
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
    data?: RestData;
    channel: string;
    error?: any;
}
export declare class TunnelServer {
    private wsServer;
    private tunnels;
    private timeout;
    constructor(httpServer: http.Server, timeout: number);
    dispose(): void;
    private onConnection(ws, req);
    private onMessage(ws, message);
    private onClose(ws);
    request(channel: string, data: RestData): Promise<RestData>;
}
