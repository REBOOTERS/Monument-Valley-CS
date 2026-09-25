/* ============================================================
   UI：操作提示（12s 真实时间自动隐藏的显隐闩——低帧率下用未钳制
   的 dtRaw 累加，不被拖慢）、章节标题、圆形按钮的键盘可达性。
   ============================================================ */
export function createUi() {
  const hintEl = document.getElementById('hint');
  const chapterEl = document.getElementById('chapter');
  const HINT_TEXT = hintEl ? hintEl.textContent : '';
  let hintHidden = false, levelT = 0;

  function hide() {
    if (hintHidden || !hintEl) return;
    hintHidden = true;
    hintEl.style.opacity = 0;
  }
  function show() {
    if (!hintEl) return;
    hintHidden = false;
    hintEl.style.opacity = 1;
  }
  function setText(t) { if (hintEl) hintEl.textContent = t; }

  function tick(dtRaw) {
    levelT += dtRaw;
    if (!hintHidden && levelT > 12) hide();
  }
  function reset() {
    levelT = 0;
    if (hintEl) hintEl.textContent = HINT_TEXT;
    show();
  }
  // WebGL 上下文恢复后：撤销丢失提示，并按 levelT 恢复应显/应隐状态
  function afterContextRestore() {
    if (hintEl) hintEl.textContent = HINT_TEXT;
    if (levelT > 12) hide(); else show();
  }

  function showChapter() { if (chapterEl) chapterEl.style.opacity = 1; }
  function hideChapter() { if (chapterEl) chapterEl.style.opacity = 0; }

  // 圆形按钮：click + Enter/Space 键触发（a11y）
  function bindButton(el, fn) {
    el.addEventListener('click', fn);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    });
  }

  return { hide, show, setText, tick, reset, afterContextRestore, showChapter, hideChapter, bindButton };
}
