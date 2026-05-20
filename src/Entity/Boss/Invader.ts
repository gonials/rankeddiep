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
import AbstractBoss from "./AbstractBoss";
import ObjectEntity from "../Object";

import { Color, Tank, StyleFlags, PositionFlags } from "../../Const/Enums";
import { AIState } from "../AI";

import { BarrelDefinition } from "../../Const/TankDefinitions";
import { PI2 } from "../../util";

/**
 * Definitions (stats and data) of the mounted turret on Invader
 *
 * Invader's gun
 */
const MountedTurretDefinition: BarrelDefinition[] = [
    {
        ...AutoTurretDefinition,
        size: 50,
        width: 42 * 0.4,
        offset: 13,
        delay: 0,
        bullet: {
            ...AutoTurretDefinition.bullet,
            speed: 2.3,
            damage: 1.3,
            health: 5.75
        }
    },
    {
        ...AutoTurretDefinition,
        size: 50,
        width: 42 * 0.4,
        offset: -13,
        delay: 0.5,
        bullet: {
            ...AutoTurretDefinition.bullet,
            speed: 2.3,
            damage: 1.3,
            health: 5.75
        }
    }
];

const CannonDefinition: BarrelDefinition[] = [
    {
        angle: 0,
        offset: 60,
        size: 105,
        width: 40,
        delay: 0,
        reload: 1,
        recoil: 1,
        isTrapezoid: false,
        trapezoidDirection: 0,
        addon: null,
        bullet: {
            type: "bullet",
            sizeRatio: 1,
            health: 12.5,
            damage: 0.56,
            speed: 1.7,
            scatterRate: 1,
            lifeLength: 1.5,
            absorbtionFactor: 1
        }
    },
    {
        angle: 0,
        offset: 35,
        size: 125,
        width: 50,
        delay: 0.5,
        reload: 1,
        recoil: 1,
        isTrapezoid: false,
        trapezoidDirection: 0,
        addon: null,
        bullet: {
            type: "bullet",
            sizeRatio: 1,
            health: 12.5,
            damage: 0.56,
            speed: 1.7,
            scatterRate: 1,
            lifeLength: 1.5,
            absorbtionFactor: 1
        }
    }
]

// The size of a Invader by default
const INVADER_SIZE = 150;

/**
 * Class which represents the boss "Invader"
 */
export default class Invader extends AbstractBoss {

    public constructor(game: GameServer) {
        super(game);
        this.movementSpeed = 1.5;
        this.nameData.values.name = "Invader";
        this.styleData.values.color = Color.NecromancerSquare;

        this.physicsData.values.sides = 3;
        this.physicsData.values.size = INVADER_SIZE * Math.SQRT1_2;
        
        this.ai.passiveRotation *= 2;
        
        this.createBarrels();

        const count = this.physicsData.values.sides;
        const offset = 60 / (INVADER_SIZE * Math.SQRT1_2);
        for (let i = 0; i < count; i++) {
            const base = new AutoTurret(this, MountedTurretDefinition);
            base.influencedByOwnerInputs = true;

            const angle = base.ai.inputs.mouse.angle = PI2 * (i / count);

            base.positionData.values.y = this.physicsData.values.size * Math.sin(angle) * offset;
            base.positionData.values.x = this.physicsData.values.size * Math.cos(angle) * offset;

            base.physicsData.values.flags |= PositionFlags.absoluteRotation;

            const tickBase = base.tick;
            base.tick = (tick: number) => {
                base.positionData.y = this.physicsData.values.size * Math.sin(angle) * offset;
                base.positionData.x = this.physicsData.values.size * Math.cos(angle) * offset;

                tickBase.call(base, tick);
            }
        }
    }
    
    public createBarrels() {
        const count = this.physicsData.values.sides;
        
        for (let i = 0; i < count; ++i) {
            for (let j = 0; j < CannonDefinition.length; ++j) {
                const definition = CannonDefinition[j];
                
                for (let l = 0; l < 2; ++l) {
                    this.barrels.push(new Barrel(this, {
                        ...definition,
                        offset: definition.offset * (l % 2 === 0 ? 1 : -1),
                        angle: PI2 * ((i / count) + 1 / (count * 2))
                    }));
                }
            }
        }
    }

    public get sizeFactor() {
        return (this.physicsData.values.size / Math.SQRT1_2) / INVADER_SIZE;
    }

    protected moveAroundMap() {
      const x = this.positionData.values.x,
      y = this.positionData.values.y
        if (this.ai.state === AIState.idle) {
            super.moveAroundMap();
        } else {
           // ...
        }
    }

    public tick(tick: number) {
       super.tick(tick);

        if (this.ai.state !== AIState.possessed) {
            this.positionData.angle += this.ai.passiveRotation * (this.ai.state === AIState.hasTarget ? 3 : 1);
        }
    }
}