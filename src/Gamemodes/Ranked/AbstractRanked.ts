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

import GameServer from "../../Game";
import ArenaEntity, { ArenaState } from "../../Native/Arena";
import Client from "../../Client";
import ObjectEntity from "../../Entity/Object";
import LivingEntity from "../../Entity/Live";
import TeamBase from "../../Entity/Misc/TeamBase";
import Cage from "../../Entity/Misc/Cage";
import TankBody from "../../Entity/Tank/TankBody";
import Bullet from "../../Entity/Tank/Projectile/Bullet";
import { Entity } from "../../Native/Entity";
import ShapeManager from "../../Misc/ShapeManager";
import { TeamEntity } from "../../Entity/Misc/TeamEntity";
import { ArenaFlags, Color, ColorsHexCode, Tank, ValidScoreboardIndex } from "../../Const/Enums";
import { EntityStateFlags } from "../../Native/Entity";
import { VectorAbstract } from "../../Physics/Vector";
import { DevTank } from "../../Const/DevTankDefinitions";
import { tps, countdownDuration, gameLogsUrl, webhookUrl, host } from "../../config";
import { randomFrom, getRandomPosition, removeFast, sendToWebhook } from "../../util";

const CAGE_WALL_SIZE_MULT = 0.2;

/**
 * Manage shape count.
 */
export class RankedShapeManager extends ShapeManager {
    protected get wantedShapes() {
        return 0;
    }
}

export interface RankedConfig {
    arenaSize: number,
    baseSize: number,
    minSize: number,
    shrinkAmount: number,
    playersPerTeam: number,
    teamColors: Color[],
    bannedTanks: Tank[]
}

export type PlayerData = {
    id: string;
    tankId: Tank | DevTank;
    tankName: string;
}

export type RankedTeamData = {
    teamName: string;
    teamPlayers: PlayerData[];
}

const arenaSize = 7500;

const config: RankedConfig = { // default config stuff
    arenaSize: arenaSize,
    baseSize: arenaSize / (3 + 1/3) * 0.6,
    minSize: arenaSize / 10,
    shrinkAmount: 2.5,
    playersPerTeam: 4,
    teamColors: [Color.TeamBlue, Color.TeamRed],
    bannedTanks: [Tank.SpreadShot, Tank.PentaShot, Tank.OctoTank]
}

/**
 * 4v4 Gamemode Arena
 * To make more variants, just extend this class instead of copying all of this again.
 */
export default class AbstractRankedArena extends ArenaEntity {
    static override GAMEMODE_ID: string = "abstract-ranked";

    protected shapes: ShapeManager = new RankedShapeManager(this);
    /** All team entities in game. */
    public teams: TeamEntity[] = [];
    /** Maps clients to their teams */
    public playerTeamMap: WeakMap<Client, TeamEntity> = new WeakMap();
    /** All cages in game */
    public cages: Cage[] = [];
    
    public config: RankedConfig;

    // Will be -1 if the game has not started
    public gameStartTick: number = -1;
    
    public ticksUntilStart: number = 10 * tps; // Not to be confused with countdown

    public teamPlayerCountCache: Map<TeamEntity, number> = new Map();
    
    public playerTeamSwitchCooldown: WeakMap<Client, number> = new WeakMap();

    public initialTeamData: RankedTeamData[] = [];

    public constructor(game: GameServer) {
        super(game);

        this.config = config;
        if (this.config.teamColors.length > 4) throw new Error("Only up to 4 teams are suppported in this gamemode");


        // Extend this class, replace config with your config and do "initArena()"
        // Example:
        /*
            super(game);
            const megaConfig: RankedConfig = {
                arenaSize: arenaSize,
                baseSize: arenaSize / (3 + 1/3) * 0.6,
                minSize: arenaSize / 10,
                shrinkAmount: 5,
                playersPerTeam: 2,
                teamColors: [Color.TeamBlue, Color.TeamRed, Color.Fallen, Color.Neutral],
                bannedTanks: [Tank.Mothership]
            }
            this.config = megaConfig;
            this.initArena();
        */
    }
    
