
//https://osu.ppy.sh/help/wiki/osu!_File_Formats/Osu_(file_format)

function AlmostEquals(v1, v2){
  return Math.abs(v1 - v2) <= 1e-7;
}
function Clamp(n,min,max){
  return Math.max( Math.min(n,max), min);
}

class vector{
  constructor(x,y){
      this.x = x || 0;
      this.y = y || 0;
  }
  eq(v){
      return this.x == v.x && this.y == v.y;
  }
  len(){
      return Math.sqrt( this.x * this.x + this.y * this.y );
  }
  add(v){
      return new vector(this.x+v.x,this.y+v.y);
  }
  // addS(s){
  //     return new vector(this.x+s,this.y+s);
  // }
  sub(v){
      return new vector(this.x-v.x,this.y-v.y);
  }
  // div(v){
  //     return new vector(this.x/v.x,this.y/v.y);
  // }
  mulS(s){
      return new vector(this.x*s,this.y*s);
  }
}

var SliderEvent={
  Generate(startTime,spanDuration,velocity,tickDistance,totalDistance,spanCount,legacyLastTickOffset=0){
      let SliderEvents=[];

      let length=Math.min(100000,totalDistance);
      tickDistance=Clamp(tickDistance,0,length);

      let minDistanceFromEnd=velocity*10;

      SliderEvents.push(
          {
              Type:"Head",
              SpanIndex:0,
              SpanStartTime:startTime,
              Time:startTime,
              PathProgress:0
          }
      );

      if(tickDistance!=0){
          for(let span=0;span<spanCount;span++){
              let spanStartTime=startTime + span * spanDuration;
              let reversed = span % 2 == 1;

              for(let d=tickDistance;d<=length;d+=tickDistance){
                  if(d>=length-minDistanceFromEnd)
                      break;

                  let pathProgress =d/length;
                  let timeProgress=reversed?1-pathProgress:pathProgress;

                  SliderEvents.push(
                      {
                          Type:"Tick",
                          SpanIndex:span,
                          SpanStartTime:spanStartTime,
                          Time:spanStartTime + timeProgress * spanDuration,
                          PathProgress:pathProgress
                      }
                  );

                  if(span<spanCount-1){
                      SliderEvents.push(
                          {
                              Type:"Repeat",
                              SpanIndex:span,
                              SpanStartTime:startTime + span * spanDuration,
                              Time:spanStartTime + spanDuration,
                              PathProgress:(span + 1) % 2,
                          }
                      );
                  }

              }
          }
      }

      let totalDuration = spanCount * spanDuration;

      let finalSpanIndex = spanCount - 1;
      let finalSpanStartTime = startTime + finalSpanIndex * spanDuration;
      let finalSpanEndTime = Math.max(startTime + totalDuration / 2, (finalSpanStartTime + spanDuration) - legacyLastTickOffset);
      let finalProgress = (finalSpanEndTime - finalSpanStartTime) / spanDuration;

      if (spanCount % 2 == 0) finalProgress = 1 - finalProgress;

      SliderEvents.push(
          {
              Type:"LegacyLastTick",
              SpanIndex:finalSpanIndex,
              SpanStartTime:finalSpanStartTime,
              Time:finalSpanEndTime,
              PathProgress:finalProgress
          }
      );

      SliderEvents.push(
          {
              Type:"Tail",
              SpanIndex:finalSpanIndex,
              SpanStartTime:startTime + (spanCount - 1) * spanDuration,
              Time:startTime + totalDuration,
              PathProgress:spanCount % 2
          }
      );

      return SliderEvents;
  }
}

var PathApproximator={
  ApproximateLinear( controlPoints ){
      let result = [];
      for(let c of controlPoints){
          result.push( c );
      }
      return result;
  }
}


