package ke.chemchemtv.mobile

import android.Manifest
import android.app.PictureInPictureParams
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.util.Rational
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
 * CHEMCHEM TV KENYA Program Output + real encoder handoff.
 *
 * The Activity displays only the clean Program Output.
 * The foreground EncoderService captures that selected app window's live
 * video and the app's playback audio and sends H.264/AAC to Facebook RTMPS.
 *
 * The Android MediaProjection permission is NOT microphone recording. Android
 * requires RECORD_AUDIO permission for playback-capture APIs, but the app never
 * opens the microphone source.
 */
class MainActivity : AppCompatActivity() {

  companion object {
    private const val REQUEST_AUDIO = 7001
    private const val REQUEST_PROJECTION = 7002
  }

  private lateinit var programFrame: FrameLayout
  private lateinit var programView: WebView
  private lateinit var status: TextView
  private var endpoint = ""
  private var programUrl = ""
  private var projectionRequested = false
  private var streamStarted = false

  private val statusReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      val value = intent?.getStringExtra(EncoderService.EXTRA_STATUS) ?: return
      runOnUiThread {
        status.text = when {
          value == "LIVE" -> "CHEMCHEM TV KENYA • LIVE • VIDEO + AUDIO"
          value.startsWith("LIVE •") -> "CHEMCHEM TV KENYA • $value"
          value == "CONNECTING" -> "CHEMCHEM TV KENYA • FACEBOOK CONNECTING"
          value == "CAPTURE READY" -> "CHEMCHEM TV KENYA • PROGRAM CAPTURE READY"
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
    streamStarted = false
    projectionRequested = false
    handleIntent(intent)
  }

  private fun buildUi() {
    val root = FrameLayout(this).apply {
      setBackgroundColor(Color.BLACK)
      systemUiVisibility = (
        android.view.View.SYSTEM_UI_FLAG_FULLSCREEN or
        android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
        android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
        android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
        android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
        android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
      )
    }

    programFrame = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
    root.addView(programFrame, FrameLayout.LayoutParams(-1, -1))

    status = TextView(this).apply {
      text = "CHEMCHEM TV KENYA • LOADING PROGRAM OUTPUT"
      textSize = 11f
      setTextColor(Color.WHITE)
      setBackgroundColor(Color.argb(150, 0, 0, 0))
      setPadding(12, 7, 12, 7)
      gravity = Gravity.CENTER
    }

    val statusParams = FrameLayout.LayoutParams(-2, -2).apply {
      gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      bottomMargin = 8
    }
    root.addView(status, statusParams)
    setContentView(root)

    // The status bar is only for the local encoder UI. It is hidden from the
    // captured program once the encoder enters capture mode.
    root.post {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        setPictureInPictureParams(
          PictureInPictureParams.Builder()
            .setAspectRatio(Rational(16, 9))
            .setAutoEnterEnabled(true)
            .build()
        )
      }
    }
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

    status.text = "CHEMCHEM TV KENYA • LOADING LIVE PROGRAM"
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
      settings.allowFileAccess = false
      settings.allowContentAccess = false

      webViewClient = object : WebViewClient() {
        override fun onPageFinished(view: WebView?, url: String?) {
          status.text = "CHEMCHEM TV KENYA • PROGRAM READY • REQUESTING ENCODER PERMISSION"
          programFrame.postDelayed({ requestEncoderPermission() }, 900)
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

  private fun requestEncoderPermission() {
    if (streamStarted || projectionRequested) return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
      ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED
    ) {
      status.text = "CHEMCHEM TV KENYA • ALLOW PLAYBACK AUDIO"
      requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_AUDIO)
      return
    }

    requestMediaProjection()
  }

  private fun requestMediaProjection() {
    if (projectionRequested) return
    projectionRequested = true
    status.text = "CHEMCHEM TV KENYA • SELECT CHEMCHEM TV KENYA WINDOW"

    val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_PROJECTION)
  }

  @Deprecated("Android activity result API kept simple for this encoder flow")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)

    if (requestCode == REQUEST_PROJECTION) {
      projectionRequested = false

      if (resultCode != RESULT_OK || data == null) {
        status.text = "CHEMCHEM TV KENYA • CAPTURE PERMISSION CANCELLED"
        Toast.makeText(this, "Allow CHEMCHEM TV KENYA app-window capture to send the live Program Output.", Toast.LENGTH_LONG).show()
        return
      }

      startEncoderService(resultCode, data)
    }
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == REQUEST_AUDIO) {
      if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
        requestMediaProjection()
      } else {
        status.text = "CHEMCHEM TV KENYA • PLAYBACK AUDIO PERMISSION REQUIRED"
        Toast.makeText(this, "Android requires this permission for internal program audio capture. The microphone source is not used.", Toast.LENGTH_LONG).show()
      }
    }
  }

  private fun startEncoderService(resultCode: Int, projectionData: Intent) {
    val intent = Intent(this, EncoderService::class.java).apply {
      action = EncoderService.ACTION_START
      putExtra(EncoderService.EXTRA_ENDPOINT, endpoint)
      putExtra(EncoderService.EXTRA_RESULT_CODE, resultCode)
      putExtra(EncoderService.EXTRA_PROJECTION_DATA, projectionData)
    }

    try {
      ContextCompat.startForegroundService(this, intent)
      streamStarted = true
      status.text = "CHEMCHEM TV KENYA • FACEBOOK CONNECTING • VIDEO + AUDIO ENGINE"
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

  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (streamStarted && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      try { enterPictureInPictureMode() } catch (_: Exception) {}
    }
  }

  override fun onBackPressed() {
    if (streamStarted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      try {
        enterPictureInPictureMode()
        return
      } catch (_: Exception) {}
    }
    super.onBackPressed()
  }

  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode)
    // Keep the actual Program Output clean. Status text is local-only and is
    // hidden whenever the Activity is placed in PiP.
    status.visibility = if (isInPictureInPictureMode) android.view.View.GONE else android.view.View.VISIBLE
  }

  override fun onDestroy() {
    // Never stop EncoderService here. The foreground encoder owns the stream.
    try { programView.destroy() } catch (_: Exception) {}
    try { unregisterReceiver(statusReceiver) } catch (_: Exception) {}
    super.onDestroy()
  }
}
