import { describe, expect, it } from 'vitest'
import { resultFrameTransform } from './resultFrame'
import type { Point } from './scoring'

const circle = (cx:number,cy:number,r:number):Point[] => Array.from({length:100},(_,i)=>{const a=i/99*Math.PI*2;return{x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)}})
function assertInside(points:Point[],cx:number,cy:number,r:number){
  const t=resultFrameTransform(points,{center:{x:cx,y:cy},radius:r},300,300)
  const combined=[...points,{x:cx-r,y:cy},{x:cx+r,y:cy},{x:cx,y:cy-r},{x:cx,y:cy+r}]
  for(const p of combined){const x=p.x*t.scale+t.offsetX,y=p.y*t.scale+t.offsetY;expect(x).toBeGreaterThan(5);expect(x).toBeLessThan(295);expect(y).toBeGreaterThan(5);expect(y).toBeLessThan(295)}
  expect(t.scale).toBeGreaterThan(0)
}
describe('result fit-to-frame',()=>{
  it.each([[30,150,28],[270,150,28],[150,30,28],[150,270,28]])('fits circles near every edge', (x,y,r)=>assertInside(circle(x,y,r),x,y,r))
  it('fits a large circle',()=>assertInside(circle(150,150,148),150,150,148))
  it('centers an off-center circle without distortion',()=>{const t=resultFrameTransform(circle(245,76,52),{center:{x:245,y:76},radius:52},320,240);expect(t.scale).toBeCloseTo(t.scale);expect(245*t.scale+t.offsetX).toBeCloseTo(160,5);expect(76*t.scale+t.offsetY).toBeCloseTo(120,5)})
})
