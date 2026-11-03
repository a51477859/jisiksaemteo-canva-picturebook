/* v3 장면: 책 넘기기 보기 · 그림 요청문 조립 · AI에게 요청문 만들게 하기 */
(function () {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(m) { if (window.KIT && KIT.toast) KIT.toast(m); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function copy(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { toast('복사했어요'); });
    var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('복사했어요'); } catch (e) {} ta.remove();
  }

  /* ---------- 양옆 빈 띠: 지금 장면의 배경 그림을 깔아요 ---------- */
  function pageBg(sl) {
    if (!sl) return;
    var u = sl.style.getPropertyValue('--bg');
    if (!u && sl.classList.contains('s-ends')) u = "url('theme/v3/bg_intro.jpg')";
    document.body.style.setProperty('--pagebg', u || 'none');
  }
  document.addEventListener('slide:enter', function (e) { pageBg(e.detail.slide); });
  pageBg(document.querySelector('.slide.active') || document.querySelector('.slide'));

  /* ---------- 책 넘기기 ---------- */
  var book = null;
  function openBook(pages, at) {
    if (!book) {
      book = document.createElement('div'); book.className = 'bkv'; book.innerHTML =
        '<div class="bkv-bg"></div><div class="bkv-in"><button type="button" class="bkv-x" aria-label="닫기">✕</button>' +
        '<div class="bkv-page"><img alt=""><p class="bkv-t"></p></div>' +
        '<button type="button" class="bkv-p" aria-label="이전 쪽">‹</button><button type="button" class="bkv-n" aria-label="다음 쪽">›</button>' +
        '<p class="bkv-c"></p><div class="bkv-strip"></div></div>';
      document.body.appendChild(book);
      book.addEventListener('click', function (e) {
        if (e.target === book || e.target.classList.contains('bkv-bg') || e.target.closest('.bkv-x')) return closeBook();
        if (e.target.closest('.bkv-p')) return turn(-1);
        if (e.target.closest('.bkv-n')) return turn(1);
        var th = e.target.closest('.bkv-th'); if (th) { var k = +th.dataset.i, d = k - book._i; if (!d) return; book._i = k; return show(d); }
        if (e.target.closest('.bkv-page')) return turn(1); /* 그림을 눌러도 다음 쪽 */
      });
      document.addEventListener('keydown', function (e) {
        if (!book.classList.contains('on')) return;
        e.stopPropagation(); e.preventDefault();
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') turn(1);
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp') turn(-1);
        else if (e.key === 'Escape') closeBook();
      }, true);
    }
    book._p = pages; book._i = at;
    /* 아래 쪽 목록: 지금 몇 쪽인지 바로 보이고, 눌러서 옮겨 갈 수 있어요 */
    $('.bkv-strip', book).innerHTML = pages.map(function (p, i) { return '<button type="button" class="bkv-th" data-i="' + i + '" aria-label="' + (i ? i + '쪽' : '표지') + '"><img src="' + esc(p.th || p.img) + '" alt=""></button>'; }).join('');
    show(0); book.classList.add('on'); preload(pages);
  }
  function show(dir) {
    var p = book._p[book._i], pg = $('.bkv-page', book);
    pg.classList.remove('in-l', 'in-r'); void pg.offsetWidth; if (dir) pg.classList.add(dir > 0 ? 'in-r' : 'in-l');
    /* 작은 그림을 바로 보여 주고, 큰 그림이 준비되면 바꿔요 */
    var im = $('img', book), big = new Image(); big.src = p.img;
    if (p.th && !big.complete) { im.src = p.th; big.onload = function () { if (book._p[book._i] === p) im.src = p.img; }; } else im.src = p.img;
    $('.bkv-bg', book).style.backgroundImage = 'url(' + (p.th || p.img) + ')'; $('.bkv-t', book).textContent = p.text;
    $('.bkv-c', book).textContent = (book._i === 0 ? '표지' : book._i + '쪽') + ' · ' + (book._i + 1) + ' / ' + book._p.length;
    $('.bkv-t', book).classList.toggle('cover', book._i === 0);
    $$('.bkv-th', book).forEach(function (t, i) { t.classList.toggle('on', i === book._i); });
    $('.bkv-p', book).style.visibility = book._i > 0 ? '' : 'hidden';
    $('.bkv-n', book).style.visibility = book._i < book._p.length - 1 ? '' : 'hidden';
  }
  function turn(d) { var n = book._i + d; if (n < 0 || n >= book._p.length) return; book._i = n; show(d); }
  function closeBook() { book.classList.remove('on'); }
  /* 미리 받아 두기: 책을 열면 그 책의 모든 쪽, 마우스를 올리면 미리, 책장 장에 오면 작은 그림 */
  var kept = [];
  function preload(pages, small) { pages.forEach(function (p) { var i = new Image(); i.src = small ? (p.th || p.img) : p.img; kept.push(i); }); }
  $$('.shf').forEach(function (ul) {
    var data = ul.parentNode.querySelector('.shf-data'); if (!data) return;
    var books = JSON.parse(data.textContent);
    ul.addEventListener('click', function (e) { var b = e.target.closest('.shf-b'); if (b) { e.stopPropagation(); openBook(books[+b.dataset.book], 0); } });
    ['pointerenter', 'focusin', 'touchstart'].forEach(function (ev) { ul.addEventListener(ev, function (e) { var b = e.target.closest && e.target.closest('.shf-b'); if (b && !b._pre) { b._pre = 1; preload(books[+b.dataset.book]); } }, true); });
    document.addEventListener('slide:enter', function (e) { if (e.detail.slide && e.detail.slide.contains(ul) && !ul._pre) { ul._pre = 1; books.forEach(function (b) { preload(b, true); }); } });
  });
  $$('.bkf').forEach(function (ul) {
    var data = ul.parentNode.querySelector('.bkf-data'); if (!data) return;
    var pages = JSON.parse(data.textContent);
    ul.addEventListener('click', function (e) { var b = e.target.closest('.bkf-t'); if (b) openBook(pages, +b.dataset.page); });
  });

  /* ---------- 그림 요청문 조립 ---------- */
  var FOX = '흰 주둥이와 흰 꼬리 끝을 가진 작은 주황색 여우가 파란 장화를 신고';
  var IMG = [
    { k: 'who', h: '누가', ph: '예) ' + FOX, chips: [['여우 모루', FOX], ['달팽이 누리', '노란 껍데기를 가진 작은 달팽이가']], keep: true },
    { k: 'what', h: '무엇을', ph: '예) 나무 아래에서 노란 우산을 발견하고 깜짝 놀란다', chips: [] },
    { k: 'where', h: '어디서', ph: '예) 비 오는 숲길', chips: [['비 오는 숲길', '비 오는 숲길'], ['학교 앞', '비 오는 학교 앞'], ['나무 아래', '커다란 나무 아래']] },
    { k: 'mood', h: '분위기', ph: '예) 따뜻하고 포근한', chips: [['포근한', '따뜻하고 포근한 분위기'], ['두근두근', '긴장되고 궁금한 분위기'], ['신나는', '밝고 신나는 분위기']] },
    { k: 'style', h: '그림체', ph: '재료 · 선 · 색 · 질감', chips: [
      ['수채화', '종이에 그린 부드러운 수채화, 가는 윤곽선, 노랑·연두 중심, 물감 번짐과 종이 결'],
      ['색연필', '색연필로 여러 번 겹쳐 칠한 그림, 가는 연필 선, 따뜻하고 소박한 색, 종이 결'],
      ['크레파스', '굵은 크레파스 그림, 자유로운 선, 넓고 선명한 색면, 거친 왁스 질감'],
      ['종이 콜라주', '색종이를 오려 붙인 콜라주, 단순한 형태, 종이 가장자리와 얕은 그림자'],
      ['점토', '손으로 빚은 무광 점토 인형 장면, 둥근 입체, 부드러운 왼쪽 위 조명'],
      ['판화', '리놀륨 판화처럼 굵게 새긴 선, 주황·남색·노랑·크림 네 가지 색']] },
    { k: 'space', h: '글 자리', chips: [
      ['아래', '화면 아래쪽 3분의 1은 글을 넣을 수 있게 아무것도 없는 밝은 공간으로 비워 둔다'],
      ['위', '화면 위쪽 3분의 1은 글을 넣을 수 있게 구름 없는 밝은 하늘로 비워 둔다'],
      ['왼쪽', '인물은 오른쪽에 두고, 왼쪽 절반은 글을 넣을 단순한 배경만 둔다'],
      ['오른쪽', '인물은 왼쪽에 두고, 오른쪽 절반은 글을 넣을 단순한 배경만 둔다'],
      ['표지', '위쪽 3분의 1은 제목을 넣을 밝은 빈 공간, 인물은 아래 가운데']], pick: true },
    { k: 'cam', h: '구도', chips: [['멀리서 전신', '멀리서 본 전신 구도'], ['가까이 얼굴', '얼굴이 크게 보이는 가까운 구도'], ['위에서', '위에서 내려다본 구도']], pick: true },
  ];
  var IMG_EX = { who: FOX, what: '나무 아래에서 달팽이가 쓰고 있는 노란 우산을 발견하고 깜짝 놀란다', where: '비 오는 숲길', mood: '따뜻하고 포근한 분위기',
    style: '종이에 그린 부드러운 수채화, 가는 윤곽선, 노랑·연두 중심, 물감 번짐과 종이 결', space: '화면 아래쪽 3분의 1은 글을 넣을 수 있게 아무것도 없는 밝은 공간으로 비워 둔다', cam: '멀리서 본 전신 구도' };
  function assembleImg(v) {
    var parts = ['어린이 그림책 삽화.'];
    if (v.who || v.what) parts.push([v.who ? slot('who', v.who) : '', v.what ? slot('what', v.what) : ''].filter(Boolean).join(' ') + '.');
    if (v.where) parts.push(slot('where', v.where) + '.');
    if (v.mood) parts.push(slot('mood', v.mood) + '.');
    if (v.cam) parts.push(slot('cam', v.cam) + '.');
    if (v.style) parts.push(slot('style', v.style) + '.');
    if (v.space) parts.push(slot('space', v.space) + '.');
    parts.push('그림 안에 글자, 숫자, 말풍선을 넣지 않는다.');
    return parts.join(' ');
  }

  var META = [
    { k: 'text', h: '내 원고', ph: '표지와 장면별 문장을 붙여 넣어요', area: true },
    { k: 'who', h: '캐릭터 설명', ph: '예) ' + FOX, chips: [['여우 모루', FOX]] },
    { k: 'style', h: '그림체', ph: '예) 부드러운 수채화', chips: IMG[4].chips },
    { k: 'space', h: '글 자리', chips: IMG[5].chips, pick: true },
  ];
  var META_EX = { text: '표지: 잃어버린 노란 우산\n장면 1: 비 오는 아침, 모루는 노란 우산을 쓰고 학교에 갔어요.\n장면 2: 집에 가는 길, 모루는 깜짝 놀랐어요. “내 노란 우산이 어디 갔지?”',
    who: FOX, style: '종이에 그린 부드러운 수채화, 가는 윤곽선, 노랑·연두 중심, 물감 번짐과 종이 결', space: '화면 아래쪽 3분의 1은 글을 넣을 수 있게 아무것도 없는 밝은 공간으로 비워 둔다' };
  function assembleMeta(v) {
    return '아래는 내가 쓴 어린이 그림책 원고야. 장면마다 Canva Magic Media에 넣을 그림 요청문을 한국어로 하나씩 만들어 줘.\n규칙\n' +
      '1. 모든 장면에 같은 캐릭터 설명을 그대로 넣어: ' + slot('who', v.who || '[캐릭터 설명]') + '\n' +
      '2. 그림체는 모든 장면에 똑같이: ' + slot('style', v.style || '[그림체]') + '\n' +
      '3. 장면마다 누가 · 무엇을 · 어디서 · 분위기를 한 문장씩\n' +
      '4. ' + slot('space', v.space || '화면 아래쪽은 글을 넣을 빈 공간으로 비워 둔다') + '\n' +
      '5. 그림 안에 글자, 숫자, 말풍선을 넣지 않기\n6. 원고에 없는 사건은 더하지 않기\n원고\n' + slot('text', v.text || '[원고를 붙여 넣어요]');
  }
  function slot(k, t) { return '\u0001' + k + '\u0002' + t + '\u0003'; }
  function toHtml(s) { return esc(s).replace(/\u0001(\w+)\u0002([\s\S]*?)\u0003/g, '<mark class="bk-$1">$2</mark>').replace(/\n/g, '<br>'); }
  function toText(s) { return s.replace(/\u0001\w+\u0002([\s\S]*?)\u0003/g, '$1'); }

  $$('.bld').forEach(function (el) {
    var meta = el.dataset.kind === 'meta', F = meta ? META : IMG, EX = meta ? META_EX : IMG_EX, v = {};
    var saved = store('v3-who'); if (saved) v.who = saved;
    el.innerHTML = '<div class="bld-l">' + F.map(function (f) {
      return '<div class="bf" data-k="' + f.k + '"><p class="bf-h"><b class="bk-' + f.k + '">' + f.h + '</b>' + (f.chips && f.chips.length ? '<span class="bf-c">' + f.chips.map(function (c, i) { return '<button type="button" data-i="' + i + '">' + esc(c[0]) + '</button>'; }).join('') + '</span>' : '') + '</p>' +
        (f.pick ? '' : (f.area ? '<textarea rows="4" placeholder="' + esc(f.ph || '') + '"></textarea>' : '<input type="text" placeholder="' + esc(f.ph || '') + '">')) + '</div>';
    }).join('') + '</div><div class="bld-r"><p class="bld-h">' + (meta ? 'ChatGPT · Gemini에 붙일 부탁' : '완성된 그림 요청문') + '</p><div class="bld-out"></div>' +
      '<div class="bld-b"><button type="button" class="bb-copy">복사하기</button><button type="button" class="bb-ex">예시 넣기</button><button type="button" class="bb-clr">지우기</button></div></div>';
    function sync() {
      F.forEach(function (f) {
        var box = $('.bf[data-k="' + f.k + '"]', el), inp = $('input,textarea', box);
        if (inp && document.activeElement !== inp) inp.value = v[f.k] || '';
        $$('.bf-c button', box).forEach(function (b) { b.classList.toggle('on', f.chips[+b.dataset.i][1] === v[f.k]); });
      });
      $('.bld-out', el).innerHTML = toHtml(meta ? assembleMeta(v) : assembleImg(v));
      if (v.who) store('v3-who', v.who);
    }
    el.addEventListener('input', function (e) { var box = e.target.closest('.bf'); if (box) { v[box.dataset.k] = e.target.value.trim(); sync(); } });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.bf-c button');
      if (b) { var f = F.filter(function (x) { return x.k === b.closest('.bf').dataset.k; })[0], val = f.chips[+b.dataset.i][1]; v[f.k] = v[f.k] === val && f.pick ? '' : val; return sync(); }
      if (e.target.closest('.bb-ex')) { Object.keys(EX).forEach(function (k) { v[k] = EX[k]; }); return sync(); }
      if (e.target.closest('.bb-clr')) { v = {}; return sync(); }
      if (e.target.closest('.bb-copy')) copy(toText(meta ? assembleMeta(v) : assembleImg(v)));
    });
    /* 발표 중 글을 쓸 때는 장면이 넘어가지 않게 */
    el.addEventListener('keydown', function (e) { e.stopPropagation(); });
    sync();
  });
})();

