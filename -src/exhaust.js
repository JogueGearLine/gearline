function createExhaustEffects(){
 const smoke=[];
 const flameDuration=.065;
 const overrunRpm=6000, shiftPopRpm=5000;
 let emission=0, flame=0, popDelay=0, wasAccelerating=false, overrun=false;
 let buffer=null;
 const activeSounds=new Set();
 let loading=null;

 function prepareSound(audio){
  if(!audio||loading)return;
  const bytes=Uint8Array.from(atob(backfireClip),character=>character.charCodeAt(0));
  loading=audio.decodeAudioData(bytes.buffer).then(decoded=>{buffer=decoded},()=>{loading=null});
 }

 function backfire(installed,rpm,audio){
  if(!installed||rpm<=shiftPopRpm||popDelay>0)return;
  emitPop(audio,.85);
  popDelay=.13;
 }

 function emitPop(audio,strength){
  if(Math.random()<.33*strength)flame=flameDuration*strength;
  if(!audio||audio.state!=='running'||!buffer)return;
  const source=audio.createBufferSource();
  const gain=audio.createGain();
  source.buffer=buffer;
  const rate=.88+Math.random()*.24;
  source.playbackRate.value=rate;
  gain.gain.value=.96*strength;
  source.connect(gain).connect(audio.destination);
  activeSounds.add(source);
  source.onended=()=>{activeSounds.delete(source)};
  source.start();
 }

 function update(dt,point,speed,accelerating,rpm,canBackfire,audio){
  flame=Math.max(0,flame-dt);
  popDelay-=dt;
  if(!canBackfire||accelerating||rpm<=overrunRpm)overrun=false;
  else if(wasAccelerating)overrun=true;
  if(overrun&&popDelay<=0){
   const revs=Math.min(1,(rpm-overrunRpm)/(7000-overrunRpm));
   emitPop(audio,.865+.135*revs);
   popDelay=Math.max(.075,.108-.033*revs+popDelay);
  }
  popDelay=Math.max(0,popDelay);
  wasAccelerating=accelerating;
  emission+=dt*(accelerating?14:7);
  while(emission>=1){
   emission--;
   if(smoke.length>=24)smoke.shift();
   smoke.push({x:point.x,y:point.y,age:0,riseDelay:point.smokeRiseDelay||0,vx:-(20+speed*.8),vy:-7-Math.random()*8,opacity:accelerating?.32:.23});
  }
  for(let i=smoke.length-1;i>=0;i--){
   const puff=smoke[i];
   puff.age+=dt;
   if(puff.age>=.75){smoke.splice(i,1);continue}
   puff.x+=puff.vx*dt;
   puff.y+=puff.vy*dt*(puff.riseDelay?Math.min(1,Math.max(0,(puff.age-puff.riseDelay)/.15)):1);
  }
 }

 function draw(ctx,point){
  ctx.save();
  for(const puff of smoke){
   const life=puff.age/.75;
   const radius=3+life*12;
   const fade=ctx.createRadialGradient(puff.x,puff.y,0,puff.x,puff.y,radius);
   fade.addColorStop(0,'#c1c9ce');
   fade.addColorStop(1,'#c1c9ce00');
   ctx.globalAlpha=puff.opacity*(1-life);
   ctx.fillStyle=fade;
   ctx.fillRect(puff.x-radius,puff.y-radius,radius*2,radius*2);
  }
  if(flame>0){
   const life=flame/flameDuration;
   const length=8+18*life;
   const width=1.7+3.9*life;
   const flicker=Math.sin(life*19);
   ctx.globalAlpha=life;
   ctx.translate(point.x,point.y);
   ctx.rotate(point.angle);

   const glow=ctx.createRadialGradient(-3,0,0,-3,0,length*.72);
   glow.addColorStop(0,'#ff994c55');
   glow.addColorStop(1,'#ff641c00');
   ctx.fillStyle=glow;
   ctx.fillRect(-length,-length*.72,length*2,length*1.44);

   const plume=ctx.createLinearGradient(1,0,-length,0);
   plume.addColorStop(0,'#4cb1ff');
   plume.addColorStop(.22,'#fff6bf');
   plume.addColorStop(.55,'#ffad46');
   plume.addColorStop(.83,'#fc5521');
   plume.addColorStop(1,'#fc552100');
   ctx.fillStyle=plume;
   ctx.beginPath();
   ctx.moveTo(1,-1.2);
   ctx.bezierCurveTo(-length*.2,-width,-length*.48,-width*1.35,-length*.66,-width*.48);
   ctx.quadraticCurveTo(-length*.84,-width*.1,-length,flicker*width*.65);
   ctx.bezierCurveTo(-length*.7,width*.35,-length*.38,width,1,1.2);
   ctx.closePath();
   ctx.fill();

   ctx.globalAlpha=life*.8;
   ctx.fillStyle='#fff9d4';
   ctx.beginPath();
   ctx.ellipse(-length*.24,0,length*.23,width*.26,0,0,Math.PI*2);
   ctx.fill();
  }
  ctx.restore();
 }

 function suspend(){
  wasAccelerating=false;
  flame=0;
  overrun=false;
  popDelay=0;
  for(const source of activeSounds)source.stop();
  activeSounds.clear();
 }

 function reset(){
  suspend();
  smoke.length=0;
  emission=0;
 }

 return {prepareSound,update,draw,backfire,suspend,reset,get playing(){return activeSounds.size>0}};
}

