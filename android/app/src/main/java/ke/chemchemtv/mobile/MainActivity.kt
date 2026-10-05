package ke.chemchemtv.mobile

import android.Manifest
import android.app.Activity
import android.content.*
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.media.projection.MediaProjectionManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
  private lateinit var status: TextView
  private lateinit var server: EditText
  private lateinit var key: EditText
  private lateinit var programUrl: EditText
  private lateinit var programName: EditText
  private lateinit var goButton: Button
  private lateinit var diagnostics: TextView
  private lateinit var output: FrameLayout
  private lateinit var controls: LinearLayout
  private var streaming = false
  private val captureRequest = 400
  private val prefs by lazy { getSharedPreferences("encoder", MODE_PRIVATE) }

  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action != BroadcastService.ACTION_STATUS) return
      val state = intent.getStringExtra(BroadcastService.EXTRA_STATUS).orEmpty()
      val detail = intent.getStringExtra(BroadcastService.EXTRA_DETAIL).orEmpty()
      runOnUiThread {
        diagnostics.text = detail
        when (state) {
          "CONNECTING", "ENCODER_READY" -> {
            status.text = "● " + state
            status.setTextColor(Color.rgb(255,193,7))
            setLiveButton(false)
          }
          "LIVE" -> {
            streaming = true
            status.text = "● LIVE — VIDEO + AUDIO SENDING"
            status.setTextColor(Color.rgb(40,210,120))
            setLiveButton(true)
            showCleanProgram()
          }
          "ERROR" -> {
            streaming = false
            status.text = "● STREAM ERROR"
            status.setTextColor(Color.rgb(255,80,90))
            setLiveButton(false)
            showControls()
            Toast.makeText(this@MainActivity, detail, Toast.LENGTH_LONG).show()
          }
          "STOPPED" -> {
            streaming = false
            status.text = "● READY"
            status.setTextColor(Color.rgb(100,220,135))
            setLiveButton(false)
            showControls()
          }
        }
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    buildUi()
    handleIntent(intent)
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), 10)
    }
  }

  override fun onResume() {
    super.onResume()
    ContextCompat.registerReceiver(this, receiver, IntentFilter(BroadcastService.ACTION_STATUS), ContextCompat.RECEIVER_NOT_EXPORTED)
  }

  override fun onPause() {
    try { unregisterReceiver(receiver) } catch (_: Exception) {}
    super.onPause()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleIntent(intent)
  }

  private fun buildUi() {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.rgb(5,10,18))
    }
    output = FrameLayout(this)
    root.addView(output, LinearLayout.LayoutParams(-1,0,1f))

    controls = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(18,10,18,10)
      setBackgroundColor(Color.rgb(8,18,30))
    }

    server = field("Facebook RTMPS Server", prefs.getString("server","rtmps://live-api-s.facebook.com:443/rtmp/").orEmpty())
    key = field("Facebook Stream Key", prefs.getString("key","").orEmpty()).apply {
      inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
    }
    programName = field("Program name", prefs.getString("programName","CHEMCHEM TV KENYA — PROGRAM").orEmpty())
    programUrl = field("Program Output URL (optional)", prefs.getString("programUrl","").orEmpty())
    controls.addView(server)
    controls.addView(key)
    controls.addView(programName)
    controls.addView(programUrl)

    diagnostics = TextView(this).apply {
      text = "Engine ready. Facebook will receive the clean Program Output."
      setTextColor(Color.LTGRAY)
      textSize = 13f
      setPadding(0,6,0,6)
    }
    controls.addView(diagnostics)

    val row = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
    status = TextView(this).apply {
      text = "● READY"
      textSize = 16f
      setTextColor(Color.rgb(100,220,135))
    }
    goButton = Button(this).apply {
      text = "GO LIVE"
      setOnClickListener { toggleLive() }
    }
    row.addView(status, LinearLayout.LayoutParams(0,-2,1f))
    row.addView(goButton)
    controls.addView(row)
    root.addView(controls, LinearLayout.LayoutParams(-1,-2))
    setContentView(root)
    renderProgram(false)
  }

  private fun field(hint: String, value: String) = EditText(this).apply {
    this.hint = hint
    setText(value)
    setSingleLine(true)
    setTextColor(Color.WHITE)
    setHintTextColor(Color.GRAY)
  }

  private fun handleIntent(intent: Intent?) {
    val data = intent?.data ?: return
    data.getQueryParameter("server")?.takeIf { it.isNotBlank() }?.let { server.setText(it) }
    data.getQueryParameter("key")?.takeIf { it.isNotBlank() }?.let { key.setText(it) }
    data.getQueryParameter("program")?.takeIf { it.isNotBlank() }?.let { programName.setText(it) }
    data.getQueryParameter("webUrl")?.takeIf { it.isNotBlank() }?.let { programUrl.setText(it) }
    diagnostics.text = "Control-room handoff received. Program output is ready for Facebook encoding."
    renderProgram(false)
  }

  private fun renderProgram(onAir: Boolean) {
    output.removeAllViews()
    val url = programUrl.text.toString().trim()
    if (url.startsWith("http://") || url.startsWith("https://")) {
      val web = WebView(this).apply {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        webViewClient = WebViewClient()
        loadUrl(url)
      }
      output.addView(web, FrameLayout.LayoutParams(-1,-1))
    } else {
      val box = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(Color.BLACK)
      }
      val title = TextView(this).apply {
        text = "CHEMCHEM TV KENYA"
        textSize = 34f
        gravity = Gravity.CENTER
        setTextColor(Color.WHITE)
      }
      val sub = TextView(this).apply {
        text = if (onAir) "● ON AIR\n" + programName.text else "PROGRAM OUTPUT\nReady"
        textSize = 22f
        gravity = Gravity.CENTER
        setTextColor(Color.LTGRAY)
      }
      box.addView(title)
      box.addView(sub)
      output.addView(box, FrameLayout.LayoutParams(-1,-1))
    }
  }

  private fun showCleanProgram() {
    controls.visibility = View.GONE
    renderProgram(true)
  }

  private fun showControls() {
    controls.visibility = View.VISIBLE
    renderProgram(false)
  }

  private fun setLiveButton(live: Boolean) {
    goButton.text = if (live) "■ STOP LIVE" else "GO LIVE"
    goButton.background = GradientDrawable().apply {
      setColor(if (live) Color.rgb(30,190,105) else Color.rgb(220,40,55))
      cornerRadius = 14f
    }
    goButton.setTextColor(Color.WHITE)
  }

  private fun toggleLive() {
    if (streaming) {
      startService(Intent(this, BroadcastService::class.java).setAction(BroadcastService.ACTION_STOP))
      return
    }

    val base = server.text.toString().trim()
    val streamKey = key.text.toString().trim()
    if (base.isBlank() || streamKey.isBlank()) {
      Toast.makeText(this,"Enter the Facebook Server URL and Stream Key.",Toast.LENGTH_LONG).show()
      return
    }
    if (!base.startsWith("rtmps://") && !base.startsWith("rtmp://")) {
      diagnostics.text = "RTMP ERROR: invalid server URL."
      return
    }
    if (!hasInternet()) {
      diagnostics.text = "RTMP ERROR: no validated internet connection."
      return
    }

    prefs.edit()
      .putString("server",base)
      .putString("key",streamKey)
      .putString("programName",programName.text.toString())
      .putString("programUrl",programUrl.text.toString())
      .apply()

    val projectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    startActivityForResult(projectionManager.createScreenCaptureIntent(),captureRequest)
  }

  @Deprecated("Android API compatibility")
  override fun onActivityResult(requestCode:Int,resultCode:Int,data:Intent?) {
    super.onActivityResult(requestCode,resultCode,data)
    if (requestCode != captureRequest) return
    if (resultCode != Activity.RESULT_OK || data == null) {
      diagnostics.text = "Screen capture permission was cancelled. No video will be sent."
      return
    }

    val endpoint = server.text.toString().trim().trimEnd('/') + "/" + key.text.toString().trim().trimStart('/')
    val serviceIntent = Intent(this,BroadcastService::class.java).apply {
      putExtra(BroadcastService.EXTRA_PROJECTION,data)
      putExtra(BroadcastService.EXTRA_PROJECTION_RESULT,resultCode)
      putExtra(BroadcastService.EXTRA_ENDPOINT,endpoint)
    }
    showCleanProgram()
    ContextCompat.startForegroundService(this,serviceIntent)
    status.text = "● STARTING ENCODER..."
    status.setTextColor(Color.rgb(255,193,7))
    diagnostics.text = "Screen capture approved. Starting H.264 720p30 + AAC and Facebook RTMPS."
  }

  private fun hasInternet():Boolean {
    val cm = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
    val n = cm.activeNetwork ?: return false
    val c = cm.getNetworkCapabilities(n) ?: return false
    return c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
      c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
  }

  override fun onDestroy() {
    try { unregisterReceiver(receiver) } catch (_: Exception) {}
    super.onDestroy()
  }
}