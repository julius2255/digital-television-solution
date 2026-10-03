import {NextResponse} from "next/server";

const feeds=[
  {name:"STANDARD KENYA",url:"https://www.standardmedia.co.ke/rss/kenya.php",categories:["Kenya","Politics"]},
  {name:"STANDARD POLITICS",url:"https://www.standardmedia.co.ke/rss/politics.php",categories:["Politics","Kenya"]},
  {name:"STANDARD BUSINESS",url:"https://www.standardmedia.co.ke/rss/business.php",categories:["Business","Kenya"]},
  {name:"STANDARD ENTERTAINMENT",url:"https://www.standardmedia.co.ke/rss/entertainment.php",categories:["Entertainment","Kenya"]},
  {name:"STANDARD WORLD",url:"https://www.standardmedia.co.ke/rss/world.php",categories:["World"]},
  {name:"BBC WORLD",url:"https://feeds.bbci.co.uk/news/world/rss.xml",categories:["World"]}
];

const clean=(value:string)=>{
  return value.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g," ").trim();
};

const parse=(xml:string,source:string)=>{
  return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].slice(0,20).map(m=>{
    const s=m[0];
    const pick=(tag:string)=>{
      const x=s.match(new RegExp("<"+tag+"[^>]*>([\\s\\S]*?)<\/"+tag+">","i"));
      return x?clean(x[1]):"";
    };
    return {title:pick("title"),description:pick("description"),link:pick("link"),published:pick("pubDate"),source};
  }).filter(x=>x.title);
};

export async function GET(req:Request){
  const url=new URL(req.url);
  const category=url.searchParams.get("category")||"Kenya";
  const selected=feeds.filter(f=>f.categories.includes(category)||category==="Kenya"&&f.categories.includes("Kenya"));
  const targets=selected.length?selected:feeds.slice(0,1);
  const results:{title:string;description:string;link:string;published:string;source:string}[]=[];
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