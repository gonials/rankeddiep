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
import ClientCamera from "../../Native/Camera";
import ObjectEntity from "../Object";
import AbstractIndicator from "./AbstractIndicator";
import TankBody from "../Tank/TankBody";
import { Entity } from "../../Native/Entity";
import { NameGroup } from "../../Native/FieldGroups";

import { PhysicsFlags, StyleFlags, Color } from "../../Const/Enums";
import { DevTank } from "../../Const/DevTankDefinitions"
import { removeFast } from "../../util";
import { tps } from "../../config";

const DISTRESS_DURATION = 5 * tps;

export default class MinimapIndicator extends AbstractIndicator {
    /** Will be -1 if disabled */
    public distressUntil: number = -1;

    public constructor(entity: ObjectEntity) {
        super(entity);

        this.styleData.values.opacity = 0;

        this.createWorkaround();
        this.update();
    }

    public update() {
        if (!Entity.exists(this.followEntity)) return this.destroy(false);

        this.positionData.x = this.followEntity.positionData.values.x;
        this.positionData.y = this.followEntity.positionData.values.y;
        this.physicsData.size = this.game.arena.width / (this.distressUntil !== -1 ? 35 : 50);
        this.styleData.color = this.followEntity.styleData.values.color;
        this.relationsData.values.team = this.followEntity.relationsData.values.team;
    }
    
    public setIndicatorEntity() {
        this.physicsData.flags |= PhysicsFlags.showsOnMap;
        
        this.game.entities.indicatorEntities.push(this.id);
    }

    public isVisible(camera: ClientCamera) {
        if (TankBody.isTank(this.followEntity) && this.followEntity.definition.flags.isSpectator) return false;

        const player = camera.cameraData.values.player;
        if (this.relationsData.values.team === camera.relationsData.values.team) {
            if (this.followEntity !== player || this.distressUntil !== -1) return true;
        }
        
        return false;
    }

    public createWorkaround() {
        // Workaround due to a rendering bug in the diep.io client - must have an attached entity to properly render circles on the minimap
        const workaroundEntity = new ObjectEntity(this.game);
        workaroundEntity.setParent(this);
    }
    
    public distressSignal() {
        this.distressUntil = this.game.tick + DISTRESS_DURATION;
        
        this.styleData.flags |= StyleFlags.isStar;
        this.positionData.angle = Math.PI / 4;
        this.physicsData.sides = 4;
        this.physicsData.size = this.game.arena.width / 35;
    }
    
    public deactivateDistress() {
        this.distressUntil = -1;

        this.styleData.flags &= ~StyleFlags.isStar;
        this.positionData.angle = 0;
        this.physicsData.sides = 1;
    }

    public tick(tick: number) {
        super.tick(tick);
        
        if (this.distressUntil !== -1) {
            if (tick >= this.distressUntil) this.deactivateDistress();
        }
    }
}
