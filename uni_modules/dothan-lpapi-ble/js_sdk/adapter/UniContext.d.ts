import { CreateCanvasOptions, DrawContext, DzImage, ImageLoadOptions, JobCommitOptions, JobStartOptions, JobStartResult, PageEndResult, ResetOptions } from "lpapi-ble";
export interface IUniInitOptions {
    isWeiXin?: boolean;
    isAlipay?: boolean;
    isDingTalk?: boolean;
    isH5?: boolean;
    isAppPlus?: boolean;
}
export interface IUniCanvasInitOptions extends IUniInitOptions {
    canvasId?: string;
    canvas?: HTMLCanvasElement;
    drawTimeout?: number;
    componentInstance?: any;
}
export interface IUniCanvasContext extends CreateCanvasOptions, IUniCanvasInitOptions {
    canvasId?: string;
    canvas?: HTMLCanvasElement;
    drawTimeout?: number;
    componentInstance?: any;
}
export interface IUniCanvas {
    width: number;
    height: number;
    getContext(contextId: "2d"): UniNamespace.CanvasContext;
}
export interface Uni_Base64SaveResult {
    target: string;
    width: number;
    height: number;
    size: number;
}
export declare class UniContext extends DrawContext {
    static createInstance(options: IUniCanvasContext, prevContext?: DrawContext): UniContext | undefined;
    static isDingTalk(): boolean;
    private mOptions;
    private mCanvas?;
    private mImageMap;
    constructor(context: IUniCanvasContext);
    init(options: IUniCanvasContext): void;
    resetContext(opts?: ResetOptions): void;
    protected createCanvas(): HTMLCanvasElement;
    /**
     * 通过 canvas 来创建 Image 对象。
     */
    private createImage;
    loadImage(options: string | ImageLoadOptions): Promise<HTMLImageElement | DzImage | null>;
    /**
     * 因缓存的原因，在 createImage 之后，如果图片存在缓存，则 image.onload 无响应。
     * 为了解决该问题，每次在打印任务处理完毕后，需要将 image.src 设置为空字符串。
     */
    protected resetImageCaches(): void;
    startJob(options: JobStartOptions): JobStartResult | undefined;
    protected onCanvasClear(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void;
    commitJob(): Promise<PageEndResult | undefined>;
    commitAllJobs(options: JobCommitOptions): void;
}
