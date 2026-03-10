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
      
      // 🎵 ISPPOPRAVLJENI REGEX u scriptovima (ISPPRAVLJEN ESCAPING)
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const content = script.textContent || script.innerHTML;
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
      // 🆕 POBOLJŠANI regex za SVE datume (kao za Drugi dio dana)
      const webTime = await page.evaluate(() => {
        const bodyText = document.body.innerText || document.body.textContent || '';
        // ✅ ŠIRI REGEX: "Pet, 06.03. u 20:00" - bilo koji dan/datuma
        const timeMatches = bodyText.match(/([Pp]et|[Pp]on|[Uu]to|[Ss]ri|[Čč]et|[Ss]ub|[Nn]ed)(?:to|ak)?[,.\s]+(\d{1,2})[.\s]+(\d{1,2})[.\s]*u[.\s]*(\d{1,2}):(\d{2})/gi);
        
        // Traži najnoviji (posljednji u tekstu = vjerojatno najnovija emisija)
        if (timeMatches && timeMatches.length > 0) {
          const latestMatch = timeMatches[timeMatches.length - 1];
          const fullMatch = latestMatch.match(/([Pp]et|[Pp]on|[Uu]to|[Ss]ri|[Čč]et|[Ss]ub|[Nn]ed)(?:to|ak)?[,.\s]+(\d{1,2})[.\s]+(\d{1,2})[.\s]*u[.\s]*(\d{1,2}):(\d{2})/i);
          if (fullMatch) {
            const dan = fullMatch[2].padStart(2, '0');
            const mjesec = fullMatch[3].padStart(2, '0');
            const sat = fullMatch[4].padStart(2, '0');
            const minute = fullMatch[5];
            return `${fullMatch[1]}, ${dan}.${mjesec}. u ${sat}:${minute}`;
          }
        }
        return null;
      });
      
      const timeMatch = result.mp3.match(/(\d{4})(\d{2})(\d{2})(\d{6})\.mp3$/);
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
#EXTINF:-1 tvg-logo="https://radio.hrt.hr/favicon.ico",HRT U mreži prvog Pet, 06.03. u 20:00
https://api.hrt.hr/media/28/da/20260306-u-mrezi-prvog-37328738-20260306200000.mp3`;
    fs.writeFileSync('U_mrezi_prvog.m3u', fallbackContent);
    console.log('✅ Fallback U_mrezi_prvog.m3u spreman');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

updateM3U();
