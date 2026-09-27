/** Browser-Aufnahme als vollständige WAV-Datei (nur im Speicher, kein Upload ohne Nutzeraktion). */
export function encodeWav(chunks: readonly Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new ArrayBuffer(44 + length * 2);
  const view = new DataView(bytes);
  const tag = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  for (const chunk of chunks)
    for (const value of chunk) {
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(offset, sample * (sample < 0 ? 32768 : 32767), true);
      offset += 2;
    }
  return new Blob([bytes], { type: "audio/wav" });
}

export async function recordWav(onLevel?: (level: number) => void): Promise<{ stop: () => Promise<File>; cancel: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let context: AudioContext | undefined;
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    // 16 kHz reicht für Sprache und hält die Datei klein.
    try {
      context = new Ctx({ sampleRate: 16000 });
    } catch {
      context = new Ctx();
    }
    await context.resume();
    const audioContext = context;
    const source = audioContext.createMediaStreamSource(stream);
    const node = audioContext.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    node.onaudioprocess = (event) => {
      const data = event.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(data));
      if (onLevel) {
        let peak = 0;
        for (let i = 0; i < data.length; i += 64) peak = Math.max(peak, Math.abs(data[i]!));
        onLevel(peak);
      }
    };
    source.connect(node);
    node.connect(audioContext.destination);
    let stopped = false;
    const teardown = async () => {
      stopped = true;
      stream.getTracks().forEach((track) => track.stop());
      node.disconnect();
      source.disconnect();
      node.onaudioprocess = null;
      await audioContext.close().catch(() => undefined);
    };
    return {
      async stop() {
        if (stopped) throw new Error("Aufnahme bereits beendet");
        const sampleRate = audioContext.sampleRate;
        await teardown();
        const blob = encodeWav(chunks, sampleRate);
        chunks.length = 0;
        if (blob.size < 2048) throw new Error("Aufnahme war leer – bitte nochmal.");
        return new File([blob], "recording.wav", { type: "audio/wav" });
      },
      cancel() {
        chunks.length = 0;
        if (!stopped) void teardown();
      },
    };
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    await context?.close().catch(() => undefined);
    throw error;
  }
}