/* ===== v3 2차: 그림체 고르기판 · 탭 그림 · 쉬는 시간 · 캡처 돋보기 · 카드 자세히 보기 ===== */
(function () {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* 그림체 고르기판: 물감 칸을 누르면 큰 그림이 바뀌고, 가만히 두면 차례로 넘어가요 */
  $$('.spk').forEach(function (el) {
    var bs = $$('.spk-b', el), ims = $$('.spk-im', el), cap = $('.spk-cap', el), k = 0, t = null;
    function show(i) {
      k = i; bs.forEach(function (b, j) { b.classList.toggle('on', j === i); });
      ims.forEach(function (im, j) { im.classList.toggle('on', j === i); });
      $('b', cap).textContent = bs[i].dataset.tag; $('span', cap).textContent = bs[i].dataset.cap;
    }
    function auto() { clearInterval(t); t = setInterval(function () { if (el.closest('.slide.active')) show((k + 1) % bs.length); }, 3200); }
    bs.forEach(function (b, i) { b.addEventListener('click', function (e) { e.stopPropagation(); show(i); auto(); }); });
    auto();
  });

  /* 탭 그림: 탭을 누르면 큰 그림과 글 자리 표시가 바뀌어요 */
  $$('.tpx').forEach(function (el) {
    var bs = $$('.tpx-b', el), t = null, k = 0;
    function show(i) {
      k = i; bs.forEach(function (b, j) { b.classList.toggle('on', j === i); });
      $$('.tpx-im, .tpx-zone', el).forEach(function (x) { x.classList.toggle('on', +x.dataset.i === i); });
    }
    function auto() { clearInterval(t); t = setInterval(function () { if (el.closest('.slide.active')) show((k + 1) % bs.length); }, 3600); }
    bs.forEach(function (b, i) { b.addEventListener('click', function (e) { e.stopPropagation(); show(i); auto(); }); });
    auto();
  });

  /* 쉬는 시간 타이머 */
  $$('.brk').forEach(function (el) {
    var clock = $('.brk-clock', el), go = $('.brk-go', el), left = +clock.dataset.sec, t = null;
    function draw() { var m = Math.floor(left / 60), s = left % 60; clock.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
    go.addEventListener('click', function (e) {
      e.stopPropagation(); clearInterval(t); left = +clock.dataset.sec; draw(); el.classList.remove('done'); el.classList.add('run'); go.textContent = '다시 시작';
      t = setInterval(function () { left--; draw(); if (left <= 0) { clearInterval(t); el.classList.remove('run'); el.classList.add('done'); } }, 1000);
    });
    draw();
  });

  /* 캡처 돋보기: 강조 상자가 화면에서 작게 보일 때만, 그 상자 바로 옆에 읽을 수 있는 크기로 크게 보여 줘요 */
  $$('.tour').forEach(function (tour) {
    var view = $('.tw-view', tour); if (!view) return;
    var lens = document.createElement('div'); lens.className = 'tw-lens'; lens.setAttribute('aria-hidden', 'true'); view.appendChild(lens);
    var last = '', tmr = 0;
    function hide() { lens.classList.remove('on'); last = ''; }
    function upd() {
      var t = $('.tt.cur', tour), shot = $('.tw-shot.on img', tour), box = $('.tw-box.on', tour);
      if (!t || !shot || !box || !t.dataset.box || !shot.naturalWidth || document.body.dataset.mode !== 'present') return hide();
      var key = t.dataset.k + '|' + shot.src; if (key === last) return; last = key;
      var vr = view.getBoundingClientRect(), br = box.getBoundingClientRect();
      if (!vr.width || !br.width) return hide();
      /* 화면 기준 크기: 이미 충분히 크면(높이 7% 이상, 폭 40% 이상) 돋보기 없이 */
      var sc = view.offsetWidth / vr.width; /* 무대 축소 비율 되돌리기 */
      var bw = br.width * sc, bh = br.height * sc, VW = view.clientWidth, VH = view.clientHeight;
      var want = Math.min(VW * 0.94 / bw, VH * 0.34 / bh, 3.2);
      if (want < 1.45) return hide();
      var b = t.dataset.box.split(',').map(Number), iw = shot.naturalWidth, ih = shot.naturalHeight;
      var px = 0.08, x = Math.max(0, b[0] - b[2] * px), y = Math.max(0, b[1] - b[3] * px * 3), w = Math.min(100 - x, b[2] * (1 + 2 * px)), h = Math.min(100 - y, b[3] * (1 + 6 * px));
      var LW = bw * (w / b[2]) * want, LH = LW * (h * ih) / (w * iw);
      if (LW > VW * 0.96) { LH *= VW * 0.96 / LW; LW = VW * 0.96; }
      var bgW = LW * 100 / w, bgH = bgW * ih / iw;
      /* 자리: 상자 아래, 모자라면 위. 가로는 상자 가운데에 맞추고 화면 안으로 */
      var bx = (br.left - vr.left) * sc, by = (br.top - vr.top) * sc;
      var top = by + bh + 14; if (top + LH > VH - 6) top = Math.max(6, by - LH - 14);
      var left = Math.min(Math.max(6, bx + bw / 2 - LW / 2), VW - LW - 6);
      lens.style.cssText = 'left:' + left + 'px;top:' + top + 'px;right:auto;bottom:auto;width:' + LW + 'px;height:' + LH + 'px;background-image:url("' + shot.src + '");background-size:' + bgW + 'px ' + bgH + 'px;background-position:' + (-x / 100 * bgW) + 'px ' + (-y / 100 * bgH) + 'px';
      lens.classList.remove('on'); void lens.offsetWidth; lens.classList.add('on');
    }
    /* 확대 이동이 끝난 뒤 크기를 재요 */
    new MutationObserver(function (recs) { if (recs.every(function (r) { return r.target === lens; })) return; clearTimeout(tmr); lens.classList.remove('on'); last = ''; tmr = setTimeout(upd, 900); }).observe(tour, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });

  /* 카드 누르면 크게 · 자세히 */
  var pop = document.createElement('div'); pop.className = 'cardpop'; pop.innerHTML = '<div class="cp-in"><b></b><p></p><small></small></div>'; document.body.appendChild(pop);
  pop.addEventListener('click', function (e) { e.stopPropagation(); pop.classList.remove('on'); });
  document.addEventListener('keydown', function (e) { if (pop.classList.contains('on')) { pop.classList.remove('on'); e.stopPropagation(); e.preventDefault(); } }, true);
  $$('.slide .pts .it, .slide .stp .it').forEach(function (it) {
    if (it.hasAttribute('data-more')) return;
    it.classList.add('tap');
    it.addEventListener('click', function (e) {
      var sl = it.closest('.slide'), note = sl && $('.nt .nsay', sl);
      /* 아직 다 안 나온 카드가 있으면 설명 대신 다음 카드가 나오게 (클릭을 그대로 넘겨요) */
      if (document.body.dataset.mode === 'present' && sl && sl.querySelector('.step:not(.on)')) return;
      e.stopPropagation();
      $('b', pop).textContent = ($('b', it) || {}).textContent || '';
      $('p', pop).textContent = ($('p', it) || {}).textContent || '';
      $('small', pop).textContent = note ? note.textContent : '';
      pop.classList.add('on');
    });
  });
})();

/* 다섯 조각: 장에 들어오면 조각이 하나씩 날아와 문장을 채우고 그림이 펼쳐져요 */
(function () {
  function play(el) { el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }
  document.querySelectorAll('.pcx').forEach(function (el) {
    var re = el.querySelector('.pc-re'); if (re) re.addEventListener('click', function (e) { e.stopPropagation(); play(el); });
  });
  document.addEventListener('slide:enter', function (e) { var el = e.detail.slide && e.detail.slide.querySelector('.pcx'); if (el) play(el); });
  var first = document.querySelector('.slide.active .pcx'); if (first) play(first);
})();

/* 요청문 만들기 꾸미기: 칸마다 그림 아이콘, 고른 낱말이 오른쪽으로 날아가요, 이런 그림이 나와요 미리보기 */
(function () {
  var ICON = { who: 'fox_happy.png', what: 'p_umb.png', where: 'p_leaf.png', mood: 'p_cloud.png', style: 'p_palette.png', space: 'p_doc.png', cam: 'p_tablet.png', text: 'p_book.png' };
  var PREV = {
    style: { '수채화': 'cover.jpg', '색연필': 'style_pencil_ko.jpg', '크레파스': 'style_crayon.jpg', '종이 콜라주': 'style_collage.jpg', '점토': 'style_clay.jpg', '판화': 'style_linocut_ko.jpg' },
    space: { '아래': 'v3/mm/sp_bottom.jpg', '위': 'v3/mm/sp_top.jpg', '왼쪽': 'v3/mm/sp_left.jpg', '오른쪽': 'v3/mm/sp_left.jpg', '표지': 'v3/mm/sp_cover.jpg' },
    cam: { '멀리서 전신': 'v3/mm/cam_far.jpg', '가까이 얼굴': 'v3/mm/cam_close.jpg', '위에서': 'v3/mm/cam_top.jpg' },
    mood: { '포근한': 'v3/mm/mood_cozy.jpg', '두근두근': 'v3/mm/mood_tense.jpg', '신나는': 'v3/mm/mood_happy.jpg' }
  };
  document.querySelectorAll('.bld').forEach(function (el) {
    el.querySelectorAll('.bf').forEach(function (bf) {
      var k = bf.dataset.k, h = bf.querySelector('.bf-h b');
      if (ICON[k] && h) { var im = document.createElement('img'); im.src = 'theme/' + ICON[k]; im.className = 'bf-ic'; im.alt = ''; im.setAttribute('data-nozoom', ''); h.parentNode.insertBefore(im, h); }
    });
    if (el.dataset.kind === 'meta') return;
    var r = el.querySelector('.bld-r'), fig = document.createElement('figure'); fig.className = 'bld-prev';
    fig.innerHTML = '<img alt="" data-nozoom><figcaption>이런 그림이 나와요 · 실제 Magic Media 결과</figcaption>';
    r.insertBefore(fig, r.firstChild);
    var img = fig.querySelector('img');
    function setPrev(src) { if (!src) return; fig.classList.remove('on'); img.onload = function () { fig.classList.add('on'); }; img.src = 'theme/' + src; }
    setPrev('v3/mm/mood_cozy.jpg');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.bf-c button'); if (!b) { if (e.target.closest('.bb-ex')) setPrev('v3/mm/sp_bottom.jpg'); return; }
      var k = b.closest('.bf').dataset.k, label = b.textContent;
      if (PREV[k] && PREV[k][label]) setPrev(PREV[k][label]);
      /* 낱말이 오른쪽 요청문으로 날아가요 */
      if (document.body.classList.contains('lite')) return;
      var from = b.getBoundingClientRect(), to = el.querySelector('.bld-out').getBoundingClientRect();
      var fly = document.createElement('span'); fly.className = 'bld-fly bk-' + k; fly.textContent = label; document.body.appendChild(fly);
      fly.style.left = from.left + 'px'; fly.style.top = from.top + 'px';
      requestAnimationFrame(function () { fly.style.transform = 'translate(' + (to.left + to.width / 2 - from.left) + 'px,' + (to.top + 20 - from.top) + 'px) scale(.6)'; fly.style.opacity = '0'; });
      setTimeout(function () { fly.remove(); }, 900);
      setTimeout(function () { var m = el.querySelector('.bld-out mark.bk-' + k); if (m) { m.classList.remove('flash'); void m.offsetWidth; m.classList.add('flash'); } }, 650);
    }, true);
    el.querySelector('.bb-copy').addEventListener('click', function () { var o = el.querySelector('.bld-out'); o.classList.remove('copied'); void o.offsetWidth; o.classList.add('copied'); });
  });
})();

