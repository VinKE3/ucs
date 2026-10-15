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

async function discoverUsers() {
  const serverId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const sessionId = Math.random().toString(36).substring(2, 10);
  const wsUrl = `wss://cientifica.simclic.com/sockjs/${serverId}/${sessionId}/websocket`;

  console.log('📡 Conectando a SimClic para explorar catálogo de Docentes/Usuarios...');

  // @ts-ignore
  const ws = new (globalThis.WebSocket as any)(wsUrl, {
    headers: {
      'Origin': 'https://cientifica.simclic.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    },
  });

  const users: any[] = [];
  const subsReady: string[] = [];
  const subsNosub: string[] = [];

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
          console.log('✅ Login exitoso en SimClic!');

          // Probar posibles suscripciones para la tabla de usuarios/docentes
          const candidateSubs = [
            { id: 'sub-u1', name: 'users', params: [] },
            { id: 'sub-u2', name: 'users.all', params: [] },
            { id: 'sub-u3', name: 'users.manage', params: [] },
            { id: 'sub-u4', name: 'users.list', params: [] },
            { id: 'sub-u5', name: 'instructors', params: [] },
            { id: 'sub-u6', name: 'instructors.all', params: [] },
            { id: 'sub-u7', name: 'users.byAccount', params: [] },
            { id: 'sub-u8', name: 'users.byRole', params: ['instructor'] },
            { id: 'sub-u9', name: 'users.byRole2', params: ['Docente'] },
            { id: 'sub-u10', name: 'users.search', params: [{}, {}] },
            { id: 'sub-u11', name: 'users.paged', params: [{}, 0, 1000] },
          ];

          for (const s of candidateSubs) {
            sendDDP({ msg: 'sub', id: s.id, name: s.name, params: s.params });
          }

          // Probar métodos Meteor que devuelvan usuarios
          sendDDP({ msg: 'method', id: 'm-users-1', method: 'users.get', params: [] });
          sendDDP({ msg: 'method', id: 'm-users-2', method: 'users.list', params: [] });
          sendDDP({ msg: 'method', id: 'm-users-3', method: 'users.export', params: ['Docente'] });
          sendDDP({ msg: 'method', id: 'm-users-4', method: 'getInstructors', params: [] });
          sendDDP({ msg: 'method', id: 'm-users-5', method: 'instructors.get', params: [] });
        }

        if (data.msg === 'ready') {
          subsReady.push(...data.subs);
          console.log('⚡ Subscripción lista:', data.subs);
        }

        if (data.msg === 'nosub') {
          subsNosub.push(data.id);
        }

        if (data.msg === 'added' && data.collection === 'users') {
          users.push({ _id: data.id, ...data.fields });
        }

        if (data.msg === 'result' && data.id.startsWith('m-users-')) {
          if (data.result) {
            console.log(`🎯 Método [${data.id}] respondió con datos! Tipo:`, typeof data.result, Array.isArray(data.result) ? `Array de ${data.result.length}` : Object.keys(data.result));
            if (Array.isArray(data.result) && data.result.length > 0) {
              console.log('Ejemplo elemento:', JSON.stringify(data.result[0]).slice(0, 150));
            }
          }
        }
      }
    }
  };

  setTimeout(() => {
    console.log('\n📊 Resumen de Usuarios recibidos vía SockJS DDP:');
    console.log(`- Total usuarios capturados: ${users.length}`);
    console.log(`- Subscripciones aceptadas:`, subsReady);
    console.log(`- Subscripciones rechazadas (nosub):`, subsNosub);

    if (users.length > 1) {
      console.log('Muestra de usuarios:');
      for (const u of users.slice(0, 5)) {
        console.log(`  - [${u.username || u.emails?.[0]?.address}] ${u.profile?.firstName} ${u.profile?.lastName} | Tipo: ${u.profile?.type} | Último login: ${u.lastLogin?.$date ? new Date(u.lastLogin.$date).toLocaleDateString() : 'Nunca'}`);
      }
      fs.writeFileSync('src/scripts/simclic_users_dump.json', JSON.stringify(users, null, 2));
      console.log('💾 Guardado en src/scripts/simclic_users_dump.json');
    }

    ws.close();
    process.exit(0);
  }, 9000);
}

discoverUsers().catch(console.error);
