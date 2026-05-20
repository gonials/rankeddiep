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
import ArenaEntity from "../../Native/Arena";

import ShapeManager from "../../Misc/ShapeManager";
import TankBody from "../../Entity/Tank/TankBody";
import { CameraEntity } from "../../Native/Camera";
import { Entity, EntityStateFlags } from "../../Native/Entity";
import { ArenaFlags, StyleFlags, Tank, Stat, Color, levelToScoreTable } from "../../Const/Enums";
import Client from "../../Client";
import Turret from "../../Entity/Misc/Turret";
import { TeamEntity } from "../../Entity/Misc/TeamEntity";
import ObjectEntity from "../../Entity/Object";
import { VectorAbstract } from "../../Physics/Vector";
import { randomFrom, removeFast } from "../../util";
import { tps } from "../../config";

const TURRET_COUNT = 6;
const RELOCATE_TIME = 30 * tps;
const ARENA_SIZE = 3000;

class ZeroShapeManager extends ShapeManager {
    protected get wantedShapes() {
        return 0;
    }
}

const enum Position {
    North = 0,
    South = 1,
    East = 2,
    West = 3
}

export class TrainingTurret extends Turret {
    public static randomNames: string[] = ["GurmaN", "alpha.gurman", "star defender", "civil security", "moldova", "BooraZ", "phsc", "LazyRain", "Max Teabag", "Spartan-138", "covid hoax", "yan_plazma", "gun_glock", "gun_m4a1", "SAW", "donetsk", "pokrovsk", "potatotomato", "Evey", "Sarah Connor", "John Connor", "Kyle Reese", "screen -S", "Vibe Coder", "AI Slop", "Claude Code", "Limba noastră", "American Ninja", "good dog-parkour", "707", "55126", "55127","plazma burst 2", "plazma burst 2.5", "plazma burst 3", "ТЦК", "mobilization", "Not even a bullet?", "plazma burst fttp", "azovstal", "HShot", "OneSOneK", "YippeeKiYay", "katharsys", "The Council", "Vendetta", "Turret", "professor.moriarty", "mega.moriarity", "astral ddos", "astral projection", "MK ULTRA", "gateway tapes", "secret aliens", "remote viewing", "karma", "Ghost581", "The Commander", "the red death", "Star Coalition", "Mr. Creedy", "V", "Terminator", "T-800", "[///]", "[BoZ]", "MEGA", "[///] MEГA", "gonials", "DeadShot", "FALKLANDS ARE ARGENTINE", "baZi", "moist", "LIVE FREE OR DIE", ".:Eric Gurt:.", "Noir Lime", "Proxy", "Marine", "proxy sniper", "Sinbadx", "Z", "sigma", "stalker", "CIA bot", "TF2", "Team Fortress 2", "half life", "black mesa", "gevanni.com", "Diva Lustmond", "forced mobilization in ukraine", "valve", "quake", "MGE brothers", "MGE brotherhood", "MGE train", "сосунок", "ХАХАХАХА", "я тебя выебал", "бля", "БЛЯТЬ", "хуй", "пидор", "ето ты?", "паровозик", "фембой", "фурри", "МГЕ Страшилка", "свинья", "сука", "engie", "stepfather", "отчим", "я твой отчим", "scout", "аудитории", "HOLA AMIGOS", "dark clan", "npm run server", "Hello World", "YrN", "PSYOP"]; 

    public relocateTimer: number = RELOCATE_TIME;

    constructor(arena: ArenaEntity, tankId: Tank) {
        super(arena, tankId);
        
        this.ai.doAimPrediction = true;
        
        for (let i = Stat.MovementSpeed; i < Stat.BodyDamage; ++i) this.cameraEntity.cameraData.values.statLevels.values[i] = 7;
        
        this.scoreReward = levelToScoreTable[45 - 1];
        
        this.nameData.values.name = randomFrom(TrainingTurret.randomNames);
    }
    
