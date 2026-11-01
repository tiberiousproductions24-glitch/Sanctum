package com.tiberiousproductions.sanctum;

import android.os.Bundle;
import android.view.View;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.tiberiousproductions.sanctum.midi.SanctumMidiPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SanctumMidiPlugin.class);
        super.onCreate(savedInstanceState);
        // Let web audio start without a gesture (we still resume on first touch).
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    /** Fullscreen / immersive: hide status + nav bars; swipe from an edge shows them briefly. */
    private void immersive() {
        View decor = getWindow().getDecorView();
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), decor);
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
