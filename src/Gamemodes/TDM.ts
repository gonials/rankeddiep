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

import Client from "../Client";
import { ClientBound, Color, ColorsHexCode, ArenaFlags, Tank, ValidScoreboardIndex } from "../Const/Enums";
import { getTankById } from "../Const/TankDefinitions";
import { TeamEntity } from "../Entity/Misc/TeamEntity";
import LivingEntity from "../Entity/Live";
import TankBody from "../Entity/Tank/TankBody";
import GameServer from "../Game";
import ArenaEntity, { ArenaState } from "../Native/Arena";
import { Entity } from "../Native/Entity";
import { tps } from "../config";
import { randomFrom } from "../util";

import ShapeManager from "../Misc/ShapeManager";

const arenaSize = 8000;
const TEAM_COLORS = [Color.TeamBlue, Color.TeamRed];
const MAX_KILLS = 25;
const RESPAWN_TIME = 3 * tps; // 3 seconds

const SPAMMER_TANK_IDS: Tank[] = [
    Tank.SpreadShot,
    Tank.PentaShot,
    Tank.OctoTank
]

const BANNED_TANK_IDS: Tank[] = [
    Tank.SpreadShot,
    Tank.PentaShot,
    Tank.OctoTank
]

/**
 * Manage shape count.
 */
export class TDMShapeManager extends ShapeManager {
    protected get wantedShapes() {
        /*const ratio = Math.ceil(Math.pow(this.game.arena.width / 2500, 2));

        return Math.floor(12.5 * ratio);*/
        
        return 0;
    }
}

export type RespawnData = {
    respawnTick: number;
    name: string;
}

/**
 * TDM Gamemode Arena
 */
export default class TDMArena extends ArenaEntity {
    static override GAMEMODE_ID: string = "tdm";

    protected shapes: ShapeManager = new TDMShapeManager(this);

    /** How long the game lasts before a winning team is chosen. */
    public timer: number = 8 * 60 * tps; // 8 mins

    /** All team entities in game */
    public teams: TeamEntity[] = [];

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

        for (const teamColor of TEAM_COLORS) {
            const team = new TeamEntity(this.game, teamColor);
            this.teamScoreMap.set(team, 0);
            this.teams.push(team);
        }

        this.updateBounds(arenaSize * 2, arenaSize * 2);
    }

    public decideTeam(client: Client): TeamEntity {  
        const team = this.playerTeamMap.get(client) || randomFrom(this.teams);
        this.playerTeamMap.set(client, team);

        return team;
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

                this.game.broadcastMessage(
                    `${killerName} eliminated ${victimName}`,
                    ColorsHexCode[tank.styleData.values.color]
                )

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

        const team = this.decideTeam(client);
        TeamEntity.setTeam(team, tank);
        
        const success = this.attemptFactorySpawn(tank);
        if (success) return; // This player spawned from a factory
        
        const { x, y } = this.findPlayerSpawnLocation();
        tank.positionData.values.x = x;
        tank.positionData.values.y = y;
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

        if (this.timer <= 0 && this.state === ArenaState.OPEN) {
            if (!this.isDraw()) {
                this.game.broadcastMessage(
                   `${leaderTeam.teamName} HAS WON THE GAME!`,
                    ColorsHexCode[leaderTeam.teamData.values.teamColor],
                    -1
                )
                
                this.announcePlayerScores();

                this.state = ArenaState.OVER;
                 setTimeout(() => {
                    this.close();
                }, 5000);
            }
        }
        super.updateArenaState();
    }
    
    isDraw() {
        const check = (team: TeamEntity) => {
            const leaderTeam = this.teams[0];
            const leaderScore = this.getTeamScore(leaderTeam);

            return (team !== leaderTeam && this.getTeamScore(team) === leaderScore);
        }

        return this.teams.some(check);
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

    public isTankUpgradeAllowed(client: Client, tankId: Tank): boolean {
        if (BANNED_TANK_IDS.includes(tankId)) {
            client.notify("This tank is disabled for this gamemode", 0xff0000, 7500, "tankban");
            return false;
        }
        
        const disabledTanks = this.getClientDisabledTanks(client);
        if (disabledTanks.includes(tankId)) {
            client.notify("Level 45 tanks can be only be used once per round", 0xff0000, 7500, "tankban");

            return false;
        }
        
        const team = this.playerTeamMap.get(client);
        if (!TeamEntity.isTeam(team)) return true;

        const teamPlayers = this.getTeamPlayers(team);
        if (SPAMMER_TANK_IDS.includes(tankId)) {
            for (let i = 0; i < teamPlayers.length; ++i) {
                const player = teamPlayers[i];

                if (SPAMMER_TANK_IDS.includes(player.currentTank as Tank)) {
                    client.notify("Only one unfocused spammer is allowed per team", 0xff0000, 7500, "nospam");
                    return false;
                }
            }
        }

        return true;
    }

    public tick(tick: number) {
        if (this.state === ArenaState.OPEN) {
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
