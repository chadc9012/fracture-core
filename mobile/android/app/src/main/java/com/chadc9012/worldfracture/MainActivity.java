package com.chadc9012.worldfracture;

import android.app.GameManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/** World Fracture runs full screen in landscape: system bars hidden (a swipe from the edge brings them back briefly), the screen kept on
 * while playing, and the game laid out edge to edge. The manifest marks it as a game (Samsung Game Booster, Game Dashboard), and the
 * Android game mode the player picks there (Performance / Standard / Battery saver) is passed to the game as window.__wfGameMode with a
 * "wf-gamemode" event, each time the game comes to the front. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        immersive();
    }

    @Override
    public void onResume() {
        super.onResume();
        // the page may still be loading on a cold start: send again once it is up
        sendGameMode();
        Handler h = new Handler(Looper.getMainLooper());
        h.postDelayed(this::sendGameMode, 2500);
        h.postDelayed(this::sendGameMode, 9000);
    }

    /** the Android game mode Game Booster / the Game Dashboard has set for this game (Android 12+) */
    private String gameMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            GameManager gm = (GameManager) getSystemService(Context.GAME_SERVICE);
            if (gm != null) {
                switch (gm.getGameMode()) {
                    case GameManager.GAME_MODE_PERFORMANCE: return "performance";
                    case GameManager.GAME_MODE_BATTERY: return "battery";
                    case GameManager.GAME_MODE_STANDARD: return "standard";
                    default: return "unsupported";
                }
            }
        }
        return "unsupported";
    }

    private void sendGameMode() {
        if (getBridge() == null) return;
        WebView w = getBridge().getWebView();
        if (w == null) return;
        w.evaluateJavascript("window.__wfGameMode='" + gameMode() + "';window.dispatchEvent(new Event('wf-gamemode'));", null);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    private void immersive() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
