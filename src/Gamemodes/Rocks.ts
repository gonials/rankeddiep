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

import ArenaEntity from "../Native/Arena";
import GameServer from "../Game";
import Rock from "../Entity/Misc/Rock";

const arenaSize = 11150;

const rockCount = 100;
const rockCountVariation = 50;

const rockSize = 200;
const rockSizeVariation = 150;

export default class RocksArena extends ArenaEntity {
    static override GAMEMODE_ID: string = "rocks";
    /** All rock-entities. */
    public rocks: Rock[] = [];

    public constructor(game: GameServer) {
        super(game);
    
        this.updateBounds(arenaSize * 2, arenaSize * 2);
        
        const count = rockCount + Math.floor((Math.random() - 0.5) * rockCountVariation);
        for (let i = 0; i < count; ++i) {
            const pos = {
                x: ~~(Math.random() * this.width - this.width / 2),
                y: ~~(Math.random() * this.height - this.height / 2)
            }

            const size = rockSize + Math.floor((Math.random() - 0.5) * rockSizeVariation);
            this.rocks.push(new Rock(this, pos.x, pos.y, size));
        }
    }
    
    public isValidSpawnLocation(x: number, y: number): boolean {
        for (const rock of this.rocks) {
            const rockX = rock.positionData.values.x;
            const rockY = rock.positionData.values.y;
            const size = rock.physicsData.values.size;

            if ((x - rockX)**2 + (y - rockY)**2 < size**2) return false;
        }
        return true;
    }
}
