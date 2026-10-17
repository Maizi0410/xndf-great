import "./style.css";
import { WorldRules, routeAt } from "./game/rules";
import { WinterWorld } from "./scene/world";
import { HandInput } from "./input/hands";
import { Soundscape } from "./game/audio";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<canvas id="world" aria-label="雪中的三座石质岛屿，由电线界定冰路"></canvas><div class="vignette"></div>
<header><a class="wordmark" href="#" aria-label="界限"><span class="seal">界</span><span>THE PERMITTED WORLD<small>一场关于可能性的寓言</small></span></a><div class="header-right"><span class="edition">INTERACTIVE DIORAMA — 001</span><button id="sound" class="icon-button" aria-label="关闭声音">声 <span>ON</span></button><button id="restart" class="icon-button" aria-label="重新开始">↺</button></div></header>
<div class="world-caption"><i></i><span>北纬 60° · 无名水域</span><span class="caption-rule"></span><span>WINTER, WITHOUT END</span></div>
<section id="intro" class="intro"><div class="eyebrow">AN EXPERIMENT IN BOUNDARIES</div><h1>界<span>限</span><sup>01</sup></h1><p class="intro-english">THE PERMITTED WORLD</p><div class="short-line"></div><p class="intro-copy">世界并非没有道路。<br>只是有些可能，尚未被允许。</p><button id="begin" class="primary">进入界限 <span>↗</span></button><p class="start-note">拖动以改变秩序 · 点击以允许前行</p><div class="intro-index"><span>01 / 01</span><span>原创微缩解谜 · 约 3 分钟</span></div></section>
<aside id="journal" class="journal hidden"><div class="eyebrow">THE RULE OF ONE</div><h2 id="chapter">尚未允许的路</h2><p id="narrative">水面保留着所有方向，<br>而秩序只能选择其中一个。</p><div class="journey"><span data-platform="A" class="current">I</span><i></i><span data-platform="B">II</span><i></i><span data-platform="C">III</span></div><div class="location"><span id="location">起点</span><span id="phase">等待许可</span></div></aside>
<div class="scene-note"><span class="note-cross">+</span><span>每一条被允许的路，<br>都是另一种可能的消失。</span></div>
<section id="controls" class="controls hidden" aria-label="秩序控制装置"><div class="control-label"><span><i class="status-dot"></i> 秩序控制节点</span><span id="angle-value">000°</span></div><div class="dial-row"><span class="endpoint">I — II</span><div class="range-wrap"><div class="ticks"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><input id="rotation" type="range" min="-80" max="80" step="1" value="0" aria-label="旋转电线杆"><div class="range-labels"><span>−60°</span><span>0</span><span>+60°</span></div></div><span class="endpoint">II — III</span></div><div class="control-footer"><p id="hint">左右拖动，寻找电线的共鸣</p><button id="confirm" disabled>允许前行 <span>→</span></button></div><div class="ice-meter"><i id="ice-progress"></i></div></section>
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
  finished = false;
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
  if (rules.confirm()) audio.tone(220, 0.7, 0.2);
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
function begin() {
  started = true;
  $("intro").classList.add("hidden");
  $("journal").classList.remove("hidden");
  $("controls").classList.remove("hidden");
  document.body.classList.add("playing");
  void audio.start().catch(() => toast("声音暂不可用，不影响游玩。"));
}
function reset() {
  hands.stop();
  $("camera-panel").classList.add("hidden");
  $("camera-toggle").textContent = "◉ 启用手势";
  rules.reset();
  finished = false;
  previousPhase = "";
  previousChanges = 0;
  $("ending").classList.add("hidden");
  begin();
}
$("begin").onclick = begin;
$("restart").onclick = reset;
$("again").onclick = reset;
$("confirm").onclick = confirm;
$<HTMLInputElement>("rotation").oninput = (e) =>
  rotate(Number((e.target as HTMLInputElement).value));
$("sound").onclick = () => {
  const enabled = audio.toggle();
  $("sound").innerHTML = `声 <span>${enabled ? "ON" : "OFF"}</span>`;
  $("sound").setAttribute("aria-label", enabled ? "关闭声音" : "开启声音");
  if (started && enabled) void audio.start().catch(() => {});
};
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
    const a = rules.angle;
    const candidate = routeAt(a);
    if (candidate) rules.rotate(candidate === "AB" ? -60 : 60);
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
let previous = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const elapsed = Math.min((now - previous) / 1000, 0.5);
  const dt = Math.min(elapsed, 0.1);
  previous = now;
  if (document.hidden) return;
  if (started) {
    for (let remaining = elapsed; remaining > 0; remaining -= 0.05)
      rules.update(Math.min(0.05, remaining));
    hands.update(now);
  }
  world.update(dt, rules, started);
  if (!started) return;
  const slider = $<HTMLInputElement>("rotation");
  slider.disabled = rules.locked;
  if (document.activeElement !== slider) slider.value = String(rules.angle);
  $("angle-value").textContent =
    `${rules.angle < 0 ? "−" : "+"}${Math.abs(Math.round(rules.angle)).toString().padStart(3, "0")}°`;
  $<HTMLButtonElement>("confirm").disabled = !rules.canWalk;
  $("ice-progress").style.width = `${Math.max(rules.ab, rules.bc) * 100}%`;
  $("hint").textContent =
    rules.phase === "walking"
      ? "人物通行中 · 边界已锁定"
      : rules.phase === "forming"
        ? "旧的可能正在消失，新的道路正在凝结"
        : rules.canWalk
          ? "道路已获许可 · 点击或捏合以出发"
          : rules.phase === "ready"
            ? "这条道路尚未连接人物的下一站"
            : "左右拖动，寻找电线的共鸣";
  $("phase").textContent = {
    idle: "等待许可",
    forming: "重写边界",
    ready: "道路凝结",
    walking: "正在通行",
    ending: "抵达",
    complete: "结束",
  }[rules.phase];
  $("location").textContent = { A: "I · 起点", B: "II · 中转", C: "III · 门" }[
    rules.platform
  ];
  document
    .querySelectorAll<HTMLElement>("[data-platform]")
    .forEach((el) =>
      el.classList.toggle("current", el.dataset.platform === rules.platform),
    );
  if (rules.phase !== previousPhase) {
    if (rules.phase === "ready") audio.freeze();
    if (rules.platform === "B") {
      $("chapter").textContent = "让另一条路消失";
      $("narrative").innerHTML = "通往前方的许可，<br>以失去归路为代价。";
    }
    if (rules.phase === "ending") {
      hands.stop();
      $("camera-panel").classList.add("hidden");
      audio.finish();
    }
    previousPhase = rules.phase;
  }
  if (rules.changes !== previousChanges) {
    previousChanges = rules.changes;
    audio.tone(92, 1.4, 0.13);
  }
  if (rules.phase === "walking") audio.step(now / 1000);
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
}
requestAnimationFrame(frame);
