// Capture the same body, costume layers and held weapon that the world draws.
export function showWorldHeroPreview(scene, actor, host) {
  if (!scene || !actor?.image || !host || !host.getClientRects().length) return;
  const images = [actor.image, ...Object.values(actor.layers?.images || {})]
    .filter((image) => image.visible && image.alpha > 0)
    .sort((a, b) => a.depth - b.depth);
  if (!images.length) return;
  const bounds = images.map((image) => image.getBounds());
  const left = Math.min(...bounds.map((b) => b.x)) - 8;
  const top = Math.min(...bounds.map((b) => b.y)) - 8;
  const width = Math.ceil(Math.max(...bounds.map((b) => b.right)) - left + 8);
  const height = Math.ceil(Math.max(...bounds.map((b) => b.bottom)) - top + 8);
  if (!(width > 0 && height > 0) || width > 2048 || height > 2048) return;
  const texture = scene.make.renderTexture({ width, height, add: false });
  texture.camera.setScroll(left, top);
  texture.draw(images);
  texture.snapshot((image) => {
    if (host.isConnected && image?.src) {
      // Atlas cells include transparent padding; trim it so the full figure fills the pedestal.
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < 8) continue;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y);
        x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      if (x1 >= x0) {
        const cropped = document.createElement('canvas');
        cropped.width = x1 - x0 + 1; cropped.height = y1 - y0 + 1;
        cropped.getContext('2d').drawImage(canvas, x0, y0, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
        host.style.backgroundImage = `url("${cropped.toDataURL()}")`;
      }
      host.style.backgroundSize = 'contain';
      host.style.backgroundPosition = 'center bottom';
      host.style.backgroundRepeat = 'no-repeat';
    }
    texture.destroy();
  });
}
