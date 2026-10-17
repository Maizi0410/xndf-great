import {it,expect} from "vitest";
import * as T from "three";
import {beveledBox} from "../src/scene/geometry";
it("builds closed outward-facing bevels within the original block bounds",()=>{
 const geo=beveledBox(2,1,3,.05),p=geo.attributes.position,n=geo.attributes.normal;
 expect(p.count/3).toBe(44);
 expect(geo.boundingBox!.min.toArray()).toEqual([-1,-.5,-1.5]);
 expect(geo.boundingBox!.max.toArray()).toEqual([1,.5,1.5]);
 const edges=new Map<string,number>();
 const key=(v:T.Vector3)=>v.toArray().map(n=>n.toFixed(5)).join(',');
 for(let i=0;i<p.count;i+=3){
  const tri=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,i+j));
  const normal=new T.Vector3().fromBufferAttribute(n,i);
  expect(tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0])).dot(normal)).toBeGreaterThan(0);
  for(let j=0;j<3;j++){
   const edge=[key(tri[j]),key(tri[(j+1)%3])].sort().join('|');edges.set(edge,(edges.get(edge)??0)+1);
  }
 }
 expect([...edges.values()].every(n=>n===2)).toBe(true);
});
it("clamps bevels safely on thin snow and tiny metal details",()=>{
 for(const size of [.01,.03,.1,1]){
  const g=beveledBox(size,.02,size,.045);
  expect([...g.attributes.position.array,...g.attributes.normal.array,...g.attributes.uv.array].every(Number.isFinite)).toBe(true);
 }
});
