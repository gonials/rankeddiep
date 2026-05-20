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

import Client from "../../Client";
import RankedTeamsMazeArena from "./RankedMazeTeams";
import GameServer from "../../Game";
import TankBody from "../../Entity/Tank/TankBody";

import { Tank } from "../../Const/Enums";
import { shuffleArray } from "../../util";
import RandomTankSelector from "../../Misc/RandomTankSelector";

import { getTankById } from "../../Const/TankDefinitions";  
import { ClientBound } from "../../Const/Enums";

const TANK_COUNT = 4;

export default class RankedTeamsRandomMazeArena extends RankedTeamsMazeArena {
    static override GAMEMODE_ID: string = "ranked-random-maze";

    public randomTanks: Tank[] = [];

    public constructor(game: GameServer) {
        super(game);
        
        this.randomTanks = new RandomTankSelector().getRandomTanks(TANK_COUNT);
    }

    public spawnPlayer(tank: TankBody, client: Client) {
        super.spawnPlayer(tank, client)
        
        tank.setTank(Tank.Random);
    }

    public startMatch() {
        super.startMatch();
        const tankNames = this.randomTanks.map((id) => getTankById(id)?.name).filter(Boolean);

        if (tankNames.length) {  
                this.game.broadcastMessage( 
                `Tanks Rolled: ${tankNames.join(", ")}`,
                0x000000,
                10000
            )
        }  

        for (const team of this.teams) {
            const teamPlayers = this.getTeamPlayers(team);
            shuffleArray(teamPlayers);

            for (let i = 0; i < teamPlayers.length; ++i) {
                const player = teamPlayers[i];

                if (player.currentTank !== Tank.Random) continue; // ignore devs and etc

                const randomTank = this.randomTanks[i % this.randomTanks.length];
                player.setTank(randomTank);
            }
        }
    }

    public isTankUpgradeAllowed(client: Client, tankId: Tank) {
        client.notify("Tank upgrades are disabled in random mode", 0xff0000, 7500, "noupgrade");
        return false;
    }
}
