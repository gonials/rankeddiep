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

import LivingEntity from "../Entity/Live";
import ObjectEntity from "../Entity/Object";
import TeamBase from "../Entity/Misc/TeamBase";
import Cage from "../Entity/Misc/Cage";
import ShapeManager from "../Misc/ShapeManager";
import { TeamGroupEntity, TeamEntity } from "../Entity/Misc/TeamEntity";
import TankBody from "../Entity/Tank/TankBody";

import GameServer from "../Game";
import ArenaEntity, { ArenaState } from "../Native/Arena";

import { Entity } from "../Native/Entity";
import { randomFrom, getRandomPosition } from "../util";
import { tps } from "../config";

import { Color, ColorsHexCode, ArenaFlags, StyleFlags, ValidScoreboardIndex, ClientBound } from "../Const/Enums";

const arenaSize = 7500;
const baseSize = arenaSize / (3 + 1/3) * 0.6;
const domBaseSize = baseSize / 1.5;

const CAGE_WALL_SIZE_MULT = 0.2;

export class SiegeShapeManager extends ShapeManager {
    protected get wantedShapes() {
        return 0;
    }
}

export class Temple extends LivingEntity {
    public constructor(game: GameServer, team: TeamGroupEntity) {
        super(game);

        this.physicsData.values.size = this.physicsData.values.width = 750;
        this.physicsData.values.sides = 2;
        this.physicsData.values.absorbtionFactor = 0;

        this.healthData.values.health = this.healthData.values.maxHealth = 10000;
        this.damagePerTick = 10;

        this.relationsData.values.team = team;
        this.styleData.values.color = team.teamData.values.teamColor;
        
        const base = new ObjectEntity(game);
        base.setParent(this);

        base.physicsData.values.size = base.physicsData.values.width = this.physicsData.values.size * 0.8;
        base.physicsData.values.sides = 2;

        base.styleData.values.color = Color.Fallen;
        base.styleData.values.flags |= StyleFlags.showsAboveParent;
        
        const decor = new ObjectEntity(game);
        decor.setParent(this);
        decor.physicsData.values.size = 175;
        decor.physicsData.values.sides = 5;
        decor.positionData.values.angle = (Math.PI / 5) / 2;

        decor.styleData.values.color = Color.Neutral;
        decor.styleData.values.flags |= StyleFlags.showsAboveParent | StyleFlags.isStar;

        const decor2 = new ObjectEntity(game);
        decor2.setParent(this);
        decor2.physicsData.values.size = 150;
        decor2.physicsData.values.sides = 1;

        decor2.styleData.values.color = Color.Neutral;
        decor2.styleData.values.flags |= StyleFlags.showsAboveParent;
        
        const decor3 = new ObjectEntity(game);
        decor3.setParent(this);
        decor3.physicsData.values.size = 100;
        decor3.physicsData.values.sides = 1;

        decor3.styleData.values.color = Color.Neutral;
        decor3.styleData.values.flags |= StyleFlags.showsAboveParent;

        this.scoreReward = 1_000_000;
        this.setGlobalEntity();
    }
}

/**
 * Domination Gamemode Arena
 */
export default class SiegeArena extends ArenaEntity {
    static override GAMEMODE_ID: string = "siege";

    protected shapes: ShapeManager = new SiegeShapeManager(this);

    /** All dominators in game */
    public temple: Temple;

    public defenderTeam: TeamEntity;
    
    public attackerTeam: TeamEntity;

    /** Maps clients to their teams */
    public playerTeamMap: WeakMap<Client, TeamEntity> = new WeakMap();
    
    public timer: number = 10 * 60 * tps;

