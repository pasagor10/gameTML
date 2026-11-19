// A horizontally repeating strip drawn with plain Images that share one
// texture. It stands in for Phaser's TileSprite in the backgrounds.
//
// Why: a Phaser 3.90 TileSprite keeps its own canvas the size of the sprite
// plus a power-of-two copy of the source picture, and uploads both to the
// GPU. The town's 14 strips cost ~110 MB of GPU memory and as much RAM that
// way, the main thing filling a 4 GB tablet. Images side by side cost
// nothing beyond the texture already loaded.
//
// Supported: horizontal repeat (tilePositionX), vertical window into the
// picture (tilePositionY with a height up to the picture's), tile scale,
// origin, scroll factor, scale, tint, alpha, flip, depth and visibility.
export class TileStrip {
  constructor(scene, x, y, width, height, key) {
    this.scene = scene;
    this.key = key;
    this.images = [];
    this.x = x;
    this._y = y;
    this.width = width;
    this.height = height;
    this.originX = 0.5;
    this.originY = 0.5;
    this.scrollX = 1;
    this.scrollY = 1;
    this.depth = 0;
    this.scaleY = 1;
    this.tileScaleX = 1;
    this.tileScaleY = 1;
    this._tileX = 0;
    this._tileY = 0;
    this.tint = null;
    this._alpha = 1;
    this.visible = true;
    this.flipX = false;
    this.layout();
  }
  // Repositions the images; called by every setter that moves the strip.
  layout() {
    const src = this.scene.textures.get(this.key).getSourceImage(),
      sw = src.width,
      sh = src.height,
      tw = sw * this.tileScaleX,
      cy = Math.max(0, Math.min(sh, this._tileY)),
      ch = Math.max(0, Math.min(sh - cy, this.height / this.tileScaleY)),
      sy = this.tileScaleY * this.scaleY,
      left = this.x - this.originX * this.width,
      top = this._y - this.originY * this.height * this.scaleY,
      off = (((this._tileX * this.tileScaleX) % tw) + tw) % tw,
      need = this.visible ? Math.ceil((this.width + off) / tw) : 0;
    while (this.images.length < need) {
      const im = this.scene.add.image(0, 0, this.key).setOrigin(0, 0);
      this.images.push(im);
      this.style(im);
    }
    this.images.forEach((im, i) => {
      if (i >= need) return im.setVisible(false);
      im.setVisible(true)
        .setScale(this.tileScaleX, sy)
        .setCrop(0, cy, sw, ch)
        .setPosition(left - off + i * tw, top - cy * sy);
    });
    return this;
  }
  style(im) {
    im.setScrollFactor(this.scrollX, this.scrollY)
      .setDepth(this.depth)
      .setAlpha(this._alpha)
      .setFlipX(this.flipX);
    if (this.tint == null) im.clearTint();
    else im.setTint(this.tint);
  }
  restyle() {
    this.images.forEach((im) => this.style(im));
    return this;
  }
  setOrigin(x, y = x) {
    this.originX = x;
    this.originY = y;
    return this.layout();
  }
  setScrollFactor(x, y = x) {
    this.scrollX = x;
    this.scrollY = y;
    return this.restyle();
  }
  setDepth(d) {
    this.depth = d;
    return this.restyle();
  }
  setTint(c) {
    this.tint = c;
    return this.restyle();
  }
  setAlpha(a) {
    this._alpha = a;
    return this.restyle();
  }
  get alpha() {
    return this._alpha;
  }
  set alpha(a) {
    this.setAlpha(a);
  }
  setFlipX(f) {
    this.flipX = !!f;
    return this.restyle();
  }
  setVisible(v) {
    if (this.visible === !!v) return this;
    this.visible = !!v;
    return this.layout();
  }
  setTexture(key) {
    if (key === this.key) return this;
    this.key = key;
    this.images.forEach((im) => im.setTexture(key));
    return this.layout();
  }
  setTileScale(x, y = x) {
    this.tileScaleX = x;
    this.tileScaleY = y;
    return this.layout();
  }
  setScale(x, y = x) {
    // Strips only stretch vertically (widths are set with setSize).
    this.scaleY = y;
    return this.layout();
  }
  setX(x) {
    this.x = x;
    return this.layout();
  }
  setY(y) {
    this._y = y;
    return this.layout();
  }
  get y() {
    return this._y;
  }
  set y(v) {
    this.setY(v);
  }
  setPosition(x, y = this._y) {
    this.x = x;
    this._y = y;
    return this.layout();
  }
  setSize(w, h) {
    this.width = w;
    this.height = h;
    return this.layout();
  }
  get tilePositionX() {
    return this._tileX;
  }
  set tilePositionX(v) {
    this._tileX = v;
    this.layout();
  }
  get tilePositionY() {
    return this._tileY;
  }
  set tilePositionY(v) {
    this._tileY = v;
    this.layout();
  }
  destroy() {
    this.images.forEach((im) => im.destroy());
    this.images = [];
  }
}

export const tileStrip = (scene, x, y, width, height, key) =>
  new TileStrip(scene, x, y, width, height, key);
