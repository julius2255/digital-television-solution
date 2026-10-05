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
import android.widget.ScrollView
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
    mediaName.text = "PROGRAM • " + (uri.lastPathSegment ?: "Selected video")
    preview.setVideoURI(uri)
    preview.setOnPreparedListener { mp -> mp.isLooping = true; mp.start() }
    status.text = "READY • PROGRAM LOADED"
  }

  private val statusReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      val value = intent?.getStringExtra(EncoderService.EXTRA_STATUS) ?: return
      runOnUiThread {
        status.text = value
        when {
          value == "LIVE" || value.startsWith("LIVE •") -> {
            live = true
            startButton.text = "STOP LIVE"
          }
          value.startsWith("ERROR") || value == "DISCONNECTED" || value.contains("REJECTED") -> {
            live = false
            startButton.text = "START LIVE"
          }
        }
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    buildStudio()
    ContextCompat.registerReceiver(this, statusReceiver, IntentFilter(EncoderService.ACTION_STATUS), ContextCompat.RECEIVER_NOT_EXPORTED)
  }

  private fun buildStudio() {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(14, 12, 14, 12)
      setBackgroundColor(0xFF07090D.toInt())
    }

    val header = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    val title = TextView(this).apply {
      text = "CHEMCHEM TV KENYA"
      textSize = 21f
      setTextColor(0xFFFFFFFF.toInt())
    }
    header.addView(title, LinearLayout.LayoutParams(0, -2, 1f))
    header.addView(TextView(this).apply {
      text = "● OFFLINE"
      textSize = 12f
      setTextColor(0xFFB0B7C3.toInt())
    })
    root.addView(header)

    val tabs = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      setPadding(0, 10, 0, 8)
    }
    listOf("PREVIEW", "PROGRAM").forEach {
      tabs.addView(TextView(this).apply {
        text = it
        textSize = 12f
        setTextColor(0xFFFFFFFF.toInt())
        gravity = Gravity.CENTER
        setBackgroundColor(0xFF171C24.toInt())
        setPadding(18, 10, 18, 10)
      }, LinearLayout.LayoutParams(0, -2, 1f).apply { setMargins(3, 0, 3, 0) })
    }
    root.addView(tabs)

    preview = VideoView(this).apply { setBackgroundColor(0xFF000000.toInt()) }
    root.addView(preview, LinearLayout.LayoutParams(-1, 240))

    mediaName = TextView(this).apply {
      text = "PROGRAM • No media selected"
      textSize = 12f
      setTextColor(0xFFD7DCE5.toInt())
      setPadding(4, 9, 4, 5)
    }
    root.addView(mediaName)

    val sourceRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    sourceRow.addView(Button(this).apply {
      text = "VIDEO"
      setOnClickListener { picker.launch(arrayOf("video/mp4", "video/*")) }
    }, LinearLayout.LayoutParams(0, -2, 1f))
    sourceRow.addView(Button(this).apply {
      text = "IMAGE"
      setOnClickListener { status.text = "IMAGE SOURCE • NEXT STUDIO MODULE" }
    }, LinearLayout.LayoutParams(0, -2, 1f))
    sourceRow.addView(Button(this).apply {
      text = "LAYERS"
      setOnClickListener { status.text = "LAYERS • NEXT STUDIO MODULE" }
    }, LinearLayout.LayoutParams(0, -2, 1f))
    root.addView(sourceRow)

    val controls = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    controls.addView(Button(this).apply {
      text = "CUT"
      setOnClickListener { status.text = "CUT • PROGRAM SOURCE ACTIVE" }
    }, LinearLayout.LayoutParams(0, -2, 1f))
    controls.addView(Button(this).apply {
      text = "FADE"
      setOnClickListener { status.text = "FADE • PROGRAM TRANSITION" }
    }, LinearLayout.LayoutParams(0, -2, 1f))
    controls.addView(Button(this).apply {
      text = "PLAYLIST"
      setOnClickListener { status.text = "PLAYLIST • NEXT STUDIO MODULE" }
    }, LinearLayout.LayoutParams(0, -2, 1f))
    root.addView(controls)

    serverInput = EditText(this).apply {
      hint = "Facebook RTMPS Server"
      setText("rtmps://live-api-s.facebook.com:443/rtmp/")
      setTextColor(0xFFFFFFFF.toInt())
      setHintTextColor(0xFF7F8794.toInt())
      isSingleLine = true
    }
    root.addView(serverInput)

    keyInput = EditText(this).apply {
      hint = "Facebook Stream Key"
      inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
      setTextColor(0xFFFFFFFF.toInt())
      setHintTextColor(0xFF7F8794.toInt())
      isSingleLine = true
    }
    root.addView(keyInput)

    startButton = Button(this).apply {
      text = "START LIVE"
      setOnClickListener { toggleLive() }
    }
    root.addView(startButton)

    status = TextView(this).apply {
      text = "READY • SELECT A VIDEO"
      textSize = 13f
      setTextColor(0xFFFFFFFF.toInt())
      gravity = Gravity.CENTER
      setPadding(4, 8, 4, 6)
    }
    root.addView(status)

    root.addView(TextView(this).apply {
      text = "Native broadcast engine • H.264 + AAC • RTMPS\nOnly the encoded Program output is sent to Facebook. The phone screen is never broadcast."
      textSize = 10f
      setTextColor(0xFF8E96A3.toInt())
      gravity = Gravity.CENTER
      setPadding(4, 2, 4, 4)
    })

    val scroll = ScrollView(this)
    scroll.addView(root)
    setContentView(scroll)
  }

  private fun toggleLive() {
    if (live) {
      stopService(Intent(this, EncoderService::class.java).setAction(EncoderService.ACTION_STOP))
      live = false
      startButton.text = "START LIVE"
      status.text = "STOPPED"
      return
    }

    val uri = selectedUri
    if (uri == null) {
      status.text = "ERROR • SELECT A PROGRAM VIDEO FIRST"
      return
    }

    val server = serverInput.text.toString().trim()
    val key = keyInput.text.toString().trim()
    if (server.isBlank() || key.isBlank()) {
      status.text = "ERROR • ENTER FACEBOOK STREAM KEY"
      return
    }

    val endpoint = server.trimEnd('/') + "/" + key.trimStart('/')
    if (!endpoint.startsWith("rtmp://") && !endpoint.startsWith("rtmps://")) {
      status.text = "ERROR • INVALID RTMP/RTMPS SERVER"
      return
    }

    val intent = Intent(this, EncoderService::class.java).apply {
      action = EncoderService.ACTION_START
      putExtra(EncoderService.EXTRA_ENDPOINT, endpoint)
      putExtra(EncoderService.EXTRA_MEDIA_URL, uri.toString())
      putExtra(EncoderService.EXTRA_KIND, "VIDEO")
    }

    try {
      ContextCompat.startForegroundService(this, intent)
      status.text = "CONNECTING • FACEBOOK RTMPS"
      startButton.text = "CONNECTING..."
    } catch (e: Exception) {
      status.text = "ERROR • " + (e.message ?: "encoder start failed")
    }
  }

  override fun onDestroy() {
    try { unregisterReceiver(statusReceiver) } catch (_: Exception) {}
    super.onDestroy()
  }
}
