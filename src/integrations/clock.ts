// NTP-style clock offset estimate (same maths as the Worship Rehearsal Platform's clock.js):
// offset = ((t1-t0)+(t2-t3))/2, rtt = (t3-t0)-(t2-t1); median offset of the lowest-RTT third of the last 30 samples.
export const localNow = () => performance.timeOrigin + performance.now(); // monotonic epoch-ms

export class ClockEstimate {
  samples: { rtt: number; off: number }[] = [];
  offset = 0; rtt: number | null = null; rttMedian: number | null = null; ready = false;
  /** t0 local send, t1/t2 remote receive/send (or one remote stamp), t3 local receive. */
  add(t0: number, t1: number, t2: number, t3 = localNow()) {
    const rtt = Math.max(0, (t3 - t0) - (t2 - t1));
    const off = ((t1 - t0) + (t2 - t3)) / 2;
    this.samples.push({ rtt, off }); if (this.samples.length > 30) this.samples.shift();
    const byRtt = [...this.samples].sort((a, b) => a.rtt - b.rtt);
    const best = byRtt.slice(0, Math.max(1, Math.ceil(this.samples.length / 3)));
    const offs = best.map((s) => s.off).sort((a, b) => a - b);
    this.offset = offs[Math.floor(offs.length / 2)];
    this.rtt = best[0].rtt;
    this.rttMedian = byRtt[Math.floor(byRtt.length / 2)].rtt;
    if (this.samples.length >= 3) this.ready = true;
  }
  reset() { this.samples = []; this.ready = false; this.rtt = this.rttMedian = null; }
  remoteNow() { return localNow() + this.offset; }
  /** remote clock time -> performance.now() domain */
  remoteToPerf(t: number) { return t - this.offset - performance.timeOrigin; }
}
