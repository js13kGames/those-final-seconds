import { ProgramEvent } from "../core/event.js";
import { InputState } from "../core/inputstate.js";
import { Bitmap } from "../gfx/bitmap.js";
import { Canvas } from "../gfx/canvas.js";
import { Flip } from "../gfx/flip.js";
import { Rectangle } from "../math/rectangle.js";
import { clamp } from "../math/utility.js";
import { Vector } from "../math/vector.js";
import { GROUND_LEVEL } from "./background.js";
import { CAMERA_MIN_Y } from "./constants.js";
import { next } from "./existingobject.js";
import { GameObject, updateSpeedAxis } from "./gameobject.js";
import { GasParticle } from "./gasparticle.js";
import { ProjectileGenerator } from "./projectilegenerator.js";


const ANGLE_MAX : number = 4.0;
const SHOOT_RECOVER_TIME : number = 12.0;


export class Player extends GameObject {


    private angle : number = 0.0;
    private angleTarget : number = 0.0;

    private gasSupply : GasParticle[];
    private gasTimer : number = 0.0;

    private overheatLevel : number = 0;
    // TODO: Rename
    private overheatBarTarget : number = 0.0;
    private overheatBarCurrent : number = 0.0;
    private overheatBonus : number = 0.0;
    private shootRecoverTimer : number = 0.0;

    private readonly projectiles : ProjectileGenerator;


    constructor(x : number, y : number, projectiles : ProjectileGenerator) {

        super(x, y, true);

        this.hitbox = new Rectangle(0, 2, 24, 16);

        this.friction = new Vector(0.15, 0.15);
    
        this.gasSupply = new Array<GasParticle> ();
        this.projectiles = projectiles;
    }


    private shoot(event : ProgramEvent) : void {

        const OVERHEAT_BASE : number = 0.125;
        const OVERHEAT_BONUS : number = 0.025;

        // const KNOCKBACK : number = -0.25;
        // const KNOCKBACK_MAX : number = -4.0;

        const BULLET_ANGLE : number[] = [Math.PI/10, Math.PI/12];
        const BULLET_SPEED : number[] = [3.5, 1.5];

        const baseCount : number = Math.min(5, 1 + this.overheatLevel);
        const specialCount : number = clamp(this.overheatLevel - 4, 0, 5);

        // Shoot base bullets
        const startAngleBase : number = -BULLET_ANGLE[0]*(baseCount - 1)/2;
        const startAngleSpecial : number = -BULLET_ANGLE[1]*(specialCount - 1)/2;

        for (let i = 0; i < baseCount + specialCount; ++ i) {

            const id : number = Math.min(1, (i/5) | 0);

            const angle : number = (id == 0 ? startAngleBase : startAngleSpecial) + (i % 5)*BULLET_ANGLE[id];

            const speedx : number = Math.cos(angle)*BULLET_SPEED[id];
            const speedy : number = Math.sin(angle)*BULLET_SPEED[id];

            this.projectiles.next().spawn(
                this.pos.x + 14, this.pos.y + 4, speedx + this.speed.x/4, speedy + this.speed.y/2, id, true);
        }
        this.shootRecoverTimer = SHOOT_RECOVER_TIME;

        // this.speed.x = Math.max(KNOCKBACK_MAX, KNOCKBACK*this.overheatLevel);

        this.overheatBonus = Math.min(1.0 - OVERHEAT_BASE, this.overheatBonus + OVERHEAT_BONUS);
        this.overheatBarTarget += 0.125 + this.overheatBonus;
    }


    private control(event : ProgramEvent) : void {

        const MOVE_SPEED : number = 2.0;
        const dir : Vector = new Vector();

        if ((event.input.getAction("l") & InputState.DownOrPressed) != 0) {

            dir.x = -1;
        }
        else if ((event.input.getAction("r") & InputState.DownOrPressed) != 0) {

            dir.x = 1;
        }

        if ((event.input.getAction("u") & InputState.DownOrPressed) != 0) {

            dir.y = -1;
        }
        else if ((event.input.getAction("d") & InputState.DownOrPressed) != 0) {

            dir.y = 1;
        }
        dir.normalize();

        this.target.x = dir.x*MOVE_SPEED;
        this.target.y = dir.y*MOVE_SPEED;

        this.angleTarget = dir.y*ANGLE_MAX;

        if ((event.input.getAction("s") & InputState.DownOrPressed) != 0 && 
            this.shootRecoverTimer <= 0.0) {

            this.shoot(event);
        }
    }


    private checkBorders(event : ProgramEvent) : void {

        const left : number = this.hitbox.x + this.hitbox.w/2;
        const right : number = event.screenWidth - this.hitbox.w/2 + this.hitbox.x;
        const top : number = CAMERA_MIN_Y + this.hitbox.y + this.hitbox.h/2;

        if ((this.speed.x < 0 && this.pos.x <= left) || (this.speed.x > 0 && this.pos.x >= right)) {

            this.speed.x = 0;
        }
        this.pos.x = clamp(this.pos.x, left, right);

        if (this.speed.y < 0 && this.pos.y < top) {

            this.speed.y = 0;
            this.pos.y = top;

            this.angleTarget = 0.0;
        }
    }


