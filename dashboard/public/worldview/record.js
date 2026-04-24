// RecordController — Phase 7 stub
//
// Owns the REC button state machine. Real MediaRecorder wiring lands in
// Phase 11. For now, clicking REC just flips UI state and logs intent so
// downstream director work (Phase 8 BriefPlan schema, Phase 9 news adapter,
// Phase 10 Layer U renderers) can be developed against a visible control.
//
// State:
//   idle     - ready, not recording
//   planning - director is generating a BriefPlan (Phase 8 hookup)
//   rolling  - scene player is driving Cesium + MediaRecorder is capturing
//   encoding - handoff to NVENC sidecar (Phase 12)
//   complete - MP4 ready, awaiting publish
//
// Phase 7 only implements idle <-> rolling for visual feedback.

export class RecordController {
  constructor({ buttonEl, onStart, onStop } = {}) {
    this.buttonEl = buttonEl;
    this.state = 'idle';
    this.onStart = onStart;
    this.onStop = onStop;

    if (buttonEl) {
      buttonEl.addEventListener('click', () => this.toggle());
    }
  }

  toggle() {
    if (this.state === 'idle') this.start();
    else if (this.state === 'rolling') this.stop();
    // planning / encoding / complete are non-interactive in Phase 7
  }

  start() {
    this.state = 'rolling';
    this.buttonEl?.classList.add('recording');
    console.log('[REC] roll. Phase 7 stub, no capture yet.');
    this.onStart?.();
  }

  stop() {
    this.state = 'idle';
    this.buttonEl?.classList.remove('recording');
    console.log('[REC] cut. Phase 7 stub.');
    this.onStop?.();
  }

  // Reserved for Phase 8 director integration:
  //   await recordController.planBrief({ duration: 60, regions: ['malacca'] })
  //   -> POST /api/director
  //   -> returns BriefPlan
  //   -> sets state = 'planning' during the call

  // Reserved for Phase 11 scene player:
  //   recordController.playBrief(briefPlan)
  //   -> drives Cesium + MediaRecorder
  //   -> sets state = 'rolling'

  // Reserved for Phase 12 NVENC handoff:
  //   await recordController.encode(frames, audio)
  //   -> POST to strands-sound-studio video-encoder sidecar
  //   -> sets state = 'encoding' then 'complete'
}