// car-backfire-musical.mp3, de 315 a 435 ms.
const backfireClip='UklGRqQWAABXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAAZGF0YYAWAAAAAPz/9f/q/wIAzP9g/4//RgDW/0f/4f9TAD0Aov/+/yj/yf9+AIoABQDB/j7+ef/Z/nj8JP7E/nAA7gFr/jr+UPx8+uL7mwBzACMCwgGwAg8D8gL8BRcIqQVrATv/VgLBBKEEQP8j/5AAKP0EA7YJggeGBlMICQFy+rf7DAHbAHr75f9/Ao8EjwP1AbkE8wTqA7cEfwRoBKwArfJu9yb8J/R/+ZQI0wSe+W/8Nv7c+1YH/hMsDjoFLwFD/jIFfgwHCwkKvQUQBWsMMQxNB/YPvQvS9uT0g/r886j5WgW7CuAdozG9MpoyqSSfGL0lgCqz/hDXcN6M3wnQ4NHH1QrSltgO2dnMQcV/xa3Hr8R/wZ3MQNC8xbPJltRZzWfdgx/aLDjrAs+J4KrZdNfr2kHPCs071GzPosmT1kHaG9Jh2+3m5t5t4iTbZMlSyaTTvdMj1vrXF/e2Irk5Sz9nOp81JC4aJN4qjyu3KjI4mC0vJR8ioyMbLOMzSSjcMP8uLjG7ItQMXAnEDiEjezvfNIQRjxMEGbgnRRbgGvo91z84Jl4VYhhEIS8hjjPJSQ08di1BImMOxw4UEhkpzTFmNUowgBMGJLQ8FQFe4Z0aaUStG34JDf2ZEXYd8RQsHQsvcjEaJo8s4ECeIn8khjXKELTpWAD9OcZN+y6pNURIHkl4OMVZoUumL/b6VAcL/gbvdcFuvsKnU7+k25yr7aNLupe0cbBTrEK5tdyTwhOdSb/fxhLWHtiq8A3W0s4jvpPFoq9buqPRg9Bhveuxz6k3q7K+7NFfB9DhuNtM2wvgYdHZnju7E9iY9gQKxfsGAqANeB74V+UppRkoOylCQT96ZpddyTl1XUpaIk0dVPY8pgCQ9iMV0zNSS+syYkk8Mks1jEmsKucOc+x9GBMzqfiXIcMfIigZRpY6jzj90TcBvRjRDwDyjDQiRogoax9+6DANYg6zCNfyxQcdCskR+OGI8CH8lPl48iXy2+S72hXqJt+S3Se2JL31y5ObFbWmub6fhMF01/jqehlwH3Y6T8JstWHEQvGx+3QA9Qj472nmzCJwXCMtDwnA1lLi1gGT8LPPCMr1EcH5zPX7FucMR//t5WH90wsq4Mz4swYm+NcHYLj7yzLg096lFcMZXv92Csb2DfXQ92v3ie9BsxPGkfPE42rWCNeiyeDnnRRh/mT1l/wv7Uvxp/SU3EEAxRrdFVcIjfz3CEMFeNg5vn3m/At58VHkW/EcueHNr9Ja/cgKyx7MI0zxiAfdUg43LDJpNo0BPREh7Mf95jTrBC66s+AQGOoTAyF/TCpRFQKi0eP7ah68C7MKpgcn8Pbuze2OCVHo3AzL7Kr4DPtG8qQC+90d2rjxwMubmovf09K6uta+jKoj8L4uXAESDAIn4wOSBXUa+kz5BQfZbwzmCusB78xlA6wztRax/Lvd48yR3aTsitNBBt0yGgCj7OkBTkDkKiDO6aw9AOAxXjGfCTvbx9rEKKZC1jfUKQg9tedTuZkDNh7EKTslySSxNTQRDzP1NCQP2eYwq+O8Ve3tHp0MrfDay0rpdwRr3YTWT8Sl6Zfj++GwHXcJyjbxOef4S+++DJYhwzoWB80kZReCKGlCPu8vCJ8s3wQ/+Ci5/93mHWT/SNwq0l78UDmiD+Iicx2A8H/H7shY28LUM7V/rlCxePLlQcFF5i3F0J7OEeVSyNnR4/cUMSwV7NWZ7KgEhQST6eXS/+rC4k3rwt3psYrg++9NzQm+69Yg8v+5Q8nHxA736iCxIf0uo+9m+FtJsETWPcBCsi7DJPglptWl9jMNVzx+MM8Sd++MDNUDXgO7BtgS0P/r+jsp9WjFFLgO5RkUzmHYfcuE4j0Y3hBEJf0fNxE1JIERIgi5BawuDEf1UakHZsHW5ccctB6x8Bu1RqcZCPvY5bWZvQ+nzcsVrtgRP0cg3RHVPwqyWTBCyulctFejHJ6uzmS4rfLbAdSuzrQ+Aaj5fwJuv5i0tdGzOU1EKRxLIuNEAxGJFm8aZSg0Ra8ytf8PJD0fWQAm9JYKOv8OxqsEjOO0wRE8Zz5pDytBpD8oFXoTA/X16FLGeq6C9inNIchszi6/yvVLz+e2MPveBAPBsO2RBb3zDhUiDjv8dEfgVjdIgyNV8w39VinWTVo/nif+CsIHFfdsqqWZ4p+exazef+pgPv/8gwVMBInZFdNMzefNweCmCSUd5OfQ0nwXSOIQ2tgBDeoz9h01J0yhHaEB+DsnT91DCyMIF/8irADSIHAj7QHGBZL4Bw7YJCkkG/UzBN88sh4AEkUcRhBZ4JjaN6ptxFIPMBcyA/j+vB7YIyjueP5p/kz6wP4UxT3Krf2lVxgvE+YA1ga7wdGtBhXRm655s46n6M3H7gsXyRTw3Bjs5Qwu/iSp3akx0PHHAuxAzqriEDmQI7zp896JxJO+4MmP18gxijgH83wIdxGF5l7lzd9x3kDUy/QVzMbHIf2xoGK9HMlnpRq2ObFAsD7d8ayU4SkwQToEUuIuAxCyH28JB/1RKT8uCTTaOIYNYSEORCUkIgbcG0kTuyxnReIWfAdEHc1P/zhpIiwC4c/CMZlcXjyEJbcM9AgiDvYdWFDuF+L4ehNQT7NIrghb4PkEjfPU0nrhxQbQLlI3YyG3EUbZa+FL3TYTlMbIx4vxPQE47snfES4FCOm+Xs1N8roAo6nB5dwr0QHD6hvNiLcf4NDGBr/KyXDxUeyh/oX1FcNbtyDkGfF51XjtrQeW9LTvcDyJLH/tPOUD2jQDrhc6JOwkWz0/VbM0bEI7P40QXj7jTwonABaj9B0eMPWz80Qx+VBaK/UESR03DzQKz/np3Fvh1ArUDxH3T/S55AQNDhcVLz4QoxHWCcHj7wyxBS/w3vSb0lodKyte/hsD6CeMNbQ7J1h/KyDmkQVg468CrOZY51HS6qdz0dznWeM4EeUBa+vQ0yymoM3xD1LsaMahqyzXeazTqujqdxtw0DbAeO/I7djRR9uH3/4pnxhE3df6PAU6IdINhbZ9zAfli/07JH4/j+8H/GExixu4CLAocBKKAPUdSTxdPW4ZxB9gDcz9JPou/usDyS68TnYYkelTwsvAweBM/4cSfilySx424vo7Ahk0BgDHJZY8kxIYBDHEIOEgEEjcRMwF1iXaR//T4Gaq2sJux/DZY/Nk8Zr/mychF6lAyENuAjj/gR4XHzcyzTcs/lz9cgym9ev1CvrIBOXzjxhJBR/19gIkCR4ODSGgAGXCIc5f4D36NeZv3+cupxyW+GsRQyNMCvA13DUS5e3BRv7OD2EvtSdBFWQWQgTfCHIxhSn/E0kaMw0FFJXzU+2ODM/uuOgNDQQX5CHZEVvhPPHu727n+wqmD4Mg8wi/7yj2FPi15XsB4OVDFA8LJOoF6j4CpefQzmTdKtm03OBInSVFFmskh0VQEsfYFtBC0grWdhZD4xUcFRK5HX4u90I6GMIX3P/G/88ZEhk07l73RQgUB84MCCqK/ekJ6Nl/5iYQcg2C0pcAevMZ+ETkUMR2xUsGAxbJ8VTo8wlO8OvlTeLX9s0Hxx2ZG+INM/6iEQXqjfBGAnrhgOy3FrXhxsEG34MGyuilDbs1kA5oDAJJeAbM5Hfqbt9+v2Dn/BLV8TkX0CtX4evWS84q/946+SDz67sF1sOcthO/N9659Mrpme37+gkVa9kkwJH0zcWRs923IMQ13g0BkAxUHuYENQXR8IO3jNfAMVIMqvgCHowkd/CsyrHDLt0S/MH2r8st8NEA/eH7y9u4KsvBzQPJqvNs9rghVyb4CLMAphnaNNgnhSj9L3k4ay8+HfMjIQraFmoM8frWDMgQnP/20tXCpcaM5WoIbvDI6rgGuSKl/I/6agoeLR00USwFJZ/lONf81T/3OjBUI+HwAMV5wNj+mBHA9y8hSjCuMckNEOrVBFsJxAZLEAwlNhvaFAIpbCD7HZIi9/pG7kDvdtLx6hj/Q+JG9RX8P+PU4WreS/1rFmIjpz+pMe0Csf72EuckgRO0Ajj2H/oEKbQuAitsBz3cifLoBJLqv9we5HHjJdbfzwoSxiD17aDjUwxHFpQQeyRaKowb7gGQBmsDj+Sx3iL73QgKA43vLPUBKdg5BgKeyCTxEv7mA70XS/mxFsT+/Q7ADLkC3CkPKqsmxxFnCTE5YTzBG4/n+RFQDkn+IA739tHjfPCk8bPfo+MQDWgmKTGiDNASZg0hFeIkah4HCAwTHRaBEYAM9wN1H8Y1ChXb+h8YzRhw/xAKtxrTFBrhieC2CRYYiQDN1dX+aA8xBC/wUN33+REjehp797HfKOir47PqBQoeDVT78PFj850R0QfeK+UNOwtHEfz5Z+hd2EHheeHZC3gtqPxt5Lfel9IQy7zwWPWG86YKMhZx5UnbEvyo/279weRZ7Pn4OdvWyMvS2fGh9GfqRgbcCj7w/uLA1V/x3xbx7mPdKekJ9VLZAdxvBnITZB8e/rX66gFr7awVQDaoK/IECfUBA5cHWfnd4pzWDgAcDtzwWfFc6HXkyOoN6xzwIvUECLgAHQxf/UgGEyZ9IqsZbRiULr8wSB2mFDoneTC0GRQR2iLJFzX+SQ4bDBb8AucR+SD4e+jpCPoY3eqh13fwfupc2G38kwGOAln2cPkABqH/KQYy82oOPgaI+MEHCv229jXgjOZF9t3naOih5zbnHv/TAvrm6NqT6zzm5v88+v/1NQO/A5vzXOlM8Nb+3+Yc6CX4zwmiFFIfaysWC+wIOy4GJssX4wyEEj0jLwZY7MADJQ5cH9YAVfAABSYQXQ6qAaMN6AB65zPq0PcK6krlrv+f42vi1Pq85NT0jQEu/97xrRNFG44hcwRr+REF8hoLIxsIO+Cg6vAHwxuwBwUIGABZ/acEIOPL2AD3MwaEDUcSKhQgCnEB+ve0/dP/ov2PBm8JEA4OEE4MZAw//Q0O3B3CBtfzG/jxCRMCxQVtDaIGXBQxHmkRt+uu50sIRghrBZcE4veL/hEMuhOlAArryufI84LhvetKA2wGwQTB+28Hz+yf8lv/9wIcDSEaMhcW9T0F5BO9BF/pbeZ46on6lPOl233waAlPIYoML/VaDmQCQgirAzjwnecY7/EPePKo/ckggA7GBIsEYQAnCKgKBQN+CjsCY/dk/Hf/BQ6f/efwLfR9AyL0rdyv6Srq/+oR/+MOCwE49L3we/BP4pPjEvcSCXT1jOc+4KzlY/L+F84ZiwWUDKwCjg9IB24DwRTEGRQEBgDF+S0MEheTHdoHg+4PC5sJu/hR6CjuZv7O/ZcNERTpF1gQtBHiEuUC+xDGGHAUewnBAL75IewD6N7sCQGhC1MUFAzRAev9bPER7EX+6vID6KPrH/VF/h3ouePz9T0UGRuc/Fzj7At+C7ECHf37CJwMk//DCv39V/V3Az/8oex9+7sUchsHGtUDHvrmADj4wQMo+p4DFQSoAYT3D+6w/h4IAhVpDIwBxQ3YAc77cf0D+n8F/RTtAIL5gQLhBCzpDfkpAWv8lPzbAmj+fP/Y+i33Cf68/4ACBAx5/YT4XvYV+scIUgzHEKsMevt0BWIYOhnhCOH+ZQigA8ADg/+N+jX+JgNaCqQQZv+Q/3gFegvX+Bn9bgyl/l0L8wDb86X37exU9q3xgPcwCa8B/fmNABIAvPnK7ob44fO79n/ya+oc9jIBIgAz/eQDyfzl8KTyDwqr/JX13+6B/QgH4f8OBEP/3voxBxwHYf8M+Yv9OwHt8IsIgAkBB2wHCwelD1MS6gV5Aff/bQoAC4b4X/yX+PILPwjJ/kQHGgMoDEcN2w/Q/sjxpwF0CG77SgGd9zT6ovV97E36QPtcAQMHigTGB4j9zfVL/r8OthTKEDgM0wLnB9cBWAQXC5kTzghXAiz4efc48r/usfpM9/j1N/v3AA0M+AiQADbxNv0MCfX+0fpG/wT7APjc+O76bv7cASYEWf0u/zT+lP51Asj/W/2u/xAAnvuUBEUCUgO/Do0Gqgg6ATD50fkXAAL6wfYO/IEGfgLS/un/ovoM+LX7Pv7z9WP0Nvv+/hEHDAVUBK715+818077qf+BAjECdvq6+AX7YvzJAtb/GfbdAtwDYAfzAr8Bd/96A5MDEghl/2D9+vzH+8QF1AcVAYH+K//x/E4DrQGzClUMygJ8+dzyofSw/MMKFQx6BjIBeP5f+i8ErAQt+Bv6LPkC/UQAOwnnBgP6DACHA6n/vwgUCjwJZAQPBvEGcgQaBL8KZQeo/jkAgQlwBGT/cPx8/T//PvufAWj/SwLVCfoFDv55+a760QExAi8FngN8/2b/H/839wT4hv48BB4FsQd7Azr8+gIMBjr9Lf9fBNUFPAQxAHT9sP9BAr0DB/7H/u3+yf1IAZQFegQcBl0Govs7+Jn7FASMAX7+RAAqAUX5PPq5/pUAIAOXApD8VPut/mMEngRICP8GzQaA/g/5zvmg/fP5dfd9+VUABQEtAzcI7ARYAq//AgD0BTQGNAFtAC0B0gTHA2IDewQC/zX8ffz5ALkCjwPXAvT9ifxLAaz+WP3CARQBgvyk/G78mPlG/Kf/fwD+/JsDbf6i+iL+8gDo/3f+ivw0/bP8+/4h/SD/LwRNBb8EMgSPA4ABAgHc/yj94fz+/2X+qP2U/JT8QP7z+k3+pwNTAi8BIQAXAl8AJP0vAab/Wvuj+Wb7MwB+Abb+dP02/sYBw/+M/dkCTgbUBLkA8QCO/m79LP6qAD8A+AApBWYAO/4yAeYAkQFzApwAfv8+/Xv9Qv1k/DYCuANNBOoAsP3D/osAoP9S/+8CngReBDMAh/2J/3T85PweADEBGP7I/RIARAGY/6T+nP2o/Bb+GACo/lf/JQHX/3b/B/5//cv9lfyo/sT9KfzY/0sBxgJdApUBBAGe/1f9xP1I/RUAxf7Y/Jn/aQAcAiL/Vv5d/24BYgA6AFIAVgD+/y3/rgEpAo8AbP0o/fn/ugGmARcCeAHUAYoA3v+t/v3+kgBtARQBQgBjAWcCQv/F/of/Dv/8AKUBCQHSAGEADACz/4z/u/8l/mX/tP+k/23/yf9KAJUAvQDN/yYBlgAA/0D/zv8GAEEApP+8AH4AVP9a/hb/dwAtAAgBugDjAAYC0QB3AEwAdQD9/yoAvgCIAC0ACAAn/6X+ZACqAKgB5AAI/z7/RwBtALP/4v+v/6P/l/9U/6D+pP5g/4//f/+D/8EAIQEnAaQAdgBbAPb/XgDy/3L/2/9SAFYACgAs/4f/UgBWAKgAhAC9/3L/2f/D/wwAFgDv/zwAMwAkAEX/mP9u/z3/JABwANsAWQAyAGAADADh/8X/m//e/+D/HgAWABMAyv/I/yQAyf/L/83/EwAVAOP/CgDO/6b/GQAFAN7/yf/n/+P/6f/o/wAAAwDK/37/qf/X/6T/nf/L/w0ANwArALD/sP8XAPv/9P8OAAoA/v8FABUAHwAzABQAHQD8/9f/3//v/woA/v8gAB8A9P/2//7/GQAtAAUA6P/4/wkABgAWABgAGgA4ABkA5f/2/wMA7v/n//j////y//j/BgAEAOr/3//r//L/8v/9/wAA9//s//v/BgD4//z/BwAFAAgABgADAAAA+//+/wAABAAAAAMABAAAAP//BAACAAEA/v/6//7//P/+/wEAAwABAP///v/+//////8AAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