    public initArena() {
        const arenaSize = this.config.arenaSize;
        this.updateBounds(arenaSize * 2, arenaSize * 2);

        const flip = Math.random() < 0.5 ? 1 : -1;
        const cornerBases = Math.random() < 0.5;
        const sizeOffset = this.config.baseSize + 2 * this.config.baseSize * CAGE_WALL_SIZE_MULT;

        const coords: VectorAbstract[] = [
            {
                x: (cornerBases ? -arenaSize + sizeOffset / 2 : -arenaSize + sizeOffset / 2) * flip,
                y: (cornerBases ? -arenaSize + sizeOffset / 2 : 0) * flip
            },
            {
                x: (cornerBases ? arenaSize - sizeOffset / 2 : arenaSize - sizeOffset / 2) * flip,
                y: (cornerBases ? arenaSize - sizeOffset / 2 : 0) * flip
            },
            { 
                x: (cornerBases ? -arenaSize + sizeOffset / 2 : 0) * flip,
                y: (cornerBases ? arenaSize - sizeOffset / 2 : -arenaSize + sizeOffset / 2) * flip
            },
            {
                x: (cornerBases ? arenaSize - sizeOffset / 2 : 0) * flip, 
                y: (cornerBases ? -arenaSize + sizeOffset / 2 : arenaSize - sizeOffset / 2) * flip
            }
        ]

        for (let i = 0; i < this.config.teamColors.length; ++i) {
            const teamColor = this.config.teamColors[i];
            const team = new TeamEntity(this.game, teamColor);
            this.teams.push(team);

            const { x, y } = coords[i];
            const base = new TeamBase(this.game, team, x, y, this.config.baseSize, this.config.baseSize, false);

            const cage = new Cage(this.game, x, y, this.config.baseSize, CAGE_WALL_SIZE_MULT);
            for (const part of cage.cageParts) {
                part.relationsData.values.team = base;
            }
            this.cages.push(cage);
        }

        this.bossManager = null; // Disables boss spawning
    }

    public canStart(): boolean {
        if (this.state !== ArenaState.OPEN) return false;

        const playerCounts: number[] = [];
        const check = (value: number) => value === this.config.playersPerTeam; // checks if all teams are full

        for (const value of this.teamPlayerCountCache.values()) {
            playerCounts.push(value);
        }

        return playerCounts.every(check);
    }

    public isPlaying(): boolean {
        return this.state === ArenaState.OPEN && this.gameStartTick !== -1;
    }

    public decideTeam(client: Client): TeamEntity {
        let team = this.playerTeamMap.get(client); // pick team with least players
        if (!team) {
            const teamsClone = this.teams.slice();
            teamsClone.sort((t1, t2) => this.getTeamPlayerCount(t2) - this.getTeamPlayerCount(t1));
            
            team = teamsClone[teamsClone.length - 1];
        }

        this.playerTeamMap.set(client, team);

        return team;
    }
    
    public getTeamPlayerCount(team: TeamEntity): number {
        return this.teamPlayerCountCache.get(team) || this.getTeamPlayers(team).length;
    }

    public switchTeam(client: Client) {
        if (this.isPlaying() || this.isGameOver()) return;
        if (this.game.tick <= (this.playerTeamSwitchCooldown.get(client) ?? 0)) return;

        const player = client.camera?.cameraData.values.player;
        if (!ObjectEntity.isObject(player)) return;

        const currentTeam = player.relationsData.values.team as TeamEntity;
        const id = this.teams.indexOf(currentTeam);
        // if (id === -1) return;

        let newId = (id + 1) % this.teams.length;
        const newTeam = this.teams[newId];

        TeamEntity.setTeam(newTeam, player);
        // player.styleData.color = Color.Tank;
        this.playerTeamMap.set(client, newTeam);
        this.playerTeamSwitchCooldown.set(client, this.game.tick + 1.5 * tps); // 1.5 second cooldown to prevent MEGA spam

        for (let i = 1; i <= this.game.entities.lastId; ++i) {
            const entity = this.game.entities.inner[i];
            if (entity instanceof Bullet && entity.relationsData.values.owner === player) entity.destroy();
        }

        for (let i = 0; i < player.children.length; ++i) {
            const entity = player.children[i];
            entity.relationsData.values.team = player.relationsData.values.team;
        }

        const base = randomFrom(newTeam.base);
        if (!base) return;

        const { x, y } = getRandomPosition(base);

        player.positionData.x = x;
        player.positionData.y = y;
        
        player.entityState = EntityStateFlags.needsCreate | EntityStateFlags.needsDelete;
    }

