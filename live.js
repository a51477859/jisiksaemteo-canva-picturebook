/* 장면 상호작용: 실시간 게시판 · 실시간 투표 · 마우스 올리면 상세 설명 · 눌러서 뒤집는 카드 */
(function () {
  'use strict';
  var API = '/api';
  var body = document.body;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function toast(m) { if (window.KIT && KIT.toast) KIT.toast(m); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pin() { try { return localStorage.getItem('ez-pin') || sessionStorage.getItem('ez-pin') || ''; } catch (e) { return ''; } }
  function voter() {
    var v = null; try { v = localStorage.getItem('ez-voter'); } catch (e) {}
    if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); try { localStorage.setItem('ez-voter', v); } catch (e) {} }
    return v;
  }
  function req(path, data) {
    return fetch(API + path, data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : { cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); });
  }
  function visible(sl) { return body.dataset.mode === 'present' ? sl.classList.contains('active') : (function () { var r = sl.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })(); }

  /* ---------- 실시간 게시판 ---------- */
  $$('.lv').forEach(function (lv) {
    var room = lv.dataset.room, board = $('.lv-board', lv), n = $('.lv-n', lv), last = 0, count = 0, sl = lv.closest('.slide');
    var shown = {};
    function add(it) {
      if (shown[it.id]) return; shown[it.id] = 1;
      var em = $('.lv-empty', board); if (em) em.remove();
      var li = document.createElement('li'); li.dataset.id = it.id;
      li.innerHTML = esc(it.text) + '<button type="button" class="x" title="이 글 숨기기">×</button>';
      board.insertBefore(li, board.firstChild);
      count++; n.textContent = count;
    }
    function pull() {
      if (!visible(sl)) return;
      req('/live?room=' + room + '&since=' + last).then(function (j) {
        (j.items || []).forEach(add); last = j.last || last;
        (j.gone || []).forEach(function (id) { var li = $('li[data-id="' + id + '"]', board); if (li) { li.remove(); count--; n.textContent = count; } });
      }).catch(function () {});
    }
    pull(); setInterval(pull, 2500);
    $('.lv-f', lv).addEventListener('submit', function (e) {
      e.preventDefault(); e.stopPropagation();
      var inp = $('input', lv), t = inp.value.trim(); if (!t) return;
      inp.disabled = true;
      req('/live', { room: room, text: t }).then(function () { inp.value = ''; toast('올렸어요'); pull(); })
        .catch(function (err) { toast(err && err.error === 'slow' ? '잠시 후 다시 올려 주세요' : '올리지 못했어요 · 연결을 확인해 주세요'); })
        .then(function () { inp.disabled = false; inp.focus(); });
    });
    $('.lv-link', lv).addEventListener('click', function (e) {
      e.stopPropagation();
      var url = location.origin + location.pathname + '#' + sl.id;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast('참여 링크를 복사했어요 · 줌 채팅에 붙여 넣으세요'); }, function () { prompt('이 주소를 복사하세요', url); });
    });
    $('.lv-clear', lv).addEventListener('click', function (e) {
      e.stopPropagation();
      if (!confirm('이 게시판의 글을 모두 지울까요?')) return;
      req('/admin', { pin: pin(), action: 'clear', room: room }).then(function () { board.innerHTML = '<li class="lv-empty">첫 번째 글을 기다리는 중…</li>'; shown = {}; count = 0; n.textContent = 0; toast('모두 지웠어요'); })
        .catch(function () { toast('발표자 PIN을 다시 넣어 주세요'); });
    });
    board.addEventListener('click', function (e) {
      e.stopPropagation();
      var x = e.target.closest('.x'); if (!x || body.classList.contains('locked')) return;
      var li = x.parentNode;
      req('/admin', { pin: pin(), action: 'hide', room: room, id: li.dataset.id }).then(function () { li.remove(); count--; n.textContent = count; })
        .catch(function () { toast('발표자 PIN을 다시 넣어 주세요'); });
    });
    lv.addEventListener('keydown', function (e) { e.stopPropagation(); });
  });

  /* ---------- 실시간 투표 퀴즈 ---------- */
  $$('.qz').forEach(function (qz) {
    var room = qz.dataset.room, poll = qz.classList.contains('poll'), sl = qz.closest('.slide');
    var mineKey = 'ez-vote-' + room;
    function mine(i) { $$('.qz-o li', qz).forEach(function (li, k) { li.classList.toggle('mine', k === i); }); }
    try { var m = localStorage.getItem(mineKey); if (m !== null) mine(+m); } catch (e) {}
    function paint(counts) {
      var tot = 0; Object.keys(counts).forEach(function (k) { tot += counts[k]; });
      $$('.qz-o li', qz).forEach(function (li, k) {
        var c = counts[k] || 0;
        $('.qz-n', li).textContent = tot ? c + '명' : '';
        $('.qz-bar', li).style.width = tot ? (c / tot * 100) + '%' : '0';
      });
      var t = $('.qz-tot', qz); if (t) t.textContent = tot;
    }
    function pull() { if (poll && visible(sl)) req('/vote?room=' + room).then(function (j) { paint(j.counts || {}); }).catch(function () {}); }
    if (poll) { pull(); setInterval(pull, 3000); }
    $$('.qz-o button', qz).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var i = +b.dataset.opt; mine(i);
        try { localStorage.setItem(mineKey, i); } catch (er) {}
        if (poll) req('/vote', { room: room, opt: i, voter: voter() }).then(function () { toast('투표했어요'); pull(); }).catch(function () { toast('투표를 보내지 못했어요'); });
      });
    });
    var rs = $('.qz-reset', qz);
    if (rs) rs.addEventListener('click', function (e) {
      e.stopPropagation(); if (!confirm('이 퀴즈의 투표를 초기화할까요?')) return;
      req('/admin', { pin: pin(), action: 'reset-vote', room: room }).then(function () { paint({}); toast('초기화했어요'); }).catch(function () { toast('발표자 PIN을 다시 넣어 주세요'); });
    });
  });

  /* ---------- 눌러서 뒤집는 카드 ---------- */
  document.addEventListener('click', function (e) {
    var f = e.target.closest('.fc-in'); if (!f) return;
    e.stopPropagation(); f.parentNode.classList.toggle('on');
  }, true);

  /* ---------- 마우스를 올리면 상세 설명 ---------- */
  var pop = document.createElement('div'); pop.id = 'tipPop'; pop.setAttribute('role', 'tooltip'); body.appendChild(pop);
  var cur = null;
  function show(el) {
    cur = el; pop.textContent = el.dataset.more; pop.classList.add('on');
    var r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var x = Math.max(10, Math.min(innerWidth - pw - 10, r.left + r.width / 2 - pw / 2));
    var y = r.top - ph - 12; if (y < 10) y = r.bottom + 12;
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function hide() { cur = null; pop.classList.remove('on'); }
  document.addEventListener('mouseover', function (e) { var el = e.target.closest('[data-more]'); if (el && el !== cur) show(el); else if (!el && cur) hide(); });
  document.addEventListener('focusin', function (e) { var el = e.target.closest('[data-more]'); if (el) show(el); });
  document.addEventListener('focusout', hide);
  document.addEventListener('scroll', hide, true);
  document.addEventListener('slide:enter', hide);
  /* 터치: 한 번 누르면 설명, 다시 누르면 닫기 */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-more]'); if (!el) return;
    e.stopPropagation();
    if (cur === el && matchMedia('(hover: none)').matches) hide(); else show(el);
  }, true);
})();