    private updateGas(event : ProgramEvent) : void {

        const GAS_TIME : number = 6.0;

        for (let o of this.gasSupply) {

            o.update(event);
        }

        if ((this.gasTimer -= event.tick) <= 0) {

            this.gasTimer += GAS_TIME;

            let o : GasParticle | undefined = next<GasParticle> (this.gasSupply);
            if (o === undefined) {

                o = new GasParticle();
                this.gasSupply.push(o);
            }
            o.spawn(this.pos.x - 16, this.pos.y + 4 + this.angle, -2.0 + this.speed.x, this.speed.y/2, 1.0/32.0, 0);
        }
    }


    private updateOverheatBar(event : ProgramEvent) : void {

        const OVERHEAT_BONUS_REDUCTION : number = 0.01;
        const OVERHEAT_REDUCTION_BASE : number = 1.0/120.0;
        const OVERHEAT_REDUCTION_PENALTY : number = 4.0;

        const dist : number = Math.abs(this.overheatBarTarget - this.overheatBarCurrent);

        if (this.overheatBarTarget > this.overheatBarCurrent) {

            const delta : number = Math.max(1.0/120.0, dist/30.0);
            this.overheatBarCurrent = Math.min(this.overheatBarTarget, this.overheatBarCurrent + delta*event.tick);
        }

        if (this.overheatBarCurrent >= 1.0) {

            this.overheatBarTarget = 0.0;
            this.overheatBarCurrent = 0.0;
            this.overheatLevel = Math.min(13, this.overheatLevel + 1);
        }

        if (this.overheatBonus > 0 && this.shootRecoverTimer <= 0) {

            this.overheatBonus = Math.max(0.0, this.overheatBonus - OVERHEAT_BONUS_REDUCTION*event.tick);
        }

        if (this.overheatBonus <= 0.0 && 
            this.overheatBarCurrent >= this.overheatBarTarget) {

            const reductionSpeed : number = OVERHEAT_REDUCTION_BASE/(1.0 + OVERHEAT_REDUCTION_PENALTY*(this.overheatLevel/13));

            this.overheatBarCurrent -= reductionSpeed*event.tick
            this.overheatBarTarget = this.overheatBarCurrent;

            if (this.overheatBarCurrent < 0.0) {

                if (this.overheatLevel == 0) {

                    this.overheatBarCurrent = 0.0;
                    return;
                }

                this.overheatBarCurrent += 1.0;
                -- this.overheatLevel;
            }

        }
    }


    protected updateEvent(event : ProgramEvent) : void {

        this.control(event);
        this.updateGas(event);
        this.updateOverheatBar(event);

        if (this.shootRecoverTimer > 0) {

            this.shootRecoverTimer -= event.tick;
        }
    }


    protected postMovementEvent(event : ProgramEvent) : void {
        
        const ANGLE_FRICTION : number = 0.25;

        this.checkBorders(event);
        this.angle = updateSpeedAxis(this.angle, this.angleTarget, ANGLE_FRICTION*event.tick);
    }


    protected groundCollisionEvent(event : ProgramEvent) : void {
        
        this.angleTarget = 0.0
    }


    public preDraw(canvas : Canvas) : void {

        const bmpGasParticle : Bitmap = canvas.getBitmap("gp");
        for (let o of this.gasSupply) {

            o.draw(canvas, bmpGasParticle);
        }
    }


    public draw(canvas : Canvas) : void {
        
        const dx : number = this.pos.x - 16;
        const dy : number = this.pos.y - 12;

        const angleStep : number = Math.round(this.angle);
        const angleRamp : number = (32/(1.0 + Math.abs(angleStep))) | 0;
        const dir : number = Math.sign(angleStep);
        const shifty : number = -(dir < 0 ? Math.floor : Math.ceil)(angleStep/2);

        const bmp : Bitmap = canvas.getBitmap("p");
        let y : number = 0;
        for (let x : number = 0; x < 32; x += angleRamp) {
            
            y += Math.sign(angleStep);

            canvas.drawBitmap(bmp, Flip.None, dx + x, dy + shifty + y, x, 0, angleRamp, 24);
        }

        // Draw the muzzle flash
        if (this.shootRecoverTimer > 0) {

            const t : number = 1.0 - this.shootRecoverTimer/SHOOT_RECOVER_TIME;
            canvas.setColor("#ffdb00");
            canvas.fillRing(this.pos.x + 15, this.pos.y + 4 + angleStep, 8*t, 4 + 5*t);
            return;
        }
    }


    // TODO: Make a common method for all objects
    public drawShadow(canvas: Canvas) : void {

        const dx : number = this.pos.x;
        const dy : number = canvas.height - GROUND_LEVEL;

        const shadowSize : number = 16 + 20*(Math.min(this.pos.y, dy)/canvas.height);

        canvas.fillEllipse(dx, dy, shadowSize/2, shadowSize/6);
    }


    public getOverheatLevel = () : number => this.overheatLevel;
    public getOverheatBar = () : number => this.overheatBarCurrent;
}
