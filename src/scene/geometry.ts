import * as T from "three";
/** A solid 44-triangle chamfered block. Subpixel curved corner subdivisions
 * are unnecessary in the orthographic diorama; planar bevels catch the key light. */
export function beveledBox(w: number,h: number,d: number,r=.035) {
  const outer=[w/2,h/2,d/2];
  r=Math.max(0,Math.min(r,...outer.map(v=>v*.49)));
  if(!r) return new T.BoxGeometry(w,h,d);
  const inner=outer.map(v=>v-r),positions:number[]=[],normals:number[]=[],uvs:number[]=[];
  function face(points:number[][],normal:number[]) {
    const n=new T.Vector3(...normal as [number,number,number]).normalize();
    for(let i=1;i<points.length-1;i++) {
      const tri=[points[0],points[i],points[i+1]];
      const v=tri.map(p=>new T.Vector3(...p as [number,number,number]));
      if(v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).dot(n)<0) [tri[1],tri[2]]=[tri[2],tri[1]];
      const axes=Math.abs(n.y)>.6?[0,2]:Math.abs(n.x)>.6?[2,1]:[0,1];
      for(const point of tri) {
        positions.push(...point);normals.push(n.x,n.y,n.z);
        uvs.push(point[axes[0]]/(outer[axes[0]]*2)+.5,point[axes[1]]/(outer[axes[1]]*2)+.5);
      }
    }
  }
  for(let axis=0;axis<3;axis++) for(const sign of [-1,1]) {
    const a=(axis+1)%3,b=(axis+2)%3,normal=[0,0,0];normal[axis]=sign;
    face([[-1,-1],[1,-1],[1,1],[-1,1]].map(([sa,sb])=>{
      const p=[0,0,0];p[axis]=sign*outer[axis];p[a]=sa*inner[a];p[b]=sb*inner[b];return p;
    }),normal);
  }
  for(let free=0;free<3;free++) for(const sa of [-1,1]) for(const sb of [-1,1]) {
    const a=(free+1)%3,b=(free+2)%3,normal=[0,0,0];normal[a]=sa;normal[b]=sb;
    const point=(t:number,u:number)=>{
      const p=[0,0,0];p[free]=t*inner[free];p[a]=sa*(u?inner[a]:outer[a]);p[b]=sb*(u?outer[b]:inner[b]);return p;
    };
    face([point(-1,0),point(1,0),point(1,1),point(-1,1)],normal);
  }
  for(const sx of [-1,1]) for(const sy of [-1,1]) for(const sz of [-1,1]) {
    face([[sx*outer[0],sy*inner[1],sz*inner[2]],[sx*inner[0],sy*outer[1],sz*inner[2]],[sx*inner[0],sy*inner[1],sz*outer[2]]],[sx,sy,sz]);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute("normal",new T.Float32BufferAttribute(normals,3));
  geometry.setAttribute("uv",new T.Float32BufferAttribute(uvs,2));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}
