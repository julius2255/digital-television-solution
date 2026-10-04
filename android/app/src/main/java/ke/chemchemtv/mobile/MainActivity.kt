package ke.chemchemtv.mobile

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.pedro.common.ConnectChecker
import com.pedro.library.rtmp.RtmpStream
import com.pedro.library.view.OpenGlView

class MainActivity : AppCompatActivity(), ConnectChecker {
  private lateinit var stream: RtmpStream
  private lateinit var status: TextView
  private lateinit var server: EditText
  private lateinit var key: EditText
  private var streaming = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (!hasPermissions()) {
      ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO), 10)
    }

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(0xFF07111F.toInt())
    }
    val preview = OpenGlView(this)
    root.addView(preview, LinearLayout.LayoutParams(-1, 0, 1f))

    val controls = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(20, 14, 20, 14)
    }
    server = EditText(this).apply {
      hint = "Facebook RTMPS server URL (from Live Producer)"
      setSingleLine(true)
    }
    key = EditText(this).apply {
      hint = "Facebook stream key"
      setSingleLine(true)
      inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
    }
    controls.addView(server)
    controls.addView(key)

    val row = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
    status = TextView(this).apply {
      text = "● READY"
      setTextColor(0xFF66DD88.toInt())
      textSize = 16f
    }
    val go = Button(this).apply {
      text = "GO LIVE"
      setOnClickListener { toggleLive() }
    }
    row.addView(status, LinearLayout.LayoutParams(0, -2, 1f))
    row.addView(go)
    controls.addView(row)
    root.addView(controls, LinearLayout.LayoutParams(-1, -2))
    setContentView(root)

    stream = RtmpStream(this, this)
    stream.prepareVideo(1920, 1080, 4500 * 1000, 30)
    stream.prepareAudio(44100, true, 128 * 1000)
    stream.startPreview(preview)
  }

  private fun toggleLive() {
    if (streaming) {
      stream.stopStream()
      return
    }
    val base = server.text.toString().trim()
    val streamKey = key.text.toString().trim()
    if (base.isEmpty() || streamKey.isEmpty()) {
      Toast.makeText(this, "Enter RTMP server and stream key", Toast.LENGTH_SHORT).show()
      return
    }
    val normalized = base.trimEnd()
    val endpoint = normalized + "/" + streamKey
    if (!endpoint.startsWith("rtmps://", ignoreCase = true) && !endpoint.startsWith("rtmp://", ignoreCase = true)) {
      Toast.makeText(this, "Use the exact RTMPS/RTMP URL from Facebook Live Producer", Toast.LENGTH_LONG).show()
      return
    }
    stream.startStream(endpoint)
    status.text = "● CONNECTING TO FACEBOOK..."
  }

  private fun hasPermissions(): Boolean =
    ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED &&
    ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

  override fun onConnectionStarted(url: String) { runOnUiThread { status.text = "● CONNECTING..." } }
  override fun onConnectionSuccess() { streaming = true; runOnUiThread { status.text = "● LIVE" } }
  override fun onConnectionFailed(reason: String) {
    streaming = false
    runOnUiThread {
      status.text = "● FAILED"
      Toast.makeText(this, reason, Toast.LENGTH_LONG).show()
    }
  }
  override fun onNewBitrate(bitrate: Long) { runOnUiThread { status.text = "● LIVE  " + (bitrate / 1000) + " kbps" } }
  override fun onDisconnect() { streaming = false; runOnUiThread { status.text = "● READY" } }
  override fun onAuthError() { streaming = false; runOnUiThread { status.text = "● AUTH ERROR" } }
  override fun onAuthSuccess() {}
  override fun onDestroy() {
    if (::stream.isInitialized) {
      if (stream.isStreaming) stream.stopStream()
      if (stream.isOnPreview) stream.stopPreview()
      stream.release()
    }
    super.onDestroy()
  }
}
