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

import { Color, Tank, PositionFlags } from "../../Const/Enums";
import { AIState } from "../AI";

import { BarrelDefinition } from "../../Const/TankDefinitions";
import { PI2 } from "../../util";

/**
 * Definitions (stats and data) of the mounted turret on OmegaPentagon
 *
 * OmegaPentagon's gun
 */
const MountedTurretDefinition: BarrelDefinition = {
    ...AutoTurretDefinition,
    reload: 1.6,
    bullet: {
        ...AutoTurretDefinition.bullet,
        speed: 2.3,
        damage: 1,
        health: 4,
        color: Color.Neutral
    }
};

const HeavyTurretDefinition: BarrelDefinition = {
    angle: 0,
    offset: 0,
    size: 95 * 1.2,
    width: 71.4 * 1.5,
    delay: 0.01,
    reload: 5,
    recoil: 1,
    isTrapezoid: false,
    trapezoidDirection: 0,
    addon: null,
    bullet: {
        type: "bullet",
        health: 25,
        damage: 4,
        speed: 1.4,
        scatterRate: 1,
        lifeLength: 1,
        sizeRatio: 1,
        absorbtionFactor: 0.1,
        color: Color.Neutral
    }
};

/**
 * Definitions (stats and data) of the trap launcher on OmegaPentagon
 */
const SpawnerDefinition: BarrelDefinition = {
    angle: Math.PI,
    offset: 0,
    size: 175,
    width: 95,
    delay: 0,
    reload: 1.5,
    recoil: 1,
    isTrapezoid: true,
    trapezoidDirection: 0,
    addon: null,
    droneCount: 3,
    canControlDrones: true,
    bullet: {
        type: "drone",
        sizeRatio: 45 * Math.SQRT1_2 / (95 / 2),
        health: 20,
        damage: 0.75,
        speed: 1.3,
        scatterRate: 1,
        lifeLength: -1,
        absorbtionFactor: 1,
        color: Color.EnemyCrasher
    }
};

// The size of a OmegaPentagon by default
const OmegaPentagon_SIZE = 175;

/**
 * Class which represents the boss "OmegaPentagon"
 */
export default class OmegaPentagon extends AbstractBoss {
    /** See AbstractBoss.movementSpeed */
    public movementSpeed = 0.3;

    public constructor(game: GameServer) {
        super(game);
        this.nameData.values.name = "Omega Pentagon";
        this.styleData.values.color = Color.EnemyPentagon;
        this.relationsData.values.team = this.game.arena;

        this.physicsData.values.sides = 5;
        this.physicsData.values.size = OmegaPentagon_SIZE * Math.SQRT1_2;

        const count = this.physicsData.values.sides;
        const offset = 135 / (OmegaPentagon_SIZE * Math.SQRT1_2);
        for (let i = 0; i < count; ++i) {
            this.barrels.push(new Barrel(this, {
                ...SpawnerDefinition,
                angle: PI2 * ((i / count) + 1 / (count * 2))
            }));

            const base = new AutoTurret(this, MountedTurretDefinition);
            base.influencedByOwnerInputs = true;

            const angle = base.ai.inputs.mouse.angle = PI2 * (i / count);

            base.positionData.values.y = this.physicsData.values.size * Math.sin(angle) * offset
            base.positionData.values.x = this.physicsData.values.size * Math.cos(angle) * offset

            base.physicsData.values.flags |= PositionFlags.absoluteRotation;

            const tickBase = base.tick;
            base.tick = (tick: number) => {
                base.positionData.y = this.physicsData.values.size * Math.sin(angle) * offset;
                base.positionData.x = this.physicsData.values.size * Math.cos(angle) * offset;

                tickBase.call(base, tick);
            }
        }
        // Create main turret
        const base = new AutoTurret(this, HeavyTurretDefinition, 60);
        base.influencedByOwnerInputs = true;
    }

    public get sizeFactor() {
        return (this.physicsData.values.size / Math.SQRT1_2) / OmegaPentagon_SIZE;
    }

    public tick(tick: number) {
       super.tick(tick);

        if (this.ai.state !== AIState.possessed) {
            this.positionData.angle += this.ai.passiveRotation;
        }
    }
}
