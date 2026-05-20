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
import ObjectEntity from "../Object";

import Vector from "../../Physics/Vector";
import { PhysicsFlags, Color } from "../../Const/Enums";

/**
 * Movable walls.
 */
export default class Door extends ObjectEntity {
    /** The speed the door moves at. */
    public movementSpeed: number;
    /** The angle between this and the target coordinates. */
    public movementAngle: number = 0;
    /** The target coordinates of the door. */
    public target: Vector | null = null;
    
    public static newFromBounds(
        game: GameServer,
        minX: number,
        minY: number,
        maxX: number,
        maxY: number
    ): Door {
        if (minX > maxX) [minX, maxX] = [maxX, minX];
        if (minY > maxY) [minY, maxY] = [maxY, minY];

        const width = maxX - minX;
        const height = maxY - minY;

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        return new Door(game, centerX, centerY, width, height);
    }

    public constructor(game: GameServer, x: number, y: number, width: number, height: number, speed: number = 15) {
        super(game);

        this.setGlobalEntity();

        this.positionData.values.x = x;
        this.positionData.values.y = y;

        this.physicsData.values.width = width;
        this.physicsData.values.size = height;
        this.physicsData.values.sides = 2;
        this.physicsData.values.flags |= PhysicsFlags.isSolidWall;
        this.physicsData.values.pushFactor = 2;
        this.physicsData.values.absorbtionFactor = 0;

        this.movementSpeed = speed;

        this.relationsData.values.team = this.game.arena;

        this.styleData.values.borderWidth = 10;
        this.styleData.values.color = Color.Border;
    }
    
    public moveTo(target: Vector) {
        this.target = target;
        this.movementAngle = Math.atan2(target.y - this.positionData.values.y, target.x - this.positionData.values.x);

        this.setVelocity(this.movementAngle, this.movementSpeed); // Accelerate instantly
    }

    public tick(tick: number) {
        if (this.target) {
            const currentX = this.positionData.values.x;
            const currentY = this.positionData.values.y;

            const diffX = this.target.x - currentX;
            const diffY = this.target.y - currentY;

            const dist = diffX**2 + diffY**2;

            if (dist <= this.movementSpeed**2) { // Has this door reached its target?
                this.setVelocity(0, 0);

                this.positionData.values.x = this.target.x;
                this.positionData.values.y = this.target.y;

                this.target = null;
                this.movementAngle = 0;
            } else {
                // Keep moving... Perhaps one day it will reach it
                this.maintainVelocity(this.movementAngle, this.movementSpeed);
            }
        }
    }
}
