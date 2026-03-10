const puppeteer = require('puppeteer');
const fs = require('fs');

async function updateM3U() {
  let browser;
  try {
    console.log('🚀 Pokrećem Chrome...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    console.log('📄 Učitavam https://radio.hrt.hr/slusaonica/u-mrezi-prvog');
    await page.goto('https://radio.hrt.hr/slusaonica/u-mrezi-prvog', { 
      waitUntil: 'networkidle2'
    });
    
    await new Promise(r => setTimeout(r, 4000));
    
    const result = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href], script, img'));
      
      // 🎵 MP3 link
      for (const link of allLinks) {
        const href = link.href || link.src || link.getAttribute('data-src');
        if (href && href.includes('api.hrt.hr/media') && href.includes('.mp3')) {
          return { mp3: href, image: null };
        }
      }
      
      // 🖼️ Slika
      let imageUrl = null;
      for (const img of allLinks) {
        const src = img.src || img.getAttribute('data-src');
        if (src && src.includes('api.hrt.hr/media') && (src.includes('.webp') || src.includes('.jpg'))) {
          imageUrl = src;
          break;
        }
      }
      
      // 🎵 ISPOPRAVLJENI REGEX u scriptovima
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent || script.innerHTML;
        // ✅ new RegExp sa ispravnim escapingom
        const mp3Regex1 = new RegExp('"https?:\\\\\\/\\\\\\/api\\\\.hrt\\\\.hr\\\\\\/media[^"]*\\\\.mp3[^"]*"');
        const mp3Regex2 = new RegExp("'https?:\\\\\\/\\\\\\/api\\\\.hrt\\\\.hr\\\\\\/media[^']*\\\\.mp3[^']*'");
        const mp3Match1 = content.match(mp3Regex1);
        const mp3Match2 = content.match(mp3Regex2);
        if (mp3Match1) return { mp3: mp3Match1[0].slice(1, -1), image: imageUrl };
        if (mp3Match2) return { mp3: mp3Match2[0].slice(1, -1), image: imageUrl };
      }
      
      return { mp3: null, image: null };
    });
    
    console.log('🎵 MP3:', result.mp3);
    console.log('🖼️ Slika:', result.image);
    
    if (result.mp3) {
      // 🆕 Povlačenje vremena sa web stranice
      const webTime = await page.evaluate(() => {
        const bodyText = document.body.innerText || document.body.textContent || '';
        // Regex za format: "Uto, 10.03. u 20:00" ili varijacije
        const timeMatch = bodyText.match(/(?:Pon|Uto|Sri|Čet|Pet|Sub|Ned)(?:to|ak)?[,\\.\\s]+(\\d{1,2})[\\.\\s]+(\\d{1,2})[\\.\\s]*u[\\s]*(\\d{1,2}):(\\d{2})/i);
        if (timeMatch) {
          const dan = timeMatch[1].padStart(2, '0');
          const mjesec = timeMatch[2].padStart(2, '0');
          const sat = timeMatch[3].padStart(2, '0');
          const minute = timeMatch[4];
          return `${dan}.${mjesec}. ${sat}:${minute}`;
        }
        return null;
      });
      
      const timeMatch = result.mp3.match(/(\\d{4})(\\d{2})(\\d{2})(\\d{6})\\.mp3$/);
      let emisijaInfo = 'Najnovija';
      
      if (webTime) {
        emisijaInfo = webTime;
        console.log('🕐 Web vrijeme:', webTime);
      } else if (timeMatch) {
        const godina = timeMatch[1];
        const mjesec = timeMatch[2];
        const dan = timeMatch[3];
        const vrijeme = timeMatch[4];
        const sat = vrijeme.slice(0,2);
        const minute = vrijeme.slice(2,4);
        emisijaInfo = `${dan}.${mjesec}.${sat}:${minute}`;
        console.log('📅 Iz MP3:', emisijaInfo);
      }
      
      console.log('📅 Konačno datum/vrijeme:', emisijaInfo);
      
      const imageUrl = result.image || 'https://radio.hrt.hr/favicon.ico';
      const m3uContent = `#EXTM3U
#EXTINF:-1 tvg-logo="${imageUrl}" group-title="Analiza",HRT U mreži prvog ${emisijaInfo}
${result.mp3}`;

      fs.writeFileSync('U_mrezi_prvog.m3u', m3uContent);
      console.log('✅ U_mrezi_prvog.m3u spreman s ikonom i vremenom!');
    } else {
      throw new Error('Nema MP3-a');
    }
    
  } catch (error) {
    console.error('❌', error.message);
    const fallbackContent = `#EXTM3U
#EXTINF:-1 tvg-logo="https://radio.hrt.hr/favicon.ico",HRT U mreži prvog 10.03.2026 20:00
https://api.hrt.hr/media/28/da/20260310-u-mrezi-prvog-37328738-20260310200000.mp3`;
    fs.writeFileSync('U_mrezi_prvog.m3u', fallbackContent);
    console.log('✅ Fallback U_mrezi_prvog.m3u spreman');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

updateM3U();
