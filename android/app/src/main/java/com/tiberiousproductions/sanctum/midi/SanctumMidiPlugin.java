package com.tiberiousproductions.sanctum.midi;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiInputPort;
import android.media.midi.MidiManager;
import android.media.midi.MidiOutputPort;
import android.media.midi.MidiReceiver;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.ParcelUuid;
import android.os.Process;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.PriorityBlockingQueue;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.LockSupport;

/**
 * Sanctum native MIDI (android.media.midi): USB host devices, Bluetooth LE MIDI (scan + openBluetoothDevice),
 * and the phone-as-USB-MIDI-peripheral port (Android "USB: MIDI" mode shows up as a normal USB MidiDevice here).
 * Output is scheduled on a high-priority thread against System.nanoTime() so clock/notes keep tight timing.
 */
@CapacitorPlugin(
    name = "SanctumMidi",
    permissions = {
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT }),
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class SanctumMidiPlugin extends Plugin {
    private static final String TAG = "SanctumMidi";
    private static final ParcelUuid BLE_MIDI_SERVICE = ParcelUuid.fromString("03B80E5A-EDE8-4B33-A751-6CE34EC4C700");

    private MidiManager mm;
    private Handler handler;
    private final Map<Integer, Open> open = new ConcurrentHashMap<>();
    private final Map<String, BluetoothDevice> bleFound = new ConcurrentHashMap<>();
    private BluetoothLeScanner scanner;
    private ScanCallback scanCb;

    private static class Open {
        MidiDevice device; MidiDeviceInfo info;
        List<MidiInputPort> inputs = new ArrayList<>();   // we SEND to these
        List<MidiOutputPort> outputs = new ArrayList<>(); // we RECEIVE from these
    }

    // ---- scheduled output ----
    private static class Ev implements Comparable<Ev> {
        final long due; final long seq; final byte[] data; final Integer dev;
        Ev(long due, long seq, byte[] data, Integer dev) { this.due = due; this.seq = seq; this.data = data; this.dev = dev; }
        public int compareTo(Ev o) { return due != o.due ? Long.compare(due, o.due) : Long.compare(seq, o.seq); }
    }
    private final PriorityBlockingQueue<Ev> queue = new PriorityBlockingQueue<>();
    private final AtomicLong seqNo = new AtomicLong();
    private Thread sender;
    private volatile boolean running = true;

    @Override
    public void load() {
        HandlerThread ht = new HandlerThread("sanctum-midi", Process.THREAD_PRIORITY_URGENT_AUDIO);
        ht.start();
        handler = new Handler(ht.getLooper());
        if (getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_MIDI)) {
            mm = (MidiManager) getContext().getSystemService(Context.MIDI_SERVICE);
            mm.registerDeviceCallback(new MidiManager.DeviceCallback() {
                @Override public void onDeviceAdded(MidiDeviceInfo info) { notifyListeners("devicesChanged", new JSObject().put("added", describe(info))); }
                @Override public void onDeviceRemoved(MidiDeviceInfo info) { closeId(info.getId()); notifyListeners("devicesChanged", new JSObject().put("removed", info.getId())); }
            }, handler);
        }
        sender = new Thread(this::sendLoop, "sanctum-midi-out");
        sender.setPriority(Thread.MAX_PRIORITY);
        sender.start();
    }

    private void sendLoop() {
        Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO);
        while (running) {
            try {
                Ev e = queue.take();
                long wait = e.due - System.nanoTime();
                if (wait > 300_000) { // not yet due: sleep (re-check queue head in case an earlier event arrives)
                    queue.put(e);
                    LockSupport.parkNanos(Math.min(wait - 200_000, 2_000_000));
                    continue;
                }
                while (e.due - System.nanoTime() > 0) { /* spin <=0.3 ms for tight timing */ }
                for (Map.Entry<Integer, Open> en : open.entrySet()) {
                    if (e.dev != null && !e.dev.equals(en.getKey())) continue;
                    for (MidiInputPort p : en.getValue().inputs) {
                        try { p.send(e.data, 0, e.data.length, e.due); } catch (IOException ex) { Log.w(TAG, "send failed", ex); }
                    }
                }
            } catch (InterruptedException ie) { return; }
        }
    }

    @Override
    protected void handleOnDestroy() {
        running = false; if (sender != null) sender.interrupt();
        for (Integer id : new ArrayList<>(open.keySet())) closeId(id);
        stopScanInternal();
    }

    private JSObject describe(MidiDeviceInfo info) {
        Bundle p = info.getProperties();
        String name = p.getString(MidiDeviceInfo.PROPERTY_NAME);
        if (name == null) name = p.getString(MidiDeviceInfo.PROPERTY_PRODUCT, "MIDI device");
        String type = info.getType() == MidiDeviceInfo.TYPE_USB ? "usb" : info.getType() == MidiDeviceInfo.TYPE_BLUETOOTH ? "bluetooth" : "virtual";
        JSObject o = new JSObject();
        o.put("id", info.getId()); o.put("name", name); o.put("manufacturer", p.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER, ""));
        o.put("type", type); o.put("inputs", info.getInputPortCount()); o.put("outputs", info.getOutputPortCount());
        o.put("open", open.containsKey(info.getId()));
        return o;
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        boolean ble = getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE);
        boolean usbPeripheral = true; // Android 6+: Settings → USB → "MIDI"
        call.resolve(new JSObject().put("supported", mm != null).put("bluetooth", ble).put("usbPeripheral", usbPeripheral).put("sdk", Build.VERSION.SDK_INT));
    }

    @PluginMethod
    public void listDevices(PluginCall call) {
        JSArray arr = new JSArray();
        if (mm != null) for (MidiDeviceInfo i : mm.getDevices()) arr.put(describe(i));
        call.resolve(new JSObject().put("devices", arr));
    }

    @PluginMethod
    public void openDevice(PluginCall call) {
        if (mm == null) { call.reject("MIDI not supported on this device"); return; }
        int id = call.getInt("id", -1);
        if (open.containsKey(id)) { call.resolve(describe(open.get(id).info)); return; }
        MidiDeviceInfo target = null;
        for (MidiDeviceInfo i : mm.getDevices()) if (i.getId() == id) target = i;
        if (target == null) { call.reject("No MIDI device with id " + id); return; }
        final MidiDeviceInfo info = target;
        mm.openDevice(info, (device) -> {
            if (device == null) { call.reject("Could not open " + id); return; }
            attach(device, info);
            call.resolve(describe(info));
        }, handler);
    }

    private void attach(MidiDevice device, MidiDeviceInfo info) {
        Open o = new Open(); o.device = device; o.info = info;
        final int id = info.getId();
        for (int i = 0; i < info.getInputPortCount(); i++) { MidiInputPort p = device.openInputPort(i); if (p != null) o.inputs.add(p); }
        for (int i = 0; i < info.getOutputPortCount(); i++) {
            MidiOutputPort p = device.openOutputPort(i);
            if (p == null) continue;
            p.connect(new MidiReceiver() {
                @Override public void onSend(byte[] msg, int offset, int count, long timestamp) {
                    JSONArray d = new JSONArray();
                    for (int k = 0; k < count; k++) d.put(msg[offset + k] & 0xFF);
                    long now = System.nanoTime();
                    JSObject ev = new JSObject();
                    ev.put("id", id); ev.put("data", d); ev.put("ageMs", timestamp > 0 ? Math.max(0, (now - timestamp) / 1e6) : 0);
                    notifyListeners("midiMessage", ev);
                }
            });
            o.outputs.add(p);
        }
        open.put(id, o);
        notifyListeners("devicesChanged", new JSObject().put("opened", id));
    }

    private void closeId(int id) {
        Open o = open.remove(id); if (o == null) return;
        for (MidiInputPort p : o.inputs) try { p.close(); } catch (IOException ignored) {}
        for (MidiOutputPort p : o.outputs) try { p.close(); } catch (IOException ignored) {}
        try { o.device.close(); } catch (IOException ignored) {}
    }

    @PluginMethod
    public void closeDevice(PluginCall call) { closeId(call.getInt("id", -1)); call.resolve(); }

    /** send({ messages: [{ data: number[], delayMs?: number }], id?: number }) — delayMs relative to now. */
    @PluginMethod
    public void send(PluginCall call) {
        try {
            JSONArray msgs = call.getArray("messages");
            Integer dev = call.getData().has("id") ? call.getInt("id") : null;
            long now = System.nanoTime();
            for (int i = 0; i < msgs.length(); i++) {
                JSONObject m = msgs.getJSONObject(i);
                JSONArray d = m.getJSONArray("data");
                byte[] b = new byte[d.length()];
                for (int k = 0; k < b.length; k++) b[k] = (byte) d.getInt(k);
                double delay = m.optDouble("delayMs", 0);
                queue.put(new Ev(now + (long) (Math.max(0, delay) * 1e6), seqNo.incrementAndGet(), b, dev));
            }
            LockSupport.unpark(sender);
            call.resolve();
        } catch (Exception e) { call.reject("bad send: " + e.getMessage()); }
    }

    /** Drop queued (future) output, e.g. on Stop. */
    @PluginMethod
    public void flush(PluginCall call) { queue.clear(); call.resolve(); }

    // ---------- Bluetooth LE MIDI ----------
    private String blePermAlias() { return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "bluetooth" : "location"; }

    @PluginMethod
    public void startBleScan(PluginCall call) {
        if (getPermissionState(blePermAlias()) != PermissionState.GRANTED) { requestPermissionForAlias(blePermAlias(), call, "blePermCallback"); return; }
        doScan(call);
    }

    @PermissionCallback
    private void blePermCallback(PluginCall call) {
        if (getPermissionState(blePermAlias()) == PermissionState.GRANTED) doScan(call);
        else call.reject("Bluetooth permission denied");
    }

    @SuppressWarnings("MissingPermission")
    private void doScan(PluginCall call) {
        BluetoothManager bm = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter ad = bm != null ? bm.getAdapter() : null;
        if (ad == null || !ad.isEnabled()) { call.reject("Bluetooth is off"); return; }
        stopScanInternal();
        scanner = ad.getBluetoothLeScanner();
        if (scanner == null) { call.reject("BLE scanner unavailable"); return; }
        scanCb = new ScanCallback() {
            @Override public void onScanResult(int type, ScanResult r) {
                BluetoothDevice d = r.getDevice();
                if (bleFound.put(d.getAddress(), d) == null) {
                    String n = null; try { n = d.getName(); } catch (SecurityException ignored) {}
                    if (n == null && r.getScanRecord() != null) n = r.getScanRecord().getDeviceName();
                    notifyListeners("bleDevice", new JSObject().put("address", d.getAddress()).put("name", n == null ? "BLE MIDI device" : n).put("rssi", r.getRssi()));
                }
            }
            @Override public void onScanFailed(int code) { notifyListeners("bleScanFailed", new JSObject().put("code", code)); }
        };
        List<ScanFilter> filters = Collections.singletonList(new ScanFilter.Builder().setServiceUuid(BLE_MIDI_SERVICE).build());
        ScanSettings st = new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build();
        scanner.startScan(filters, st, scanCb);
        int ms = call.getInt("timeoutMs", 15000);
        handler.postDelayed(this::stopScanInternal, ms);
        call.resolve();
    }

    @SuppressWarnings("MissingPermission")
    private void stopScanInternal() {
        if (scanner != null && scanCb != null) { try { scanner.stopScan(scanCb); } catch (Exception ignored) {} }
        scanCb = null;
    }

    @PluginMethod
    public void stopBleScan(PluginCall call) { stopScanInternal(); call.resolve(); }

    @PluginMethod
    public void connectBle(PluginCall call) {
        if (mm == null) { call.reject("MIDI not supported"); return; }
        String addr = call.getString("address");
        BluetoothDevice d = addr != null ? bleFound.get(addr) : null;
        if (d == null) { call.reject("Unknown BLE device — scan first"); return; }
        mm.openBluetoothDevice(d, (device) -> {
            if (device == null) { call.reject("Could not connect to " + addr); return; }
            attach(device, device.getInfo());
            call.resolve(describe(device.getInfo()));
        }, handler);
    }
}
