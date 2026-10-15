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

async function testGetPageData() {
  const serverId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const sessionId = Math.random().toString(36).substring(2, 10);
  const wsUrl = `wss://cientifica.simclic.com/sockjs/${serverId}/${sessionId}/websocket`;

  console.log('📡 Conectando a SimClic vía SockJS DDP para ejecutar user.getPageData...');

  // @ts-ignore
  const ws = new (globalThis.WebSocket as any)(wsUrl, {
    headers: {
      'Origin': 'https://cientifica.simclic.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    },
  });

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
          console.log('✅ Login exitoso!');

          // Llamar a user.getPageData con un rango amplio
          const params = {
            startRow: 0,
            endRow: 1000,
            sortModel: [],
            filterModel: {},
          };

          console.log('🚀 Solicitando user.getPageData con params:', params);
          sendDDP({
            msg: 'method',
            id: 'call-get-users',
            method: 'user.getPageData',
            params: [params],
          });
        }

        if (data.msg === 'result' && data.id === 'call-get-users') {
          if (data.error) {
            console.error('❌ Error en user.getPageData:', data.error);
          } else {
            const res = data.result;
            console.log('\n🎉 user.getPageData respondió con éxito!');
            console.log(`- Total count en SimClic: ${res?.totalCount}`);
            console.log(`- Registros devueltos: ${res?.data?.length}`);

            if (res?.data && res.data.length > 0) {
              console.log('\nEjemplo primer registro:');
              console.log(JSON.stringify(res.data[0], null, 2));

              fs.writeFileSync('src/scripts/simclic_full_users.json', JSON.stringify(res, null, 2));
              console.log('💾 Guardado en src/scripts/simclic_full_users.json');
            }
          }
          ws.close();
          process.exit(0);
        }
      }
    }
  };
}

testGetPageData().catch(console.error);
