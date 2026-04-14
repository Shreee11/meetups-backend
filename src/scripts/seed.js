/**
 * Seed Script — Comprehensive demo data covering every feature.
 * Run with: npm run seed  (from the backend/ directory)
 *
 * ┌────────────────────────────────────────┐
 * │  TEST ACCOUNT                          │
 * │  Email    : test@demo.com              │
 * │  Password : demo1234                   │
 * │  Phone    : +11111111111               │
 * └────────────────────────────────────────┘
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User         = require('../models/User');
const Swipe        = require('../models/Swipe');
const Match        = require('../models/Match');
const Message      = require('../models/Message');
const Notification = require('../models/Notification');
const Report       = require('../models/Report');

// ─── Photo bank ───────────────────────────────────────────────────────────────
const PH = {
  f: [
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500',
    'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=500',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500',
    'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=500',
  ],
  m: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500',
    'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=500',
    'https://images.unsplash.com/photo-1463453091185-61582044d556?w=500',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500',
    'https://images.unsplash.com/photo-1558203728-00f45181dd84?w=500',
  ],
  ef: [
    'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=500',
    'https://images.unsplash.com/photo-1509558050756-73ea21a6c9a5?w=500',
    'https://images.unsplash.com/photo-1521252659862-eec69941b071?w=500',
    'https://images.unsplash.com/photo-1526510747491-58f928ec870f?w=500',
    'https://images.unsplash.com/photo-1514315384763-ba401779410f?w=500',
    'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=500',
    'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=500',
    'https://images.unsplash.com/photo-1462804993656-fac4ff489837?w=500',
  ],
  em: [
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500',
    'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=500',
    'https://images.unsplash.com/photo-1507081323647-4d250478b919?w=500',
    'https://images.unsplash.com/photo-1516914943479-89db7d9ae7f2?w=500',
    'https://images.unsplash.com/photo-1480455624313-e29b44bbfde1?w=500',
    'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=500',
    'https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?w=500',
  ],
  gif:      'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif',
  chatImg:  'https://images.unsplash.com/photo-1504700610630-ac6aba3536d3?w=400',
  voiceUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const oid      = () => new mongoose.Types.ObjectId();
const daysAgo  = (n) => new Date(Date.now() - n * 86_400_000);
const hoursAgo = (n) => new Date(Date.now() - n * 3_600_000);
const minsAgo  = (n) => new Date(Date.now() - n * 60_000);
const loc      = (latOff = 0, lngOff = 0) => ({
  type: 'Point',
  coordinates: [73.8567 + lngOff, 18.5204 + latOff],
  city: 'Pune',
  country: 'India',
});

const DEMO_PASSWORD = 'demo1234';

// ─── User definitions ─────────────────────────────────────────────────────────
//  Index map:
//  0=Emma  1=James  2=Sophia  3=Michael  4=Olivia  5=William  6=Ava
//  7=Alexander  8=Isabella  9=Ethan  10=Mia  11=Daniel  12=Charlotte
//  13=Matthew  14=Amelia   15=TEST USER
const USER_DEFS = [
  /* 0 Emma — matches test user; text + image + gif conversation */
  {
    phone: '+11234567001', email: 'emma@demo.com', password: DEMO_PASSWORD,
    firstName: 'Emma', lastName: 'Johnson', birthday: new Date('1998-05-15'), gender: 'female',
    bio: 'Adventure seeker 🌍 | Coffee addict ☕ | Looking for someone to explore the world with!',
    jobTitle: 'Marketing Manager', company: 'Creative Agency', school: 'NYU',
    height: 165, pronouns: 'she/her', relationshipGoal: 'long_term',
    lifestyle: { drinking: 'socially', smoking: 'never', exercise: 'often', diet: 'omnivore', children: 'want', education: 'college', zodiac: 'taurus' },
    prompts: [
      { question: 'My ideal weekend looks like…', answer: 'A morning hike, brunch at a hidden gem, then an afternoon at an art gallery.' },
      { question: "I'm looking for…", answer: "Someone who can keep up with my adventures but also enjoy a cozy night in." },
    ],
    g: 'f', pi: 0, ei: 0, interests: ['Travel', 'Photography', 'Coffee', 'Hiking', 'Art'],
    subscription: { type: 'free' }, latOff: 0.01, lngOff: 0.02,
  },
  /* 1 James — liked test user (pending), Gold subscriber */
  {
    phone: '+11234567002', email: 'james@demo.com', password: DEMO_PASSWORD,
    firstName: 'James', lastName: 'Williams', birthday: new Date('1995-08-22'), gender: 'male',
    bio: "Software engineer by day, musician by night 🎸 | Dog dad 🐕 | Let's grab coffee!",
    jobTitle: 'Software Engineer', company: 'Tech Startup', school: 'MIT',
    height: 182, pronouns: 'he/him', relationshipGoal: 'long_term',
    lifestyle: { drinking: 'socially', smoking: 'never', exercise: 'sometimes', diet: 'omnivore', children: 'open', education: 'college', zodiac: 'virgo' },
    prompts: [
      { question: 'The way to my heart is…', answer: 'Good music, great food, and genuine conversation.' },
      { question: 'My most controversial opinion…', answer: 'Pineapple on pizza is actually great.' },
    ],
    g: 'm', pi: 0, ei: 0, interests: ['Music', 'Technology', 'Dogs', 'Coffee', 'Gaming'],
    subscription: { type: 'gold', startDate: daysAgo(15), endDate: new Date(Date.now() + 15 * 86_400_000) },
    latOff: -0.02, lngOff: 0.03,
  },
  /* 2 Sophia — matches test user; voice message (audio type) */
  {
    phone: '+11234567003', email: 'sophia@demo.com', password: DEMO_PASSWORD,
    firstName: 'Sophia', lastName: 'Brown', birthday: new Date('1997-03-10'), gender: 'female',
    bio: 'Yoga instructor 🧘‍♀️ | Foodie 🍕 | Beach lover 🏖️ | Positive vibes only ✨',
    jobTitle: 'Yoga Instructor', company: 'Zen Studio', school: 'UCLA',
    height: 168, pronouns: 'she/her', relationshipGoal: 'casual',
    lifestyle: { drinking: 'never', smoking: 'never', exercise: 'daily', diet: 'vegetarian', children: 'dont_want', education: 'college', zodiac: 'pisces' },
    prompts: [
      { question: 'A life goal of mine is…', answer: "Travel to every continent before I'm 35. Currently at 4 out of 7!" },
      { question: 'I get along best with people who…', answer: "Are kind to waitstaff and don't take themselves too seriously." },
    ],
    g: 'f', pi: 1, ei: 1, interests: ['Yoga', 'Beach', 'Cooking', 'Travel', 'Nature'],
    subscription: { type: 'free' }, latOff: 0.005, lngOff: -0.015,
  },
  /* 3 Michael — liked test user (pending), discoverable */
  {
    phone: '+11234567004', email: 'michael@demo.com', password: DEMO_PASSWORD,
    firstName: 'Michael', lastName: 'Davis', birthday: new Date('1993-11-28'), gender: 'male',
    bio: 'Photographer 📷 | Travel enthusiast | Looking for my partner in crime',
    jobTitle: 'Photographer', company: 'Freelance', school: 'RISD',
    height: 178, pronouns: 'he/him', relationshipGoal: 'unsure',
    lifestyle: { drinking: 'socially', smoking: 'socially', exercise: 'sometimes', diet: 'omnivore', children: 'open', education: 'college', zodiac: 'sagittarius' },
    prompts: [
      { question: 'Best travel story…', answer: 'Got stranded in Lisbon for a week due to a strike. Best accident ever.' },
    ],
    g: 'm', pi: 1, ei: 1, interests: ['Photography', 'Travel', 'Art', 'Movies', 'Coffee'],
    subscription: { type: 'free' }, latOff: 0.03, lngOff: -0.01,
  },
  /* 4 Olivia — matches test user; 0 messages (new match state); Platinum */
  {
    phone: '+11234567005', email: 'olivia@demo.com', password: DEMO_PASSWORD,
    firstName: 'Olivia', lastName: 'Miller', birthday: new Date('1999-07-04'), gender: 'female',
    bio: 'Med student 👩‍⚕️ | Netflix binge-watcher | Looking for someone who can make me laugh',
    jobTitle: 'Medical Student', company: '', school: 'Harvard Medical',
    height: 162, pronouns: 'she/her', relationshipGoal: 'long_term',
    lifestyle: { drinking: 'socially', smoking: 'never', exercise: 'sometimes', diet: 'omnivore', children: 'want', education: 'postgrad', zodiac: 'cancer' },
    prompts: [
      { question: "I'm weirdly attracted to…", answer: 'People who are passionate about obscure hobbies.' },
      { question: 'My love language is…', answer: "Acts of service. I'll remember your coffee order forever." },
    ],
    g: 'f', pi: 2, ei: 2, interests: ['Netflix', 'Reading', 'Cooking', 'Fitness', 'Travel'],
    subscription: { type: 'platinum', startDate: daysAgo(5), endDate: new Date(Date.now() + 25 * 86_400_000) },
    latOff: -0.01, lngOff: 0.04,
  },
  /* 5 William — liked test user (pending), test swiped nope */
  {
    phone: '+11234567006', email: 'william@demo.com', password: DEMO_PASSWORD,
    firstName: 'William', lastName: 'Garcia', birthday: new Date('1994-02-14'), gender: 'male',
    bio: "Chef 👨‍🍳 | Wine lover 🍷 | I'll cook you dinner if you bring dessert",
    jobTitle: 'Executive Chef', company: 'Fine Dining Restaurant', school: 'Le Cordon Bleu',
    height: 180, pronouns: 'he/him', relationshipGoal: 'long_term',
    lifestyle: { drinking: 'often', smoking: 'never', exercise: 'sometimes', diet: 'omnivore', children: 'open', education: 'trade', zodiac: 'aquarius' },
    prompts: [
      { question: 'My simple pleasures are…', answer: 'Sunday brunch, a good novel, and a perfectly made espresso.' },
    ],
    g: 'm', pi: 2, ei: 2, interests: ['Cooking', 'Wine', 'Foodie', 'Travel', 'Art'],
    subscription: { type: 'free' }, latOff: -0.03, lngOff: -0.02,
  },
  /* 6 Ava — discoverable; Gold expiring soon */
  {
    phone: '+11234567007', email: 'ava@demo.com', password: DEMO_PASSWORD,
    firstName: 'Ava', lastName: 'Martinez', birthday: new Date('1996-09-18'), gender: 'female',
    bio: 'Fashion designer 👗 | Art gallery regular | Looking for intellectual conversations',
    jobTitle: 'Fashion Designer', company: 'Boutique Label', school: 'Parsons',
    height: 170, pronouns: 'she/her', relationshipGoal: 'long_term',
    lifestyle: { drinking: 'socially', smoking: 'never', exercise: 'often', diet: 'vegan', children: 'dont_want', education: 'college', zodiac: 'libra' },
    prompts: [
      { question: 'Unusual skill I have…', answer: 'I can draw a fashion sketch in under 3 minutes.' },
      { question: 'On Sundays I like to…', answer: 'Visit galleries, then spend the afternoon sketching in a cafe.' },
    ],
    g: 'f', pi: 3, ei: 3, interests: ['Fashion', 'Art', 'Travel', 'Coffee', 'Music'],
    subscription: { type: 'gold', startDate: daysAgo(25), endDate: new Date(Date.now() + 5 * 86_400_000) },
    latOff: 0.02, lngOff: 0.01,
  },
  /* 7 Alexander — SUPERLIKED test user → superlike match; has been reported */
  {
    phone: '+11234567008', email: 'alexander@demo.com', password: DEMO_PASSWORD,
    firstName: 'Alexander', lastName: 'Anderson', birthday: new Date('1992-12-25'), gender: 'male',
    bio: 'Lawyer ⚖️ | Weekend hiker 🏔️ | Board game enthusiast | Looking for something real',
    jobTitle: 'Attorney', company: 'Law Firm', school: 'Yale Law',
    height: 186, pronouns: 'he/him', relationshipGoal: 'long_term',
    lifestyle: { drinking: 'socially', smoking: 'never', exercise: 'often', diet: 'omnivore', children: 'want', education: 'postgrad', zodiac: 'capricorn' },
    prompts: [
      { question: 'I debate too much about…', answer: 'Whether hot dogs are sandwiches. (They totally are.)' },
      { question: 'My most controversial opinion…', answer: 'Board games are more fun than video games.' },
    ],
    g: 'm', pi: 3, ei: 3, interests: ['Hiking', 'Reading', 'Gaming', 'Movies', 'Sports'],
    subscription: { type: 'platinum', startDate: daysAgo(20), endDate: new Date(Date.now() + 10 * 86_400_000) },
    latOff: -0.015, lngOff: 0.025,
  },
  /* 8 Isabella — discoverable, no match */
  {
    phone: '+11234567009', email: 'isabella@demo.com', password: DEMO_PASSWORD,
    firstName: 'Isabella', lastName: 'Thomas', birthday: new Date('1998-01-30'), gender: 'female',
    bio: 'Dance teacher 💃 | Cat mom 🐱 | Sarcasm is my love language',
    jobTitle: 'Dance Instructor', company: 'Dance Academy', school: 'Juilliard',
    height: 163, pronouns: 'she/her', relationshipGoal: 'casual',
    lifestyle: { drinking: 'socially', smoking: 'never', exercise: 'daily', diet: 'omnivore', children: 'open', education: 'college', zodiac: 'aquarius' },
    prompts: [
      { question: "I'm known for…", answer: 'Breaking into spontaneous dance at deeply inappropriate moments.' },
    ],
    g: 'f', pi: 4, ei: 4, interests: ['Dancing', 'Music', 'Cats', 'Movies', 'Fitness'],
    subscription: { type: 'free' }, latOff: 0.035, lngOff: -0.025,
  },
  /* 9 Ethan — BLOCKED by test user; has active boost; Gold */
  {
    phone: '+11234567010', email: 'ethan@demo.com', password: DEMO_PASSWORD,
    firstName: 'Ethan', lastName: 'Jackson', birthday: new Date('1995-06-08'), gender: 'male',
    bio: 'Startup founder 🚀 | Gym rat 💪 | Looking for someone ambitious and fun',
    jobTitle: 'CEO', company: 'Tech Startup', school: 'Stanford',
    height: 183, pronouns: 'he/him', relationshipGoal: 'casual',
    lifestyle: { drinking: 'socially', smoking: 'never', exercise: 'daily', diet: 'omnivore', children: 'dont_want', education: 'college', zodiac: 'gemini' },
    prompts: [
      { question: 'The first thing I notice about someone…', answer: "How they treat people who can't do anything for them." },
    ],
    g: 'm', pi: 4, ei: 4, interests: ['Fitness', 'Technology', 'Sports', 'Travel', 'Coffee'],
    subscription: { type: 'gold', startDate: daysAgo(10), endDate: new Date(Date.now() + 20 * 86_400_000) },
    boost: { active: true, expiresAt: new Date(Date.now() + 20 * 60_000) },
    latOff: -0.025, lngOff: -0.03,
  },
  /* 10 Mia — matches test user; 3 UNREAD messages */
  {
    phone: '+11234567011', email: 'mia@demo.com', password: DEMO_PASSWORD,
    firstName: 'Mia', lastName: 'White', birthday: new Date('1997-04-22'), gender: 'female',
    bio: 'Nurse 👩‍⚕️ | Plant mom 🌱 | Love a good brunch spot | Kindness matters ❤️',
    jobTitle: 'Registered Nurse', company: 'City Hospital', school: 'Penn State',
    height: 160, pronouns: 'she/her', relationshipGoal: 'long_term',
    lifestyle: { drinking: 'socially', smoking: 'never', exercise: 'sometimes', diet: 'vegetarian', children: 'want', education: 'college', zodiac: 'taurus' },
    prompts: [
      { question: "I'm looking for…", answer: 'Someone to bring home to my plants. They need a dad.' },
      { question: 'My love language is…', answer: "Sharing food. If I offer you my dessert, it's serious." },
    ],
    g: 'f', pi: 5, ei: 5, interests: ['Travel', 'Cooking', 'Yoga', 'Reading', 'Nature'],
    subscription: { type: 'free' }, latOff: 0.015, lngOff: -0.005,
  },
  /* 11 Daniel — discoverable, no match */
  {
    phone: '+11234567012', email: 'daniel@demo.com', password: DEMO_PASSWORD,
    firstName: 'Daniel', lastName: 'Harris', birthday: new Date('1991-10-15'), gender: 'male',
    bio: 'Architect 🏛️ | Coffee snob | Jazz enthusiast 🎷 | Looking for deep connections',
    jobTitle: 'Architect', company: 'Design Studio', school: 'Columbia',
    height: 177, pronouns: 'he/him', relationshipGoal: 'long_term',
    lifestyle: { drinking: 'socially', smoking: 'never', exercise: 'sometimes', diet: 'omnivore', children: 'want', education: 'postgrad', zodiac: 'libra' },
    prompts: [
      { question: 'I geek out on…', answer: 'Brutalist architecture. I will stop to photograph buildings mid-conversation.' },
    ],
    g: 'm', pi: 5, ei: 5, interests: ['Art', 'Coffee', 'Music', 'Reading', 'Travel'],
    subscription: { type: 'free' }, latOff: -0.005, lngOff: 0.035,
  },
  /* 12 Charlotte — test user SUPERLIKED her → match */
  {
    phone: '+11234567013', email: 'charlotte@demo.com', password: DEMO_PASSWORD,
    firstName: 'Charlotte', lastName: 'Clark', birthday: new Date('1996-08-05'), gender: 'female',
    bio: 'Teacher 📚 | Bookworm | Sunday farmers market regular | Old soul in a young body',
    jobTitle: 'Elementary Teacher', company: 'Public School', school: 'Boston University',
    height: 167, pronouns: 'she/her', relationshipGoal: 'long_term',
    lifestyle: { drinking: 'socially', smoking: 'never', exercise: 'sometimes', diet: 'omnivore', children: 'want', education: 'college', zodiac: 'leo' },
    prompts: [
      { question: "Best chat opener I've received…", answer: "Tell me something a stranger would never guess about you." },
      { question: "I'm lowkey obsessed with…", answer: 'Finding the perfect used bookshop in every city I visit.' },
    ],
    g: 'f', pi: 6, ei: 6, interests: ['Reading', 'Travel', 'Cooking', 'Art', 'Nature'],
    subscription: { type: 'free' }, latOff: -0.02, lngOff: -0.04,
  },
  /* 13 Matthew — discoverable, no match */
  {
    phone: '+11234567014', email: 'matthew@demo.com', password: DEMO_PASSWORD,
    firstName: 'Matthew', lastName: 'Lewis', birthday: new Date('1994-03-27'), gender: 'male',
    bio: 'Financial analyst 📊 | Marathon runner 🏃 | Secretly a great cook',
    jobTitle: 'Financial Analyst', company: 'Investment Bank', school: 'Wharton',
    height: 179, pronouns: 'he/him', relationshipGoal: 'long_term',
    lifestyle: { drinking: 'socially', smoking: 'never', exercise: 'daily', diet: 'omnivore', children: 'open', education: 'postgrad', zodiac: 'aries' },
    prompts: [
      { question: 'My hidden talent…', answer: 'Making restaurant-quality pasta from scratch in under 20 minutes.' },
    ],
    g: 'm', pi: 6, ei: 6, interests: ['Sports', 'Fitness', 'Cooking', 'Travel', 'Movies'],
    subscription: { type: 'free' }, latOff: 0.04, lngOff: 0.01,
  },
  /* 14 Amelia — discoverable, no match */
  {
    phone: '+11234567015', email: 'amelia@demo.com', password: DEMO_PASSWORD,
    firstName: 'Amelia', lastName: 'Robinson', birthday: new Date('1999-11-11'), gender: 'female',
    bio: 'Graphic designer 🎨 | Vinyl collector 🎵 | Looking for concert buddies',
    jobTitle: 'Graphic Designer', company: 'Creative Agency', school: 'SCAD',
    height: 164, pronouns: 'she/her', relationshipGoal: 'casual',
    lifestyle: { drinking: 'socially', smoking: 'socially', exercise: 'sometimes', diet: 'vegetarian', children: 'dont_want', education: 'college', zodiac: 'scorpio' },
    prompts: [
      { question: 'Hot take…', answer: 'Vinyl sounds better at house parties than at hipster bars.' },
      { question: 'I want someone who…', answer: 'Will do a blind cooking challenge with me on a rainy Sunday.' },
    ],
    g: 'f', pi: 7, ei: 7, interests: ['Art', 'Music', 'Fashion', 'Photography', 'Dancing'],
    subscription: { type: 'free' }, latOff: -0.035, lngOff: 0.015,
  },
  /* 15 TEST USER */
  {
    phone: '+11111111111', email: 'test@demo.com', password: DEMO_PASSWORD,
    firstName: 'Alex', lastName: 'Demo', birthday: new Date('1996-06-15'), gender: 'male',
    bio: 'Full-stack dev exploring Tender 🧪 | Coffee enthusiast ☕ | Mountains + code',
    jobTitle: 'Software Developer', company: 'Demo Corp', school: 'Test University',
    height: 175, pronouns: 'he/him', relationshipGoal: 'long_term',
    lifestyle: { drinking: 'socially', smoking: 'never', exercise: 'often', diet: 'omnivore', children: 'open', education: 'college', zodiac: 'gemini' },
    prompts: [
      { question: "I'm looking for…", answer: 'Someone to grab coffee with and debug the world together.' },
      { question: 'Unusual skill I have…', answer: 'I can identify programming languages purely from syntax highlighting.' },
      { question: 'My simple pleasures are…', answer: 'Clean code, strong espresso, and sunrise hikes.' },
    ],
    g: 'm', pi: 7, ei: 7, interests: ['Technology', 'Coffee', 'Travel', 'Hiking', 'Photography', 'Music'],
    subscription: { type: 'gold', startDate: daysAgo(5), endDate: new Date(Date.now() + 25 * 86_400_000) },
    preferences: { ageMin: 18, ageMax: 45, distanceMax: 100, gender: 'everyone', global: true },
    isTestUser: true, latOff: 0, lngOff: 0,
  },
];

