import * as http from "http";
import * as express from "express";
import * as querystring from "querystring";

import logger from "./logger";
import { TunnelServer } from "./tunnel";
import { uniqueId } from "./util";

const authToken = process.env.AUTH_TOKEN || uniqueId();
if (!process.env.AUTH_TOKEN) {
    logger.error(`Authentication token is not set.`);
}

const app = express();
const server = http.createServer(app);
const tunnel = new TunnelServer(server, authToken);

function extractPath(path: string, channel: string): string {
    const prefix = `/hoop/${channel}`;
    return path.substring(path.indexOf(prefix) + prefix.length);
}

function extractQuery(url: string): string {
    const queryStart = url.indexOf("?");
    if (queryStart >= 0) {
        const query = querystring.parse(url.substring(queryStart + 1));
        if (query.auth) {
            delete query.auth;
        }
        return querystring.stringify(query);
    } else {
        return "";
    }
}

app.use((req, res, next) => {
    res.once("finish", () => {
        if (res.statusCode >= 400) {
            logger.warn(`${req.method} ${req.url} ${res.statusCode}`);
        } else {
            logger.debug(`${req.method} ${req.url} ${res.statusCode}`);
        }
    });
    next();
});

app.get("/", (req, res) => {
    res.status(200);
    res.send("Hoop is running");
    res.end();
});

app.use((req, res, next) => {
    const auth = req.query.auth || "";
    if (auth.trim() === authToken) {
        next();
    } else {
        const authHeader = req.header("authorization") || "";
        if (authHeader.trim() === `token ${authToken}`) {
            next();
        } else {
            res.status(403);
            res.send(`Authentication failed`);
        }
    }
});

app.all("/hoop/:channel/*", (req, res) => {
    const channel: string = req.params.channel;
    const path = extractPath(req.path, channel);
    const tunnelRequest = tunnel.request(channel);
    if (tunnelRequest) {
        tunnelRequest.header(req.method, req.headers, path, extractQuery(req.url));
        req.on("data", (chunk: Buffer) => {
            logger.info(chunk.toString());
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
    logger.info(`Hoop start. port=${port}`);
});