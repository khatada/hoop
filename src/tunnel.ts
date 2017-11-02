import http = require("http");
import ws = require("ws");
import uuid = require("uuid");
import {EventEmitter} from "events";

export interface Tunnel{
    ws: ws;
    channel: string;
    bus: EventEmitter;
}

export type Method = "GET" | "POST" | "PUT" | "DELETE";

export interface RestData{
    method: Method;
    path: string;
    headers: object;
    body?: object;
    status?: number;
}

export interface TunnelMessage{
    command: string;
    session: string;
    data?: RestData,
    channel: string;
    error?: any;
}

export class TunnelServer{
    private wsServer: ws.Server;
    private tunnels: Tunnel[] = [];
    private timeout: number = 3000;

    constructor(httpServer: http.Server, timeout: number){
        this.wsServer = new ws.Server({ server: httpServer });
        this.timeout = timeout;

        this.onConnection = this.onConnection.bind(this);
        this.wsServer.on("connection", this.onConnection);
    }

    dispose(){
        this.tunnels.forEach(tunnel => {
            tunnel.ws.removeAllListeners();
            tunnel.ws.close()
        });
        this.tunnels = [];

        if(this.wsServer){
            this.wsServer.removeAllListeners();
            this.wsServer.close();
            this.wsServer = null;
        }
    }

    private onConnection(ws: ws, req: http.IncomingMessage){
        this.tunnels.push({
            ws: ws,
            channel: null,
            bus: new EventEmitter()
        });
        ws.on("message", this.onMessage.bind(this, ws));
        ws.on("close", this.onClose.bind(this, ws));
    }

    private onMessage(ws: ws, message: string){
        try{
            const json: TunnelMessage = JSON.parse(message);
            if(json.command === "set-name"){
                const tunnel = this.tunnels.find(tunnel => tunnel.ws === ws);
                if(tunnel){
                    tunnel.channel = json.channel;
                }
            }
            if(json.session){
                const tunnel = this.tunnels.find(tunnel => tunnel.ws === ws);
                if(tunnel){
                    tunnel.bus.emit(json.session, json);
                }
            }
        }catch(error){
            console.error(error);
        }
    }

    private onClose(ws: ws){
        this.tunnels = this.tunnels.filter(tunnel => tunnel.ws !== ws);
    }

    request(channel: string, data: RestData): Promise<RestData>{
        return new Promise<RestData>((resolve, reject) => {
            const tunnel = this.tunnels.find(tunnel => tunnel.channel === channel);
            if(tunnel){
                const session = uuid();
                const message: TunnelMessage = {
                    command: "request",
                    session: session,
                    data: data,
                    channel: channel
                }
                console.log(message)
                tunnel.ws.send(JSON.stringify(message));
                tunnel.bus.once(session, (receive: TunnelMessage)=>{
                    clearTimeout(timer);
                    if(receive.command === "response"){
                        resolve(receive.data);
                    }else{
                        reject(receive.error);
                    }
                });
                const timer = setTimeout(()=>{
                    tunnel.bus.removeAllListeners(session);
                    reject(new Error("Request tunnel timeout"));
                }, this.timeout);
            }else{
                reject(new Error("channel is not found"));
            }
        });
    }
}