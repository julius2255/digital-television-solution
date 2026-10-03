import {NextResponse} from "next/server";

const feeds=[
  "https://www.standardmedia.co.ke/rssfeeds",
  "https://feeds.bbci.co.uk/news/world/rss.xml"
];

export async function GET(){
  for(const url of feeds){
    try{
      const res=await fetch(url,{cache:"no-store",headers:{"User-Agent":"Digital Television Solution News Reader/1.0"}});
      if(!res.ok) continue;
      const xml=await res.text();
      const items=[...xml.matchAll(/<item[\\s\\S]*?<\\/item>/gi)].slice(0,10).map(m=>{
        const s=m[0],pick=(tag:string)=>{const x=s.match(new RegExp("<"+tag+"[^>]*>([\\s\\S]*?)<\\/"+tag+">","i"));return x?x[1].replace(/<!\\[CDATA\\[|\\]\\]>/g,"").replace(/<[^>]+>/g,"").trim():""};
        return {title:pick("title"),description:pick("description"),link:pick("link"),published:pick("pubDate")};
      }).filter(x=>x.title);
      if(items.length)return NextResponse.json({items,source:url});
    }catch{}
  }
  return NextResponse.json({items:[],source:"offline"},{status:200});
}