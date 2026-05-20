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
import { Tank, ClientBound, Color, ColorsHexCode } from "../../Const/Enums";
import LivingEntity from "../../Entity/Live";
import TankBody from "../../Entity/Tank/TankBody";
import AbstractBoss from "../../Entity/Boss/AbstractBoss";
import Drone from "../../Entity/Tank/Projectile/Drone";
import NecromancerSquare from "../../Entity/Tank/Projectile/NecromancerSquare";
import GameServer from "../../Game";
import ArenaEntity, { ArenaState } from "../../Native/Arena";
import ClientCamera from "../../Native/Camera";
import { Entity } from "../../Native/Entity";
import { randomFrom } from "../../util";

import MazeGenerator, { MazeGeneratorConfig } from "../../Misc/MazeGenerator";
import ShapeManager from "../../Misc/ShapeManager";

const HUNTED_COLOR: Color = Color.ScoreboardBar;

const GRID_SIZE = 40;
const CELL_SIZE = 510;
const ARENA_SIZE = GRID_SIZE * CELL_SIZE;

const config: MazeGeneratorConfig = {
    size: GRID_SIZE,
    baseSeedCount: 45,
    seedCountVariation: 30,
    turnChance: 0.2,
    branchChance: 0.2,
    terminationChance: 0.3
}

/**
 * Manage shape count.
 */
export class HuntShapeManager extends ShapeManager {
    protected get wantedShapes() {
        /*
        const ratio = Math.ceil(Math.pow(this.game.arena.width / 2500, 2));

        return Math.floor(12.5 * ratio);
        */

        return 0;
    }
}

/**
 * Hunt Gamemode Arena
 */
export default class HuntArena extends ArenaEntity {
    static override GAMEMODE_ID: string = "hunt";

    protected shapes: ShapeManager = new HuntShapeManager(this);

    public mazeGenerator: MazeGenerator = new MazeGenerator(config);

    /** The entity to be hunted. */
    public hunted: LivingEntity | null = null;

    public constructor(game: GameServer) {
        super(game);

        this.updateBounds(ARENA_SIZE, ARENA_SIZE);

        this.mazeGenerator.generate();
        this.mazeGenerator.placeWalls(this);

        this.bossManager = null; // Disables boss spawning
        this.game.playersOnMap = false;
    }

    public setHunted(hunted: LivingEntity) {
        if (this.state > ArenaState.OVER) return;

        if (!Entity.exists(hunted)) return;

        hunted.styleData.color = HUNTED_COLOR;
        
        hunted.healthData.health = hunted.healthData.values.maxHealth;
        
        if (TankBody.isTank(hunted)) {
            const camera = hunted.cameraEntity;
            // camera.setLevel(60);
            camera.cameraData.score = 500_000;
            camera.cameraData.statsAvailable += 17;
            
            camera.getClient()?.notify("You now regenerate 15% health per kill", ColorsHexCode[HUNTED_COLOR], 10_000, "hunted");
        }

        for (let i = 1; i <= this.game.entities.lastId; ++i) {
            const entity = this.game.entities.inner[i];  
            if (entity instanceof Drone && !(entity instanceof NecromancerSquare) && entity.relationsData.values.owner === hunted) { // Sets color of projectiles and drones
                entity.styleData.color = hunted.styleData.values.color;
            }
        }

        const killMixin = hunted.onKill.bind(hunted);
        hunted.onKill = (victim: LivingEntity) => {
            killMixin(victim);

            if (!hunted.deletionAnimation) {
                if (TankBody.isTank(victim) || AbstractBoss.isBoss(victim)) {
                    const maxHealth = hunted.healthData.values.maxHealth;
                    hunted.healthData.health += maxHealth * 0.15; // 15% of max HP

                    const newHealth = hunted.healthData.values.health;
                    if (newHealth > maxHealth) hunted.healthData.health = maxHealth;
                }
            }
        }

        const deathMixin = hunted.onDeath.bind(hunted);
        hunted.onDeath = (killer: LivingEntity) => {
            deathMixin(killer);

            const killerName = killer.nameData?.values.name || "an unnamed tank";

            this.game.broadcastMessage(
                `${hunted.nameData?.values.name || "an unnamed tank"} has been hunted by ${killerName}!`,
                ColorsHexCode[HUNTED_COLOR],
                10_000
            )

            if (TankBody.isTank(killer) && killer !== hunted) { // Fixes O key
                this.setHunted(killer);
            } else {
                this.hunted = null;
            }
        }

        this.hunted = hunted;
    }

    public updateArenaState() {
        super.updateArenaState();

        if (this.state === ArenaState.OPEN && !Entity.exists(this.hunted)) { // Select random player to be the target if there isn't one
            const players = this.getAlivePlayers();
            if (!players.length) return;

            const chosenPlayer = randomFrom(players);
            if (chosenPlayer.deletionAnimation || chosenPlayer.healthData.values.health <= 0) return;
            
            this.game.broadcastMessage(
                `${chosenPlayer.nameData.values.name || "an unnamed tank"} has been targeted!`,
                ColorsHexCode[HUNTED_COLOR],
                10_000
            )

            this.setHunted(chosenPlayer);
        }
    }

    public isValidSpawnLocation(x: number, y: number): boolean {
        const { gridX, gridY } = this.mazeGenerator.getGridCell(this, x, y);
        // Should never spawn inside walls
        return this.mazeGenerator.isCellOccupied(gridX, gridY) === false;
    }
}
