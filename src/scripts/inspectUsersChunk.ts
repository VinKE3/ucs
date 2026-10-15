async function inspectUsersChunk() {
  const url = 'https://cientifica.simclic.com/vite/chunk/Users-o6GobnJk.js';
  console.log('Descargando Users-o6GobnJk.js...');
  const res = await fetch(url);
  const text = await res.text();
  console.log(`Tamaño: ${(text.length / 1024).toFixed(1)} KB`);

  // Buscar subscribe
  const subRegex = /subscribe\(\s*["']([^"']+)["']/g;
  let m;
  const subs = new Set();
  while ((m = subRegex.exec(text)) !== null) {
    subs.add(m[1]);
  }
  console.log('Subscriptions en Users chunk:', Array.from(subs));

  // Buscar call
  const callRegex = /call\(\s*["']([^"']+)["']/g;
  const calls = new Set();
  while ((m = callRegex.exec(text)) !== null) {
    calls.add(m[1]);
  }
  console.log('Meteor.call en Users chunk:', Array.from(calls));

  // Buscar nombres de metodos o colecciones
  const generalMatches = text.match(/users\.[a-zA-Z0-9_]+/g);
  console.log('users.* matches:', Array.from(new Set(generalMatches || [])));
}

inspectUsersChunk().catch(console.error);
