package com.chadc9012.worldfracture;

import android.app.GameManager;
import android.content.Context;
import android.content.SharedPreferences;
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
        dropStaleWebCache();
    }

    /** Once per install: the web build's offline service worker (added Oct 25) kept serving the build cached on first launch, so
     * updated APKs went on running old game code (owner's phone, Oct 26: none of the phone fixes appeared). The new web code can't
     * remove it because the old worker never lets it load, so the app does it from here: unregister every worker, delete the Cache
     * Storage caches and reload, then the page comes from this APK. Saves (localStorage) are not touched. */
    private void dropStaleWebCache() {
        final long installed = installTime();
        if (installed == 0) return;
        final SharedPreferences prefs = getSharedPreferences("wf", MODE_PRIVATE);
        if (prefs.getLong("cacheDroppedFor", 0) == installed) return;
        // runs twice (the page may still be navigating at the first try); a sessionStorage mark keeps it to one reload per install
        String js = "(async()=>{const m='wf-native-drop';try{if(sessionStorage.getItem(m)==='" + installed + "')return;sessionStorage.setItem(m,'" + installed + "');}catch(e){}let n=0;try{const r=await navigator.serviceWorker.getRegistrations();n+=r.length;await Promise.all(r.map(x=>x.unregister()));}catch(e){}"
            + "try{const k=await caches.keys();n+=k.length;await Promise.all(k.map(c=>caches.delete(c)));}catch(e){}location.reload();})()";
        final Handler h = new Handler(Looper.getMainLooper());
        final int[] tries = {0};
        Runnable attempt = new Runnable() {
            @Override public void run() {
                WebView w = getBridge() == null ? null : getBridge().getWebView();
                if (w == null) { if (++tries[0] < 20) h.postDelayed(this, 500); return; }
                w.clearCache(true);
                // the script reloads the page itself once the worker and caches are gone, so this launch runs the APK's own files
                w.evaluateJavascript(js, null);
                if (++tries[0] >= 100) prefs.edit().putLong("cacheDroppedFor", installed).apply();
                else { tries[0] = 100; h.postDelayed(this, 5000); }
            }
        };
        h.postDelayed(attempt, 1500);
    }

    private long installTime() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).lastUpdateTime; } catch (Exception e) { return 0; }
    }

    @Override
    public void onResume() {
        super.onResume();
        // the page may still be loading on a cold start: send again once it is up
        sendGameMode();
        final Handler h = new Handler(Looper.getMainLooper());
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
