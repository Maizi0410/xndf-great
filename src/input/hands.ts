import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { GestureFilter, readHand } from "./gesture-math";
declare global {
  interface Window {
    desktop?: { requestCamera: () => Promise<boolean> };
  }
}
export class HandInput {
  stream: MediaStream | null = null;
  landmarker: HandLandmarker | null = null;
  filter = new GestureFilter();
  running = false;
  generation = 0;
  previousVideoTime = -1;
  lastFrame = 0;
  anchor: number | null = null;
  anchorAngle = 0;
  constructor(
    public video: HTMLVideoElement,
    public status: (message: string) => void,
    public rotate: (angle: number) => void,
    public confirm: () => void,
    public angle: () => number,
  ) {}
  async start() {
    this.stop();
    const generation = ++this.generation;
    this.status("正在请求摄像头权限…");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("此环境不支持摄像头；请在桌面应用或本机浏览器中使用。");
      if (window.desktop && !(await window.desktop.requestCamera()))
        throw new Error(
          "摄像头权限未获准。可在系统设置中授权，或继续鼠标模式。",
        );
      if (generation !== this.generation) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      this.status("正在加载本地手势模型…");
      const base = new URL("vision/", document.baseURI).href;
      const files = await FilesetResolver.forVisionTasks(base + "wasm");
      const model = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: base + "hand_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      if (generation !== this.generation) {
        model.close();
        return;
      }
      this.landmarker = model;
      this.running = true;
      this.calibrate();
      this.status("张开手掌，保持片刻以校准");
      stream.getVideoTracks()[0].onended = () => {
        if (this.running) {
          this.stop();
          this.status("摄像头已断开 · 鼠标仍可使用");
        }
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.stop();
      console.warn("Local hand input could not start", error);
      const name = error instanceof Error ? error.name : "";
      this.status(
        name === "NotAllowedError"
          ? "摄像头权限未获准 · 鼠标仍可完整游玩"
          : name === "NotFoundError"
            ? "未找到摄像头 · 鼠标仍可完整游玩"
            : "摄像头或本地模型无法启动 · 请重新启用摄像头，或继续鼠标模式",
      );
    }
  }
  calibrate() {
    this.anchor = null;
    this.filter.lost();
  }
  stop() {
    this.generation++;
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.landmarker?.close();
    this.landmarker = null;
    this.calibrate();
    this.previousVideoTime = -1;
  }
  update(now: number) {
    if (
      !this.running ||
      !this.landmarker ||
      now - this.lastFrame < 45 ||
      this.video.readyState < 2 ||
      this.previousVideoTime === this.video.currentTime
    )
      return;
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.previousVideoTime = this.video.currentTime;
    try {
      const result = this.landmarker.detectForVideo(this.video, now);
      const points = result.landmarks[0];
      const hand = points ? readHand(points) : null;
      if (!hand) {
        this.calibrate();
        this.status("未检测到手 · 输入已冻结");
        return;
      }
      const input = this.filter.sample(hand, dt);
      if (input.rotate) {
        if (this.anchor === null) {
          this.anchor = input.x;
          this.anchorAngle = this.angle();
        }
        this.rotate(this.anchorAngle + (input.x - this.anchor) * 280);
        this.status("手掌已追踪 · 左右移动旋转");
      } else
        this.status(input.confirm ? "捏合确认" : "张开手掌旋转 · 捏合确认");
      if (input.confirm) this.confirm();
    } catch {
      this.stop();
      this.status("手势识别中断 · 请继续鼠标模式或重新启用摄像头");
    }
  }
}
