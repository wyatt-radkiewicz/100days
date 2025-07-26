class Screen {
  constructor(canvasid) {
    this.canvas = document.getElementById(canvasid);
    this.ctx = this.canvas.getContext("2d");
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.updatePSize();
  }

  setFullscreenSize() {
    this.width = Math.ceil(window.innerWidth + 10);
    this.height = Math.ceil(window.innerHeight + 10);
    this.updatePSize();
  }

  updatePSize() {
    if (this.height > this.width) {
      this.pheight = 100;
      this.pwidth = (this.width / this.height) * this.pheight;
    } else {
      this.pwidth = 100;
      this.pheight = (this.height / this.width) * this.pwidth;
    }
  }

  updateCanvasSize() {
    this.updatePSize();
    if (
      this.canvas.width !== this.width ||
      this.canvas.height !== this.height
    ) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      return true;
    }
    return false;
  }

  px(x) {
    return (x / this.pwidth) * this.width;
  }

  py(y) {
    return (y / this.pheight) * this.height;
  }
}

class Star {
  constructor(screen) {
    this.newPosition(screen);
    this.timeAlive = Math.random() * 10;
    this.opacity = 1;
    this.scroll = Math.random() * 10 + 3;
  }

  newPosition(screen) {
    this.x = Math.random() * screen.width;
    this.y = Math.random() * screen.height;
    this.opacity = 0;
    this.timeAlive = Math.random() * 10 + 5;
  }

