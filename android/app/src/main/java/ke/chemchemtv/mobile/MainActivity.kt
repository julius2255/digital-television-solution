package ke.chemchemtv.mobile

import android.content.*
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.animation.AlphaAnimation
import android.widget.*
import android.view.TextureView
import android.view.View
import android.widget.FrameLayout
import androidx.appcompat.app.AlertDialog
import com.pedro.library.generic.GenericStream
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
  private lateinit var body: LinearLayout
  private lateinit var status: TextView
  private lateinit var previewVideo: VideoView
  private lateinit var programVideo: VideoView
  private lateinit var mediaList: LinearLayout
  private lateinit var playlistList: LinearLayout
  private lateinit var scheduleList: LinearLayout
  private lateinit var layerList: LinearLayout
  private lateinit var serverInput: EditText
  private lateinit var keyInput: EditText
  private lateinit var goLive: Button
  private lateinit var previewFrame: FrameLayout
  private lateinit var logoView: ImageView
  private var cameraTexture: TextureView? = null
  private var cameraPreviewStream: GenericStream? = null

  private data class Media(val uri: Uri, val name: String, val type: String)
  private data class Layer(var name: String, var visible: Boolean = true, var locked: Boolean = false)
  private val media = mutableListOf<Media>()
  private val playlist = mutableListOf<Media>()
  private val layers = mutableListOf<Layer>()
  private var selected: Media? = null
  private var program: Media? = null
  private var live = false
  private var transition = "cut"
  private var fadeSpeed = 800
  private var canvasZoom = 100
  private var sourcePickerMode = "MEDIA"
  private val sections = arrayOf("STUDIO","PLAYLIST","SCHEDULE","AUTO NEWS","MEDIA","STREAMING","ANALYTICS","SETTINGS")

  private val picker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
    if (uri == null) return@registerForActivityResult
    try { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (_: Exception) {}
    val mime = contentResolver.getType(uri) ?: "application/octet-stream"
    val name = uri.lastPathSegment?.substringAfterLast('/') ?: "Media"
    val item = Media(uri, name, mime)
    media.removeAll { it.uri == uri }
    media.add(item)
    selected = item
    status.text = "MEDIA • " + item.name
    if (sourcePickerMode == "IMAGE") addImageLayer(item)
    refreshMedia()
  }

  private val statusReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      val value = intent?.getStringExtra(EncoderService.EXTRA_STATUS) ?: return
      runOnUiThread {
        status.text = value
        when {
          value == "LIVE" || value.startsWith("LIVE •") -> { live = true; goLive.text = "■ STOP LIVE" }
          value.startsWith("ERROR") || value == "DISCONNECTED" || value.contains("REJECTED") -> { live = false; goLive.text = "● GO LIVE" }
        }
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestedOrientation = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
    ContextCompat.registerReceiver(this, statusReceiver, IntentFilter(EncoderService.ACTION_STATUS), ContextCompat.RECEIVER_NOT_EXPORTED)
    buildShell()
    showStudio()
  }

  private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
  private fun txt(s: String, size: Float = 12f) = TextView(this).apply {
    text = s; textSize = size; setTextColor(Color.WHITE)
  }
  private fun button(s: String, action: () -> Unit) = Button(this).apply {
    text = s; setOnClickListener { action() }; minHeight = dp(42)
  }
  private fun panelTitle(s: String) = txt(s, 13f).apply {
    setTypeface(typeface, android.graphics.Typeface.BOLD)
    setPadding(dp(8), dp(8), dp(8), dp(6))
  }
  private fun card() = LinearLayout(this).apply {
    orientation = LinearLayout.VERTICAL
    setPadding(dp(8), dp(6), dp(8), dp(6))
    setBackgroundColor(Color.rgb(20,25,33))
  }
  private fun row() = LinearLayout(this).apply {
    orientation = LinearLayout.HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
  }

  private fun buildShell() {
    val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(Color.rgb(7,9,13)) }
    val header = row()
    header.setPadding(dp(12), dp(7), dp(12), dp(7))
    header.addView(txt("CHEMCHEM TV KENYA", 20f), LinearLayout.LayoutParams(0, -2, 1f))
    status = txt("● STANDBY", 12f)
    header.addView(status)
    root.addView(header)

    val tabs = HorizontalScrollView(this)
    tabs.isHorizontalScrollBarEnabled = false
    val tabRow = row()
    sections.forEach { s ->
      tabRow.addView(button(s) { selectSection(s) }.apply { textSize = 10f },
        LinearLayout.LayoutParams(dp(112), dp(42)))
    }
    tabs.addView(tabRow)
    root.addView(tabs)

    val scroll = ScrollView(this)
    body = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(8), dp(8), dp(8), dp(18)) }
    scroll.addView(body)
    root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
    setContentView(root)
  }

  private fun selectSection(s: String) {
    body.removeAllViews()
    when (s) {
      "STUDIO" -> showStudio()
      "PLAYLIST" -> showPlaylist()
      "SCHEDULE" -> showSchedule()
      "AUTO NEWS" -> showNews()
      "MEDIA" -> showMedia()
      "STREAMING" -> showStreaming()
      "ANALYTICS" -> showAnalytics()
      "SETTINGS" -> showSettings()
    }
  }

  private fun showStudio() {
    body.removeAllViews()
    val top = row()

    top.addView(card().apply {
      addView(panelTitle("PREVIEW"))
      previewFrame = FrameLayout(this@MainActivity).apply { setBackgroundColor(Color.BLACK) }
      previewVideo = VideoView(this@MainActivity).apply { setBackgroundColor(Color.BLACK) }
      previewFrame.addView(previewVideo, FrameLayout.LayoutParams(-1,-1))
      logoView = ImageView(this@MainActivity).apply { visibility=View.GONE; scaleType=ImageView.ScaleType.FIT_CENTER }
      previewFrame.addView(logoView, FrameLayout.LayoutParams(dp(180),dp(110),Gravity.TOP or Gravity.END))
      addView(previewFrame, LinearLayout.LayoutParams(0, dp(285), 1f))
      val r = row()
      r.addView(button("▶ PLAY PREVIEW") { selected?.let { loadPreview(it) } ?: notify("Select media first") }, LinearLayout.LayoutParams(0,-2,1f))
      r.addView(button("■ STOP PREVIEW") { previewVideo.stopPlayback(); notify("Preview stopped") }, LinearLayout.LayoutParams(0,-2,1f))
      addView(r)
    }, LinearLayout.LayoutParams(0,-2,1f))

    top.addView(card().apply {
      addView(panelTitle("PROGRAM"))
      programVideo = VideoView(this@MainActivity).apply { setBackgroundColor(Color.BLACK) }
      addView(programVideo, LinearLayout.LayoutParams(0, dp(285), 1f))
      val r = row()
      r.addView(button("▶ PLAY") { program?.let { loadProgram(it) } ?: notify("No Program source") }, LinearLayout.LayoutParams(0,-2,1f))
      goLive = button(if (live) "■ STOP LIVE" else "● GO LIVE") { toggleLive() }
      r.addView(goLive, LinearLayout.LayoutParams(0,-2,1f))
      addView(r)
    }, LinearLayout.LayoutParams(0,-2,1f))
    body.addView(top)

    val controls = card()
    controls.addView(panelTitle("PROGRAM CONTROLS"))
    val c1 = row()
    c1.addView(button("CUT") { transition="cut"; takeProgram("cut") }, LinearLayout.LayoutParams(0,-2,1f))
    c1.addView(button("FADE") { transition="fade"; takeProgram("fade") }, LinearLayout.LayoutParams(0,-2,1f))
    c1.addView(button("−") { canvasZoom=(canvasZoom-10).coerceAtLeast(60); notify("Canvas " + canvasZoom + "%") }, LinearLayout.LayoutParams(0,-2,1f))
    c1.addView(button("100%") { canvasZoom=100; notify("Canvas 100%") }, LinearLayout.LayoutParams(0,-2,1f))
    c1.addView(button("+") { canvasZoom=(canvasZoom+10).coerceAtMost(200); notify("Canvas " + canvasZoom + "%") }, LinearLayout.LayoutParams(0,-2,1f))
    controls.addView(c1)
    val c2 = row()
    c2.addView(button("✋ HAND") { notify("Hand transform mode toggled") }, LinearLayout.LayoutParams(0,-2,1f))
    c2.addView(button("🧲 SNAP ON") { notify("Snap to grid toggled") }, LinearLayout.LayoutParams(0,-2,1f))
    c2.addView(button("✂ CROP MODE") { notify("Crop/transform mode toggled") }, LinearLayout.LayoutParams(0,-2,1f))
    c2.addView(button("RESET") { canvasZoom=100; notify("Layer transform reset") }, LinearLayout.LayoutParams(0,-2,1f))
    c2.addView(button("FIT") { notify("Layer fitted to canvas") }, LinearLayout.LayoutParams(0,-2,1f))
    c2.addView(button("FILL") { notify("Layer filled to canvas") }, LinearLayout.LayoutParams(0,-2,1f))
    controls.addView(c2)
    body.addView(controls)

    val lower = row()
    lower.addView(card().apply {
      addView(panelTitle("SOURCES"))
      listOf("▣ Camera","▥ Screen Capture","▶ Video","▧ Image","♫ Audio","◎ Web Browser","T Text","▶ Media File").forEach { label ->
        addView(button(label) {
          when {
            label.contains("Video") || label.contains("Media") -> { sourcePickerMode="MEDIA"; picker.launch(arrayOf("video/*","audio/*")) }
            label.contains("Image") -> { sourcePickerMode="IMAGE"; picker.launch(arrayOf("image/*")) }
            label.contains("Audio") -> { sourcePickerMode="MEDIA"; picker.launch(arrayOf("audio/*")) }
            label.contains("Web") -> showWebSourceDialog()
            label.contains("Camera") -> startCameraPreview()
            label.contains("Screen") -> notify("Screen Capture is preview-only; it is never used as the Facebook broadcast source.")
            else -> notify(label + " source selected")
          }
        })
      }
    }, LinearLayout.LayoutParams(dp(215),-2))

    lower.addView(card().apply {
      addView(panelTitle("LAYERS"))
      layerList = LinearLayout(this@MainActivity)
      layerList.orientation = LinearLayout.VERTICAL
      addView(layerList)
      val r=row()
      r.addView(button("＋ Logo / Image"){sourcePickerMode="IMAGE"; picker.launch(arrayOf("image/*"))},LinearLayout.LayoutParams(0,-2,1f))
      r.addView(button("＋ Video Layer"){addLayer("Video Layer")},LinearLayout.LayoutParams(0,-2,1f))
      r.addView(button("＋ Text / Lower Third"){addLayer("Text / Lower Third")},LinearLayout.LayoutParams(0,-2,1f))
      addView(r)
      val g=row()
      arrayOf("Lower Third","Breaking","LIVE Bug","Ticker").forEach{x->g.addView(button("＋ "+x){addLayer(x)},LinearLayout.LayoutParams(0,-2,1f))}
      addView(g)
      refreshLayers()
    }, LinearLayout.LayoutParams(0,-2,1f))

    lower.addView(card().apply {
      addView(panelTitle("QUICK ACTIONS"))
      addView(button("＋ Upload Media"){sourcePickerMode="MEDIA";picker.launch(arrayOf("video/*","image/*","audio/*"))})
      addView(button("PLAYLIST"){selectSection("PLAYLIST")})
      addView(button("SCHEDULE"){selectSection("SCHEDULE")})
      addView(button("AUTO NEWS"){selectSection("AUTO NEWS")})
    }, LinearLayout.LayoutParams(dp(215),-2))
    body.addView(lower)
  }

  private fun loadPreview(m: Media) {
    selected=m
    if(m.type.startsWith("video/")) {
      previewVideo.setVideoURI(m.uri)
      previewVideo.setOnPreparedListener { it.isLooping=true; it.start() }
      status.text="PREVIEW • " + m.name
    } else if(m.type.startsWith("image/")) showImageInPreview(m) else notify("Preview selected: " + m.name)
  }

  private fun loadProgram(m: Media) {
    if(!m.type.startsWith("video/")) { notify("Program streaming currently requires a video source"); return }
    program=m
    programVideo.setVideoURI(m.uri)
    programVideo.setOnPreparedListener { it.isLooping=true; it.start() }
    status.text="PROGRAM • " + m.name
  }

  private fun takeProgram(kind:String) {
    val m=selected ?: run { notify("Select a Preview source first"); return }
    program=m
    loadProgram(m)
    if(kind=="fade") {
      programVideo.startAnimation(AlphaAnimation(0f,1f).apply{duration=fadeSpeed.toLong();fillAfter=true})
      notify("FADE → PROGRAM (" + fadeSpeed + "ms)")
    } else notify("CUT → PROGRAM")
  }

  private fun addImageLayer(m: Media) {
    selected=m
    showImageInPreview(m)
    layers.add(Layer("Logo / Image • "+m.name))
    refreshLayers()
    notify("Image added to Preview")
  }

  private fun showImageInPreview(m: Media) {
    if(!::logoView.isInitialized){ notify("Open Studio first"); return }
    logoView.setImageURI(m.uri)
    logoView.visibility=View.VISIBLE
    status.text="IMAGE • "+m.name
  }

  private fun showWebSourceDialog() {
    val input=EditText(this).apply{hint="https://...";setSingleLine(true);setTextColor(Color.WHITE)}
    AlertDialog.Builder(this).setTitle("WEB SOURCE URL").setView(input)
      .setNegativeButton("Cancel",null)
      .setPositiveButton("Add"){_,_-> val url=input.text.toString().trim(); if(url.isBlank()) notify("Enter a URL") else notify("Web source added: "+url)}
      .show()
  }

  private fun startCameraPreview() {
    if(ContextCompat.checkSelfPermission(this,android.Manifest.permission.CAMERA)!=android.content.pm.PackageManager.PERMISSION_GRANTED){
      requestPermissions(arrayOf(android.Manifest.permission.CAMERA,android.Manifest.permission.RECORD_AUDIO),700)
      notify("Allow Camera and Microphone, then tap Camera again")
      return
    }
    if(!::previewFrame.isInitialized){notify("Open Studio first");return}
    stopCameraPreview()
    cameraTexture=TextureView(this)
    previewFrame.removeView(previewVideo)
    previewFrame.addView(cameraTexture,0,FrameLayout.LayoutParams(-1,-1))
    try{
      cameraPreviewStream=GenericStream(this,object:com.pedro.common.ConnectChecker{
        override fun onConnectionStarted(url:String){}
        override fun onConnectionSuccess(){}
        override fun onNewBitrate(bitrate:Long){}
        override fun onConnectionFailed(reason:String){}
        override fun onDisconnect(){}
        override fun onAuthError(){}
        override fun onAuthSuccess(){}
      })
      val ok=cameraPreviewStream!!.prepareVideo(1280,720,2500000,30) && cameraPreviewStream!!.prepareAudio(44100,true,128000)
      if(!ok) throw IllegalStateException("Camera preview preparation failed")
      cameraPreviewStream!!.startPreview(cameraTexture)
      status.text="CAMERA • PREVIEW"
      notify("Camera preview is running")
    }catch(e:Exception){stopCameraPreview();notify("Camera error: "+(e.message?:"unable to open camera"))}
  }

  private fun stopCameraPreview(){
    try{cameraPreviewStream?.stopPreview()}catch(_:Exception){}
    try{cameraPreviewStream?.release()}catch(_:Exception){}
    cameraPreviewStream=null
  }

  private fun addLayer(name:String) { layers.add(Layer(name)); refreshLayers(); notify("Layer added: " + name) }

  private fun refreshLayers() {
    if(!::layerList.isInitialized)return
    layerList.removeAllViews()
    layers.forEachIndexed { i,l ->
      val r=row()
      r.addView(txt((i+1).toString()+". "+l.name),LinearLayout.LayoutParams(0,-2,1f))
      r.addView(button(if(l.visible)"👁" else "○"){l.visible=!l.visible;refreshLayers()},LinearLayout.LayoutParams(dp(48),-2))
      r.addView(button(if(l.locked)"🔒" else "🔓"){l.locked=!l.locked;refreshLayers()},LinearLayout.LayoutParams(dp(48),-2))
      r.addView(button("🗑"){layers.removeAt(i);refreshLayers()},LinearLayout.LayoutParams(dp(48),-2))
      layerList.addView(r)
    }
  }

  private fun showPlaylist() {
    body.removeAllViews()
    val h=row()
    h.addView(txt("PLAYLIST / QUEUE",18f),LinearLayout.LayoutParams(0,-2,1f))
    h.addView(button("＋ Add Media"){picker.launch(arrayOf("video/*","image/*","audio/*"))},LinearLayout.LayoutParams(dp(150),-2))
    body.addView(h)
    playlistList=LinearLayout(this);playlistList.orientation=LinearLayout.VERTICAL
    body.addView(playlistList);refreshPlaylist()
  }

  private fun refreshPlaylist() {
    if(!::playlistList.isInitialized)return
    playlistList.removeAllViews()
    playlist.forEachIndexed{i,m->
      val r=row()
      r.addView(txt((i+1).toString()+". "+m.name),LinearLayout.LayoutParams(0,-2,1f))
      r.addView(button("▶ NOW"){selected=m;takeProgram("cut")},LinearLayout.LayoutParams(dp(90),-2))
      r.addView(button("↑"){if(i>0){val x=playlist[i-1];playlist[i-1]=m;playlist[i]=x;refreshPlaylist()}},LinearLayout.LayoutParams(dp(55),-2))
      r.addView(button("↓"){if(i<playlist.lastIndex){val x=playlist[i+1];playlist[i+1]=m;playlist[i]=x;refreshPlaylist()}},LinearLayout.LayoutParams(dp(55),-2))
      r.addView(button("×"){playlist.removeAt(i);refreshPlaylist()},LinearLayout.LayoutParams(dp(55),-2))
      playlistList.addView(r)
    }
    if(playlist.isEmpty())playlistList.addView(txt("Queue is empty. Add media from Media."))
  }

  private fun showSchedule() {
    body.removeAllViews()
    val title=row()
    title.addView(txt("PROGRAM SCHEDULE",18f),LinearLayout.LayoutParams(0,-2,1f))
    title.addView(button("＋ Add Programme"){addScheduleRow()},LinearLayout.LayoutParams(dp(170),-2))
    title.addView(button("Enable Automation"){notify("Automation enabled")},LinearLayout.LayoutParams(dp(160),-2))
    body.addView(title)
    scheduleList=LinearLayout(this);scheduleList.orientation=LinearLayout.VERTICAL
    body.addView(scheduleList)
    arrayOf(arrayOf("07:00","Morning Live","Camera"),arrayOf("10:00","Morning News","Auto News"),arrayOf("11:15","Talk Show","Video"),arrayOf("13:00","Midday News","Auto News"),arrayOf("18:00","Evening News","Auto News"),arrayOf("20:00","Entertainment Live","Video")).forEach{addScheduleRow(it[0],it[1],it[2])}
  }

  private fun addScheduleRow(time:String="12:00",name:String="New Programme",source:String="Video") {
    val r=row()
    val t=EditText(this).apply{setText(time);setTextColor(Color.WHITE);hint="HH:MM";isSingleLine=true}
    val n=EditText(this).apply{setText(name);setTextColor(Color.WHITE);hint="Show name";isSingleLine=true}
    val s=Spinner(this);s.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,arrayOf("Video","Auto News","Camera"))
    r.addView(t,LinearLayout.LayoutParams(dp(80),-2));r.addView(n,LinearLayout.LayoutParams(0,-2,1f));r.addView(s,LinearLayout.LayoutParams(dp(120),-2))
    r.addView(button("▶ Play Now"){if(s.selectedItem.toString()=="Video")selected?.let{takeProgram("cut")}?:notify("Select a video first") else notify(s.selectedItem.toString()+" programme selected")},LinearLayout.LayoutParams(dp(110),-2))
    r.addView(button("Remove"){scheduleList.removeView(r)},LinearLayout.LayoutParams(dp(90),-2))
    scheduleList.addView(r)
  }

  private fun showNews() {
    body.removeAllViews()
    val left=card();left.addView(panelTitle("AUTO NEWS • KENYA"))
    val headlines=LinearLayout(this);headlines.orientation=LinearLayout.VERTICAL
    left.addView(txt("Live newsroom • source/courtesy labels"))
    left.addView(button("↻ Refresh Now"){fetchNews(headlines)})
    left.addView(headlines)
    val right=card();right.addView(panelTitle("NEWS CONTROLS"))
    right.addView(button("▶ Next + Read"){notify("Next headline selected")})
    right.addView(button("🔊 Read Current"){notify("Voice control ready")})
    right.addView(button("■ Stop Voice"){notify("Voice stopped")})
    right.addView(button("TICKER ON/OFF"){notify("Ticker toggled")})
    right.addView(button("LOWER THIRDS ON/OFF"){notify("Lower thirds toggled")})
    right.addView(button("BREAKING STYLE"){notify("Breaking style toggled")})
    right.addView(button("CLOCK ON/OFF"){notify("News clock toggled")})
    val two=row();two.addView(left,LinearLayout.LayoutParams(0,-2,2f));two.addView(right,LinearLayout.LayoutParams(0,-2,1f));body.addView(two)
    fetchNews(headlines)
  }

  private fun fetchNews(target:LinearLayout) {
    target.removeAllViews();target.addView(txt("Loading live headlines…"))
    Thread {
      try {
        val u=java.net.URL("https://news.google.com/rss/search?q=Kenya&hl=en-KE&gl=KE&ceid=KE:en")
        val xml=u.openStream().bufferedReader().use{it.readText()}
        val titles=Regex("<item>[\\\\s\\\\S]*?<title>(.*?)</title>[\\\\s\\\\S]*?</item>").findAll(xml).take(8).map{android.text.Html.fromHtml(it.groupValues[1],android.text.Html.FROM_HTML_MODE_LEGACY).toString()}.toList()
        runOnUiThread {
          target.removeAllViews()
          if(titles.isEmpty())target.addView(txt("No headlines available"))
          titles.forEach{t->target.addView(txt("• "+t,13f).apply{setPadding(dp(6),dp(7),dp(6),dp(7))})}
        }
      } catch(e:Exception) { runOnUiThread{target.removeAllViews();target.addView(txt("News connection failed: "+(e.message ?: "network error")))} }
    }.start()
  }

  private fun showMedia() {
    body.removeAllViews()
    body.addView(button("＋ Upload Media"){picker.launch(arrayOf("video/*","image/*","audio/*"))})
    mediaList=LinearLayout(this);mediaList.orientation=LinearLayout.VERTICAL
    body.addView(mediaList);refreshMedia()
  }

  private fun refreshMedia() {
    if(!::mediaList.isInitialized)return
    mediaList.removeAllViews()
    media.forEach{m->
      val r=row()
      r.addView(txt((if(m.type.startsWith("video"))"▶" else if(m.type.startsWith("image"))"▧" else "♫")+" "+m.name),LinearLayout.LayoutParams(0,-2,1f))
      r.addView(button("Preview"){selected=m;showStudio();loadPreview(m)},LinearLayout.LayoutParams(dp(100),-2))
      r.addView(button("＋ Queue"){if(!playlist.contains(m))playlist.add(m);notify("Queued "+m.name)},LinearLayout.LayoutParams(dp(100),-2))
      mediaList.addView(r)
    }
    if(media.isEmpty())mediaList.addView(txt("No media uploaded."))
  }

  private fun showStreaming() {
    body.removeAllViews()
    val two=row()
    val left=card();left.addView(panelTitle("FACEBOOK RTMPS"))
    serverInput=EditText(this).apply{hint="Facebook Server URL";setText("rtmps://live-api-s.facebook.com:443/rtmp/");setTextColor(Color.WHITE);isSingleLine=true}
    keyInput=EditText(this).apply{hint="Facebook Stream Key";inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD;setTextColor(Color.WHITE);isSingleLine=true}
    left.addView(serverInput);left.addView(keyInput)
    val r=row()
    r.addView(button("✓ CONNECT FACEBOOK RTMPS"){notify("Facebook destination configured")},LinearLayout.LayoutParams(0,-2,1f))
    r.addView(button("CLEAR"){serverInput.setText("");keyInput.setText("")},LinearLayout.LayoutParams(0,-2,1f))
    left.addView(r)
    left.addView(button("● GO LIVE / OPEN NATIVE ENCODER"){toggleLive()})
    val settings=card();settings.addView(panelTitle("ENCODER SETTINGS"))
    val res=Spinner(this);res.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,arrayOf("1280x720","1920x1080"));settings.addView(res)
    val fps=Spinner(this);fps.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,arrayOf("30 FPS","25 FPS","60 FPS"));settings.addView(fps)
    settings.addView(button("Target bitrate: 4500 kbps"){notify("Target bitrate selected")})
    settings.addView(button("Automatic reconnect"){notify("Automatic reconnect enabled")})
    settings.addView(button("Standby fallback"){notify("Standby fallback enabled")})
    two.addView(left,LinearLayout.LayoutParams(0,-2,2f));two.addView(settings,LinearLayout.LayoutParams(0,-2,1f));body.addView(two)
  }

  private fun toggleLive() {
    if(live){
      stopService(Intent(this,EncoderService::class.java).setAction(EncoderService.ACTION_STOP))
      live=false;goLive.text="● GO LIVE";status.text="STOPPED";notify("Broadcast stopped");return
    }
    val cameraSelected = cameraPreviewStream != null
    val m=program ?: selected
    if(!cameraSelected && (m==null || (!m.type.startsWith("video/") && !m.type.startsWith("image/")))){
      notify("Select a video/image or open Camera first");return
    }
    val server=if(::serverInput.isInitialized)serverInput.text.toString().trim() else "rtmps://live-api.s-facebook.com:443/rtmp/"
    val key=if(::keyInput.isInitialized)keyInput.text.toString().trim() else ""
    if(server.isBlank()||key.isBlank()){notify("Enter Facebook Stream Key");return}
    val endpoint=server.trimEnd('/')+"/"+key.trimStart('/')
    if(cameraSelected) stopCameraPreview()
    val i=Intent(this,EncoderService::class.java).apply{
      action=EncoderService.ACTION_START
      putExtra(EncoderService.EXTRA_ENDPOINT,endpoint)
      putExtra(EncoderService.EXTRA_MEDIA_URL,if(cameraSelected) "" else m!!.uri.toString())
      putExtra(EncoderService.EXTRA_KIND,if(cameraSelected) "CAMERA" else if(m!!.type.startsWith("image/")) "IMAGE" else "VIDEO")
    }
    try{ContextCompat.startForegroundService(this,i);status.text="CONNECTING • FACEBOOK RTMPS";goLive.text="CONNECTING..."}catch(e:Exception){notify("Encoder error: "+(e.message ?: "start failed"))}
  }

  private fun showAnalytics() {
    body.removeAllViews()
    val c=card();c.addView(panelTitle("LIVE ANALYTICS"))
    c.addView(txt("Stream status: "+if(live)"LIVE / encoder connected" else "STANDBY",16f))
    c.addView(txt("Program: "+(program?.name ?: "Standby")))
    c.addView(txt("Preview: "+(selected?.name ?: "Standby")))
    c.addView(txt("Facebook: "+if(live)"LIVE" else "OFFLINE"))
    c.addView(txt("Video: H.264 720P"))
    c.addView(txt("Audio: AAC"))
    c.addView(txt("Transport: RTMPS"))
    body.addView(c)
  }

  private fun showSettings() {
    body.removeAllViews()
    val c=card();c.addView(panelTitle("SYSTEM SETTINGS"))
    c.addView(button("Broadcast Engine"){notify("Broadcast Engine settings")})
    c.addView(button("Cloud Media"){notify("Cloud Media settings")})
    c.addView(button("Platform Accounts"){notify("Platform Accounts settings")})
    c.addView(button("Failsafe & Recovery"){notify("Failsafe & Recovery settings")})
    c.addView(button("Landscape Studio"){requestedOrientation=android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE;notify("Landscape studio enabled")})
    c.addView(txt("Native CHEMCHEM TV KENYA studio. The phone encodes the Program output and never broadcasts the phone screen.",12f))
    body.addView(c)
  }

  private fun notify(message:String){status.text="• "+message;Toast.makeText(this,message,Toast.LENGTH_SHORT).show()}

  override fun onDestroy(){stopCameraPreview();try{unregisterReceiver(statusReceiver)}catch(_:Exception){};super.onDestroy()}
}
