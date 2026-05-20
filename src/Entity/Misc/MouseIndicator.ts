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
import ObjectEntity from "../Object";
import AbstractIndicator from "./AbstractIndicator";
import TankBody from "../Tank/TankBody";
import { Entity } from "../../Native/Entity";

import ClientCamera from "../../Native/Camera";
import { NameGroup } from "../../Native/FieldGroups";
import { ClientInputs } from "../../Client";

import { PhysicsFlags, StyleFlags, Color } from "../../Const/Enums";
import { DevTank } from "../../Const/DevTankDefinitions"
/**
 * Only used for maze walls and nothing else.
 */
export default class MouseIndicator extends AbstractIndicator {
    public followEntity: TankBody;

    public constructor(entity: TankBody) {
        super(entity);
        this.followEntity = entity;
        this.physicsData.values.sides = 4;
        this.physicsData.values.size = 30;
        this.physicsData.values.flags &= ~PhysicsFlags.showsOnMap;

        this.styleData.values.opacity = 2 / 3;
        this.styleData.values.flags |= StyleFlags.isStar;
        this.styleData.values.flags &= ~StyleFlags.renderFirst;

        this.relationsData.values.team = entity.relationsData.values.team;
        
        this.nameData.values.name = entity.nameData.values.name || "an unnamed tank";
        this.positionData.values.angle = Math.PI / 4;

        this.update();
    }
    
    public update() {
        const entity = this.followEntity;
        if (!Entity.exists(entity) || !TankBody.isTank(entity)) return this.destroy(false);
        const inputs = entity.inputs;
        if (!(inputs instanceof ClientInputs)) return this.destroy(false);

        this.positionData.x = inputs.unsafeMouseX;
        this.positionData.y = inputs.unsafeMouseY;

        this.relationsData.team = entity.relationsData.values.team;
        this.styleData.color = entity.styleData.values.color;
        
        this.nameData.name = entity.nameData.values.name || "an unnamed tank";
    }
    
    public isVisible(camera: ClientCamera) {
        const player = camera.cameraData.values.player;
        return (TankBody.isTank(player) && player["_currentTank"] === DevTank.Proxy && camera.getClient()._proxyTarget === this.followEntity.cameraEntity.getClient());
    }

    public tick(tick: number) {
        super.tick(tick);
    }
}