    public spawnPlayer(tank: TankBody, client: Client) {
        const killMixin = tank.onKill.bind(tank); 
        tank.onKill = (victim: LivingEntity) => {
            const killerTeam = tank.relationsData.values.team as TeamEntity;
            const victimTeam = victim.relationsData.values.team as TeamEntity;

            if (TankBody.isTank(victim) && this.teams.includes(victimTeam)) {
                const killerName = tank.nameData.values.name || "an unnamed tank";
                const victimName = victim.nameData.values.name || "an unnamed tank";

                this.game.broadcastMessage(
                    `${killerName} eliminated ${victimName}`,
                    ColorsHexCode[tank.styleData.values.color]
                )
            }

            killMixin(victim);
        }

        const team = this.decideTeam(client);
        TeamEntity.setTeam(team, tank);
        // tank.styleData.color = Color.Tank;

        const success = this.attemptFactorySpawn(tank);
        if (success) return; // This player was spawned from a factory instead

        const base = randomFrom(team.base);
        if (!base) return super.spawnPlayer(tank, client);

        const pos = getRandomPosition(base);
        tank.positionData.x = pos.x;
        tank.positionData.y = pos.y;
    }

    public canResetStats(client: Client): boolean {
        if (!(this.isPlaying() || this.isGameOver())) return true;

        client.notify("Cannot reset stats while the game is active", 0xFF0000, 10_000, "stat_reset_fail");
        return false;
    }
    
    public canSuicide(client: Client) {
        const player = client.camera?.cameraData.values.player;
        if (!ObjectEntity.isObject(player) || player.deletionAnimation) return false;
        
        return !(this.isPlaying() || this.isGameOver())
    }

    public updateScoreboard(scoreboardPlayers: TankBody[]) {
        super.updateScoreboard(scoreboardPlayers);

        const scoreboardCount = this.arenaData.scoreboardAmount = (this.arenaData.values.flags & ArenaFlags.hiddenScores) ? 0 : Math.min(scoreboardPlayers.length, 10);

        for (let i = 0; i < scoreboardCount; ++i) {
            this.arenaData.values.scoreboardTanks[i as ValidScoreboardIndex] = -1; // hide tanks
        }
        
        if (this.arenaData.values.flags & ArenaFlags.showsLeaderArrow) { // No leader arrow
            this.arenaData.flags &= ~ArenaFlags.showsLeaderArrow;
        }
    }

    public updateArenaState() {
        super.updateArenaState();

        for (const team of this.teams) {
            const teamPlayerCount = this.getTeamPlayers(team).length;
            this.teamPlayerCountCache.set(team, teamPlayerCount);
        }

        const teamsClone = this.teams.slice();
        teamsClone.sort((t1, t2) => this.getTeamPlayerCount(t2) - this.getTeamPlayerCount(t1));

        const isPlaying = this.isPlaying();
        const canStart = this.canStart();

        if (isPlaying) {
            const leaderTeam = teamsClone[0];
            const alivePlayers = this.getAlivePlayers().length;

            if (alivePlayers === this.getTeamPlayerCount(leaderTeam)) { // Victory since all remaining players are on this team
                this.game.broadcastMessage(
                    `${leaderTeam.teamName} HAS WON THE GAME!`,
                    ColorsHexCode[leaderTeam.teamData.values.teamColor],
                    -1
                )
                
                this.sendMatchResult(leaderTeam);
                
                this.state = ArenaState.OVER;
                setTimeout(() => {
                    this.close();
                }, 5000);
            }
        }

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
    }
    
