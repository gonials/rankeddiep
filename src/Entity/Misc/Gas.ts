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

import ArenaEntity from "../../Native/Arena";
import LivingEntity from "../Live";

import { PositionFlags, PhysicsFlags, StyleFlags, HealthFlags, Color } from "../../Const/Enums";

export default class Gas extends LivingEntity {
    public constructor(arena: ArenaEntity, x: number, y: number, width: number, height: number) {
        super(arena.game);

        this.setGlobalEntity();

        this.positionData.values.x = x;
        this.positionData.values.y = y;
        this.positionData.values.flags |= PositionFlags.ignoresProjectiles;

        this.physicsData.values.width = height;
        this.physicsData.values.size = width;
        this.physicsData.values.sides = 2;
        this.physicsData.values.pushFactor = 0;
        this.physicsData.values.absorbtionFactor = 0;
        this.physicsData.values.flags |= PhysicsFlags.noOwnTeamCollision | PhysicsFlags.isBase;

        this.relationsData.values.team = arena;

        this.styleData.values.borderWidth = 0;
        this.styleData.values.opacity = 0.2;
        this.styleData.values.color = Color.ToxicGas;
        this.styleData.values.flags |= StyleFlags.hasNoDmgIndicator;
        this.styleData.values.zIndex = 0x7FFFFFFF;

        this.healthData.flags |= HealthFlags.hiddenHealthbar
        this.healthData.health = this.healthData.values.maxHealth = 0x7FFFFFFF;

        this.damagePerTick = 0.35;
        this.minDamageMultiplier = 1;
        this.maxDamageMultiplier = 1;
        this.damageReduction = 0;
    }
}
