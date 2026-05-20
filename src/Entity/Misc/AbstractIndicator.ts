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
import TankBody from "../Tank/TankBody";
import { Entity } from "../../Native/Entity";
import { NameGroup } from "../../Native/FieldGroups";

import { PhysicsFlags, StyleFlags, Color } from "../../Const/Enums";
import { DevTank } from "../../Const/DevTankDefinitions"
import { removeFast } from "../../util";

export default class AbstractIndicator extends ObjectEntity {
    public nameData: NameGroup = new NameGroup(this);

    public followEntity: ObjectEntity;
    
    public constructor(entity: ObjectEntity) {
        super(entity.game);

        this.followEntity = entity;

        this.positionData.values.x = entity.positionData.values.x;
        this.positionData.values.y = entity.positionData.values.y;

        this.physicsData.values.sides = 1;
        this.physicsData.values.size = 50;
        this.physicsData.values.pushFactor = 0;
        this.physicsData.values.absorbtionFactor = 0;
        this.isPhysical = false;

        this.styleData.values.color = entity.styleData.values.color;
        this.styleData.values.borderWidth = 0.1;
        this.styleData.values.opacity = 0.1;
        this.styleData.values.flags |= StyleFlags.renderFirst;

        this.relationsData.values.team = entity.relationsData.values.team;

        this.setIndicatorEntity();
    }

    public update() {
        if (!Entity.exists(this.followEntity)) return this.destroy(false);
        
        this.positionData.x = this.followEntity.positionData.values.x;
        this.positionData.y = this.followEntity.positionData.values.y;
        this.relationsData.values.team = this.followEntity.relationsData.values.team;
    }
    
    public setIndicatorEntity() {
        this.physicsData.flags |= PhysicsFlags.showsOnMap;
        
        this.game.entities.indicatorEntities.push(this.id);
    }

    public isVisible(camera: ClientCamera) {
        return true;
    }
    
    public delete() {
        const indicatorEntities = this.game.entities.indicatorEntities;
        removeFast(indicatorEntities, indicatorEntities.indexOf(this.id));

        this.physicsData.values.flags &= ~PhysicsFlags.showsOnMap;
        
        super.delete();
    }

    public tick(tick: number) {
        this.update();
    }
}
