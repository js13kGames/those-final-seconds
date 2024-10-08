import { ProgramEvent } from "./event.js";
import { Canvas, Bitmap } from "../gfx/canvas.js";
import { Scene } from "./scene.js";


export class Program {


    private canvas : Canvas;
    private activeScene : Scene;
    private event : ProgramEvent;
    
    private timeSum : number = 0.0;
    private oldTime : number = 0.0;

    private initialized : boolean = false;


    constructor(canvasMinWidth : number,  canvasMaxWidth : number,
        canvasMinHeight : number,  canvasMaxHeight : number,
        audioMaxVolume : number = 0.60) {

        this.canvas = new Canvas(null,
            canvasMinWidth, canvasMinHeight,
            canvasMaxWidth, canvasMaxHeight,
            (name : string) : Bitmap => this.event.getBitmap(name), true);
        this.event = new ProgramEvent(this.canvas, audioMaxVolume); 
    }



    private drawLoadingScreen(canvas : Canvas) : void {

        const OUTLINE : number = 1;
        const WIDTH : number  = 80;
        const HEIGHT : number  = 12;

        canvas.clear("#000000");

        const p : number = this.event.loadedRatio();
        const dx : number = canvas.width/2 - WIDTH/2;
        const dy : number = canvas.height/2 - HEIGHT/2;

        canvas.fillRect(dx, dy, WIDTH, HEIGHT, "#ffffff");
        canvas.fillRect(dx + OUTLINE, dy + OUTLINE, WIDTH - OUTLINE*2, HEIGHT - OUTLINE*2, "#000000");
        canvas.fillRect(dx + OUTLINE*2, dy + OUTLINE*2, (WIDTH - OUTLINE*4)*p, HEIGHT - OUTLINE*4, "#ffffff");
    }


    private loop(ts : number, 
        initialScreen? : (canvas : Canvas) => void, 
        onLoad? : (event : ProgramEvent) => void) : void {

        const MAX_REFRESH_COUNT : number = 5; 
        const BASE_FRAME_TIME : number = 1000.0/60.0;
    
        const frameTime : number = BASE_FRAME_TIME*this.event.tick;
        const loaded : boolean = this.event.loaded();

        this.timeSum = Math.min(this.timeSum + (ts - this.oldTime), MAX_REFRESH_COUNT*frameTime);
        this.oldTime = ts;

        let firstFrame : boolean = true;
        for (; this.timeSum >= frameTime; this.timeSum -= frameTime) {

            if (this.initialized) {

                this.activeScene.update(this.event);
            }

            if (loaded && !this.initialized) {
                
                if (this.event.anyPressed) {

                    this.initialized = true;
                    this.event.initialize();
                    onLoad(this.event);
                    this.event.update();
                    break;
                }
            }
                
            if (firstFrame) {

                this.event.update();
                firstFrame = false;
            }
        }
            
        if (loaded) {
                
            if (!this.initialized) {

                initialScreen(this.canvas);
            }
            else {

                this.activeScene.redraw(this.canvas);
            }
        }
        else {

            this.drawLoadingScreen(this.canvas);
        }
        window.requestAnimationFrame(ts => this.loop(ts, initialScreen, onLoad));
    }


    public run(sceneType : Function,
        initialEvent : (event : ProgramEvent) => void,
        initialScreen : (canvas : Canvas) => void,
        onLoad : (event : ProgramEvent) => void) : void {

        this.activeScene = new sceneType.prototype.constructor(this.event);

        initialEvent(this.event);
        this.loop(0.0, initialScreen, onLoad);
    }
    
}
