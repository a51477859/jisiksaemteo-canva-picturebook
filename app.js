(function () {
  'use strict';
  var G = window.gsap;
  var body = document.body;
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var stage = document.getElementById('stage');
  var barFill = document.getElementById('barFill');
  var countEl = document.getElementById('count');
  var modeBtn = document.getElementById('modeBtn');
  var fxBtn = document.getElementById('fxBtn');
  var idx = 0, mode = 'read', io = null, busy = false, slamTl = null;
  var lite = false;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- 효과 켬/끔 ---------- */
  var QS = new URLSearchParams(location.search), ALLSTEPS = QS.get('steps') === 'all';
  lite = QS.get('fx') === '0' || store('ez-lite') === '1' || !G || (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches);
  function paintFx() { fxBtn.textContent = lite ? '효과 끔' : '효과 켬'; fxBtn.classList.toggle('off', lite); body.classList.toggle('lite', lite); }
  function toggleLite() { lite = !lite; store('ez-lite', lite ? '1' : '0'); paintFx(); }
  fxBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleLite(); });
  paintFx();
  window.EZ = { lite: function () { return lite; } };

  /* ---------- 읽기 모드(참가자)와 발표 모드(강사) ----------
     참가자: 장면을 한 장씩 넘겨 보고, 강사 따라가기를 켜면 강사 장면을 따라간다. 좁은 화면만 위아래로 읽는다.
     강사: PIN을 서버에서 확인한 뒤 열린다. 노트·도구가 보이고, 지금 장면을 서버에 올린다. */
  /* 공개 주소에서만 실제 방을 써요. 미리보기 주소에서 시험한 장면이 참가자를 끌고 가지 않게 */
  var DECK_ROOM = location.hostname === 'jisiksaemteo-canva-picturebook.pages.dev' ? 'canva-deck' : 'canva-test';
  function pinGet() { try { return localStorage.getItem('ez-pin') || sessionStorage.getItem('ez-pin') || ''; } catch (e) { return ''; } }
  function pinSet(p) { try { localStorage.setItem('ez-pin', p); sessionStorage.setItem('ez-pin', p); } catch (e) {} }
  var unlocked = store('ez-unlock') === '1' && !!pinGet();
  function paintLock() { body.classList.toggle('locked', !unlocked); paintFollow(); }
  function lockNow() {
    unlocked = false; store('ez-unlock', '0'); pinSet('');
    if (!ntPanel.hidden) toggleNotes();
    paintLock(); setMode(autoMode()); connect();
  }
  var pinBox = document.createElement('div');
  pinBox.className = 'pinbox'; pinBox.hidden = true;
  pinBox.innerHTML = '<form class="pin-in"><p class="pin-h">발표자 모드</p><p class="pin-d">PIN 4자리를 넣어 주세요</p>' +
    '<input type="password" inputmode="numeric" maxlength="4" autocomplete="off" aria-label="PIN"><p class="pin-e" aria-live="polite"></p>' +
    '<div class="pin-b"><button type="button" data-a="x">취소</button><button type="submit">열기</button></div></form>';
  body.appendChild(pinBox);
  var pinIn = $('input', pinBox), pinErr = $('.pin-e', pinBox);
  function pinOpen() { pinBox.hidden = false; pinIn.value = ''; pinErr.textContent = ''; setTimeout(function () { pinIn.focus(); }, 30); }
  function pinClose() { pinBox.hidden = true; }
  function api(path, data) {
    return fetch('/api' + path, data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : { cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); });
  }
  var pinBusy = false;
  function pinTry() {
    var p = pinIn.value; if (pinBusy || p.length !== 4) return;
    pinBusy = true; pinErr.textContent = '확인하는 중…';
    api('/admin', { pin: p, action: 'check' }).then(function () {
      unlocked = true; store('ez-unlock', '1'); pinSet(p); pinClose(); paintLock(); setMode('present');
    }, function (err) {
      pinErr.textContent = err && err.error === 'pin' ? 'PIN이 맞지 않아요' : '연결을 확인해 주세요';
      pinIn.value = ''; pinIn.focus();
    }).then(function () { pinBusy = false; });
  }
  $('form', pinBox).addEventListener('submit', function (e) { e.preventDefault(); pinTry(); });
  pinIn.addEventListener('input', function () { if (pinIn.value.length === 4) pinTry(); });
  pinBox.addEventListener('click', function (e) { e.stopPropagation(); if (e.target === pinBox || e.target.dataset.a === 'x') pinClose(); });
  pinBox.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') pinClose(); });

  /* ---------- 모드 ---------- */
  /* 장면 화면(data-mode=present)이 기본. 참가자의 좁은 세로 화면만 위아래 읽기(data-mode=read) */
  function wide() { return window.innerWidth >= 900 && window.innerWidth / window.innerHeight >= 1.1; }
  function autoMode() {
    if (unlocked) return 'present';
    var q = new URLSearchParams(location.search).get('mode');
    if (q === 'read' || q === 'present') return q;
    return wide() ? 'present' : 'read';
  }
  function setMode(m) {
    mode = m;
    body.dataset.mode = m;
    modeBtn.textContent = unlocked ? '읽기 모드로' : '발표 모드';
    modeBtn.title = unlocked ? '강사 도구를 잠그고 참가자 화면으로' : '강사용 · PIN 필요';
    if (io) { io.disconnect(); io = null; }
    slides.forEach(function (s) { s.classList.remove('active', 'in'); });
    $$('.step').forEach(function (e) { e.classList.remove('on'); });
    if (m === 'present') {
      window.scrollTo(0, 0);
      fit();
      go(hashIdx(), false, true);
    } else {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); enter(e.target, true); } });
        var vis = es.filter(function (e) { return e.isIntersecting; }).sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; })[0];
        if (vis) markSec(vis.target.dataset.sec);
      }, { threshold: [0.15, 0.5] });
      slides.forEach(function (s) { io.observe(s); });
      slides[0].classList.add('in');
      var n = hashIdx();
      if (n > 0) setTimeout(function () { window.scrollTo(0, slides[n].getBoundingClientRect().top + window.scrollY - 50); }, 60);
    }
  }
  function hashIdx() {
    var n = parseInt((location.hash || '').replace('#s', ''), 10);
    return n > 0 && n <= slides.length ? n - 1 : 0;
  }
  function markSec(sec) {
    $$('.chapters a').forEach(function (a) { a.classList.toggle('cur', a.dataset.sec === sec); });
    $$('.progress button').forEach(function (a) { a.classList.toggle('cur', a.dataset.sec === sec); });
  }
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.documentElement.style.setProperty('--s', s);
  }

  /* ---------- 발표 이동 ---------- */
  function stepsOf(i) { return slides[i].querySelectorAll('.step'); }
  function go(i, back, instant) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    var tgt = slides[i];
    if (!instant && !back && !lite && i === idx + 1 && tgt.dataset.slam) {
      busy = true;
      slam(tgt.dataset.slam, function () { show(i, back); }, function () { busy = false; });
      return;
    }
    show(i, back);
  }
  function show(i, back) {
    if (i !== idx) userMoved();
    idx = i;
    slides.forEach(function (s, k) { s.classList.toggle('active', k === i); });
    $$('.step', slides[i]).forEach(function (e) { e.classList.toggle('on', !!back || ALLSTEPS); });
    markSec(slides[i].dataset.sec);
    paintBar(i);
    if (document.activeElement !== pageIn) pageIn.value = i + 1;
    history.replaceState(null, '', '#s' + (i + 1));
    enter(slides[i], !!back);
    broadcast();
    /* 액자 속 영상: 이 장면에 들어오면 처음부터, 나가면 멈춤 */
    $$('video.vid').forEach(function (v) {
      if (v.closest('.slide') === slides[i]) { v.currentTime = 0; v.play().catch(function () {}); } else v.pause();
    });
  }
  function next() {
    if (busy) { if (slamTl) slamTl.progress(1); return; }
    if (tourStep(1)) return;
    var st = stepsOf(idx);
    for (var k = 0; k < st.length; k++) if (!st[k].classList.contains('on')) {
      st[k].classList.add('on');
      document.dispatchEvent(new CustomEvent('step:on', { detail: { el: st[k] } }));
      onStep(st[k]); userMoved(); broadcast();
      return;
    }
    if (idx < slides.length - 1) go(idx + 1, false);
  }
  function prev() {
    if (busy) { if (slamTl) slamTl.progress(1); return; }
    if (tourStep(-1)) return;
    var st = stepsOf(idx);
    for (var k = st.length - 1; k >= 0; k--) if (st[k].classList.contains('on')) {
      st[k].classList.remove('on');
      document.dispatchEvent(new CustomEvent('step:off', { detail: { el: st[k] } }));
      userMoved(); broadcast();
      return;
    }
    if (idx > 0) go(idx - 1, true);
  }
  function goSec(sec) {
    for (var k = 0; k < slides.length; k++) if (slides[k].dataset.sec === sec) {
      if (mode === 'present') go(k, false, true); else slides[k].scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  }

  /* ---------- 섹션 전환 ---------- */
  var slamEl = document.getElementById('slam');
  function slam(word, onCover, done) {
    var sw = $('.sw', slamEl), sb = $('.sb', slamEl);
    sw.textContent = '';
    Array.prototype.forEach.call(word, function (ch) { var s = document.createElement('span'); s.className = 'wc'; s.textContent = ch; sw.appendChild(s); });
    slamEl.style.display = 'block';
    if (window.SFX) window.SFX.play('whoosh');
    G.set(slamEl, { yPercent: 0, opacity: 0 });
    var covered = false;
    function cover() { if (!covered) { covered = true; onCover(); } }
    slamTl = G.timeline({ onComplete: function () { cover(); slamEl.style.display = 'none'; slamTl = null; done(); } });
    slamTl.to(slamEl, { opacity: 1, duration: .12 }, 0)
      .fromTo($$('.wc', sw), { y: 220, scale: .5, opacity: 0, rotation: function () { return G.utils.random(-14, 14); } }, { y: 0, scale: 1, opacity: 1, rotation: 0, duration: .45, ease: 'back.out(2.2)', stagger: .05 }, .04)
      .fromTo(sb, { scaleX: 0 }, { scaleX: 1, duration: .32, ease: 'power3.out' }, .3)
      .call(cover, null, .62)
      .to(slamEl, { yPercent: -100, duration: .42, ease: 'power3.inOut' }, .8);
  }

  /* ---------- 제목 글자 쪼개기 ---------- */
  (function split() {
    var c = 0;
    $$('.split-t').forEach(function (el) {
      var t = el.textContent; el.textContent = ''; el.setAttribute('aria-label', t);
      t.split(' ').forEach(function (word, wi) {
        if (wi) el.appendChild(document.createTextNode(' '));
        var w = document.createElement('span');
        w.className = 'wd'; w.setAttribute('aria-hidden', 'true');
        Array.prototype.forEach.call(word, function (ch) {
          var s = document.createElement('span');
          s.className = 'ch'; s.style.setProperty('--c', c++);
          s.textContent = ch;
          w.appendChild(s);
        });
        el.appendChild(w); c++;
      });
      c += 2;
    });
  })();

  /* ---------- 제목 밑줄: 연필이 그린다 ---------- */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var PENCIL = '<g transform="rotate(-38)"><polygon points="0,0 28,-9 28,9" fill="#F1D3A8"/><polygon points="0,0 9,-3 9,3" fill="#16141A"/><rect x="28" y="-9" width="70" height="18" fill="#FFC53A"/><rect x="92" y="-9" width="14" height="18" fill="#FF5B3A"/></g>';
  function ulInit(sl) {
    $$('.ul,.cul', sl).forEach(function (svg) {
      var path = $('path', svg); if (!path || path.__pc) return;
      path.__pc = 1; path.__svg = svg; path.__L = path.getTotalLength();
      path.style.transition = 'none';
      G.set(path, { strokeDasharray: path.__L, strokeDashoffset: path.__L });
      var tip = document.createElementNS(SVGNS, 'svg');
      tip.setAttribute('class', 'ptip'); tip.setAttribute('viewBox', '-6 -76 100 86'); tip.innerHTML = PENCIL;
      svg.parentNode.appendChild(tip); path.__tip = tip;
    });
  }
  function ulPlay(sl) {
    if (!G) return;
    ulInit(sl);
    $$('.ul path,.cul path', sl).forEach(function (path) {
      var L = path.__L, tip = path.__tip, svg = path.__svg;
      if (path.__tw) path.__tw.kill();
      if (lite || mode !== 'present') { G.set(path, { strokeDashoffset: 0 }); G.set(tip, { opacity: 0 }); return; }
      var vb = svg.viewBox.baseVal, o = { p: 0 }, box = null;
      function measure() {
        var host = svg.parentNode, pr = host.getBoundingClientRect(), r = svg.getBoundingClientRect();
        var k = host.offsetWidth ? pr.width / host.offsetWidth : 1;
        box = { x: (r.left - pr.left) / k, y: (r.top - pr.top) / k, w: r.width / k, h: r.height / k };
      }
      G.set(path, { strokeDashoffset: L });
      path.__tw = G.to(o, {
        p: 1, duration: .8, delay: sl.classList.contains('s-cover') ? 1.2 : .45, ease: 'power2.inOut',
        onStart: function () { measure(); G.set(tip, { opacity: 1, x: 0, y: 0, rotation: 14, transformOrigin: '6% 88%' }); },
        onUpdate: function () {
          if (!box) measure();
          var pt = path.getPointAtLength(o.p * L);
          G.set(path, { strokeDashoffset: L * (1 - o.p) });
          tip.style.left = (box.x + pt.x * box.w / vb.width) + 'px';
          tip.style.top = (box.y + pt.y * box.h / vb.height) + 'px';
        },
        onComplete: function () { G.to(tip, { x: 34, y: -26, opacity: 0, duration: .3, ease: 'power2.in' }); }
      });
    });
  }

  /* ---------- 표지: 네오픽셀 링 ---------- */
  var ringG = document.getElementById('ringLeds'), leds = [];
  for (var k = 0; ringG && k < 12; k++) {
    var a = (k / 12) * Math.PI * 2 - Math.PI / 2;
    var c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', (320 + Math.cos(a) * 180).toFixed(1));
    c.setAttribute('cy', (300 + Math.sin(a) * 180).toFixed(1));
    c.setAttribute('r', 22); c.setAttribute('class', 'led-dot');
    ringG.appendChild(c); leds.push(c);
  }
  var ringT = null, ringK = 0;
  function ringRun(on) {
    clearInterval(ringT); ringT = null;
    if (!on) return;
    if (lite) { leds.forEach(function (l, i) { l.classList.toggle('on', i % 3 === 0); }); return; }
    ringT = setInterval(function () {
      leds.forEach(function (l, i) { var d = (ringK - i + 12) % 12; l.classList.toggle('on', d < 3); });
      ringK = (ringK + 1) % 12;
    }, 140);
  }

  /* ---------- 07 순서: 실행 흉내 ---------- */
  var simTimers = [];
  function simClear() {
    simTimers.forEach(clearTimeout); simTimers = [];
    $$('.s-seq .led').forEach(function (l) { l.classList.remove('on'); });
    $$('.s-seq .blocks li').forEach(function (b) { b.classList.remove('run'); });
  }
  function simRun() {
    simClear();
    [['a', [['on', 0, 0], ['', 1, 1200], ['off', 2, 1200]]], ['b', [['on', 0, 0], ['off', 1, 80], ['', 2, 1200]]]].forEach(function (p, pi) {
      var box = $('.s-seq [data-prog="' + p[0] + '"]'), led = $('.led', box), bl = $$('.blocks li', box);
      var t = 300 + pi * 2600;
      p[1].forEach(function (s) {
        t += s[2];
        simTimers.push(setTimeout(function () {
          bl.forEach(function (b, j) { b.classList.toggle('run', j === s[1]); });
          if (s[0] === 'on') { led.classList.add('on'); if (window.SFX) window.SFX.play('light'); }
          if (s[0] === 'off') led.classList.remove('on');
        }, t));
      });
      simTimers.push(setTimeout(function () { bl.forEach(function (b) { b.classList.remove('run'); }); }, t + 900));
    });
  }

  /* ---------- 09 조건: 신호 바꾸기 ---------- */
  var sigBtn = document.getElementById('sigBtn'), sigOut = document.getElementById('sigOut'), ifBox = document.getElementById('ifBox');
  if (sigBtn) sigBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var s = sigBtn.dataset.s === 'blue' ? 'red' : 'blue';
    sigBtn.dataset.s = ifBox.dataset.s = s;
    if (window.SFX) window.SFX.play('light');
    sigOut.innerHTML = s === 'blue' ? '파란불 → <b>건너요</b>' : '빨간불 → <b>멈춰요</b>';
  });

  /* ---------- 10 게임 그림 ---------- */
  (function tiles() {
    var g = $('.s-game .tiles'), h = ''; if (!g) return;
    for (var r = 0; r < 5; r++) for (var q = 0; q < 6; q++) h += '<rect x="' + (10 + q * 113) + '" y="' + (20 + r * 108) + '" width="104" height="100" rx="14"/>';
    g.innerHTML = h;
  })();
  var foxTl = null;
  function foxRun(on) {
    if (foxTl) { foxTl.kill(); foxTl = null; }
    var fox = $('.s-game .fox'), tl = $('.s-game .tl'), img = $('.s-game .fox-img');
    if (!fox) return;
    var pose = function (p) { img.setAttribute('href', 'assets/game/fox_' + p + '.png'); };
    if (!G) return;
    G.set(fox, { x: 90, y: 470 }); tl.classList.remove('red'); pose('idle');
    if (!on || lite) return;
    foxTl = G.timeline({ repeat: -1, repeatDelay: .8, delay: .8 })
      .to(fox, { x: 270, duration: .9, ease: 'power1.inOut' })
      .to(fox, { y: 290, duration: .9, ease: 'power1.inOut' })
      .call(function () { tl.classList.add('red'); })
      .to(fox, { x: 330, duration: .5, ease: 'power1.out' })
      .call(function () { pose('stop'); })
      .to({}, { duration: 1 })
      .call(function () { tl.classList.remove('red'); pose('idle'); })
      .to(fox, { x: 450, duration: .7, ease: 'power1.inOut' })
      .to(fox, { y: 110, duration: .9, ease: 'power1.inOut' })
      .to(fox, { x: 560, duration: .7, ease: 'power1.inOut' })
      .call(function () { pose('happy'); })
      .to({}, { duration: 1.2 })
      .call(function () { tl.classList.remove('red'); pose('idle'); })
      .set(fox, { x: 90, y: 470 });
  }

  /* ---------- 사진·영상 칸: 파일이 있으면 보여 준다 ---------- */
  $$('.slot').forEach(function (slot) {
    if (slot.dataset.img) {
      var im = new Image();
      im.onload = function () { im.alt = ''; slot.insertBefore(im, slot.firstChild); slot.classList.add('has'); };
      im.src = slot.dataset.img;
    }
    if (slot.dataset.video) {
      var v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.controls = true; v.preload = 'metadata';
      v.addEventListener('loadeddata', function () { slot.insertBefore(v, slot.firstChild); slot.classList.add('has'); });
      v.src = slot.dataset.video;
    }
  });

  /* ---------- 센서 + 조건: 밝기 막대 ---------- */
  var lux = document.getElementById('lux');
  if (lux) {
    var luxV = document.getElementById('luxV'), luxLed = document.getElementById('luxLed'), luxOut = document.getElementById('luxOut');
    var paintLux = function () {
      var v = +lux.value, dark = v < 40;
      luxV.textContent = v;
      luxLed.classList.toggle('on', dark);
      luxOut.textContent = dark ? '기준 40보다 어두워요 → 켜기' : '기준 40보다 밝아요 → 끄기';
    };
    lux.addEventListener('input', paintLux);
    paintLux();
  }

  /* ---------- 발표 노트 (N) · 발표자 창 (P) ---------- */
  var ntPanel = document.getElementById('ntPanel'), ntBody = document.getElementById('ntBody'), ntNo = document.getElementById('ntNo');
  var ntBtn = document.getElementById('ntBtn'), presenter = null;
  function noteHtml(i) { var n = $('.nt', slides[i]); return n ? n.innerHTML : '<p>노트 없음</p>'; }
  function titleOf(i) { var t = $('.title,.ctitle', slides[i]); return t ? t.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function paintNotes() {
    ntNo.textContent = pad(idx + 1) + ' / ' + slides.length;
    ntBody.innerHTML = noteHtml(idx);
    if (presenter && !presenter.closed) {
      var d = presenter.document;
      d.getElementById('no').textContent = pad(idx + 1) + ' / ' + slides.length + ' · ' + slides[idx].dataset.sec;
      d.getElementById('cur').textContent = titleOf(idx);
      d.getElementById('body').innerHTML = noteHtml(idx);
      d.getElementById('nx').textContent = idx < slides.length - 1 ? '다음: ' + titleOf(idx + 1) : '마지막 장면';
    }
  }
  function toggleNotes() { ntPanel.hidden = !ntPanel.hidden; ntBtn.classList.toggle('off', ntPanel.hidden); paintNotes(); }
  function openPresenter() {
    if (presenter && !presenter.closed) { presenter.focus(); return; }
    presenter = window.open('', 'ezNotes', 'width=760,height=640');
    if (!presenter) { if (ntPanel.hidden) toggleNotes(); return; } /* 팝업이 막히면 화면 노트로 대신 */
    presenter.document.write('<!doctype html><meta charset="utf-8"><title>발표자 노트</title><style>body{margin:0;padding:24px 28px;background:#16141A;color:#F3ECE0;font:700 20px/1.6 "Pretendard","Malgun Gothic",sans-serif;word-break:keep-all}#no{color:#FF5B3A;font-weight:900;letter-spacing:.08em}#cur{font-size:30px;font-weight:900;line-height:1.3;margin:6px 0 14px}#body b{color:#FFC53A}#body p{margin:10px 0}#nx{margin-top:22px;padding-top:14px;border-top:1px solid #3a363f;color:#b4ab99}small{color:#b4ab99}</style><p id="no"></p><p id="cur"></p><div id="body"></div><p id="nx"></p><p><small>이 창에서 ← → 키로도 넘길 수 있어요.</small></p>');
    presenter.document.close();
    presenter.document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    });
    paintNotes();
  }
  ntBtn.addEventListener('click', function (e) { e.stopPropagation(); if (mode === 'present') toggleNotes(); });
  ntBtn.classList.add('off');

  /* ---------- 페이지 이동: 막대 끌기 · 번호 칸 · 목록 ---------- */
  var bar = document.getElementById('bar'), thumb = document.getElementById('thumb'), tip = document.getElementById('tip');
  var pageIn = document.getElementById('pageIn'), toc = document.getElementById('toc');
  document.getElementById('pageTot').textContent = slides.length;
  function frac(i) { return slides.length > 1 ? i / (slides.length - 1) : 0; }
  function paintBar(i) {
    var p = frac(i) * 100;
    barFill.style.width = p + '%';
    thumb.style.left = p + '%';
  }
  function idxAt(clientX) {
    var r = bar.getBoundingClientRect();
    var f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return Math.round(f * (slides.length - 1));
  }
  function showTip(i) {
    tip.innerHTML = '<b>' + pad(i + 1) + '</b>' + titleOf(i).replace(/</g, '&lt;');
    tip.style.left = (frac(i) * 100) + '%';
  }
  var dragI = -1;
  bar.addEventListener('pointerdown', function (e) {
    e.stopPropagation(); e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    bar.classList.add('drag');
    dragI = idxAt(e.clientX); paintBar(dragI); showTip(dragI);
  });
  bar.addEventListener('pointermove', function (e) {
    var i = idxAt(e.clientX);
    if (dragI >= 0) { dragI = i; paintBar(i); showTip(i); pageIn.value = i + 1; }
    else { bar.classList.add('peek'); showTip(i); }
  });
  bar.addEventListener('pointerleave', function () { bar.classList.remove('peek'); });
  function endDrag(e) {
    if (dragI < 0) return;
    var i = dragI; dragI = -1;
    bar.classList.remove('drag', 'peek');
    if (i !== idx) go(i, false, true); else paintBar(idx);
  }
  bar.addEventListener('pointerup', endDrag);
  bar.addEventListener('pointercancel', endDrag);
  bar.addEventListener('click', function (e) { e.stopPropagation(); });

  function jumpTo(n) {
    n = parseInt(n, 10);
    if (n >= 1 && n <= slides.length) go(n - 1, false, true);
    pageIn.value = idx + 1;
  }
  pageIn.addEventListener('focus', function () { pageIn.select(); });
  pageIn.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Enter') { jumpTo(pageIn.value); pageIn.blur(); }
    if (e.key === 'Escape') { pageIn.value = idx + 1; pageIn.blur(); }
  });
  pageIn.addEventListener('change', function () { jumpTo(pageIn.value); });
  document.getElementById('pPrev').addEventListener('click', function (e) { e.stopPropagation(); go(idx - 1, true, true); });
  document.getElementById('pNext').addEventListener('click', function (e) { e.stopPropagation(); go(idx + 1, false, true); });

  (function buildToc() {
    var cols = document.getElementById('tocCols'), secs = {}, order = [];
    slides.forEach(function (s, i) {
      var k = s.dataset.sec;
      if (!secs[k]) { secs[k] = document.createElement('div'); secs[k].className = 'toc-sec'; secs[k].innerHTML = '<b>' + k + '</b>'; order.push(k); }
      var b = document.createElement('button'); b.type = 'button'; b.dataset.i = i;
      b.innerHTML = '<i>' + pad(i + 1) + '</i><span></span>';
      b.lastChild.textContent = titleOf(i);
      b.addEventListener('click', function () { closeToc(); go(i, false, true); });
      secs[k].appendChild(b);
    });
    order.forEach(function (k) { cols.appendChild(secs[k]); });
  })();
  function openToc() {
    $$('.toc-sec button').forEach(function (b) { b.classList.toggle('cur', +b.dataset.i === idx); });
    toc.hidden = false;
  }
  function closeToc() { toc.hidden = true; }
  document.getElementById('pList').addEventListener('click', function (e) { e.stopPropagation(); openToc(); });
  toc.addEventListener('click', function (e) { if (e.target === toc) closeToc(); });
  /* 강사용: 모든 퀴즈 투표와 실습 완료 인원을 한 번에 0으로 */
  (function () {
    var box = toc.firstElementChild || toc, b = document.createElement('button');
    b.type = 'button'; b.className = 'toc-reset'; b.textContent = '모든 투표·실습 완료 초기화';
    box.appendChild(b);
    function paint() { b.hidden = !unlocked; }
    paint(); toc.addEventListener('click', paint, true); new MutationObserver(paint).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!confirm('이 PT의 모든 퀴즈 투표와 실습 완료 인원을 0으로 돌릴까요?')) return;
      api('/admin', { pin: pinGet(), action: 'reset-all', deck: DECK_ROOM.split('-')[0] }).then(function () { toast('모두 초기화했어요'); setTimeout(function () { location.reload(); }, 800); }).catch(function () { toast('PIN을 다시 넣어 주세요'); });
    });
  })();

  /* ---------- 장면 들어올 때 ---------- */
  function is(sl, c) { return sl.classList.contains(c); }
  function enter(sl, back) {
    document.dispatchEvent(new CustomEvent('slide:enter', { detail: { slide: sl, back: !!back, present: mode === 'present' } }));
    if (mode === 'present' || !sl.__ul) { sl.__ul = 1; ulPlay(sl); }
    if (mode === 'present') {
      ringRun(is(sl, 's-cover'));
      foxRun(is(sl, 's-game'));
      if (!is(sl, 's-seq')) simClear();
      $$('.slot video').forEach(function (v) { if (v.closest('.slide') === sl) v.play().catch(function () {}); else v.pause(); });
      paintNotes();
    } else {
      if (is(sl, 's-cover')) ringRun(true);
      if (is(sl, 's-game') && !foxTl) foxRun(true);
    }
  }
  function onStep(el) {
    if (el.dataset.run) simRun();
  }
  $$('.s-seq .prog').forEach(function (p) { p.addEventListener('click', function (e) { e.stopPropagation(); simRun(); }); });

  /* ---------- 따라 하기 둘러보기(.tour): 단계가 4.5초마다 차례로 켜지고, 누르면 그 단계로 ---------- */
  var TOUR_MS = 4500;
  $$('.tour').forEach(function (tour) {
    var tabs = $$('.tt', tour), shots = $$('.tw-shot', tour), sl = tour.closest('.slide'), k = -1, timer = null;
    function set(i) {
      k = (i + tabs.length) % tabs.length;
      var t = tabs[k], p = t.dataset.p;
      tabs.forEach(function (x, j) { x.classList.toggle('cur', j === k); x.classList.toggle('past', j < k); });
      shots.forEach(function (s) {
        var on = s.dataset.p === p; s.classList.toggle('on', on);
        if (!on) return;
        var bx = $('.tw-box', s), b = (t.dataset.box || '').split(',').map(Number);
        if (b.length === 4) {
          bx.style.left = b[0] + '%'; bx.style.top = b[1] + '%'; bx.style.width = b[2] + '%'; bx.style.height = b[3] + '%'; bx.classList.add('on');
        } else bx.classList.remove('on');
        frame(s, b.length === 4 && !tour.classList.contains('crop') ? b : null);
      });
    }
    /* 발표 화면: 누를 곳 둘레를 창에 꽉 차게 보여 준다. 캡처 화소의 1.4배까지만 키워서 흐려지지 않게 */
    var view = $('.tw-view', tour);
    function frame(s, b) {
      var img = $('img', s), iw = img.naturalWidth, ih = img.naturalHeight;
      if (mode !== 'present' || !iw) { s.removeAttribute('style'); view.classList.remove('fr'); return; }
      var VW = view.clientWidth, VH = view.clientHeight, k0 = Math.min(VW / iw, VH / ih), kk = k0;
      if (b) {
        var bw = b[2] / 100 * iw, bh = b[3] / 100 * ih;
        kk = Math.min(document.body.classList.contains("v3") ? 2.4 : 1.4, VW / (bw * 1.25), VH / (bh * 1.6));
        if (iw > ih * 1.2) kk = Math.min(kk, VW / (iw * 0.6));
        kk = Math.max(k0, kk);
      }
      var W = iw * kk, H = ih * kk, cx = b ? (b[0] + b[2] / 2) / 100 * W : W / 2, cy = b ? (b[1] + b[3] / 2) / 100 * H : H / 2;
      var L = W <= VW ? (VW - W) / 2 : Math.max(VW - W, Math.min(0, VW / 2 - cx));
      var T = H <= VH ? (VH - H) / 2 : Math.max(VH - H, Math.min(0, VH / 2 - cy));
      view.classList.add('fr');
      s.style.cssText = 'width:' + W + 'px;height:' + H + 'px;left:' + L + 'px;top:' + T + 'px';
    }
    $$('img', tour).forEach(function (im) { if (!im.complete) im.addEventListener('load', function () { if (k >= 0) set(k); }); });
    window.addEventListener('resize', function () { if (k >= 0) set(k); });
    function stop() { clearTimeout(timer); timer = null; tour.classList.remove('auto'); }
    function play() {
      stop(); if (lite) return;
      tour.classList.add('auto');
      (function tick() {
        timer = setTimeout(function () {
          if (!sl.classList.contains('active') && mode === 'present') return stop();
          /* 마지막 단계에서 조금 더 쉬었다가 처음부터 */
          set(k + 1); restartBar(); tick();
        }, (k === tabs.length - 1 ? 2500 : 0) + (tour.classList.contains('mock') ? 7500 : TOUR_MS));
      })();
    }
    function restartBar() { var u = $('u', tabs[k]); if (u) { u.style.animation = 'none'; void u.offsetWidth; u.style.animation = ''; } }
    tabs.forEach(function (t, j) {
      function pick(e) { e.stopPropagation(); stop(); set(j); }
      t.addEventListener('click', pick);
      t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });
    });
    tour.__step = function (d) { if (d > 0 ? k >= tabs.length - 1 : k <= 0) return false; stop(); set(k + d); return true; };
    document.addEventListener('slide:enter', function (e) {
      if (e.detail.slide !== sl) { if (mode === 'present') stop(); return; }
      set(0); if (mode === 'present') play();
    });
    set(0);
  });
  function tourStep(d) { var t = $('.tour', slides[idx]); return !!(t && t.__step && t.__step(d)); }

  /* ---------- 강사 따라가기 ---------- */
  function toast(m) { if (window.KIT && KIT.toast) KIT.toast(m); }
  function who() {
    var v = store('ez-voter');
    if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); store('ez-voter', v); }
    return v;
  }
  var following = store('ez-follow') !== '0', remote = null, applying = false, booted = false, es = null;
  var folBtn = document.createElement('button');
  folBtn.type = 'button'; folBtn.className = 'modebtn folbtn'; folBtn.innerHTML = '<i></i><span>강사 따라가기</span>';
  modeBtn.parentNode.insertBefore(folBtn, modeBtn);
  /* 전체 화면 단추: F 키가 있다는 걸 화면에서 알 수 있게 */
  var fsBtn = document.createElement('button');
  fsBtn.type = 'button'; fsBtn.className = 'modebtn fsbtn';
  function paintFs() { fsBtn.textContent = document.fullscreenElement ? '전체 화면 끝내기 (F)' : '전체 화면 (F)'; }
  paintFs(); document.addEventListener('fullscreenchange', paintFs);
  fsBtn.addEventListener('click', function (e) { e.stopPropagation(); if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); fsBtn.blur(); });
  if (document.documentElement.requestFullscreen) folBtn.parentNode.insertBefore(fsBtn, folBtn);
  function paintFollow() {
    folBtn.hidden = unlocked;
    folBtn.classList.toggle('on', following);
    folBtn.classList.toggle('nolive', !!remote && !!remote.off);
    folBtn.title = following ? (remote && !remote.off ? '강사 장면을 따라가는 중 · 누르면 각자 넘겨요' : '강사 발표가 시작되면 따라가요') : '누르면 강사 장면으로 가요';
  }
  function setSteps(sl, n) {
    var st = $$('.step', sl);
    st.forEach(function (e, k) {
      var on = k < n;
      if (on === e.classList.contains('on')) return;
      e.classList.toggle('on', on);
      document.dispatchEvent(new CustomEvent(on ? 'step:on' : 'step:off', { detail: { el: e } }));
    });
  }
  function applyRemote() {
    if (!following || unlocked || !remote || remote.off) return;
    var i = Math.max(0, Math.min(slides.length - 1, remote.idx));
    applying = true;
    if (mode === 'present') { if (i !== idx) go(i, false, true); setSteps(slides[i], remote.step || 0); }
    else if (i !== idx) { idx = i; window.scrollTo({ top: slides[i].getBoundingClientRect().top + window.scrollY - 50, behavior: 'smooth' }); }
    applying = false;
  }
  /* 강사의 펜 자국: 따라가는 중이고 같은 장을 볼 때만 보여요 (읽기 모드는 장 모양이 달라 빼요) */
  var inkRemote = null;
  function paintInk() {
    if (!window.KIT || !KIT.inkShow) return;
    var show = following && !unlocked && mode === 'present' && remote && !remote.off && inkRemote && inkRemote.slide === idx;
    KIT.inkShow(show ? inkRemote.s : null);
  }
  document.addEventListener('slide:enter', function () { paintInk(); });
  function setFollow(on, why) {
    following = on; store('ez-follow', on ? '1' : '0'); paintFollow(); paintInk();
    if (on) { applyRemote(); toast(remote && !remote.off ? '강사 장면을 따라가요' : '강사 발표가 시작되면 따라가요'); }
    else if (why) toast(why);
  }
  folBtn.addEventListener('click', function (e) { e.stopPropagation(); setFollow(!following, '따라가기를 껐어요 · 각자 넘겨 보세요'); });
  /* 참가자가 직접 넘기면 따라가기를 끈다 */
  function userMoved() { if (booted && following && !unlocked && !applying && remote && !remote.off) setFollow(false, '직접 넘겨서 따라가기를 껐어요 · 다시 누르면 강사 장면으로'); }
  function connect() {
    if (es || !window.EventSource) return;
    es = new EventSource('/api/follow?room=' + DECK_ROOM + '&who=' + encodeURIComponent(who()));
    es.onmessage = function (e) {
      try { remote = JSON.parse(e.data); } catch (er) { return; }
      if (remote.ink) inkRemote = remote.ink;
      paintFollow(); applyRemote(); paintInk();
    };
  }
  /* 강사: 장면이나 단계가 바뀌면 0.25초 뒤에 올린다 */
  var postT = null;
  function broadcast() {
    if (!unlocked || mode !== 'present') return;
    clearTimeout(postT);
    postT = setTimeout(function () {
      api('/state', { pin: pinGet(), room: DECK_ROOM, idx: idx, step: $$('.step.on', slides[idx]).length }).catch(function (err) {
        if (err && err.error === 'pin') { toast('PIN을 다시 넣어 주세요'); lockNow(); }
      });
    }, 250);
  }

  /* 강사 펜: 그리는 동안 0.6초마다, 끝나면 바로 올려요. 처음 한 번은 지난번 자국을 비워요 */
  var inkPend = null, inkT = null, inkBusy = false, inkAgain = false, inkWasEmpty = false;
  function inkSlim(list) {
    return list.map(function (s) {
      var pts = [], last = null;
      s.pts.forEach(function (p, i) { var x = Math.round(p[0]), y = Math.round(p[1]); if (!last || i === s.pts.length - 1 || Math.abs(x - last[0]) + Math.abs(y - last[1]) >= 3) { last = [x, y]; pts.push(last); } });
      return { t: s.t, c: s.c, pts: pts };
    });
  }
  function inkFlush() {
    clearTimeout(inkT); inkT = null;
    if (inkBusy) { inkAgain = true; return; }
    if (!inkPend || !unlocked || mode !== 'present') return;
    inkBusy = true; inkWasEmpty = !inkPend.length;
    api('/ink', { pin: pinGet(), room: DECK_ROOM, slide: idx, s: inkSlim(inkPend) }).catch(function () {}).then(function () {
      inkBusy = false; if (inkAgain) { inkAgain = false; inkFlush(); }
    });
  }
  document.addEventListener('kit:ink', function (e) {
    if (!unlocked || mode !== 'present') return;
    if (!e.detail.strokes.length && inkWasEmpty) return;
    inkPend = e.detail.strokes;
    if (e.detail.now) inkFlush(); else if (!inkT) inkT = setTimeout(inkFlush, 600);
  });

  /* 강사가 발표 중이라는 표시: 1분마다 지금 장면을 다시 올려요. 강사 창이 닫히면 몇 분 뒤 따라가기가 멈춰요 */
  setInterval(function () { if (unlocked && mode === 'present') broadcast(); }, 60000);

  /* ---------- 실습 체크리스트: 참가자가 체크 → 다 되면 서버에 완료, 강사는 완료 인원을 본다 ---------- */
  $$('.g-prac .prc .checks').forEach(function (ul) {
    var sl = ul.closest('.slide'), room = 'canva-ck-' + sl.id, key = 'ez-ck-' + sl.id;
    var lis = $$('li', ul), saved = (store(key) || '').split('');
    var stamp = document.createElement('p'); stamp.className = 'ck-stamp'; stamp.innerHTML = '<b>참 잘했어요</b>';
    ul.parentNode.insertBefore(stamp, ul.nextSibling);
    var meter = document.createElement('div'); meter.className = 'ck-meter';
    meter.innerHTML = '<p><b class="ck-d">0</b><span>명 완료</span></p><small>접속 <i class="ck-v">0</i>명</small><button type="button" class="ck-reset">초기화</button>';
    var side = $('.prc-r', sl); if (side) side.insertBefore(meter, side.firstChild);
    var wasDone = null;
    function paint(send) {
      var n = 0; lis.forEach(function (li) { if (li.classList.contains('ok')) n++; });
      var done = n === lis.length;
      ul.parentNode.classList.toggle('all-ok', done);
      store(key, lis.map(function (li) { return li.classList.contains('ok') ? '1' : '0'; }).join(''));
      if (send && !unlocked && done !== wasDone) api('/check', { room: room, who: who(), done: done ? 1 : 0 }).catch(function () {});
      if (send && done && !wasDone) toast('다 했어요! 강사 화면에 완료로 보여요');
      wasDone = done;
    }
    lis.forEach(function (li, k) {
      li.tabIndex = 0; li.setAttribute('role', 'checkbox');
      if (saved[k] === '1') li.classList.add('ok');
      li.setAttribute('aria-checked', li.classList.contains('ok'));
      function flip(e) { e.stopPropagation(); li.classList.toggle('ok'); li.setAttribute('aria-checked', li.classList.contains('ok')); paint(true); }
      li.addEventListener('click', flip);
      li.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(e); } });
    });
    paint(false);
    /* 「다 했어요」 단추가 부르면 체크를 한꺼번에 켜고 끄기 */
    sl._ckAll = function () { var all = lis.every(function (li) { return li.classList.contains('ok'); }); lis.forEach(function (li) { li.classList.toggle('ok', !all); li.setAttribute('aria-checked', !all); }); paint(true); return !all; };
    sl._ckDone = function () { return lis.every(function (li) { return li.classList.contains('ok'); }); };
    function pull() {
      if (!unlocked || mode !== 'present' || !sl.classList.contains('active')) return;
      api('/check?room=' + room + '&deck=' + DECK_ROOM).then(function (j) { $('.ck-d', meter).textContent = j.done; $('.ck-v', meter).textContent = j.viewers; }).catch(function () {});
    }
    setInterval(pull, 3000);
    document.addEventListener('slide:enter', function (e) { if (e.detail.slide === sl) pull(); });
    $('.ck-reset', meter).addEventListener('click', function (e) {
      e.stopPropagation(); if (!confirm('이 실습의 완료 인원을 0으로 돌릴까요?')) return;
      api('/admin', { pin: pinGet(), action: 'reset-check', room: room }).then(function () { pull(); toast('초기화했어요'); }).catch(function () { toast('PIN을 다시 넣어 주세요'); });
    });
  });


  /* ---------- 「다 했어요」 단추: 실습 장마다 참가자가 눌러 완료를 알려요 ----------
     체크 항목이 있는 장은 체크를 한꺼번에 켜고, 없는 장(따라 하는 [실습] 장)은 바로 완료를 보내요.
     체크 항목이 없는 장은 강사 화면 왼쪽 아래에 완료 인원이 떠요. */
  (function () {
    function isPrac(sl) { return !!sl && (sl.classList.contains('g-prac') || !!sl.querySelector('.cv-tag, .prc')); }
    var db = document.createElement('button'); db.type = 'button'; db.className = 'done-fab'; db.hidden = true;
    var pm = document.createElement('div'); pm.className = 'done-meter'; pm.hidden = true;
    pm.innerHTML = '<b class="dm-d">0</b><span>명 다 했어요</span><small>접속 <i class="dm-v">0</i>명</small><button type="button" class="dm-reset">초기화</button>';
    document.body.appendChild(db); document.body.appendChild(pm);
    function cur() { return slides[idx]; }
    function room(sl) { return 'canva-ck-' + sl.id; }
    function key(sl) { return 'ez-done-' + sl.id; }
    function isDone(sl) { return sl._ckDone ? sl._ckDone() : store(key(sl)) === '1'; }
    function paintBtn() {
      var sl = cur(), on = isPrac(sl) && !unlocked;
      db.hidden = !on; if (!on) return;
      var d = isDone(sl); db.classList.toggle('on', d);
      db.innerHTML = d ? '<i>✅</i><span>다 했어요 <small>다시 누르면 취소</small></span>' : '<i>🙌</i><span><b>다 했어요</b></span>';
    }
    db.addEventListener('click', function (e) {
      e.stopPropagation(); var sl = cur(); if (!sl) return;
      if (sl._ckAll) { sl._ckAll(); paintBtn(); return; }
      var d = !isDone(sl); store(key(sl), d ? '1' : '0');
      api('/check', { room: room(sl), who: who(), done: d ? 1 : 0 }).catch(function () {});
      if (d) toast('다 했어요! 강사 화면에 완료로 보여요');
      paintBtn();
    });
    function pull() {
      var sl = cur(), on = unlocked && mode === 'present' && isPrac(sl) && !sl.querySelector('.ck-meter');
      pm.hidden = !on; if (!on) return;
      api('/check?room=' + room(sl) + '&deck=' + DECK_ROOM).then(function (j) { $('.dm-d', pm).textContent = j.done; $('.dm-v', pm).textContent = j.viewers; }).catch(function () {});
    }
    $('.dm-reset', pm).addEventListener('click', function (e) {
      e.stopPropagation(); var sl = cur(); if (!sl || !confirm('이 실습의 완료 인원을 0으로 돌릴까요?')) return;
      api('/admin', { pin: pinGet(), action: 'reset-check', room: room(sl) }).then(function () { pull(); toast('초기화했어요'); }).catch(function () { toast('PIN을 다시 넣어 주세요'); });
    });
    document.addEventListener('slide:enter', function () { paintBtn(); pull(); });
    document.addEventListener('click', function (e) { if (e.target.closest('.checks li')) setTimeout(paintBtn, 0); });
    setInterval(function () { paintBtn(); pull(); }, 3000);
    paintBtn();
  })();

  /* ---------- 실습 질문 + 캡처 붙여 넣기 ----------
     참가자: 실습 장에서 「막혔어요? 질문하기」 → 글 + 캡처(Ctrl+V 또는 사진 고르기) → 보내기
     강사: PIN을 푼 화면에서 「실습 질문」 목록을 보고 해결 표시·숨기기·모두 지우기 */
  (function () {
    var ROOM_ASK = DECK_ROOM + '-ask';
    function isPrac(sl) { return !!sl && (sl.classList.contains('g-prac') || !!sl.querySelector('.cv-tag, .prc')); }
    function cur() { return slides[idx]; }
    function slideInfo(sl) { var h = sl && $('.title', sl); return { no: sl ? sl.id.replace('s', '') : '', title: h ? h.textContent.trim().slice(0, 80) : '' }; }
    function ago(ts) { var m = Math.round((Date.now() - ts) / 60000); return m < 1 ? '방금' : m < 60 ? m + '분 전' : Math.round(m / 60) + '시간 전'; }
    function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function big(src) {
      var b = document.createElement('div'); b.className = 'ask-big'; b.innerHTML = '<img alt="보낸 캡처">'; $('img', b).src = src;
      b.addEventListener('click', function (e) { e.stopPropagation(); b.remove(); }); body.appendChild(b);
    }
    var KC = function (k) { return '<span class="kc">' + k + '</span>'; };

    /* 참가자 */
    var fab = document.createElement('button'); fab.type = 'button'; fab.className = 'ask-fab'; fab.hidden = true;
    fab.innerHTML = '<i>🙋</i><span>막혔어요? <b>질문하기</b></span>';
    var ov = document.createElement('div'); ov.className = 'ask-ov'; ov.hidden = true;
    ov.innerHTML = '<div class="ask-box" role="dialog" aria-label="실습 질문하기">' +
      '<header><b>실습 질문하기</b><span class="ask-where"></span><button type="button" class="ask-x" aria-label="닫기">✕</button></header>' +
      '<textarea maxlength="500" placeholder="어디서 막혔는지 적어 주세요. 예: Magic Write 메뉴가 안 보여요"></textarea>' +
      '<div class="ask-drop" tabindex="0"><div class="ask-empty"><b>여기를 누르고 ' + KC('Ctrl') + '+' + KC('V') + '</b><small>캡처한 화면이 여기에 붙어요</small></div><img class="ask-prev" alt="붙인 캡처" hidden><button type="button" class="ask-rm" hidden>사진 빼기</button></div>' +
      '<div class="ask-guide"><p class="ask-g-h">화면 캡처하는 방법</p><ol>' +
      '<li class="g1">' + KC('⊞ Win') + '+' + KC('Shift') + '+' + KC('S') + ' 누르기</li>' +
      '<li class="g2">막힌 곳을 마우스로 끌어 고르기</li>' +
      '<li class="g3">위 칸을 누르고 ' + KC('Ctrl') + '+' + KC('V') + '</li></ol>' +
      '<p class="ask-mac">Mac은 ' + KC('Cmd') + '+' + KC('Ctrl') + '+' + KC('Shift') + '+' + KC('4') + ' 로 고른 뒤 ' + KC('Cmd') + '+' + KC('V') + '</p>' +
      '<label class="ask-file">📷 휴대폰은 사진 고르기<input type="file" accept="image/*"></label></div>' +
      '<p class="ask-priv">캡처에 이름이나 이메일이 보이면 가리고 보내 주세요.</p>' +
      '<footer><button type="button" class="ask-send">보내기</button></footer>' +
      '<div class="ask-mine"></div></div>';
    body.appendChild(fab); body.appendChild(ov);
    var ta = $('textarea', ov), drop = $('.ask-drop', ov), prev = $('.ask-prev', ov), rm = $('.ask-rm', ov), empty = $('.ask-empty', ov), fileIn = $('input[type=file]', ov), sendB = $('.ask-send', ov), mine = $('.ask-mine', ov);
    var img = '', busySend = false;
    function setImg(d) { img = d || ''; prev.hidden = !img; rm.hidden = !img; empty.hidden = !!img; if (img) prev.src = img; drop.classList.toggle('has', !!img); }
    /* 큰 캡처는 줄여서 보내요 (가로 1400px, 600KB 안쪽) */
    function shrink(file) {
      return new Promise(function (ok, no) {
        var u = URL.createObjectURL(file), im = new Image();
        im.onload = function () {
          var w = im.naturalWidth, h = im.naturalHeight, max = 1400, q = 0.82, out = '';
          for (var t = 0; t < 5; t++) {
            var s = Math.min(1, max / w), c = document.createElement('canvas');
            c.width = Math.round(w * s); c.height = Math.round(h * s);
            var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
            out = c.toDataURL('image/jpeg', q); if (out.length <= 580000) break; max = Math.round(max * 0.8); q = Math.max(0.55, q - 0.08);
          }
          URL.revokeObjectURL(u); ok(out);
        };
        im.onerror = function () { URL.revokeObjectURL(u); no(); };
        im.src = u;
      });
    }
    function takeFile(f) { if (!f || !/^image\//.test(f.type)) return; shrink(f).then(setImg, function () { toast('사진을 읽지 못했어요'); }); }
    function onPaste(e) {
      if (ov.hidden) return;
      var items = (e.clipboardData || {}).items || [];
      for (var i = 0; i < items.length; i++) if (items[i].kind === 'file' && /^image\//.test(items[i].type)) { e.preventDefault(); takeFile(items[i].getAsFile()); return; }
      if (e.target !== ta) toast('클립보드에 캡처가 없어요. 먼저 Win+Shift+S로 캡처해 주세요');
    }
    document.addEventListener('paste', onPaste);
    drop.addEventListener('click', function () { drop.focus(); });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); takeFile(e.dataTransfer.files[0]); });
    fileIn.addEventListener('change', function () { takeFile(fileIn.files[0]); fileIn.value = ''; });
    rm.addEventListener('click', function (e) { e.stopPropagation(); setImg(''); });
    prev.addEventListener('click', function (e) { e.stopPropagation(); big(img); });
    function paintMine() {
      api('/ask?room=' + ROOM_ASK + '&who=' + encodeURIComponent(who())).then(function (j) {
        mine.innerHTML = j.items.length ? '<p class="ask-m-h">내가 보낸 질문</p>' + j.items.map(function (x) {
          return '<p class="ask-m' + (x.done ? ' ok' : '') + '"><span>' + (x.done ? '✓ 강사님이 확인했어요' : '보냈어요 · 확인 기다리는 중') + '</span>' + esc(x.slide ? x.slide + '장 · ' : '') + esc((x.text || '(캡처만 보냄)').slice(0, 40)) + '</p>';
        }).join('') : '';
      }).catch(function () {});
    }
    function openAsk() {
      var inf = slideInfo(cur()); $('.ask-where', ov).textContent = inf.no ? '지금 장 · ' + inf.no + ' ' + inf.title : '';
      ov.hidden = false; setTimeout(function () { ta.focus(); }, 30); paintMine();
    }
    function closeAsk() { ov.hidden = true; }
    fab.addEventListener('click', function (e) { e.stopPropagation(); openAsk(); });
    $('.ask-x', ov).addEventListener('click', function (e) { e.stopPropagation(); closeAsk(); });
    ov.addEventListener('click', function (e) { e.stopPropagation(); if (e.target === ov) closeAsk(); });
    ov.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') closeAsk(); });
    sendB.addEventListener('click', function (e) {
      e.stopPropagation(); var t = ta.value.trim();
      if (!t && !img) { toast('질문이나 캡처를 넣어 주세요'); return; }
      if (busySend) return; busySend = true; sendB.textContent = '보내는 중…';
      var inf = slideInfo(cur());
      api('/ask', { room: ROOM_ASK, who: who(), slide: inf.no, title: inf.title, text: t, img: img }).then(function () {
        ta.value = ''; setImg(''); toast('보냈어요! 강사님이 확인하면 여기에 표시돼요'); paintMine();
      }, function (err) { toast(err && err.error === 'slow' ? '잠시 뒤에 다시 보내 주세요' : '보내지 못했어요. 다시 눌러 주세요'); })
        .then(function () { busySend = false; sendB.textContent = '보내기'; });
    });
    function paintFab() { fab.hidden = unlocked || !isPrac(cur()); }
    document.addEventListener('slide:enter', paintFab);
    window.addEventListener('scroll', function () { if (mode !== 'present') paintFab(); }, { passive: true });
    setInterval(paintFab, 1500); paintFab();

    /* 강사 */
    var pf = document.createElement('button'); pf.type = 'button'; pf.className = 'askp-fab'; pf.hidden = true;
    pf.innerHTML = '실습 질문 <b>0</b>';
    var pp = document.createElement('div'); pp.className = 'askp'; pp.hidden = true;
    pp.innerHTML = '<header><b>실습 질문</b><small>Zoom 화면에 그대로 보여요. 개인정보가 보이면 바로 숨기기</small><button type="button" class="askp-clr">모두 지우기</button><button type="button" class="askp-x" aria-label="닫기">✕</button></header><div class="askp-list"><p class="askp-none">아직 들어온 질문이 없어요</p></div>';
    body.appendChild(pf); body.appendChild(pp);
    var list = $('.askp-list', pp), since = 0, cards = {}, timer = null;
    function adm(data) { data.pin = pinGet(); data.room = ROOM_ASK; return api('/ask-admin', data); }
    function card(x) {
      var a = document.createElement('article'); a.className = 'askp-c' + (x.done ? ' ok' : ''); a.dataset.id = x.id;
      a.innerHTML = '<p class="askp-m"><b>' + esc(x.slide ? x.slide + '장' : '') + '</b> ' + esc(x.title) + '<span>' + ago(x.ts) + '</span></p>' +
        (x.text ? '<p class="askp-t">' + esc(x.text) + '</p>' : '') + (x.img ? '<img alt="보낸 캡처">' : '') +
        '<div class="askp-b"><button type="button" data-a="done">' + (x.done ? '되돌리기' : '✓ 해결') + '</button><button type="button" data-a="hide">숨기기</button></div>';
      if (x.img) { var im = $('img', a); im.src = x.img; im.addEventListener('click', function (e) { e.stopPropagation(); big(x.img); }); }
      a.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return; e.stopPropagation();
        if (b.dataset.a === 'done') { var d = !a.classList.contains('ok'); adm({ action: 'done', id: x.id, done: d }).then(function () { a.classList.toggle('ok', d); b.textContent = d ? '되돌리기' : '✓ 해결'; count(); }); }
        else adm({ action: 'hide', id: x.id }).then(function () { a.remove(); delete cards[x.id]; count(); });
      });
      return a;
    }
    function count() {
      var n = $$('.askp-c:not(.ok)', list).length; $('b', pf).textContent = n; pf.classList.toggle('new', n > 0);
      $('.askp-none', list).hidden = !!$('.askp-c', list);
    }
    function pull() {
      if (!unlocked) return;
      adm({ since: since }).then(function (j) {
        j.items.forEach(function (x) { since = Math.max(since, x.id); if (cards[x.id]) return; cards[x.id] = card(x); list.insertBefore(cards[x.id], list.firstChild.nextSibling); });
        var alive = {}; j.all.forEach(function (x) { alive[x.id] = x.done; });
        Object.keys(cards).forEach(function (id) { if (!(id in alive)) { cards[id].remove(); delete cards[id]; } else cards[id].classList.toggle('ok', !!alive[id]); });
        count();
      }).catch(function (err) { if (err && err.error === 'pin') lockNow(); });
    }
    pf.addEventListener('click', function (e) { e.stopPropagation(); pp.hidden = !pp.hidden; });
    $('.askp-x', pp).addEventListener('click', function (e) { e.stopPropagation(); pp.hidden = true; });
    pp.addEventListener('click', function (e) { e.stopPropagation(); });
    $('.askp-clr', pp).addEventListener('click', function (e) {
      e.stopPropagation(); if (!confirm('실습 질문을 모두 지울까요? 캡처도 함께 지워져요.')) return;
      adm({ action: 'clear' }).then(function () { Object.keys(cards).forEach(function (id) { cards[id].remove(); }); cards = {}; count(); toast('질문을 모두 지웠어요'); });
    });
    function paintP() {
      pf.hidden = !unlocked; if (!unlocked) pp.hidden = true;
      if (unlocked && !timer) { pull(); timer = setInterval(pull, 5000); }
      if (!unlocked && timer) { clearInterval(timer); timer = null; }
    }
    setInterval(paintP, 2000); paintP();
  })();

  /* ---------- 입력 ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (!toc.hidden) { if (e.key === 'Escape' || e.key === 'g' || e.key === 'G') closeToc(); return; }
    if (mode === 'present' && (e.key === 'g' || e.key === 'G')) { openToc(); return; }
    if (unlocked && (e.key === 'e' || e.key === 'E')) { toggleLite(); return; }
    if (mode !== 'present') return;
    if (unlocked && (e.key === 'n' || e.key === 'N')) { toggleNotes(); return; }
    if (unlocked && (e.key === 'p' || e.key === 'P')) { openPresenter(); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Backspace') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') go(0, false, true);
    else if (e.key === 'End') go(slides.length - 1, true, true);
    else if (e.key === 'f' || e.key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }
  });
  stage.addEventListener('click', function (e) {
    if (mode !== 'present') return;
    if (e.target.closest('button,a,video,table,input,textarea,select,label,form,[contenteditable],.meter,.lv,.qz,.fc,[data-more],.pbox,.pb-full,.checks li,.tour-tabs,.bld,.tour,.tpx,.spk,.pcx,.bkf,.brk,.cht,.mk,.prc,.stuck')) return;
    if (slides[idx] && slides[idx].querySelector('.bld')) return; /* 글을 쓰는 장은 화면을 눌러도 넘어가지 않아요 */
    var r = stage.getBoundingClientRect();
    (e.clientX - r.left) / r.width < 0.25 ? prev() : next();
  });
  var tx = null;
  stage.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (mode !== 'present' || tx === null) return;
    var d = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(d) > 60) d < 0 ? next() : prev();
  }, { passive: true });

  function toggleMode() { if (!unlocked) pinOpen(); else lockNow(); }
  modeBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleMode(); });
  $$('.chapters a').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); goSec(a.dataset.sec); }); });
  $$('.progress button').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); goSec(b.dataset.sec); }); });
  var toStart = document.getElementById('toStart');
  if (toStart) toStart.addEventListener('click', function (e) {
    e.stopPropagation();
    if (mode === 'present') go(0, false, true); else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.addEventListener('resize', function () {
    var m = autoMode(); if (m !== mode && !new URLSearchParams(location.search).get('mode')) setMode(m);
    if (mode === 'present') fit();
  });
  window.addEventListener('hashchange', function () {
    if (mode !== 'present') return;
    var n = hashIdx();
    if (n !== idx) go(n, false, true);
  });

  paintLock();
  setMode(autoMode());
  if (!unlocked) connect();
  booted = true;
  requestAnimationFrame(function () { requestAnimationFrame(function () { body.classList.remove('boot'); }); });
})();
