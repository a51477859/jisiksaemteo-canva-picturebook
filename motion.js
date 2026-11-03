/* 모든 장면 공통 모션: 장면 전환 · 사진 걷어내기 · 카드 튀어 오르기 · 단계 등장 · 일러스트 둥실 */
(function () {
  'use strict';
  var G = window.gsap;
  if (!G) return;
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function lite() { return window.EZ && window.EZ.lite(); }
  function present() { return document.body.dataset.mode === 'present'; }

  var MEDIA = '.pic img, .gallery img, .dcard img, .kph img, .pair2 img, .pn img, .logbox img, .slot img, .boardflow img';
  var CARDS = [
    '.cards > li:not(.step)', '.kit4 > li', '.gmap > li', '.open3 > .ob', '.pn', '.dcard', '.days3 > li',
    '.ports > div', '.ipo > .box', '.sortcols > div:not(.step)', '.etym4 > li:not(.step)', '.flips > li',
    '.ezmock', '.dashmock', '.recipe', '.mcode', '.mblock', '.meter', '.ifbox', '.prog', '.roles > .role:not(.step)',
    '.chainwrap', '.grid-wrap', '.sigcode', '.sos', '.bitrow', '.literal > .lt-card:not(.step)', '.dbg', '.datas', '.obs', '.frame'
  ].join(',');
  var ART = '.art-img, .ezprog .cblk, .ph, .gauge, .jeans, .tape, .chain, .batsvg, .carriage, .gears, .graph, .rgrid, .sigbox, .ring-art';
  var BIG = '.limits b, .ladder b, .flow3 b, .flow4 b, .day4 b, .gmap b, .checks b, .kit4 > li > b, .nums b, .mission b';

  var live = new Map();
  function track(sl, t) { if (!live.has(sl)) live.set(sl, []); live.get(sl).push(t); return t; }
  function clear(sl) {
    (live.get(sl) || []).forEach(function (t) { t.kill(); });
    live.delete(sl);
  }
  function noTrans(els) { els.forEach(function (e) { e.style.transition = 'none'; }); }

  function enter(sl, back) {
    clear(sl);
    /* 이전 방문에서 남은 인라인 값 지우기 */
    var touched = $$(MEDIA + ',' + CARDS + ',' + ART + ',' + BIG + ', .step', sl);
    if (touched.length) G.set(touched, { clearProps: 'opacity,transform,clipPath,filter' });
    touched.forEach(function (e) { e.style.transition = ''; });
    if (!present() || lite()) return;

    /* 장면 들어오기: 진행 방향으로 밀려 들어온다 */
    track(sl, G.fromTo(sl, { x: back ? -70 : 70, opacity: 0 }, { x: 0, opacity: 1, duration: .55, delay: .12, ease: 'power3.out', clearProps: 'x,opacity' }));

    /* 사진: 커튼 걷히듯 열리며 살짝 줌 아웃 */
    var media = $$(MEDIA, sl).filter(function (m) { return !m.closest('.step'); });
    if (media.length) {
      noTrans(media);
      track(sl, G.fromTo(media, { clipPath: 'inset(0 100% 0 0 round 12px)', scale: 1.18 },
        { clipPath: 'inset(0 0% 0 0 round 12px)', scale: 1, duration: 1.1, ease: 'power3.out', stagger: .12, delay: .3 }));
    }

    /* 카드: 차례로 튀어 오르기 */
    var cards = $$(CARDS, sl).filter(function (c) { return !c.closest('.step') && !c.classList.contains('step'); });
    if (cards.length) {
      noTrans(cards);
      track(sl, G.fromTo(cards, { opacity: 0, y: 46, scale: .9, rotation: function () { return G.utils.random(-3, 3); } },
        { opacity: 1, y: 0, scale: 1, rotation: 0, duration: .7, ease: 'back.out(1.7)', stagger: .09, delay: .35 }));
    }

    /* 일러스트·도식: 크게 튀어나왔다가 둥실 */
    var arts = $$(ART, sl).filter(function (a) { return !a.closest('.step') && !cards.some(function (c) { return c.contains(a); }); });
    if (arts.length) {
      noTrans(arts);
      track(sl, G.fromTo(arts, { opacity: 0, scale: .7, rotation: -6 }, { opacity: 1, scale: 1, rotation: 0, duration: .9, ease: 'elastic.out(1, .7)', stagger: .12, delay: .4 }));
    }
    var floaters = $$('.art-img', sl);
    floaters.forEach(function (f, i) {
      track(sl, G.to(f, { y: -10, rotation: i % 2 ? 1.5 : -1.5, duration: 1.8 + i * .2, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.3 }));
    });

    /* 큰 번호: 회전하며 커지기 */
    var bigs = $$(BIG, sl).filter(function (b) { return !b.closest('.step'); });
    if (bigs.length) {
      noTrans(bigs);
      track(sl, G.fromTo(bigs, { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: .6, ease: 'back.out(2.4)', stagger: .08, delay: .55 }));
    }
  }

  function stepOn(el) {
    if (!present() || lite()) return;
    el.style.transition = 'none';
    G.fromTo(el, { opacity: 0, y: 40, scale: .9, rotation: G.utils.random(-2.5, 2.5) },
      { opacity: 1, y: 0, scale: 1, rotation: 0, duration: .65, ease: 'back.out(1.9)' });
    var b = el.querySelectorAll('b, img, .eb, em');
    if (b.length) G.fromTo(b, { scale: .6 }, { scale: 1, duration: .5, ease: 'back.out(3)', stagger: .05, delay: .12 });
  }
  function stepOff(el) {
    G.killTweensOf(el);
    G.set(el, { clearProps: 'opacity,transform' });
    el.style.transition = '';
  }

  document.addEventListener('slide:enter', function (e) { enter(e.detail.slide, e.detail.back); });
  document.addEventListener('step:on', function (e) { stepOn(e.detail.el); });
  document.addEventListener('step:off', function (e) { stepOff(e.detail.el); });
})();
