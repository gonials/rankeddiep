/*
    DiepCustom - custom tank game server that shares diep.io's WebSocket protocol
    Copyright (C) 2022 ABCxFF (github.com/ABCxFF)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>
*/

import * as fs from "fs";
import * as http from "http";
import { App, SSLApp, SHARED_COMPRESSOR, WebSocket, WebSocketBehavior } from "uWebSockets.js";
import Client, { ClientWrapper } from "./Client";
import * as config from "./config"
import * as util from "./util";
import GameServer from "./Game";
import TankDefinitions from "./Const/TankDefinitions";
import { commandDefinitions } from "./Const/Commands";
import { ColorsHexCode } from "./Const/Enums";

import RankedTeamsArena from "./Gamemodes/Ranked/RankedTeams";
import RankedMazeTeamsArena from "./Gamemodes/Ranked/RankedMazeTeams";
import RankedTeamsRandomArena from "./Gamemodes/Ranked/RankedTeamsRandom";
import RankedTeamsRandomMazeArena from "./Gamemodes/Ranked/RankedTeamsRandomMaze";
import EliminationArena from "./Gamemodes/Ranked/Elimination";
import TDMArena from "./Gamemodes/Ranked/TDM";
import HuntArena from "./Gamemodes/Ranked/Hunt";
import SurvivalArena from "./Gamemodes/Survival";
import SiegeArena from "./Gamemodes/Siege";
import Ranked4TeamsArena from "./Gamemodes/Ranked/Ranked4Teams";

import TrainingArena from "./Gamemodes/Misc/Training";

import RankedTeamsGasArena from "./Gamemodes/Ranked/RankedTeamsGas";
import SandboxArena from "./Gamemodes/Sandbox";

const PORT = config.serverPort;
const ENABLE_API = config.enableApi && config.apiLocation;
const ENABLE_CLIENT = config.enableClient && config.clientLocation && fs.existsSync(config.clientLocation);

if (ENABLE_API) util.log(`Rest API hosting is enabled and is now being hosted at /${config.apiLocation}`);
if (ENABLE_CLIENT) util.log(`Client hosting is enabled and is now being hosted from ${config.clientLocation}`);

export const bannedClients = new Set<string>();
const connections = new Map<string, number>();
const allClients = new Set<Client>();

const app = config.useSSL ? SSLApp({ key_file_name: config.sslOptions.key, cert_file_name: config.sslOptions.cert }) : App({});

const games: GameServer[] = [];

app.ws("/*", {
    compression: SHARED_COMPRESSOR,
    sendPingsAutomatically: true,
    maxPayloadLength: config.wssMaxMessageSize,
    idleTimeout: 10,
    upgrade: (res, req, context) => {
        const session = req.getQuery();

        res.upgrade({ client: null, ipAddress: "", session: session, gamemode: req.getUrl().slice(1) } as ClientWrapper,
            req.getHeader('sec-websocket-key'),
            req.getHeader('sec-websocket-protocol'),
            req.getHeader('sec-websocket-extensions'),
            context);
    },
    open: (ws: WebSocket<ClientWrapper>) => {
        const ipAddress = Buffer.from(ws.getRemoteAddressAsText()).toString();
        let conns = 0;
        if (connections.has(ipAddress)) conns = connections.get(ipAddress) as number;
        if (conns >= config.connectionsPerIp || bannedClients.has(ipAddress)) {
            return ws.close();
        }
        connections.set(ipAddress, conns + 1);
        const game = games.find(({ gamemode }) => gamemode === ws.getUserData().gamemode);
        if (!game) {
            return ws.close();
        }
        const client = new Client(ws, game);
        allClients.add(client);
        ws.getUserData().ipAddress = ipAddress;
        ws.getUserData().client = client;
    },
    message: (ws: WebSocket<ClientWrapper>, message, isBinary) => {
        const {client} = ws.getUserData();
        if (!client) throw new Error("Unexistant client for websocket");
        client.onMessage(message, isBinary);
    },
    close: (ws: WebSocket<ClientWrapper>, code, message) => {
        const {client, ipAddress} = ws.getUserData();
        if (client) {
            connections.set(ipAddress, connections.get(ipAddress) as number - 1);
            client.onClose(code, message);
            allClients.delete(client);
        }
    }
} as WebSocketBehavior<ClientWrapper>);

