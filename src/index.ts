import * as http from "http";
import * as url from "url";
import * as express from "express";
import * as bodyParser from "body-parser";

import { TunnelServer, Method } from "./tunnel";

const app = express();

app.get("/", (req, res) => {
    res.status(200);
    res.send("Hoop is running");
    res.end();
});


const server = http.createServer(app);
const tunnel = new TunnelServer(server, { timeout: 5000 });

app.all("/hoop/:channel/*", (req, res) => {
    const channel: string = req.params.channel;
    const tunnelRequest = tunnel.request(channel);
    if (tunnelRequest) {
        tunnelRequest.header(req.method, req.headers);
        req.on("data", (chunk: Buffer) => {
            tunnelRequest.send(chunk);
        });
        req.on("end", () => {
            tunnelRequest.end();
        });
        req.on("error", () => {
            tunnelRequest.abort();
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