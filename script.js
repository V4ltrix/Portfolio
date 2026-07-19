/*
  Підсвітка сітки навколо курсора (--mx/--my на .fx) — працює завжди,
  незалежно від того, який "скін" курсора обрано нижче.
*/
(function () {
  function init() {
    const root = document.documentElement;
    const fx = document.querySelector('.fx');
    if (!fx) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;

    function getRootVar(name, fallback) {
      const val = parseFloat(getComputedStyle(root).getPropertyValue(name));
      return Number.isFinite(val) ? val : fallback;
    }

    window.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    });

    function loop() {
      const fxEase = getRootVar('--cursor-ease', 0.08);
      let mx = parseFloat(fx.style.getPropertyValue('--mx')) || targetX;
      let my = parseFloat(fx.style.getPropertyValue('--my')) || targetY;

      mx += (targetX - mx) * fxEase;
      my += (targetY - my) * fxEase;

      fx.style.setProperty('--mx', mx + 'px');
      fx.style.setProperty('--my', my + 'px');

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ==========================================================
   ЧАСТИНКИ (Квадратики)

   Додано: якщо миша не рухається довше --particle-idle-timeout —
   поле відштовхування плавно "вимикається" (сила спадає до нуля
   за --particle-idle-fade), і частинки просто пролітають повз,
   ігноруючи курсор, поки він знову не поворухнеться.
   ========================================================== */
(function () {
  function init() {
    const canvas = document.querySelector('.fx-particles');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const root = document.documentElement;

    function readVar(name, fallback) {
      const value = getComputedStyle(root).getPropertyValue(name).trim();
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    function readColorVar(name, fallback) {
      const value = getComputedStyle(root).getPropertyValue(name).trim();
      return value || fallback;
    }

    const count = Math.round(readVar('--particle-count', 55));
    const sizeMin = readVar('--particle-size-min', 3);
    const sizeMax = readVar('--particle-size-max', 7);
    const baseColor = readColorVar('--particle-color', '255, 255, 255');
    const baseOpacity = readVar('--particle-opacity', 0.35);
    const speed = readVar('--particle-speed', 0.25);
    const rotationSpeed = readVar('--particle-rotation-speed', 0.02);

    const avoidRadius = readVar('--particle-avoid-radius', 150);
    const avoidForce = readVar('--particle-avoid-force', 6);
    const glowColor = readColorVar('--particle-glow-color', '255, 255, 255');
    const glowOpacity = readVar('--particle-glow-opacity', 0.9);

    // Скільки мс миша має простояти нерухомо, щоб поле почало вимикатись
    const idleTimeout = readVar('--particle-idle-timeout', 800);
    // За скільки мс сила відштовхування плавно спадає до нуля після idleTimeout
    const idleFade = readVar('--particle-idle-fade', 1200);

    const maxSpeed = speed * 4;
    const friction = 0.96;

    let w, h, dpr;
    let mouseX = -9999, mouseY = -9999;
    let lastMouseX = -9999, lastMouseY = -9999;
    let lastMoveTime = performance.now();

    function resize() {
      dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function rand(min, max) { return Math.random() * (max - min) + min; }

    function makeParticle() {
      const angle = rand(0, Math.PI * 2);
      return {
        x: rand(0, w), y: rand(0, h), size: rand(sizeMin, sizeMax),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        baseVx: Math.cos(angle) * speed, baseVy: Math.sin(angle) * speed,
        rotation: rand(0, Math.PI * 2), rotSpeed: rand(-rotationSpeed, rotationSpeed),
        opacity: rand(baseOpacity * 0.5, baseOpacity)
      };
    }

    let particles = [];
    function initParticles() {
      particles = [];
      for (let i = 0; i < count; i++) particles.push(makeParticle());
    }

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    window.addEventListener('resize', () => { resize(); initParticles(); });

    function loop() {
      const now = performance.now();

      // Рахуємо, чи миша реально зрушила з місця відносно попереднього кадру
      if (mouseX !== lastMouseX || mouseY !== lastMouseY) {
        lastMoveTime = now;
        lastMouseX = mouseX;
        lastMouseY = mouseY;
      }

      const idleFor = now - lastMoveTime;

      // fieldStrength: 1 — поле повністю активне, 0 — повністю вимкнене (частинки ігнорують курсор)
      let fieldStrength = 1;
      if (idleFor > idleTimeout) {
        const fadeProgress = (idleFor - idleTimeout) / idleFade;
        fieldStrength = Math.max(0, 1 - fadeProgress);
      }

      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let drawColor = baseColor;
        let drawOpacity = p.opacity;

        if (dist < avoidRadius && dist > 0.01 && fieldStrength > 0) {
          const t = (1 - dist / avoidRadius) * fieldStrength;
          const force = t * speed * avoidForce;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;

          drawColor = glowColor;
          drawOpacity = p.opacity + (glowOpacity - p.opacity) * t;
        }

        // Повернення до "рідного" дрейфу — сильніше, коли поле вимкнене/затухає
        const returnRate = 0.02 + (1 - fieldStrength) * 0.03;
        p.vx += (p.baseVx - p.vx) * returnRate;
        p.vy += (p.baseVy - p.vy) * returnRate;

        const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (currentSpeed > maxSpeed) { p.vx = (p.vx / currentSpeed) * maxSpeed; p.vy = (p.vy / currentSpeed) * maxSpeed; }

        p.vx *= friction; p.vy *= friction;
        p.x += p.vx; p.y += p.vy; p.rotation += p.rotSpeed;

        if (p.x < -20) p.x = w + 20; if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20; if (p.y > h + 20) p.y = -20;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = `rgba(${drawColor}, ${drawOpacity})`;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      requestAnimationFrame(loop);
    }

    resize();
    initParticles();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
