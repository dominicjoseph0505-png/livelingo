export class SessionManager {
    rooms = new Map();
    // Generate readable room code e.g. "LL-8492"
    generateRoomCode() {
        const num = Math.floor(1000 + Math.random() * 9000);
        return `LL-${num}`;
    }
    createRoom(hostName, sourceLang = 'en', targetLang = 'hi') {
        const code = this.generateRoomCode();
        const id = code;
        const hostId = `usr_${Math.random().toString(36).substring(2, 9)}`;
        const hostParticipant = {
            id: hostId,
            name: hostName.trim() || 'Host',
            role: 'host',
            preferredLanguage: sourceLang,
            isMuted: false,
            isDeafened: false,
            isConnected: true,
            joinedAt: new Date().toISOString(),
        };
        const room = {
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
    getRoom(roomIdOrCode) {
        const normalized = roomIdOrCode.trim().toUpperCase();
        // Search by ID or Code
        for (const [id, room] of this.rooms.entries()) {
            if (id.toUpperCase() === normalized || room.code.toUpperCase() === normalized) {
                return room;
            }
        }
        return undefined;
    }
    joinRoom(roomIdOrCode, participantName, preferredLang) {
        const room = this.getRoom(roomIdOrCode);
        if (!room)
            return null;
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
        const participant = {
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
    updateParticipantStatus(roomId, participantId, updates) {
        const room = this.getRoom(roomId);
        if (!room || !room.participants[participantId])
            return null;
        room.participants[participantId] = {
            ...room.participants[participantId],
            ...updates,
        };
        return room;
    }
    addTranscript(roomId, item) {
        const room = this.getRoom(roomId);
        if (!room)
            return null;
        const transcriptItem = {
            ...item,
            id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
        };
        room.transcriptLog.push(transcriptItem);
        return transcriptItem;
    }
    endRoom(roomId) {
        const room = this.getRoom(roomId);
        if (!room)
            return null;
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
    removeParticipant(roomId, participantId) {
        const room = this.getRoom(roomId);
        if (!room)
            return null;
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