    public sendMatchResult(winnerTeam: TeamEntity) {
        const durationTicks = this.game.tick - this.gameStartTick;  
        const durationSeconds = Math.floor(durationTicks / tps);  
        const minutes = Math.floor(durationSeconds / 60);  
        const seconds = durationSeconds % 60;  
        const durationString = `${minutes}m ${seconds}s`;

        const allTeamData = this.initialTeamData;
        if (!allTeamData.length) {  
            // Someone dc before 30 seconds so no snapshot
            return;  
        }

        const fields = allTeamData.map(team => {
            const players = team.teamPlayers.length > 0 ? team.teamPlayers.map(p => `<@${p.id}> ${p.tankName}`).join("\n") : "No players";

            return {
                name: team.teamName,
                value: players,
                inline: true
            }
        });

        sendToWebhook({ // Public logs
            avatarUrl: "https://cdn.discordapp.com/icons/1381807913563324466/655bb8c84cb2d435c7b47f9b450befbb.webp?size=1024",
            username: host,
            content: null,
            title: `[${process.env.REGION}] ${this.game.gamemode} :: ${winnerTeam.teamName} won the round`,
            desc: `Round Duration: ${durationString}\nPlayers:`,
            color: ColorsHexCode[winnerTeam.teamData.values.teamColor],
            fields
        }, gameLogsUrl)

        sendToWebhook({ // Private logs
            avatarUrl: "https://cdn.discordapp.com/icons/1381807913563324466/655bb8c84cb2d435c7b47f9b450befbb.webp?size=1024",
            username: host,
            content: null,
            title: `${this.game.gamemode} :: ${winnerTeam.teamName} won the round`,
            desc: `Players:`,
            color: ColorsHexCode[winnerTeam.teamData.values.teamColor],
            fields
        }, webhookUrl)
    }

    public getAllTeamData() {
        const allTeamData = [];
        for (const team of this.teams) {
            const teamClientDiscords = [];

            for (const client of this.game.clients) {
                const camera = client.camera;
                
                if (!camera) continue;

                const player = camera.cameraData.values.player;
                if (!player || !TankBody.isTank(player)) continue;

                if (camera.relationsData.values.team === team && !player.definition.flags.isSpectator && Entity.exists(player)) {
                    const name = player.nameData.values.name || "An unnamed tank";

                    const tankId = player.currentTank;  
                    const tankName = player.definition.name || `Tank ${tankId}`;  
                    teamClientDiscords.push({ id: client.discordData.id, tankName, tankId });  
                }
            }
            
            allTeamData.push({ teamName: team.teamName, teamPlayers: teamClientDiscords });
            
        }

        return allTeamData;
    } 

    public startMatch() {
        this.gameStartTick = this.game.tick;
        this.game.broadcastMessage("FIGHT!", 0xFF7700, 7500, "countdown");
        setTimeout(() => {
            const activePlayers = this.getAlivePlayers().length;  
            if (activePlayers === this.teams.length * this.config.playersPerTeam) {
                this.initialTeamData = this.getAllTeamData();  
            } else {
                console.log("Snapshot skipped: Teams are not full after 10 seconds");  
            } 
        }, 10_000);
        for (const team of this.teams) {
            for (const base of team.base) {
                if (base) base.delete();
            }
        }

        for (const cage of this.cages) {
            cage.delete();
        }

        this.cages.length = 0;

        this.arenaData.flags |= ArenaFlags.noJoining;
    }
    
    public isTankUpgradeAllowed(client: Client, tankId: Tank): boolean {
        if (this.config.bannedTanks.includes(tankId)) {
            client.notify("This tank is disabled on this gamemode", 0xff0000, 7500, "tankban");
            return false;
        }

        const team = this.playerTeamMap.get(client);
        if (!TeamEntity.isTeam(team)) return true;

        const teamPlayers = this.getTeamPlayers(team);
        for (let i = 0; i < teamPlayers.length; ++i) {
            const player = teamPlayers[i];
            console.log(player.currentTank, tankId)
            if (player.currentTank === tankId) {
                client.notify("Only 1 player may use the same tank in a team", 0xff0000, 7500, "nodupe");
                return false;
            }
        }

        return true;
    }

    public tick(tick: number) {
        super.tick(tick);

        if (!this.isPlaying()) return;

        const size = Math.max(this.config.minSize, this.width - this.config.shrinkAmount);

        this.updateBounds(size, size);
    }
}
