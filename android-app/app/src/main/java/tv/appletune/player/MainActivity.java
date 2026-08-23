package tv.appletune.player;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

/**
 * AppleTune host — a single WebView, pointed at the permanent NAS-hosted TV
 * app. Configuration copied verbatim from the POC-B test harness
 * (android/app/src/main/java/tv/appletune/pocb/MainActivity.java), which
 * proved these exact settings correct on real Android TV hardware.
 *
 * The interesting part of this file is {@link #configure(WebView)}. Everything
 * else is plumbing so that failures are visible on a television instead of
 * being a black screen.
 */
public class MainActivity extends Activity {

    private static final String TAG = "APPLETUNE";

    private WebView web;
    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0B0B10"));

        status = new TextView(this);
        status.setTextColor(Color.parseColor("#F5F6F8"));
        status.setBackgroundColor(Color.parseColor("#14141B"));
        status.setTextSize(22f);
        status.setPadding(48, 48, 48, 48);
        status.setGravity(Gravity.CENTER);
        status.setVisibility(View.GONE);

        web = new WebView(this);
        configure(web);

        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(status, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        String url = BuildConfig.APP_URL;
        if (url == null || url.trim().isEmpty()) {
            showMessage(
                    "No URL was compiled into this APK.\n\n" +
                    "Set the APP_URL repository secret (Settings > Secrets and " +
                    "variables > Actions) and re-run the \"Build AppleTune APK\" " +
                    "workflow on GitHub.");
            return;
        }

        Log.i(TAG, "WebView package: " + webViewPackage());
        Log.i(TAG, "Loading " + url);
        web.loadUrl(url);
    }

    /**
     * The part that actually matters.
     *
     * Two settings here are the usual reason a page that plays in TV Chrome
     * shows a blank player or a 30-second preview inside a WebView:
     *
     *   onPermissionRequest / PROTECTED_MEDIA_ID
     *       A WebView denies the Widevine media-drm permission unless the host
     *       app grants it. Chrome grants it for you; a WebView does not. Without
     *       the grant below, EME key-session creation fails and the player
     *       silently falls back to whatever unprotected stream exists — which,
     *       for Apple Music, is the 30-second preview.
     *
     *   setMediaPlaybackRequiresUserGesture(false)
     *       Defaults to true. A D-pad remote cannot produce the touch gesture
     *       the WebView is waiting for, so playback would never start at all.
     */
    private void configure(WebView view) {
        WebSettings settings = view.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        // The harness is served over HTTPS and must stay that way: EME is
        // blocked outside a secure context.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        // Lets `adb shell` + chrome://inspect attach to this WebView, which is
        // how a DRM failure gets diagnosed if the on-screen log is not enough.
        WebView.setWebContentsDebuggingEnabled(true);

        // Only our own pages are ever loaded, and the bridge exposes exactly one
        // argument-free method, so the surface is a single "close the app".
        view.addJavascriptInterface(new Host(), "AndroidHost");

        view.setBackgroundColor(Color.parseColor("#0B0B10"));

        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // Grant PROTECTED_MEDIA_ID. See the note above — this single
                // call is the difference between full playback and a preview.
                Log.i(TAG, "Granting WebView permissions: " + join(request.getResources()));
                request.grant(request.getResources());
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                // Mirror the harness's log into logcat so the evidence survives
                // even if the screen is photographed badly.
                Log.i(TAG, "console[" + message.messageLevel() + "] " + message.message()
                        + " (" + message.sourceId() + ":" + message.lineNumber() + ")");
                return true;
            }
        });

        view.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && request.isForMainFrame()) {
                    fail("Could not load the app.\n\n"
                            + error.getDescription() + " (code " + error.getErrorCode() + ")\n\n"
                            + request.getUrl());
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && request.isForMainFrame()) {
                    fail("The server returned HTTP " + response.getStatusCode() + ".\n\n"
                            + request.getUrl() + "\n\n"
                            + "Is the NAS deployment still running?");
                }
            }
        });
    }

    /**
     * The one thing the page cannot do for itself: leave.
     *
     * A web page cannot finish an Activity, so without this the app's own
     * "exit" could only ever draw a screen that claimed to have exited. Kept to
     * a single method that takes no arguments and returns nothing, because a
     * JavaScript bridge is reachable by any page the WebView loads.
     */
    private class Host {
        @android.webkit.JavascriptInterface
        public void exit() {
            runOnUiThread(MainActivity.this::finish);
        }
    }

    /** Report which WebView implementation is actually in use — it is a variable. */
    private String webViewPackage() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.content.pm.PackageInfo info = WebView.getCurrentWebViewPackage();
            if (info != null) {
                return info.packageName + " " + info.versionName;
            }
        }
        return "unknown (API " + Build.VERSION.SDK_INT + ")";
    }

    private static String join(String[] values) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < values.length; i += 1) {
            if (i > 0) builder.append(", ");
            builder.append(values[i]);
        }
        return builder.length() == 0 ? "(none)" : builder.toString();
    }

    private void fail(String message) {
        Log.e(TAG, message.replace('\n', ' '));
        showMessage(message);
    }

    /** A WebView that fails to load renders as pure black. Never let that happen. */
    private void showMessage(String message) {
        status.setText(message);
        status.setVisibility(View.VISIBLE);
        web.setVisibility(View.GONE);
    }

    /**
     * Give the page first refusal on BACK.
     *
     * A hardware BACK press does not produce a DOM keydown — Android routes it
     * straight here. So every back handler the web app registers is invisible
     * to the remote, and the previous version of this method went directly to
     * WebView history: from Now Playing, BACK left the app's own screen stack
     * entirely and reloaded the previous page. The automated D-pad audit missed
     * it completely, because a synthetic Escape event does reach the page.
     *
     * The page answers synchronously via __onAndroidBack; only if it declines
     * do we fall back to history, and then to leaving the app.
     */
    @Override
    public void onBackPressed() {
        if (web == null || web.getVisibility() != View.VISIBLE) {
            super.onBackPressed();
            return;
        }

        web.evaluateJavascript(
                "(function(){try{return !!(window.__onAndroidBack && window.__onAndroidBack())}"
                        + "catch(e){return false}})()",
                value -> {
                    if ("true".equals(value)) {
                        return; // The page consumed it.
                    }
                    if (web.canGoBack()) {
                        web.goBack();
                    } else {
                        finish();
                    }
                });
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
        }
        super.onDestroy();
    }
}
