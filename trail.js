/* 마우스 꼬리: 연필 끝에서 빗물 빛줄기가 그려지고 작은 빗방울이 떨어지며 사라진다.
   마우스(터치 아님)에서만, '효과 끔'·동작 줄이기 설정이면 그리지 않는다. 멈추면 그리기도 멈춘다. */
(function () {
  'use strict';
  if (!window.matchMedia || !matchMedia('(pointer: fine)').matches) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var body = document.body;
  var cv = document.createElement('canvas');
  cv.className = 'fxtrail'; cv.setAttribute('aria-hidden', 'true');
  body.appendChild(cv);
  var ctx = cv.getContext('2d'), dpr = 1, W = 0, H = 0;
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size(); addEventListener('resize', size);

  var OX = 2, OY = 2;           /* 커서 끝(가리키는 곳)에서 꼬리가 나온다 */
  var LIFE = 420, SPARK = 750;   /* 빛줄기 길이(ms) · 반짝이 수명(ms) */
  var COLORS = ['#7CC4F5', '#5BA8E8', '#9AD3FA', '#FFC53A'];
  var pts = [], sparks = [], raf = 0, lastX = null, lastY = null;

  function off() { return body.classList.contains('lite') || reduce.matches; }

  addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || off()) return;
    var x = e.clientX + OX, y = e.clientY + OY, now = performance.now();
    pts.push({ x: x, y: y, t: now });
    if (lastX !== null) {
      var d = Math.hypot(x - lastX, y - lastY);
      for (var k = Math.min(3, Math.floor(d / 14)); k > 0; k--) {
        var a = Math.random() * Math.PI * 2, v = .02 + Math.random() * .05;
        sparks.push({ x: x - (x - lastX) * Math.random(), y: y - (y - lastY) * Math.random(),
          vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v + .05, r: 3 + Math.random() * 4,
          c: COLORS[(Math.random() * COLORS.length) | 0], t: now, rot: Math.random() * Math.PI });
      }
    }
    lastX = x; lastY = y;
    if (!raf) raf = requestAnimationFrame(draw);
  }, { passive: true });
  addEventListener('pointerleave', function () { lastX = lastY = null; });
  document.addEventListener('mouseleave', function () { lastX = lastY = null; });

  function star(x, y, r) {  /* 빗방울 모양 */
    ctx.beginPath(); ctx.moveTo(x, y - r * 1.5);
    ctx.bezierCurveTo(x + r * .2, y - r * .9, x + r, y - r * .2, x + r, y + r * .25);
    ctx.arc(x, y + r * .25, r, 0, Math.PI);
    ctx.bezierCurveTo(x - r, y - r * .2, x - r * .2, y - r * .9, x, y - r * 1.5);
    ctx.fill();
  }

  function draw(now) {
    raf = 0;
    ctx.clearRect(0, 0, W, H);
    while (pts.length && now - pts[0].t > LIFE) pts.shift();
    sparks = sparks.filter(function (s) { return now - s.t < SPARK; });
    if (off()) { pts = []; sparks = []; return; }

    /* 빛줄기: 오래된 쪽일수록 가늘고 흐리게 */
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i - 1], q = pts[i], f = 1 - (now - q.t) / LIFE;
      ctx.strokeStyle = 'rgba(124,196,245,' + (.35 * f) + ')'; ctx.lineWidth = 18 * f;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(52,132,214,' + (.95 * f) + ')'; ctx.lineWidth = 6 * f + .5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
    /* 반짝이: 퍼지면서 작아지고 흐려진다 */
    sparks.forEach(function (s) {
      var age = now - s.t, f = 1 - age / SPARK;
      ctx.globalAlpha = f; ctx.fillStyle = s.c;
      star(s.x + s.vx * age, s.y + s.vy * age, s.r * (.4 + .6 * f), s.rot + age * .004);
    });
    ctx.globalAlpha = 1;
    if (pts.length || sparks.length) raf = requestAnimationFrame(draw);
  }
})();
