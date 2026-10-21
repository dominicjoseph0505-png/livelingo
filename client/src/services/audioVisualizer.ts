export class MicrophoneAudioVisualizer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphoneStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;

  public async start(onLevelUpdate: (level: number, frequencyData: Uint8Array) => void): Promise<boolean> {
    try {
      this.stop();

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;

      this.audioContext = new AudioCtx();
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.sourceNode = this.audioContext.createMediaStreamSource(this.microphoneStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;

      this.sourceNode.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.isRunning = true;

      const updateLoop = () => {
        if (!this.isRunning || !this.analyser) return;

        this.analyser.getByteFrequencyData(dataArray);

        // Calculate average level 0 - 100
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = Math.min(100, Math.round((sum / bufferLength / 255) * 100));

        onLevelUpdate(average, dataArray);
        this.animationFrameId = requestAnimationFrame(updateLoop);
      };

      this.animationFrameId = requestAnimationFrame(updateLoop);
      return true;
    } catch (err) {
      console.warn('[MicrophoneAudioVisualizer] Mic access failed or denied:', err);
      return false;
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      this.microphoneStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  public isCapturing(): boolean {
    return this.isRunning;
  }
}
