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
import AbstractRankedArena, { RankedConfig } from "./AbstractRanked";
import TeamBase from "../../Entity/Misc/TeamBase";
import MazeWall from "../../Entity/Misc/MazeWall";

import { Entity } from "../../Native/Entity";
import { removeFast } from "../../util";
import { Color, Tank } from "../../Const/Enums";
import MazeGenerator, { MazeGeneratorConfig } from "../../Misc/MazeGenerator";

const GRID_SIZE = 25;
const CELL_SIZE = 600;

const arenaSize = GRID_SIZE * CELL_SIZE / 2;

const mazeConfig: MazeGeneratorConfig = {
    // potato gen
    size: GRID_SIZE,
    baseSeedCount: 17,
    seedCountVariation: 5,
    turnChance: 0.35,
    branchChance: 0.3,
    terminationChance: 0.65 //was 0.6 - potato

    // my gen 02/20/2026
    /*
    baseSeedCount: 17,
    seedCountVariation: 10,
    turnChance: 0.3,
    branchChance: 0.3,
    terminationChance: 0.7
    */ 

    /*
    baseSeedCount: 20,
    seedCountVariation: 10,
    turnChance: 0.3,
    branchChance: 0.3,
    terminationChance: 0.3
    */
}

const config: RankedConfig = {
    arenaSize: arenaSize,
    baseSize: arenaSize / (3 + 1/3) * 0.6,
    minSize: arenaSize / 10,
    shrinkAmount: 2.5,
    playersPerTeam: 4,
    teamColors: [Color.TeamBlue, Color.TeamRed],
    bannedTanks: [Tank.SpreadShot, Tank.PentaShot, Tank.OctoTank]
}

export default class RankedMazeTeamsArena extends AbstractRankedArena {
    static override GAMEMODE_ID: string = "ranked-maze";

    public mazeGenerator: MazeGenerator = new MazeGenerator(mazeConfig);

    public mazeWalls: MazeWall[] = [];

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
