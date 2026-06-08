import type maplibregl from 'maplibre-gl';

const PRIMARY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4h14a2 2 0 012 2v3H3V6a2 2 0 012-2zm-2 7h18v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9zm9 2v3h2v-3h-2z"/></svg>`;
const SECONDARY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>`;
const LOCKED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>`;

const DPR = 2;
const PIN_SIZE = 40;

const IMAGE_NAMES = [
  'quest-available-primary',
  'quest-available-secondary',
  'quest-discovered-primary',
  'quest-discovered-secondary',
  'quest-locked-primary',
  'quest-locked-secondary',
];

async function drawSvgOnCanvas(
  ctx: CanvasRenderingContext2D,
  svgStr: string,
  x: number,
  y: number,
  size: number,
): Promise<void> {
  const colored = svgStr.replace('fill="currentColor"', 'fill="#ffffff"');
  const url = `data:image/svg+xml,${encodeURIComponent(colored)}`;
  const img = new Image(size, size);
  img.src = url;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
  ctx.drawImage(img, x, y, size, size);
}

function shadowColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * 0.55)},${Math.round(g * 0.55)},${Math.round(b * 0.55)})`;
}

async function renderPinImageData(
  bgColor: string,
  svgStr: string,
  opacity: number,
): Promise<ImageData> {
  const SHADOW_PX = 4 * DPR; // Flat 2.0: solido verso il basso
  const W = PIN_SIZE * DPR;
  const H = PIN_SIZE * DPR + SHADOW_PX;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const cx = W / 2;
  const cy = W / 2; // centro nel quadrato superiore
  const r = (PIN_SIZE / 2 - 3) * DPR;

  ctx.globalAlpha = opacity;

  // Ombra solida Flat 2.0: cerchio più scuro sfalsato in basso
  ctx.beginPath();
  ctx.arc(cx, cy + SHADOW_PX, r, 0, Math.PI * 2);
  ctx.fillStyle = bgColor.startsWith('#') ? shadowColor(bgColor) : 'rgba(0,0,0,0.35)';
  ctx.fill();

  // Cerchio principale
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();

  // Bordo bianco
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5 * DPR;
  ctx.stroke();

  // Icona SVG (bianca, centrata)
  const iconPx = 20 * DPR;
  await drawSvgOnCanvas(ctx, svgStr, cx - iconPx / 2, cy - iconPx / 2, iconPx);

  return ctx.getImageData(0, 0, W, H);
}

export async function registerQuestIcons(map: maplibregl.Map, primaryColor: string): Promise<void> {
  const successColor =
    getComputedStyle(document.body).getPropertyValue('--color-success').trim() || '#52b788';

  for (const name of IMAGE_NAMES) {
    if (map.hasImage(name)) map.removeImage(name);
  }

  const variants = [
    { name: 'quest-available-primary', svg: PRIMARY_SVG, bg: primaryColor, opacity: 1.0 },
    { name: 'quest-available-secondary', svg: SECONDARY_SVG, bg: primaryColor, opacity: 1.0 },
    { name: 'quest-discovered-primary', svg: PRIMARY_SVG, bg: successColor, opacity: 0.65 },
    { name: 'quest-discovered-secondary', svg: SECONDARY_SVG, bg: successColor, opacity: 0.65 },
    { name: 'quest-locked-primary', svg: LOCKED_SVG, bg: '#8a8a8a', opacity: 0.75 },
    { name: 'quest-locked-secondary', svg: LOCKED_SVG, bg: '#8a8a8a', opacity: 0.75 },
  ];

  await Promise.all(
    variants.map(async (v) => {
      const data = await renderPinImageData(v.bg, v.svg, v.opacity);
      map.addImage(v.name, data, { pixelRatio: DPR });
    }),
  );
}
