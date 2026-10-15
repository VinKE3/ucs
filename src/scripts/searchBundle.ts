async function searchBundle() {
  const url = 'https://cientifica.simclic.com/vite/entry-client/main-DoYvqcpw.entry.js';
  console.log('Descargando bundle Vite...');
  const res = await fetch(url);
  const text = await res.text();
  console.log(`Tamaño bundle: ${(text.length / 1024 / 1024).toFixed(2)} MB`);

  // Buscar llamadas a subscribe
  const subMatches = new Set();
  const regSub = /subscribe\(\s*["']([^"']+)["']/g;
  let m;
  while ((m = regSub.exec(text)) !== null) {
    subMatches.add(m[1]);
  }
  console.log('\nSuscripciones encontradas:');
  for (const s of Array.from(subMatches).sort()) {
    console.log(` - ${s}`);
  }

  // Buscar llamadas a Meteor.call
  const callMatches = new Set();
  const regCall = /call\(\s*["']([^"']+)["']/g;
  while ((m = regCall.exec(text)) !== null) {
    if (m[1].includes('user') || m[1].includes('docente') || m[1].includes('instructor') || m[1].includes('export')) {
      callMatches.add(m[1]);
    }
  }
  console.log('\nMétodos relacionados con usuarios/export encontradas:');
  for (const c of Array.from(callMatches).sort()) {
    console.log(` - ${c}`);
  }
}

searchBundle().catch(console.error);
