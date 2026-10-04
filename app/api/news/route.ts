import {NextResponse} from "next/server";

const feeds=[
  {name:"STANDARD KENYA",url:"https://www.standardmedia.co.ke/rss/kenya.php",categories:["Kenya","Politics"]},
  {name:"STANDARD POLITICS",url:"https://www.standardmedia.co.ke/rss/politics.php",categories:["Politics","Kenya"]},
  {name:"STANDARD BUSINESS",url:"https://www.standardmedia.co.ke/rss/business.php",categories:["Business","Kenya"]},
  {name:"STANDARD ENTERTAINMENT",url:"https://www.standardmedia.co.ke/rss/entertainment.php",categories:["Entertainment","Kenya"]},
  {name:"STANDARD WORLD",url:"https://www.standardmedia.co.ke/rss/world.php",categories:["World"]},
  {name:"BBC WORLD",url:"https://feeds.bbci.co.uk/news/world/rss.xml",categories:["World"]},
  {name:"BBC SPORT",url:"https://feeds.bbci.co.uk/sport/rss.xml",categories:["Sports"]},
  {name:"STANDARD SPORTS",url:"https://www.standardmedia.co.ke/rss/sports.php",categories:["Sports"]}
];

const clean=(value:string)=>{
  return value.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g," ").trim();
};

const imageFromItem=(s:string)=>{
  const media=s.match(/<(?:media:content|media:thumbnail|enclosure)[^>]*(?:url|href)=["']([^"']+)["'][^>]*>/i);
  if(media?.[1])return media[1];
  const html=s.match(/<description[\\s\\S]*?<img[^>]+src=["']([^"']+)["']/i);
  return html?.[1]||"";
};

const parse=(xml:string,source:string)=>{
  return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].slice(0,20).map(m=>{
    const s=m[0];
    const pick=(tag:string)=>{
      const x=s.match(new RegExp("<"+tag+"[^>]*>([\\s\\S]*?)<\/"+tag+">","i"));
      return x?clean(x[1]):"";
    };
    return {title:pick("title"),description:pick("description"),link:pick("link"),published:pick("pubDate"),source,image:imageFromItem(s)};
  }).filter(x=>x.title);
};

export async function GET(req:Request){
  const url=new URL(req.url);
  const category=url.searchParams.get("category")||"Kenya";
  if(category==="Weather"){
    try{
      const weather=await fetch("https://api.open-meteo.com/v1/forecast?latitude=-1.2921&longitude=36.8219&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Africa%2FNairobi&forecast_days=3",{cache:"no-store"});
      if(weather.ok){
        const w=await weather.json();
        const code=Number(w.current?.weather_code??0);
        const label=code===0?"Clear skies":code<=3?"Partly cloudy":code<=67?"Rain expected":code<=77?"Wintry weather":code<=82?"Rain showers":"Stormy conditions";
        const daily=w.daily||{};
        const items=[{
          title:"Kenya Weather: "+label,
          description:"Nairobi forecast — "+Math.round(Number(w.current?.temperature_2m??0))+"°C, humidity "+Math.round(Number(w.current?.relative_humidity_2m??0))+"%, wind "+Math.round(Number(w.current?.wind_speed_10m??0))+" km/h. Today: "+Math.round(Number(daily.temperature_2m_min?.[0]??0))+"°C to "+Math.round(Number(daily.temperature_2m_max?.[0]??0))+"°C.",
          link:"https://open-meteo.com/",
          published:new Date().toISOString(),
          source:"OPEN-METEO WEATHER",
          image:""
        }];
        return NextResponse.json({items,source:"OPEN-METEO WEATHER",category,weather:{current:w.current,daily}});
      }
    }catch{}
    return NextResponse.json({items:[],source:"OPEN-METEO WEATHER",category});
  }
  const selected=feeds.filter(f=>f.categories.includes(category)||category==="Kenya"&&f.categories.includes("Kenya"));
  const targets=selected.length?selected:feeds.slice(0,1);
  const results:{title:string;description:string;link:string;published:string;source:string;image:string}[]=[];
  for(const feed of targets){
    try{
      const res=await fetch(feed.url,{cache:"no-store",headers:{"User-Agent":"Digital Television Solution News Reader/1.0"}});
      if(!res.ok) continue;
      const xml=await res.text();
      results.push(...parse(xml,feed.name));
    }catch{}
  }
  const seen=new Set<string>();
  const items=results.filter(x=>{
    const key=x.title.toLowerCase();
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  }).slice(0,20);
  return NextResponse.json({items,source:targets.map(x=>x.name).join(", "),category});
}