(function(){
  'use strict';
  // Active simulation time only; the host owns pause, animation frames and rewards.
  var DURATION=40,COUNT=15;
  function create(random){
    return {kind:'frog',active:true,running:false,pausedAt:null,round:0,completedRounds:0,score:0,rewardConsumed:false,random:random||Math.random,holes:[]};
  }
  function beginRound(g){
    if(g.running||g.completedRounds>=3)return false;
    g.round++;g.elapsed=0;g.roundScore=0;g.spawned=0;g.missed=0;g.nextWave=.35;g.nextDouble=13+g.random()*4;g.holes=[];
    for(var i=0;i<COUNT;i++)g.holes.push({born:null,hitAt:null,duration:.75});
    g.running=true;return true;
  }
  function expire(g,time){
    g.holes.forEach(function(h){if(h.born!==null&&h.born+h.duration<=time){if(h.hitAt===null)g.missed++;h.born=null;h.hitAt=null;}});
  }
  function spawn(g,time){
    var free=[];g.holes.forEach(function(h,i){if(h.born===null)free.push(i);});
    var count=time>=g.nextDouble?2:1;
    if(count===2)g.nextDouble=time+13+g.random()*4;
    for(var i=0;i<count;i++){
      var index=free.splice(Math.floor(g.random()*free.length),1)[0];
      g.holes[index].born=time;g.holes[index].hitAt=null;g.holes[index].duration=count===2?1:.75;g.spawned++;
    }
    g.nextWave=time+1.25+g.random()*.3;
  }
  function advance(g,dt){
    if(!g.running||g.pausedAt!==null||!Number.isFinite(dt)||dt<=0)return false;
    var end=Math.min(DURATION,g.elapsed+dt);
    // Never start a frog without its complete response window (up to one second for pairs).
    while(g.nextWave<=end&&g.nextWave<=DURATION-1){expire(g,g.nextWave);spawn(g,g.nextWave);}
    expire(g,end);g.elapsed=end;
    if(end>=DURATION){g.running=false;g.completedRounds++;return true;}
    return false;
  }
  function hit(g,index){
    var h=g.holes[index];
    if(!g.running||g.pausedAt!==null||!h||h.born===null||h.hitAt!==null||g.elapsed>=h.born+h.duration)return false;
    h.hitAt=g.elapsed;g.roundScore++;g.score++;return true;
  }
  function pose(g,h,reduced){
    if(h.born===null)return 0;
    var age=g.elapsed-h.born;
    if(h.hitAt!==null)return reduced?0:Math.max(0,1-(g.elapsed-h.hitAt)/.16);
    if(reduced)return 1;
    return Math.max(0,Math.min(1,age/.16,(h.duration-age)/.18));
  }
  function topFive(input){
    var seen={};
    return (Array.isArray(input)?input:[]).filter(function(e){
      if(!e||!Number.isSafeInteger(e.score)||e.score<0||!Number.isFinite(e.at)||e.at<0||e.at>8640000000000000||typeof e.id!=='string'||!/^frog-[a-z0-9-]{1,64}$/.test(e.id)||seen[e.id])return false;
      seen[e.id]=true;return true;
    }).map(function(e,i){return {id:e.id,at:e.at,score:e.score,order:i};}).sort(function(a,b){return b.score-a.score||b.at-a.at||a.order-b.order;}).slice(0,5).map(function(e){return {id:e.id,at:e.at,score:e.score};});
  }
  window.FrogPunch={create:create,beginRound:beginRound,advance:advance,hit:hit,pose:pose,topFive:topFive,duration:DURATION,count:COUNT};
})();
