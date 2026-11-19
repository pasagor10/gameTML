// Original canvas scenery. Seamless periodic ridges and cloud banks are
// independent textures so the camera can reveal depth rather than one poster.
export function makeLandscapeTextures(scene) {
  const texture = (key, w, h, draw) => {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, w, h);
    draw(tex.getContext(), w, h);
    tex.refresh();
  };
  const gradient = (c, h, top, bottom) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    return g;
  };
  // A smooth gradient: drawn at a quarter size and shown 4x (SKY_TILE in
  // parallax.js), 0.9 MB instead of 14 MB of texture.
  texture('expedition-sky', 512, 450, (c, w, h) => {
    const k = w / 2048;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#142c47'); g.addColorStop(.63, '#597e91');
    g.addColorStop(.84, '#b3c6c4'); g.addColorStop(1, '#e2d3b4');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // Warm horizon glow stays subtle enough for the existing night cycle.
    const glow = c.createRadialGradient(1330 * k, 1370 * k, 0, 1330 * k, 1370 * k, 570 * k);
    glow.addColorStop(0, '#fff0c44a'); glow.addColorStop(1, '#fff0c400');
    c.fillStyle = glow; c.fillRect(0, 0, w, h);
  });
  texture('expedition-clouds', 2048, 480, (c, w, h) => {
    for (let i = 0; i < 15; i++) {
      const x = (i * 277) % w, y = 80 + (i * 71) % 310;
      for (const dx of [-w, 0, w]) {
        c.save(); c.translate(x + dx, y); c.scale(4.5, .55);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 90);
        g.addColorStop(0, '#eff1dd27'); g.addColorStop(1, '#eff1dd00');
        c.fillStyle = g; c.fillRect(-90, -90, 180, 180); c.restore();
      }
    }
  });
  const ridge = (c, w, h, base, amplitude, phase, top, bottom) => {
    c.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const t = x / w * Math.PI * 2;
      const y = base + Math.sin(t * 3 + phase) * amplitude
        + Math.sin(t * 7 + phase * 2) * amplitude * .27
        + Math.cos(t * 13 + phase) * amplitude * .08;
      if (!x) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.lineTo(w, h); c.lineTo(0, h); c.closePath();
    c.fillStyle = gradient(c, h, top, bottom); c.fill();
  };
  texture('expedition-peaks', 2048, 650, (c, w, h) => {
    ridge(c,w,h,160,83,.8,'#8ba8b5','#688c9b');
    ridge(c,w,h,250,67,2.4,'#7799a8','#4d778a');
    ridge(c,w,h,355,59,4.1,'#658994','#355e71');
  });
  texture('expedition-ridges', 2048, 520, (c, w, h) => {
    ridge(c,w,h,100,53,1.1,'#547f85','#305b66');
    ridge(c,w,h,190,43,3.5,'#406c71','#274d59');
    ridge(c,w,h,290,35,5.2,'#315b63','#203f4d');
  });
  texture('expedition-forest', 2048, 420, (c, w, h) => {
    ridge(c,w,h,148,32,1.2,'#315b60','#193b43');
    // Mixed broadleaf crowns, distributed periodically to avoid visible seams.
    for (let row = 0; row < 3; row++) {
      c.fillStyle = ['#365f62', '#2c5255', '#21464b'][row];
      for (let i = 0; i < 48; i++) {
        const x = i / 48 * w, y = 145 + row * 65 + Math.sin(i * 2.4) * 22;
        const size = 18 + (i * 13 % 23);
        for (const dx of [-w, 0, w]) {
          c.beginPath(); c.ellipse(x+dx,y,size,size*.78,0,0,Math.PI*2); c.fill();
          c.fillRect(x+dx-2,y,4,60);
        }
      }
    }
    c.fillStyle = gradient(c, h, '#183a4200', '#183a42');
    c.fillRect(0, 240, w, h-240);
  });
  texture('expedition-mist', 2048, 180, (c, w, h) => {
    for (let i = 0; i < 10; i++) {
      for (const dx of [-w,0,w]) {
        c.save(); c.translate(i*w/10+dx,95+Math.sin(i)*20); c.scale(4,.6);
        const g=c.createRadialGradient(0,0,0,0,0,95);
        g.addColorStop(0,'#b9d6cf30');g.addColorStop(1,'#b9d6cf00');
        c.fillStyle=g;c.fillRect(-95,-95,190,190);c.restore();
      }
    }
  });
  // Translucent cave edges add a nearer rock plane without concealing the
  // painted path or suggesting new walkable platforms.
  texture('expedition-cavern', 2048, 850, (c,w,h) => {
    const g=c.createLinearGradient(0,0,0,310);
    g.addColorStop(0,'#091723c9');g.addColorStop(1,'#09172300');
    c.fillStyle=g;c.fillRect(0,0,w,310);
    for(let i=0;i<32;i++) {
      const x=i*w/32, len=45+(i*47%145);
      c.fillStyle=i%2?'#10283242':'#0b1b2955';
      c.beginPath();c.moveTo(x-30,0);c.quadraticCurveTo(x+12,len*.3,x+8,len);
      c.quadraticCurveTo(x+32,len*.4,x+44,0);c.closePath();c.fill();
    }
  });
}
