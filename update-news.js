const https = require('https');
const http = require('http');
const fs = require('fs');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 10000 }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function parseRSS(xml, source, strip) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g; let m;
  while ((m = re.exec(xml)) && items.length < 20) {
    const b = m[1];
    const t = (b.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '';
    const desc = (b.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1] || '';
    const pub = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    const lnk = (b.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] || '';
    let cd = desc.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/<[^>]*>/g, '');
    if (strip) cd = cd.replace(strip, '');
    cd = cd.trim();
    let ct = t.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
    if (strip) ct = ct.replace(strip, '');
    ct = ct.trim();
    if (ct || cd) items.push({ title: ct, description: cd.substring(0, 500), pubDate: pub, link: lnk.trim(), source });
  }
  return items;
}

async function main() {
  const allItems = [];

  // 1. Odaily
  try {
    const xml = await fetch('https://rss.odaily.news/rss/newsflash');
    const items = parseRSS(xml, 'Odaily', /Odaily星球日报讯[，,：:\s]*/g);
    allItems.push(...items);
    console.log('Odaily:', items.length);
  } catch (e) { console.error('Odaily err:', e.message); }

  // 2. 人民网财经
  try {
    const xml = await fetch('http://www.people.com.cn/rss/finance.xml');
    const items = parseRSS(xml, '人民网财经', null).slice(0, 15);
    allItems.push(...items);
    console.log('人民网财经:', items.length);
  } catch (e) { console.error('人民网 err:', e.message); }

  // 3. 新浪财经7x24
  try {
    const raw = await fetch('https://zhibo.sina.com.cn/api/zhibo/feed?callback=&page=1&page_size=20&zhibo_id=152&tag_id=0&type=0');
    const d = JSON.parse(raw);
    const list = d.result?.data?.feed?.list || [];
    for (const item of list.slice(0, 15)) {
      const text = (item.rich_text || '').replace(/<[^>]*>/g, '').trim();
      if (text.length < 5) continue;
      const title = text.substring(0, 60) + (text.length > 60 ? '...' : '');
      allItems.push({
        title, description: text.substring(0, 500),
        pubDate: item.create_time ? new Date(item.create_time * 1000).toUTCString() : '',
        link: 'https://finance.sina.com.cn/7x24/',
        source: '新浪7x24'
      });
    }
    console.log('新浪7x24:', Math.min(list.length, 15));
  } catch (e) { console.error('新浪 err:', e.message); }

  // 排序
  allItems.sort((a, b) => {
    const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return tb - ta;
  });

  fs.writeFileSync('news.json', JSON.stringify({ items: allItems.slice(0, 50), updated: new Date().toISOString() }));
  console.log('Total:', allItems.length, '-> saved top 50');
}

main().catch(e => console.error(e));