class SliderPath{
  constructor(pathType,controlPoints){
      this.pathType=pathType;
      this.controlPoints=controlPoints;//vector

      this.calculatedPath=[];
      this.cumulativeLength=[];
      this.isInitialized=false;
      this.Distance=0;
  }
  ensureInitialized(){
      if (this.isInitialized)
          return;

      this.isInitialized = true;

      this.calculatePath();
      this.calculateCumulativeLength();
      this.Distance=this.cumulativeLength[ this.cumulativeLength.length-1 ] | 0;
  }
}
SliderPath.prototype.calculateCumulativeLength=function(  ){
  let l=0;
  this.cumulativeLength=[];
  this.cumulativeLength.push(l);
  for(let i=0;i<this.calculatedPath.length-1;i++){
      let diff = this.calculatedPath[i+1].sub(this.calculatedPath[i]);//new vector( this.calculatedPath[i+1].x-this.calculatedPath[i].x,this.calculatedPath[i+1].y-this.calculatedPath[i].y);
      let d=diff.len();
      l+=d;
      this.cumulativeLength.push(l);
  }
}
SliderPath.prototype.calculateSubpath=function( subControlPoints ){
  if( this.pathType=='L'){
      return PathApproximator.ApproximateLinear(subControlPoints);
  }
  return [];
}
SliderPath.prototype.calculatePath=function(){
  this.calculatedPath=[];
  let start=0;
  let end=0;
  for(let i=0;i<this.controlPoints.length;i++){
      end++;
      if(i==this.controlPoints.length-1 || this.controlPoints[i].eq( this.controlPoints[i+1] )){
          let cpSpan = this.controlPoints.slice(start, end);
          for(let t of this.calculateSubpath( cpSpan )){
              if( this.calculatedPath.length==0 || !this.calculatedPath[ this.calculatedPath.length-1].eq(t) )
                  this.calculatedPath.push( t );
          }
          start = end;
      }
  }
}
SliderPath.prototype.progressToDistance=function(progress){
  return Clamp(progress,0,1)*this.Distance;//MathHelper.Clamp(progress, 0, 1) * Distance;
}
SliderPath.prototype.interpolateVertices=function(i,d){
  if( this.calculatedPath.length==0)
      return new vector(0,0);

  if(i<=0)
      return this.calculatedPath[0];
  if(i>=this.calculatedPath.length)
      return this.calculatedPath[this.calculatedPath.length-1];

  let p0=this.calculatedPath[i-1];
  let p1=this.calculatedPath[i];

  let d0=this.cumulativeLength[i-1];
  let d1=this.cumulativeLength[i];

  if(AlmostEquals(d0,d1))
      return p0;

  let w=(d-d0)/(d1-d0);
  let t=p1.sub(p0);
  t=t.mulS(w);
  return p0.add(t);
}
SliderPath.prototype.indexOfDistance=function(d){
  for(let i=0;i<this.cumulativeLength.length-1;i++){
      if(d<=this.cumulativeLength[i]){
          return i;
      }
  }
  return this.cumulativeLength.length-1;
}
SliderPath.prototype.PositionAt=function(progress){
  this.ensureInitialized();
  let d=this.progressToDistance(progress);
  return this.interpolateVertices(this.indexOfDistance(d), d);
}

class FastRandom{
  constructor(SEED){
      this._x=Number.parseInt(SEED);
      this.int_mask=0x7fffffff;
      this.y = 842502087;
      this.z = 3579807591;
      this.w = 273326509;
      this._y = this.y;
      this._z = this.z;
      this._w = this.w;
  }
  NextUInt(){
      let t = this._x ^ (this._x<<11);
      this._x = this._y;
      this._y = this._z;
      this._z = this._w;
      this._w = this._w ^ (this._w >> 19) ^ t ^ (t >> 8);
      return this._w;
  }
  Next(){
      return this.NextUInt() & this.int_mask;
  }
  NextDouble(){
      return this.Next()/0x80000000;
  }
}

