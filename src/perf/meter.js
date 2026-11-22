export function createFrameMeter(){
  if(!new URLSearchParams(location.search).has('perf'))return null;
  const output=document.createElement('output');output.id='frame-meter';output.setAttribute('aria-label','สถิติเฟรม');
  output.style.cssText='position:fixed;top:85px;right:16px;padding:8px 12px;background:#06283de8;color:#b9f3ff;border:1px solid #58ccea;border-radius:6px;font:11px monospace;z-index:10;pointer-events:none';
  output.textContent='เริ่มรอบเพื่อวัด FPS';document.body.append(output);
  const intervals=[],cpu=[];let last=0,published=0,draws=0;
  const p95=values=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*.95)]||0;
  return {
    reset(){last=0;},
    record(now,cost,active,drawn){
      if(drawn)draws++;
      if(active){if(last)intervals.push(now-last);last=now;cpu.push(cost);if(intervals.length>120)intervals.shift();if(cpu.length>120)cpu.shift();}else last=0;
      if(now-published<1000)return;published=now;
      const fps=intervals.length?1000*intervals.length/intervals.reduce((a,b)=>a+b,0):0;
      output.textContent=active?`${fps.toFixed(0)} FPS · p95 ${p95(intervals).toFixed(1)} ms · CPU ${p95(cpu).toFixed(1)} ms`:'พักการวาดฉาก';
      output.dataset.draws=String(draws);output.dataset.fps=fps.toFixed(1);output.dataset.cpuP95=p95(cpu).toFixed(2);
    }
  };
}