    public tick(tick: number) {
        this.relocateTimer--;
        if (this.relocateTimer <= 0) {
            const coords = (this.game.arena as TrainingArena).getRandomPositionOnBorder(this, randomFrom([Position.North, Position.South, Position.East, Position.West]));
            this.positionData.x = coords.x;
            this.positionData.y = coords.y;
            this.entityState |= EntityStateFlags.needsCreate | EntityStateFlags.needsDelete;
            
            this.relocateTimer = RELOCATE_TIME;
        }
        
        if (this.ai.target) {
            if (this.ai.target.styleData.values.flags & StyleFlags.isFlashing) this.ai.inputs.flags = 0; // no shoot
        }

        super.tick(tick);
    }
}

/**
 * Training Arena
 */
export default class TrainingArena extends ArenaEntity {
    static override GAMEMODE_ID = "training";

    protected shapes: ShapeManager = new ZeroShapeManager(this);
    
    public turrets: Turret[] = [];
    
    public playerTeam: TeamEntity;

    public constructor(game: GameServer) {
        super(game);

        this.updateBounds(ARENA_SIZE * 2, ARENA_SIZE * 2);
        this.arenaData.values.flags |= ArenaFlags.canUseCheats;
        
        this.playerTeam = new TeamEntity(game, Color.TeamBlue);
    }

    public spawnPlayer(tank: TankBody, client: Client): void {
        super.spawnPlayer(tank, client);
        
        tank.positionData.values.x = 0;
        tank.positionData.values.y = 0;
        TeamEntity.setTeam(this.playerTeam, tank);
        //tank.cameraEntity.cameraData.respawnLevel = 1//setLevel(1)
    }

    public getRandomPositionOnBorder(entity: ObjectEntity, pos: Position): VectorAbstract {
        const radius = entity.physicsData.values.size;

        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;
        
        const getCoords = (pos: Position): VectorAbstract => {
            const coords: VectorAbstract = { x: 0, y: 0 };

            switch (pos) {
                case Position.North: {
                    coords.x = ~~(Math.random() * (this.width - radius * 2) - (halfWidth - radius));
                    coords.y = -halfHeight + radius;
                    break;
                }

                case Position.South: {
                    coords.x = ~~(Math.random() * (this.width - radius * 2) - (halfWidth - radius));
                    coords.y = halfHeight - radius;
                    break;
                }

                case Position.East: {
                    coords.x = halfWidth - radius;
                    coords.y = ~~(Math.random() * (this.height - radius * 2) - (halfHeight - radius));
                    break;
                }

                case Position.West: {
                    coords.x = -halfWidth + radius;
                    coords.y = ~~(Math.random() * (this.height - radius * 2) - (halfHeight - radius));
                    break;
                }
                
                default: {
                    throw new Error("What the fuck is happening");
                }
            }
            
            return coords;
        }
        
        let coords = getCoords(pos);

        for (let i = 0; i < 32; ++i) {
            // Too close to tanks
            const entity = this.game.entities.collisionManager.getFirstMatch(coords.x, coords.y, 1000, 1000, (entity) => {
                if (!TankBody.isTank(entity)) return false;

                const dX = entity.positionData.values.x - coords.x;
                const dY = entity.positionData.values.y - coords.y;

                return (dX * dX + dY * dY) < 1_000_000;
            });

            if (entity) {
                coords = getCoords(pos);
                continue
            }

            // Too close to turrets
            let invalid = false;
            for (const turret of this.turrets) {
                const dX = turret.positionData.values.x - coords.x;
                const dY = turret.positionData.values.y - coords.y;

                // 300**2
                if ((dX * dX + dY * dY) < 90_000) {
                    invalid = true;
                    break;
                }
            }

            if (invalid) {
                coords = getCoords(pos);
                continue;
            }

            break;
        }

        return coords;
    }

    public spawnTurrets() {
        const needed = TURRET_COUNT - this.turrets.length;

        for (let i = 0; i < needed; ++i) {
            const turret = new TrainingTurret(this, Tank.Turret);
            const coords = this.getRandomPositionOnBorder(turret, randomFrom([Position.North, Position.South, Position.East, Position.West]));
            turret.positionData.values.x = coords.x;
            turret.positionData.values.y = coords.y;

            const deleteMixin = turret.delete.bind(turret); 
            turret.delete = () => {
                deleteMixin();
                removeFast(this.turrets, this.turrets.indexOf(turret));
            }
            this.turrets.push(turret);
        }
    }

    public updateArenaState() {
        this.spawnTurrets();
        super.updateArenaState();
    }
}