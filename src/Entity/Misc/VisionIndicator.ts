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

import { PhysicsFlags, Color } from "../../Const/Enums";
import { DevTank } from "../../Const/DevTankDefinitions"
/**
 * Only used for maze walls and nothing else.
 */
export default class VisionIndicator extends AbstractIndicator {
    // public visionBuffer: ObjectEntity;
    public followEntity: TankBody;

    public constructor(entity: TankBody) {
        super(entity);
        this.followEntity = entity;
        this.physicsData.values.sides = 2;
        this.physicsData.values.flags &= ~PhysicsFlags.showsOnMap;

        this.styleData.values.borderWidth = 7.5;
        this.styleData.values.opacity = 0.25;
        this.styleData.values.color = Color.Fallen;

        
       /* this.visionBuffer = new ObjectEntity(this.game); // Will be done in update function
        this.visionBuffer.styleData.values.color = Color.Neutral;
        this.visionBuffer.setParent(this);
        this.visionBuffer.physicsData.sides = 2; */
    }
    
    public update() {
        if (!Entity.exists(this.followEntity) || !TankBody.isTank(this.followEntity)) return this.destroy(false);

        const cam = this.followEntity.cameraEntity;
        const fov = cam.cameraData.values.FOV;
        const width = (1920 / fov);
        const height = (1080 / fov);

        this.physicsData.size = width;
        this.physicsData.width = height;
       /* this.visionBuffer.physicsData.size = (width * 1.5) / 2;
        this.visionBuffer.physicsData.width = (height * 1.5) / 2;*/

        this.positionData.x = cam.cameraData.values.cameraX;
        this.positionData.y = cam.cameraData.values.cameraY;

        this.relationsData.values.team = this.followEntity.relationsData.values.team;
    }
    
    public isVisible(camera: ClientCamera) {
        const player = camera.cameraData.values.player;
        return (TankBody.isTank(player) && player["_currentTank"] === DevTank.Proxy && camera.getClient()._proxyTarget === this.followEntity.cameraEntity.getClient());
    }

    public tick(tick: number) {
        super.tick(tick);
    }
}
