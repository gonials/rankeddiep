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
import { AddonById } from "../Tank/Addons";

import { Color, Tank, PositionFlags } from "../../Const/Enums";
import { AIState } from "../AI";

import { BarrelDefinition } from "../../Const/TankDefinitions";
import { PI2 } from "../../util";

/**
 * Definitions (stats and data) of the mounted turret on Bastion
 *
 * Bastion's gun
 */
const MountedTurretDefinition: BarrelDefinition[] = [
    {
        ...AutoTurretDefinition,
        size: 75,
        width: 17.5,
        offset: -10,
        delay: 2 / 3,
        recoil: 0.1,
        bullet: {
            ...AutoTurretDefinition.bullet,
            speed: 2.3,
            damage: 1.3,
            health: 5.75
        }
    },
    {
        ...AutoTurretDefinition,
        size: 75,
        width: 17.5,
        offset: 10,
        delay: 1 / 3,
        recoil: 0.1,
        bullet: {
            ...AutoTurretDefinition.bullet,
            speed: 2.3,
            damage: 1.3,
            health: 5.75
        }
    },
    {
        ...AutoTurretDefinition,
        size: 80,
        width: 17.5,
        recoil: 0.1,
        bullet: {
            ...AutoTurretDefinition.bullet,
            speed: 2.3,
            damage: 1.3,
            health: 5.75
        }
    }
]

/**
 * Definitions (stats and data) of the trap launcher on Bastion
 */
const TrapperDefinition: BarrelDefinition = {
    angle: 0,
    offset: 0,
    size: 185,
    width: 42,
    delay: 0,
    reload: 7,
    recoil: 2,
    isTrapezoid: false,
    trapezoidDirection: 0,
    addon: "trapLauncher",
    forceFire: true,
    bullet: {
        type: "trap",
        sizeRatio: 0.8,
        health: 12.5,
        damage: 2,
        speed: 4,
        scatterRate: 1,
        lifeLength: 8,
        absorbtionFactor: 1
    }
}

const SpawnerDefinition: BarrelDefinition = {
    angle: 0,
    offset: 0,
    size: 185,
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
        type: "minion",
        sizeRatio: 45 * Math.SQRT1_2 / (95 / 2),
        health: 15,
        damage: 3,
        speed: 1.3,
        scatterRate: 1,
        lifeLength: -1,
        absorbtionFactor: 1
    }
};

// The size of a Bastion by default
const Bastion_SIZE = 175;

/**
 * Class which represents the boss "Bastion"
 */
export default class Bastion extends AbstractBoss {

    /** Bastion's trap launchers */
    private trappers: Barrel[] = [];
    /** See AbstractBoss.movementSpeed */
    public movementSpeed = 0.2;

    public constructor(game: GameServer) {
        super(game);

        this.nameData.values.name = "Bastion";
        this.healthData.values.health = this.healthData.values.maxHealth = 5000;
        this.styleData.values.color = Color.ScoreboardBar;

        this.ai.viewRange = 0;
        this.ai.passiveRotation *= 2;

        this.physicsData.values.sides = 6;
        this.physicsData.values.size = Bastion_SIZE * Math.SQRT1_2;

        this.relationsData.values.team = game.arena;
        
        this.createBaseAddon();

        const count = this.physicsData.values.sides;
        const offset = 100 / (Bastion_SIZE * Math.SQRT1_2);
        for (let i = 0; i < count; ++i) {
            const angle = PI2 * ((i / count) + 1 / (count * 2));

            if (i % 2 === 0) {
                for (let j = 0; j < 2; ++j) {
                    this.barrels.push(new Barrel(this, {
                        ...TrapperDefinition,
                        angle: angle,
                        offset: j % 2 === 0 ? -55 : 55
                    }));
                }

                const base = new AutoTurret(this, MountedTurretDefinition, 40);
                new AddonById["heavyLauncher"](base);
                base.influencedByOwnerInputs = true;

                base.positionData.values.y = this.physicsData.values.size * Math.sin(angle) * offset;
                base.positionData.values.x = this.physicsData.values.size * Math.cos(angle) * offset;

                base.physicsData.values.flags |= PositionFlags.absoluteRotation;

                const tickBase = base.tick;
                base.tick = (tick: number) => {
                    base.positionData.y = this.physicsData.values.size * Math.sin(angle) * offset;
                    base.positionData.x = this.physicsData.values.size * Math.cos(angle) * offset;

                    tickBase.call(base, tick);
                }
            } else {
                this.barrels.push(new Barrel(this, {
                    ...SpawnerDefinition,
                    angle: angle,
                }));
            }
        }
    }

    public createBaseAddon() {
        const baseSize = Bastion_SIZE * Math.SQRT1_2 * 1.1;

        const base = new ObjectEntity(this.game);
        base.setParent(this);
        
        base.physicsData.values.sides = 6;
        base.physicsData.values.size = baseSize
        
        base.styleData.values.color = Color.Border;

        base.relationsData.values.team = this;
        
        base.tick = (tick: number) => {
            base.physicsData.size = baseSize * this.sizeFactor;
        }
    }

    public get sizeFactor() {
        return (this.physicsData.values.size / Math.SQRT1_2) / Bastion_SIZE;
    }

    public tick(tick: number) {
       super.tick(tick);

        if (this.ai.state !== AIState.possessed) {
            this.positionData.angle += this.ai.passiveRotation;
        }
    }
}
