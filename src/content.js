// All site copy and numbers live here. Prices: QuiCut Final Pricing Model v2.0 (June 2026).
// Market data: Kofluence 2025, BCG Dec 2025, DataReportal 2025.

export const TIERS = [
  {
    id: 'reel',
    name: 'Reel / Short',
    price: 299,
    for: 'Instagram Reels, YouTube Shorts, X videos',
    output: 'Up to 90 sec',
    raw: '5–15 min raw',
    delivery: 'Same day',
    deliveryHours: 12,
    market: '₹1,000–₹2,000',
  },
  {
    id: 'vlog',
    name: 'Standard Vlog',
    price: 499,
    for: 'YouTube vlogs, lifestyle, travel diaries',
    output: '5–12 min',
    raw: 'Up to 30 min raw',
    delivery: '24 hours',
    deliveryHours: 24,
    market: '₹1,500–₹3,500',
    popular: true,
  },
  {
    id: 'gaming',
    name: 'Gaming Montage',
    price: 799,
    for: 'BGMI, GTA, esports highlights, commentary',
    output: '3–8 min',
    raw: 'Up to 25 min raw',
    delivery: '24 hours',
    deliveryHours: 24,
    market: '₹1,500–₹3,000',
  },
  {
    id: 'cinematic',
    name: 'Premium Cinematic',
    price: 1199,
    for: 'Branded content, travel films, mini-docs',
    output: '8–20 min',
    raw: 'Up to 45 min raw',
    delivery: '48 hours',
    deliveryHours: 48,
    market: '₹3,000–₹8,000',
  },
  {
    id: 'wedding',
    name: 'Wedding / Event',
    price: 2499,
    for: 'Wedding reels, engagements, receptions, events',
    output: '5–15 min',
    raw: 'Up to 90 min raw',
    delivery: '3 days',
    deliveryHours: 72,
    market: '₹5,000–₹15,000',
  },
]

export const ADDONS = [
  { id: 'express', name: 'Express delivery', note: '12-hour turnaround', price: 199 },
  { id: 'captions', name: 'Subtitles / captions', note: 'Telugu, Hindi or English', price: 99 },
  { id: 'thumb', name: 'Thumbnail design', note: 'YouTube-spec export', price: 199 },
  { id: 'motion', name: 'Motion graphics pack', note: 'Intro, outro, lower thirds', price: 349 },
  { id: 'revision', name: 'Extra revision', note: 'On top of the free one', price: 149 },
  { id: 'raw', name: 'Raw project files', note: 'Download the edit project', price: 49 },
]

export const EDITOR_SHARE = 0.8

export const STEPS = [
  {
    title: 'Pick your cut',
    body: 'Reel, vlog, gaming montage, cinematic or wedding. Fixed price, shown upfront.',
    meta: 'Priced in QC',
  },
  {
    title: 'Upload and brief',
    body: 'Drop MP4, MOV or MKV up to 5 GB. Write the brief the way you talk, in Telugu, Hindi or English.',
    meta: 'Any language',
  },
  {
    title: 'A verified editor cuts it',
    body: 'Your order goes to an editor who specialises in your content type. Track it: Paid, Assigned, Editing, Review, Delivered.',
    meta: 'NDA on every file',
  },
  {
    title: 'Download, revise, rate',
    body: 'Get your edit in 24 hours for most tiers. One revision is free. Rate the editor so the best ones rise.',
    meta: '1 free revision',
  },
]

export const STATS = [
  { value: '4.5M', label: 'creators across platforms in India', src: 'Kofluence 2025' },
  { value: '92%', label: 'of Indian creators make short-form video', src: 'Kofluence 2025' },
  { value: '413M', label: 'Instagram Reels users in India, the most of any country', src: 'Sendshort 2025' },
  { value: '88%', label: 'of creators cannot yet earn a full living from content', src: 'Kofluence 2025' },
]

export const LANGS = [
  { script: 'తెలుగు', name: 'Telugu', when: 'At launch' },
  { script: 'हिन्दी', name: 'Hindi', when: 'Next' },
  { script: 'தமிழ்', name: 'Tamil', when: 'Coming' },
  { script: 'English', name: 'English', when: 'Coming' },
  { script: 'ಕನ್ನಡ', name: 'Kannada', when: 'Coming' },
]

export const SAMPLE_BRIEF =
  'Telugu lo edit cheyyandi. Araku lo travel vlog, warm colour grade, Telugu background music, city arrive cheste energetic cuts, forest part lo slow motion, location ki text overlays Telugu lo peyyandi.'

// Keyword map used by the on-page brief reader demo.
export const BRIEF_RULES = [
  { tag: 'Warm grade', icon: '◐', words: ['warm', 'golden', 'vecha', 'garam'] },
  { tag: 'Cool grade', icon: '◑', words: ['cool', 'blue', 'teal', 'thanda'] },
  { tag: 'Cinematic look', icon: '▭', words: ['cinematic', 'film', 'movie'] },
  { tag: 'Fast cuts', icon: '⚡', words: ['energetic', 'fast', 'quick', 'beat', 'speed', 'jaldi', 'tez'] },
  { tag: 'Slow motion', icon: '◌', words: ['slow motion', 'slow mo', 'slowmo', 'slow-mo'] },
  { tag: 'Telugu music', icon: '♪', words: ['telugu background music', 'telugu music', 'telugu bgm', 'telugu song'] },
  { tag: 'Hindi music', icon: '♪', words: ['hindi music', 'bollywood', 'hindi song', 'hindi bgm'] },
  { tag: 'Background music', icon: '♪', words: ['music', 'bgm', 'song', 'lofi', 'lo-fi'] },
  { tag: 'Text overlays', icon: 'T', words: ['text', 'overlay', 'title', 'location'] },
  { tag: 'Captions', icon: '≡', words: ['caption', 'subtitle', 'subs'] },
  { tag: 'Remove silences', icon: '✂', words: ['silence', 'dead air', 'pauses', 'gaps'] },
  { tag: 'Vertical 9:16', icon: '▯', words: ['reel', 'short', 'vertical', '9:16'] },
  { tag: 'Travel vlog', icon: '✈', words: ['travel', 'trip', 'vlog'] },
  { tag: 'Gaming montage', icon: '◆', words: ['bgmi', 'gaming', 'montage', 'gta', 'pubg', 'free fire'] },
  { tag: 'Wedding', icon: '♥', words: ['wedding', 'pelli', 'shaadi', 'engagement'] },
]

export const FAQ = [
  {
    q: 'What footage can I send?',
    a: 'MP4, MOV or MKV, up to 5 GB per upload. Each tier lists how much raw footage it covers, from 15 minutes for a Reel to 90 minutes for a wedding.',
  },
  {
    q: 'Do I have to write the brief in English?',
    a: 'No. Write it in Telugu, Hindi, English or a mix. QuiCut turns your brief into a clear checklist for the editor: colour grade, pacing, music mood, text and captions.',
  },
  {
    q: 'What if I do not like the edit?',
    a: 'Every order includes one free revision. Tell the editor what to change in the order chat. More revisions cost extra QC, shown in the app before you confirm.',
  },
  {
    q: 'Who sees my footage?',
    a: 'Only the editor assigned to your order. Every editor signs an NDA, and files are shared through expiring download links.',
  },
  {
    q: 'When does the app launch?',
    a: 'QuiCut is coming to Android and iOS. Join the waitlist and we will message you when early access opens.',
  },
]