app.get("/*", (res, req) => {
    util.saveToVLog("Incoming request to " + req.getUrl());
    res.onAborted(() => {});
    if (ENABLE_API && req.getUrl().startsWith(`/${config.apiLocation}`)) {
        res.writeHeader("Access-Control-Allow-Origin", "*");

        switch (req.getUrl().slice(config.apiLocation.length + 1)) {
            case "/":
                res.writeStatus("200 OK").end();
                return;
            case "/tanks":
                res.writeStatus("200 OK").end(JSON.stringify(TankDefinitions));
                return;
            case "/servers":
                res.writeStatus("200 OK").end(JSON.stringify(games.map(({ gamemode, name }) => ({ gamemode, name }))));
                return;
            case "/commands":
                res.writeStatus("200 OK").end(JSON.stringify(config.enableCommands ? Object.values(commandDefinitions) : []));
                return;
            case "/colors":
                res.writeStatus("200 OK").end(JSON.stringify(ColorsHexCode));
                return;
        }
    }

    if (ENABLE_CLIENT) {
        let file: string | null = null;
        let contentType = "text/html"
        switch (req.getUrl()) {
            case "/":
                file = config.clientLocation + "/index.html";
                contentType = "text/html";
                break;
            case "/loader.js":
                file = config.clientLocation + "/loader.js";
                contentType = "application/javascript";
                break;
            case "/input.js":
                file = config.clientLocation + "/input.js";
                contentType = "application/javascript";
                break;
            case "/dma.js":
                file = config.clientLocation + "/dma.js";
                contentType = "application/javascript";
                break;
            case "/config.js":
                file = config.clientLocation + "/config.js";
                contentType = "application/javascript";
                break;
            case "/util.js":
                file = config.clientLocation + "/util.js";
                contentType = "application/javascript";
                break;
            case "/diepStyle.js":
                file = config.clientLocation + "/diepStyle.js";
                contentType = "application/javascript";
                break;
            case "/diepStyle.html":
                file = config.clientLocation + "/diepStyle.html";
                contentType = "application/javascript";
                break;
            case "/verify.html":
                file = config.clientLocation + "/verify.html";
                contentType = "application/javascript";
                break;
        }

        res.writeHeader("Access-Control-Allow-Origin", "*");
        res.writeHeader("Content-Type", contentType + "; charset=utf-8");

        if (file && fs.existsSync(file)) {
            res.writeStatus("200 OK").end(fs.readFileSync(file));
            return;
        }

        res.writeStatus("404 Not Found").end(fs.readFileSync(config.clientLocation + "/404.html"));
        return;
    } 
});

export async function getDiscordUserId(sessionId: string) {
    try {
        const req = await fetch(config.API_URL + "session/", {
            method: "GET",
            headers: { key: config.API_KEY, id: sessionId },
        });
        const response = await req.json();
        return response;
    } catch (err) {
        console.log(err);
    }
}

export async function isDiscordVerified(sessionId: string) {
    try {
        const req = await fetch(config.API_URL + "discord/", {
            method: "GET",
            headers: { key: config.API_KEY, id: sessionId },
        });
        const response = await req.json();
        return response;
    } catch (err) {
        console.log(err);
    }
}

app.listen(PORT, (success) => {
    if (!success) throw new Error("Server failed");
    util.log(`Listening on port ${PORT}`);

    const ranked = new GameServer(RankedTeamsArena, "4V4");
    const rankedMaze = new GameServer(RankedMazeTeamsArena, "4V4 Maze");
    const team4tdm = new GameServer(Ranked4TeamsArena, "4V4V4V4");
    const rankedRandomMaze = new GameServer(RankedTeamsRandomMazeArena, "4V4 Random Maze");

    //const siege = new GameServer(SiegeArena, "Siege");
    const toxic = new GameServer(RankedTeamsGasArena, "4V4 Toxic");
    const tdm = new GameServer(TDMArena, "TDM");
    const training = new GameServer(TrainingArena, "Training");

    games.push(ranked, rankedMaze, rankedRandomMaze, tdm, team4tdm, toxic, training);

    util.saveToLog("Servers up", "All servers booted up.", 0x37F554);
    util.log("Dumping endpoint -> gamemode routing table");
    for (const game of games) {
        console.log("> " + `localhost:${config.serverPort}/${game.gamemode}`.padEnd(40, " ") + " -> " + game.name);
    }
});

process.on("uncaughtException", (error) => {
    util.saveToLog("Uncaught Exception", '```\n' + error.stack + '\n```', 0xFF0000);

    throw error;
});
