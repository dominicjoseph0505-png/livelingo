import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  Participant,
  DisconnectReason,
} from 'livekit-client';
import type { LiveKitConnectionStatus } from '../types';

export type LiveKitCallingEventHandler = (event: any) => void;

export class LiveKitCallingService {
  private room: Room | null = null;
  private connectionStatus: LiveKitConnectionStatus = 'idle';
  private remoteParticipant: RemoteParticipant | null = null;
  private eventHandlers: Map<string, Set<LiveKitCallingEventHandler>> = new Map();
  private isAutoplayBlocked: boolean = false;
  private blockedAudioElements: HTMLAudioElement[] = [];

  public getStatus(): LiveKitConnectionStatus {
    return this.connectionStatus;
  }

  public getRemoteParticipant(): RemoteParticipant | null {
    return this.remoteParticipant;
  }

  public isAutoplayRestricted(): boolean {
    return this.isAutoplayBlocked;
  }

  public on(event: string, handler: LiveKitCallingEventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler: LiveKitCallingEventHandler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(data);
        } catch (e) {
          console.error(`[LiveKitCallingService] Error in handler for ${event}:`, e);
        }
      });
    }
  }

  /**
   * Connects to a LiveKit room using a short-lived access token and WebRTC.
   * Limits room to 2 participants, publishes local microphone, and subscribes to remote audio.
   */
  public async connectToRoom(url: string, token: string): Promise<boolean> {
    try {
      await this.disconnect();

      this.connectionStatus = 'connecting';
      this.emit('status-changed', { status: 'connecting' });

      // Initialize Room with optimal WebRTC audio configurations
      this.room = new Room({
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        adaptiveStream: true,
        dynacast: true,
      });

      this.setupRoomEventListeners(this.room);

      // Connect to LiveKit WebRTC server
      await this.room.connect(url, token);

      this.connectionStatus = 'connected';
      this.emit('status-changed', { status: 'connected', room: this.room });

      // Check existing participants in room (if partner arrived first)
      if (this.room.remoteParticipants.size > 0) {
        const firstPeer = Array.from(this.room.remoteParticipants.values())[0];
        this.remoteParticipant = firstPeer;
        this.emit('participant-connected', firstPeer);
      }

      // Automatically publish local microphone
      await this.publishMicrophone();

      return true;
    } catch (error: any) {
      console.error('[LiveKitCallingService] Connection failed:', error);
      this.connectionStatus = 'error';
      this.emit('status-changed', { status: 'error', error: error.message || 'Connection failed' });
      this.handleConnectionError(error);
      return false;
    }
  }

  /**
   * Publishes the local microphone audio track to the WebRTC room.
   */
  public async publishMicrophone(): Promise<boolean> {
    if (!this.room) return false;

    try {
      await this.room.localParticipant.setMicrophoneEnabled(true);
      this.emit('mic-state-changed', { isMuted: false });
      return true;
    } catch (err: any) {
      console.warn('[LiveKitCallingService] Failed to enable microphone:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.emit('permission-denied', {
          message: 'Microphone permission was denied by the browser.',
        });
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        this.emit('missing-microphone', {
          message: 'No microphone input hardware was detected on this device.',
        });
      } else {
        this.emit('media-error', { error: err.message });
      }
      return false;
    }
  }

  /**
   * Toggles local microphone mute state.
   */
  public async setMicrophoneMuted(muted: boolean): Promise<boolean> {
    if (!this.room) return false;

    try {
      await this.room.localParticipant.setMicrophoneEnabled(!muted);
      this.emit('mic-state-changed', { isMuted: muted });
      return true;
    } catch (err: any) {
      console.warn('[LiveKitCallingService] Mute toggle error:', err);
      return false;
    }
  }

  /**
   * Attempts to play any audio elements that were blocked by browser autoplay policy.
   * Triggered by user interaction click.
   */
  public async resumeAutoplayAudio(): Promise<boolean> {
    if (this.blockedAudioElements.length === 0) {
      this.isAutoplayBlocked = false;
      this.emit('autoplay-resolved');
      return true;
    }

    try {
      const promises = this.blockedAudioElements.map((el) => el.play());
      await Promise.all(promises);
      this.blockedAudioElements = [];
      this.isAutoplayBlocked = false;
      this.emit('autoplay-resolved');
      return true;
    } catch (err) {
      console.warn('[LiveKitCallingService] Autoplay resume failed:', err);
      return false;
    }
  }

  private setupRoomEventListeners(room: Room) {
    // Reconnecting state
    room.on(RoomEvent.Reconnecting, () => {
      this.connectionStatus = 'reconnecting';
      this.emit('status-changed', { status: 'reconnecting' });
    });

    // Reconnected
    room.on(RoomEvent.Reconnected, () => {
      this.connectionStatus = 'connected';
      this.emit('status-changed', { status: 'connected' });
    });

    // Disconnected
    room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      this.connectionStatus = 'disconnected';
      this.remoteParticipant = null;
      this.emit('status-changed', { status: 'disconnected', reason });
      this.cleanupMediaElements();
    });

    // Remote participant joined (strictly 2-participant room)
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (this.remoteParticipant && this.remoteParticipant.identity !== participant.identity) {
        console.warn('[LiveKitCallingService] Extra participant joined 2-person room limit.');
      } else {
        this.remoteParticipant = participant;
        this.emit('participant-connected', participant);
      }
    });

    // Remote participant left
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (this.remoteParticipant?.identity === participant.identity) {
        this.remoteParticipant = null;
        this.emit('participant-disconnected', participant);
        this.cleanupMediaElements();
      }
    });

    // Remote audio track subscribed -> Attach audio element
    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          audioElement.setAttribute('data-livekit-audio', 'true');
          audioElement.setAttribute('data-participant', participant.identity);
          document.body.appendChild(audioElement);

          // Handle browser autoplay policy restrictions
          audioElement.play().catch((playError: any) => {
            if (playError.name === 'NotAllowedError') {
              this.isAutoplayBlocked = true;
              this.blockedAudioElements.push(audioElement);
              this.emit('autoplay-blocked', {
                message: 'Browser autoplay blocked incoming audio. Click to allow sound.',
              });
            }
          });

          this.emit('remote-audio-started', { participant, track });
        }
      }
    );

    // Remote audio track unsubscribed -> Detach element
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      const detachedElements = track.detach();
      detachedElements.forEach((el) => {
        el.remove();
      });
      this.emit('remote-audio-stopped', { track });
    });

    // Active speakers changed
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      const isRemoteSpeaking = speakers.some((s) => s.identity === this.remoteParticipant?.identity);
      const isLocalSpeaking = speakers.some((s) => s.identity === room.localParticipant.identity);

      this.emit('active-speakers', {
        isRemoteSpeaking,
        isLocalSpeaking,
        speakers,
      });
    });
  }

  private handleConnectionError(error: any) {
    if (error.message?.includes('could not find room') || error.message?.includes('room not found')) {
      this.emit('error', { type: 'room-not-found', message: 'The specified call room was not found.' });
    } else if (error.message?.includes('token')) {
      this.emit('error', { type: 'invalid-token', message: 'Call access token is invalid or expired.' });
    } else {
      this.emit('error', { type: 'network-error', message: error.message || 'Network connection failed.' });
    }
  }

  private cleanupMediaElements() {
    const audioElements = document.querySelectorAll('[data-livekit-audio]');
    audioElements.forEach((el) => {
      try {
        (el as HTMLAudioElement).pause();
        el.remove();
      } catch {
        // Ignore
      }
    });
    this.blockedAudioElements = [];
    this.isAutoplayBlocked = false;
  }

  /**
   * Complete teardown: leaves the room, stops local tracks, and detaches remote audio elements.
   */
  public async disconnect() {
    this.cleanupMediaElements();

    if (this.room) {
      try {
        // Stop local microphone tracks
        this.room.localParticipant.audioTrackPublications.forEach((pub) => {
          try {
            pub.track?.stop();
          } catch {
            // Ignore
          }
        });

        await this.room.disconnect();
      } catch (err) {
        console.warn('[LiveKitCallingService] Disconnect warning:', err);
      } finally {
        this.room.removeAllListeners();
        this.room = null;
      }
    }

    this.remoteParticipant = null;
    this.connectionStatus = 'disconnected';
    this.emit('status-changed', { status: 'disconnected' });
  }
}

export const livekitCallingService = new LiveKitCallingService();
