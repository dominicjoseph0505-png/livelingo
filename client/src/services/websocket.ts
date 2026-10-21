export type SignalingEventHandler = (event: any) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private eventHandlers: Map<string, Set<SignalingEventHandler>> = new Map();
  private isConnecting: boolean = false;
  private reconnectTimer: any = null;

  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use window.location.host (handled by Vite proxy in dev) or fallback
    this.url = `${protocol}//${window.location.host}/ws`;
  }

  public getIsConnecting(): boolean {
    return this.isConnecting;
  }

  public connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.emit('connected', {});
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit(data.type, data);
          } catch (err) {
            console.error('[SignalingClient] Parse error:', err);
          }
        };

        this.ws.onerror = (err) => {
          console.warn('[SignalingClient] Socket error:', err);
          this.emit('error', err);
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.emit('disconnected', {});
        };
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  public on(event: string, handler: SignalingEventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler: SignalingEventHandler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(data);
        } catch (e) {
          console.error(`[SignalingClient] Error in handler for ${event}:`, e);
        }
      });
    }
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[SignalingClient] Socket not open, message queued or skipped', data);
    }
  }

  public joinRoom(roomId: string, participantId: string, participantName: string, preferredLanguage: string) {
    this.send({
      type: 'join-room',
      roomId,
      participantId,
      participantName,
      preferredLanguage,
    });
  }

  public sendSpeechInput(text: string, sourceLang: string, isFinal: boolean = true) {
    this.send({
      type: 'speech-input',
      text,
      sourceLang,
      isFinal,
    });
  }

  public sendSpeakingState(isSpeaking: boolean) {
    this.send({
      type: 'speaking-state',
      isSpeaking,
    });
  }

  public sendMediaToggle(isMuted?: boolean, isDeafened?: boolean) {
    this.send({
      type: 'media-toggle',
      isMuted,
      isDeafened,
    });
  }

  public sendEndCall() {
    this.send({
      type: 'end-call',
    });
  }

  public disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const signalingClient = new SignalingClient();
