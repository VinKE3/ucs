import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [k, ...vParts] = trimmed.split('=');
    const key = k.trim();
    if (!process.env[key]) {
      process.env[key] = vParts.join('=').replace(/^["']|["']$/g, '').trim();
    }
  }
}

const user = process.env.SIMCLIC_USER;
const password = process.env.SIMCLIC_PASSWORD;

if (!user || !password) {
  console.error('❌ Falta SIMCLIC_USER o SIMCLIC_PASSWORD');
  process.exit(1);
}

async function testFetch() {
  const serverId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const sessionId = Math.random().toString(36).substring(2, 10);
  const wsUrl = `wss://cientifica.simclic.com/sockjs/${serverId}/${sessionId}/websocket`;

  console.log('📡 Conectando a SimClic vía SockJS...');

  // @ts-ignore
  const ws = new (globalThis.WebSocket as any)(wsUrl, {
    headers: {
      'Origin': 'https://cientifica.simclic.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    },
  });

  const collections: Record<string, any[]> = {};

  function sendDDP(msgObj: any) {
    ws.send(JSON.stringify([JSON.stringify(msgObj)]));
  }

  ws.onmessage = (event: any) => {
    const raw = event.data.toString();
    if (raw === 'o') {
      sendDDP({ msg: 'connect', version: '1', support: ['1'] });
    } else if (raw.startsWith('a')) {
      const messages = JSON.parse(raw.slice(1));
      for (const mStr of messages) {
        const data = JSON.parse(mStr);

        if (data.msg === 'connected') {
          console.log('✅ DDP conectado. Autenticando...');
          const passHash = crypto.createHash('sha256').update(password!).digest('hex');
          const userObj = user!.includes('@') ? { email: user } : { username: user };

          sendDDP({
            msg: 'method',
            id: 'login-simclic',
            method: 'login',
            params: [
              {
                user: userObj,
                password: {
                  digest: passHash,
                  algorithm: 'sha-256',
                },
              },
            ],
          });
        }

        if (data.msg === 'result' && data.id === 'login-simclic') {
          if (data.error) {
            console.error('❌ Login falló:', data.error);
            ws.close();
            process.exit(1);
          }
          console.log('✅ Login exitoso en SimClic!');

          // Probar suscripciones a degrees, courses
          sendDDP({ msg: 'sub', id: 'sub-degrees', name: 'degrees', params: [] });
          sendDDP({ msg: 'sub', id: 'sub-courses', name: 'courses', params: [] });
          sendDDP({ msg: 'sub', id: 'sub-degrees-all', name: 'degrees.all', params: [] });
          sendDDP({ msg: 'sub', id: 'sub-courses-all', name: 'courses.all', params: [] });
          sendDDP({ msg: 'sub', id: 'sub-degrees-list', name: 'degrees.list', params: [] });
          sendDDP({ msg: 'sub', id: 'sub-courses-list', name: 'courses.list', params: [] });
        }

        if (data.msg === 'added') {
          if (!collections[data.collection]) {
            collections[data.collection] = [];
            console.log(`📥 Recibiendo de colección: [${data.collection}]`);
          }
          collections[data.collection].push({ _id: data.id, ...data.fields });
        }

        if (data.msg === 'ready') {
          console.log('⚡ Subscripciones listas:', data.subs);
        }

        if (data.msg === 'nosub') {
          // Subscripción no existe en el servidor
          // Silencioso
        }
      }
    }
  };

  setTimeout(() => {
    console.log('\n📊 Resumen de colecciones recibidas:');
    for (const [col, items] of Object.entries(collections)) {
      console.log(`- Colección "${col}": ${items.length} elementos`);
      if (items.length > 0) {
        console.log(`  Ejemplo:`, JSON.stringify(items[0]).slice(0, 160));
      }
    }
    ws.close();

    // Guardar en JSON para análisis
    fs.writeFileSync('src/scripts/simclic_academic_dump.json', JSON.stringify(collections, null, 2));
    console.log('💾 Guardado en src/scripts/simclic_academic_dump.json');
    process.exit(0);
  }, 7000);
}

testFetch().catch(console.error);