/* 누를 때마다 하나씩: 카드·단계·이정표·그림·표 줄이 → 키(또는 클릭)마다 차례로 나와요 */
(function () {
  if (document.body.dataset.mode === 'read' && !/mode=present/.test(location.search)) { /* 읽기 모드도 엔진이 .step을 다 보여 줘요 */ }
  var ALL = new URLSearchParams(location.search).get('steps') === 'all';
  var SEL = '.rte-in, .pts > .it, .stp:not(.vert) > .it, .flw > .it, .ckl > .it, .gal > li, .tbl tbody tr, .sts > li, .doc .dl, .ba > .ba-p, .ba > .ba-arr';
  document.querySelectorAll('.slide').forEach(function (s) {
    if (s.classList.contains('g-prac') || s.querySelector('.tour, .tpx, .bld, .pcx, .spk, .qz')) return;
    var els = Array.prototype.filter.call(s.querySelectorAll(SEL), function (el) { return !el.closest('.cht') && !el.classList.contains('step'); });
    if (els.length < 2) return;
    var act = s.classList.contains('active');
    els.forEach(function (el) { el.classList.add('step', 'v3s'); if (ALL || act) el.classList.add('on'); });
    var tip = s.querySelector('.rfoot .tipc');
    if (tip) { tip.classList.add('step', 'v3s'); if (ALL || act) tip.classList.add('on'); }
  });
})();

