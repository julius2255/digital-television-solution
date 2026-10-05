package ke.chemchemtv.mobile

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.media.projection.MediaProjectionManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.ContextCompat.registerReceiver

class MainActivity : AppCompatActivity() {
  private lateinit var status: TextView
  private lateinit var server: EditText
  private lateinit var key: EditText
  private lateinit var goButton: Button
  private lateinit var diagnostics: TextView
  private lateinit var programLabel: TextView
  private lateinit var programSource: TextView
  private lateinit var output: FrameLayout
  private var streaming = false
  private var programWebUrl = ""
  private var projectionRequestPending = false
  private val captureRequest = 400

  private val statusReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action != BroadcastService.ACTION_STATUS) return
      val s = intent.getStringExtra(BroadcastService.EXTRA_STATUS).orEmpty()
      val detail = intent.getStringExtra(BroadcastService.EXTRA_DETAIL).orEmpty()
      runOnUiThread {
        diagnostics.text = detail
        when (s) {
          "LIVE" -> { streaming = true; status.text = "● LIVE — FACEBOOK RECEIVING PROGRAM"; status.setTextColor(Color.rgb(25,198,111)); setLiveButton(true) }
          "CONNECTING", "ENCODER_READY" -> { status.text = "● $s"; status.setTextColor(Color.rgb(255,193,7)); setLiveButton(false) }
          "ERROR" -> { streaming = false; status.text = "● STREAM ERROR"; status.setTextColor(Color.rgb(255,80,90)); setLiveButton(false); Toast.makeText(this@MainActivity, detail, Toast.LENGTH_LONG).show() }
          "STOPPED" -> { streaming = false; status.text = "● READY"; status.setTextColor(Color.rgb(102,221,136)); setLiveButton(false) }
        }
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    buildUi()
    handleEncoderIntent(intent)
    if (!hasPermissions()) {
      ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), 10)
    }
  }

  override fun onResume() {
    super.onResume()
    registerReceiver(this, statusReceiver, IntentFilter(BroadcastService.ACTION_STATUS), ContextCompat.RECEIVER_NOT_EXPORTED)
  }

  override fun onPause() {
    unregisterReceiverSafe()
    super.onPause()
  }

  private fun unregisterReceiverSafe() { try { unregisterReceiver(statusReceiver) } catch (_: Exception) {} }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleEncoderIntent(intent)
  }

  private fun buildUi() {
    val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(0xFF07111F.toInt()) }
    output = FrameLayout(this)
    root.addView(output, LinearLayout.LayoutParams(-1, 0, 1f))

    val controls = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(18,12,18,12) }
    server = EditText(this).apply {
      hint = "Facebook Server URL"
      setText(getPreferences(MODE_PRIVATE).getString("server","rtmps://live-api-s.facebook.com:443/rtmp/"))
      setSingleLine(true)
    }
    key = EditText(this).apply {
      hint = "Facebook Stream Key"
      setText(getPreferences(MODE_PRIVATE).getString("key",""))
      setSingleLine(true)
      inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
    }
    controls.addView(server); controls.addView(key)
    programLabel = TextView(this).apply { text="PROGRAM: Standby"; setTextColor(Color.WHITE); textSize=16f; setPadding(0,6,0,0) }
    programSource = TextView(this).apply { text="SOURCE: Waiting for control room"; setTextColor(Color.LTGRAY); textSize=13f }
    diagnostics = TextView(this).apply { text="Engine: waiting for Facebook destination"; setTextColor(Color.LTGRAY); textSize=13f; setPadding(0,6,0,8) }
    controls.addView(programLabel); controls.addView(programSource); controls.addView(diagnostics)
    val row = LinearLayout(this).apply { gravity=Gravity.CENTER_VERTICAL }
    status = TextView(this).apply { text="● READY"; setTextColor(Color.rgb(102,221,136)); textSize=16f }
    goButton = Button(this).apply { text="GO LIVE"; setOnClickListener { toggleLive() } }
    row.addView(status, LinearLayout.LayoutParams(0,-2,1f)); row.addView(goButton); controls.addView(row)
    root.addView(controls, LinearLayout.LayoutParams(-1,-2))
    setContentView(root)
    renderProgramOutput(false)
  }

  private fun handleEncoderIntent(intent: Intent?) {
    val data=intent?.data ?: return
    data.getQueryParameter("server")?.takeIf{it.isNotBlank()}?.let{server.setText(it)}
    data.getQueryParameter("key")?.takeIf{it.isNotBlank()}?.let{key.setText(it)}
    data.getQueryParameter("program")?.let{programLabel.text="PROGRAM: $it"; renderProgramOutput(false)}
    data.getQueryParameter("source")?.let{programSource.text="SOURCE: $it • Facebook program output"}
    programWebUrl=data.getQueryParameter("webUrl").orEmpty()
    diagnostics.text="Control room handoff received. The Android encoder will capture PROGRAM output, not the camera."
  }

  private fun renderProgramOutput(onAir: Boolean) {
    output.removeAllViews()
    if (onAir && programWebUrl.startsWith("http")) {
      val web=WebView(this).apply {
        settings.javaScriptEnabled=true
        settings.mediaPlaybackRequiresUserGesture=false
        settings.domStorageEnabled=true
        webViewClient=WebViewClient()
        loadUrl(programWebUrl)
      }
      output.addView(web, FrameLayout.LayoutParams(-1,-1))
    } else {
      val box=LinearLayout(this).apply {
        orientation=LinearLayout.VERTICAL; gravity=Gravity.CENTER
        setBackgroundColor(Color.BLACK)
      }
      val title=TextView(this).apply { text="CHEMCHEM TV KENYA"; textSize=34f; setTextColor(Color.WHITE); gravity=Gravity.CENTER }
      val sub=TextView(this).apply { text=if(onAir) "● ON AIR\n"+programLabel.text else "PROGRAM OUTPUT\nPreview / standby"; textSize=20f; setTextColor(Color.LTGRAY); gravity=Gravity.CENTER; setPadding(0,16,0,0) }
      box.addView(title); box.addView(sub); output.addView(box, FrameLayout.LayoutParams(-1,-1))
    }
  }

  private fun setLiveButton(live:Boolean) {
    goButton.text=if(live) "■ STOP LIVE" else "GO LIVE"
    goButton.background=GradientDrawable().apply{setColor(if(live) Color.rgb(25,198,111) else Color.rgb(229,43,59));cornerRadius=14f}
    goButton.setTextColor(if(live) Color.rgb(5,25,14) else Color.WHITE)
  }

  private fun toggleLive() {
    if(streaming) {
      stopService(Intent(this, BroadcastService::class.java))
      renderProgramOutput(false)
      return
    }
    val base=server.text.toString().trim()
    val streamKey=key.text.toString().trim()
    if(base.isBlank()||streamKey.isBlank()) { Toast.makeText(this,"Enter the Facebook Server URL and Stream Key",Toast.LENGTH_LONG).show(); return }
    if(!hasInternet()) { diagnostics.text="RTMP ERROR: no validated internet connection"; return }
    if(!base.startsWith("rtmps://")&&!base.startsWith("rtmp://")) { diagnostics.text="RTMP ERROR: invalid server URL"; return }
    getPreferences(MODE_PRIVATE).edit().putString("server",base).putString("key",streamKey).apply()
    val endpoint=base.trimEnd('/')+"/"+streamKey.trimStart('/')
    projectionRequestPending=true
    val manager=getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    startActivityForResult(manager.createScreenCaptureIntent(),captureRequest)
  }

  @Deprecated("Android API compatibility")
  override fun onActivityResult(requestCode:Int,resultCode:Int,data:Intent?) {
    super.onActivityResult(requestCode,resultCode,data)
    if(requestCode!=captureRequest) return
    projectionRequestPending=false
    if(resultCode!=Activity.RESULT_OK||data==null) {
      diagnostics.text="Screen capture permission was cancelled. Facebook cannot receive PROGRAM video without it."
      return
    }
    renderProgramOutput(true)
    val endpoint=server.text.toString().trim().trimEnd('/')+"/"+key.text.toString().trim().trimStart('/')
    val serviceIntent=Intent(this,BroadcastService::class.java).apply {
      putExtra(BroadcastService.EXTRA_PROJECTION,data)
      putExtra("projection_result",resultCode)
      putExtra(BroadcastService.EXTRA_ENDPOINT,endpoint)
    }
    ContextCompat.startForegroundService(this,serviceIntent)
    status.text="● STARTING PROGRAM ENCODER..."
    status.setTextColor(Color.rgb(255,193,7))
    diagnostics.text="Screen capture granted. Starting H.264/AAC PROGRAM encoder and Facebook RTMPS."
  }

  private fun hasInternet():Boolean {
    val cm=getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
    val n=cm.activeNetwork ?: return false
    val c=cm.getNetworkCapabilities(n) ?: return false
    return c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)&&c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
  }

  private fun hasPermissions():Boolean =
    ContextCompat.checkSelfPermission(this,Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED

  override fun onDestroy(){ unregisterReceiverSafe(); super.onDestroy() }
}
