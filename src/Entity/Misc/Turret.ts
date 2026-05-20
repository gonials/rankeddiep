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

import { Color, ColorsHexCode, NameFlags, StyleFlags, EntityTags, Tank, ClientBound } from "../../Const/Enums";
import ArenaEntity from "../../Native/Arena";
import ClientCamera, { CameraEntity } from "../../Native/Camera";
import { Entity } from "../../Native/Entity";
import { AI, AIState, Inputs } from "../AI";
import ObjectEntity from "../Object";
import LivingEntity from "../Live";
import Bullet from "../Tank/Projectile/Bullet";
import TankBody from "../Tank/TankBody";
import TeamBase from "./TeamBase";
import { TeamEntity } from "./TeamEntity";

export default class Turret extends TankBody {
    /** Size of a turret */
    public static SIZE = 75;

    /** The AI that controls how the Turret aims. */
    public ai: AI;

    public constructor(arena: ArenaEntity, tankId: Tank) {
        const inputs = new Inputs();
        const camera = new CameraEntity(arena.game);

        camera.setLevel(45);
        camera.sizeFactor = (Turret.SIZE / 50);

        super(arena.game, camera, inputs);

        this.relationsData.values.team = arena;
        this.physicsData.values.size = Turret.SIZE;

        this.relationsData.values.team = arena;
        // TODO(ABC):
        // Add setTeam method for this
        this.styleData.values.color = Color.Neutral;

        this.ai = new AI(this, true);
        this.ai.inputs = inputs;
        this.ai.movementSpeed = 0;
        this.ai.viewRange = Infinity;
        // this.ai.doAimPrediction = true;

        this.setTank(tankId);
        const def = (this.definition = Object.assign({}, this.definition));
        def.speed = camera.cameraData.values.movementSpeed = 0;
        this.nameData.values.name = "Turret";
        this.physicsData.values.absorbtionFactor = 0;
        
        this.scoreReward = 0;
        camera.cameraData.values.player = this;

        if (this.styleData.values.flags & StyleFlags.isFlashing) { // Remove spawn shield
            this.styleData.values.flags ^= StyleFlags.isFlashing;
            this.damageReduction = 1.0;
        }
        
        for (const barrel of this.barrels) {
            barrel.definition.recoil = 0;
        }
    }

    public tick(tick: number) {
        if (!this.barrels.length) return super.tick(tick)
        this.ai.aimSpeed = this.barrels[0].bulletAccel;
        this.inputs = this.ai.inputs;

        if (this.ai.state === AIState.idle) {
            const angle = this.positionData.values.angle + this.ai.passiveRotation;
            const mag = Math.sqrt((this.inputs.mouse.x - this.positionData.values.x) ** 2 + (this.inputs.mouse.y - this.positionData.values.y) ** 2);
            this.inputs.mouse.set({
                x: this.positionData.values.x + Math.cos(angle) * mag,
                y: this.positionData.values.y + Math.sin(angle) * mag
            });
        }

        super.tick(tick);
    }
}
