package ke.chemchemtv.mobile

import android.app.PictureInPictureParams
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

/**
 * CHEMCHEM TV KENYA native broadcast handoff.
 *
 * This version does NOT use MediaProjection and does NOT capture the phone screen.
 * The web control room passes the actual program media URL to the Android encoder.
 * RootEncoder decodes that media and sends the encoded program directly to Facebook RTMPS.
 */
class MainActivity : AppCompatActivity() {

  companion object {
    private const val REQUEST_NONE = 0
  }

  private lateinit var status: TextView
  private var endpoint = ""
  private var mediaUrl = ""
  private var kind = ""
  private var streamStarted = false

  private val statusReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      val value = intent?.getStringExtra(EncoderService.EXTRA_STATUS) ?: return
      runOnUiThread {
        status.text = when {
          value == "LIVE" -> "CHEMCHEM TV KENYA • FACEBOOK LIVE • VIDEO + AUDIO"
          value.startsWith("LIVE •") -> "CHEMCHEM TV KENYA • $value"
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
    handleIntent(intent)
  }

  private fun buildUi() {
    val root = FrameLayout(this).apply {
      setBackgroundColor(Color.BLACK)
    }

    val title = TextView(this).apply {
      text = "CHEMCHEM TV KENYA"
      textSize = 25f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      setPadding(20, 36, 20, 10)
    }
    root.addView(title, FrameLayout.LayoutParams(-1, -2))

    status = TextView(this).apply {
      text = "CHEMCHEM TV KENYA • READY"
      textSize = 14f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      setPadding(24, 18, 24, 18)
    }
    val statusParams = FrameLayout.LayoutParams(-1, -2).apply {
      gravity = Gravity.CENTER
      leftMargin = 20
      rightMargin = 20
    }
    root.addView(status, statusParams)

    val note = TextView(this).apply {
      text = "FACEBOOK RTMPS\nNative encoder • no screen sharing • no microphone\nProgram media is sent directly to Facebook."
      textSize = 13f
      setTextColor(Color.LTGRAY)
      gravity = Gravity.CENTER
      setPadding(20, 20, 20, 30)
    }
    val noteParams = FrameLayout.LayoutParams(-1, -2).apply {
      gravity = Gravity.BOTTOM
    }
    root.addView(note, noteParams)

    setContentView(root)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      setPictureInPictureParams(
        PictureInPictureParams.Builder()
          .setAspectRatio(Rational(16, 9))
          .build()
      )
    }
  }

  private fun handleIntent(intent: Intent?) {
    val data = intent?.data
    if (data == null) {
      status.text = "CHEMCHEM TV KENYA • OPEN FROM CONTROL ROOM"
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

    mediaUrl = data.getQueryParameter("mediaUrl")?.takeIf { it.isNotBlank() } ?: ""
    kind = data.getQueryParameter("kind")?.takeIf { it.isNotBlank() }
      ?: data.getQueryParameter("source")?.takeIf { it.isNotBlank() } ?: ""

    if (endpoint.isBlank()) {
      status.text = "CHEMCHEM TV KENYA • FACEBOOK RTMPS DESTINATION MISSING"
      Toast.makeText(this, "Facebook Server URL + Stream Key are required.", Toast.LENGTH_LONG).show()
      return
    }

    if (!endpoint.startsWith("rtmp://", true) && !endpoint.startsWith("rtmps://", true)) {
      status.text = "CHEMCHEM TV KENYA • INVALID RTMP URL"
      return
    }

    if (mediaUrl.isBlank()) {
      status.text = "CHEMCHEM TV KENYA • NO PROGRAM MEDIA"
      Toast.makeText(this, "The control room must send the actual Program media URL to the encoder.", Toast.LENGTH_LONG).show()
      return
    }

    if (!mediaUrl.startsWith("http://", true) &&
      !mediaUrl.startsWith("https://", true) &&
      !mediaUrl.startsWith("content://", true)
    ) {
      status.text = "CHEMCHEM TV KENYA • INVALID MEDIA URL"
      return
    }

    status.text = "CHEMCHEM TV KENYA • STARTING NATIVE ENCODER"
    startEncoderService()
  }

  private fun startEncoderService() {
    val intent = Intent(this, EncoderService::class.java).apply {
      action = EncoderService.ACTION_START
      putExtra(EncoderService.EXTRA_ENDPOINT, endpoint)
      putExtra(EncoderService.EXTRA_MEDIA_URL, mediaUrl)
      putExtra(EncoderService.EXTRA_KIND, kind)
    }

    try {
      ContextCompat.startForegroundService(this, intent)
      streamStarted = true
      status.text = "CHEMCHEM TV KENYA • FACEBOOK CONNECTING"
    } catch (e: Exception) {
      status.text = "CHEMCHEM TV KENYA • ENCODER START ERROR"
      Toast.makeText(this, e.message ?: "Could not start encoder", Toast.LENGTH_LONG).show()
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
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        try { enterPictureInPictureMode() } catch (_: Exception) {}
      }
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

  override fun onDestroy() {
    try { unregisterReceiver(statusReceiver) } catch (_: Exception) {}
    super.onDestroy()
  }
}