/* 발표 모드: 내용이 무대보다 크면 그 장면의 글자 크기를 1px씩 줄여 맞춘다 (최소 22px) */
(function () {
  'use strict';
  function over(sl) {
    var b = sl.querySelector('.rbody'); if (!b) return false;
    return b.scrollHeight > b.clientHeight + 2 || sl.scrollHeight > sl.clientHeight + 2;
  }
  function fitAll() {
    if (document.body.dataset.mode !== 'present') {
      Array.prototype.forEach.call(document.querySelectorAll('.slide.r'), function (sl) { sl.style.fontSize = ''; });
      return;
    }
    Array.prototype.forEach.call(document.querySelectorAll('.slide.r'), function (sl) {
      sl.style.fontSize = ''; var fs = 32;
      while (fs > 22 && over(sl)) { fs--; sl.style.fontSize = fs + 'px'; }
    });
  }
  window.EZfit = fitAll;
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { setTimeout(fitAll, 50); });
  window.addEventListener('load', function () { setTimeout(fitAll, 50); });
  new MutationObserver(function () { setTimeout(fitAll, 30); }).observe(document.body, { attributes: true, attributeFilter: ['data-mode'] });
})();

/* 대화창 흉내 화면: 단계가 켜지면 입력칸에 타이핑 → 보내기 → 말풍선, 답은 점 세 개 뒤 줄마다 흘러나온다 */
(function () {
  'use strict';
  var body = document.body;
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function moving() { return body.dataset.mode === 'present' && !body.classList.contains('lite'); }
  function typeMe(me, done) {
    var w = me.closest('.cht-w'), ty = w.querySelector('.cht-ty'), send = w.querySelector('.cht-send');
    var txt = me.getAttribute('data-type') || '', i = 0;
    me.classList.add('pend'); me.classList.remove('fresh'); ty.textContent = ''; ty.classList.add('caret');
    clearInterval(me._t);
    me._t = setInterval(function () {
      i += 1; ty.textContent = txt.slice(0, i);
      if (i >= txt.length) {
        clearInterval(me._t);
        setTimeout(function () {
          send.classList.add('hit');
          setTimeout(function () {
            send.classList.remove('hit'); ty.textContent = ''; ty.classList.remove('caret');
            $$('mark', me).forEach(function (m, k) { m.style.setProperty('--m', k); });
            me.classList.remove('pend'); me.classList.add('fresh');
            if (done) done();
          }, 220);
        }, 250);
      }
    }, Math.max(28, Math.min(70, 2600 / Math.max(1, txt.length))));
  }
  function prevs(el) { var out = [], p = el.previousElementSibling; while (p) { out.push(p); p = p.previousElementSibling; } return out; }
  function play(el) {
    if (el.classList.contains('cm-new')) {
      var nb = el.closest('.cht-win').querySelector('.cht-nb');
      if (nb) { nb.classList.add('hit'); setTimeout(function () { nb.classList.remove('hit'); }, 450); }
      prevs(el).forEach(function (p) { p.classList.add('gone'); });
      return;
    }
    if (el.classList.contains('cm') && el.classList.contains('me')) return typeMe(el);
    el.classList.remove('run'); void el.offsetWidth; el.classList.add('run');
  }
  document.addEventListener('step:on', function (e) {
    var el = e.detail && e.detail.el; if (!el || !el.closest('.cht') || !moving()) return;
    play(el);
  });
  document.addEventListener('step:off', function (e) {
    var el = e.detail && e.detail.el; if (!el || !el.classList.contains('cm-new')) return;
    prevs(el).forEach(function (p) { p.classList.remove('gone'); });
  });
  /* 다시 보기: 이 장의 단계를 처음부터 차례로 */
  $$('.cht-re').forEach(function (b) {
    b.addEventListener('click', function () {
      var sl = b.closest('.slide'), steps = $$('.cht .step', sl), k = 0;
      if (!moving()) return;
      steps.forEach(function (s) { s.classList.remove('on', 'run', 'fresh', 'gone'); });
      (function next() {
        var s = steps[k++]; if (!s) return;
        s.classList.add('on'); play(s);
        var isMe = s.classList.contains('me'), wait = isMe ? (s.getAttribute('data-type') || '').length * 45 + 1100 : s.classList.contains('ai') ? s.children.length * 450 + 1200 : s.classList.contains('cm-new') ? 700 : 1200;
        setTimeout(next, wait);
      })();
    });
  });
  $$('.lk-cp').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var t = b.getAttribute('data-link') || '';
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
        b.textContent = '복사했어요'; setTimeout(function () { b.textContent = '주소 복사'; }, 1500);
        if (window.KIT && KIT.toast) KIT.toast('주소를 복사했어요 · 채팅창에 붙여 넣으세요');
      }, function () { window.prompt('이 주소를 복사하세요', t); });
    });
  });
  $$('.cht-cp').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-copy') || '';
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { if (window.KIT && KIT.toast) KIT.toast('질문을 복사했어요'); }).catch(function () {});
    });
  });
})();
