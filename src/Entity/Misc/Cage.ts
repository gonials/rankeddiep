import GameServer from "../../Game";
import ObjectEntity from "../Object";
import MazeWall from "./MazeWall";
import Barricade from "./Barricade";

import { TeamGroupEntity } from "./TeamEntity";

/**
 * Creates maze wall cages.
 */
export default class Cage {
    /** The game to place the cage in. */
    public game: GameServer;
    /** Everything this cage is made of. */
    public cageParts: MazeWall[] = [];
    
    constructor(game: GameServer, x: number, y: number, size: number, wallSizeMult = 0.25, isBarricade: boolean = false, team: TeamGroupEntity | null = null) {
        this.game = game;


        if (isBarricade) {
            if (!team) throw new Error("Barricades must have a team");
            this.buildBarricade(x, y, size, wallSizeMult, team);
        } else {
            this.buildCage(x, y, size, wallSizeMult);
        }
    }
    
    public buildCage(x: number, y: number, size: number, wallSizeMult: number) {
        const wallSize = size * wallSizeMult;

        this.cageParts.push(new MazeWall(this.game, x + (-size / 2 + wallSize / 2) - wallSize, y, wallSize, size));
        this.cageParts.push(new MazeWall(this.game, x + (size / 2 - wallSize / 2) + wallSize, y, wallSize, size));
        this.cageParts.push(new MazeWall(this.game, x, y + (-size / 2 + wallSize / 2) - wallSize, size, wallSize));
        this.cageParts.push(new MazeWall(this.game, x, y + (size / 2 - wallSize / 2) + wallSize, size, wallSize));
        
        // Corner blocks
        this.cageParts.push(new MazeWall(this.game, x + (-size / 2 + wallSize / 2) - wallSize, y + (-size / 2 + wallSize / 2) - wallSize, wallSize, wallSize));
        this.cageParts.push(new MazeWall(this.game, x - (-size / 2 - wallSize / 2), y + (-size / 2 + wallSize / 2) - wallSize, wallSize, wallSize));

        this.cageParts.push(new MazeWall(this.game, x + (-size / 2 + wallSize / 2) - wallSize, y + (size / 2 - wallSize / 2) + wallSize, wallSize, wallSize));
        this.cageParts.push(new MazeWall(this.game, x - (-size / 2 - wallSize / 2), y + (size / 2 - wallSize / 2) + wallSize, wallSize, wallSize));
        
        for (const part of this.cageParts) {
            part.isCagePart = true;
        }
    }
    
    public buildBarricade(x: number, y: number, size: number, wallSizeMult: number, team: TeamGroupEntity) {
        const wallSize = size * wallSizeMult;

        this.cageParts.push(new Barricade(this.game, x + (-size / 2 + wallSize / 2) - wallSize, y, wallSize, size, team));
        this.cageParts.push(new Barricade(this.game, x + (size / 2 - wallSize / 2) + wallSize, y, wallSize, size, team));
        this.cageParts.push(new Barricade(this.game, x, y + (-size / 2 + wallSize / 2) - wallSize, size, wallSize, team));
        this.cageParts.push(new Barricade(this.game, x, y + (size / 2 - wallSize / 2) + wallSize, size, wallSize, team));
        
        // Corner blocks
        this.cageParts.push(new Barricade(this.game, x + (-size / 2 + wallSize / 2) - wallSize, y + (-size / 2 + wallSize / 2) - wallSize, wallSize, wallSize, team));
        this.cageParts.push(new Barricade(this.game, x - (-size / 2 - wallSize / 2), y + (-size / 2 + wallSize / 2) - wallSize, wallSize, wallSize, team));

        this.cageParts.push(new Barricade(this.game, x + (-size / 2 + wallSize / 2) - wallSize, y + (size / 2 - wallSize / 2) + wallSize, wallSize, wallSize, team));
        this.cageParts.push(new Barricade(this.game, x - (-size / 2 - wallSize / 2), y + (size / 2 - wallSize / 2) + wallSize, wallSize, wallSize, team));
        
        for (const part of this.cageParts) {
            part.isCagePart = true;
        }
    }
    
    public delete() {
        for (const part of this.cageParts) {
            part.delete();
        }
        
        this.cageParts.length = 0;
    }
}
