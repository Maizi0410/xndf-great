import "./style.css";
import { WorldRules } from "./game/rules";
import { WinterWorld } from "./scene/world";
import { MECHANISM_LABELS, NODE_LABELS } from "./game/puzzle";
import { HandInput } from "./input/hands";
import { Soundscape } from "./game/audio";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<canvas id="world" aria-label="雪中的三座石质岛屿，悬空石阶在固定等距视角中重合"></canvas><div class="vignette"></div>
<header><a class="wordmark" href="#" aria-label="界限"><span class="seal">界</span><span>THE PERMITTED WORLD<small>一场关于可能性的寓言</small></span></a><div class="header-right"><span class="edition">SPATIAL STUDY — V2.2</span><button id="motion" class="icon-button" aria-pressed="false">镜头 <span>标准</span></button><button id="quality" class="icon-button">画质 <span>自动</span></button><button id="sound" class="icon-button" aria-label="关闭声音">声 <span>ON</span></button><label class="music-volume" title="背景音乐音量"><span>乐</span><input id="music-volume" type="range" min="0" max="100" step="1" value="35" aria-label="背景音乐音量"></label><button id="restart" class="icon-button" aria-label="重新开始">↺</button></div></header>
<div class="world-caption"><i></i><span>北纬 60° · 无名水域</span><span class="caption-rule"></span><span>WINTER, WITHOUT END</span></div>
<section id="intro" class="intro"><div class="eyebrow">AN EXPERIMENT IN BOUNDARIES</div><h1>界<span>限</span><sup>02</sup></h1><p class="intro-english">THE PERMITTED WORLD</p><div class="short-line"></div><p class="intro-copy">世界并非没有道路。<br>只是有些可能，尚未被允许。</p><button id="begin" class="primary">进入界限 <span>↗</span></button><p class="start-note">拖动以改变秩序 · 点击以允许前行</p><div class="intro-index"><span>01 / 01</span><span>单场景空间解谜 · 约 5–8 分钟</span></div></section>
<aside id="journal" class="journal hidden"><div class="eyebrow">THE SHAPE OF PERMISSION</div><h2 id="chapter">借来的高度</h2><p id="narrative">不是把两岸拉近。<br>试着让断阶在眼前重合。</p><div class="journey"><span data-platform="A" class="current">I</span><i></i><span data-platform="L">西</span><i></i><span data-platform="B">II</span><i></i><span data-platform="U">东</span><i></i><span data-platform="B2">上</span><i></i><span data-platform="C">III</span></div><div class="location"><span id="location">起点</span><span id="phase">等待许可</span></div></aside>
<div class="scene-note"><span class="note-cross">+</span><span>每一条被允许的路，<br>都是另一种可能的消失。</span></div>
<section id="controls" class="controls hidden" aria-label="秩序控制装置"><div class="control-label"><span><i class="status-dot"></i> <span id="mechanism">中央回转轴</span></span><span id="angle-value">000°</span></div><div class="dial-row"><span class="endpoint">旋转</span><div class="range-wrap"><div class="ticks"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><input id="rotation" type="range" min="-80" max="80" step="1" value="0" aria-label="旋转空间机构"><div class="range-labels"><span>−80°</span><span>0</span><span>+80°</span></div></div><span class="endpoint">重合</span></div><div class="control-footer"><p id="hint">左右拖动，寻找电线的共鸣</p><button id="confirm" disabled>允许前行 <span>→</span></button></div><button id="skip-connection" class="skip-connection hidden">加速凝结 <span>Space</span></button><div class="control-help"><span id="combination">五次许可 · 三组机构</span><button id="help">观察提示</button></div><p id="observation" class="observation hidden"></p><div class="ice-meter"><i id="ice-progress"></i></div></section>
<footer><span>界限 © 2026</span><span class="footer-middle">ONLY ONE POSSIBILITY MAY EXIST.</span><button id="camera-toggle">◉ <span>启用手势</span></button></footer>
<aside id="camera-panel" class="camera-panel hidden"><div class="camera-heading"><span>本机手势输入</span><button id="camera-hide" aria-label="隐藏预览">−</button></div><video id="camera" autoplay playsinline muted></video><p id="camera-status" role="status">摄像头只在本机处理，不上传、不录制。</p><div class="camera-actions"><button id="calibrate">重新校准</button><button id="camera-stop">关闭摄像头</button></div><small>张开手掌左右移动 · 捏合确认<br>鼠标始终可用</small></aside>
<div id="toast" class="toast hidden" role="status"></div>
<section id="ending" class="ending hidden"><div class="eyebrow">THE OTHER SIDE OF PERMISSION</div><h2>你抵达了。<br><em>世界却少了一条路。</em></h2><p>秩序让你前行，也替你决定了不能去的地方。</p><div class="short-line"></div><button id="again" class="primary">再看一次这个世界 <span>↺</span></button><span class="ending-foot">界限 / THE PERMITTED WORLD</span></section>
<section id="fatal" class="fatal hidden" role="alert"><h2>这个世界暂时无法显现</h2><p id="fatal-message"></p><button id="reload">重新加载</button></section>`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const rules = new WorldRules(),
  audio = new Soundscape();
let started = false,
  world: WinterWorld,
  previousPhase = "",
  previousChanges = 0,
  previousTraversed = 0,
  finished = false,
  previousNode = rules.platform,
  previousAngle = rules.angle;
let lastConfirmationAt=0;
let toastTimer: ReturnType<typeof setTimeout>;
function toast(text: string) {
  $("toast").textContent = text;
  $("toast").classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.add("hidden"), 4500);
}
function fail(message: string) {
  $("fatal-message").textContent = message;
  $("fatal").classList.remove("hidden");
}
$("reload").onclick = () => location.reload();
try {
  world = new WinterWorld($<HTMLCanvasElement>("world"));
} catch (e) {
  fail(
    "请开启硬件加速并重新启动；也可尝试更新系统或使用支持 WebGL 2 的浏览器。" +
      String(e),
  );
  throw e;
}
$("world").addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  fail("图形设备已中断。请重新加载；如再次发生，请关闭其他图形程序后重试。");
});
function confirm() {
  world.measure(rules);
  if (rules.confirm()) {lastConfirmationAt=performance.now();audio.tone(220, 0.7, 0.2);}
  else if (started && !rules.locked)
    toast("先让人物所在平台与下一座平台连通，再允许前行。");
}
function rotate(angle: number) {
  if (started) rules.rotate(angle);
}
const hands = new HandInput(
  $<HTMLVideoElement>("camera"),
  (message) => {
    $("camera-status").textContent = message;
  },
  rotate,
  confirm,
  () => rules.angle,
);
function begin(restartMusic = false) {
  started = true;
  $("intro").classList.add("hidden");
  $("journal").classList.remove("hidden");
  $("controls").classList.remove("hidden");
  document.body.classList.add("playing");
  void audio.start(restartMusic).catch(() => toast("声音暂不可用，不影响游玩。"));
}
function reset() {
  hands.stop();
  $("camera-panel").classList.add("hidden");
  $("camera-toggle").textContent = "◉ 启用手势";
  rules.reset();
  world.director.reset();
  finished = false,
  previousNode = "C",
  previousAngle = rules.angle;
  previousPhase = "";
  previousChanges = 0;
  previousTraversed = 0;
  $("ending").classList.add("hidden");
  begin(true);
}
$("begin").onclick = () => begin();
$("restart").onclick = reset;
$("again").onclick = reset;
$("confirm").onclick = confirm;
$<HTMLInputElement>("rotation").onchange = () => rules.snap();
$<HTMLInputElement>("rotation").oninput = (e) =>
  rotate(Number((e.target as HTMLInputElement).value));
function syncSoundControls() {
  $("sound").innerHTML = `声 <span>${audio.enabled ? "ON" : "OFF"}</span>`;
  $("sound").setAttribute("aria-label", audio.enabled ? "关闭声音" : "开启声音");
  $("sound").setAttribute("aria-pressed", String(!audio.enabled));
  $<HTMLInputElement>("music-volume").value = String(Math.round(audio.volume * 100));
}
syncSoundControls();
$("sound").onclick = () => { audio.toggle(); syncSoundControls(); };
$<HTMLInputElement>("music-volume").oninput = e => {
  audio.setVolume(Number((e.target as HTMLInputElement).value) / 100);
};
document.addEventListener("visibilitychange", () => audio.setPaused(document.hidden));
window.addEventListener("pagehide", () => audio.setPaused(true));
window.addEventListener("pageshow", () => audio.setPaused(document.hidden));
let drag: { x: number; angle: number; id: number } | null = null;
$("world").onpointerdown = (e) => {
  if (!started || rules.locked) return;
  drag = { x: e.clientX, angle: rules.angle, id: e.pointerId };
  $("world").setPointerCapture(e.pointerId);
};
$("world").onpointermove = (e) => {
  if (drag) rotate(drag.angle + (e.clientX - drag.x) * 0.3);
};
const endDrag = () => {
  if (drag) {
    rules.snap();
  }
  drag = null;
};
$("world").onpointerup = endDrag;
$("world").onpointercancel = endDrag;
window.addEventListener("keydown", (e) => {
  if (!started || e.target instanceof HTMLInputElement) return;
  if (e.key === "ArrowLeft") {
    rotate(rules.angle - 5);
    e.preventDefault();
  }
  if (e.key === "ArrowRight") {
    rotate(rules.angle + 5);
    e.preventDefault();
  }
  if (e.key === "Enter") {
    confirm();
    e.preventDefault();
  }
});
$("camera-toggle").onclick = () => {
  if (!started) begin();
  $("camera-panel").classList.remove("hidden");
  if (!hands.running) {
    void hands.start();
    $("camera-toggle").textContent = "◉ 显示手势";
  }
};
$("camera-hide").onclick = () => $("camera-panel").classList.add("hidden");
$("camera-stop").onclick = () => {
  hands.stop();
  $("camera-panel").classList.add("hidden");
  $("camera-toggle").textContent = "◉ 启用手势";
  toast("摄像头已关闭 · 当前使用鼠标");
};
$("calibrate").onclick = () => {
  hands.calibrate();
  toast("将手放在画面中央，张开手掌保持片刻。");
};
window.addEventListener("pagehide", () => hands.stop());
let reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
try { const saved=localStorage.getItem("permitted-motion");if(saved) reduced=saved==="reduced"; } catch {}
function motionPreference() {
  world.director.reduced=reduced;
  $("motion").innerHTML=`镜头 <span>${reduced?"减少":"标准"}</span>`;
  $("motion").setAttribute("aria-pressed",String(reduced));
  $("motion").setAttribute("aria-label",reduced?"切换标准电影镜头":"减少镜头运动");
}
motionPreference();
$("motion").onclick=()=>{reduced=!reduced;motionPreference();try{localStorage.setItem("permitted-motion",reduced?"reduced":"standard");}catch{}};
$("quality").onclick=()=>{
  world.setQuality(world.quality==="auto"?"high":"auto");
  $("quality").innerHTML=`画质 <span>${world.quality==="auto"?"自动":"高"}</span>`;
};
$("skip-connection").onclick=()=>rules.accelerateConnection();
window.addEventListener("keydown",e=>{if(e.code==="Space" && rules.phase==="connecting" && (!(e.target instanceof HTMLButtonElement) || e.target.id==="confirm" || e.target.id==="skip-connection")){e.preventDefault();rules.accelerateConnection();}});
const CHAPTERS = {
  A: ["借来的高度", "不是把两岸拉近。<br>试着让断阶在眼前重合。", "看西侧悬阶的两个圆形端点。中央轴控制靠近你的半段；让雪沿阶边汇聚。"],
  L: ["折回中庭", "另一半阶梯保留了方向，<br>却还没有保留去处。", "现在拖动的是西侧折叠阶。圆点碰到还不够，两段石阶的延伸方向也必须一致。"],
  B: ["失去归路", "沿用来时的秩序，<br>走不到更高的地方。", "回到中央轴。试着让来路分开，转向右前方的高台；远处像是连通的路并不接在脚下。"],
  U: ["另一面中庭", "看似离开的地方，<br>还有一层尚未看见。", "调整高处回廊。目的地在中央平台上方，不在远处的门；对齐上庭的悬阶。"],
  B2: ["最后的许可", "再次改变已经走过的路，<br>才能让终点成为可能。", "西阶和回廊已保留各自的方向。最后一次转动中央轴，观察向门延伸的高低两段石阶。"],
  C: ["世界的另一侧", "许可让你抵达，也留下边界。", "你已抵达。"],
} as const;
$("help").onclick = () => {
  $("observation").textContent=CHAPTERS[rules.platform][2];
  $("observation").classList.toggle("hidden");
};
let previous = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const elapsed = Math.min((now - previous) / 1000, 0.5);
  const dt = Math.min(elapsed, 0.1);
  previous = now;
  // Read-only music status for resource/lifecycle acceptance; no playback controls.
  $("app").dataset.music = JSON.stringify(audio.music?.snapshot() ?? {state:"idle", activeSources:0, volume:audio.volume, muted:!audio.enabled});
  if (document.hidden) return;
  if(started) hands.update(now);
  world.prepareCamera(dt,rules);
  if (started) {
    world.measure(rules);
    const ruleElapsed=rules.phase==="connecting"?Math.min(elapsed,Math.max(0,(now-lastConfirmationAt)/1000)):elapsed;
    for (let remaining = ruleElapsed; remaining > 0; remaining -= 0.05)
      rules.update(Math.min(0.05, remaining));
  }
  world.update(dt, rules, started);
  if (!started) return;
  if (rules.traversed.length !== previousTraversed) {
  previousTraversed = rules.traversed.length;

  if (rules.platform !== "C") {
    audio.pathSuccess(previousTraversed);
  }
}
  const slider = $<HTMLInputElement>("rotation");
  slider.disabled = rules.locked;
  if (document.activeElement !== slider) slider.value = String(rules.angle);
  $("angle-value").textContent =
    `${rules.angle < 0 ? "−" : "+"}${Math.abs(Math.round(rules.angle)).toString().padStart(3, "0")}°`;
  $<HTMLButtonElement>("confirm").disabled = !rules.canWalk;
  $("ice-progress").style.width = `${Math.max(0,...Object.values(rules.growth)) * 100}%`;
  $("mechanism").textContent = MECHANISM_LABELS[rules.active];
  $("combination").textContent = `${rules.traversed.length} / 5 次许可 · ${MECHANISM_LABELS[rules.active]}`;
  if(rules.platform !== previousNode) {
    previousNode=rules.platform;
    hands.calibrate();
    $("observation").classList.add("hidden");
    $("chapter").textContent=CHAPTERS[rules.platform][0];
    $("narrative").innerHTML=CHAPTERS[rules.platform][1];
  }
  if (Math.abs(previousAngle-rules.angle)>.6 && !rules.locked) audio.rotate(now/1000,rules.proximity);
  previousAngle=rules.angle;
  $("skip-connection").classList.toggle("hidden",rules.phase!=="connecting");
  $("hint").textContent =
    rules.phase === "connecting" ? "冰晶正在封合接缝 · 可加速演出" : rules.phase === "walking"
      ? "人物通行中 · 边界已锁定"
      : rules.phase === "forming"
        ? "旧的可能正在消失，新的道路正在凝结"
        : rules.canWalk
          ? "道路已获许可 · 点击或捏合以出发"
          : rules.phase === "ready"
            ? "这条道路尚未连接人物的下一站"
            : rules.alignments.some(a=>a.reason==="direction" && a.proximity>.75)
              ? "端点相遇，方向却折回了原处"
              : rules.alignments.some(a=>a.reason==="unreachable" && a.proximity>.9)
                ? "远处有了路，脚下却没有入口"
                : rules.proximity>.65 ? "雪正沿边界汇聚 · 继续观察两端的方向" : "拖动当前机构 · 寻找石阶的视觉重合";
  $("phase").textContent = {
    idle: "等待许可",
    forming: "重写边界",
    ready: "道路凝结",
    connecting: "连接确认",
    walking: "正在通行",
    ending: "抵达",
    complete: "结束",
  }[rules.phase];
  $("location").textContent = NODE_LABELS[rules.platform];
  document
    .querySelectorAll<HTMLElement>("[data-platform]")
    .forEach((el) =>
      el.classList.toggle("current", el.dataset.platform === rules.platform),
    );
  if (rules.phase !== previousPhase) {
    if (rules.phase === "connecting") audio.freeze();
    if (rules.phase === "ending") {
      hands.stop();
      $("camera-panel").classList.add("hidden");
      audio.finish();
    }
    previousPhase = rules.phase;
  }
  if (rules.changes !== previousChanges) {
    previousChanges = rules.changes;
    audio.melt();
  }
  if (rules.phase === "walking") audio.step(now / 1000, rules.travel > .46 && rules.travel < .54 ? "ice" : "stone");
  if (rules.phase === "complete" && !finished) {
    finished = true;
    $("ending").classList.remove("hidden");
    $("controls").classList.add("hidden");
    $("journal").classList.add("hidden");
  }
  // Read-only diagnostics for acceptance tests. No state-mutating production backdoor.
  $("app").dataset.phase = rules.phase;
  $("app").dataset.platform = rules.platform;
  $("app").dataset.route = rules.route ?? "none";
  $("app").dataset.mechanism = rules.active;
  $("app").dataset.crossings = String(rules.traversed.length);
  $("app").dataset.configuration = JSON.stringify(rules.config);
  $("app").dataset.alignment = JSON.stringify(rules.alignments);
  $("app").dataset.render = JSON.stringify({...world.frameMetrics,balanced:world.balanced});
  $("app").dataset.cameraMode=world.director.mode;
  $("app").dataset.cameraZoom=world.camera.zoom.toFixed(5);
  $("app").dataset.camera=JSON.stringify(world.director.snapshot());
  $("app").dataset.layers=JSON.stringify(world.architecture.levels);
  $("app").dataset.travel=rules.travel.toFixed(4);
}
requestAnimationFrame(frame);
