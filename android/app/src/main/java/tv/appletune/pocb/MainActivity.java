package tv.appletune.pocb;

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
 * POC-B host — a single WebView, configured the way a real Apple Music TV client
 * would have to configure it, pointed at the playback harness.
 *
 * This app deliberately does almost nothing. Gate G1 asks one question: does a
 * full Apple Music track play inside an Android WebView on real TV hardware?
 * Every extra library or abstraction here would be one more candidate
 * explanation for a failure, so there are none — no AndroidX, no AppCompat, no
 * Leanback, no dependencies at all.
 *
 * The interesting part of this file is {@link #configure(WebView)}. Everything
 * else is plumbing so that failures are visible on a television instead of
 * being a black screen.
 */
public class MainActivity extends Activity {

    private static final String TAG = "POCB";

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

        String url = BuildConfig.POCB_URL;
        if (url == null || url.trim().isEmpty()) {
            showMessage(
                    "No harness URL was compiled into this APK.\n\n" +
                    "Rebuild with the tunnel URL supplied:\n\n" +
                    "  gradle assembleDebug -PpocbUrl=https://<your-tunnel>/pocb/\n\n" +
                    "or run the \"Build POC-B APK\" workflow on GitHub and paste the URL " +
                    "into the url field.");
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
                    fail("Could not load the harness.\n\n"
                            + error.getDescription() + " (code " + error.getErrorCode() + ")\n\n"
                            + request.getUrl());
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && request.isForMainFrame()) {
                    fail("The harness returned HTTP " + response.getStatusCode() + ".\n\n"
                            + request.getUrl() + "\n\n"
                            + "Is the tunnel still up, and is the pairing server still running?");
                }
            }
        });
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

    @Override
    public void onBackPressed() {
        if (web.getVisibility() == View.VISIBLE && web.canGoBack()) {
            web.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
        }
        super.onDestroy();
    }
}
