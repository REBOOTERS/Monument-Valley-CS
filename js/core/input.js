/* ============================================================
   指针输入：把 pointerdown/move/up/cancel 归一为画布坐标回调
   （相对 #app 的 CSS 像素），并处理拖拽时的 setPointerCapture
   （移出画布不丢事件）。什么是拖拽、什么是点选由上层语义决定。
   ============================================================ */
export function attachInput(canvas, view, handlers) {
  const toPos = e => ({ x: e.clientX - view.left, y: e.clientY - view.top });
  canvas.addEventListener('pointerdown', e => { if (handlers.down) handlers.down(toPos(e), e); });
  canvas.addEventListener('pointermove', e => { if (handlers.move) handlers.move(toPos(e), e); });
  canvas.addEventListener('pointerup', e => { if (handlers.up) handlers.up(toPos(e), e); });
  canvas.addEventListener('pointercancel', e => { if (handlers.cancel) handlers.cancel(e); });
}
