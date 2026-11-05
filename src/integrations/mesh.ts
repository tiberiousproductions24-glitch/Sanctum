// Minimal WebRTC mesh compatible with the Worship Rehearsal Platform (public/js/rtc.js):
// perfect negotiation (polite = myId < peerId), newcomer offers, signals relayed as {type:'signal', to, data:{description|candidate}},
// and the same low-latency Opus SDP munging (10 ms ptime, stereo, FEC, no DTX, 128 kbps).
export const OPUS = { ptime: 10, stereo: true, maxaveragebitrate: 128000, useinbandfec: 1, usedtx: 0, cbr: 0 };

export function mungeOpus(sdp: string, o = OPUS) {
  const params: Record<string, string | number> = { minptime: o.ptime, useinbandfec: o.useinbandfec, usedtx: o.usedtx, stereo: o.stereo ? 1 : 0, 'sprop-stereo': o.stereo ? 1 : 0, maxaveragebitrate: o.maxaveragebitrate, cbr: o.cbr };
  return sdp.split(/\r\n(?=m=)/).map((sec) => {
    if (!sec.startsWith('m=audio')) return sec;
    let lines = sec.split('\r\n');
    const pts = lines.map((l) => l.match(/^a=rtpmap:(\d+) opus\/48000/i)).filter(Boolean).map((m) => m![1]);
    if (!pts.length) return sec;
    lines = lines.filter((l) => !l.startsWith('a=ptime:') && !l.startsWith('a=maxptime:'));
    lines = lines.map((l) => {
      const f = l.match(/^a=fmtp:(\d+) (.*)$/); if (!f || !pts.includes(f[1])) return l;
      const kv: Record<string, string> = Object.fromEntries(f[2].split(';').map((s) => s.trim()).filter(Boolean).map((s) => s.split('=') as [string, string]));
      for (const [k, v] of Object.entries(params)) kv[k] = String(v);
      return `a=fmtp:${f[1]} ` + Object.entries(kv).map(([k, v]) => `${k}=${v}`).join(';');
    });
    let last = 0; lines.forEach((l, i) => { if (/^a=(rtpmap|fmtp|rtcp-fb):/.test(l)) last = i; });
    lines.splice(last + 1, 0, `a=ptime:${o.ptime}`, `a=maxptime:${Math.max(o.ptime, 20)}`);
    return lines.join('\r\n');
  }).join('\r\n');
}

interface P { id: string; pc: RTCPeerConnection; polite: boolean; makingOffer: boolean; ignoreOffer: boolean; queue: Promise<void>; stream: MediaStream; state: string; rttMs?: number }

export class SanctumMesh {
  peers = new Map<string, P>();
  onStream?: (id: string, s: MediaStream) => void;
  onState?: () => void;
  private statsT: any;
  constructor(private myId: string, private ice: RTCIceServer[], private sendSignal: (to: string, data: any) => void, private local: () => MediaStream | null) {
    this.statsT = setInterval(() => this.poll(), 2000);
  }
  private ensure(id: string) {
    let p = this.peers.get(id); if (p) return p;
    const pc = new RTCPeerConnection({ iceServers: this.ice, bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require' });
    const q: P = { id, pc, polite: this.myId < id, makingOffer: false, ignoreOffer: false, queue: Promise.resolve(), stream: new MediaStream(), state: 'new' };
    this.peers.set(id, q);
    pc.onicecandidate = (e) => { if (e.candidate) this.sendSignal(id, { candidate: e.candidate }); };
    pc.onnegotiationneeded = async () => {
      try { q.makingOffer = true; const offer = await pc.createOffer(); if (pc.signalingState !== 'stable') return; offer.sdp = mungeOpus(offer.sdp || ''); await pc.setLocalDescription(offer); this.sendSignal(id, { description: pc.localDescription }); }
      catch (e) { console.warn('[rehearsal] negotiation failed', e); } finally { q.makingOffer = false; }
    };
    pc.ontrack = (e) => {
      try { (e.receiver as any).jitterBufferTarget = 0; } catch {}
      if (!q.stream.getTracks().includes(e.track)) q.stream.addTrack(e.track);
      this.onStream?.(id, q.stream);
    };
    pc.onconnectionstatechange = () => {
      q.state = pc.connectionState; this.onState?.();
      if (pc.connectionState === 'connected') for (const s of pc.getSenders()) if (s.track?.kind === 'audio') { const p = s.getParameters(); if (p.encodings?.length) { p.encodings.forEach((x: any) => { x.priority = 'high'; x.networkPriority = 'high'; x.maxBitrate = 128000; }); s.setParameters(p).catch(() => {}); } }
      if (pc.connectionState === 'failed') pc.restartIce();
    };
    const ls = this.local();
    if (ls) for (const t of ls.getTracks()) pc.addTrack(t, ls);
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    return q;
  }
  /** We are the newcomer: create the PC (negotiationneeded → we offer). */
  connect(id: string) { this.ensure(id); }
  handleSignal(from: string, data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) {
    const p = this.ensure(from);
    p.queue = p.queue.then(async () => {
      const pc = p.pc;
      if (data.description) {
        const collision = data.description.type === 'offer' && (p.makingOffer || pc.signalingState !== 'stable');
        p.ignoreOffer = !p.polite && collision; if (p.ignoreOffer) return;
        await pc.setRemoteDescription(data.description);
        if (data.description.type === 'offer') { const a = await pc.createAnswer(); a.sdp = mungeOpus(a.sdp || ''); await pc.setLocalDescription(a); this.sendSignal(from, { description: pc.localDescription }); }
      } else if (data.candidate) { try { await pc.addIceCandidate(data.candidate); } catch (e) { if (!p.ignoreOffer) throw e; } }
    }).catch((e) => console.warn('[rehearsal] signal error', e));
  }
  /** Swap the outgoing audio track (engine recreated) without renegotiation. */
  async replaceAudio(track: MediaStreamTrack | null) {
    for (const p of this.peers.values()) { const s = p.pc.getSenders().find((x) => x.track?.kind === 'audio') || p.pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio')?.sender; if (s) await s.replaceTrack(track).catch(() => {}); }
  }
  remove(id: string) { const p = this.peers.get(id); if (!p) return; p.pc.close(); this.peers.delete(id); this.onState?.(); }
  close() { clearInterval(this.statsT); for (const id of [...this.peers.keys()]) this.remove(id); }
  private async poll() {
    for (const p of this.peers.values()) {
      if (p.pc.connectionState !== 'connected') continue;
      try { const st = await p.pc.getStats(); st.forEach((r: any) => { if (r.type === 'candidate-pair' && r.nominated && r.currentRoundTripTime != null) p.rttMs = r.currentRoundTripTime * 1000; }); } catch {}
    }
    this.onState?.();
  }
}