// ─── Main seed function ───────────────────────────────────────────────────────
async function seed() {
  console.log('🔌 Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected\n');

  // ── 1. Clear all collections ───────────────────────────────────────────────
  console.log('Clearing all collections…');
  await Promise.all([
    User.deleteMany({}),
    Swipe.deleteMany({}),
    Match.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({}),
    Report.deleteMany({}),
  ]);
  console.log('Collections cleared\n');

  // ── 2. Create users ────────────────────────────────────────────────────────
  console.log('Creating users…');
  const created = [];
  for (let i = 0; i < USER_DEFS.length; i++) {
    const d = USER_DEFS[i];
    const g = d.g;
    const photos = [
      { url: PH[g][d.pi],          publicId: `seed_${i}_0`, order: 0, isMain: true  },
      { url: PH[`e${g}`][d.ei],    publicId: `seed_${i}_1`, order: 1, isMain: false },
      { url: PH[g][(d.pi + 1) % PH[g].length], publicId: `seed_${i}_2`, order: 2, isMain: false },
    ];
    const user = new User({
      phone: d.phone, email: d.email, password: d.password,
      firstName: d.firstName, lastName: d.lastName, birthday: d.birthday, gender: d.gender,
      bio: d.bio, jobTitle: d.jobTitle, company: d.company || '', school: d.school,
      height: d.height, pronouns: d.pronouns, relationshipGoal: d.relationshipGoal,
      lifestyle: d.lifestyle, prompts: d.prompts, photos,
      location: loc(d.latOff, d.lngOff),
      preferences: d.preferences || { ageMin: 18, ageMax: 50, distanceMax: 100, gender: 'everyone', global: false },
      interests: d.interests || [],
      verified: true, emailVerified: true, active: true, showMe: true, phoneVerified: true,
      subscription: d.subscription,
      boost: d.boost || { active: false },
      isOnline: d.isTestUser === true,
      lastActive: d.isTestUser ? new Date() : new Date(Date.now() - Math.floor(Math.random() * 4 * 3_600_000)),
      notificationSettings: { newMatches: true, messages: true },
    });
    await user.save();
    created.push(user);
    console.log(`  ${user.firstName} ${user.lastName} (${user.email})`);
  }

  // Aliases
  const T  = created[15]; // TEST USER
  const Em = created[0];  // Emma
  const Ja = created[1];  // James
  const So = created[2];  // Sophia
  const Mi = created[3];  // Michael
  const Ol = created[4];  // Olivia
  const Wi = created[5];  // William
  const Al = created[7];  // Alexander
  const Et = created[9];  // Ethan
  const Ma = created[10]; // Mia
  const Ch = created[12]; // Charlotte

  // ── 3. Block Ethan ────────────────────────────────────────────────────────
  await User.findByIdAndUpdate(T._id, { $addToSet: { blockedUsers: Et._id } });
  console.log('\nBlocked Ethan for test user');

  // ── 4. Swipes ─────────────────────────────────────────────────────────────
  console.log('Creating swipes…');
  await Swipe.collection.insertMany([
    // Test user outgoing swipes
    { _id: oid(), swiper: T._id,  swiped: Em._id, action: 'like',      matched: true,  createdAt: daysAgo(8),  updatedAt: daysAgo(8)  },
    { _id: oid(), swiper: T._id,  swiped: So._id, action: 'like',      matched: true,  createdAt: daysAgo(6),  updatedAt: daysAgo(6)  },
    { _id: oid(), swiper: T._id,  swiped: Ol._id, action: 'like',      matched: true,  createdAt: daysAgo(3),  updatedAt: daysAgo(3)  },
    { _id: oid(), swiper: T._id,  swiped: Ma._id, action: 'like',      matched: true,  createdAt: daysAgo(5),  updatedAt: daysAgo(5)  },
    { _id: oid(), swiper: T._id,  swiped: Ch._id, action: 'superlike', matched: true,  createdAt: daysAgo(2),  updatedAt: daysAgo(2)  },
    { _id: oid(), swiper: T._id,  swiped: Al._id, action: 'like',      matched: true,  createdAt: daysAgo(7),  updatedAt: daysAgo(7)  },
    { _id: oid(), swiper: T._id,  swiped: Mi._id, action: 'nope',      matched: false, createdAt: daysAgo(4),  updatedAt: daysAgo(4)  },
    { _id: oid(), swiper: T._id,  swiped: Wi._id, action: 'nope',      matched: false, createdAt: daysAgo(3),  updatedAt: daysAgo(3)  },
    // Incoming mutual swipes (all → matched)
    { _id: oid(), swiper: Em._id, swiped: T._id,  action: 'like',      matched: true,  createdAt: daysAgo(8),  updatedAt: daysAgo(8)  },
    { _id: oid(), swiper: So._id, swiped: T._id,  action: 'like',      matched: true,  createdAt: daysAgo(6),  updatedAt: daysAgo(6)  },
    { _id: oid(), swiper: Ol._id, swiped: T._id,  action: 'like',      matched: true,  createdAt: daysAgo(3),  updatedAt: daysAgo(3)  },
    { _id: oid(), swiper: Ma._id, swiped: T._id,  action: 'like',      matched: true,  createdAt: daysAgo(5),  updatedAt: daysAgo(5)  },
    { _id: oid(), swiper: Ch._id, swiped: T._id,  action: 'like',      matched: true,  createdAt: daysAgo(2),  updatedAt: daysAgo(2)  },
    { _id: oid(), swiper: Al._id, swiped: T._id,  action: 'superlike', matched: true,  createdAt: daysAgo(7),  updatedAt: daysAgo(7)  },
    // Pending likes — test user has NOT swiped back yet
    { _id: oid(), swiper: Ja._id, swiped: T._id,  action: 'like',      matched: false, createdAt: hoursAgo(8), updatedAt: hoursAgo(8) },
    { _id: oid(), swiper: Mi._id, swiped: T._id,  action: 'like',      matched: false, createdAt: daysAgo(1),  updatedAt: daysAgo(1)  },
    { _id: oid(), swiper: Wi._id, swiped: T._id,  action: 'like',      matched: false, createdAt: daysAgo(4),  updatedAt: daysAgo(4)  },
  ]);
  console.log('  17 swipes created');

  // ── 5. Matches ────────────────────────────────────────────────────────────
  console.log('Creating matches…');
  const mIdEmma      = oid();
  const mIdSophia    = oid();
  const mIdOlivia    = oid();
  const mIdMia       = oid();
  const mIdCharlotte = oid();
  const mIdAlex      = oid();
  await Match.collection.insertMany([
    { _id: mIdEmma,      users: [T._id, Em._id], matchedAt: daysAgo(7), isSuperLike: false, unmatched: false, createdAt: daysAgo(7), updatedAt: daysAgo(7) },
    { _id: mIdSophia,    users: [T._id, So._id], matchedAt: daysAgo(5), isSuperLike: false, unmatched: false, createdAt: daysAgo(5), updatedAt: daysAgo(5) },
    { _id: mIdOlivia,    users: [T._id, Ol._id], matchedAt: daysAgo(2), isSuperLike: false, unmatched: false, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
    { _id: mIdMia,       users: [T._id, Ma._id], matchedAt: daysAgo(4), isSuperLike: false, unmatched: false, createdAt: daysAgo(4), updatedAt: daysAgo(4) },
    { _id: mIdCharlotte, users: [T._id, Ch._id], matchedAt: daysAgo(1), isSuperLike: true,  unmatched: false, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { _id: mIdAlex,      users: [T._id, Al._id], matchedAt: daysAgo(6), isSuperLike: true,  unmatched: false, createdAt: daysAgo(6), updatedAt: daysAgo(6) },
  ]);
  console.log('  6 matches created');

  // ── 6. Messages ───────────────────────────────────────────────────────────
  console.log('Creating messages…');
  const now = new Date();
  const mkMsg = (matchId, sender, receiver, content, type, opts = {}) => ({
    _id: oid(), match: matchId, sender: sender._id, receiver: receiver._id,
    content, type: type || 'text',
    mediaUrl: opts.mediaUrl || undefined,
    read: opts.read !== undefined ? opts.read : true,
    readAt: opts.read !== false ? (opts.at || now) : undefined,
    liked: opts.liked || false,
    likedAt: opts.liked ? (opts.at || now) : undefined,
    deleted: false,
    createdAt: opts.at || now,
    updatedAt: opts.at || now,
  });

  // Emma ↔ Test: text → image → gif conversation
  const emmaThread = [
    mkMsg(mIdEmma, Em, T,  'Hey! I saw you like hiking too 🏔️',                              'text',  { at: hoursAgo(48) }),
    mkMsg(mIdEmma, T,  Em, "Yes! I try to go every weekend. What's your favourite trail?",  'text',  { at: hoursAgo(47) }),
    mkMsg(mIdEmma, Em, T,  'Rajmachi fort — the views are absolutely insane!',               'text',  { at: hoursAgo(46) }),
    mkMsg(mIdEmma, T,  Em, "I've been wanting to do that one. Maybe we could go together?", 'text',  { at: hoursAgo(45) }),
    mkMsg(mIdEmma, Em, T,  "I'd love that! Here's a photo from my last trip there 👇",      'text',  { at: hoursAgo(44) }),
    mkMsg(mIdEmma, Em, T,  '[Photo]', 'image', { mediaUrl: PH.chatImg, at: hoursAgo(44) }),
    mkMsg(mIdEmma, T,  Em, 'That view is 🔥🔥🔥',                                             'text',  { at: hoursAgo(43) }),
    mkMsg(mIdEmma, T,  Em, '[GIF]',   'gif',   { mediaUrl: PH.gif, at: hoursAgo(43) }),
    mkMsg(mIdEmma, Em, T,  'Haha perfect reaction 😂 When are you free?',                   'text',  { at: hoursAgo(2), liked: true }),
    mkMsg(mIdEmma, T,  Em, 'This weekend works! Saturday morning?',                         'text',  { at: minsAgo(30) }),
  ];

  // Sophia ↔ Test: short text + AUDIO voice message
  const sophiaThread = [
    mkMsg(mIdSophia, T,  So, 'Hey Sophia! I love that you are a yoga instructor 🧘‍♀️',    'text',  { at: hoursAgo(72) }),
    mkMsg(mIdSophia, So, T,  'Thank you! Do you practice yoga?',                             'text',  { at: hoursAgo(71) }),
    mkMsg(mIdSophia, T,  So, 'A little! Mostly I stretch before hikes 😅',                  'text',  { at: hoursAgo(70) }),
    mkMsg(mIdSophia, So, T,  'Ha! That counts 😄 I sent you a voice note below',             'text',  { at: hoursAgo(69) }),
    mkMsg(mIdSophia, So, T,  '[Voice message — 0:08]', 'audio', { mediaUrl: PH.voiceUrl, at: hoursAgo(69) }),
    mkMsg(mIdSophia, T,  So, 'Omg your voice is so calming 😂 Love it',                     'text',  { at: hoursAgo(10) }),
  ];

  // Olivia: NO messages (new match state)

  // Mia: 3 UNREAD messages from Mia
  const miaThread = [
    mkMsg(mIdMia, Ma, T, "Hey Alex! We matched 🎉 How's your day?",                                   'text', { at: hoursAgo(3),   read: false }),
    mkMsg(mIdMia, Ma, T, "I saw you're a developer — I've always been curious about tech 🤓",          'text', { at: hoursAgo(2.5), read: false }),
    mkMsg(mIdMia, Ma, T, 'Also your hiking photo is absolutely adorable 🏔️😊',                        'text', { at: minsAgo(45),   read: false }),
  ];

  // Charlotte ↔ Test: superlike opener + reply
  const charlotteThread = [
    mkMsg(mIdCharlotte, T,  Ch, '⭐ Used a superlike — your book taste looked incredible! What are you reading right now?', 'text', { at: hoursAgo(20) }),
    mkMsg(mIdCharlotte, Ch, T,  '"Tomorrow, and Tomorrow, and Tomorrow" — it is devs falling in love, so I think you would get it 😂', 'text', { at: hoursAgo(18) }),
  ];

  // Alexander ↔ Test: incoming superlike + exchange
  const alexThread = [
    mkMsg(mIdAlex, Al, T,  'You had me at "debugging the world" 😂 Challenge you to Catan?',  'text', { at: hoursAgo(36) }),
    mkMsg(mIdAlex, T,  Al, 'I accept! Settlers is my weakness 🎲 Do you play competitively?', 'text', { at: hoursAgo(35) }),
    mkMsg(mIdAlex, Al, T,  "Only aggressively! Drop a location and we'll set it up.",          'text', { at: hoursAgo(34) }),
  ];

  const allMessages = [...emmaThread, ...sophiaThread, ...miaThread, ...charlotteThread, ...alexThread];
  await Message.collection.insertMany(allMessages);
  console.log(`  ${allMessages.length} messages (text / image / gif / audio — read / unread / liked)`);

  // Update lastMessage on each match
  const lastOf = (arr) => arr[arr.length - 1];
  await Promise.all([
    Match.collection.updateOne({ _id: mIdEmma },      { $set: { lastMessage: lastOf(emmaThread)._id,      lastMessageAt: lastOf(emmaThread).createdAt,      updatedAt: lastOf(emmaThread).createdAt      } }),
    Match.collection.updateOne({ _id: mIdSophia },    { $set: { lastMessage: lastOf(sophiaThread)._id,    lastMessageAt: lastOf(sophiaThread).createdAt,    updatedAt: lastOf(sophiaThread).createdAt    } }),
    Match.collection.updateOne({ _id: mIdMia },       { $set: { lastMessage: lastOf(miaThread)._id,       lastMessageAt: lastOf(miaThread).createdAt,       updatedAt: lastOf(miaThread).createdAt       } }),
    Match.collection.updateOne({ _id: mIdCharlotte }, { $set: { lastMessage: lastOf(charlotteThread)._id, lastMessageAt: lastOf(charlotteThread).createdAt, updatedAt: lastOf(charlotteThread).createdAt } }),
    Match.collection.updateOne({ _id: mIdAlex },      { $set: { lastMessage: lastOf(alexThread)._id,      lastMessageAt: lastOf(alexThread).createdAt,      updatedAt: lastOf(alexThread).createdAt      } }),
  ]);

  // ── 7. Notifications (one of every type, for test user) ───────────────────
  console.log('Creating notifications…');
  await Notification.collection.insertMany([
    // new_match (x5)
    { _id: oid(), user: T._id, type: 'new_match', read: true,  readAt: daysAgo(7),  title: 'New Match! 🎉',                    body: 'You and Emma matched! Say hello.',                          data: { type: 'new_match', matchId: mIdEmma.toString()      }, createdAt: daysAgo(7),  updatedAt: daysAgo(7)  },
    { _id: oid(), user: T._id, type: 'new_match', read: true,  readAt: daysAgo(5),  title: 'New Match! 🎉',                    body: 'You and Sophia matched! Break the ice.',                    data: { type: 'new_match', matchId: mIdSophia.toString()    }, createdAt: daysAgo(5),  updatedAt: daysAgo(5)  },
    { _id: oid(), user: T._id, type: 'new_match', read: false, readAt: undefined,   title: 'New Match! 🎉',                    body: "You and Olivia matched! She's waiting for your first message.", data: { type: 'new_match', matchId: mIdOlivia.toString()    }, createdAt: daysAgo(2),  updatedAt: daysAgo(2)  },
    { _id: oid(), user: T._id, type: 'new_match', read: true,  readAt: daysAgo(4),  title: 'New Match! 🎉',                    body: 'You and Mia matched! Time to say hello.',                   data: { type: 'new_match', matchId: mIdMia.toString()       }, createdAt: daysAgo(4),  updatedAt: daysAgo(4)  },
    { _id: oid(), user: T._id, type: 'new_match', read: false, readAt: undefined,   title: 'New Match! 🎉',                    body: 'You and Charlotte matched! She loved your superlike.',      data: { type: 'new_match', matchId: mIdCharlotte.toString() }, createdAt: daysAgo(1),  updatedAt: daysAgo(1)  },
    // super_like — Alexander
    { _id: oid(), user: T._id, type: 'super_like',            read: false, readAt: undefined,   title: 'Someone Super Liked you! ⭐',       body: 'Alexander sent you a Super Like!',                          data: { type: 'super_like',   userId: Al._id.toString() }, createdAt: daysAgo(7),  updatedAt: daysAgo(7)  },
    // profile_like — James
    { _id: oid(), user: T._id, type: 'profile_like',          read: false, readAt: undefined,   title: 'Someone liked your profile! 💛',    body: 'You have a new admirer. Like them back?',                   data: { type: 'profile_like', userId: Ja._id.toString() }, createdAt: hoursAgo(8), updatedAt: hoursAgo(8) },
    // new_message — Mia (unread)
    { _id: oid(), user: T._id, type: 'new_message',           read: false, readAt: undefined,   title: 'New message from Mia 💬',           body: "Hey Alex! We matched 🎉 How's your day?",                    data: { type: 'new_message', matchId: mIdMia.toString(), senderId: Ma._id.toString() }, createdAt: hoursAgo(3),  updatedAt: hoursAgo(3)  },
    { _id: oid(), user: T._id, type: 'new_message',           read: false, readAt: undefined,   title: 'New message from Mia 💬',           body: 'Your hiking photo is absolutely adorable 🏔️😊',             data: { type: 'new_message', matchId: mIdMia.toString(), senderId: Ma._id.toString() }, createdAt: minsAgo(45), updatedAt: minsAgo(45) },
    // message_liked — Emma liked a message
    { _id: oid(), user: T._id, type: 'message_liked',         read: true,  readAt: hoursAgo(1), title: 'Emma liked your message ❤️',         body: '"This weekend works! Saturday morning?" was liked.',        data: { type: 'message_liked', matchId: mIdEmma.toString() },  createdAt: hoursAgo(2),  updatedAt: hoursAgo(2)  },
    // boost_started
    { _id: oid(), user: T._id, type: 'boost_started',         read: true,  readAt: daysAgo(3),  title: 'Your Boost is active! 🚀',           body: "You're being shown to 10x more people right now!",          data: { type: 'boost' },                                         createdAt: daysAgo(3),   updatedAt: daysAgo(3)   },
    // subscription_activated
    { _id: oid(), user: T._id, type: 'subscription_activated',read: true,  readAt: daysAgo(5),  title: 'Gold Subscription Activated 🌟',    body: 'Welcome to Tender Gold! Enjoy unlimited likes.',            data: { type: 'subscription' },                                  createdAt: daysAgo(5),   updatedAt: daysAgo(5)   },
    // subscription_expiring
    { _id: oid(), user: T._id, type: 'subscription_expiring', read: false, readAt: undefined,   title: 'Subscription expiring soon ⚠️',     body: 'Your Gold plan expires in 25 days. Tap to renew.',          data: { type: 'subscription_expiring' },                         createdAt: hoursAgo(1),  updatedAt: hoursAgo(1)  },
  ]);
  console.log('  13 notifications (all 8 types — mix of read/unread)');

  // ── 8. Reports ────────────────────────────────────────────────────────────
  console.log('Creating reports…');
  await Report.collection.insertMany([
    { _id: oid(), reporter: T._id,  reported: Al._id, reason: 'harassment',          description: 'Sent repeated unsolicited messages after I asked to stop.',              matchId: mIdAlex, status: 'pending',  createdAt: daysAgo(2),  updatedAt: daysAgo(2)  },
    { _id: oid(), reporter: Ja._id, reported: Wi._id, reason: 'fake_profile',         description: 'Profile photos appear to be stock images, details inconsistent.',        status: 'reviewed', createdAt: daysAgo(10), updatedAt: daysAgo(8)  },
    { _id: oid(), reporter: Mi._id, reported: So._id, reason: 'spam',                 description: 'Kept sending the same promotional link repeatedly.',                       status: 'resolved', adminNotes: 'Warning issued. Second offence will result in a ban.', createdAt: daysAgo(15), updatedAt: daysAgo(13) },
    { _id: oid(), reporter: Ol._id, reported: Et._id, reason: 'inappropriate_content', description: 'Sent an inappropriate image without consent.',                            status: 'dismissed', adminNotes: 'Unable to verify claim based on available evidence.',  createdAt: daysAgo(20), updatedAt: daysAgo(18) },
  ]);
  console.log('  4 reports (pending / reviewed / resolved / dismissed)');

  // ── Summary ───────────────────────────────────────────────────────────────
  const line = '═'.repeat(52);
  console.log(`\n${line}`);
  console.log('Seed complete!\n');
  console.log('TEST ACCOUNT');
  console.log('  Email    : test@demo.com');
  console.log('  Password : demo1234');
  console.log('  Phone    : +11111111111\n');
  console.log('SEEDED DATA');
  console.log('  Users         : 16 (height / pronouns / lifestyle / prompts / relationship goal)');
  console.log('  Matches       : 6');
  console.log('    Emma        — text + image + gif (liked message)');
  console.log('    Sophia      — audio voice message');
  console.log('    Olivia      — new match, 0 messages');
  console.log('    Mia         — 3 UNREAD messages');
  console.log('    Charlotte   — matched via outgoing superlike');
  console.log('    Alexander   — matched via incoming superlike');
  console.log('  Swipes        : 17 (like / nope / superlike)');
  console.log('  Pending likes : James, Michael, William');
  console.log('                  (visible in Gold/Platinum)');
  console.log('  Notifications : 13 (all 8 types, mixed read/unread)');
  console.log('  Blocked user  : Ethan');
  console.log('  Active boost  : Ethan (expires in 20 min)');
  console.log('  Reports       : 4 (pending/reviewed/resolved/dismissed)');
  console.log('  Subscriptions : Gold  — James, Ava, Ethan, Test');
  console.log('                  Plat. — Olivia, Alexander');
  console.log(`\n${line}`);
  console.log('All demo user passwords: demo1234');
}

seed()
  .catch((err) => { console.error('Seed error:', err); process.exit(1); })
  .finally(() => mongoose.disconnect().then(() => process.exit(0)));

