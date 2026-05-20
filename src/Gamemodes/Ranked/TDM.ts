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


import Client from "../../Client";
import AbstractRankedArena, { RankedConfig } from "./AbstractRanked";
import { ClientBound, Color, ColorsHexCode, ArenaFlags, Tank, ValidScoreboardIndex } from "../../Const/Enums";
import { getTankById } from "../../Const/TankDefinitions";
import { TeamEntity } from "../../Entity/Misc/TeamEntity";
import LivingEntity from "../../Entity/Live";
import TankBody from "../../Entity/Tank/TankBody";
import GameServer from "../../Game";
import RankedMazeTeamsArena from "./RankedMazeTeams";
import { ArenaState } from "../../Native/Arena";
import { Entity } from "../../Native/Entity";
import { tps, scoreboardUpdateInterval } from "../../config";
import { randomFrom } from "../../util";;

const MAX_KILLS = 3;
const RESPAWN_TIME = 3 * tps; // 3 seconds

const arenaSize = 7500;

const config: RankedConfig = {
    arenaSize: arenaSize,
    baseSize: arenaSize / (3 + 1/3) * 0.6,
    minSize: arenaSize,
    shrinkAmount: 0,
    playersPerTeam: 1,
    teamColors: [Color.TeamBlue, Color.TeamRed],
    bannedTanks: [Tank.SpreadShot, Tank.PentaShot, Tank.OctoTank]
}

type RespawnData = {
    respawnTick: number;
    name: string;
}

export default class TDMArena extends AbstractRankedArena {
    static override GAMEMODE_ID: string = "tdm";

    /** How long the game lasts before a winning team is chosen. */
    public timer: number = 8 * 60 * tps; // 8 mins

    /** Total team score/kills. */
    public teamScoreMap: Map<TeamEntity, number> = new Map();

    /** Kills by each client, used for KDr calculation. */
    public clientKillsMap: WeakMap<Client, number> = new WeakMap();

    /** Deaths by each client, used for KDr calculation. */
    public clientDeathsMap: WeakMap<Client, number> = new WeakMap();

    /** Maps clients to their team */
    public playerTeamMap: WeakMap<Client, TeamEntity> = new WeakMap();

    /** Disabled tanks per client. */
    public disabledTanksMap: WeakMap<Client, Tank[]> = new WeakMap();

    /** Auto respawn data. */
    public clientsAwaitingRespawn: Map<Client, RespawnData> = new Map(); // For auto respawn, gets respawn tick

    public constructor(game: GameServer) {
        super(game);
        this.config = config;
        this.initArena();
    }
    
    public getTeamScore(team: TeamEntity): number {
        return this.teamScoreMap.get(team) || 0;
    }

    public setTeamScore(team: TeamEntity, score: number) {
        return this.teamScoreMap.set(team, score);
    }
    
    public getClientScore(client: Client): number {
        return this.clientKillsMap.get(client) || 0;
    }

    public setClientScore(client: Client, score: number) {
        return this.clientKillsMap.set(client, score);
    }
    
    public getClientDeaths(client: Client): number {
        return this.clientDeathsMap.get(client) || 0;
    }
    
    public setClientDeaths(client: Client, deathCount: number) {
        return this.clientDeathsMap.set(client, deathCount);
    }

    public getClientDisabledTanks(client: Client): Tank[] {

        return this.disabledTanksMap.get(client) || [];
    }
    
    public setClientDisabledTanks(client: Client, tankIds: Tank[]) {
        return this.disabledTanksMap.set(client, tankIds);
    }

    public toMinutesAndSeconds(ticks: number) {
        const totalSeconds = Math.floor(ticks / tps);
        const totalMinutes = Math.floor(totalSeconds / 60);

        const seconds = Math.floor(totalSeconds % 60);
        const minutes = Math.floor(totalMinutes % 60);

        return { m: minutes, s: seconds };
    }
    
    public updateArenaState() {
        this.teams.sort((t1, t2) => this.getTeamScore(t2) - this.getTeamScore(t1));
        const leaderTeam = this.teams[0];

        for (const team of this.teams) {
            const teamPlayerCount = this.getTeamPlayers(team).length;
            this.teamPlayerCountCache.set(team, teamPlayerCount);
        }

        if (this.game.tick % scoreboardUpdateInterval === 0) {
            this.updateScoreboard();
        }

        const isPlaying = this.isPlaying();
        const canStart = this.canStart();

        if (canStart && !isPlaying) { // start the game
            if (this.ticksUntilStart <= 0) {
                this.startMatch();
            }
            
            if (this.ticksUntilStart !== 0 && this.ticksUntilStart % tps === 0) {
                const secondsLeft = Math.ceil(this.ticksUntilStart / tps);
                this.game.broadcastMessage(`Game starting in ${secondsLeft}...`, 0x000000, 7500, "countdown");
            }

            this.ticksUntilStart--;
        } else {
            this.ticksUntilStart = 10 * tps;
        }

        if (isPlaying) {
            if (this.timer <= 0 || this.getTeamScore(leaderTeam) >= MAX_KILLS) { // Win condition
                if (!this.isDraw()) {
                    this.game.broadcastMessage(
                       `${leaderTeam.teamName} HAS WON THE GAME!`,
                        ColorsHexCode[leaderTeam.teamData.values.teamColor],
                        -1
                    )

                    this.announcePlayerScores();
                    this.sendMatchResult(leaderTeam);

                    this.state = ArenaState.OVER;
                     setTimeout(() => {
                        this.close();
                    }, 5000);
                }
            }
        }

        if (this.state === ArenaState.CLOSING && this.getAlivePlayers().length === 0) {
            this.state = ArenaState.CLOSED;

            // This is a one-time, end of life event, so we just use setTimeout
            setTimeout(() => {
                this.game.end();
            }, 10000);
            return;
        }
    }

