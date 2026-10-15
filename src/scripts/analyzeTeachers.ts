import fs from 'fs';

const raw = JSON.parse(fs.readFileSync('src/scripts/simclic_full_users.json', 'utf-8'));
const users: any[] = raw.data || [];

console.log('Total usuarios en SimClic:', users.length);

const types: Record<string, number> = {};
let neverLoggedIn = 0;
let loggedIn2026 = 0;
let loggedIn2025 = 0;
let loggedInOlder = 0;

const instructors: any[] = [];

for (const u of users) {
  const t = u.profile?.type || 'sin_tipo';
  types[t] = (types[t] || 0) + 1;

  if (t === 'instructor') {
    instructors.push(u);
  }

  const ll = u.lastLogin?.['$date'] || u.profile?.lastLogin?.['$date'];
  if (!ll) {
    neverLoggedIn++;
  } else {
    const yr = new Date(ll).getFullYear();
    if (yr === 2026) loggedIn2026++;
    else if (yr === 2025) loggedIn2025++;
    else loggedInOlder++;
  }
}

console.log('\n📊 Distribución por tipo de perfil:');
for (const [k, v] of Object.entries(types)) {
  console.log(`  - ${k}: ${v}`);
}

console.log('\n⏱️ Último ingreso al sistema (Last Login):');
console.log(`  - Nunca ingresaron ("Nunca"): ${neverLoggedIn} (${((neverLoggedIn / users.length) * 100).toFixed(1)}%)`);
console.log(`  - Ingresaron en 2026 (Activos este año): ${loggedIn2026}`);
console.log(`  - Ingresaron en 2025: ${loggedIn2025}`);
console.log(`  - Ingresaron en 2024 o antes: ${loggedInOlder}`);

console.log(`\n👨‍🏫 Total Docentes (profile.type === 'instructor'): ${instructors.length}`);

// Ver campos disponibles en un instructor
const sample = instructors.find(i => i.lastLogin);
console.log('\nEjemplo de docente con login:', {
  username: sample?.username,
  name: `${sample?.profile?.firstName} ${sample?.profile?.lastName}`,
  type: sample?.profile?.type,
  degreeList: sample?.profile?.scope?.degreeList,
  campusList: sample?.profile?.scope?.campusList,
  lastLogin: sample?.lastLogin,
  createdOn: sample?.profile?.createdOn,
});
