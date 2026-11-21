export const PVP = Object.freeze({ every: 1800, offset: 1200, registration: 300, match: 180, countdown: 3, result: 8 });
export const PVP_MODES = Object.freeze({ '1v1': 1, '3v3': 3 });
export function pvpSchedule(t) {
  const cycle = Math.floor((t - PVP.offset) / PVP.every);
  const startsAt = cycle * PVP.every + PVP.offset;
  const closesAt = startsAt + PVP.registration;
  return { cycle, startsAt, closesAt, nextAt: startsAt + PVP.every, open: t >= startsAt && t < closesAt };
}
export const pvpArt = (mode, landscape = false) => `/assets/pvp/${mode}-${landscape ? 'wide' : 'portrait'}.webp`;
