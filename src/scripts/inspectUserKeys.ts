import fs from 'fs';

const raw = JSON.parse(fs.readFileSync('src/scripts/simclic_full_users.json', 'utf-8'));
const users: any[] = raw.data || [];

console.log('Keys of user 0:', Object.keys(users[0]));
console.log('User 0:', JSON.stringify(users[0], null, 2));

const userWithLogin = users.find(u => u.lastLogin || u.profile?.lastLogin);
if (userWithLogin) {
  console.log('\nUser with login:', JSON.stringify(userWithLogin, null, 2));
}
