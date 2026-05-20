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
import GameServer from "../../Game";
import { Entity } from "../../Native/Entity";
import LivingEntity from "../../Entity/Live";
import TankBody from "../../Entity/Tank/TankBody";
import Gas from "../../Entity/Misc/Gas";
import TeamBase from "../../Entity/Misc/TeamBase";
import MazeWall from "../../Entity/Misc/MazeWall";
import MazeGenerator, { MazeGeneratorConfig } from "../../Misc/MazeGenerator";

import { Tank, Color, ColorsHexCode } from "../../Const/Enums";

const MAX_PROGRESS = 8000;
const PROGRESS_PER_TICK = 1.25;

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
    terminationChance: 0.65
}

const config: RankedConfig = {
    arenaSize: arenaSize,
    baseSize: arenaSize / (3 + 1/3) * 0.6,
    minSize: arenaSize / 10,
    shrinkAmount: 2.5,
    playersPerTeam: 1,
    teamColors: [Color.TeamGreen, Color.TeamRed],
    bannedTanks: [Tank.SpreadShot, Tank.PentaShot, Tank.OctoTank, Tank.TriTrapper]
}

export default class RankedTeamsGasArena extends AbstractRankedArena {
    static override GAMEMODE_ID: string = "ranked-toxic";

    public mazeGenerator: MazeGenerator = new MazeGenerator(mazeConfig);

    public mazeWalls: MazeWall[] = [];

    public rightGas: Gas;
    public leftGas: Gas;
    public topGas: Gas;
    public bottomGas: Gas;
    
    public gasProgress: number = 0;

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

        // These will be updated by the function
        this.rightGas = new Gas(this, 0, 0, 0, 0);
        this.leftGas = new Gas(this, 0, 0, 0, 0);
        this.topGas = new Gas(this, 0, 0, 0, 0);
        this.bottomGas = new Gas(this, 0, 0, 0, 0);
        this.updateGasArea();
    }
    
    public spawnPlayer(tank: TankBody, client: Client) {
        super.spawnPlayer(tank, client);
        
        const deathMixin = tank.onDeath.bind(tank); 
        tank.onDeath = (killer: LivingEntity) => {
            if (killer instanceof Gas) {
                this.game.broadcastMessage(
                    `${tank.nameData.values.name || "an unnamed tank"} dissolved`,
                    ColorsHexCode[Color.ToxicGas]
                )
            }

            deathMixin(killer);
        }
    }

    public updateGasArea() {
        const padding = this.ARENA_PADDING;
        
        const horizontalSize = this.gasProgress + padding;
        const verticalSize = this.gasProgress + padding;

        this.rightGas.physicsData.width = this.width + padding * 2;
        this.rightGas.physicsData.size = horizontalSize;
        this.rightGas.positionData.x = this.arenaData.values.rightX - horizontalSize / 2 + padding;

        this.leftGas.physicsData.width = this.width + padding * 2;
        this.leftGas.physicsData.size = horizontalSize;
        this.leftGas.positionData.x = this.arenaData.values.leftX + horizontalSize / 2 - padding;

        this.topGas.positionData.y = this.arenaData.values.topY + verticalSize / 2 - padding;
        this.topGas.physicsData.size = this.height + padding * 2 - horizontalSize * 2;
        this.topGas.physicsData.width = verticalSize;

        this.bottomGas.positionData.y = this.arenaData.values.bottomY - verticalSize / 2 + padding;
        this.bottomGas.physicsData.size = this.height + padding * 2 - horizontalSize * 2;
        this.bottomGas.physicsData.width = verticalSize;
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
        const toxins = [this.rightGas, this.leftGas, this.bottomGas, this.topGas];
        for (const wall of this.mazeWalls) {
            for (const toxin of toxins) {
                if (
                    Entity.exists(wall) &&
                    wall.relationsData.values.team !== toxin &&
                    Math.abs(wall.positionData.values.x - toxin.positionData.values.x) <= (wall.physicsData.values.size + toxin.physicsData.values.size) / 2 &&
                    Math.abs(wall.positionData.values.y - toxin.positionData.values.y) <= (wall.physicsData.values.width + toxin.physicsData.values.width) / 2
                ) { 
                    // wall.styleData.color = Color.EnemyTank;
                    wall.destroy(false);
                }
            }
        }
    }
    
    public tick(tick: number) {
        if (this.isPlaying()) {
            this.gasProgress += PROGRESS_PER_TICK;
            if (this.gasProgress > MAX_PROGRESS) this.gasProgress = MAX_PROGRESS;

            this.updateGasArea();
            this.removeWallsOutsideBounds();
        }
        super.tick(tick);
    }
}