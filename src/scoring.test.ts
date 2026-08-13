import {describe,expect,it} from 'vitest'
import {Point,scoreStroke} from './scoring'
const shape=(fn:(t:number)=>[number,number],steps=180,turns=1)=>Array.from({length:steps},(_,i)=>{const t=i/(steps-1)*Math.PI*2*turns;const [x,y]=fn(t);return{x:x+180,y:y+180,t:i} as Point})
const circle=()=>shape(t=>[110*Math.cos(t),110*Math.sin(t)])
describe('roundness scoring',()=>{
  it('scores a perfect circle near 100',()=>expect(scoreStroke(circle()).score).toBeGreaterThan(96))
  it('forgives a slightly imperfect circle',()=>expect(scoreStroke(shape(t=>[(110+4*Math.sin(5*t))*Math.cos(t),(110+4*Math.sin(5*t))*Math.sin(t)])).score).toBeGreaterThan(80))
  it('penalizes an ellipse',()=>expect(scoreStroke(shape(t=>[125*Math.cos(t),70*Math.sin(t)])).score).toBeLessThan(85))
  it('penalizes a square-like shape',()=>{const p:Point[]=[];[[60,60],[300,60],[300,300],[60,300],[60,60]].forEach((a,j,arr)=>{if(!j)return;const b=arr[j-1];for(let i=0;i<40;i++)p.push({x:b[0]+(a[0]-b[0])*i/39,y:b[1]+(a[1]-b[1])*i/39})});expect(scoreStroke(p).score).toBeLessThan(80)})
  it('penalizes an open circle',()=>expect(scoreStroke(shape(t=>[110*Math.cos(t*.78),110*Math.sin(t*.78)])).score).toBeLessThan(70))
  it('rejects a line',()=>expect(scoreStroke(Array.from({length:100},(_,i)=>({x:20+i*3,y:100})))).toMatchObject({valid:false,score:0}))
  it('penalizes a scribble',()=>expect(scoreStroke(shape(t=>[(55+45*Math.sin(7*t))*Math.cos(t),(55+45*Math.sin(7*t))*Math.sin(t)])).score).toBeLessThan(65))
  it('penalizes a circle traced twice',()=>expect(scoreStroke(shape(t=>[110*Math.cos(t),110*Math.sin(t)],240,2)).score).toBeLessThan(60))
})
