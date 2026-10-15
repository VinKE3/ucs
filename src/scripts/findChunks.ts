async function findChunks() {
  const url = 'https://cientifica.simclic.com/vite/entry-client/main-DoYvqcpw.entry.js';
  const res = await fetch(url);
  const text = await res.text();

  const chunkRegex = /["']\/vite\/entry-client\/([^"']+\.js)["']/g;
  const chunks = new Set<string>();
  let m;
  while ((m = chunkRegex.exec(text)) !== null) {
    chunks.add(m[1]);
  }
  console.log(`Encontrados ${chunks.size} chunks.`);

  // Buscar chunks con nombres como user, manage, account, etc.
  for (const c of chunks) {
    if (c.toLowerCase().includes('user') || c.toLowerCase().includes('account') || c.toLowerCase().includes('admin') || c.toLowerCase().includes('manage')) {
      console.log(`Chunk relevante: ${c}`);
    }
  }
}
findChunks().catch(console.error);
