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

import TankDefinitions from "../Const/TankDefinitions";
import { Tank } from "../Const/Enums";

export const TankRarity: Partial<Record<Tank, number>> = {
    [Tank.Annihilator]: 4,
    [Tank.Assassin]: 0.5,
    [Tank.Auto3]: 0.001,
    [Tank.Auto5]: 1,
    [Tank.AutoGunner]: 3,
    [Tank.AutoSmasher]: 0.001,
    [Tank.AutoTank]: 2,
    [Tank.AutoTrapper]: 1,
    [Tank.Basic]: 0.5,
    [Tank.Battleship]: 0.1,
    [Tank.Booster]: 4,
    [Tank.Destroyer]: 2,
    [Tank.Factory]: 6,
    [Tank.Fighter]: 6,
    [Tank.FlankGuard]: 0.1,
    [Tank.Glider]: 5,
    [Tank.Gunner]: 0.1,
    [Tank.GunnerTrapper]: 2,
    [Tank.Hunter]: 2,
    [Tank.Hybrid]: 3,
    [Tank.Landmine]: 0.01,
    [Tank.MachineGun]: 2,
    [Tank.Manager]: 1,
    [Tank.MegaTrapper]: 0.01,
    [Tank.Necromancer]: 2,
    [Tank.OctoTank]: 4,
    [Tank.Overlord]: 6.5,
    [Tank.Overseer]: 1,
    [Tank.Overtrapper]: 0.1,
    [Tank.PentaShot]: 50,
    [Tank.Predator]: 6,
    [Tank.QuadTank]: 0.05,
    [Tank.Ranger]: 1.2,
    [Tank.Rocketeer]: 4.5,
    [Tank.Skimmer]: 1,
    [Tank.Smasher]: 0.01,
    [Tank.Sniper]: 3.0,
    [Tank.Spike]: 0.01,
    [Tank.Sprayer]: 3.8,
    [Tank.SpreadShot]: 6,
    [Tank.Stalker]: 0.5,
    [Tank.Streamliner]: 2.8,
    [Tank.Trapper]: 0.001,
    [Tank.TriAngle]: 3,
    [Tank.TriTrapper]: 0.01,
    [Tank.TripleShot]: 0.1,
    [Tank.TripleTwin]: 2.8,
    [Tank.Triplet]: 4.5,
    [Tank.Twin]: 0.5,
    [Tank.TwinFlank]: 0.15,
};

const NO_DUPLICATES: Tank[] = [
    Tank.PentaShot,
    Tank.SpreadShot,
    Tank.OctoTank,
    Tank.TriTrapper,
    Tank.AutoTrapper
];

export default class RandomTankSelector {
    /** The tanks selected by this. */
    public selectedTanks: Tank[] = [];

    public getTankRarity(tankId: Tank): number {
        return TankRarity[tankId] ?? 0;
    }

    public getRandomTanks(count: number): Tank[] {
        const result: Tank[] = [];

        const allTanks = Object.keys(TankRarity).map(Number).filter(tank => this.getTankRarity(tank) > 0) as Tank[];

        let dupeCount = 0;

        for (let i = 0; i < count; i++) {
            const candidates: Tank[] = [];

            for (const tank of allTanks) {
                if (dupeCount >= 1 && NO_DUPLICATES.includes(tank)) {
                    continue;
                }

                candidates.push(tank);
            }

            if (candidates.length === 0) {
                break;
            }

            let total = 0;
            for (const tank of candidates) {
                total += this.getTankRarity(tank);
            }

            let rng = Math.random() * total;

            let chosen = candidates[0];
            for (const tank of candidates) {
                rng -= this.getTankRarity(tank);
                if (rng <= 0) {
                    chosen = tank;
                    break;
                }
            }

            result.push(chosen);

            if (NO_DUPLICATES.includes(chosen)) {
                dupeCount++;
            }
        }

        return result;
    }
}
