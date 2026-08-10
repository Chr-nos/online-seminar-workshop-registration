// particles.js
// Lightweight rising-particle background for login.html / register.html.
// Draws directly on a <canvas id="particle-bg"> that must already exist in the page.

(function () {
  const canvas = document.getElementById("particle-bg");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let particles = [];
  let animationFrameId = null;
  const PARTICLE_COUNT = 42;
  const COLOR = "94, 234, 160"; // matches --accent (#5EEAA0) as an rgb triplet

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function makeParticle(spawnAtBottom) {
    return {
      x: Math.random() * canvas.width,
      y: spawnAtBottom ? canvas.height + Math.random() * 40 : Math.random() * canvas.height,
      radius: Math.random() * 1.6 + 0.6,
      speed: Math.random() * 0.35 + 0.08,
      drift: (Math.random() - 0.5) * 0.15,
      baseOpacity: Math.random() * 0.35 + 0.08
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: PARTICLE_COUNT }, () => makeParticle(false));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      // fade in near the bottom, fade out near the top
      const heightFraction = 1 - p.y / canvas.height;
      const fade = Math.sin(Math.min(heightFraction, 1) * Math.PI);
      const opacity = p.baseOpacity * Math.max(fade, 0);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${COLOR}, ${opacity})`;
      ctx.fill();

      p.y -= p.speed;
      p.x += p.drift;

      if (p.y < -10) {
        Object.assign(p, makeParticle(true));
      }
    }
  }

  function cancelLoop() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function loop() {
    draw();
    animationFrameId = requestAnimationFrame(loop);
  }

  function start() {
    if (prefersReducedMotion) {
      draw();
      return;
    }

    cancelLoop();
    loop();
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      start();
    } else {
      cancelLoop();
    }
  });

  init();
  start();
})();