/* 다리 장: 여우가 말풍선으로 말해요. 들어오면 첫 풍선, 누를 때마다 다음 풍선이 타이핑돼요 */
(function () {
  var ALL = new URLSearchParams(location.search).get('steps') === 'all';
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function type(b) {
    var t = b.querySelector('.tk-t'); if (!t) return;
    if (!t.dataset.h) t.dataset.h = t.innerHTML;
    var txt = t.textContent, fox = b.parentNode.querySelector('.tk-fox');
    clearInterval(t._iv);
    if (ALL || document.body.classList.contains('lite')) { t.innerHTML = t.dataset.h; t.classList.add('go'); return; }
    var i = 0; if (fox) fox.classList.add('talking');
    t.innerHTML = '<span class="tk-h">' + esc(txt) + '</span>'; t.classList.add('go');
    t._iv = setInterval(function () {
      i += 1;
      if (i >= txt.length) { clearInterval(t._iv); t.innerHTML = t.dataset.h; if (fox) fox.classList.remove('talking'); return; }
      t.innerHTML = '<span class="tk-v">' + esc(txt.slice(0, i)) + '</span><span class="tk-h">' + esc(txt.slice(i)) + '</span>';
    }, 55);
  }
  function show(b) { var t = b.querySelector('.tk-t'); if (!t) return; clearInterval(t._iv); if (t.dataset.h) t.innerHTML = t.dataset.h; t.classList.add('go'); }
  function reset(b) { var t = b.querySelector('.tk-t'); if (!t) return; clearInterval(t._iv); t.classList.remove('go'); }
  document.addEventListener('slide:enter', function (e) {
    var s = e.detail.slide; if (!s || !s.querySelector('.brg.talk')) return;
    var bs = s.querySelectorAll('.brg.talk .tk-b');
    if (e.detail.back || ALL || document.body.classList.contains('lite')) { bs.forEach(show); return; }
    bs.forEach(reset); setTimeout(function () { type(bs[0]); }, 350);
  });
  document.addEventListener('step:on', function (e) { var el = e.detail.el; if (el && el.classList.contains('tk-b')) type(el); });
  document.addEventListener('step:off', function (e) { var el = e.detail.el; if (el && el.classList.contains('tk-b')) reset(el); });
  var first = document.querySelector('.slide.active .brg.talk .tk-b'); if (first) type(first);
})();

