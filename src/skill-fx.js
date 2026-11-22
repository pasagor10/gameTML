// Canvas visuals for class attacks, class skills, drones and tiered projectiles.
import {TIERS} from './weapons.js';

const tierColor = (tier, time, fallback = '#8eeaff') => tier === 5 ? `hsl(${(time * 90) % 360} 95% 70%)` : tier >= 0 && TIERS[tier] ? TIERS[tier].color : fallback;
function glow(c, x, y, r, color) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;c.beginPath();c.arc(x, y, r, 0, Math.PI * 2);c.fill();
}
function ring(c, x, y, r, color, width, squash = .62) {
  c.strokeStyle = color;c.lineWidth = width;c.beginPath();c.ellipse(x, y, r, r * squash, 0, 0, Math.PI * 2);c.stroke();
}

// Returns true when the shot style is drawn here; otherwise the caller uses its default arrow.
export function drawShot(c, s, time) {
  const a = Math.atan2(s.vy, s.vx), color = tierColor(s.tier ?? 0, time);
  if (s.style === 'bullet' || s.style === 'pellet') {
    c.save();c.translate(s.x, s.y);c.rotate(a);
    const len = s.style === 'pellet' ? 10 : 18 + (s.tier || 0) * 2;
    glow(c, 0, 0, s.style === 'pellet' ? 8 : 11, `${TIERS[s.tier || 0].glow}aa`);
    c.strokeStyle = color;c.lineWidth = s.style === 'pellet' ? 3 : 4;c.lineCap = 'round';
    c.beginPath();c.moveTo(-len, 0);c.lineTo(2, 0);c.stroke();
    c.strokeStyle = '#fffbe6';c.lineWidth = 1.6;c.beginPath();c.moveTo(-len * .5, 0);c.lineTo(3, 0);c.stroke();
    c.restore();return true;
  }
  if (s.style === 'crescent') {
    c.save();c.translate(s.x, s.y);c.rotate(a);c.scale(1, .9);
    glow(c, 0, 0, 30, `${TIERS[Math.max(0, s.tier || 0)].glow}66`);
    for (let i = 0; i < 3; i++) {c.strokeStyle = i === 2 ? '#ffffff' : color;c.globalAlpha = .45 + i * .25;c.lineWidth = 9 - i * 3;c.beginPath();c.arc(-8, 0, 22 - i * 2, -1.2, 1.2);c.stroke();}
    c.restore();return true;
  }
  if (s.style === 'ice') return false;
  return false;
}

export function drawZone(c, z, time) {
  const q = z.life / z.max;
  c.save();c.globalAlpha = Math.min(1, q * 3);
  if (z.kind === 'whirl') {
    c.translate(z.x, z.y - 18);
    glow(c, 0, 0, z.r, '#9fe0ff40');
    for (let i = 0; i < 3; i++) {
      const a = time * 14 + i * Math.PI * 2 / 3;
      c.strokeStyle = i ? '#bfefff' : '#ffffff';c.lineWidth = 7 - i * 1.5;c.lineCap = 'round';
      c.beginPath();c.ellipse(0, 0, z.r * .9, z.r * .55, 0, a, a + 1.5);c.stroke();
    }
  } else if (z.kind === 'vortex') {
    c.translate(z.x, z.y);
    glow(c, 0, 0, z.r * 1.1, '#7b3dff55');
    c.fillStyle = '#12052acc';c.beginPath();c.ellipse(0, 0, z.r * .28, z.r * .18, 0, 0, Math.PI * 2);c.fill();
    for (let i = 0; i < 4; i++) {
      const a = -time * 5 + i * Math.PI / 2;
      c.strokeStyle = i % 2 ? '#c99cff' : '#7ef3ff';c.lineWidth = 3;
      c.beginPath();for (let k = 0; k <= 20; k++) {const t = k / 20, r = z.r * (1 - t * .85), b = a + t * 4;const x = Math.cos(b) * r, y = Math.sin(b) * r * .6;k ? c.lineTo(x, y) : c.moveTo(x, y);}c.stroke();
    }
  }
  c.restore();
}

export function drawDrone(c, d, time, tier) {
  c.save();c.translate(d.x, d.y + Math.sin(time * 4 + d.x) * 3);
  c.fillStyle = '#12304a40';c.beginPath();c.ellipse(0, 70, 12, 4, 0, 0, Math.PI * 2);c.fill();
  glow(c, 0, 0, 22, `${TIERS[tier].glow}55`);
  c.fillStyle = '#e6eef8';c.strokeStyle = '#27394c';c.lineWidth = 1.6;
  c.beginPath();c.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);c.fill();c.stroke();
  c.fillStyle = '#10223a';c.beginPath();c.ellipse(0, 1, 8, 5, 0, 0, Math.PI * 2);c.fill();
  c.fillStyle = tierColor(tier, time);c.beginPath();c.arc(-3, 1, 1.8, 0, Math.PI * 2);c.arc(3, 1, 1.8, 0, Math.PI * 2);c.fill();
  c.strokeStyle = '#9fe0ff';c.lineWidth = 2;const spin = time * 30;
  c.beginPath();c.moveTo(-18 + Math.cos(spin) * 5, -9);c.lineTo(-18 - Math.cos(spin) * 5, -9);c.moveTo(18 + Math.cos(spin) * 5, -9);c.lineTo(18 - Math.cos(spin) * 5, -9);c.stroke();
  c.restore();
}