  draw(screen, scroll, elapsedTime) {
    this.timeAlive -= elapsedTime;
    if (this.timeAlive < 0) {
      this.newPosition(screen);
    } else if (this.timeAlive < 1) {
      this.opacity = this.timeAlive;
    } else {
      this.opacity = Math.min(this.opacity + elapsedTime, 1);
    }
    let y = this.y - scroll / this.scroll;
    if (y < 0) {
      y =
        (y % screen.height) + screen.height + 4 * Math.floor(y / screen.height);
    }
    screen.ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity.toFixed(2)})`;
    screen.ctx.fillRect(this.x, y, 2, 2);
  }
}

class ResourceHandler {
  constructor() {
    this.imgs = {};
    this.pdata = {};
  }

  async loadImages(screen, imagePaths) {
    // Load all images
    return Promise.all(
      imagePaths.map(
        (path) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.src = path;
            img.onload = () => resolve({ img, path });
            img.onerror = reject;
          }),
      ),
    ).then((images) => {
      for (const img of images) {
        const name = img.path.slice(
          img.path.lastIndexOf("/") + 1,
          img.path.lastIndexOf(".") - img.path.length,
        );
        this.imgs[name] = img.img;
      }
      for (const name in this.imgs) {
        const img = this.imgs[name];
        screen.canvas.width = img.naturalWidth;
        screen.canvas.height = img.naturalHeight;
        screen.ctx.drawImage(img, 0, 0);
        this.pdata[name] = screen.ctx.getImageData(
          0,
          0,
          img.naturalWidth,
          img.naturalHeight,
        ).data;
      }
    });
  }
}

class Sprite {
  constructor(image, sw, time) {
    this.image = image;
    this.width = sw;
    this.time = time;
    this.timer = 0;
    this.frame = 0;
  }

  draw(ctx, elapsedTime, dx, dy, dw, dh, a) {
    this.timer += elapsedTime;
    if (this.timer > this.time) {
      this.timer = 0;
      this.frame += 1;
      if (this.frame * this.width >= this.image.naturalWidth) {
        this.frame = 0;
      }
    }
    if (a) {
      ctx.globalAlpha = a;
    }
    ctx.drawImage(
      this.image,
      this.frame * this.width,
      0,
      this.width,
      this.image.naturalHeight,
      dx,
      dy,
      dw,
      dh,
    );
    ctx.globalAlpha = 1;
  }
}

class Firework {
  constructor(res, x, y, killy, timer, pattern) {
    this.x = x;
    this.y = y;
    this.velx = 0;
    this.vely = (killy - y) / timer;
    this.killy = killy;
    this.pattern = pattern;
    this.pdata = res.pdata[pattern];
    this.changedir = 0.1;
    this.numFlashes = 4;
    this.flashNum = this.numFlashes;
    this.flashTimer = 0;
    this.sprite = new Sprite(res.imgs["firework"], 8, 0.05);
  }

  draw(screen, sky, pManager, pCache, elapsedTime) {
    if (this.y < this.killy) {
      this.flashTimer -= 1;
      if (this.flashTimer < 0 && this.flashNum > 0) {
        if (this.flashNum == this.numFlashes) {
          // Spawn the particle effects
          const w = pCache.getWidth(this.pattern);
          const h = pCache.getHeight(this.pattern);
          for (let x = 0; x < w; x++) {
            for (let y = 0; y < h; y++) {
              const index = (y * w + x) * 4;
              if (this.pdata[index + 3] < 32) {
                continue;
              }
              pManager.fireworkParts.push(
                new FireworkParticle(
                  pCache.getImg(this.pattern, x, y),
                  this.x,
                  this.y,
                  this.x + (w / -2 + x) * 1.8,
                  this.y + (h / -2 + y) * 1.8,
                  Math.random() * 0.25 + 0.75,
                  Math.random() * 2 + 4,
                  this.pdata[index],
                  this.pdata[index + 1],
                  this.pdata[index + 2],
                  this.pdata[index + 3],
                ),
              );
            }
          }
        }
        this.flashNum -= 1;
        this.flashTimer = 4;
        sky.flashFrames = 2;
      }
      return;
    }
    this.sprite.draw(
      screen.ctx,
      elapsedTime,
      screen.px(this.x),
      screen.py(this.y),
      screen.px(2),
      screen.py(2),
    );
    this.y += elapsedTime * this.vely;
    this.changedir -= elapsedTime;
    if (this.changedir < 0) {
      this.changedir = 0.1;
      this.velx = Math.random() - 0.5;
      this.velx *= 3.0;
    }
    this.x += this.velx * elapsedTime;
  }
}

class FireworkParticle {
  constructor(img, sx, sy, dx, dy, uptime, falltime, r, g, b, a) {
    this.x = sx;
    this.y = sy;
    this.drag = (2 * (dx - sx)) / (uptime * uptime);
    this.grav = (2 * (dy - sy)) / (uptime * uptime);
    this.uptime = uptime;
    this.falltime = falltime;
    this.starttime = falltime;
    this.velx = this.drag * uptime;
    this.vely = this.grav * uptime;
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
    this.changedir = 0;
    this.alive = true;
    this.img = img;
  }

  draw(screen, elapsedTime) {
    if (this.uptime > 0) {
      this.uptime -= elapsedTime;
      this.velx -= this.drag * elapsedTime;
      this.x += this.velx * elapsedTime;
      this.vely -= this.grav * elapsedTime;
      this.y += this.vely * elapsedTime;
    } else if (this.falltime > 0) {
      this.falltime -= elapsedTime;
      this.changedir -= elapsedTime;
      if (this.changedir < 0) {
        this.changedir = 0.1;
        this.velx = Math.random() - 0.5;
        this.velx *= 3.0;
      }
      this.x += this.velx * elapsedTime;
      this.y += 1.0 * elapsedTime;
    } else {
      if (this.alive) {
        this.alive = false;
      }
    }

    if (this.alive) {
      if (Math.random() < this.falltime / this.starttime) {
        screen.ctx.drawImage(
          this.img,
          screen.px(this.x),
          screen.py(this.y),
          screen.px(2),
          screen.py(2),
        );
      }
    }
  }
}

class ParticleManager {
  constructor(screen) {
    this.makeStars(screen);
    this.fireworkParts = [];
  }

  makeStars(screen) {
    this.stars = Array(Math.floor((screen.width * screen.height) / (50 * 50)))
      .fill(0)
      .map((_) => new Star(screen));
  }

  draw(screen, scroll, elapsedTime) {
    for (const star of this.stars) {
      star.draw(screen, scroll, elapsedTime);
    }
    for (const particle of this.fireworkParts) {
      particle.draw(screen, elapsedTime);
    }
    this.fireworkParts = this.fireworkParts.filter((p) => p.alive);
  }
}

class Sky {
  constructor() {
    let metaTag = document.querySelector('meta[name="theme-color"]');
    metaTag.content = "rgba(40, 31, 56, 1)";
    this.flashFrames = 0;
  }

  getLerpedStyle(from, to, percent) {
    const r = (to[1] - from[1]) * percent + from[1];
    const g = (to[2] - from[2]) * percent + from[2];
    const b = (to[3] - from[3]) * percent + from[3];
    return `rgba(${r}, ${g}, ${b}, 1)`;
  }

  setGradientSteps(steps, gradient, screen, scrollPixel, totalHeight) {
    const percent = Math.min(1, scrollPixel / totalHeight);
    const percentBot = Math.min(1, (scrollPixel + screen.height) / totalHeight);
    const height = screen.height / totalHeight;

    let start = 0;
    let end = 0;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i][0] <= percent) {
        start = i;
      }
      if (percentBot >= steps[i][0]) {
        end = Math.min(i + 1, steps.length - 1);
      }
    }

    for (let i = start; i <= end; i++) {
      if (i == start) {
        // Interpolate and set top
        const base = steps[i][0];
        const sz = (steps[i + 1][0] - base);
        gradient.addColorStop(
          0,
          this.getLerpedStyle(steps[i], steps[i + 1], (percent - base) / sz),
        );
      } else if (i == end) {
        // Interpolate and set bottom
        if (end === steps.length - 1) {
          gradient.addColorStop(
            1,
            this.getLerpedStyle(steps[i], steps[i], 0),
          );
        } else {
          const base = steps[i][0];
          const sz = (steps[i + 1][0] - base);
          gradient.addColorStop(
            1,
            this.getLerpedStyle(steps[i], steps[i + 1], (percentBot - base) / sz),
          );
        }
      } else {
        // Don't interpolate
        gradient.addColorStop(
          (steps[i][0] - percent) / height,
          this.getLerpedStyle(steps[i], steps[i], 0),
        );
      }
    }

    //gradient.addColorStop(0, "rgba(40, 31, 56, 1)");
    //gradient.addColorStop(0.7, "rgba(48, 35, 107, 1)");
    //gradient.addColorStop(1, "rgba(56, 59, 102, 1)");
  }

  draw(screen, elapsedTime) {
    const gradient = screen.ctx.createLinearGradient(0, 0, 0, screen.height);

    // So lets get the stops
    const steps = [
      [0, 40, 31, 56],
      [0.7, 48, 35, 107],
      [1, 56, 59, 102],
    ];
    this.setGradientSteps(
      steps,
      gradient,
      screen,
      window.scrollY,
      document.body.getBoundingClientRect().height,
    );

    screen.ctx.fillStyle = gradient;
    screen.ctx.fillRect(0, 0, screen.width, screen.height);

    if (this.flashFrames > 0) {
      this.flashFrames -= 1;
      screen.ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      screen.ctx.fillRect(0, 0, screen.width, screen.height);
    }
  }
}

class ParticleImageCache {
  constructor(res, particle) {
    this.pimg = res.imgs[particle];
    this.pdata = res.pdata[particle];
    this.cache = {};
  }

  async loadPatterns(res, patterns) {
    for (const pattern of patterns) {
      const pimg = res.imgs[pattern];
      const pdata = res.pdata[pattern];
      const w = pimg.naturalWidth;
      const h = pimg.naturalHeight;
      this.cache[pattern] = {
        w,
        h,
        imgs: Array(w * h).fill(null),
      };
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          const index = (y * w + x) * 4;
          const srcImg = this.pimg;
          const srcData = this.pdata;
          const sw = srcImg.naturalWidth;
          const sh = srcImg.naturalHeight;
          const rawData = new Uint8ClampedArray(sw * sh * 4);
          for (let i = 0; i < rawData.length; i += 4) {
            rawData[i + 0] = Math.floor(
              (srcData[i + 0] * pdata[index + 0]) / 256,
            );
            rawData[i + 1] = Math.floor(
              (srcData[i + 1] * pdata[index + 1]) / 256,
            );
            rawData[i + 2] = Math.floor(
              (srcData[i + 2] * pdata[index + 2]) / 256,
            );
            rawData[i + 3] = Math.floor(
              (srcData[i + 3] * pdata[index + 3]) / 256,
            );
          }
          const canvas = document.createElement("canvas");
          canvas.width = sw;
          canvas.height = sh;
          canvas.style.display = "none";
          canvas.style.position = "absolute";
          document.body.appendChild(canvas);
          const ctx = canvas.getContext("2d");
          const imageData = new ImageData(rawData, sw, sh);
          ctx.putImageData(imageData, 0, 0);
          const img = new Image();
          img.src = canvas.toDataURL();
          img.onload = () => {
            this.cache[pattern].imgs[index / 4] = img;
          };
          document.body.removeChild(canvas);
        }
      }
    }
  }

  getWidth(pattern) {
    if (this.cache[pattern]) {
      return this.cache[pattern].w;
    } else {
      return null;
    }
  }

  getHeight(pattern) {
    if (this.cache[pattern]) {
      return this.cache[pattern].h;
    } else {
      return null;
    }
  }

  getImg(pattern, x, y) {
    if (this.cache[pattern]) {
      return this.cache[pattern].imgs[y * this.cache[pattern].w + x];
    } else {
      return null;
    }
  }
}

class Game {
  constructor(screen, res) {
    this.lastTime = 0;
    this.screen = screen;
    this.res = res;
    this.sky = new Sky();
    this.screen.setFullscreenSize();
    this.screen.updateCanvasSize();
    this.pManager = new ParticleManager(this.screen);
    this.allFireworks = [1, 2, 3, 4, 5];
    this.fireworksNext = [...this.allFireworks];
    this.pCache = new ParticleImageCache(this.res, "firework_particle_01");
    this.doFirework();
    this.showMore = document.getElementById("show-more");
  }

  doFirework() {
    const idx = Math.floor(Math.random() * this.fireworksNext.length);
    const num = this.fireworksNext[idx];
    this.fireworksNext.splice(idx, 1);
    if (this.fireworksNext.length == 0) {
      this.fireworksNext = [...this.allFireworks];
    }

    if (this.screen.pwidth < this.screen.pheight) {
      this.firework = new Firework(
        this.res,
        this.screen.pwidth / 2,
        this.screen.pheight + 16,
        (this.screen.pheight * 3) / 4,
        3,
        `pattern_0${num}`,
      );
    } else {
      this.firework = new Firework(
        this.res,
        (this.screen.pwidth * 2) / 3,
        this.screen.pheight + 16,
        this.screen.pheight / 2,
        3,
        `pattern_0${num}`,
      );
    }

    setTimeout(() => this.doFirework(), 3000 + 1000 * (Math.random() * 4 + 4));
  }

  updateScrollPercent() {
    this.scrollPercent =
      window.scrollY / document.body.getBoundingClientRect().height;
  }

  draw(timestamp) {
    const elapsedTime = Math.min(0.1, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    this.updateScrollPercent();
    this.screen.setFullscreenSize();
    this.screen.updateCanvasSize();
    this.screen.ctx.imageSmoothingEnabled = false;
    this.sky.draw(this.screen, elapsedTime);
    this.pManager.draw(this.screen, window.scrollY, elapsedTime);
    this.firework.draw(
      this.screen,
      this.sky,
      this.pManager,
      this.pCache,
      elapsedTime,
    );
    this.showMore.style.top = `${80 + Math.sin(timestamp / 1000)}vh`;
    if (window.scrollY > 100) {
      this.showMore.style.opacity = "0";
    } else {
      this.showMore.style.opacity = "1";
    }
  }
}

let game = null;
(async () => {
  const screen = new Screen("screen");
  const res = new ResourceHandler();

  await res.loadImages(screen, [
    "img/firework.png",
    "img/firework_particle_01.png",
    "img/pattern_01.png",
    "img/pattern_02.png",
    "img/pattern_03.png",
    "img/pattern_04.png",
    "img/pattern_05.png",
  ]);

  game = new Game(screen, res);
  game.draw(0);
  await new Promise((r) => requestAnimationFrame(r));
  game.pCache.loadPatterns(game.res, [
    "pattern_01",
    "pattern_02",
    "pattern_03",
    "pattern_04",
    "pattern_05",
  ]);
  function animate(elapsedTime) {
    game.draw(elapsedTime);
    window.requestAnimationFrame(animate);
  }
  window.requestAnimationFrame(animate);
})();
