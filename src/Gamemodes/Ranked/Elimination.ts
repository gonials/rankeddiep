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
import { Color, ColorsHexCode, ArenaFlags, ValidScoreboardIndex, ClientBound } from "../../Const/Enums";
import { TeamEntity } from "../../Entity/Misc/TeamEntity";
import TankBody from "../../Entity/Tank/TankBody";
import LivingEntity from "../../Entity/Live";
import GameServer from "../../Game";
import ArenaEntity, { ArenaState } from "../../Native/Arena";
import { Entity } from "../../Native/Entity";
import { shuffleArray, removeFast, randomFrom } from "../../util";
import { tps, countdownDuration } from "../../config";

const arenaSize = 11150;
const TEAM_COLORS = [Color.TeamBlue, Color.TeamRed, Color.TeamPurple, Color.TeamGreen];
const minPlayers = TEAM_COLORS.length * 1; // 1 Per each team at the very least... or else all of this is pointless
const eliminationInterval = 5 * 60 * tps; // 5 mins
const warningTimeout = 10 * tps; // 10 seconds

/**
 * Elimination Gamemode Arena
 */
export default class EliminationArena extends ArenaEntity {
    static override GAMEMODE_ID: string = "elimination";
	
    /** All team entities in game */
    public teams: TeamEntity[] = [];
    
    /** Maps teams to their total score. */
    public teamScoreMap: Map<TeamEntity, number> = new Map();

    /** Maps clients to their team */
    public playerTeamMap: WeakMap<Client, TeamEntity> = new WeakMap();
    
    public gameStartTick: number = -1;

    public constructor(game: GameServer) {
        super(game);

        const teamOrder = TEAM_COLORS.slice();
        shuffleArray(teamOrder);

        this.shapeScoreRewardMultiplier = 3.0;
		
        for (const teamColor of teamOrder) {
            const team = new TeamEntity(this.game, teamColor);
            this.teams.push(team);
        }

        this.updateBounds(arenaSize * 2, arenaSize * 2);
    }
    
    public decideTeam(client: Client): TeamEntity {
        const team =  this.playerTeamMap.get(client) || this.teams[this.teams.length - 1]; // prefer smallest team
        this.playerTeamMap.set(client, team);

        return team;
    }

    public spawnPlayer(tank: TankBody, client: Client) {
        this.updateTeamScores(); // So players spawn on the weakest team

        const team = this.decideTeam(client);
        TeamEntity.setTeam(team, tank);

        const success = this.attemptFactorySpawn(tank);
        if (success) return; // This player was spawned from a factory instead

        const { x, y } = this.findPlayerSpawnLocation();

        tank.positionData.values.x = x;
        tank.positionData.values.y = y;
    }

    public updateScoreboard() {
        const length = Math.min(10, this.teams.length);
        for (let i = 0; i < length; ++i) {
            const team = this.teams[i];
            const score = this.getTeamScore(team);

            this.arenaData.values.scoreboardColors[i as ValidScoreboardIndex] = team.teamData.values.teamColor;
            this.arenaData.values.scoreboardNames[i as ValidScoreboardIndex] = team.teamName;
            this.arenaData.values.scoreboardScores[i as ValidScoreboardIndex] = score;
            this.arenaData.values.scoreboardTanks[i as ValidScoreboardIndex] = -1;
        }
       
        this.arenaData.scoreboardAmount = Math.min(10, length);
    }
    
    public manageCountdown() {
        if (this.state === ArenaState.COUNTDOWN) {
            this.arenaData.playersNeeded = minPlayers - this.game.clientsAwaitingSpawn.size;
            if (this.arenaData.values.playersNeeded <= 0) {
                this.arenaData.flags |= ArenaFlags.gameReadyStart;
            } else {
                this.arenaData.ticksUntilStart = countdownDuration; // Reset countdown
                if (this.arenaData.flags & ArenaFlags.gameReadyStart) this.arenaData.flags &= ~ArenaFlags.gameReadyStart;
            }
        }
        super.manageCountdown();
    }

    public updateTeamScores() {
        for (let i = 0; i < this.teams.length; ++i) {
            const team = this.teams[i];
            let score = 0;

            const teamPlayers = this.getTeamPlayers(team);
            for (const player of teamPlayers) {
                score += player.scoreData.values.score;
            }

            this.teamScoreMap.set(team, score);
        }
        this.teams.sort((t1, t2) => this.getTeamScore(t2) - this.getTeamScore(t1));
    }

    public getTeamScore(team: TeamEntity): number {
        return this.teamScoreMap.get(team) || 0;
    }
    
    public onGameStarted() {
        super.onGameStarted();
        
        this.gameStartTick = this.game.tick;
    }

    public updateArenaState() {
        super.updateArenaState();
        this.updateTeamScores();
        
        if (this.gameStartTick === -1) return;
        const tick = this.game.tick - this.gameStartTick;

        if (tick % eliminationInterval === 0 && this.state === ArenaState.OPEN) { // Remove team with least score
            const loserTeam = this.teams[this.teams.length - 1];
            removeFast(this.teams, this.teams.indexOf(loserTeam));

            for (const player of this.getTeamPlayers(loserTeam)) {
                // Move every player to a random team so the game continues
                const client = player.cameraEntity.getClient();
                if (!client) continue;

                this.playerTeamMap.delete(client); // Will be handled on respawn

                player.destroy();
                player.onDeath(loserTeam as unknown as LivingEntity);
            }

            this.game.broadcastMessage(
                `${loserTeam.teamName} has been eliminated!`,
                ColorsHexCode[loserTeam.teamData.values.teamColor],
                10_000
            )

            loserTeam.delete(); // RIP bozo
        }

        const length = Math.min(10, this.teams.length);
        for (let i = 0; i < length; ++i) {
            const team = this.teams[i];
            if (this.teams.length === 1 && this.state === ArenaState.OPEN) { // last team remaining wins
                const winnerTeam = this.teams[0];
                this.game.broadcastMessage(
                    `${winnerTeam.teamName} HAS WON THE GAME!`,
                    ColorsHexCode[winnerTeam.teamData.values.teamColor],
                    -1
                )
                this.state = ArenaState.OVER;
                setTimeout(() => {
                    this.close();
                }, 5000);
            }
        }
    }

    public tick(tick: number) {
        super.tick(tick);

        if (this.gameStartTick === -1) return;

        const gameTick = this.game.tick - this.gameStartTick;
        const elapsed = gameTick % eliminationInterval;
        const ticksLeft = eliminationInterval - elapsed; // remaining ticks until next elimination

        if (ticksLeft > 0 && ticksLeft <= warningTimeout && ticksLeft % tps === 0) {
            const seconds = Math.ceil(ticksLeft / tps);
            this.game.broadcastMessage(
                `Team with lowest score will be eliminated in ${seconds}...`,
                0xff0000,
                2500,
                "elimination"
            )
        }
    }
}
