import {it,expect} from "vitest";
import * as T from "three";
import {buildArchitecture} from "../src/scene/architecture";
import {CONNECTIONS,INITIAL,createPuzzleCamera,evaluate} from "../src/game/puzzle";
it("builds four real height layers without obstructing the five existing projected corridors",()=>{
 const scene=new T.Scene(),m=new T.MeshStandardMaterial();
 const art=buildArchitecture(scene,{stone:m,snow:m.clone(),metal:m.clone(),warm:m.clone()});
 for(const level of ["L0","L1","L2","L3"] as const) expect(art.levels[level]).toBeGreaterThan(0);
 expect(art.gears.length).toBe(4);
 expect(art.gears[0].ratio*art.gears[1].ratio).toBeLessThan(0);
 const bounds=new T.Box3().setFromObject(scene);expect(bounds.min.y).toBeLessThan(-1.5);expect(bounds.max.y).toBeGreaterThan(8);
 for(const c of CONNECTIONS.filter(c=>!c.decoy)){
  expect(evaluate({...INITIAL,...c.controls},c.from,createPuzzleCamera(),1440,1000,art.occluders).find(a=>a.id===c.id)?.legal,c.id).toBe(true);
 }
});
