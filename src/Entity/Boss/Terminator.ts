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
import Barrel from "../Tank/Barrel";
import AutoTurret, { AutoTurretDefinition } from "../Tank/AutoTurret";
import Eye from "../Tank/Eye";
import AbstractBoss from "./AbstractBoss";
import ObjectEntity from "../Object";

import { Color, Tank, StyleFlags, PositionFlags } from "../../Const/Enums";
import { AIState } from "../AI";

import { BarrelDefinition } from "../../Const/TankDefinitions";
import { PI2 } from "../../util";

const SpawnerDefinition: BarrelDefinition = {
    angle: 0,
    offset: 0,
    size: 155,
    width: 71.4,
    delay: 0,
    reload: 1.35,
    recoil: 1,
    isTrapezoid: true,
    trapezoidDirection: Math.PI,
    addon: null,
    canControlDrones: true,
    bullet: {
        type: "swarm",
        sizeRatio: 21 / (71.4 / 2),
        health: 12.5,
        damage: 0.5,
        speed: 1.5,
        scatterRate: 1,
        lifeLength: 1.5,
        absorbtionFactor: 1,
        color: Color.EnemyTank
    }
};

const CannonDefinition: BarrelDefinition = {
    angle: 0,
    offset: 0,
    size: 115,
    width: 42,
    delay: 0.5,
    reload: 1.35 / 2,
    recoil: 1,
    isTrapezoid: false,
    trapezoidDirection: 0,
    addon: null,
    bullet: {
        type: "flame",
        sizeRatio: 1,
        health: 12.5,
        damage: 0.5,
        speed: 1.5,
        scatterRate: 1,
        lifeLength: 1,
        absorbtionFactor: 1,
        color: Color.EnemyTank
    }
};

// The size of a Terminator by default
const TERMINATOR_SIZE = 180;

const EYE_SIZE = TERMINATOR_SIZE / 2.55;

/**
 * Class which represents the boss "Terminator"
 */
export default class Terminator extends AbstractBoss {
    public decors: ObjectEntity[] = [];

    public constructor(game: GameServer) {
        super(game);

        this.movementSpeed = 1.5;

        this.nameData.values.name = "Terminator";
        
        this.styleData.values.color = Color.Box;

        this.physicsData.values.sides = 3;
        this.physicsData.values.size = TERMINATOR_SIZE * Math.SQRT1_2;

        this.healthData.values.health = this.healthData.values.maxHealth = 4000;
        
        this.ai.passiveRotation *= 2;
        
        this.decors.push(new Eye(this, Color.EnemyTank, EYE_SIZE));

        const count = this.physicsData.values.sides;
        const offset = 80 / (TERMINATOR_SIZE * Math.SQRT1_2);
        for (let i = 0; i < count; ++i) {
            this.barrels.push(new Barrel(this, {
                ...SpawnerDefinition,
                angle: PI2 * ((i / count) + 1 / (count * 2))
            }));

            for (let j = 0; j < 2; ++j) {
                this.barrels.push(new Barrel(this, {
                    ...CannonDefinition,
                    angle: PI2 * ((i / count) + 1 / (count * 2)),
                    offset: j % 2 === 0 ? 80 : -80
                }));
            }
        }
    }

    public get sizeFactor() {
        return (this.physicsData.values.size / Math.SQRT1_2) / TERMINATOR_SIZE;
    }
    
    protected moveAroundMap() {
      const x = this.positionData.values.x,
      y = this.positionData.values.y
        if (this.ai.state === AIState.idle) {
            super.moveAroundMap();
        } else {
           // Do nothing...
        }
    }

    public tick(tick: number) {
       super.tick(tick);

        if (this.ai.state !== AIState.possessed) {
            this.positionData.angle += this.ai.passiveRotation * (this.ai.state === AIState.hasTarget ? 3 : 1);
        }
    }
}