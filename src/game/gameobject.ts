import { ExistingObject } from "./existingobject.js";
import { Vector } from "../math/vector.js";
import { Rectangle } from "../math/rectangle.js";
import { ProgramEvent } from "../core/event.js";
import { Canvas, Bitmap, Flip } from "../gfx/canvas.js";
import { GROUND_LEVEL } from "./game.js";


export const updateSpeedAxis = (speed : number, target : number, step : number) : number => {

    if (speed < target) {

        return Math.min(target, speed + step);
    }
    return Math.max(target, speed - step);
}


export class GameObject implements ExistingObject {


    protected exist : boolean = true;
    protected dying : boolean = false;

    protected pos : Vector;

    protected speed : Vector;
    protected target : Vector;
    protected friction : Vector;
    protected bounceFactor : number = 0.0;

    protected hitbox : Rectangle;

    protected shadowWidth : number = 8;
    

    constructor(x : number = 0, y : number = 0, exist : boolean = false) {

        this.pos = new Vector(x, y);

        this.speed = new Vector();
        this.target = new Vector();
        this.friction = new Vector(0.15, 0.15);

        this.hitbox = new Rectangle(0, 0, 16, 16)

        this.exist = exist;
    }


    private checkGroundCollision(event : ProgramEvent) : void {

        const ground : number = event.screenHeight - GROUND_LEVEL;
        // We allow "zero y speed" to make it impossible the enemies
        // to push other enemies with "zero y speed" through the ground.
        if (this.speed.y >= 0 && this.pos.y + this.hitbox.y + this.hitbox.h/2 > ground) {

            this.pos.y = ground - this.hitbox.y - this.hitbox.h/2;
            this.speed.y *= -this.bounceFactor;

            this.groundCollisionEvent?.(event);
        }
    }


    protected updateEvent?(globalSpeed : number, event : ProgramEvent) : void;
    protected postMovementEvent?(event : ProgramEvent) : void;
    protected groundCollisionEvent?(event : ProgramEvent) : void;
    protected die?(event : ProgramEvent) : boolean;


    protected updateMovement(event : ProgramEvent) : void {

        this.speed.x = updateSpeedAxis(this.speed.x, this.target.x, this.friction.x*event.tick);
        this.speed.y = updateSpeedAxis(this.speed.y, this.target.y, this.friction.y*event.tick);

        this.pos.x += this.speed.x*event.tick;
        this.pos.y += this.speed.y*event.tick;
    }


    public draw?(canvas : Canvas, bmp? : Bitmap) : void;


    public update(globalSpeed : number, event : ProgramEvent) : void {

        if (!this.exist) 
            return;

        if (this.dying) {

            if (this.die?.(event) ?? true) {

                this.exist = false;
                this.dying = false;
            }
            return;
        }

        this.updateEvent?.(globalSpeed, event);
        this.updateMovement(event);
        this.checkGroundCollision(event);
        this.postMovementEvent?.(event);
    }


    public drawShadow(canvas: Canvas) : void {

        const DISAPPEAR_HEIGHT : number = 512;

        if (!this.isActive()) {

            return;
        }

        const dy : number = canvas.height - GROUND_LEVEL;
        const frameShift : number = 8 - this.shadowWidth;
        const factor : number = Math.max(0.0, dy - (this.pos.y + this.hitbox.y + this.hitbox.h/2))/DISAPPEAR_HEIGHT;
        const frame : number = frameShift + ((factor*this.shadowWidth) | 0);
    
        canvas.drawBitmap("sh", Flip.None, this.pos.x - 16, dy - 16, frame*32, 0, 32, 32);
    }

    
    public doesExist = () : boolean => this.exist;
    public isDying = () : boolean => this.dying;
    public isActive = () : boolean => this.exist && !this.dying;

    public getPosition = () : Vector => this.pos.clone();
    public getSpeed = () : Vector => this.speed.clone();
    public getHitbox = () : Rectangle => this.hitbox.clone();

    public overlayRect = (target : Rectangle) : boolean => Rectangle.overlay(this.hitbox, target, this.pos);
    public overlay = (o : GameObject) : boolean => Rectangle.overlay(this.hitbox, o.hitbox, this.pos, o.pos);


    public forceKill() : void {
        
        this.exist = false;
        this.dying = false;
    }
}
