export type Point = { x: number; y: number; t?: number }
export type ScoreResult = {
  valid: boolean; reason?: string; score: number; center: Point; radius: number; radialStdDev: number;
  radialError: number; closureRatio: number; closureScore: number; smoothness: number; angularCoverage: number;
  coverageScore: number; retracePenalty: number; pathLength: number; normalizedPoints: Point[]
}

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n))
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const empty = (reason: string): ScoreResult => ({ valid: false, reason, score: 0, center: {x:0,y:0}, radius:0, radialStdDev:0, radialError:1, closureRatio:1, closureScore:0, smoothness:0, angularCoverage:0, coverageScore:0, retracePenalty:0, pathLength:0, normalizedPoints:[] })

function resample(points: Point[], count = 160): Point[] {
  const lengths = [0]
  for (let i=1;i<points.length;i++) lengths.push(lengths[i-1] + dist(points[i-1], points[i]))
  const total = lengths.at(-1) || 0
  if (!total) return points
  const out: Point[] = []
  let j = 1
  for (let i=0;i<count;i++) {
    const target = total * i / (count-1)
    while (j < lengths.length-1 && lengths[j] < target) j++
    const span = lengths[j] - lengths[j-1] || 1
    const p = (target-lengths[j-1])/span
    out.push({x:points[j-1].x+(points[j].x-points[j-1].x)*p,y:points[j-1].y+(points[j].y-points[j-1].y)*p})
  }
  return out
}

/** Algebraic least-squares circle fit (Kåsa). The fit follows the player's stroke;
 * it is never compared with a fixed or centered template. The final score blends:
 * radius consistency 55%, closure 15%, tangent smoothness 15%, angular coverage 10%,
 * then subtracts up to 5 points for retracing. Hard validity gates reject taps, lines,
 * tiny marks and very incomplete strokes. Inputs are arc-length resampled so touch event
 * frequency does not change the deterministic result. */
function fitCircle(points: Point[]) {
  const n=points.length
  let sx=0,sy=0,sxx=0,syy=0,sxy=0,sxz=0,syz=0,sz=0
  for(const p of points){const z=p.x*p.x+p.y*p.y;sx+=p.x;sy+=p.y;sxx+=p.x*p.x;syy+=p.y*p.y;sxy+=p.x*p.y;sxz+=p.x*z;syz+=p.y*z;sz+=z}
  const a=[[sxx,sxy,sx],[sxy,syy,sy],[sx,sy,n]], b=[-sxz,-syz,-sz]
  for(let i=0;i<3;i++){let m=i;for(let k=i+1;k<3;k++)if(Math.abs(a[k][i])>Math.abs(a[m][i]))m=k;[a[i],a[m]]=[a[m],a[i]];[b[i],b[m]]=[b[m],b[i]];const d=a[i][i];if(Math.abs(d)<1e-9)return null;for(let j=i;j<3;j++)a[i][j]/=d;b[i]/=d;for(let k=0;k<3;k++)if(k!==i){const f=a[k][i];for(let j=i;j<3;j++)a[k][j]-=f*a[i][j];b[k]-=f*b[i]}}
  const center={x:-b[0]/2,y:-b[1]/2};return {center,radius:Math.sqrt(Math.max(0,center.x*center.x+center.y*center.y-b[2]))}
}

export function scoreStroke(input: Point[]): ScoreResult {
  if(input.length<8)return empty('Keep drawing — one full circle in a single stroke.')
  const path=input.slice(1).reduce((s,p,i)=>s+dist(input[i],p),0)
  const xs=input.map(p=>p.x),ys=input.map(p=>p.y),w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys)
  if(path<70||Math.max(w,h)<28)return empty('That one was too tiny. Give your circle more room.')
  if(Math.min(w,h)/Math.max(w,h)<.08)return empty('That looked more like a line. Try looping all the way around.')
  const points=resample(input), fit=fitCircle(points)
  if(!fit||fit.radius<14)return empty('We could not find a circle in that stroke. Try a wider loop.')
  const radii=points.map(p=>dist(p,fit.center)),mean=radii.reduce((a,b)=>a+b,0)/radii.length
  const std=Math.sqrt(radii.reduce((s,r)=>s+(r-mean)**2,0)/radii.length), radialError=std/mean
  const closureRatio=dist(points[0],points.at(-1)!)/(2*mean), closureScore=clamp(1-closureRatio/0.32)
  const rawAngles=points.map(p=>Math.atan2(p.y-fit.center.y,p.x-fit.center.x));let travel=0,reverse=0
  for(let i=1;i<rawAngles.length;i++){let d=rawAngles[i]-rawAngles[i-1];while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;travel+=d;reverse+=Math.abs(d)}
  const revolutions=Math.abs(travel)/(2*Math.PI), angularCoverage=Math.min(1,revolutions), coverageScore=clamp((angularCoverage-.58)/.38)
  let rough=0
  for(let i=2;i<points.length;i++){const a1=Math.atan2(points[i-1].y-points[i-2].y,points[i-1].x-points[i-2].x),a2=Math.atan2(points[i].y-points[i-1].y,points[i].x-points[i-1].x);let d=Math.abs(a2-a1);if(d>Math.PI)d=2*Math.PI-d;rough+=Math.max(0,d-.14)}
  const smoothness=clamp(1-rough/(points.length*.22))
  const radialScore=clamp(1-radialError/.24)
  const reverseRatio=Math.max(0,reverse-Math.abs(travel))/(2*Math.PI)
  const retracePenalty=clamp(Math.max(0,revolutions-1.12)/.65 + reverseRatio/.8)
  let score=100*(.55*radialScore+.15*closureScore+.15*smoothness+.10*coverageScore+.05*(1-retracePenalty))
  if(revolutions<.52)score*=.25;else if(revolutions<.85)score*=.75;if(revolutions>1.55)score*=.35;if(path/(2*Math.PI*mean)>2.1)score*=.55
  const valid=revolutions>=.38
  return {valid,reason:valid?undefined:'Finish the loop — your circle was too open.',score:valid?Math.round(clamp(score,0,100)*10)/10:0,center:fit.center,radius:mean,radialStdDev:std,radialError,closureRatio,closureScore,smoothness,angularCoverage,coverageScore,retracePenalty,pathLength:path,normalizedPoints:points}
}

export const RATINGS = [
  {min:98,label:'Human Compass'},{min:95,label:'Suspiciously Round'},{min:90,label:'Circle Scholar'},
  {min:80,label:'Pretty Damn Round'},{min:70,label:'Respectable'},{min:60,label:'Getting Oval'},
  {min:50,label:'Potato Adjacent'},{min:0,label:'Technically a Shape'}
] as const
export const ratingFor=(score:number)=>RATINGS.find(r=>score>=r.min)!.label
