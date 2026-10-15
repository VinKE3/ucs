async function getPageDataCode() {
  const url = 'https://cientifica.simclic.com/vite/chunk/Users-o6GobnJk.js';
  const res = await fetch(url);
  const text = await res.text();

  const idx = text.indexOf('user.getPageData');
  if (idx !== -1) {
    console.log('Snippet de user.getPageData:');
    console.log(text.substring(Math.max(0, idx - 200), Math.min(text.length, idx + 400)));
  }

  const idxExp = text.indexOf('exportToXLSX');
  if (idxExp !== -1) {
    console.log('\nSnippet de exportToXLSX:');
    console.log(text.substring(Math.max(0, idxExp - 200), Math.min(text.length, idxExp + 400)));
  }
}

getPageDataCode().catch(console.error);
