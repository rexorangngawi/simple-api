import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';
import https from 'https';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET allowed' });
  }

  const tiktokUrl = req.query.url;
  if (!tiktokUrl) {
    return res.status(400).json({ error: 'Missing ?url=https://tiktok.com/... parameter' });
  }

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath || '/usr/bin/chromium-browser',
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.goto('https://dlpanda.com', { waitUntil: 'networkidle2' });

    await page.type('#url', tiktokUrl);
    await page.click('#submit');
    await page.waitForSelector('.download-links a', { timeout: 15000 });

    const videoUrl = await page.$eval('.download-links a', a => a.href);
    await browser.close();

    https.get(videoUrl, response => {
      let data = [];
      response.on('data', chunk => data.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(data);
        const base64 = buffer.toString('base64');
        const mime = response.headers['content-type'] || 'video/mp4';
        const dataUri = `data:${mime};base64,${base64}`;

        res.status(200).json({
          success: true,
          base64: dataUri,
          size: buffer.length
        });
      });
    }).on('error', e => {
      res.status(500).json({ error: 'Download failed', detail: e.message });
    });
  } catch (err) {
    res.status(500).json({ error: 'Processing failed', detail: err.message });
  }
  }
