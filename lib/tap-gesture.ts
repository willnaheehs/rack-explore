type PointerSample = {
  pointerId: number;
  clientX: number;
  clientY: number;
  pointerType: string;
  button?: number;
};

// A pinch, pan, long press or cancelled touch must never select hardware.
export function createTapGesture() {
  const active = new Set<number>();
  let candidate: (PointerSample & { started: number }) | null = null;
  const move = (event: PointerSample) => {
    if (candidate?.pointerId !== event.pointerId) return;
    const tolerance = event.pointerType === 'touch' ? 10 : 5;
    if (
      Math.hypot(
        event.clientX - candidate.clientX,
        event.clientY - candidate.clientY,
      ) > tolerance
    )
      candidate = null;
  };
  return {
    start(event: PointerSample, now: number) {
      active.add(event.pointerId);
      candidate =
        active.size === 1 && (event.button ?? 0) === 0
          ? {
              pointerId: event.pointerId,
              clientX: event.clientX,
              clientY: event.clientY,
              pointerType: event.pointerType,
              started: now,
            }
          : null;
    },
    move,
    end(event: PointerSample, now: number) {
      move(event);
      const tap =
        active.size === 1 &&
        candidate?.pointerId === event.pointerId &&
        now - candidate.started < 800;
      active.delete(event.pointerId);
      candidate = null;
      return tap;
    },
    cancel: (event: PointerSample) => {
      active.delete(event.pointerId);
      candidate = null;
    },
  };
}
