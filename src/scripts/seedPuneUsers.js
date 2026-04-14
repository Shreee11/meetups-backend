/**
 * Pune Discovery Test Users — Seed Script
 * ─────────────────────────────────────────────────────────────────────────────
 * Adds 20 fresh Pune-location users WITHOUT wiping existing data.
 * They will appear in the discovery feed for the test user (test@demo.com).
 *
 * Usage (from backend/ directory):
 *   node src/scripts/seedPuneUsers.js
 *   # or with custom count:
 *   COUNT=30 node src/scripts/seedPuneUsers.js
 *
 * Cleanup (remove only these seeded users):
 *   node src/scripts/seedPuneUsers.js --clean
 *
 * These users have:
 *   - Location spread across Pune landmarks (Koregaon Park, Hinjewadi, Kothrud…)
 *   - Varied ages (21–35), genders (male/female), Elo scores
 *   - Some with active boosts, some with premium subscriptions
 *   - High interest overlap with test user for Elo ranking testing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// ─── Pune landmark coordinates [lng, lat] ─────────────────────────────────────
const PUNE_AREAS = [
  { name: 'Koregaon Park',    coords: [73.8931, 18.5362] },
  { name: 'Hinjewadi',        coords: [73.7380, 18.5908] },
  { name: 'Kothrud',          coords: [73.8083, 18.5074] },
  { name: 'Wakad',            coords: [73.7606, 18.5979] },
  { name: 'Aundh',            coords: [73.8073, 18.5579] },
  { name: 'Baner',            coords: [73.7868, 18.5590] },
  { name: 'Viman Nagar',      coords: [73.9165, 18.5679] },
  { name: 'Hadapsar',         coords: [73.9388, 18.5076] },
  { name: 'Magarpatta',       coords: [73.9272, 18.5167] },
  { name: 'Deccan Gymkhana',  coords: [73.8421, 18.5162] },
  { name: 'Shivajinagar',     coords: [73.8474, 18.5308] },
  { name: 'Pimpri',           coords: [73.7998, 18.6279] },
  { name: 'Camp',             coords: [73.8700, 18.5183] },
  { name: 'Kalyani Nagar',    coords: [73.9059, 18.5462] },
  { name: 'Sus',              coords: [73.7744, 18.5703] },
  { name: 'Pashan',           coords: [73.8011, 18.5426] },
  { name: 'Sinhagad Road',    coords: [73.8120, 18.4733] },
  { name: 'Balewadi',         coords: [73.7797, 18.5773] },
  { name: 'Kondhwa',          coords: [73.8913, 18.4605] },
  { name: 'Nibm Road',        coords: [73.8962, 18.4714] },
];

// ─── Photo banks ──────────────────────────────────────────────────────────────
const PHOTOS = {
  f: [
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500',
    'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=500',
    'https://images.unsplash.com/photo-1514315384763-ba401779410f?w=500',
    'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=500',
    'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=500',
  ],
  m: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500',
    'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=500',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500',
    'https://images.unsplash.com/photo-1558203728-00f45181dd84?w=500',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500',
    'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=500',
  ],
};

// ─── Test user profile (for preference match) ─────────────────────────────────
// test@demo.com: male, 28 yrs, interests: Technology/Coffee/Travel/Hiking/Photography/Music
const PUNE_USERS = [
  // ── females — high interest overlap ──────────────────────────────────────
  {
    phone: '+919000000001', email: 'priya.pune@demo.com',
    firstName: 'Priya', lastName: 'Sharma', gender: 'female',
    age: 25, bio: 'Software engineer at Infosys 💻 | Coffee addict ☕ | Weekend hiker 🏔️',
    jobTitle: 'Software Engineer', company: 'Infosys', school: 'COEP',
    interests: ['Technology', 'Coffee', 'Hiking', 'Photography', 'Travel'],
    area: 0, photoIdx: 0, eloScore: 1600,
    subscription: { type: 'free' },
  },
  {
    phone: '+919000000002', email: 'ananya.pune@demo.com',
    firstName: 'Ananya', lastName: 'Patel', gender: 'female',
    age: 27, bio: 'UX Designer 🎨 | Cafe hopper | Travel blogger ✈️',
    jobTitle: 'UX Designer', company: 'Persistent Systems', school: 'PICT',
    interests: ['Art', 'Travel', 'Photography', 'Coffee', 'Music'],
    area: 1, photoIdx: 1, eloScore: 1500,
    subscription: { type: 'plus', startDate: daysAgo(10), endDate: daysFromNow(20) },
  },
  {
    phone: '+919000000003', email: 'sneha.pune@demo.com',
    firstName: 'Sneha', lastName: 'Kulkarni', gender: 'female',
    age: 23, bio: 'CS student at VIT 📚 | Fitness addict | Love music festivals 🎵',
    jobTitle: 'Student', company: '', school: 'VIT Pune',
    interests: ['Music', 'Fitness', 'Technology', 'Dancing', 'Travel'],
    area: 2, photoIdx: 2, eloScore: 1350,
    subscription: { type: 'free' },
  },
  {
    phone: '+919000000004', email: 'riya.pune@demo.com',
    firstName: 'Riya', lastName: 'Desai', gender: 'female',
    age: 29, bio: 'Product Manager 📊 | Marathon runner 🏃‍♀️ | Third-wave coffee fan',
    jobTitle: 'Product Manager', company: 'Cummins India', school: 'Symbiosis',
    interests: ['Coffee', 'Fitness', 'Technology', 'Reading', 'Travel'],
    area: 3, photoIdx: 3, eloScore: 1700,
    subscription: { type: 'gold', startDate: daysAgo(5), endDate: daysFromNow(25) },
    boost: { active: true, expiresAt: new Date(Date.now() + 25 * 60_000) },
  },
  {
    phone: '+919000000005', email: 'pooja.pune@demo.com',
    firstName: 'Pooja', lastName: 'Mehta', gender: 'female',
    age: 24, bio: 'Yoga instructor 🧘‍♀️ | Cat parent 🐱 | Nature lover',
    jobTitle: 'Yoga Instructor', company: 'Zen Yoga Studio', school: 'Fergusson',
    interests: ['Yoga', 'Nature', 'Cooking', 'Music', 'Travel'],
    area: 4, photoIdx: 4, eloScore: 1420,
    subscription: { type: 'free' },
  },
  {
    phone: '+919000000006', email: 'kavya.pune@demo.com',
    firstName: 'Kavya', lastName: 'Joshi', gender: 'female',
    age: 26, bio: 'Data scientist 📈 | Trekker ⛰️ | Bookworm | Chai > Coffee',
    jobTitle: 'Data Scientist', company: 'Zensar', school: 'BITS Pilani',
    interests: ['Technology', 'Hiking', 'Reading', 'Photography', 'Nature'],
    area: 5, photoIdx: 5, eloScore: 1550,
    subscription: { type: 'free' },
  },
  {
    phone: '+919000000007', email: 'nisha.pune@demo.com',
    firstName: 'Nisha', lastName: 'Iyer', gender: 'female',
    age: 30, bio: 'Doctor 👩‍⚕️ | Foodie 🍲 | Weekend road trips 🚗',
    jobTitle: 'Resident Doctor', company: 'KEM Hospital', school: 'B.J. Medical College',
    interests: ['Travel', 'Cooking', 'Art', 'Movies', 'Coffee'],
    area: 6, photoIdx: 6, eloScore: 1480,
    subscription: { type: 'platinum', startDate: daysAgo(7), endDate: daysFromNow(23) },
  },
  {
    phone: '+919000000008', email: 'divya.pune@demo.com',
    firstName: 'Divya', lastName: 'Nair', gender: 'female',
    age: 22, bio: 'Final year engineering 👩‍💻 | Amateur photographer 📷 | Coffee junkie',
    jobTitle: 'Student', company: '', school: 'PICT',
    interests: ['Photography', 'Coffee', 'Music', 'Art', 'Dancing'],
    area: 7, photoIdx: 7, eloScore: 1300,
    subscription: { type: 'free' },
  },
  {
    phone: '+919000000009', email: 'tanvi.pune@demo.com',
    firstName: 'Tanvi', lastName: 'Bapat', gender: 'female',
    age: 28, bio: 'Startup founder 🚀 | Hiker | Coffee snob ☕ | Dog mom 🐕',
    jobTitle: 'Co-Founder', company: 'PuneStack Labs', school: 'IIT Bombay',
    interests: ['Technology', 'Hiking', 'Coffee', 'Travel', 'Dogs'],
    area: 8, photoIdx: 8, eloScore: 1750,
    subscription: { type: 'gold', startDate: daysAgo(15), endDate: daysFromNow(15) },
  },
  {
    phone: '+919000000010', email: 'meera.pune@demo.com',
    firstName: 'Meera', lastName: 'Chavan', gender: 'female',
    age: 31, bio: 'Graphic designer 🎨 | Vinyl collector 🎵 | Slow travel advocate',
    jobTitle: 'Graphic Designer', company: 'Creative Monk', school: 'MIT Pune',
    interests: ['Art', 'Music', 'Photography', 'Travel', 'Coffee'],
    area: 9, photoIdx: 9, eloScore: 1380,
    subscription: { type: 'free' },
  },
  // ── males ─────────────────────────────────────────────────────────────────
  {
    phone: '+919000000011', email: 'arjun.pune@demo.com',
    firstName: 'Arjun', lastName: 'Patil', gender: 'male',
    age: 26, bio: 'Backend dev ⚙️ | Pune FC fan ⚽ | Weekend trekker',
    jobTitle: 'Backend Developer', company: 'Wipro', school: 'COEP',
    interests: ['Technology', 'Sports', 'Hiking', 'Gaming', 'Music'],
    area: 10, photoIdx: 0, eloScore: 1430,
    subscription: { type: 'free' },
  },
  {
    phone: '+919000000012', email: 'rahul.pune@demo.com',
    firstName: 'Rahul', lastName: 'Shinde', gender: 'male',
    age: 28, bio: 'DevOps engineer ☁️ | Coffee lover | Motorbike rides every Sunday 🏍️',
    jobTitle: 'DevOps Engineer', company: 'TCS', school: 'SP College',
    interests: ['Technology', 'Coffee', 'Travel', 'Photography', 'Fitness'],
    area: 11, photoIdx: 1, eloScore: 1500,
    subscription: { type: 'free' },
  },
  {
    phone: '+919000000013', email: 'karan.pune@demo.com',
    firstName: 'Karan', lastName: 'Bhosale', gender: 'male',
    age: 24, bio: 'Engineering student | Music producer 🎹 | Coffee at Vohuman every morning ☕',
    jobTitle: 'Student', company: '', school: 'PICT',
    interests: ['Music', 'Coffee', 'Art', 'Technology', 'Fitness'],
    area: 12, photoIdx: 2, eloScore: 1280,
    subscription: { type: 'free' },
  },
  {
    phone: '+919000000014', email: 'siddharth.pune@demo.com',
    firstName: 'Siddharth', lastName: 'More', gender: 'male',
    age: 32, bio: 'Senior architect 🏛️ | Half-marathon finisher | Jazz aficionado 🎷',
    jobTitle: 'Senior Architect', company: 'HDFC Bank IT', school: 'Columbia GSAPP',
    interests: ['Art', 'Music', 'Fitness', 'Coffee', 'Travel'],
    area: 13, photoIdx: 3, eloScore: 1620,
    subscription: { type: 'plus', startDate: daysAgo(20), endDate: daysFromNow(10) },
  },
  {
    phone: '+919000000015', email: 'nikhil.pune@demo.com',
    firstName: 'Nikhil', lastName: 'Gaikwad', gender: 'male',
    age: 27, bio: 'Flutter dev 📱 | Photography obsessive | Prefer trails to treadmills 🌿',
    jobTitle: 'Mobile Developer', company: 'Capgemini', school: 'MIT Pune',
    interests: ['Technology', 'Photography', 'Hiking', 'Coffee', 'Travel'],
    area: 14, photoIdx: 4, eloScore: 1580,
    subscription: { type: 'free' },
  },
  {
    phone: '+919000000016', email: 'varun.pune@demo.com',
    firstName: 'Varun', lastName: 'Kulkarni', gender: 'male',
    age: 25, bio: 'AI/ML enthusiast 🤖 | Trekked Kalsubai solo | Need coffee IV drip ☕',
    jobTitle: 'ML Engineer', company: 'Synaptics', school: 'IIT Pune',
    interests: ['Technology', 'Coffee', 'Hiking', 'Reading', 'Gaming'],
    area: 15, photoIdx: 5, eloScore: 1460,
    subscription: { type: 'free' },
  },
  {
    phone: '+919000000017', email: 'rohit.pune@demo.com',
    firstName: 'Rohit', lastName: 'Deshpande', gender: 'male',
    age: 33, bio: 'Entrepreneur 🛍️ | Long-distance cyclist 🚴 | Coffee shop regular',
    jobTitle: 'Co-Founder', company: 'GrowthBox', school: 'Fergusson College',
    interests: ['Coffee', 'Fitness', 'Travel', 'Technology', 'Art'],
    area: 16, photoIdx: 6, eloScore: 1670,
    subscription: { type: 'gold', startDate: daysAgo(8), endDate: daysFromNow(22) },
    boost: { active: true, expiresAt: new Date(Date.now() + 15 * 60_000) },
  },
  {
    phone: '+919000000018', email: 'aditya.pune@demo.com',
    firstName: 'Aditya', lastName: 'Wagh', gender: 'male',
    age: 21, bio: 'CS sophomore | Indie music fan 🎸 | Weekend Sinhagad trek regular',
    jobTitle: 'Student', company: '', school: 'PICT',
    interests: ['Music', 'Hiking', 'Technology', 'Gaming', 'Photography'],
    area: 17, photoIdx: 7, eloScore: 1320,
    subscription: { type: 'free' },
  },
  {
    phone: '+919000000019', email: 'yash.pune@demo.com',
    firstName: 'Yash', lastName: 'Jadhav', gender: 'male',
    age: 29, bio: 'Full-stack dev | Scooty rides at midnight | Best espresso finder in Pune ☕',
    jobTitle: 'Full Stack Developer', company: 'Mphasis', school: 'COEP',
    interests: ['Technology', 'Coffee', 'Music', 'Travel', 'Photography'],
    area: 18, photoIdx: 8, eloScore: 1540,
    subscription: { type: 'free' },
  },
  {
    phone: '+919000000020', email: 'vikas.pune@demo.com',
    firstName: 'Vikas', lastName: 'Pawar', gender: 'male',
    age: 35, bio: 'Startup mentor 🧭 | Trail runner 🏃 | Big on specialty coffee and open source',
    jobTitle: 'Engineering Manager', company: 'Thoughtworks', school: 'IIT Bombay',
    interests: ['Technology', 'Fitness', 'Coffee', 'Travel', 'Reading'],
    area: 19, photoIdx: 9, eloScore: 1800,
    subscription: { type: 'platinum', startDate: daysAgo(12), endDate: daysFromNow(18) },
  },
];

// ─── Utility helpers ──────────────────────────────────────────────────────────
function daysAgo(n)    { return new Date(Date.now() - n * 86_400_000); }
function daysFromNow(n){ return new Date(Date.now() + n * 86_400_000); }

function makeBirthday(age) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setDate(d.getDate() - Math.floor(Math.random() * 180)); // ±180 day variance
  return d;
}

// Add small jitter to coordinates so users aren't stacked
function jitter(coord) {
  return coord + (Math.random() - 0.5) * 0.02;
}

function makeLocation(area) {
  const [lng, lat] = PUNE_AREAS[area].coords;
  return {
    type: 'Point',
    coordinates: [jitter(lng), jitter(lat)],
    city: 'Pune',
    country: 'India',
  };
}

const RELATIONSHIP_GOALS = ['long_term', 'casual', 'friendship', 'unsure'];
const LIFESTYLES = [
  { drinking: 'socially', smoking: 'never',    exercise: 'often',     diet: 'omnivore',   children: 'open',       education: 'college',  zodiac: 'aries'       },
  { drinking: 'never',    smoking: 'never',    exercise: 'daily',     diet: 'vegetarian', children: 'dont_want',  education: 'postgrad', zodiac: 'taurus'      },
  { drinking: 'socially', smoking: 'socially', exercise: 'sometimes', diet: 'omnivore',   children: 'want',       education: 'college',  zodiac: 'gemini'      },
  { drinking: 'never',    smoking: 'never',    exercise: 'often',     diet: 'vegan',      children: 'open',       education: 'postgrad', zodiac: 'libra'       },
  { drinking: 'socially', smoking: 'never',    exercise: 'sometimes', diet: 'omnivore',   children: 'open',       education: 'college',  zodiac: 'scorpio'     },
];

const PRONOUNS_MAP = { male: 'he/him', female: 'she/her' };

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const isClean = process.argv.includes('--clean');
  const count = parseInt(process.env.COUNT || '20', 10);

  console.log('🔌 Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected\n');

  if (isClean) {
    const deleted = await User.deleteMany({ email: { $regex: /@demo\.com$/, $options: 'i' }, phone: { $regex: /^\+919/ } });
    console.log(`🗑️  Removed ${deleted.deletedCount} Pune test users`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── Remove any stale Pune test users from a previous run ──────────────────
  await User.deleteMany({ phone: { $in: PUNE_USERS.map(u => u.phone) } });
  console.log('♻️  Cleared previous Pune test users\n');

  const toCreate = PUNE_USERS.slice(0, count);
  const created = [];

  for (const def of toCreate) {
    const gKey = def.gender === 'female' ? 'f' : 'm';
    const photoList = PHOTOS[gKey];
    const photos = [
      { url: photoList[def.photoIdx % photoList.length],            publicId: `pune_${def.phone}_0`, order: 0, isMain: true  },
      { url: photoList[(def.photoIdx + 1) % photoList.length],      publicId: `pune_${def.phone}_1`, order: 1, isMain: false },
      { url: photoList[(def.photoIdx + 2) % photoList.length],      publicId: `pune_${def.phone}_2`, order: 2, isMain: false },
    ];

    const user = new User({
      phone:            def.phone,
      email:            def.email,
      password:         'demo1234',          // all Pune users share same test password
      firstName:        def.firstName,
      lastName:         def.lastName,
      birthday:         makeBirthday(def.age),
      gender:           def.gender,
      bio:              def.bio,
      jobTitle:         def.jobTitle,
      company:          def.company || '',
      school:           def.school  || '',
      height:           150 + Math.floor(Math.random() * 40),   // 150–190 cm
      pronouns:         PRONOUNS_MAP[def.gender],
      relationshipGoal: RELATIONSHIP_GOALS[def.photoIdx % RELATIONSHIP_GOALS.length],
      lifestyle:        LIFESTYLES[def.photoIdx % LIFESTYLES.length],
      photos,
      location:         makeLocation(def.area),
      preferences:      { ageMin: 18, ageMax: 40, distanceMax: 80, gender: 'everyone', global: false },
      interests:        def.interests,
      eloScore:         def.eloScore,
      verified:         true,
      emailVerified:    true,
      active:           true,
      showMe:           true,
      phoneVerified:    true,
      subscription:     def.subscription,
      boost:            def.boost || { active: false },
      isOnline:         Math.random() > 0.6,     // ~40% appear online
      lastActive:       new Date(Date.now() - Math.floor(Math.random() * 4 * 3_600_000)),
      notificationSettings: { newMatches: true, messages: true, superLikes: true, messageLikes: true },
    });

    await user.save();
    created.push(user);

    const area = PUNE_AREAS[def.area].name;
    const boostTag = def.boost?.active ? ' 🚀 BOOST' : '';
    const premTag  = def.subscription?.type !== 'free' ? ` [${def.subscription.type}]` : '';
    console.log(`  ✔ ${def.firstName.padEnd(12)} ${def.gender === 'female' ? '♀' : '♂'}  age ${def.age}  Elo ${def.eloScore}  📍${area}${boostTag}${premTag}`);
  }

  const females = created.filter(u => u.gender === 'female').length;
  const males   = created.filter(u => u.gender === 'male').length;
  const boosted = created.filter(u => u.boost?.active).length;
  const premium = created.filter(u => u.subscription?.type !== 'free').length;

  const line = '─'.repeat(60);
  console.log(`\n${line}`);
  console.log(`✅ Created ${created.length} Pune discovery users`);
  console.log(`   ♀  Females : ${females}   ♂  Males  : ${males}`);
  console.log(`   🚀 Boosted : ${boosted}   👑 Premium: ${premium}`);
  console.log(`\nThey will appear in discovery for test@demo.com`);
  console.log(`Password for all Pune users: demo1234`);
  console.log(line);
  console.log('\nSwipe test commands:');
  console.log('  npm run seed:pune           — recreate all 20 Pune users');
  console.log('  COUNT=10 node src/scripts/seedPuneUsers.js  — seed only 10');
  console.log('  node src/scripts/seedPuneUsers.js --clean   — remove Pune users');
}

run()
  .catch(err => { console.error('❌ Seed error:', err); process.exit(1); })
  .finally(() => mongoose.disconnect().then(() => process.exit(0)));
