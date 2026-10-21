import { WebSocket } from 'ws';
import { sessionManager } from '../sessions/sessionManager.js';
import { translationService } from '../translation/translationService.js';
export class CallingSignalingServer {
    wss = null;
    connections = new Map();
    initialize(wss) {
        this.wss = wss;
        wss.on('connection', (ws) => {
            this.connections.set(ws, {
                ws,
                roomId: null,
                participantId: null,
            });
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await this.handleMessage(ws, message);
                }
                catch (err) {
                    console.error('[Signaling] Failed to parse message:', err);
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload' }));
                }
            });
            ws.on('close', () => {
                this.handleDisconnect(ws);
            });
            ws.on('error', (err) => {
                console.error('[Signaling] WebSocket error:', err);
            });
        });
    }
    async handleMessage(ws, message) {
        const conn = this.connections.get(ws);
        if (!conn)
            return;
        switch (message.type) {
            case 'join-room': {
                const { roomId, participantId, participantName, preferredLanguage } = message;
                conn.roomId = roomId;
                conn.participantId = participantId;
                const room = sessionManager.getRoom(roomId);
                if (!room) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
                    return;
                }
                // Broadcast to existing peers in room
                this.broadcastToRoom(roomId, {
                    type: 'participant-joined',
                    participant: room.participants[participantId],
                    room,
                }, ws);
                // Send confirmation and current room state to newly joined client
                ws.send(JSON.stringify({
                    type: 'room-joined',
                    room,
                    participantId,
                }));
                break;
            }
            // WebRTC direct signaling pass-through for peer-to-peer audio
            case 'webrtc-offer':
            case 'webrtc-answer':
            case 'webrtc-ice-candidate': {
                if (!conn.roomId)
                    return;
                this.broadcastToRoom(conn.roomId, message, ws);
                break;
            }
            // Speech packet from a speaker in the call
            case 'speech-input': {
                const { text, sourceLang, isFinal, utteranceId } = message;
                if (!conn.roomId || !conn.participantId)
                    return;
                if (!isFinal || !String(text || '').trim())
                    return;
                const room = sessionManager.getRoom(conn.roomId);
                if (!room)
                    return;
                const sender = room.participants[conn.participantId];
                if (!sender)
                    return;
                const participants = Object.values(room.participants);
                const otherParticipant = participants.find((p) => p.id !== conn.participantId && p.isConnected);
                const targetLang = otherParticipant?.preferredLanguage || room.targetLang || 'hi';
                const translation = await translationService.translate(text, sourceLang || sender.preferredLanguage || 'en', targetLang);
                const transcriptItem = {
                    senderId: conn.participantId,
                    senderName: sender.name,
                    originalText: text,
                    originalLang: sourceLang || sender.preferredLanguage,
                    translatedText: translation.translatedText,
                    translatedLang: targetLang,
                    status: 'translated',
                };
                const savedItem = sessionManager.addTranscript(conn.roomId, transcriptItem);
                // Broadcast speech and translation to all participants in the room
                this.broadcastToRoom(conn.roomId, {
                    type: 'speech-broadcast',
                    transcriptItem: savedItem,
                    translationMetadata: {
                        confidence: translation.confidence,
                        engine: translation.engine,
                        latencyMs: translation.latencyMs,
                        limitation: translation.limitation,
                        utteranceId: utteranceId || savedItem?.id,
                    },
                    isFinal: true,
                });
                break;
            }
            // Live speaking state indicator (e.g. "Speaking...", "Listening...")
            case 'speaking-state': {
                if (!conn.roomId || !conn.participantId)
                    return;
                this.broadcastToRoom(conn.roomId, {
                    type: 'peer-speaking-state',
                    participantId: conn.participantId,
                    isSpeaking: Boolean(message.isSpeaking),
                }, ws);
                break;
            }
            // Mute / Deafen toggle
            case 'media-toggle': {
                if (!conn.roomId || !conn.participantId)
                    return;
                const { isMuted, isDeafened } = message;
                const updatedRoom = sessionManager.updateParticipantStatus(conn.roomId, conn.participantId, {
                    ...(typeof isMuted === 'boolean' ? { isMuted } : {}),
                    ...(typeof isDeafened === 'boolean' ? { isDeafened } : {}),
                });
                if (updatedRoom) {
                    this.broadcastToRoom(conn.roomId, {
                        type: 'participant-updated',
                        participantId: conn.participantId,
                        isMuted,
                        isDeafened,
                    });
                }
                break;
            }
            // End call action
            case 'end-call': {
                if (!conn.roomId)
                    return;
                const endedRoom = sessionManager.endRoom(conn.roomId);
                if (endedRoom) {
                    this.broadcastToRoom(conn.roomId, {
                        type: 'call-ended',
                        room: endedRoom,
                        summary: {
                            durationSeconds: endedRoom.durationSeconds,
                            totalTranscripts: endedRoom.transcriptLog.length,
                            callStartedAt: endedRoom.callStartedAt,
                            callEndedAt: endedRoom.callEndedAt,
                        },
                    });
                }
                break;
            }
            default:
                console.warn('[Signaling] Unknown message type:', message.type);
        }
    }
    handleDisconnect(ws) {
        const conn = this.connections.get(ws);
        if (conn && conn.roomId && conn.participantId) {
            sessionManager.removeParticipant(conn.roomId, conn.participantId);
            this.broadcastToRoom(conn.roomId, {
                type: 'participant-left',
                participantId: conn.participantId,
            });
        }
        this.connections.delete(ws);
    }
    broadcastToRoom(roomId, data, excludeWs) {
        const payload = JSON.stringify(data);
        for (const [ws, conn] of this.connections.entries()) {
            if (conn.roomId === roomId && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
                ws.send(payload);
            }
        }
    }
}
export const callingSignalingServer = new CallingSignalingServer();
