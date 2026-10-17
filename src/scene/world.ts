import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { WorldRules } from "../game/rules";
import {
  stoneTexture,
  waterVertex,
  waterFragment,
  iceMaterial,
} from "./materials";
export const POINTS = {
  A: new T.Vector3(-6, 1.3, 3),
  B: new T.Vector3(0, 1.3, 0),
  C: new T.Vector3(4.8, 1.3, -6.8),
};
export class WinterWorld {
  scene = new T.Scene();
  camera: T.OrthographicCamera;
  renderer: T.WebGLRenderer;
  composer: EffectComposer;
  character = new T.Group();
  body = new T.Group();
  legs: T.Group[] = [];
  arms: T.Group[] = [];
  control = new T.Group();
  poles: T.Group[] = [];
  doorLight: T.PointLight;
  wires: T.Mesh[] = [];
  wireMats: T.MeshStandardMaterial[] = [];
  ice: T.Mesh[] = [];
  iceSides: T.Mesh[] = [];
  snow: T.Points;
  snowBase: Float32Array;
  snowSpeed: Float32Array;
  water: T.ShaderMaterial;
  field: T.LineLoop;
  time = 0;
  lastAngle = 999;
  width = 0;
  height = 0;
  stone = new T.MeshStandardMaterial({
    color: 0xa1b3bd,
    map: stoneTexture(),
    roughness: 0.95,
  });
  snowMat = new T.MeshStandardMaterial({ color: 0xd7e2e4, roughness: 0.86 });
  metal = new T.MeshStandardMaterial({
    color: 0x36464d,
    metalness: 0.65,
    roughness: 0.6,
  });
  warm = new T.MeshStandardMaterial({
    color: 0xe5b46f,
    emissive: 0xe6a54e,
    emissiveIntensity: 1.4,
  });
  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new T.Color(0x0b1c28);
    this.scene.fog = new T.FogExp2(0x102633, 0.025);
    this.camera = new T.OrthographicCamera(-13, 13, 10, -10, 0.1, 150);
    this.camera.position.set(20, 23, 27);
    this.camera.lookAt(0, 0.5, -0.5);
    this.scene.add(new T.HemisphereLight(0xb2d9ec, 0x1e323e, 2));
    const moon = new T.DirectionalLight(0xc6dfef, 3.3);
    moon.position.set(-8, 18, 4);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    Object.assign(moon.shadow.camera, {
      left: -16,
      right: 16,
      top: 16,
      bottom: -16,
      near: 1,
      far: 60,
    });
    moon.shadow.normalBias = 0.035;
    moon.shadow.bias = -0.0002;
    moon.shadow.radius = 4;
    this.scene.add(moon);
    const fill = new T.DirectionalLight(0x658ca5, 1.6);
    fill.position.set(10, 8, -12);
    this.scene.add(fill);
    this.platform(POINTS.A, 2.05, 0);
    this.platform(POINTS.B, 2.25, 1);
    this.platform(POINTS.C, 2.05, 2);
    this.arch(
      POINTS.A.clone().add(new T.Vector3(-0.7, 0, -0.55)),
      1.45,
      2.4,
      0.34,
    );
    this.box(0.75, 2.1, 0.6, this.stone, -1.25, 2.35, -0.8);
    this.box(0.84, 0.13, 0.7, this.snowMat, -1.25, 3.45, -0.8);
    this.box(0.05, 0.9, 0.03, this.warm, -1.25, 2.55, -0.48);
    const portal = POINTS.C.clone().add(new T.Vector3(0.1, 0, -0.55));
    this.arch(portal, 1.6, 3, 0.65);
    this.box(0.9, 2.2, 0.12, this.warm, portal.x, 2.42, portal.z + 0.04);
    this.doorLight = new T.PointLight(0xffc77d, 13, 8, 2);
    this.doorLight.position.set(portal.x, 2.5, portal.z + 0.65);
    this.scene.add(this.doorLight);
    Object.values(POINTS).forEach((v, i) =>
      this.pole(
        v
          .clone()
          .add(new T.Vector3(i === 0 ? -0.8 : 0.95, 0, i === 2 ? 0.8 : -0.65)),
        i === 1,
      ),
    );
    this.water = new T.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        eye: { value: this.camera.position },
        gate: { value: new T.Vector2(portal.x, portal.z) },
        permission: { value: 0 },
      },
      vertexShader: waterVertex,
      fragmentShader: waterFragment,
    });
    const water = new T.Mesh(
      new T.PlaneGeometry(180, 180, 150, 150),
      this.water,
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.35;
    this.scene.add(water);
    this.makeIce(POINTS.A, POINTS.B);
    this.makeIce(POINTS.B, POINTS.C);
    this.createCharacter();
    this.scene.add(this.character);
    this.character.position.copy(POINTS.A);
    const n = 2100;
    this.snowBase = new Float32Array(n * 3);
    this.snowSpeed = new Float32Array(n);
    const sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.snowBase.set(
        [
          (Math.random() - 0.5) * 52,
          Math.random() * 22,
          -22 + (i % 3) * 15 + Math.random() * 14,
        ],
        i * 3,
      );
      this.snowSpeed[i] = 0.3 + Math.random() * 0.65;
      sizes[i] = ((i % 3) + 1) * 1.2;
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute(
      "position",
      new T.BufferAttribute(this.snowBase.slice(), 3),
    );
    sg.setAttribute("size", new T.BufferAttribute(sizes, 1));
    this.snow = new T.Points(
      sg,
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { pixelRatio: { value: this.renderer.getPixelRatio() } },
        vertexShader: `attribute float size;uniform float pixelRatio;varying float alpha;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);alpha=clamp(1.-(-mv.z)/85.,.08,.6);gl_PointSize=size*pixelRatio;gl_Position=projectionMatrix*mv;}`,
        fragmentShader: `varying float alpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.82,.9,.94,alpha*smoothstep(.5,.05,d));}`,
      }),
    );
    this.scene.add(this.snow);
    const ring = Array.from(
      { length: 96 },
      (_, i) =>
        new T.Vector3(
          Math.cos((i / 96) * Math.PI * 2) * 3.3,
          0.03,
          Math.sin((i / 96) * Math.PI * 2) * 3.3,
        ),
    );
    this.field = new T.LineLoop(
      new T.BufferGeometry().setFromPoints(ring),
      new T.LineBasicMaterial({
        color: 0x8badae,
        transparent: true,
        opacity: 0.1,
      }),
    );
    this.field.position.copy(POINTS.B);
    this.scene.add(this.field);
    const farMat = new T.MeshStandardMaterial({
      color: 0x15303d,
      roughness: 1,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    for (let i = 0; i < 18; i++) {
      const x = (i - 9) * 3.1,
        z = -19 - Math.sin(i * 4) * 3,
        h = 0.5 + (Math.sin(i * 17) + 1) * 0.8;
      this.box(1.7, h, 2, farMat, x, h / 2 - 0.6, z);
      if (i % 4 === 0)
        this.box(0.045, 0.5, 0.03, this.warm, x, h * 0.6, z + 1.02);
    }
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new UnrealBloomPass(new T.Vector2(1, 1), 0.22, 0.5, 1.2),
    );
    this.composer.addPass(new OutputPass());
    this.resize();
  }
  box(
    w: number,
    h: number,
    d: number,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = this.scene,
  ) {
    const m = new T.Mesh(
      new RoundedBoxGeometry(w, h, d, 2, Math.min(0.045, w / 4, h / 4, d / 4)),
      mat,
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  platform(p: T.Vector3, r: number, index: number) {
    const v = [
      [-1, -0.6],
      [-0.6, -1],
      [0.45, -1],
      [1, -0.5],
      [0.85, 0.6],
      [0.35, 1],
      [-0.9, 0.8],
    ];
    for (let layer = 0; layer < 4; layer++) {
      const s = new T.Shape();
      v.forEach(([x, z], i) => {
        const f = r * (1 - layer * 0.045);
        if (i === 0) s.moveTo(x * f, -z * f);
        else s.lineTo(x * f, -z * f);
      });
      s.closePath();
      const geo = new T.ExtrudeGeometry(s, {
        depth: 0.55,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.07,
        bevelThickness: 0.06,
      });
      geo.rotateX(-Math.PI / 2);
      const mat = this.stone.clone();
      mat.color.multiplyScalar(0.79 + layer * 0.065);
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(
        p.x + (layer % 2) * 0.025,
        p.y - 2.16 + layer * 0.51,
        p.z,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      if (layer === 3) {
        const cap = new T.Mesh(geo, this.snowMat);
        cap.scale.set(1.01, 0.1, 1.01);
        cap.position.set(p.x, p.y - 0.02, p.z);
        cap.receiveShadow = true;
        this.scene.add(cap);
      }
    }
    for (let i = -2; i <= 2; i++)
      for (let j = -2; j <= 2; j++) {
        if (Math.abs(i) + Math.abs(j) > 3) continue;
        this.box(
          0.69,
          0.065,
          0.66,
          this.snowMat,
          p.x + i * 0.7,
          p.y + 0.025,
          p.z + j * 0.69,
        );
      }
    this.box(0.55, 2.3, 0.7, this.stone, p.x - r * 0.75, p.y - 1.2, p.z + 0.5);
    this.box(0.45, 1.8, 0.6, this.stone, p.x + r * 0.6, p.y - 1.2, p.z - 0.7);
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#b8c6c8";
    ctx.font = "38px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(["I", "II", "III"][index], 64, 80);
    const label = new T.Mesh(
      new T.PlaneGeometry(0.6, 0.6),
      new T.MeshBasicMaterial({
        map: new T.CanvasTexture(c),
        transparent: true,
        depthWrite: false,
      }),
    );
    label.position.set(p.x, p.y + 0.085, p.z + 0.9);
    label.rotation.x = -Math.PI / 2;
    this.scene.add(label);
    this.box(0.32, 0.035, 0.045, this.warm, p.x + 0.1, p.y + 0.09, p.z + 1.25);
  }
  arch(p: T.Vector3, w: number, h: number, d: number) {
    const s = new T.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(-w / 2, h - 0.2);
    s.quadraticCurveTo(-w / 2, h, 0, h);
    s.quadraticCurveTo(w / 2, h, w / 2, h - 0.2);
    s.lineTo(w / 2, 0);
    s.lineTo(w * 0.27, 0);
    s.lineTo(w * 0.27, h * 0.72);
    s.quadraticCurveTo(0, h * 0.92, -w * 0.27, h * 0.72);
    s.lineTo(-w * 0.27, 0);
    s.closePath();
    const mesh = new T.Mesh(
      new T.ExtrudeGeometry(s, {
        depth: d,
        bevelEnabled: true,
        bevelSegments: 3,
        bevelSize: 0.06,
        bevelThickness: 0.04,
        steps: 1,
      }),
      this.stone,
    );
    mesh.position.copy(p);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.box(
      w + 0.1,
      0.09,
      d + 0.1,
      this.snowMat,
      p.x,
      p.y + h + 0.03,
      p.z + d / 2,
    );
  }
  pole(p: T.Vector3, central: boolean) {
    const g = new T.Group();
    g.position.copy(p);
    this.scene.add(g);
    this.poles.push(g);
    this.box(0.42, 0.24, 0.42, this.stone, 0, 0.12, 0, g);
    const shaft = new T.Mesh(
      new T.CylinderGeometry(0.065, 0.1, 4.65, 12),
      this.metal,
    );
    shaft.position.y = 2.4;
    shaft.castShadow = true;
    g.add(shaft);
    const head = new T.Group();
    head.position.y = 4.25;
    g.add(head);
    this.box(1.3, 0.12, 0.13, this.metal, 0, 0, 0, head);
    for (const x of [-0.51, 0.51]) {
      this.box(0.08, 0.28, 0.08, this.metal, x, 0.16, 0, head);
      for (let j = 0; j < 3; j++) {
        const ins = new T.Mesh(
          new T.CylinderGeometry(0.095, 0.095, 0.06, 12),
          new T.MeshStandardMaterial({ color: 0xc9d7d5, roughness: 0.3 }),
        );
        ins.position.set(x, 0.25 + j * 0.07, 0);
        head.add(ins);
      }
    }
    this.box(1.35, 0.045, 0.17, this.snowMat, 0, 0.09, 0, head);
    if (central) {
      this.control = head;
      const node = new T.Mesh(
        new T.TorusGeometry(0.24, 0.035, 8, 40),
        this.warm,
      );
      node.position.set(0, -2.7, 0.12);
      g.add(node);
      const light = new T.PointLight(0xf9bf71, 3, 4);
      light.position.set(0, 1.6, 0.3);
      g.add(light);
    }
    g.userData.head = head;
  }
  updateWires() {
    this.control.rotation.y = (this.lastAngle * Math.PI) / 180;
    this.scene.updateMatrixWorld(true);
    for (const w of this.wires) {
      this.scene.remove(w);
      w.geometry.dispose();
    }
    this.wires = [];
    for (let pair = 0; pair < 2; pair++)
      for (const side of [-1, 1]) {
        const a = (this.poles[pair].userData.head as T.Group).localToWorld(
            new T.Vector3(side * 0.51, 0.41, 0),
          ),
          b = (this.poles[pair + 1].userData.head as T.Group).localToWorld(
            new T.Vector3(side * 0.51, 0.41, 0),
          );
        const mid = a.clone().lerp(b, 0.5);
        mid.y -= 0.7;
        const mat = (this.wireMats[pair] ??= new T.MeshStandardMaterial({
          color: 0x243943,
          metalness: 0.65,
          roughness: 0.5,
          emissive: 0x9b7346,
          emissiveIntensity: 0.03,
        }));
        const w = new T.Mesh(
          new T.TubeGeometry(
            new T.QuadraticBezierCurve3(a, mid, b),
            32,
            0.018,
            5,
            false,
          ),
          mat,
        );
        this.scene.add(w);
        this.wires.push(w);
      }
  }
  makeIce(a: T.Vector3, b: T.Vector3) {
    const len = a.distanceTo(b) - 2.2,
      center = a.clone().lerp(b, 0.5),
      dir = b.clone().sub(a).normalize();
    const top = new T.Mesh(
      new T.PlaneGeometry(1.05, len, 12, 48),
      iceMaterial(),
    );
    top.rotation.x = -Math.PI / 2;
    top.rotation.z = Math.atan2(dir.x, dir.z) + Math.PI;
    top.position.copy(center);
    top.position.y = 1.355;
    this.scene.add(top);
    this.ice.push(top);
    const side = this.box(
      1.05,
      0.17,
      len,
      new T.MeshStandardMaterial({
        color: 0x7cabb6,
        transparent: true,
        opacity: 0,
        roughness: 0.3,
        metalness: 0.25,
      }),
      center.x,
      1.27,
      center.z,
    );
    side.rotation.y = Math.atan2(dir.x, dir.z);
    side.visible = false;
    this.iceSides.push(side);
  }
  createCharacter() {
    const coat = new T.MeshStandardMaterial({
        color: 0x23323c,
        roughness: 0.98,
      }),
      boot = new T.MeshStandardMaterial({ color: 0x17212a, roughness: 0.8 }),
      skin = new T.MeshStandardMaterial({ color: 0xd6b5a0, roughness: 0.85 });
    this.character.add(this.body);
    this.body.position.y = 0.4;
    const torso = new T.Mesh(new T.CylinderGeometry(0.14, 0.22, 0.5, 9), coat);
    torso.position.y = 0.16;
    torso.castShadow = true;
    this.body.add(torso);
    this.box(0.24, 0.12, 0.22, coat, 0, 0.45, 0, this.body);
    const face = new T.Mesh(new T.SphereGeometry(0.115, 16, 12), skin);
    face.position.set(0, 0.56, 0.025);
    this.body.add(face);
    const hat = new T.Mesh(
      new T.SphereGeometry(0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      coat,
    );
    hat.position.set(0, 0.6, 0);
    this.body.add(hat);
    this.box(0.27, 0.045, 0.22, coat, 0, 0.62, 0, this.body);
    const scarf = new T.MeshStandardMaterial({ color: 0x9e8062, roughness: 1 });
    this.box(0.27, 0.07, 0.26, scarf, 0, 0.42, 0, this.body);
    this.box(0.075, 0.25, 0.035, scarf, -0.07, 0.29, 0.16, this.body);
    for (const x of [-0.09, 0.09]) {
      const leg = new T.Group();
      leg.position.set(x, -0.04, 0);
      this.body.add(leg);
      this.box(0.11, 0.29, 0.13, coat, 0, -0.14, 0, leg);
      this.box(0.12, 0.09, 0.22, boot, 0, -0.3, 0.035, leg);
      this.legs.push(leg);
    }
    for (const x of [-0.23, 0.23]) {
      const arm = new T.Group();
      arm.position.set(x, 0.31, 0);
      this.body.add(arm);
      this.box(0.11, 0.33, 0.13, coat, 0, -0.12, 0, arm);
      this.box(0.09, 0.09, 0.1, boot, 0, -0.3, 0, arm);
      arm.rotation.z = x > 0 ? 0.12 : -0.12;
      this.arms.push(arm);
    }
    for (let i = 0; i < 3; i++)
      this.box(
        0.025,
        0.025,
        0.015,
        this.metal,
        0.03,
        0.26 - i * 0.09,
        0.178,
        this.body,
      );
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    const v = w / h < 1.1 ? 16 : 11.4;
    const shift = w / h > 1.1 ? 3.3 : 0;
    this.camera.left = (-v * w) / h - shift;
    this.camera.right = (v * w) / h - shift;
    this.camera.top = v;
    this.camera.bottom = -v;
    this.camera.updateProjectionMatrix();
  }
  update(dt: number, r: WorldRules, started: boolean) {
    this.time += dt;
    this.resize();
    this.water.uniforms.time.value = this.time;
    this.water.uniforms.permission.value = r.ab + r.bc;
    const angle = T.MathUtils.damp(
      this.lastAngle === 999 ? 0 : this.lastAngle,
      r.angle,
      7,
      dt,
    );
    if (Math.abs(angle - this.lastAngle) > 0.12 || this.lastAngle === 999) {
      this.lastAngle = angle;
      this.updateWires();
    }
    for (let i = 0; i < 2; i++) {
      const g = i === 0 ? r.ab : r.bc;
      (this.ice[i].material as T.ShaderMaterial).uniforms.growth.value = g;
      this.ice[i].visible = g > 0.001;
      this.iceSides[i].visible = g > 0.97;
      (this.iceSides[i].material as T.MeshStandardMaterial).opacity = g * 0.66;
      if (this.wireMats[i]) this.wireMats[i].emissiveIntensity = g * 0.7;
    }
    const pos = POINTS[r.platform].clone();
    if (r.phase === "walking") {
      const target = r.platform === "A" ? POINTS.B : POINTS.C,
        t = r.travel;
      const e =
        t < 0.08
          ? (t * t) / 0.16
          : t > 0.92
            ? 0.96 - ((1 - t) * (1 - t)) / 0.16
            : t - 0.04;
      pos.lerp(target, Math.min(1, e / 0.96));
      const dir = target.clone().sub(POINTS[r.platform]);
      this.character.rotation.y = Math.atan2(dir.x, dir.z);
      const stride = Math.sin(t * Math.PI * 22),
        taper = Math.min(1, t * 12, (1 - t) * 12);
      this.body.position.y = 0.4 + Math.abs(stride) * 0.025 * taper;
      this.body.rotation.z = stride * 0.025 * taper;
      this.legs.forEach(
        (l, i) => (l.rotation.x = stride * 0.37 * (i === 0 ? 1 : -1) * taper),
      );
      this.arms.forEach(
        (l, i) => (l.rotation.x = stride * 0.23 * (i === 0 ? -1 : 1) * taper),
      );
    } else {
      this.body.position.y = T.MathUtils.damp(this.body.position.y, 0.4, 6, dt);
      this.body.rotation.z *= Math.exp(-dt * 8);
      this.legs.forEach((l) => (l.rotation.x *= Math.exp(-dt * 8)));
      this.arms.forEach((l) => (l.rotation.x *= Math.exp(-dt * 8)));
    }
    if (r.phase === "ending" || r.phase === "complete") {
      pos.lerp(
        POINTS.C.clone().add(new T.Vector3(0.1, 0, -0.5)),
        Math.min(1, r.endTime / 2),
      );
      this.character.rotation.y = Math.PI;
    }
    this.character.position.copy(pos);
    const end = r.phase === "ending" || r.phase === "complete";
    this.doorLight.intensity = end ? 13 + r.endTime * 7 : 13;
    this.character.scale.setScalar(
      end ? Math.max(0, 1 - (r.endTime - 2) / 2) : 1,
    );
    const pull = end ? 1 + r.endTime * 0.018 : started ? 1 : 1.045;
    this.camera.zoom = T.MathUtils.damp(this.camera.zoom, 1 / pull, 1.2, dt);
    this.camera.updateProjectionMatrix();
    const arr = this.snow.geometry.attributes.position.array as Float32Array,
      field = end ? 0 : Math.min(1, Math.abs(r.angle) / 60) * 0.5;
    for (let i = 0; i < this.snowSpeed.length; i++) {
      const j = i * 3,
        s = this.snowSpeed[i];
      arr[j] =
        this.snowBase[j] +
        Math.sin(this.time * 0.24 + i) * 0.6 +
        Math.sin(this.time * 0.02) * 4 * s;
      arr[j + 1] =
        ((((this.snowBase[j + 1] - this.time * s) % 22) + 22) % 22) - 0.4;
      arr[j + 2] = this.snowBase[j + 2] + Math.cos(this.time * 0.21 + i) * 0.35;
      if (i % 4 === 0)
        arr[j + 2] = T.MathUtils.lerp(
          arr[j + 2],
          arr[j] * Math.tan((r.angle * Math.PI) / 180) * 0.22,
          field,
        );
    }
    this.snow.geometry.attributes.position.needsUpdate = true;
    (this.field.material as T.LineBasicMaterial).opacity = 0.06 + field * 0.12;
    this.field.rotation.y = (r.angle * Math.PI) / 180;
    this.composer.render();
  }
}
