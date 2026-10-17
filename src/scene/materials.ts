import * as T from "three";
export function stoneTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const c = canvas.getContext("2d")!;
  let seed = 82;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  c.fillStyle = "#71818b";
  c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18000; i++) {
    const v = 90 + rand() * 85;
    c.fillStyle = `rgba(${v},${v + 7},${v + 12},${rand() * 0.19})`;
    c.fillRect(rand() * 512, rand() * 512, rand() * 3 + 0.3, rand() * 2 + 0.3);
  }
  for (let y = 96; y < 512; y += 104) {
    c.strokeStyle = "rgba(27,40,49,.38)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(512, y + 2);
    c.stroke();
    for (let x = ((y / 104) % 2) * 100; x < 512; x += 170) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 2, y - 103);
      c.stroke();
    }
  }
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}
export const waterVertex = `varying vec3 vWorld;varying vec3 vNormal;uniform float time;
void main(){vec3 p=position;p.z+=sin(p.x*.52+time*.38)*.055+sin(p.y*.72-time*.28)*.035;vec4 wp=modelMatrix*vec4(p,1.);vWorld=wp.xyz;vNormal=normalize(mat3(modelMatrix)*vec3(-.029*cos(p.x*.52+time*.38),-.025*cos(p.y*.72-time*.28),1.));gl_Position=projectionMatrix*viewMatrix*wp;}`;
export const waterFragment = `varying vec3 vWorld;varying vec3 vNormal;uniform float time;uniform vec3 eye;uniform vec2 gate;uniform float permission;
void main(){vec3 V=normalize(eye-vWorld);float f=pow(1.-max(dot(normalize(vNormal),V),0.),3.);float rip=sin(vWorld.x*2.+sin(vWorld.z*1.6+time*.4)+time*.45)*sin(vWorld.z*3.-time*.3);vec3 color=mix(vec3(.025,.065,.087),vec3(.15,.24,.28),f*.7);color+=rip*.008;
float spec=pow(max(dot(reflect(normalize(vec3(-7.,-14.,-6.)),normalize(vNormal)),V),0.),95.);color+=vec3(.37,.48,.50)*spec*.23;vec2 d=vWorld.xz-gate;float refl=exp(-abs(d.x)*2.4)*exp(-abs(d.y)*.45)*(sin(d.y*17.+time)*.2+.8);color+=vec3(.4,.24,.10)*refl*.26;float rings=abs(sin(length(vWorld.xz)*2.-time*.8));color+=vec3(.04,.09,.1)*pow(rings,35.)*exp(-length(vWorld.xz)*.16)*permission*.2;color*=.58;gl_FragColor=vec4(color,1.);}`;
export function iceMaterial() {
  return new T.ShaderMaterial({
    transparent: true,
    uniforms: { growth: { value: 0 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float growth;void main(){float jag=sin(vUv.x*51.)*.025+sin(vUv.x*123.)*.012;float a=1.-smoothstep(growth-.06,growth+.015,vUv.y+jag);if(a<.03)discard;vec2 cell=fract(vUv*vec2(6.,22.))-.5;float crack=pow(1.-abs(sin((cell.x+cell.y*.6)*20.)),35.)*.3;float edge=pow(abs(vUv.x-.5)*2.,14.);vec3 col=vec3(.32,.55,.63)+crack+edge*.18;col+=exp(-abs(vUv.y-growth)*75.)*vec3(.25,.36,.36);gl_FragColor=vec4(col,a*.9);}`,
  });
}
