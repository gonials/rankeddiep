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
import LivingEntity from "../Live";
import { TeamGroupEntity } from "./TeamEntity";

import { HealthFlags, PhysicsFlags, StyleFlags } from "../../Const/Enums";

/**
 * Only used for maze walls and nothing else.
 */
export default class Barricade extends LivingEntity {
    /** True if this belongs to any cage. */
    public isCagePart: boolean = false;

    public constructor(game: GameServer, x: number, y: number, width: number, height: number, team: TeamGroupEntity) {
        super(game);

        this.setGlobalEntity();

        this.positionData.values.x = x;
        this.positionData.values.y = y;

        this.physicsData.values.width = height;
        this.physicsData.values.size = width;
        this.physicsData.values.sides = 2;
        this.physicsData.values.pushFactor = 2;
        this.physicsData.values.absorbtionFactor = 0;
        this.physicsData.values.flags |= PhysicsFlags.noOwnTeamCollision | PhysicsFlags.isBase;

        this.relationsData.values.team = team;

        this.styleData.values.borderWidth = 10;
        this.styleData.values.color = team.teamData.values.teamColor;
        this.styleData.values.opacity = 0.5;
        
        this.healthData.values.health = this.healthData.values.maxHealth = 7500;
        this.healthData.flags |= HealthFlags.hiddenHealthbar;

        this.damagePerTick = 5;
        this.minDamageMultiplier = 1;
        this.maxDamageMultiplier = 1;
    }
    
    public tick(tick:number) {
        super.tick(tick);
        this.styleData.opacity = Math.min(0.5, this.healthData.values.health / this.healthData.values.maxHealth);
    }
}
