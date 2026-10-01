// Mic capture for the athlete studio: MediaRecorder for the audio, plus live speech-to-text where the
// browser offers it (Chrome, Edge, Safari). Without speech recognition the athlete types the transcript.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canTranscribe = !!SR;
export const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

function pickMime() {
  for (const t of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']) {
    try { if (MediaRecorder.isTypeSupported(t)) return t; } catch {}
  }
  return '';
}

/** Starts recording. onText(transcriptSoFar) streams live words when available.
 *  Returns { stop(): Promise<{blob, mime, duration, transcript}>, cancel() }. */
export async function startRecording({ onText } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.start(250);
  const startedAt = performance.now();

  let finalText = '';
  let interim = '';
  let sr = null;
  if (SR) {
    try {
      sr = new SR();
      sr.lang = 'en-US';
      sr.continuous = true;
      sr.interimResults = true;
      sr.onresult = (e) => {
        interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += (finalText ? ' ' : '') + r[0].transcript.trim();
          else interim += r[0].transcript;
        }
        onText && onText((finalText + ' ' + interim).trim());
      };
      sr.onerror = () => {};
      sr.start();
    } catch { sr = null; }
  }

  const release = () => stream.getTracks().forEach((t) => t.stop());

  return {
    async stop() {
      const duration = (performance.now() - startedAt) / 1000;
      const srDone = new Promise((resolve) => {
        if (!sr) return resolve();
        sr.onend = resolve;
        try { sr.stop(); } catch { resolve(); }
        setTimeout(resolve, 1500);
      });
      const recDone = new Promise((resolve) => { rec.onstop = resolve; });
      try { rec.stop(); } catch {}
      await Promise.all([recDone, srDone]);
      release();
      const transcript = (finalText + ' ' + interim).replace(/\s+/g, ' ').trim();
      return { blob: new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' }), mime: rec.mimeType || mime, duration, transcript };
    },
    cancel() {
      try { sr && sr.abort(); } catch {}
      try { rec.stop(); } catch {}
      release();
    },
  };
}

/** Dictation into a text field (one utterance), when the browser supports it. */
export function dictate(onText) {
  if (!SR) return null;
  const sr = new SR();
  sr.lang = 'en-US';
  sr.continuous = false;
  sr.interimResults = true;
  sr.onresult = (e) => onText(Array.from(e.results).map((r) => r[0].transcript).join(' ').trim(), e.results[e.results.length - 1].isFinal);
  sr.start();
  return sr;
}

export const toBase64 = (blob) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
  fr.onerror = () => reject(fr.error);
  fr.readAsDataURL(blob);
});