    public constructor(game: GameServer) {
        super(game);

        this.updateBounds(arenaSize * 2, arenaSize * 2);

        this.defenderTeam = new TeamEntity(this.game, Color.TeamBlue);
        this.attackerTeam = new TeamEntity(this.game, Color.TeamRed);

        const main = new TeamBase(game, this, 0, 0, baseSize, baseSize, false);
        main.styleData.values.color = this.defenderTeam.teamData.values.teamColor;

        new TeamBase(game, this.defenderTeam, arenaSize / 4, arenaSize / 4, domBaseSize, domBaseSize, false);
        new TeamBase(game, this.defenderTeam, arenaSize / -4, arenaSize / 4, domBaseSize, domBaseSize, false);
        new TeamBase(game, this.defenderTeam, arenaSize / -4, arenaSize / -4, domBaseSize, domBaseSize, false);
        new TeamBase(game, this.defenderTeam, arenaSize / 4, arenaSize / -4, domBaseSize, domBaseSize, false)

        new TeamBase(game, this.attackerTeam, 0, (baseSize - this.height) / 2, baseSize, this.width, false);
        new TeamBase(game, this.attackerTeam, 0, (-baseSize + this.height) / 2, baseSize, this.width, false);

        this.temple = new Temple(game, this.defenderTeam);
        const cage = new Cage(game, this.temple.positionData.values.x, this.temple.positionData.values.y, baseSize, CAGE_WALL_SIZE_MULT, true, this.defenderTeam);
    }
    
    public toMinutesAndSeconds(ticks: number) {
        const totalSeconds = Math.floor(ticks / tps);
        const totalMinutes = Math.floor(totalSeconds / 60);

        const seconds = Math.floor(totalSeconds % 60);
        const minutes = Math.floor(totalMinutes % 60);

        return { m: minutes, s: seconds };
    }
    
    public getSmallestTeam(): TeamEntity {
        const defenderCount = this.getTeamPlayers(this.defenderTeam);
        const attackerCount = this.getTeamPlayers(this.attackerTeam);

        if (defenderCount < attackerCount) return this.defenderTeam;

        return this.attackerTeam;
    }
    
    public decideTeam(client: Client): TeamEntity {
        const team = this.playerTeamMap.get(client) || this.getSmallestTeam();
        this.playerTeamMap.set(client, team);

        return team;
    }

    public spawnPlayer(tank: TankBody, client: Client) {
        const team = this.decideTeam(client);
        TeamEntity.setTeam(team, tank);

        if (team.teamData.values.teamColor === Color.TeamBlue) {
            const name = tank.nameData.values.name;
            let newName = "";

            for (let i = 0; i < name.length; ++i) {
                if (name[i] !== " ") {
                    newName += "█";
                } else {
                    newName += " ";
                }
            }

            tank.nameData.name = newName;
        }

        const success = this.attemptFactorySpawn(tank);
        if (success) return;

        const teamBase = randomFrom(team.base);
        if (!teamBase) return super.spawnPlayer(tank, client);

        const pos = getRandomPosition(teamBase);
        tank.positionData.values.x = pos.x;
        tank.positionData.values.y = pos.y;
    }
    
    public updateScoreboard() {
        const length = Entity.exists(this.temple) ? 1 : 0;

        if (length) {
            this.arenaData.values.scoreboardColors[0] = this.temple.styleData.values.color;

            this.arenaData.values.scoreboardTanks[0] = -1
            this.arenaData.values.scoreboardScores[0] = this.temple.healthData.values.health;
            this.arenaData.values.scoreboardSuffixes[0] = " HP";

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

    public checkWinCondition(): boolean {
        if (this.isOpen()) {
            if (!Entity.exists(this.temple)) {
                this.state = ArenaState.OVER;
                this.game.broadcastMessage(
                    `${this.attackerTeam.teamName} HAS WON THE GAME!`,
                    ColorsHexCode[this.attackerTeam.teamData.values.teamColor],
                    -1
                )
                this.state = ArenaState.OVER;
                return true;
            }
            
            if (this.timer <= 0) {
                this.game.broadcastMessage(
                    `${this.defenderTeam.teamName} HAS WON THE GAME!`,
                    ColorsHexCode[this.defenderTeam.teamData.values.teamColor],
                    -1
                )
                this.state = ArenaState.OVER;
                return true;
            }
        }
        return false;
    }

    public updateArenaState() {
        super.updateArenaState();

        if (this.checkWinCondition()) {
            setTimeout(() => {
                this.close();
            }, 5000);;
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
    
    public tick(tick: number) {
        if (this.state === ArenaState.OPEN) {
            this.timer--;
            if (this.timer < 0) this.timer = 0;
        }

        super.tick(tick);
    }
}
