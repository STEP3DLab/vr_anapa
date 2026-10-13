/** State shared by the guided route, exhibit cards and floor plan. */
export function createTour(count){
  if(!Number.isInteger(count)||count<1)throw new RangeError('A tour needs at least one stop');
  let active=false,index=-1,completed=false;const visited=new Set();
  const valid=i=>Number.isInteger(i)&&i>=0&&i<count;
  return {
    get active(){return active;},get index(){return index;},get completed(){return completed;},get visited(){return new Set(visited);},
    start(){active=true;completed=false;visited.clear();index=0;visited.add(0);return index;},
    select(i){if(!valid(i)){index=-1;active=false;return false;}index=i;visited.add(i);return true;},
    previous(){return valid(index)?Math.max(0,index-1):0;},
    next(){return valid(index)?Math.min(count-1,index+1):0;},
    finish(){active=false;completed=visited.size===count;return completed;},
    stop(){active=false;},
  };
}

/** Exhibition coordinates: a 20 × 28 metre hall, north at the Lenin display. */
export function floorPoint(x,z){return {x:Math.max(0,Math.min(100,(x+10)*5)),y:Math.max(0,Math.min(100,(z+14)/28*100))};}
