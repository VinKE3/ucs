async function check() {
  const res = await fetch('https://cientifica.simclic.com');
  const html = await res.text();
  const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["']/gi;
  let match;
  const scripts = [];
  while ((match = scriptRegex.exec(html)) !== null) {
    scripts.push(match[1]);
  }
  console.log('Scripts encontrados:', scripts);
}
check().catch(console.error);