// Returns true when handled; the caller falls back to the original effect renderer.
export function drawSkillEffect(c, f, time) {
  const q = 1 - f.life / f.max;
  if (f.kind === 'arcane') {
    const color = tierColor(f.tier ?? 0, time, '#c46bff');
    c.translate(f.x, f.y);glow(c, 0, 0, f.r, '#b06bff33');
    ring(c, 0, 0, f.r * (.4 + q * .6), color, 8 * (1 - q) + 2);ring(c, 0, 0, f.r * (.25 + q * .5), '#ffffff', 2);
    for (let i = 0; i < 6; i++) {const a = i * 1.047 + q * 3;glow(c, Math.cos(a) * f.r * q, Math.sin(a) * f.r * q * .62, 7, '#f0d9ffcc');}
    return true;
  }
  if (f.kind === 'muzzle') {
    c.translate(f.x, f.y);c.rotate(f.a);glow(c, 6, 0, 18, '#fff1a0dd');
    c.fillStyle = '#fffbe0';c.beginPath();c.moveTo(0, -5);c.lineTo(22, 0);c.lineTo(0, 5);c.closePath();c.fill();return true;
  }
  if (f.kind === 'explosion') {
    c.translate(f.x, f.y);glow(c, 0, 0, f.r * (0.6 + q * .6), '#ffb24ecc');
    ring(c, 0, 0, f.r * (.3 + q * .8), '#fff1c0', 6 * (1 - q) + 1);
    for (let i = 0; i < 8; i++) {const a = i * .785, r = f.r * q;glow(c, Math.cos(a) * r, Math.sin(a) * r * .62, 6, '#ff7a3acc');}
    return true;
  }
  if (f.kind === 'blade') { // light sword falling onto the target
    c.translate(f.x, f.y);const drop = (1 - Math.min(1, q * 1.4)) * 160;
    glow(c, 0, 0, 40, '#ffe9a066');
    c.translate(0, -drop);c.fillStyle = '#fffbe8';c.strokeStyle = '#ffcf5a';c.lineWidth = 2;
    c.beginPath();c.moveTo(-5, -70);c.lineTo(5, -70);c.lineTo(6, -12);c.lineTo(0, 0);c.lineTo(-6, -12);c.closePath();c.fill();c.stroke();
    c.fillStyle = '#ffcf5a';c.fillRect(-14, -74, 28, 5);return true;
  }
  if (f.kind === 'meteor') {
    c.translate(f.x, f.y);c.globalAlpha = .5 + Math.sin(time * 20) * .15;
    c.fillStyle = '#ff5a3a55';c.beginPath();c.ellipse(0, 0, f.r, f.r * .62, 0, 0, Math.PI * 2);c.fill();
    c.globalAlpha = 1;ring(c, 0, 0, f.r, '#ffd9a0', 2.5);ring(c, 0, 0, f.r * q, '#ff8a5a', 2);
    const fall = (1 - q) * 260;glow(c, fall * .5, -fall, 26, '#ffb24eee');glow(c, fall * .5, -fall, 12, '#fff7d0');
    return true;
  }
  if (f.kind === 'nova') {
    c.translate(f.x, f.y);ring(c, 0, 0, f.r * q, '#e6c8ff', 14 * (1 - q) + 2);ring(c, 0, 0, f.r * q * .9, '#ffffff', 2);
    glow(c, 0, 0, f.r * q, '#c99cff30');return true;
  }
  if (f.kind === 'lob') { // grenade arc
    const x = f.x + (f.tx - f.x) * q, y = f.y + (f.ty - f.y) * q - Math.sin(q * Math.PI) * 90;
    c.fillStyle = '#00000030';c.beginPath();c.ellipse(f.x + (f.tx - f.x) * q, f.y + 30 + (f.ty - f.y) * q, 7, 3, 0, 0, Math.PI * 2);c.fill();
    c.translate(x, y);c.rotate(q * 12);c.fillStyle = '#4b5a3a';c.strokeStyle = '#1c2616';c.lineWidth = 1.5;
    c.beginPath();c.ellipse(0, 0, 7, 8, 0, 0, Math.PI * 2);c.fill();c.stroke();glow(c, 0, -8, 6, '#ffdf6acc');return true;
  }
  return false;
}
