let audioContext: AudioContext | null = null;

function playNotes(notes: number[], duration: number, volume: number) {
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return;

  audioContext ??= new AudioContextConstructor();
  if (audioContext.state === "suspended") void audioContext.resume();

  const start = audioContext.currentTime;
  notes.forEach((frequency, index) => {
    const oscillator = audioContext!.createOscillator();
    const gain = audioContext!.createGain();
    const noteStart = start + index * duration * 0.72;
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0, noteStart);
    gain.gain.linearRampToValueAtTime(volume, noteStart + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, noteStart + duration);
    oscillator.connect(gain);
    gain.connect(audioContext!.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + duration);
  });
}

export function playExperiencePickup() {
  playNotes([740, 988], 0.12, 0.045);
}

export function playLevelUp() {
  playNotes([523, 659, 784, 1047], 0.2, 0.07);
}
