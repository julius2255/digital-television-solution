package ke.chemchemtv.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * Displays the clean Program Output and starts the independent foreground encoder.
 *
 * Important: leaving this Activity does NOT stop EncoderService.
 */
class MainActivity : AppCompatActivity() {

  private lateinit var programFrame: FrameLayout
  private lateinit var programView: WebView
  private lateinit var status: TextView
  private var programUrl = ""
  private var endpoint = ""
  private var mediaUrl = ""

  private val statusReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      val value = intent?.getStringExtra(EncoderService.EXTRA_STATUS) ?: return
      runOnUiThread {
        status.text = when {
          value == "LIVE" -> "CHEMCHEM TV KENYA • LIVE • VIDEO SENDING"
          value.startsWith("LIVE •") -> "CHEMCHEM TV KENYA • $value"
          value == "CONNECTING" -> "CHEMCHEM TV KENYA • FACEBOOK CONNECTING"
          value.startsWith("ERROR") -> "CHEMCHEM TV KENYA • $value"
          else -> "CHEMCHEM TV KENYA • $value"
        }
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    buildUi()
    ContextCompat.registerReceiver(
      this,
      statusReceiver,
      IntentFilter(EncoderService.ACTION_STATUS),
      ContextCompat.RECEIVER_NOT_EXPORTED
    )
    handleIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    stopEncoderService()
    handleIntent(intent)
  }

  private fun buildUi() {
    val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
    programFrame = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
    root.addView(programFrame, FrameLayout.LayoutParams(-1, -1))

    status = TextView(this).apply {
      text = "CHEMCHEM TV KENYA • WAITING FOR CONTROL SYSTEM"
      textSize = 12f
      setTextColor(Color.WHITE)
      setBackgroundColor(Color.argb(175, 0, 0, 0))
      setPadding(14, 8, 14, 8)
      gravity = Gravity.CENTER
    }
    val statusParams = FrameLayout.LayoutParams(-2, -2).apply {
      gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      bottomMargin = 18
    }
    root.addView(status, statusParams)
    setContentView(root)
  }

  private fun handleIntent(intent: Intent?) {
    val data = intent?.data
    if (data == null) {
      status.text = "CHEMCHEM TV KENYA • OPEN FROM THE CONTROL SYSTEM"
      return
    }

    val rtmp = data.getQueryParameter("rtmp")?.takeIf { it.isNotBlank() }
    val server = data.getQueryParameter("server")?.takeIf { it.isNotBlank() }
    val key = data.getQueryParameter("key")?.takeIf { it.isNotBlank() }

    endpoint = when {
      !rtmp.isNullOrBlank() -> rtmp
      !server.isNullOrBlank() && !key.isNullOrBlank() ->
        server.trimEnd('/') + "/" + key.trimStart('/')
      else -> ""
    }

    programUrl = data.getQueryParameter("url")?.takeIf { it.isNotBlank() }
      ?: data.getQueryParameter("webUrl")?.takeIf { it.isNotBlank() } ?: ""

    mediaUrl = data.getQueryParameter("mediaUrl")?.takeIf { it.isNotBlank() } ?: ""

    if (endpoint.isBlank() || programUrl.isBlank()) {
      status.text = "CHEMCHEM TV KENYA • INVALID CONTROL HANDOFF"
      Toast.makeText(this, "The control system must provide RTMP and Program Output URL.", Toast.LENGTH_LONG).show()
      return
    }

    if (!endpoint.startsWith("rtmp://", true) && !endpoint.startsWith("rtmps://", true)) {
      status.text = "CHEMCHEM TV KENYA • INVALID RTMP URL"
      return
    }

    if (!programUrl.startsWith("http://", true) && !programUrl.startsWith("https://", true)) {
      status.text = "CHEMCHEM TV KENYA • INVALID PROGRAM URL"
      return
    }

    status.text = "CHEMCHEM TV KENYA • LOADING PROGRAM OUTPUT"
    loadProgramOutput()
  }

  private fun loadProgramOutput() {
    programFrame.removeAllViews()
    programView = WebView(this).apply {
      setBackgroundColor(Color.BLACK)
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      settings.mediaPlaybackRequiresUserGesture = false
      settings.loadWithOverviewMode = true
      settings.useWideViewPort = true
      webViewClient = object : WebViewClient() {
        override fun onPageFinished(view: WebView?, url: String?) {
          status.text = if (mediaUrl.isNotBlank()) {
            "CHEMCHEM TV KENYA • PROGRAM READY • STARTING BACKGROUND ENCODER"
          } else {
            "CHEMCHEM TV KENYA • PROGRAM READY • WEB SOURCE"
          }
          if (mediaUrl.isNotBlank()) {
            programFrame.postDelayed({ startEncoderService() }, 800)
          } else {
            Toast.makeText(
              this@MainActivity,
              "This Program Output has no direct media URL. Use an uploaded/cloud media file for background RTMP streaming.",
              Toast.LENGTH_LONG
            ).show()
          }
        }

        override fun onReceivedError(
          view: WebView?,
          request: WebResourceRequest?,
          error: WebResourceError?
        ) {
          if (request?.isForMainFrame == true) {
            status.text = "CHEMCHEM TV KENYA • PROGRAM OUTPUT ERROR"
          }
        }
      }
      loadUrl(programUrl)
    }
    programFrame.addView(programView, FrameLayout.LayoutParams(-1, -1))
  }

  private fun startEncoderService() {
    if (endpoint.isBlank() || mediaUrl.isBlank()) return

    val intent = Intent(this, EncoderService::class.java).apply {
      action = EncoderService.ACTION_START
      putExtra(EncoderService.EXTRA_ENDPOINT, endpoint)
      putExtra(EncoderService.EXTRA_MEDIA_URL, mediaUrl)
    }

    try {
      ContextCompat.startForegroundService(this, intent)
      status.text = "CHEMCHEM TV KENYA • FACEBOOK CONNECTING • BACKGROUND ENGINE ON"
    } catch (e: Exception) {
      status.text = "CHEMCHEM TV KENYA • ENCODER START ERROR"
      Toast.makeText(this, e.message ?: "Could not start encoder service", Toast.LENGTH_LONG).show()
    }
  }

  private fun stopEncoderService() {
    try {
      startService(Intent(this, EncoderService::class.java).setAction(EncoderService.ACTION_STOP))
    } catch (_: Exception) {}
  }

  override fun onDestroy() {
    // Deliberately DO NOT stop EncoderService here.
    try { programView.destroy() } catch (_: Exception) {}
    try { unregisterReceiver(statusReceiver) } catch (_: Exception) {}
    super.onDestroy()
  }
}
