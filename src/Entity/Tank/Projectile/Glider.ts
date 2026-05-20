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

import Barrel from "../Barrel";
import Bullet from "./Bullet";

import { InputFlags } from "../../../Const/Enums";
import { BarrelDefinition, TankDefinition } from "../../../Const/TankDefinitions";
import { Inputs } from "../../AI";
import { BarrelBase } from "../TankBody";
import { CameraEntity } from "../../../Native/Camera";

/**
 * Barrel definition for the glider glider's barrel.
 */
const GliderBarrelDefinition: BarrelDefinition = {
    angle: Math.PI, // for barrel 0, should += Math.PI / 5; for barrel 1, should -= Math.PI / 5.
    offset: 0,
    size: 70,
    width: 37.8,
    delay: 0.5,
    reload: 0.75,
    recoil: 4.0,
    isTrapezoid: false,
    trapezoidDirection: 0,
    addon: null,
    forceFire: true,
    bullet: {
        type: "bullet",
        health: 0.6,
        damage: 0.6,
        speed: 0.7,
        scatterRate: 1,
        lifeLength: 0.5,
        sizeRatio: 1,
        absorbtionFactor: 1
    }
};

/**
 * Represents all gliders in game.
 */
export default class Glider extends Bullet implements BarrelBase {
    /** The glider's barrels */
    private gliderBarrels: Barrel[];
    /** The camera entity (used as team) of the glider. */
    public cameraEntity: CameraEntity;
    /** The reload time of the glider's barrel. */
    public reloadTime = 15;
    /** The inputs for when to shoot or not. (glider) */
    public inputs: Inputs;

    public constructor(barrel: Barrel, tank: BarrelBase, tankDefinition: TankDefinition | null, shootAngle: number) {
        super(barrel, tank, tankDefinition, shootAngle);

        this.cameraEntity = tank.cameraEntity;

        const gliderBarrels: Barrel[] = this.gliderBarrels =[];

        const s1Definition = {...GliderBarrelDefinition};
        s1Definition.angle += Math.PI / 5
        const s1 = new class extends Barrel {
            // Keep the width constant
            protected resize() {
                super.resize();
                this.physicsData.values.width = this.definition.width
                // this.physicsData.state.width = 0;
            }
        }(this, {...s1Definition});
        const s2Definition = {...GliderBarrelDefinition};
        s2Definition.angle -= Math.PI / 5
        const s2 = new class extends Barrel {
            // Keep the width constant
            protected resize() {
                super.resize();
                this.physicsData.width = this.definition.width
            }
        }(this, s2Definition);

        s1.styleData.values.color = this.styleData.values.color;
        s2.styleData.values.color = this.styleData.values.color;

        gliderBarrels.push(s1, s2);

        this.inputs = new Inputs();
        this.inputs.flags |= InputFlags.leftclick;
    }

    public get sizeFactor() {
        return this.physicsData.values.size / 50;
    }

    public tick(tick: number) {
        this.reloadTime = this.tank.reloadTime;
        super.tick(tick);
        if (this.deletionAnimation) return;
        // Only accurate on current version, but we dont want that
        // if (!Entity.exists(this.barrelEntity.rootParent) && (this.inputs.flags & InputFlags.leftclick)) this.inputs.flags ^= InputFlags.leftclick;
    }
}
