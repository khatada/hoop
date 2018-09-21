import * as http from "http";
import * as express from "express";

import { TunnelServer, Method } from "./tunnel";

const app = express();

app.get("/", (req, res) => {
    res.status(200);
    res.send("Hoop is running");
    res.end();
});


const server = http.createServer(app);
const tunnel = new TunnelServer(server);

function extractPath(path: string, channel: string): string {
    const prefix = `/hoop/${channel}`;
    return path.substring(path.indexOf(prefix) + prefix.length);
}

function extractQuery(url: string): string {
    const query = url.indexOf("?");
    if(query >= 0) {
        return url.substring(query + 1);
    } else {
        return "";
    }
}

app.all("/hoop/:channel/*", (req, res) => {
    const channel: string = req.params.channel;
    const path = extractPath(req.path, channel);
    // console.log(`Tunnel channel=${channel} method=${req.method} path=${path} url=${req.url}`);
    const tunnelRequest = tunnel.request(channel);
    if (tunnelRequest) {
        tunnelRequest.header(req.method, req.headers, path, extractQuery(req.url));
        req.on("data", (chunk: Buffer) => {
            tunnelRequest.send(chunk);
        });
        req.on("end", () => {
            tunnelRequest.end();
        });
        req.on("error", () => {
            tunnelRequest.abort();
        });
        tunnelRequest.on("header", (header) => {
            res.status(header.status);
            Object.keys(header.headers).forEach(name => {
                res.setHeader(name, header.headers[name]);
            });
        });
        tunnelRequest.on("data", (data: Buffer) => {
            res.write(data);
        });
        tunnelRequest.on("end", () => {
            res.end();
        });
        tunnelRequest.on("abort", () => {
            res.status(500);
            res.end();
        });
        tunnelRequest.on("error", () => {
            res.status(500);
            res.end();
        });
    } else {
        res.status(404);
        res.end();
    }
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`Hoop start. port=${port}`);
})