class myCanvas{
  constructor(){
      //console.log('a');
      this.c = document.getElementById("myCanvas");
      this.ctx=this.c.getContext("2d");
      this.offsetH = this.ctx.canvas.height-this.ctx.canvas.width*(3/4);
  }
  xyRatio(x,y){
      let w = this.ctx.canvas.width;
      //let h = myCanvas.ctx.canvas.height;
      let screenRatio=(w/640);
      return {x:x*(w/640),y:y*screenRatio};
  }
  drawCircle(positionX,positionY, sizeRatio,fillColor){
      let xy=this.xyRatio(positionX+64,positionY+48);
      let newRadius = this.radius*(this.ctx.canvas.width/800)*sizeRatio;
      this.ctx.beginPath();
      //console.log(xy.x,xy.y+offsetH);
      this.ctx.arc(xy.x,xy.y+this.offsetH, newRadius, 0,2*Math.PI);
      this.ctx.fillStyle=fillColor;
      this.ctx.fill();
      return {x:xy.x, y:xy.y+this.offsetH};
  }
  clearCanvas(){
      this.c.onchange();
      this.ctx.clearRect(0, 0, this.c.width, this.c.height);
  }
};

class osuCTBView extends myCanvas {
  constructor(){
      super();
      this.hitObjects=[];
      this.offsetTime=-1000;
      this.playing=null;
      this.timingPoints=[];
      this.lastObjectTime=0;
  }
  osuEnvInit(osuData){
      this.ApproachRate=Number( osuData['ApproachRate'] );
      if( isNaN(this.ApproachRate) )this.ApproachRate=Number( osuData['OverallDifficulty'] );
      this.CircleSize=Number( osuData['CircleSize']);
      this.preempt=(this.ApproachRate>5)?1200-750*(this.ApproachRate-5)/5:1200+600*(5-this.ApproachRate)/5;
      this.fade_in=(this.ApproachRate>5)?800-500*(this.ApproachRate-5)/5:800+400*(5-this.ApproachRate)/5;
      this.radius=54.4 - 4.48 * this.CircleSize;

      this.SliderMultiplier=Number( osuData['SliderMultiplier'] );
      this.SliderTickRate=Number( osuData['SliderTickRate'] );

      this.timingPoints=[];
      let msPerBeat_P=1000;
      for(let point of osuData['TimingPoints']){
          let t = point.split(',');
          let msPerBeat=Number( t[1] );
          if( msPerBeat > 0 )
              msPerBeat_P=msPerBeat;
          this.timingPoints.push( {
              offset: Number( t[0])
              , msPerBeat: msPerBeat
              , msPerBeat_P: msPerBeat_P
              , meter:Number( t[2] )
              , sampleSet:Number( t[3] )
              , sampleIndex:Number( t[4] )
              , volume:Number( t[5] )
              , inherited:Number( t[6] )
              , kiaiMode:Number( t[7] )
          });
      }
  }
  createBananas(hitObj){
      let bananas = [];
      let t = hitObj.split(',');
      let startTime=Number( t[2] );
      let endTime=Number( t[5] );
      let spacing = endTime-startTime;
      while ( spacing > 100 )spacing/=2;
      if( spacing <= 0)return bananas;
      let rng = new FastRandom(1337);
      for( let i = startTime;i<=endTime;i+=spacing){
          let banana={type:8,x: rng.NextDouble()*512 ,y: i };
          //console.log(banana);
          bananas.push( banana );
          rng.Next();
          rng.Next();
          rng.Next();
      }
      return bananas;
  }
  createSlider(hitObj){
      function timingPoint(offset,timingPoints){
          for(let point of timingPoints){
              if( offset >= point.offset){
                  return point;
              }
          }
          return timingPoints[0];
      }
      function beatDuration(offset,timingPoints){
          let point=timingPoint(offset,timingPoints);
          let BeatDuration=point.msPerBeat;
          if(BeatDuration<0){
              BeatDuration=-1*point.msPerBeat_P*BeatDuration/100;
          }
          return BeatDuration;
      }
      //osu-master\osu.Game.Rulesets.Catch\Objects\JuiceStream.cs
      //osu-master\osu.Game\Rulesets\Objects\SliderEventGenerator.cs
      //osu-framework-master\osu.Framework\MathUtils\PathApproximator.cs
      let sliderObjs=[];
      let Obj=hitObj.split(',');
      let time=Number( Obj[2] );//startTime
      Obj[5]=Obj[5].split('|');
      let sliderType=Obj[5].shift();
      let curvePoints=[];
      curvePoints.push( new vector(Number(Obj[0]),Number(Obj[1])) );//curvePoints.push({x:Number(Obj[0]) ,y: Number(Obj[1]) });
      Obj[5].forEach(function(point){
          point=point.split(":");
          //curvePoints.push({x: Number(point[0]) ,y: Number(point[1]) });
          curvePoints.push( new vector( Number(point[0]) , Number(point[1]) ));
      });
      //console.log(curvePoints);
      let repeat=Number( Obj[6] );
      let pixelLength=Number( Obj[7] );
      //let BeatDuration=beatDuration(time,this.timingPoints);
      //let sliderDuration=pixelLength / (100.0 * this.SliderMultiplier) * BeatDuration;
      let SpanCount=repeat;

      //LegacyBeatmapDecoder
      let timepoint=timingPoint(time,this.timingPoints);
      let beatLength=timepoint.msPerBeat;
      let speedMultiplier= beatLength < 0 ? 100.0 / -beatLength : 1;

      //JuiceStream
      let sliderPath = new SliderPath(sliderType,curvePoints);
      sliderPath.ensureInitialized();
      let base_scoring_distance = 100;//const
      let scoringDistance=base_scoring_distance * this.SliderMultiplier * speedMultiplier;
      let Velocity = scoringDistance / beatLength;
      let EndTime=time+SpanCount*sliderPath.Distance/ Velocity;
      let Duration=EndTime-time;
      let Distance=sliderPath.Distance;
      let SpanDuration=Duration/SpanCount;
      let TickDistance = scoringDistance / this.SliderTickRate;
      /*
      create path with curvepoints, slidertime
      create timing

      for timing and path
          generation tiny droplets at time by time
          switch event-type
              tick
                  add droplet on path.potionat( time ) to objs
              repeat
              head
              tail
                  add fruit on path.potionat( time ) to objs
      */
      let sliderEvents = SliderEvent.Generate(time,SpanDuration,Velocity,TickDistance,Distance,SpanCount);
      //console.log(sliderEvents);
      let lastEvt=null;
      //let X=Number( Obj[0] );
      for(let evt of sliderEvents){
          if(lastEvt!=null){
              let sinceLastTick=evt.Time-lastEvt.Time;

              if(sinceLastTick>80){
                  let timeBetweenTiny = sinceLastTick;
                  while(timeBetweenTiny>100)
                      timeBetweenTiny/=2;

                  for(let t=timeBetweenTiny;t<sinceLastTick;t+=timeBetweenTiny){
                      //console.log(X,lastEvt.PathProgress+(t/sinceLastTick)*(evt.PathProgress-lastEvt.PathProgress),sliderPath.PositionAt(lastEvt.PathProgress+(t/sinceLastTick)*(evt.PathProgress-lastEvt.PathProgress)).x,t+lastEvt.Time);
                      sliderObjs.push({
                          x:sliderPath.PositionAt(lastEvt.PathProgress+(t/sinceLastTick)*(evt.PathProgress-lastEvt.PathProgress)).x
                          ,y:t+lastEvt.Time
                          ,name:'Tiny'
                          ,type:2
                      });
                  }
              }
          }
          lastEvt=evt;
          switch(evt.Type){
              case 'Tick':
                  sliderObjs.push({
                      x:sliderPath.PositionAt(evt.PathProgress).x
                      ,y:evt.Time
                      ,name:'Droplet'
                      ,type:2
                  });
                  break;
              case 'Head':
              case 'Tail':
              case 'Repeat':
                  sliderObjs.push({
                      x:sliderPath.PositionAt(evt.PathProgress).x
                      ,y:evt.Time
                      ,name:'Fruit'
                      ,type:2
                  });
                  break;
              default:
                  break;
          }
      }
      return sliderObjs;
  }
  readHitObjects(osuData){
      //osuData['HitObjects']
      //console.log(osuData['HitObjects']);
      this.hitObjects=[];
      for(let obj of osuData['HitObjects']){
          let r=/^(\d+),(\d+),(\d+),(\d+)*/.exec(obj);
          //console.log(r);
          //circle
          if( Number(r[4]) & 1 ){
              this.hitObjects.push( {type:1,x:Number(r[1]),y:Number(r[3])} );
          }
          //slider
          if( Number(r[4]) & 2 ){
              let sliderObjects= this.createSlider(obj);
              //console.log(sliderObjects);
              this.hitObjects=this.hitObjects.concat(sliderObjects );
          }
          //spinner
          if( Number(r[4]) & 8 ){
              //console.log(obj);
              //createBananas
              let bananas=this.createBananas(obj);
              this.hitObjects=this.hitObjects.concat( bananas );
          }
      }
      this.hitObjects.sort(function(a,b){return a.y-b.y;});
      this.lastObjectTime=this.hitObjects[ this.hitObjects.length-1 ].y || 0;
  }
  drawHitCircle(x,y,offsetTime){
      this.drawCircle(x,(384-(300/this.fade_in)*( y - offsetTime)), 1, 'white' );//(350/fade_in)*
  }
  drawHitObjects(offsetTime){
      this.clearCanvas();
      while( this.hitObjects.length > 0 ){
          if( this.hitObjects[0].y < offsetTime+1500 ){
              let hitObject=this.hitObjects.shift();
              this.screenObjects.push( hitObject );
          }
          else{
              break;
          }
      }

      while( this.screenObjects.length > 0) {
          if( this.screenObjects[0].y < offsetTime-1500 ){
              this.screenObjects.shift();
          }
          else{
              break;
          }
      }
      for(let hitObject of this.screenObjects){
          if( hitObject.type==1){//fruits
              this.drawHitCircle(hitObject.x,hitObject.y,offsetTime);
          }
          else if( hitObject.type==2){//slider
              let x=hitObject.x;
              let y=hitObject.y;
              switch(hitObject.name){
                  case 'Fruit':
                      this.drawCircle(x,(384-(300/this.fade_in)*( y - offsetTime)), 1, 'red' );
                      break;
                  case 'Droplet':
                      this.drawCircle(x,(384-(300/this.fade_in)*( y - offsetTime)), 0.5, 'red' );
                      break;
                  case 'Tiny':
                      //console.log(x,y);
                      this.drawCircle(x,(384-(300/this.fade_in)*( y - offsetTime)), 0.25, 'red' );
                      break;
              }
              //this.drawHitCircle(hitObject.x,hitObject.y,offsetTime);
          }
          else if( hitObject.type==8){//bananas
              this.drawBanana(hitObject.x,hitObject.y,offsetTime);
          }
      }
  }
  drawBanana(x,y,offsetTime){
      this.drawCircle(x,(384-(300/this.fade_in)*( y - offsetTime)), 0.5, 'skyblue' );
  }
  playHitObjects(){
      const updateInterval = 1000/60;
      this.screenObjects=[];
      this.offsetTime=-1000;
      if( this.playing != null ){
          clearInterval(this.playing);
      }
      this.playing = setInterval(function(t){
          t.drawHitObjects(t.offsetTime);
          t.offsetTime+=updateInterval;
      }, updateInterval,this);
      setTimeout(function(t){
          clearInterval(t.playing);
          t.playing=null;
      },this.lastObjectTime+2000,this);
  }
  getProgress(){//현재 진행률 (return 0~1)
      let lastObjectTime=this.lastObjectTime | 1;//prevent div by 0
      return this.offsetTime/lastObjectTime;
  }
};
