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
import { AddonById } from "../Tank/Addons";

import { Color, Tank, PositionFlags } from "../../Const/Enums";
import { AIState } from "../AI";

import { BarrelDefinition } from "../../Const/TankDefinitions";
import { PI2 } from "../../util";

/**
 * Definitions (stats and data) of the mounted turret on Decimator
 *
 * Decimator's gun
 */
const MountedTurretDefinition: BarrelDefinition = {
    ...AutoTurretDefinition,
    size: 42 * 1.8,
    addon: "spawner",
    bullet: {
        ...AutoTurretDefinition.bullet,
        speed: 2.3,
        damage: 1.3,
        health: 5.75,
        color: Color.Neutral
    }
};

/**
 * Definitions (stats and data) of the trap launcher on Decimator
 */
const TrapperDefinition: BarrelDefinition = {
    angle: 0,
    offset: 0,
    size: 215,
    width: 42,
    delay: 0,
    reload: 5,
    recoil: 2,
    isTrapezoid: false,
    trapezoidDirection: 0,
    addon: "trapLauncher",
    forceFire: true,
    bullet: {
        type: "trap",
        sizeRatio: 0.8,
        health: 12.5,
        damage: 4,
        speed: 5,
        scatterRate: 1,
        lifeLength: 8,
        absorbtionFactor: 1,
        color: Color.Neutral
    }
}

// The size of a Decimator by default
const DECIMATOR_SIZE = 200;

/**
 * Class which represents the boss "Decimator"
 */
export default class Decimator extends AbstractBoss {

    /** Decimator's trap launchers */
    private trappers: Barrel[] = [];
    /** See AbstractBoss.movementSpeed */
    public movementSpeed = 0.2;

    public constructor(game: GameServer) {
        super(game);
        this.nameData.values.name = "Decimator";
        this.styleData.values.color = Color.kMaxColors;

        this.ai.viewRange = 0;
        this.ai.passiveRotation *= 2;

        this.physicsData.values.sides = 12;
        this.physicsData.values.size = DECIMATOR_SIZE * Math.SQRT1_2;

        const trapperCount = this.physicsData.values.sides;
        for (let i = 0; i < trapperCount; ++i) {
            // Add trap launcher
            this.trappers.push(new Barrel(this, {
                ...TrapperDefinition,
                angle: PI2 * ((i / trapperCount) + 1 / (trapperCount * 2))
            }));
        }
        
        const turretCount = this.physicsData.values.sides / 2;
        const offset = 125 / (DECIMATOR_SIZE * Math.SQRT1_2);
        for (let i = 0; i < turretCount; ++i) {
            const base = new AutoTurret(this, MountedTurretDefinition, 40);
            base.influencedByOwnerInputs = true;

            const angle = base.ai.inputs.mouse.angle = PI2 * (i / turretCount);

            base.positionData.values.y = this.physicsData.values.size * Math.sin(angle) * offset
            base.positionData.values.x = this.physicsData.values.size * Math.cos(angle) * offset

            base.physicsData.values.flags |= PositionFlags.absoluteRotation;
            
            const addon = new AddonById["heavyLauncher"](base);

            for (const turret of base.turret) {
                turret.styleData.values.color = Color.NecromancerSquare;
            }

            const tickBase = base.tick;
            base.tick = (tick: number) => {
                base.positionData.y = this.physicsData.values.size * Math.sin(angle) * offset;
                base.positionData.x = this.physicsData.values.size * Math.cos(angle) * offset;

                tickBase.call(base, tick);
            }
        }
    }

    public get sizeFactor() {
        return (this.physicsData.values.size / Math.SQRT1_2) / DECIMATOR_SIZE;
    }

    public tick(tick: number) {
       super.tick(tick);

        if (this.ai.state !== AIState.possessed) {
            this.positionData.angle += this.ai.passiveRotation;
        }
    }
}
