/* 표지: 구름에서 빗방울 세 개가 모루의 우산으로 떨어지면 화분의 새싹이 고개를 든다 + 마우스 깊이감 */
(function () {
  'use strict';
  var art = document.getElementById('heroArt'); if (!art) return;
  var cover = art.closest('.slide'), svg = art.querySelector('svg'), dg = svg.querySelector('.drops'), sg = svg.querySelector('.sparks');
  var cnt = art.querySelector('.drop-count b');
  var NS = 'http://www.w3.org/2000/svg';
  var X0 = 776, Y0 = 200, XL = 790, YL = 500;             /* 구름 아래 → 우산 속 */
  var DROP = 'M0 -30 C 6 -18, 18 -6, 18 6 A 18 18 0 0 1 -18 6 C -18 -6, -6 -18, 0 -30 Z';
  var drops = [0, 1, 2].map(function (i) {
    var g = document.createElementNS(NS, 'g');
    var p = document.createElementNS(NS, 'path'); p.setAttribute('d', DROP); p.setAttribute('class', 'drop');
    var r = document.createElementNS(NS, 'ellipse'); r.setAttribute('class', 'splash'); r.setAttribute('cx', XL); r.setAttribute('cy', YL + 18);
    g.appendChild(p); dg.appendChild(g); dg.appendChild(r);
    return { g: g, r: r, x: X0 + (i - 1) * 16 };
  });
  var sparks = [[150, 330], [380, 360], [250, 290], [420, 470]].map(function (q) {
    var s = document.createElementNS(NS, 'path');
    s.setAttribute('d', 'M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z'); s.setAttribute('class', 'spark');
    s.setAttribute('transform', 'translate(' + q[0] + ' ' + q[1] + ') scale(0)'); sg.appendChild(s); return { el: s, x: q[0], y: q[1] };
  });
  function lite() { return (window.EZ && window.EZ.lite()) || document.body.classList.contains('lite'); }
  var CYCLE = 7.4, t0 = 0, raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!t0) t0 = now + 1500;
    if (now < t0) return;
    var t = ((now - t0) / 1000) % CYCLE, landed = 0;
    drops.forEach(function (d, i) {
      var s = .4 + i * 1.05, f = (t - s) / .8;
      if (f > 0 && f < 1) {
        var e = f * f, x = d.x + (XL - d.x) * e, y = Y0 + (YL - Y0) * e;
        d.g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(' + (.7 + .3 * f).toFixed(2) + ')');
        d.g.style.opacity = 1;
      } else d.g.style.opacity = 0;
      var a = (t - s - .8) / .5;
      if (a > 0 && a < 1) { d.r.setAttribute('rx', 20 + 60 * a); d.r.setAttribute('ry', 6 + 14 * a); d.r.style.opacity = 1 - a; }
      else d.r.style.opacity = 0;
      if (t > s + .8) landed++;
    });
    if (cnt.textContent !== String(landed)) cnt.textContent = landed;
    var grown = t > 3.9 && t < 6.9;
    svg.classList.toggle('grown', grown);
    sparks.forEach(function (s, i) {
      var k = (t - 4 - i * .12) / .7, sc = k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0;
      s.el.setAttribute('transform', 'translate(' + s.x + ' ' + s.y + ') rotate(' + (k * 90).toFixed(0) + ') scale(' + sc.toFixed(2) + ')');
    });
  }
  function still() {
    cancelAnimationFrame(raf); raf = 0;
    drops.forEach(function (d) { d.g.style.opacity = 0; d.r.style.opacity = 0; });
    cnt.textContent = 3; svg.classList.add('grown');
  }
  function run(on) {
    cancelAnimationFrame(raf); raf = 0; t0 = 0; svg.classList.remove('grown'); cnt.textContent = 0;
    if (!on) return;
    if (lite()) { still(); return; }
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener('slide:enter', function (e) { run(e.detail.slide === cover); });
  run(cover.classList.contains('active') || document.body.dataset.mode !== 'present');

  /* 마우스를 따라 그림이 깊이별로 조금씩 움직인다 */
  var parts = Array.prototype.slice.call(svg.querySelectorAll('[data-d]'));
  var mx = 0, my = 0, cx = 0, cy = 0, pr = 0;
  cover.addEventListener('pointermove', function (e) {
    var r = cover.getBoundingClientRect();
    mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5;
    if (!pr) pr = requestAnimationFrame(par);
  });
  cover.addEventListener('pointerleave', function () { mx = my = 0; if (!pr) pr = requestAnimationFrame(par); });
  function par() {
    pr = 0;
    cx += (mx - cx) * .12; cy += (my - cy) * .12;
    parts.forEach(function (g) { var d = +g.dataset.d * 22; g.style.transform = 'translate(' + (cx * d).toFixed(1) + 'px,' + (cy * d).toFixed(1) + 'px)'; });
    var tx = cover.querySelector('.cover-text'); if (tx) tx.style.transform = 'translate(' + (-cx * 14).toFixed(1) + 'px,' + (-cy * 10).toFixed(1) + 'px)';
    if (Math.abs(mx - cx) > .001 || Math.abs(my - cy) > .001) pr = requestAnimationFrame(par);
  }
})();
