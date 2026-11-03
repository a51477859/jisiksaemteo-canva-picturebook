/* 생성 장면 도우미: 요청문 복사 · 실습 타이머 단추 */
(function () {
  'use strict';
  function toast(m) { if (window.KIT && KIT.toast) KIT.toast(m); }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(function () { return legacy(text); });
    return legacy(text);
  }
  function legacy(text) {
    return new Promise(function (ok, no) {
      var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy') ? ok() : no(); } catch (err) { no(err); }
      t.remove();
    });
  }
  /* 엔진 타이머를 열고 n초로 맞춘 뒤 바로 시작한다 (1분 단추 + 1분·10초 더하기) */
  function setTimer(sec) {
    var tm = document.getElementById('kitTimer'); if (!tm || !window.KIT) return;
    if (tm.hidden) KIT.timer();
    var press = function (sel) { var b = tm.querySelector(sel); if (b) b.click(); };
    var m = Math.floor(sec / 60), r = sec % 60;
    if (m >= 10) { press('[data-m="10"]'); m -= 10; }
    else if (m >= 5) { press('[data-m="5"]'); m -= 5; }
    else if (m >= 3) { press('[data-m="3"]'); m -= 3; }
    else { press('[data-m="1"]'); m -= 1; }
    for (; m > 0; m--) press('[data-d="60"]');
    for (; m < 0; m++) press('[data-d="-60"]');
    for (; r >= 10; r -= 10) press('[data-d="10"]');
    press('[data-a="go"]');
    toast('실습 타이머를 시작했어요');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    var ta = b && b.parentNode.querySelector('textarea');
    if (b && ta) {
      e.stopPropagation();
      copy(ta.value).then(function () { toast('요청문을 복사했어요 · 줌 채팅에 붙여 넣으세요'); }, function () { toast('복사가 막혔어요 · 읽기 모드에서 전문을 직접 고르세요'); });
      return;
    }
    var t = e.target.closest('[data-timer]');
    if (t) { e.stopPropagation(); setTimer(+t.dataset.timer); }
  }, true);
})();
