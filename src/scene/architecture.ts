import * as T from "three";
import { beveledBox } from "./geometry";
import { CONNECTIONS, INITIAL, NODES, VIEW_RAY, bridgePose, type Configuration, type Mechanism } from "../game/puzzle";

export interface Architecture {
  occluders: T.Object3D[];
  gears: {object:T.Object3D; mechanism:Mechanism; ratio:number}[];
  levels: Record<"L0"|"L1"|"L2"|"L3",number>;
  protectedPieces: number;
}
/** Guard the actual projected torso corridors, not only world-space endpoints.
 * Camera translation/zoom cannot reveal a blocked orthographic ray, so authored
 * decorative masonry that intersects one of these rays is omitted at build time. */
export function protectedRays() {
  const rays:T.Raycaster[]=[];
  for(const c of CONNECTIONS.filter(c=>!c.decoy)) for(const delta of [-3,0,3]) {
    const config:Configuration={...INITIAL,...c.controls};
    const key=Object.keys(c.controls).at(-1) as Mechanism; config[key]+=delta;
    const pose=bridgePose(c,config);
    for(const half of [pose.left,pose.right]) for(const t of [0,.2,.4,.6,.8,1]) for(const h of [.3,.72]) {
      const p=half.anchor.clone().lerp(half.tip,t).add(new T.Vector3(0,h,0));
      rays.push(new T.Raycaster(p.clone().addScaledVector(VIEW_RAY,35),VIEW_RAY.clone().negate(),0,34.86));
    }
  }
  return rays;
}
export function buildArchitecture(scene:T.Scene,mats:{stone:T.MeshStandardMaterial;snow:T.Material;metal:T.Material;warm:T.Material}):Architecture {
  const result:Architecture={occluders:[],gears:[],levels:{L0:0,L1:0,L2:0,L3:0},protectedPieces:0};
  const guard=protectedRays();
  const stone=mats.stone.clone();stone.color.multiplyScalar(.83);
  const bronze=new T.MeshStandardMaterial({color:0x90734b,metalness:.73,roughness:.48});
  const drowned=new T.MeshStandardMaterial({color:0x12313b,roughness:1,metalness:.12});
  const unit=beveledBox(1,1,1,.035);
  type Item={matrix:T.Matrix4;color:T.Color};
  const batches=new Map<T.Material,Item[]>();
  function box(w:number,h:number,d:number,x:number,y:number,z:number,material:T.Material=stone,level:keyof Architecture["levels"]="L2",protect=true,rotation=0) {
    const object=new T.Mesh(unit,material);object.position.set(x,y,z);object.scale.set(w,h,d);object.rotation.y=rotation;object.updateMatrixWorld(true);
    if(protect && guard.some(ray=>ray.intersectObject(object,false).length>0)){result.protectedPieces++;return;}
    const items=batches.get(material)??[];
    const tone=.91+(items.length%7)*.018;
    const depthFade=material===drowned?Math.exp(Math.min(0,y+.35)*.65):1;
    items.push({matrix:object.matrixWorld.clone(),color:new T.Color(tone*depthFade,tone*depthFade,tone*depthFade)});batches.set(material,items);result.levels[level]++;
  }
  const shape=new T.Shape();
  [[-.5,0],[-.5,.7],[-.25,.92],[0,1],[.25,.92],[.5,.7],[.5,0],[.25,0],[.25,.64],[0,.82],[-.25,.64],[-.25,0]].forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const archGeo=new T.ExtrudeGeometry(shape,{depth:.25,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:1,steps:1});
  const arches:Item[]=[];
  function arch(x:number,y:number,z:number,w:number,h:number,level:keyof Architecture["levels"]) {
    const mesh=new T.Mesh(archGeo,stone);mesh.position.set(x,y,z);mesh.scale.set(w,h,1.4);mesh.updateMatrixWorld(true);
    if(guard.some(ray=>ray.intersectObject(mesh,false).length>0)){result.protectedPieces++;return;}
    arches.push({matrix:mesh.matrixWorld.clone(),color:new T.Color(.9,.95,1)});result.levels[level]++;
  }
  // L0: abandoned routes genuinely below the transparent water, never walkable.
  for(const [x,z] of [[-4,5],[1,5],[7,1],[-7,-5],[3,-8],[-2,-4]]) {
    box(.75,1.4,.8,x,-1.25,z,drowned,"L0",false);
    box(1.15,.18,1.1,x,-.64,z,drowned,"L0",false);
    box(2.1,.14,.5,x+1.35,-1.03,z+.4,drowned,"L0",false,.25);
  }
  arch(-3,-2.25,5.5,1.35,1.5,"L0");arch(5,-2.2,0,1.1,1.4,"L0");
  // L1: retaining piers under the middle island, and snowy isolated outpost edges.
  for(const x of [-1.5,1.5]) for(const z of [-1.25,.8]) {
    box(.5,2.05,.6,x,.15,z,stone,"L1");
    box(.62,.16,.73,x,.98,z,mats.snow,"L1");
  }
  for(const [x,z] of [[-7.6,3.7],[-7.35,2.9],[-6.95,4.45]]) {
    box(.56,.16,.5,x,1.37,z,mats.snow,"L1");
  }
  // L2: a load-bearing upper court and tall, open central gate tower.
  for(const x of [-.95,.95]) {
    box(.31,2.5,.42,x,2.65,-1.32);
    box(.43,.16,.54,x,3.82,-1.32,mats.snow);
  }
  box(2.2,.23,1.32,0,3.94,-1.08);
  box(2.24,.05,1.34,0,4.08,-1.08,mats.snow);
  arch(-1.55,1.3,-2.85,1.85,6.1,"L2");
  box(2.1,.16,.55,-1.55,7.47,-2.7,mats.snow);
  for(const x of [-2.43,-.67]) for(const y of [2.1,3.6,5.1,6.6]) {
    box(.21,.2,.56,x,y,-2.7,stone);
  }
  // The rear elevated arcade crosses behind lower movable stair flights.
  for(const x of [-5.55,-3.6]) arch(x,-.3,-5.8,1.9,5.65,"L2");
  for(const x of [-6.25,-5.5,-4.75,-4,-3.25,-2.5]) {
    box(.72,.26,.82,x,5.45,-5.7);
    box(.74,.07,.84,x,5.62,-5.7,mats.snow);
  }
  // C: layered sanctuary shell around the unchanged destination and portal.
  for(const x of [3.45,6.2]) {
    box(.45,4.1,.65,x,3.3,-8.05);
    box(.55,.12,.73,x,5.43,-8.05,mats.snow);
    box(.74,.24,.9,x,1.52,-8.05);
    box(.54,.22,.7,x,1.78,-8.05);
  }
  arch(4.84,1.3,-8.23,2.9,4.35,"L2");
  box(3.1,.13,.6,4.84,5.73,-8.05,mats.snow);
  // L3: unreachable, dim skyline anchors; their amber is weaker than C's door.
  arch(-6.5,-.35,-9.1,1.45,9.4,"L3");
  arch(5.7,-.35,-12.4,1.25,8.7,"L3");
  for(const [x,y,z] of [[-6.5,9.1,-8.95],[5.7,8.4,-12.25]]) box(1.6,.12,.62,x,y,z,mats.snow,"L3");

  function gear(center:T.Vector3,radius:number,mechanism:Mechanism,ratio:number) {
    const housing=new T.Group();housing.position.copy(center);scene.add(housing);
    const rotor=new T.Group();housing.add(rotor);
    const rim=new T.Mesh(new T.TorusGeometry(radius,.045,6,40),bronze);rotor.add(rim);
    const shaft=new T.Mesh(new T.CylinderGeometry(.07,.07,.4,10),mats.metal);shaft.rotation.x=Math.PI/2;housing.add(shaft);
    const spokes=new T.InstancedMesh(unit,bronze,4),spoke=new T.Object3D();
    for(let i=0;i<4;i++) {spoke.scale.set(radius*1.8,.055,.07);spoke.rotation.z=i*Math.PI/4;spoke.updateMatrix();spokes.setMatrixAt(i,spoke.matrix);}
    rotor.add(spokes);result.occluders.push(housing);
    const teeth=new T.InstancedMesh(unit,bronze,16),dummy=new T.Object3D();
    for(let i=0;i<16;i++) {
      const angle=i*Math.PI/8;dummy.position.set(Math.cos(angle)*(radius+.015),Math.sin(angle)*(radius+.015),0);dummy.rotation.z=angle;dummy.scale.set(.11,.07,.1);dummy.updateMatrix();teeth.setMatrixAt(i,dummy.matrix);
    }
    rotor.add(teeth);result.gears.push({object:rotor,mechanism,ratio});
    // Bolted housing attached to masonry, with the shaft visibly through its center.
    box(radius*2+.24,.16,.25,center.x,center.y-radius-.16,center.z-.15,mats.metal);
    box(.15,.65,.24,center.x,center.y-.2,center.z-.18,mats.metal);
  }
  gear(new T.Vector3(1.02,2.45,-1.02),.48,"axis",-1);
  gear(new T.Vector3(1.78,2.45,-1.02),.24,"axis",2);
  gear(NODES.L.clone().add(new T.Vector3(-.45,.42,-.5)),.26,"stairs",-1);
  gear(NODES.U.clone().add(new T.Vector3(.48,.32,-.6)),.24,"crown",-1);
  for(const p of [new T.Vector3(-1.55,4.8,-2.44),NODES.L.clone().add(new T.Vector3(-.45,.75,-.5)),NODES.C.clone().add(new T.Vector3(1.35,2,-.9))]) {
    box(.09,.19,.09,p.x,p.y,p.z,mats.warm);
    box(.16,.04,.15,p.x,p.y+.12,p.z,mats.metal);
  }
  for(const [material,items] of batches) {
    const mesh=new T.InstancedMesh(unit,material,items.length);
    items.forEach((item,i)=>{mesh.setMatrixAt(i,item.matrix);mesh.setColorAt(i,item.color);});
    mesh.castShadow=material===stone;mesh.receiveShadow=material!==drowned;
    scene.add(mesh);result.occluders.push(mesh);
  }
  const archMesh=new T.InstancedMesh(archGeo,stone,arches.length);
  arches.forEach((item,i)=>archMesh.setMatrixAt(i,item.matrix));archMesh.castShadow=true;archMesh.receiveShadow=true;scene.add(archMesh);result.occluders.push(archMesh);
  scene.updateMatrixWorld(true);
  return result;
}
