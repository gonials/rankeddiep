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
import AbstractRankedArena, { RankedConfig } from "./AbstractRanked";
import MazeGenerator, { MazeGeneratorConfig } from "../../Misc/MazeGenerator";
import Client from "../../Client";
import MazeWall from "../../Entity/Misc/MazeWall";
import { Entity } from "../../Native/Entity";
import ObjectEntity from "../../Entity/Object";
import LivingEntity from "../../Entity/Live";
import TeamBase from "../../Entity/Misc/TeamBase";
import Cage from "../../Entity/Misc/Cage";
import TankBody from "../../Entity/Tank/TankBody";
import Bullet from "../../Entity/Tank/Projectile/Bullet";
import Pentagon from "../../Entity/Shape/Pentagon";
import AbstractShape from "../../Entity/Shape/AbstractShape";
import ShapeManager from "../../Misc/ShapeManager";
import { TeamEntity } from "../../Entity/Misc/TeamEntity";
import { ArenaFlags, Color, ColorsHexCode, Tank, ValidScoreboardIndex, levelToScoreTable } from "../../Const/Enums";
import { EntityStateFlags } from "../../Native/Entity";
import { VectorAbstract } from "../../Physics/Vector";

import RandomTankSelector from "../../Misc/RandomTankSelector";

import { tps, countdownDuration, gameLogsUrl, webhookUrl, host } from "../../config";
import { randomFrom, getRandomPosition, removeFast, sendToWebhook } from "../../util";

const arenaSize = 9000;
const SCORE_PER_STAT_UPGRADE = levelToScoreTable[45 - 1];

const config: RankedConfig = {
    arenaSize: arenaSize,
    baseSize: arenaSize / (3 + 1/3) * 0.6,
    minSize: 750,
    shrinkAmount: 1.25,
    playersPerTeam: 1,
    teamColors: [Color.TeamBlue, Color.TeamRed, Color.TeamPurple, Color.TeamGreen],
    bannedTanks: [Tank.SpreadShot, Tank.PentaShot, Tank.OctoTank, Tank.TriTrapper]
}

const mazeConfig: MazeGeneratorConfig = {
    size: 30,
    baseSeedCount: 20,
    seedCountVariation: 10,
    turnChance: 0.3,
    branchChance: 0.3,
    terminationChance: 0.4
}

/**
 * Manage shape count.
 */
export class RankedShapeManager extends ShapeManager {  
    protected get wantedShapes() {  
        const ratio = Math.pow(this.game.arena.width / 18000, 2);

        return Math.floor(30 * ratio);
    }  
  
    protected spawnShape(): AbstractShape {
        let shape: AbstractShape;  

        // It could have gotten stuck forever if using while true in case it was impossible to find a spawn pos in the middle
        const { x, y } = this.arena.findSpawnLocation(this.arena.width / 10, this.arena.height / 10);  
        // Pentagon Nest  
        shape = new Pentagon(this.game, Math.random() <= 0.05);  
        shape.positionData.values.x = x;  
        shape.positionData.values.y = y;  
        shape.relationsData.values.owner = shape.relationsData.values.team = this.arena;  
  
        shape.scoreReward *= 2 // 250 point per pentagon
        return shape;  
    }  
}

/**
 * 4v4v4v4 Gamemode Arena
 */
export default class Ranked4TeamsArena extends AbstractRankedArena {
    static override GAMEMODE_ID: string = "ranked-4v4v4v4";

    protected shapes: ShapeManager = new RankedShapeManager(this);

    public mazeGenerator: MazeGenerator = new MazeGenerator(mazeConfig);

    public mazeWalls: MazeWall[] = [];
    
    public randomTank: Tank;
    
    public extraUpgrades: WeakMap<Client, number> = new WeakMap();
    
    public constructor(game: GameServer) {
        super(game);

        this.config = config;
        this.initArena();

        this.mazeGenerator.generate();
        this.mazeGenerator.placeWalls(this);

        for (let i = 1; i < this.game.entities.inner.length; ++i) {
            const entity = this.game.entities.inner[i];
            
            if (entity instanceof MazeWall && !entity.isCagePart) this.mazeWalls.push(entity);
        }

        this.removeIntersectingWalls();
        
        this.randomTank = new RandomTankSelector().getRandomTanks(1)[0];
        this.game.anonymousMode = true;
    }

    public removeIntersectingWalls() {
        const bases: TeamBase[] = [];
        
        for (let i = 0; i < this.teams.length; ++i) {
            const team = this.teams[i];

            for (const base of team.base) {
                if (base) bases.push(base);
            }
        }

        for (const wall of this.mazeWalls) {
            for (const base of bases) {
                if (
                    Entity.exists(wall) &&
                    wall.relationsData.values.team !== base &&
                    Math.abs(wall.positionData.values.x - base.positionData.values.x) <= (wall.physicsData.values.size + base.physicsData.values.size) / 2 &&
                    Math.abs(wall.positionData.values.y - base.positionData.values.y) <= (wall.physicsData.values.width + base.physicsData.values.width) / 2
                ) { 
                    // wall.styleData.color = Color.EnemyTank;
                    wall.destroy(false);
                }
            }
        }
    }
    
    public removeWallsOutsideBounds() {
        const halfWidth = this.width / 2;    
        const halfHeight = this.height / 2;  

        this.mazeWalls = this.mazeWalls.filter((wall) => {
            const x = wall.positionData.values.x;    
            const y = wall.positionData.values.y;  

            const wallHalfHeight = wall.physicsData.values.width / 2;  
            const wallHalfWidth = wall.physicsData.values.size / 2;  

            const leftEdge = x - wallHalfWidth;  
            const rightEdge = x + wallHalfWidth;  
            const topEdge = y - wallHalfHeight;  
            const bottomEdge = y + wallHalfHeight;  
              
            if (rightEdge > (halfWidth) || leftEdge < (-halfWidth) || bottomEdge > (halfHeight) || topEdge < (-halfHeight)) {
                wall.destroy(false);
                return false;
            }

            return true;
        });
    }

    public spawnPlayer(tank: TankBody, client: Client) {
        this.extraUpgrades.set(client, 0);
        super.spawnPlayer(tank, client);
    }

    public canResetStats(client: Client): boolean {
        if (!(this.isPlaying() || this.isGameOver())) return true;

        client.notify("Cannot reset stats while the game is active", 0xFF0000, 10_000, "stat_reset_fail");
        return false;
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

    public startMatch() {
        super.startMatch();

        /*const selectedPlayer = randomFrom(this.getTeamPlayers(team));
        if (!selectedPlayer) continue;

        const client = selectedPlayer.cameraEntity.getClient();
        if (!client) return;

        client.notify("You were given a random tank");
        selectedPlayer.setTank(this.randomTank);
        client.resetStats();*/
    }
    
    public isValidSpawnLocation(x: number, y: number): boolean {
        const { gridX, gridY } = this.mazeGenerator.getGridCell(this, x, y);
        // Should never spawn inside walls
        return this.mazeGenerator.isCellOccupied(gridX, gridY) === false;
    }

    public tick(tick: number) {
        super.tick(tick);
        this.removeWallsOutsideBounds();
    }
}
