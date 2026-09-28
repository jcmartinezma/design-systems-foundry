const SA98G = {
  mainTRC: 2.4,
  sRco: 0.2126729,
  sGco: 0.7151522,
  sBco: 0.072175,
  normBG: 0.56,
  normTXT: 0.57,
  revTXT: 0.62,
  revBG: 0.65,
  blkThrs: 0.022,
  blkClmp: 1.414,
  scaleBoW: 1.14,
  scaleWoB: 1.14,
  loBoWoffset: 0.027,
  loWoBoffset: 0.027,
  deltaYmin: 0.0005,
  loClip: 0.1,
};

function channelToY(channel: number): number {
  return Math.pow(channel / 255, SA98G.mainTRC);
}

export function sRgbToY(r: number, g: number, b: number): number {
  return (
    SA98G.sRco * channelToY(r) +
    SA98G.sGco * channelToY(g) +
    SA98G.sBco * channelToY(b)
  );
}

function blackClamp(y: number): number {
  if (y > SA98G.blkThrs) return y;
  return y + Math.pow(SA98G.blkThrs - y, SA98G.blkClmp);
}

/** Contraste APCA (Lc). Positivo: texto más oscuro que el fondo. Negativo: texto más claro. */
export function apcaContrast(
  text: { r: number; g: number; b: number },
  background: { r: number; g: number; b: number },
): number {
  let txtY = sRgbToY(text.r, text.g, text.b);
  let bgY = sRgbToY(background.r, background.g, background.b);

  if (Math.abs(bgY - txtY) < SA98G.deltaYmin) return 0;

  txtY = blackClamp(txtY);
  bgY = blackClamp(bgY);

  let output = 0;
  if (bgY > txtY) {
    const sapc =
      (Math.pow(bgY, SA98G.normBG) - Math.pow(txtY, SA98G.normTXT)) *
      SA98G.scaleBoW;
    output = sapc < SA98G.loClip ? 0 : sapc - SA98G.loBoWoffset;
  } else {
    const sapc =
      (Math.pow(bgY, SA98G.revBG) - Math.pow(txtY, SA98G.revTXT)) *
      SA98G.scaleWoB;
    output = sapc > -SA98G.loClip ? 0 : sapc + SA98G.loWoBoffset;
  }

  return output * 100;
}
