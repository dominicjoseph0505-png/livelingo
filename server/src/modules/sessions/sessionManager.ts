export interface Participant {
  id: string;
  name: string;
  role: 'host' | 'guest';
  preferredLanguage: string;
  isMuted: boolean;
  isDeafened: boolean;
  isConnected: boolean;
  joinedAt: string;
}

export interface TranscriptItem {
  id: string;
  senderId: string;
  senderName: string;
  originalText: string;
  originalLang: string;
  translatedText: string;
  translatedLang: string;
  timestamp: string;
  status: 'translating' | 'translated' | 'spoken';
}

export interface RoomSession {
  id: string;
  code: string;
  createdAt: string;
  status: 'waiting' | 'active' | 'ended';
  hostParticipantId: string;
  sourceLang: string;
  targetLang: string;
  participants: Record<string, Participant>;
  callStartedAt: string | null;
  callEndedAt: string | null;
  durationSeconds: number;
  transcriptLog: TranscriptItem[];
}

export class SessionManager {
  private rooms: Map<string, RoomSession> = new Map();

  // Generate readable room code e.g. "LL-8492"
  private generateRoomCode(): string {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `LL-${num}`;
  }

  public createRoom(hostName: string, sourceLang: string = 'en', targetLang: string = 'hi'): { room: RoomSession; hostParticipant: Participant } {
    const code = this.generateRoomCode();
    const id = code;
    const hostId = `usr_${Math.random().toString(36).substring(2, 9)}`;

    const hostParticipant: Participant = {
      id: hostId,
      name: hostName.trim() || 'Host',
      role: 'host',
      preferredLanguage: sourceLang,
      isMuted: false,
      isDeafened: false,
      isConnected: true,
      joinedAt: new Date().toISOString(),
    };

    const room: RoomSession = {
      id,
      code,
      createdAt: new Date().toISOString(),
      status: 'waiting',
      hostParticipantId: hostId,
      sourceLang,
      targetLang,
      participants: {
        [hostId]: hostParticipant,
      },
      callStartedAt: null,
      callEndedAt: null,
      durationSeconds: 0,
      transcriptLog: [],
    };

    this.rooms.set(id, room);
    return { room, hostParticipant };
  }

  public getRoom(roomIdOrCode: string): RoomSession | undefined {
    const normalized = roomIdOrCode.trim().toUpperCase();
    // Search by ID or Code
    for (const [id, room] of this.rooms.entries()) {
      if (id.toUpperCase() === normalized || room.code.toUpperCase() === normalized) {
        return room;
      }
    }
    return undefined;
  }

  public joinRoom(roomIdOrCode: string, participantName: string, preferredLang?: string): { room: RoomSession; participant: Participant } | null {
    const room = this.getRoom(roomIdOrCode);
    if (!room) return null;

    if (room.status === 'ended') {
      return null;
    }

    // Limit room to two participants
    const activeParticipants = Object.values(room.participants).filter((p) => p.isConnected);
    if (activeParticipants.length >= 2) {
      return null; // Room full
    }

    const participantId = `usr_${Math.random().toString(36).substring(2, 9)}`;
    const lang = preferredLang || (room.targetLang || 'hi');

    const participant: Participant = {
      id: participantId,
      name: participantName.trim() || 'Guest',
      role: 'guest',
      preferredLanguage: lang,
      isMuted: false,
      isDeafened: false,
      isConnected: true,
      joinedAt: new Date().toISOString(),
    };

    room.participants[participantId] = participant;

    // Transition to active when 2 participants join
    const updatedParticipants = Object.values(room.participants).filter((p) => p.isConnected);
    if (updatedParticipants.length >= 2 && room.status === 'waiting') {
      room.status = 'active';
      if (!room.callStartedAt) {
        room.callStartedAt = new Date().toISOString();
      }
    }

    return { room, participant };
  }

  public updateParticipantStatus(
    roomId: string,
    participantId: string,
    updates: Partial<Pick<Participant, 'isMuted' | 'isDeafened' | 'isConnected' | 'preferredLanguage'>>
  ): RoomSession | null {
    const room = this.getRoom(roomId);
    if (!room || !room.participants[participantId]) return null;

    room.participants[participantId] = {
      ...room.participants[participantId],
      ...updates,
    };

    return room;
  }

  public addTranscript(roomId: string, item: Omit<TranscriptItem, 'id' | 'timestamp'>): TranscriptItem | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const transcriptItem: TranscriptItem = {
      ...item,
      id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    room.transcriptLog.push(transcriptItem);
    return transcriptItem;
  }

  public endRoom(roomId: string): RoomSession | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    room.status = 'ended';
    room.callEndedAt = new Date().toISOString();

    if (room.callStartedAt) {
      const start = new Date(room.callStartedAt).getTime();
      const end = new Date(room.callEndedAt).getTime();
      room.durationSeconds = Math.max(0, Math.floor((end - start) / 1000));
    }

    // Mark all as disconnected
    for (const pid of Object.keys(room.participants)) {
      room.participants[pid].isConnected = false;
    }

    return room;
  }

  public removeParticipant(roomId: string, participantId: string): RoomSession | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    if (room.participants[participantId]) {
      room.participants[participantId].isConnected = false;
    }

    const connected = Object.values(room.participants).filter((p) => p.isConnected);
    if (connected.length === 0 && room.status === 'active') {
      this.endRoom(roomId);
    }

    return room;
  }
}

export const sessionManager = new SessionManager();
