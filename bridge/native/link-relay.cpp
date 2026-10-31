// sanctum-link-relay: minimal Ableton Link peer that prints session state as JSON lines
// on stdout and accepts commands on stdin. Spawned by bridge/server.js.
//   stdin:  "tempo 120.5" | "play 1" | "play 0" | "quantum 4" | "enable 0/1" | "quit"
//   stdout: {"bpm":..,"beat":..,"phase":..,"quantum":..,"peers":..,"playing":..,"enabled":..,"us":<link clock micros>}
#include <ableton/Link.hpp>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>

int main(int argc, char** argv) {
  double bpm = argc > 1 ? std::stod(argv[1]) : 120.0;
  std::atomic<double> quantum{argc > 2 ? std::stod(argv[2]) : 4.0};
  int intervalMs = argc > 3 ? std::stoi(argv[3]) : 20;
  ableton::Link link(bpm);
  link.enableStartStopSync(true);
  link.enable(true);
  std::atomic<bool> running{true};
  std::thread input([&] {
    std::string line;
    while (running && std::getline(std::cin, line)) {
      std::istringstream ss(line);
      std::string cmd; double v = 0; ss >> cmd >> v;
      if (cmd == "quit") { running = false; break; }
      auto s = link.captureAppSessionState();
      const auto now = link.clock().micros();
      if (cmd == "tempo" && v > 20 && v < 999) { s.setTempo(v, now); link.commitAppSessionState(s); }
      else if (cmd == "play") {
        if (v > 0) s.setIsPlayingAndRequestBeatAtTime(true, now, 0.0, quantum);
        else s.setIsPlaying(false, now);
        link.commitAppSessionState(s);
      }
      else if (cmd == "quantum" && v > 0) quantum = v;
      else if (cmd == "enable") link.enable(v > 0);
    }
    running = false;
  });
  input.detach();
  while (running) {
    const auto now = link.clock().micros();
    auto s = link.captureAppSessionState();
    const double q = quantum;
    std::printf("{\"bpm\":%.6f,\"beat\":%.6f,\"phase\":%.6f,\"quantum\":%.3f,\"peers\":%zu,\"playing\":%s,\"enabled\":%s,\"us\":%lld}\n",
                s.tempo(), s.beatAtTime(now, q), s.phaseAtTime(now, q), q, link.numPeers(),
                s.isPlaying() ? "true" : "false", link.isEnabled() ? "true" : "false",
                static_cast<long long>(now.count()));
    std::fflush(stdout);
    std::this_thread::sleep_for(std::chrono::milliseconds(intervalMs));
  }
  return 0;
}
