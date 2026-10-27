/**
 * Lightweight Standalone Confetti Engine
 * Smooth celebration effects without external dependencies
 */
(function(global) {
  'use strict';

  let canvas = null;
  let ctx = null;
  let particles = [];
  let animationId = null;

  function initCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'charity-confetti-canvas';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '99999';
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', resize);
    }
  }

  function resize() {
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  const COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#fbbf24'];

  function createParticle(x, y) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 8;
    return {
      x: x || window.innerWidth / 2,
      y: y || window.innerHeight / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 6 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      alpha: 1,
      gravity: 0.25,
      drag: 0.98
    };
  }

  function loop() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.alpha -= 0.008;

      if (p.alpha <= 0 || p.y > canvas.height) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    if (particles.length > 0) {
      animationId = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function launchConfetti(originX, originY, count = 90) {
    initCanvas();
    const ox = originX !== undefined ? originX : window.innerWidth / 2;
    const oy = originY !== undefined ? originY : window.innerHeight * 0.4;

    for (let i = 0; i < count; i++) {
      particles.push(createParticle(ox, oy));
    }

    if (!animationId) {
      loop();
    }
  }

  global.CharityConfetti = {
    launch: launchConfetti
  };
})(typeof window !== 'undefined' ? window : this);
