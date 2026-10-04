package ke.chemchemtv.mobile

import android.Manifest
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.util.Log
import android.text.InputType
import android.view.Gravity
import android.widget.*
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
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
  private lateinit var goButton: Button
  private lateinit var diagnostics: TextView
  private var streaming = false
  private var encodersReady = false

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
      hint = "Facebook Server URL"
      setText(getPreferences(MODE_PRIVATE).getString("server", "rtmps://live-api-s.facebook.com:443/rtmp/"))
      setSingleLine(true)
    }
    key = EditText(this).apply {
      hint = "Facebook Stream Key"
      setText(getPreferences(MODE_PRIVATE).getString("key", ""))
      setSingleLine(true)
      inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
    }
    controls.addView(server)
    controls.addView(key)
    diagnostics = TextView(this).apply {
      text = "Engine diagnostics: waiting"
      setTextColor(Color.LTGRAY)
      textSize = 13f
      setPadding(0, 8, 0, 8)
    }
    controls.addView(diagnostics)

    val row = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
    status = TextView(this).apply {
      text = "● READY"
      setTextColor(Color.rgb(102, 221, 136))
      textSize = 16f
    }
    goButton = Button(this).apply {
      text = "GO LIVE"
      setOnClickListener { toggleLive() }
    }
    row.addView(status, LinearLayout.LayoutParams(0, -2, 1f))
    row.addView(goButton)
    controls.addView(row)
    root.addView(controls, LinearLayout.LayoutParams(-1, -2))
    setContentView(root)

    stream = RtmpStream(this, this)
    val videoPrepared = try { stream.prepareVideo(1920, 1080, 4500 * 1000, 30) } catch (e: Exception) { Log.e("CHEMCHEM_RTMP", "Video preparation failed", e); false }
    val audioPrepared = try { stream.prepareAudio(44100, true, 128 * 1000) } catch (e: Exception) { Log.e("CHEMCHEM_RTMP", "Audio preparation failed", e); false }
    encodersReady = videoPrepared && audioPrepared
    diagnostics.text = if (encodersReady) "Engine diagnostics: H.264 1080p30 + AAC 44.1kHz ready" else "Engine diagnostics: encoder preparation failed — check MediaCodec support"
    stream.startPreview(preview)
  }

  private fun setLiveButton(live: Boolean) {
    if (!::goButton.isInitialized) return
    goButton.text = if (live) "● LIVE — CONNECTED" else "GO LIVE"
    val color = if (live) Color.rgb(25, 198, 111) else Color.rgb(229, 43, 59)
    goButton.background = GradientDrawable().apply { setColor(color); cornerRadius = 14f }
    goButton.setTextColor(if (live) Color.rgb(5, 25, 14) else Color.WHITE)
  }

  private fun toggleLive() {
    if (streaming) {
      stream.stopStream()
      setLiveButton(false)
      return
    }
    val base = server.text.toString().trim()
    val streamKey = key.text.toString().trim()
    if (!encodersReady) {
      Toast.makeText(this, "Video/audio encoders are not ready", Toast.LENGTH_LONG).show()
      return
    }
    if (!hasInternet()) {
      Toast.makeText(this, "No validated internet connection", Toast.LENGTH_LONG).show()
      diagnostics.text = "RTMP ERROR: no validated internet connection"
      return
    }
    if (base.isEmpty()) {
      Toast.makeText(this, "Enter an RTMPS/RTMP ingest URL or server URL", Toast.LENGTH_SHORT).show()
      return
    }
    val endpoint = if (streamKey.isEmpty()) {
      base
    } else {
      base.trimEnd('/') + "/" + streamKey.trimStart('/')
    }
    if (streamKey.isEmpty() && base.contains("facebook.com", ignoreCase = true)) {
      Toast.makeText(this, "Paste the Facebook Stream Key", Toast.LENGTH_LONG).show()
      return
    }
    getPreferences(MODE_PRIVATE).edit().putString("server", base).putString("key", streamKey).apply()
    if (!endpoint.startsWith("rtmps://", ignoreCase = true) && !endpoint.startsWith("rtmp://", ignoreCase = true)) {
      Toast.makeText(this, "Use a valid rtmps:// or rtmp:// ingest endpoint", Toast.LENGTH_LONG).show()
      return
    }
    diagnostics.text = "RTMPS handshake starting"
    stream.startStream(endpoint)
    setLiveButton(false)
    status.text = "● CONNECTING TO FACEBOOK..."
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == 10 && !hasPermissions()) {
      status.text = "● CAMERA/MIC PERMISSION REQUIRED"
      status.setTextColor(Color.rgb(255, 80, 90))
      diagnostics.text = "Grant camera and microphone permissions, then reopen CHEMCHEM TV KENYA"
      goButton.isEnabled = false
    } else if (requestCode == 10) {
      goButton.isEnabled = true
      diagnostics.text = "Permissions granted — encoder can be prepared"
    }
  }

  private fun hasInternet(): Boolean {
    val cm = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
    val n = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(n) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
  }

  private fun hasPermissions(): Boolean =
    ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED &&
    ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

  override fun onConnectionStarted(url: String) { runOnUiThread { status.text = "● CONNECTING..."; diagnostics.text = "RTMPS handshake started" } }
  override fun onConnectionSuccess() { streaming = true; runOnUiThread { status.text = "● LIVE — CONNECTED"; status.setTextColor(Color.rgb(25, 198, 111)); diagnostics.text = "Facebook accepted the RTMPS connection; media is being sent"; setLiveButton(true) } }
  override fun onConnectionFailed(reason: String) {
    streaming = false
    runOnUiThread {
      status.text = "● CONNECTION FAILED"
      status.setTextColor(Color.rgb(255, 80, 90)); diagnostics.text = "RTMP ERROR: " + reason; setLiveButton(false)
      Toast.makeText(this, reason, Toast.LENGTH_LONG).show()
    }
  }
  override fun onNewBitrate(bitrate: Long) { runOnUiThread { status.text = "● LIVE — CONNECTED  " + (bitrate / 1000) + " kbps"; status.setTextColor(Color.rgb(25, 198, 111)) } }
  override fun onDisconnect() { streaming = false; runOnUiThread { status.text = "● READY"; status.setTextColor(Color.rgb(102, 221, 136)); diagnostics.text = "RTMP connection closed"; setLiveButton(false) } }
  override fun onAuthError() { streaming = false; runOnUiThread { status.text = "● FACEBOOK AUTH ERROR"; status.setTextColor(Color.rgb(255, 80, 90)); diagnostics.text = "Facebook rejected the stream credentials"; setLiveButton(false) } }
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