/* 하나씩 나오는 장: 다 나오기 전에는 카드·그림·표를 눌러도 설명/확대 대신 다음 것이 나와요 */
(function () {
  window.addEventListener('click', function (e) {
    if (document.body.dataset.mode !== 'present') return;
    var sl = document.querySelector('.slide.active'); if (!sl || !sl.querySelector('.v3s:not(.on)')) return;
    var t = e.target; if (!t.closest || !sl.contains(t)) return;
    if (!t.closest('.v3s, .tblw, .rbody')) return;
    if (t.closest('button, a, input, video')) return;
    e.stopPropagation(); e.preventDefault();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  }, true);
})();

/* 따라 그린 움직이는 안내: 왼쪽 단계에 맞춰 그 동작만 재생해요 */
(function () {
  document.querySelectorAll('.tour.demo').forEach(function (tour) {
    var dm = tour.querySelector('.dm'); if (!dm) return;
    function sync() { var t = tour.querySelector('.tt.cur'); dm.dataset.st = String((t ? +t.dataset.k : 0) + (+dm.dataset.off || 0)); dm.classList.remove('go'); void dm.offsetWidth; dm.classList.add('go'); }
    new MutationObserver(function (r) { if (r.some(function (x) { return x.target.classList && x.target.classList.contains('tt'); })) sync(); }).observe(tour, { subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('slide:enter', function (e) { if (e.detail.slide && e.detail.slide.contains(tour)) setTimeout(sync, 300); });
    sync();
    tour.addEventListener('click', function (e) { var t = e.target.closest('.tt'); if (t && t.classList.contains('cur')) setTimeout(sync, 0); });
  });
})();

/* 점검용: 주소에 dmst=번호를 붙이면 그 단계 안내를 바로 띄워요 */
(function () {
  var k = new URLSearchParams(location.search).get('dmst'); if (k == null) return;
  setTimeout(function () { var s = document.querySelector('.slide.active'), t = s && s.querySelectorAll('.tt')[+k]; if (t) t.click(); }, 600);
})();

/* 따라 그린 Canva 화면(mock): 카드의 mock 자료로 화면을 그리고, 왼쪽 단계마다 그 동작만 재생해요 */
(function () {
  var ALL = new URLSearchParams(location.search).get('steps') === 'all';
  document.querySelectorAll('.tour.mock').forEach(function (tour) {
    var mk = tour.querySelector('.mk'); if (!mk) return;
    var S; try { S = JSON.parse(mk.dataset.spec); } catch (err) { return; }
    var E = {}, timers = [], curPos = [60, 60], scene = null;
    function kc(k) { return (k || '').split(' ').filter(Boolean).map(function (x) { return x === 'on' ? x : 'k-' + x; }).join(' '); }
    /* cam: 화면을 다가가 보는 층 (fix 요소는 그대로) */
    var cam = document.createElement('div'); cam.className = 'mk-cam'; mk.appendChild(cam);
    S.els.forEach(function (o) {
      var d = document.createElement('div'); d.className = 'mke ' + kc(o.k);
      d.style.cssText = 'left:' + o.x + '%;top:' + o.y + '%;width:' + o.w + '%;height:' + o.h + '%' + (o.css ? ';' + o.css : '');
      if (o.img) { var im = document.createElement('img'); im.src = 'theme/' + o.img; im.alt = ''; im.setAttribute('data-nozoom', ''); d.appendChild(im); }
      if (o.t != null) { var sp = document.createElement('span'); sp.className = 'mkt'; sp.textContent = o.t; d.appendChild(sp); }
      d._o = o; E[o.id] = d; (o.fix ? mk : cam).appendChild(d);
    });
    var cur = document.createElement('div'); cur.className = 'mk-cur'; cur.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 2l7 19 3-8 8-3z" fill="#1F2733" stroke="#fff" stroke-width="1.5"/></svg>'; cam.appendChild(cur);
    var tap = document.createElement('i'); tap.className = 'mk-tap'; cam.appendChild(tap);
    function ctr(id) { if (Array.isArray(id)) return id; var o = E[id] && E[id]._o; if (!o) return curPos; var cx = o.cx != null ? o.cx : 50, cy = o.cy != null ? o.cy : 50; return [o.x + o.w * cx / 100, o.y + o.h * cy / 100]; }
    function setCur(p) { curPos = p; cur.style.left = p[0] + '%'; cur.style.top = p[1] + '%'; }
    function setScene(n) { scene = n; S.els.forEach(function (o) { if (o.sc) E[o.id].classList.toggle('scoff', o.sc !== n); }); }
    function reset() {
      timers.forEach(clearTimeout); timers = [];
      S.els.forEach(function (o) { var d = E[o.id]; d.className = 'mke ' + kc(o.k) + (o.hide ? ' off' : ''); d.style.left = o.x + '%'; d.style.top = o.y + '%'; d.style.width = o.w + '%'; d.style.height = o.h + '%'; var sp = d.querySelector('.mkt'); if (sp) sp.textContent = o.t; });
      setScene(S.sc0 || null); setCur(S.cur0 || [60, 62]); tap.classList.remove('go'); cam.style.transform = '';
    }
    function at(t, f) { timers.push(setTimeout(f, t)); }
    /* 동작 하나: 걸리는 시간을 돌려줘요 */
    function act(a, now, t) {
      var op = a[0], id = a[1], d = E[id];
      var run = function (f) { if (now) f(); else at(t, f); };
      switch (op) {
        case 'move': run(function () { setCur(ctr(id)); }); return 800;
        case 'tap': case 'rtap':
          run(function () { setCur(ctr(id)); });
          if (!now) at(t + 760, function () { var p = ctr(id); tap.style.left = p[0] + '%'; tap.style.top = p[1] + '%'; tap.className = 'mk-tap'; void tap.offsetWidth; tap.className = 'mk-tap go' + (op === 'rtap' ? ' r' : ''); });
          run(function () { if (d) d.classList.add('on'); }); if (!now) { timers.pop(); at(t + 820, function () { if (d) d.classList.add('on'); }); }
          return 1250;
        case 'show': a.slice(1).forEach(function (x) { run(function () { E[x].classList.remove('off'); }); }); return 450;
        case 'hide': a.slice(1).forEach(function (x) { run(function () { E[x].classList.add('off'); }); }); return 350;
        case 'on': a.slice(1).forEach(function (x) { run(function () { E[x].classList.add('on'); }); }); return 300;
        case 'off': a.slice(1).forEach(function (x) { run(function () { E[x].classList.remove('on'); }); }); return 200;
        case 'hl': a.slice(1).forEach(function (x) { run(function () { E[x].classList.add('hl'); }); }); return 500;
        case 'unhl': a.slice(1).forEach(function (x) { run(function () { E[x].classList.remove('hl'); }); }); return 100;
        case 'cls': run(function () { d.classList.add(a[2]); }); return a[3] || 600;
        case 'uncls': run(function () { d.classList.remove(a[2]); }); return 100;
        case 'sc': run(function () { setScene(id); }); return 500;
        case 'to': run(function () { var r = a[2]; ['x', 'y', 'w', 'h'].forEach(function (k, i) { if (r[k] != null) d.style[['left', 'top', 'width', 'height'][i]] = r[k] + '%'; }); d._o2 = r; }); return a[3] || 900;
        case 'drag': /* 커서가 요소를 잡고 함께 옮겨요 */
          run(function () { setCur(ctr(id)); });
          run(function () { d.classList.add('lift'); }); if (!now) { timers.pop(); at(t + 800, function () { d.classList.add('lift'); }); }
          var r = a[2];
          var go = function () { ['x', 'y'].forEach(function (k, i) { if (r[k] != null) d.style[['left', 'top'][i]] = r[k] + '%'; }); var o = d._o; setCur([(r.x != null ? r.x : o.x) + o.w / 2, (r.y != null ? r.y : o.y) + o.h / 2]); };
          if (now) { go(); d.classList.remove('lift'); } else { at(t + 950, go); at(t + 1950, function () { d.classList.remove('lift'); }); }
          return 2100;
        case 'type':
          var txt = a[2];
          if (now) { d.querySelector('.mkt').textContent = txt; return 0; }
          for (var i = 0; i <= txt.length; i++) (function (i) { at(t + i * 70, function () { d.querySelector('.mkt').textContent = txt.slice(0, i); }); })(i);
          return txt.length * 70 + 300;
        case 'cam': run(function () { if (!id) { cam.style.transform = ''; return; } cam.style.transformOrigin = id[0] + '% ' + id[1] + '%'; cam.style.transform = 'scale(' + id[2] + ')'; }); return 1100;
        case 'wait': return id || 500;
      }
      return 0;
    }
    function run(k) {
      reset(); mk.classList.add('noanim');
      for (var i = 0; i < k && i < S.steps.length; i++) S.steps[i].forEach(function (a) { act(a, true, 0); });
      void mk.offsetWidth; mk.classList.remove('noanim');
      var steps = S.steps[k] || [];
      if (ALL || document.body.classList.contains('lite')) { mk.classList.add('noanim'); steps.forEach(function (a) { act(a, true, 0); }); return; }
      var t = 350; steps.forEach(function (a) { t += act(a, false, t); });
    }
    function sync() { var tt = tour.querySelector('.tt.cur'); run(tt ? +tt.dataset.k : 0); }
    new MutationObserver(function (r) { if (r.some(function (x) { return x.target.classList && x.target.classList.contains('tt'); })) sync(); }).observe(tour, { subtree: true, attributes: true, attributeFilter: ['class'] });
    tour.addEventListener('click', function (e) { var t = e.target.closest('.tt'); if (t && t.classList.contains('cur')) setTimeout(sync, 0); });
    document.addEventListener('slide:enter', function (e) { if (e.detail.slide && e.detail.slide.contains(tour)) setTimeout(sync, 300); });
    /* 실제 화면 보기 */
    var real = tour.querySelector('.mk-real');
    if (real) real.addEventListener('click', function (e) {
      e.stopPropagation(); var tt = tour.querySelector('.tt.cur'), src = tt && tt.dataset.real;
      if (!src) return; var box = document.createElement('div'); box.className = 'mk-pop'; box.innerHTML = '<img src="theme/' + src + '" alt="실제 Canva 화면"><small>실제 Canva 화면 · 2026.10 캡처</small>';
      box.addEventListener('click', function () { box.remove(); }); document.body.appendChild(box);
      document.addEventListener('keydown', function kd(ev) { box.remove(); document.removeEventListener('keydown', kd, true); ev.stopPropagation(); }, true);
    });
    sync();
  });
})();
