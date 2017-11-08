Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const tunnel_1 = require("./tunnel");
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.get("/", (req, res) => {
    res.status(200);
    res.send("Hoop is running");
    res.end();
});
const server = http.createServer(app);
const tunnel = new tunnel_1.TunnelServer(server, 5000);
app.all("/hoop/:channel/*", (req, res) => {
    console.log(req.params);
    console.log(req.body);
    console.log(req.headers);
    const channel = req.params.channel;
    tunnel.request(channel, {
        path: req.params[0],
        body: req.body,
        method: req.method,
        headers: req.headers,
        status: 0
    }).then((data) => {
        res.status(data.status);
        Object.keys(data.headers).forEach((key) => {
            res.header(key, data.headers[key]);
        });
        res.send(data.body);
        res.end();
    }).catch((error) => {
        res.status(400);
        res.json({ error: String(error) });
        res.end();
    });
});
const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`Hoop start. port=${port}`);
});
