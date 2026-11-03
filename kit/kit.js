/* ================================================================
   my-slides 엔진: 사진 반응·확대 · 타이머 · 펜 · 도움말 · 빈 화면 점검
   덱의 app.js 가 보내는 'slide:enter' 이벤트만 알면 된다
   ================================================================ */
(function () {
  'use strict';
  var body = document.body, stage = document.getElementById('stage');
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  var curSlide = $('.slide');
  document.addEventListener('slide:enter', function (e) { curSlide = e.detail.slide; penRedraw(); inkEmit(true); });

  /* ---------- 알림 ---------- */
  var toastEl = el('div'); toastEl.id = 'kitToast'; body.appendChild(toastEl);
  var toastT = null;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 1800); }

  /* ---------- 사진: 반응 + 확대 ---------- */
  /* 사진(jpg·png 사진)만 고른다. 아이콘·그림(art)·움직이는 장면 그림은 뺀다 */
  var PHOTO = '.slide img';
  function isPhoto(im) {
    var s = im.getAttribute('src') || '';
    if (/\/art\/|\/game\/|\/theme\//.test(s)) return false;
    if (im.closest('.nt,.cover-art,.ico,[data-nozoom]')) return false;
    if (/^[cd]-/.test(im.className || '') || im.closest('.d-ringwrap,.c-npwrap')) return false;
    return /\.(jpe?g|webp)$/i.test(s) || im.closest('figure,.slot');
  }
  function hostOf(im) { return im.closest('figure,.slot,li,.pn') || im; }
  function markPhotos() {
    $$(PHOTO).forEach(function (im) {
      if (im.__zp || !isPhoto(im)) return;
      im.__zp = 1; im.classList.add('zp');
      var h = hostOf(im);
      if (h.__zp) return; h.__zp = 1;
      h.classList.add('zp-host');
      if (h !== im) {
        h.classList.add('zp-glare');
        if (getComputedStyle(h).position === 'static') h.style.position = 'relative';
        h.appendChild(el('i', 'zp-hint', '⤢'));
      }
      h.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        var r = h.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        h.style.setProperty('--rx', ((x - .5) * 10).toFixed(2) + 'deg');
        h.style.setProperty('--ry', ((.5 - y) * 8).toFixed(2) + 'deg');
        h.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        h.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
        h.classList.add('zp-hot');
      });
      h.addEventListener('pointerleave', function () { h.classList.remove('zp-hot'); });
    });
  }
  markPhotos();
  /* 나중에 채워지는 사진 칸(.slot)도 잡는다 */
  new MutationObserver(markPhotos).observe(stage, { childList: true, subtree: true });

  var lbx = el('div', '', '<img alt=""><p></p>'); lbx.id = 'kitLbx'; body.appendChild(lbx);
  function lbxOpen(im) {
    var cap = im.closest('figure') && $('figcaption', im.closest('figure'));
    $('img', lbx).src = im.currentSrc || im.src;
    $('p', lbx).textContent = cap ? cap.textContent : (im.alt || '');
    lbx.classList.add('on');
  }
  function lbxClose() { lbx.classList.remove('on'); }
  /* 캡처 단계에서 클릭을 가로채 장이 넘어가지 않게 한다 */
  document.addEventListener('click', function (e) {
    if (lbx.classList.contains('on')) { e.stopPropagation(); e.preventDefault(); lbxClose(); return; }
    var im = e.target.closest && e.target.closest('img.zp');
    if (!im) { var h = e.target.closest && e.target.closest('.zp-host'); if (h && e.target.classList.contains('zp-hint')) im = $('img.zp', h); }
    if (!im || !penBar.hidden) return;
    e.stopPropagation(); e.preventDefault(); lbxOpen(im);
  }, true);

  /* ---------- 상단 바에 도구 단추 ---------- */
  var btns = el('div', 'kitbtns',
    '<button type="button" data-k="timer" title="타이머 (T)">타이머</button>' +
    '<button type="button" data-k="pen" title="펜 (D)">펜</button>' +
    '<button type="button" data-k="help" title="도움말 (?)">?</button>');
  var fx = $('.topbar .fxbtns'); if (fx) fx.parentNode.insertBefore(btns, fx); else body.appendChild(btns);
  btns.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; e.stopPropagation();
    ({ timer: timerToggle, pen: penToggle, help: helpToggle })[b.dataset.k]();
  });
  function paintBtns() {
    $('[data-k="timer"]', btns).classList.toggle('on', !tm.hidden);
    $('[data-k="pen"]', btns).classList.toggle('on', !penBar.hidden);
  }

  /* ---------- 타이머 ---------- */
  var tm = el('div', '',
    '<div class="kt-hd"><span>타이머</span><span><button type="button" data-a="min" aria-label="작게">–</button> <button type="button" data-a="x" aria-label="닫기">×</button></span></div>' +
    '<div class="kt-t" title="눌러서 직접 입력 (530 → 5:30)">05:00</div>' +
    '<div class="kt-pre"><button type="button" data-m="1">1분</button><button type="button" data-m="3">3분</button><button type="button" data-m="5">5분</button><button type="button" data-m="10">10분</button></div>' +
    '<div class="kt-pre"><button type="button" data-d="-60">−1분</button><button type="button" data-d="60">+1분</button><button type="button" data-d="-10">−10초</button><button type="button" data-d="10">+10초</button></div>' +
    '<div class="kt-go"><button type="button" class="kt-play" data-a="go">시작</button><button type="button" data-a="reset">처음</button></div>');
  tm.id = 'kitTimer'; tm.hidden = true; body.appendChild(tm);
  var tLeft = 300, tSet = 300, tRun = null, tEnd = 0, ac = null;
  var tTxt = $('.kt-t', tm), tGo = $('[data-a="go"]', tm);
  function fmt(s) { s = Math.max(0, Math.ceil(s)); return (s >= 600 ? '' : '0') + Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function beep(f, d, v) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(v || .25, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + d);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d);
    } catch (e) {}
  }
  function chime() { [784, 988, 1175, 1568].forEach(function (f, i) { setTimeout(function () { beep(f, .9, .3); }, i * 170); }); }
  function tPaint() { tTxt.textContent = fmt(tLeft); tm.classList.toggle('warn', tRun && tLeft <= 10); tGo.textContent = tRun ? '멈춤' : '시작'; }
  var lastSec = -1;
  function tTick() {
    tLeft = (tEnd - Date.now()) / 1000;
    var s = Math.ceil(tLeft);
    if (s !== lastSec && s <= 10 && s > 0) beep(s <= 3 ? 1320 : 880, .12, .18);
    lastSec = s;
    if (tLeft <= 0) { tStop(); tLeft = 0; chime(); tm.classList.remove('done'); void tm.offsetWidth; tm.classList.add('done'); toast('시간이 다 됐어요'); }
    tPaint();
  }
  function tStart() { if (tLeft <= 0) tLeft = tSet; tEnd = Date.now() + tLeft * 1000; tRun = setInterval(tTick, 200); tm.classList.remove('done'); tPaint(); }
  function tStop() { clearInterval(tRun); tRun = null; tPaint(); }
  function tSetTo(s) { tStop(); tSet = tLeft = Math.max(0, Math.min(5999, s)); tm.classList.remove('done', 'warn'); tPaint(); }
  tm.addEventListener('click', function (e) {
    e.stopPropagation();
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.m) tSetTo(+b.dataset.m * 60);
    else if (b.dataset.d) { var r = !!tRun; tSetTo(tLeft + (+b.dataset.d)); if (r) tStart(); }
    else if (b.dataset.a === 'go') tRun ? tStop() : tStart();
    else if (b.dataset.a === 'reset') tSetTo(tSet);
    else if (b.dataset.a === 'min') tm.classList.toggle('min');
    else if (b.dataset.a === 'x') timerToggle();
  });
  tTxt.addEventListener('click', function (e) {
    e.stopPropagation(); if (tRun) return;
    var inp = el('input', 'kt-in'); inp.inputMode = 'numeric'; inp.placeholder = '530 → 5:30';
    tTxt.replaceWith(inp); inp.focus();
    function done(ok) {
      if (ok) { var v = inp.value.replace(/\D/g, ''); if (v) { var n = +v; tSetTo(v.length > 2 ? Math.floor(n / 100) * 60 + n % 100 : n * 60); } }
      inp.replaceWith(tTxt); tPaint();
    }
    inp.addEventListener('keydown', function (k) { k.stopPropagation(); if (k.key === 'Enter') done(true); if (k.key === 'Escape') done(false); });
    inp.addEventListener('blur', function () { if (inp.isConnected) done(true); });
  });
  (function drag() {
    var hd = $('.kt-hd', tm), sx, sy, ox, oy, on = false;
    hd.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      on = true; hd.setPointerCapture(e.pointerId); var r = tm.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
    });
    hd.addEventListener('pointermove', function (e) {
      if (!on) return;
      tm.style.left = Math.max(0, Math.min(innerWidth - 80, ox + e.clientX - sx)) + 'px';
      tm.style.top = Math.max(0, Math.min(innerHeight - 60, oy + e.clientY - sy)) + 'px'; tm.style.right = 'auto';
    });
    hd.addEventListener('pointerup', function () { on = false; });
  })();
  function timerToggle() { tm.hidden = !tm.hidden; paintBtns(); }
  tPaint();

  /* ---------- 펜 ---------- */
  var cv = el('canvas'); cv.id = 'kitPen'; cv.hidden = true; body.appendChild(cv);
  var penCtx = cv.getContext('2d'), ctx = penCtx;
  var COLORS = (getComputedStyle(document.documentElement).getPropertyValue('--kit-pens') || '').trim().split(/\s*,\s*/).filter(Boolean);
  if (!COLORS.length) COLORS = ['#FF5B3A', '#16141A', '#3D7BFF', '#2FBF71'];
  var penBar = el('div', '',
    '<button type="button" data-t="pen" class="on">펜</button><button type="button" data-t="hl">형광</button><button type="button" data-t="er">지우개</button><hr>' +
    COLORS.map(function (c, i) { return '<button type="button" class="sw' + (i ? '' : ' on') + '" data-c="' + c + '" style="background:' + c + '" aria-label="색"></button>'; }).join('') +
    '<hr><button type="button" data-a="undo">되돌<br>리기</button><button type="button" data-a="clear">모두<br>지움</button><button type="button" data-a="x">닫기</button>');
  penBar.id = 'kitPenBar'; penBar.hidden = true; body.appendChild(penBar);
  var tool = 'pen', color = COLORS[0], strokes = new WeakMap(), live = null;
  function stageBox() { var r = stage.getBoundingClientRect(); return { x: r.left, y: r.top, k: r.width / (stage.offsetWidth || 1) }; }
  function list() { if (!strokes.has(curSlide)) strokes.set(curSlide, []); return strokes.get(curSlide); }
  function fit() { var d = window.devicePixelRatio || 1; cv.width = innerWidth * d; cv.height = innerHeight * d; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; penRedraw(); }
  function drawStroke(s, b, c) {
    var ctx = c || penCtx;
    if (s.pts.length < 1) return;
    var d = window.devicePixelRatio || 1;
    ctx.save(); ctx.scale(d, d);
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = s.t === 'er' ? 'destination-out' : 'source-over';
    ctx.globalAlpha = s.t === 'hl' ? .35 : 1;
    ctx.strokeStyle = s.c; ctx.lineWidth = (s.t === 'hl' ? 34 : s.t === 'er' ? 60 : 7) * b.k;
    if (s.t === 'pen') { ctx.shadowColor = s.c; ctx.shadowBlur = 10 * b.k; }
    ctx.beginPath();
    s.pts.forEach(function (p, i) { var x = b.x + p[0] * b.k, y = b.y + p[1] * b.k; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (s.pts.length === 1) ctx.lineTo(b.x + s.pts[0][0] * b.k + .1, b.y + s.pts[0][1] * b.k);
    ctx.stroke(); ctx.restore();
  }
  function penRedraw() { if (cv.hidden) return; ctx.clearRect(0, 0, cv.width, cv.height); var b = stageBox(); list().forEach(function (s) { drawStroke(s, b); }); }
  cv.addEventListener('pointerdown', function (e) {
    cv.setPointerCapture(e.pointerId); var b = stageBox();
    live = { t: tool, c: color, pts: [[(e.clientX - b.x) / b.k, (e.clientY - b.y) / b.k]] }; list().push(live); penRedraw(); inkEmit();
  });
  cv.addEventListener('pointermove', function (e) { if (!live) return; var b = stageBox(); live.pts.push([(e.clientX - b.x) / b.k, (e.clientY - b.y) / b.k]); penRedraw(); inkEmit(); });
  cv.addEventListener('pointerup', function () { live = null; inkEmit(true); });
  penBar.addEventListener('click', function (e) {
    e.stopPropagation(); var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.t) { tool = b.dataset.t; $$('[data-t]', penBar).forEach(function (x) { x.classList.toggle('on', x === b); }); }
    else if (b.dataset.c) { color = b.dataset.c; $$('.sw', penBar).forEach(function (x) { x.classList.toggle('on', x === b); }); if (tool === 'er') $('[data-t="pen"]', penBar).click(); }
    else if (b.dataset.a === 'undo') { list().pop(); penRedraw(); inkEmit(true); }
    else if (b.dataset.a === 'clear') { strokes.set(curSlide, []); penRedraw(); inkEmit(true); }
    else if (b.dataset.a === 'x') penToggle();
  });
  function penToggle() {
    if (penBar.hidden && body.dataset.mode !== 'present') { toast('펜은 발표 모드에서 써요'); return; }
    var on = penBar.hidden; cv.hidden = penBar.hidden = !on;
    if (on) { fit(); toast('펜 켜짐 · 장 넘기기는 ← →'); }
    paintBtns(); inkEmit(true);
  }
  /* 강사가 그린 자국을 덱(app.js)에 알려요. 펜을 닫으면 강사 화면처럼 따라가는 화면에서도 사라져요 */
  function inkEmit(now) { document.dispatchEvent(new CustomEvent('kit:ink', { detail: { strokes: cv.hidden ? [] : list(), now: !!now } })); }
  /* 따라가는 화면: 강사의 자국을 보여 주기만 하는 층 */
  var inkCv = el('canvas'); inkCv.id = 'kitInk'; inkCv.hidden = true; body.appendChild(inkCv);
  var inkCtx = inkCv.getContext('2d'), inkData = null;
  function inkPaint() {
    if (!inkData || !inkData.length) { inkCv.hidden = true; return; }
    inkCv.hidden = false;
    var d = window.devicePixelRatio || 1; inkCv.width = innerWidth * d; inkCv.height = innerHeight * d; inkCv.style.width = innerWidth + 'px'; inkCv.style.height = innerHeight + 'px';
    var b = stageBox(); inkData.forEach(function (s) { drawStroke(s, b, inkCtx); });
  }
  function inkShow(s) { inkData = s; inkPaint(); }
  addEventListener('resize', inkPaint);
  addEventListener('resize', function () { if (!cv.hidden) fit(); });

  /* ---------- 도움말 ---------- */
  var help = el('div', '', '<div class="kh"><h3>단축키</h3><dl>' +
    '<dt><kbd>→</kbd><kbd>Space</kbd></dt><dd>다음 효과 · 다음 장</dd><dt><kbd>←</kbd></dt><dd>이전</dd>' +
    '<dt><kbd>G</kbd></dt><dd>장면 목록</dd><dt><kbd>N</kbd> <kbd>P</kbd></dt><dd>발표 노트 · 발표자 창</dd>' +
    '<dt><kbd>T</kbd></dt><dd>타이머 (숫자를 누르면 직접 입력)</dd><dt><kbd>D</kbd></dt><dd>펜 켜고 끄기</dd>' +
    '<dt><kbd>F</kbd></dt><dd>전체 화면</dd><dt><kbd>M</kbd> <kbd>E</kbd></dt><dd>읽기/발표 모드 · 효과 켬/끔</dd>' +
    '<dt>사진 클릭</dt><dd>크게 보기 (아무 키나 누르면 닫힘)</dd></dl></div>');
  help.id = 'kitHelp'; help.hidden = true; body.appendChild(help);
  help.addEventListener('click', function (e) { e.stopPropagation(); helpToggle(); });
  function helpToggle() { help.hidden = !help.hidden; }

  /* ---------- 키 (덱의 키보다 먼저 받는다) ---------- */
  document.addEventListener('keydown', function (e) {
    if (lbx.classList.contains('on')) { e.stopPropagation(); e.preventDefault(); lbxClose(); return; }
    if (!help.hidden) { e.stopPropagation(); helpToggle(); return; }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (body.classList.contains('locked')) return;
    var k = e.key;
    if (k === 't' || k === 'T') { e.stopPropagation(); timerToggle(); }
    else if (k === 'd' || k === 'D') { e.stopPropagation(); penToggle(); }
    else if (k === '?') { e.stopPropagation(); helpToggle(); }
    else if (k === 'Escape' && !penBar.hidden) { e.stopPropagation(); penToggle(); }
  }, true);

  /* ---------- 빈 화면 점검: KIT.audit() ----------
     장마다 제목 칸을 뺀 본문 칸을 격자로 나눠 내용이 덮는 비율과 아래쪽 빈 띠를 잰다 (효과는 모두 켠 상태로 잼) */
  function audit(min) {
    min = min || .3;
    var out = [];
    $$('.slide').forEach(function (sl, i) {
      var hidden = $$('.step', sl).filter(function (s) { return !s.classList.contains('on'); });
      hidden.forEach(function (s) { s.classList.add('on'); });
      var vis = sl.style.visibility; sl.style.visibility = 'visible';
      var sr = sl.getBoundingClientRect(), k = sr.width / (sl.offsetWidth || 1);
      var head = $('.head', sl) || $('.title', sl), hr = null;
      if (head) { var q = head.getBoundingClientRect(); hr = { l: q.left - sr.left, r: q.right - sr.left, t: q.top - sr.top, b: q.bottom - sr.top }; }
      var L = 130 * k, R = sr.width - 130 * k, B = sr.height - 140 * k, T = 96 * k;
      var COLS = 48, ROWS = 20, hit = 0, cells = 0, rowHit = [];
      var leaves = $$('*', sl).filter(function (e) {
        if (e.closest('.nt,.head,.slam') || e.matches('.title,.chap')) return false;
        var cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        if (/^(IMG|SVG|svg|VIDEO|CANVAS|INPUT|BUTTON)$/.test(e.tagName)) return true;
        if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 1 || parseFloat(cs.borderLeftWidth) > 2) return true;
        return Array.prototype.some.call(e.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
      }).map(function (e) { var r = e.getBoundingClientRect(); return { l: r.left - sr.left, r: r.right - sr.left, t: r.top - sr.top, b: r.bottom - sr.top }; });
      if (B - T > 40 * k) for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
        var cx = L + (x + .5) * (R - L) / COLS, cy = T + (y + .5) * (B - T) / ROWS;
        if (hr && cx >= hr.l && cx <= hr.r && cy >= hr.t && cy <= hr.b) continue;
        cells++;
        if (leaves.some(function (r) { return cx >= r.l && cx <= r.r && cy >= r.t && cy <= r.b; })) { hit++; rowHit[y] = 1; }
      }
      hidden.forEach(function (s) { s.classList.remove('on'); });
      sl.style.visibility = vis;
      var ratio = cells ? hit / cells : 1, gap = 0;
      for (var g = ROWS - 1; g >= 0 && !rowHit[g]; g--) gap++;
      gap /= ROWS;
      if (ratio < min || gap > .22) out.push({ no: i + 1, fill: Math.round(ratio * 100) + '%', bottomEmpty: Math.round(gap * 100) + '%', title: (($('.title,.ctitle', sl) || {}).textContent || '').replace(/\s+/g, ' ').trim() });
    });
    return out;
  }
  /* ---------- 줄바꿈 다듬기 ----------
     한국어 조판 규칙대로 떨어지면 어색한 낱말을 붙여 둔다 (공백 → 줄바꿈 없는 공백)
     · 한 글자 부사(못·안·잘·더·꼭·다·또·곧·늘·좀·덜·왜) + 다음 낱말   예) 못 가요
     · 영문·숫자가 이어지는 이름                                      예) Mark II, Scratch 3.0
     · 숫자·셈말                                                     예) 두 번, 한 가지, 30 초
     · =, →, +, ① 같은 기호는 앞 낱말에 붙인다                        예) 가요 = 버그 */
  var NB = ' ';
  var GLUE = [
    [/(^|[\s(“"'])(못|안|잘|더|꼭|다|또|곧|늘|좀|덜|왜|딱|막|참|꽤) (?=\S)/g, '$1$2' + NB],
    [/([A-Za-z][A-Za-z.]*) (?=[A-Z0-9IVX][A-Za-z0-9.]*)/g, '$1' + NB],
    [/(\d) (?=(?:번|개|명|분|초|cm|mm|m|시간|차시|일|장|칸|줄|단계|가지|세트|팀|%))/g, '$1' + NB],
    [/(^|\s)(한|두|세|네|몇|다섯|여섯|열) (?=(?:번|개|명|가지|칸|줄|시간|장|쪽|사람|팀|단계|글자|낱말))/g, '$1$2' + NB],
    [/ (?=[=→+×÷①-⑩])/g, NB],
    [/([=]) (?=\S{1,4}(?:\s|$)|$)/g, '$1' + NB]
  ];
  function glue(root) {
    var w = document.createTreeWalker(root || stage, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return /\S/.test(n.nodeValue) && !n.parentNode.closest('script,style,svg,code,pre,input,textarea,[data-nowrap-off]') ? 1 : 2; }
    }), n;
    while ((n = w.nextNode())) {
      var v = n.nodeValue, o = v;
      GLUE.forEach(function (g) { v = v.replace(g[0], g[1]); });
      if (v !== o) n.nodeValue = v;
    }
  }
  glue();

  /* ---------- 줄바꿈 점검: KIT.breaks() ----------
     글 상자마다 실제 줄을 재서 ① 마지막 줄에 한 낱말만 남은 것 ② 한 글자 낱말에서 끊긴 것
     ③ 나란한 칸(카드·열)끼리 줄 수가 달라 큰 글자 높이가 어긋난 것을 찾는다 */
  var ADV = /^(못|안|잘|더|꼭|다|또|곧|늘|좀|덜|왜|딱|막|참|꽤|한|두|세|네|몇)$/;
  function blockOf(n) { var e = n.nodeType === 1 ? n : n.parentElement; while (e && getComputedStyle(e).display === 'inline') e = e.parentElement; return e; }
  function lineInfo(el) {
    var words = [], br = false, glueNext = false;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null), n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 1) { if (n.tagName === 'BR') { br = true; glueNext = false; } continue; }
      if (n.parentNode.closest('svg,.nt')) continue;
      var blk = blockOf(n), re = /[^\s ]+(?: [^\s ]+)*/g, m, any = false;
      while ((m = re.exec(n.nodeValue))) {
        var r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        var rs = r.getClientRects(); if (!rs.length) continue;
        var prev = words[words.length - 1];
        if (m.index === 0 && glueNext && prev && prev.blk === blk) { prev.t += m[0]; prev.right = rs[rs.length - 1].right; any = true; continue; }
        words.push({ t: m[0], top: rs[0].top, bot: rs[0].bottom, left: rs[0].left, right: rs[rs.length - 1].right, blk: blk, br: br });
        br = false; any = true;
      }
      if (any || !/\S/.test(n.nodeValue)) glueNext = !/[\s ]$/.test(n.nodeValue);
    }
    var lines = [];
    words.forEach(function (x) {
      var L = lines[lines.length - 1];
      var ov = L ? Math.min(L.bot, x.bot) - Math.max(L.top, x.top) : 0;
      if (!L || L.blk !== x.blk || x.br || ov < Math.min(L.bot - L.top, x.bot - x.top) / 2) lines.push(L = { top: x.top, bot: x.bot, words: [], l: x.left, r: x.right, blk: x.blk, br: x.br });
      L.words.push(x.t); L.l = Math.min(L.l, x.left); L.r = Math.max(L.r, x.right);
    });
    return lines;
  }
  function breaks() {
    var out = [];
    $$('.slide').forEach(function (sl, i) {
      var hidden = $$('.step', sl).filter(function (s) { return !s.classList.contains('on'); });
      hidden.forEach(function (s) { s.classList.add('on'); });
      var vis = sl.style.visibility; sl.style.visibility = 'visible';
      var blocks = $$('h1,h2,h3,p,li,figcaption,dd,td,.lead,.body-t', sl).filter(function (e) {
        if (e.closest('.nt,.toc,svg')) return false;
        if ($$('p,li,h3,div', e).length) return false;          /* 안쪽 글 상자에서 잰다 */
        return /\S/.test(e.textContent) && e.getBoundingClientRect().width > 0;
      });
      blocks.forEach(function (e) {
        var L = lineInfo(e); if (L.length < 2) return;
        var widest = Math.max.apply(null, L.map(function (x) { return x.r - x.l; }));
        var last = L[L.length - 1], prevL = L[L.length - 2], why = [];
        if (last.words.length === 1 && !last.br && prevL.blk === last.blk && (last.r - last.l) < widest * .35) why.push('끝줄에 한 낱말: ' + last.words[0]);
        for (var k = 0; k < L.length - 1; k++) {
          if (L[k].blk !== L[k + 1].blk || L[k + 1].br) continue;
          var end = L[k].words[L[k].words.length - 1], nx = L[k + 1].words[0];
          if (ADV.test(end)) why.push('꾸미는 한 글자에서 끊김: ' + end + ' / ' + nx);
          if (/^[=→+×①-⑩]/.test(nx)) why.push('기호가 줄 앞에 옴: ' + end + ' / ' + nx);
          if (/[A-Za-z0-9]$/.test(end) && /^[A-Z0-9]/.test(nx)) why.push('영문·숫자 이름이 갈림: ' + end + ' / ' + nx);
        }
        if (why.length) out.push({ no: i + 1, text: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 40), why: why.join(' · ') });
      });
      /* 나란한 칸: 같은 부모 아래 같은 모양의 형제들 */
      $$('ol,ul,.cols,.grid', sl).forEach(function (list) {
        var kids = Array.prototype.slice.call(list.children).filter(function (c) { return c.getBoundingClientRect().width > 0; });
        if (kids.length < 2) return;
        var tops = kids.map(function (c) { return Math.round(c.getBoundingClientRect().top); });
        if (Math.max.apply(null, tops) - Math.min.apply(null, tops) > 6) return;   /* 한 줄로 나란한 것만 */
        var big = kids.map(function (c) { var b = $('.kw', c) || $('b:last-child', c); if (!b) return null; var fs = parseFloat(getComputedStyle(b).fontSize), base = parseFloat(getComputedStyle(c).fontSize); return fs >= base * 1.6 ? Math.round(b.getBoundingClientRect().top) : null; }).filter(function (v) { return v != null; });
        if (big.length > 1 && Math.max.apply(null, big) - Math.min.apply(null, big) > 8) out.push({ no: i + 1, text: list.className, why: '나란한 칸의 큰 글자 높이가 어긋남' });
      });
      hidden.forEach(function (s) { s.classList.remove('on'); });
      sl.style.visibility = vis;
    });
    return out;
  }

  window.KIT = { audit: audit, breaks: breaks, glue: glue, lines: lineInfo, toast: toast, timer: timerToggle, pen: penToggle, inkShow: inkShow };
})();
