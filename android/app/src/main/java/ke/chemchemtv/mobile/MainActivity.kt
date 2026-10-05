package ke.chemchemtv.mobile

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
import com.pedro.common.ConnectChecker
import com.pedro.library.generic.GenericStream
import com.pedro.encoder.input.sources.video.NoVideoSource

class MainActivity : AppCompatActivity(), ConnectChecker {

  private lateinit var programFrame: FrameLayout
  private lateinit var programView: WebView
  private lateinit var status: TextView
  private var stream: GenericStream? = null
  private var programUrl = ""
  private var endpoint = ""
  private var starting = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    buildUi()
    handleIntent(intent)
  }

  override fun onNewIntent(intent: android.content.Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    stopEncoder()
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

  private fun handleIntent(intent: android.content.Intent?) {
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
          status.text = "CHEMCHEM TV KENYA • PROGRAM READY • CONNECTING FACEBOOK"
          programFrame.postDelayed({ startEncoder() }, 1500)
        }

        override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
          if (request?.isForMainFrame == true) status.text = "CHEMCHEM TV KENYA • PROGRAM OUTPUT ERROR"
        }
      }
      loadUrl(programUrl)
    }
    programFrame.addView(programView, FrameLayout.LayoutParams(-1, -1))
  }

  private fun startEncoder() {
    if (starting || stream?.isStreaming == true) return
    if (!::programView.isInitialized || programView.width <= 0 || programView.height <= 0) {
      programFrame.postDelayed({ startEncoder() }, 500)
      return
    }

    starting = true
    status.text = "CHEMCHEM TV KENYA • STARTING VIDEO ENCODER"

    try {
      val source = ProgramViewSource(programFrame)
      val newStream = GenericStream(applicationContext, this, NoVideoSource(), SilentAudioSource())
      newStream.getGlInterface().setForceRender(true, 30)

      val videoReady = newStream.prepareVideo(1280, 720, 3500 * 1000, rotation = 0)
      val audioReady = newStream.prepareAudio(44100, true, 96 * 1000, echoCanceler = false, noiseSuppressor = false)

      if (!videoReady || !audioReady) {
        newStream.release()
        throw IllegalStateException("H.264/AAC encoder preparation failed")
      }

      newStream.changeVideoSource(source)
      stream?.release()
      stream = newStream
      status.text = "CHEMCHEM TV KENYA • CONNECTING TO FACEBOOK"
      newStream.startStream(endpoint)
    } catch (e: Exception) {
      starting = false
      status.text = "CHEMCHEM TV KENYA • ENCODER ERROR"
      Toast.makeText(this, e.message ?: "Encoder failed", Toast.LENGTH_LONG).show()
    }
  }

  private fun stopEncoder() {
    starting = false
    try { stream?.stopStream() } catch (_: Exception) {}
    try { stream?.release() } catch (_: Exception) {}
    stream = null
  }

  override fun onConnectionStarted(url: String) {
    runOnUiThread { status.text = "CHEMCHEM TV KENYA • FACEBOOK CONNECTING" }
  }

  override fun onConnectionSuccess() {
    starting = false
    runOnUiThread { status.text = "CHEMCHEM TV KENYA • LIVE • VIDEO SENDING" }
  }

  override fun onNewBitrate(bitrate: Long) {
    runOnUiThread { status.text = "CHEMCHEM TV KENYA • LIVE • " + (bitrate / 1000) + " kbps" }
  }

  override fun onConnectionFailed(reason: String) {
    starting = false
    runOnUiThread {
      status.text = "CHEMCHEM TV KENYA • FACEBOOK ERROR"
      Toast.makeText(this, reason, Toast.LENGTH_LONG).show()
    }
  }

  override fun onDisconnect() {
    starting = false
    runOnUiThread { status.text = "CHEMCHEM TV KENYA • DISCONNECTED" }
  }

  override fun onAuthError() {
    starting = false
    runOnUiThread { status.text = "CHEMCHEM TV KENYA • FACEBOOK KEY REJECTED" }
  }

  override fun onAuthSuccess() = Unit

  override fun onDestroy() {
    stopEncoder()
    try { programView.destroy() } catch (_: Exception) {}
    super.onDestroy()
  }
}
