package ke.chemchemtv.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.VideoView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
  private lateinit var preview: VideoView
  private lateinit var status: TextView
  private lateinit var mediaName: TextView
  private lateinit var serverInput: EditText
  private lateinit var keyInput: EditText
  private lateinit var startButton: Button
  private var selectedUri: Uri? = null
  private var live = false

  private val picker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
    if (uri == null) return@registerForActivityResult
    try { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (_: Exception) {}
    selectedUri = uri
    mediaName.text = "PROGRAM: " + (uri.lastPathSegment ?: "Selected video")
    preview.setVideoURI(uri)
    preview.setOnPreparedListener { mp -> mp.isLooping = true; mp.start() }
    status.text = "CHEMCHEM TV KENYA • PROGRAM READY"
  }

  private val statusReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      val value = intent?.getStringExtra(EncoderService.EXTRA_STATUS) ?: return
      runOnUiThread {
        status.text = "CHEMCHEM TV KENYA • " + value
        when {
          value == "LIVE" || value.startsWith("LIVE •") -> { live = true; startButton.text = "STOP LIVE" }
          value.startsWith("ERROR") || value == "DISCONNECTED" || value.contains("REJECTED") -> { live = false; startButton.text = "START LIVE" }
        }
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    buildUi()
    ContextCompat.registerReceiver(this, statusReceiver, IntentFilter(EncoderService.ACTION_STATUS), ContextCompat.RECEIVER_NOT_EXPORTED)
  }

  private fun buildUi() {
    val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(18,18,18,18); setBackgroundColor(0xFF080808.toInt()) }
    val title = TextView(this).apply { text = "CHEMCHEM TV KENYA"; textSize = 24f; setTextColor(0xFFFFFFFF.toInt()); gravity = Gravity.CENTER; setPadding(0,8,0,14) }
    root.addView(title)
    preview = VideoView(this).apply { setBackgroundColor(0xFF000000.toInt()) }
    root.addView(preview, LinearLayout.LayoutParams(-1,0,1.0f))
    mediaName = TextView(this).apply { text = "PROGRAM: No video selected"; textSize = 13f; setTextColor(0xFFDDDDDD.toInt()); setPadding(4,12,4,8) }
    root.addView(mediaName)
    val choose = Button(this).apply { text = "SELECT PROGRAM VIDEO"; setOnClickListener { picker.launch(arrayOf("video/mp4","video/*")) } }
    root.addView(choose)
    serverInput = EditText(this).apply { hint = "Facebook RTMPS Server"; setText("rtmps://live-api-s.facebook.com:443/rtmp/"); setTextColor(0xFFFFFFFF.toInt()); setHintTextColor(0xFF888888.toInt()); singleLine = true }
    root.addView(serverInput)
    keyInput = EditText(this).apply { hint = "Facebook Stream Key"; inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD; setTextColor(0xFFFFFFFF.toInt()); setHintTextColor(0xFF888888.toInt()); singleLine = true }
    root.addView(keyInput)
    startButton = Button(this).apply { text = "START LIVE"; setOnClickListener { toggleLive() } }
    root.addView(startButton)
    status = TextView(this).apply { text = "CHEMCHEM TV KENYA • READY"; textSize = 14f; setTextColor(0xFFFFFFFF.toInt()); gravity = Gravity.CENTER; setPadding(4,12,4,10) }
    root.addView(status)
    val note = TextView(this).apply { text = "Native H.264 + AAC encoder • Facebook RTMPS\nThe APK broadcasts the selected Program video — it does not share the phone screen."; textSize = 11f; setTextColor(0xFF999999.toInt()); gravity = Gravity.CENTER; setPadding(4,4,4,8) }
    root.addView(note)
    setContentView(root)
  }

  private fun toggleLive() {
    if (live) {
      stopService(Intent(this, EncoderService::class.java).setAction(EncoderService.ACTION_STOP))
      live = false; startButton.text = "START LIVE"; status.text = "CHEMCHEM TV KENYA • STOPPED"; return
    }
    val uri = selectedUri
    if (uri == null) { status.text = "CHEMCHEM TV KENYA • SELECT A PROGRAM VIDEO"; return }
    val server = serverInput.text.toString().trim()
    val key = keyInput.text.toString().trim()
    if (server.isBlank() || key.isBlank()) { status.text = "CHEMCHEM TV KENYA • ENTER FACEBOOK STREAM KEY"; return }
    val endpoint = server.trimEnd('/') + "/" + key.trimStart('/')
    if (!endpoint.startsWith("rtmp://") && !endpoint.startsWith("rtmps://")) { status.text = "CHEMCHEM TV KENYA • INVALID RTMP SERVER"; return }
    val intent = Intent(this, EncoderService::class.java).apply {
      action = EncoderService.ACTION_START
      putExtra(EncoderService.EXTRA_ENDPOINT, endpoint)
      putExtra(EncoderService.EXTRA_MEDIA_URL, uri.toString())
      putExtra(EncoderService.EXTRA_KIND, "VIDEO")
    }
    try {
      ContextCompat.startForegroundService(this, intent)
      status.text = "CHEMCHEM TV KENYA • CONNECTING TO FACEBOOK"
      startButton.text = "CONNECTING..."
    } catch (e: Exception) { status.text = "CHEMCHEM TV KENYA • ERROR: " + (e.message ?: "encoder start failed") }
  }

  override fun onDestroy() { try { unregisterReceiver(statusReceiver) } catch (_: Exception) {}; super.onDestroy() }
}