    isDraw() {
        const check = (team: TeamEntity) => {
            const leaderTeam = this.teams[0];
            const leaderScore = this.getTeamScore(leaderTeam);

            return (team !== leaderTeam && this.getTeamScore(team) === leaderScore);
        }

        return this.teams.some(check);
    }
    
    public updateScoreboard() {
        const length = Math.min(10, this.teams.length); // Includes timer
        for (let i = 0; i < this.teams.length; ++i) {
            
            const team = this.teams[i];
            const score = this.getTeamScore(team);
            const scoreboardIndex = i as ValidScoreboardIndex;

            this.arenaData.values.scoreboardColors[scoreboardIndex] = team.teamData.values.teamColor;
            this.arenaData.values.scoreboardNames[scoreboardIndex] =  team.teamName;

            this.arenaData.values.scoreboardTanks[scoreboardIndex] = -1;
            this.arenaData.values.scoreboardScores[scoreboardIndex] = score;
            this.arenaData.values.scoreboardSuffixes[scoreboardIndex] = ` / ${MAX_KILLS} kills`;
        }
        
        this.arenaData.scoreboardAmount = Math.min(10, length + 1);

        // Override lowest team on scoreboard for this
        const offset = this.arenaData.values.scoreboardAmount - 1 as ValidScoreboardIndex;
        const timer = this.toMinutesAndSeconds(this.timer);

        this.arenaData.values.scoreboardColors[offset] = Color.Fallen;
        this.arenaData.values.scoreboardTanks[offset] = -1;
        this.arenaData.values.scoreboardScores[offset] = timer.m;

        let seconds = timer.s.toString();
        if (seconds.length === 1) seconds = "0" + seconds;
        this.arenaData.values.scoreboardSuffixes[offset] = `:${seconds}`
        this.arenaData.values.scoreboardNames[offset] = "";
    }

    public spawnPlayer(tank: TankBody, client: Client) {
        this.clientsAwaitingRespawn.delete(client);

        const killMixin = tank.onKill.bind(tank); 
        tank.onKill = (victim: LivingEntity) => {
            const killerTeam = tank.relationsData.values.team as TeamEntity;
            const victimTeam = victim.relationsData.values.team as TeamEntity;

            if (TankBody.isTank(victim) && this.teams.includes(victimTeam) && victim !== tank) {
                const killerName = tank.nameData.values.name || "an unnamed tank";
                const victimName = victim.nameData.values.name || "an unnamed tank";

                this.setClientScore(client, this.getClientScore(client) + 1);
                this.setTeamScore(killerTeam, this.getTeamScore(killerTeam) + 1);
            }

            killMixin(victim);
        }

        const deathMixin = tank.onDeath.bind(tank); 
        tank.onDeath = (killer: LivingEntity) => {
            deathMixin(killer);

            this.setClientDeaths(client, this.getClientDeaths(client) + 1);

            // Add selected tank to disabled list if it is a level 45 class
            const disabledTanks = this.getClientDisabledTanks(client);
            const tankDefinition = getTankById(tank.currentTank);

            if (!tankDefinition) throw new TypeError("Invalid tank ID");

            if (tankDefinition.levelRequirement >= 45) disabledTanks.push(tankDefinition.id as Tank);
            this.setClientDisabledTanks(client, disabledTanks);
            
            if (client.terminated) return;
            if (this.state >= ArenaState.CLOSING) return;

            const respawnTick = this.game.tick + RESPAWN_TIME;
            const name = tank.nameData.values.name;

            this.clientsAwaitingRespawn.set(client, { respawnTick, name });
        }
        super.spawnPlayer(tank, client)
    }

    public announcePlayerScores() {
        for (const team of this.teams) {
            const teamClients: Client[] = [];

            for (const client of this.game.clients) {
                const camera = client.camera;
                
                if (!camera) continue;
                if (camera.relationsData.values.team === team) teamClients.push(client);
            }
            
            for (const client of teamClients) {
                const kills = this.getClientScore(client);
                const deaths = this.getClientDeaths(client);
                let kdr: number | string = (kills / deaths);
                
                if (kdr === Infinity) kdr = "immortal";
                if (Number.isNaN(kdr)) kdr = "-";
                
                if (typeof kdr === "number") kdr = kdr.toFixed(2);
                
                const player = client.camera?.cameraData.values.player;
                if (!player || !TankBody.isTank(player)) continue;

                this.game.broadcastMessage(
                    `${player.nameData?.values.name || "an unnamed tank"} - kills: ${kills}, deaths: ${deaths}, KDr: ${kdr}`,
                    ColorsHexCode[player.styleData.values.color],
                    -1
                )
            }
        }
    } 

    public isTankUpgradeAllowed(client: Client, tankId: Tank): boolean {
        if (this.config.bannedTanks.includes(tankId)) {
            client.notify("This tank is disabled for this gamemode", 0xff0000, 7500, "tankban");
            return false;
        }
        
        const disabledTanks = this.getClientDisabledTanks(client);
        if (disabledTanks.includes(tankId)) {
            client.notify("Level 45 tanks can be only be used once per round", 0xff0000, 7500, "tankban");

            return false;
        }

        return true;
    }
    
    public tick(tick: number) {
        if (this.isPlaying()) {
            this.timer--;

            this.timer = Math.max(0, this.timer);
            
            if (this.state >= ArenaState.CLOSING) return;
            for (const [client, respawnData] of this.clientsAwaitingRespawn) {
                if (client.terminated) continue;

                if (this.game.tick >= respawnData.respawnTick) {
                    client.createAndSpawnPlayer(respawnData.name);
                }
            }
        }
        super.tick(tick); 
    }
}
