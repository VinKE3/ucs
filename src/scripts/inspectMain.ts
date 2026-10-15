async function inspectMain() {
  const url = 'https://cientifica.simclic.com/vite/entry-client/main-DoYvqcpw.entry.js';
  const res = await fetch(url);
  const text = await res.text();

  // Buscar cualquier mención de import(
  const importRegex = /import\(\s*["']([^"']+)["']\s*\)/g;
  const dynImports = new Set();
  let m;
  while ((m = importRegex.exec(text)) !== null) {
    dynImports.add(m[1]);
  }
  console.log(`Dynamic imports count: ${dynImports.size}`);
  for (const imp of Array.from(dynImports)) {
    console.log(' -', imp);
  }

  // Also check occurrences of "users" subscription or ag-grid
  const subRegex = /Meteor\.subscribe\(\s*["']([^"']+)["']/g;
  const subs = new Set();
  while ((m = subRegex.exec(text)) !== null) {
    subs.add(m[1]);
  }
  console.log('Meteor.subscribe directly:', Array.from(subs));
}
inspectMain().catch(console.error);
