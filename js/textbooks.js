const CUSTOM_BOOKS_KEY = 'fluentcam_ai_generated_books_v1';

const COVER_MAP = {
  zoo: 'assets/book_magic_zoo.jpg',
  cafe: 'assets/book_sunny_cafe.jpg',
  future: 'assets/book_future_school.jpg',
  london: 'assets/book_london_vlog.jpg',
};

/**
 * Helper to create a clean 4-page structured 20-minute lesson unit.
 */
function unit({
  id,
  unitNo,
  grade, // 'grade3' | 'grade6'
  gradeTag,
  levelRange,
  theme,
  title,
  titleKo,
  cover,
  description,
  vocab,
  readingTitle,
  readingParagraphs,
  menuItems,
  patterns,
  debatePros,
  debateCons,
  questions,
  missions,
  p1Guide,
  p2Guide,
  p3Guide,
  p4Guide,
  p2Heading,
  p3Heading,
  p4Heading,
  p2Step,
  p3Step,
  p4Step,
}) {
  const page1 = {
    step: 'Page 1 · Warm-up Words',
    heading: '오늘의 핵심 단어',
    image: cover,
    instructionKo: p1Guide || '단어를 소리 내어 읽어보고, 선생님의 질문에 완전한 영어 문장으로 대답해 보세요.',
    vocab,
    teacherNotes: `Warm up with the 5 key words. Have the student pronounce each word and use 1–2 words in a short original sentence. Keep your turns ultra-short (1–2 sentences).`,
  };

  const page2 = {
    step: p2Step || 'Page 2 · Story & Reading',
    heading: p2Heading || readingTitle || '함께 읽기',
    image: readingParagraphs ? cover : undefined,
    instructionKo: p2Guide || '선생님과 번갈아 가며 소리 내어 읽어 보세요.',
    readingTitle,
    readingParagraphs,
    menuItems,
    patterns,
    debatePros,
    debateCons,
    teacherNotes: `Guide the student through Page 2 actively—have them read aloud or interact with the board/cards. Praise clear intonation and nudge full sentences.`,
  };

  const page3 = {
    step: p3Step || 'Page 3 · Think & Speak',
    heading: p3Heading || '생각하고 영어로 말하기',
    instructionKo: p3Guide || '단답 대신 완전한 문장과 이유를 붙여 선생님께 말해 보세요!',
    questions,
    patterns: menuItems ? patterns : undefined,
    teacherNotes: `Ask these questions ONE at a time. Never accept 1-word answers—cheerfully model a starter and ask the child to say a full sentence!`,
  };

  const page4 = {
    step: p4Step || 'Page 4 · Speaking Mission',
    heading: p4Heading || '오늘의 말하기 미션!',
    instructionKo: p4Guide || '오늘 배운 단어를 써서 마지막 미션을 완성해 보세요!',
    missionCards: missions,
    teacherNotes: `Run this fun creative mission or roleplay so the student speaks 70% of the time. Award a Gold Star when they complete it in full sentences!`,
  };

  return {
    id,
    unitNo,
    grade,
    gradeTag,
    levelRange,
    category: theme,
    title,
    titleKo,
    cover,
    description,
    pages: [page1, page2, page3, page4],
  };
}

export const BUILTIN_TEXTBOOKS = [
  // =========================================================================
  // GRADE 3 CURRICULUM TRACK (12 Units — 48 Pages)
  // =========================================================================
  unit({
    id: 'g3-01-magic-zoo',
    unitNo: 1,
    grade: 'grade3',
    gradeTag: '초3 · Unit 1',
    levelRange: 'Lv.1–2',
    theme: '스토리텔링',
    title: 'A Day at the Magic Zoo',
    titleKo: '마법 동물원의 하루',
    cover: COVER_MAP.zoo,
    description: '하늘을 날고 싶은 꼬마 펭귄 Pip의 이야기를 읽고 나만의 마법 동물을 상상해 소개합니다.',
    vocab: [
      { word: 'curious', meaning: '호기심이 많은', example: 'Pip is a curious little penguin.' },
      { word: 'goggles', meaning: '고글 안경', example: 'He wears brown aviator goggles.' },
      { word: 'float', meaning: '둥둥 뜨다', example: 'Colorful balloons float in the sky.' },
      { word: 'reach', meaning: '손이 닿다', example: 'The giraffe can reach high leaves.' },
      { word: 'cheerful', meaning: '명랑한', example: 'Everyone at the zoo looks cheerful.' },
    ],
    readingTitle: 'Pip Wants to Fly',
    readingParagraphs: [
      'Pip was the smallest penguin at Sunny Zoo, but he had the biggest dream. Every morning, he put on his aviator goggles and watched the clouds.',
      '"Penguins can swim super fast, Pip, but we cannot fly," said Gerry the Giraffe while munching on green leaves.',
      'Suddenly, a bunch of bright balloons floated right past the fence! Pip smiled. "Maybe I just need a clever idea!"',
    ],
    questions: [
      'What was Pip’s biggest dream at Sunny Zoo?',
      'What did Gerry the Giraffe tell Pip?',
      'If Pip grabbed the balloons, where would he fly first?',
      'Which animal do you like best at the zoo, and why?',
    ],
    missions: [
      { label: '1. 모습 소개', detail: 'What does your magic animal look like? (size, color, wings)' },
      { label: '2. 초능력', detail: 'What superpower does it have?' },
      { label: '3. 좋아하는 음식', detail: 'What does it love to eat every day?' },
    ],
    p4Heading: '나만의 마법 동물 만들기',
  }),

  unit({
    id: 'g3-02-sunny-cafe',
    unitNo: 2,
    grade: 'grade3',
    gradeTag: '초3 · Unit 2',
    levelRange: 'Lv.1–2',
    theme: '역할극',
    title: "Let's Order at Sunny Cafe!",
    titleKo: '써니 카페에서 영어로 주문하기',
    cover: COVER_MAP.cafe,
    description: '실제 카페 메뉴판을 보고 정중하게 주문하고, 손님과 사장님 역할을 바꿔 실전 역할극을 합니다.',
    vocab: [
      { word: 'crispy', meaning: '바삭바삭한', example: 'The chocolate croissant is warm and crispy.' },
      { word: 'refreshing', meaning: '시원하고 상쾌한', example: 'A berry smoothie is so refreshing!' },
      { word: 'fluffy', meaning: '폭신폭신한', example: 'The blueberry muffin is soft and fluffy.' },
      { word: 'recommend', meaning: '추천하다', example: 'What snack do you recommend today?' },
      { word: 'to go', meaning: '포장해서', example: 'I would like a muffin to go, please.' },
    ],
    p2Step: 'Page 2 · Cafe Menu',
    p2Heading: 'Sunny Bakery & Cafe 메뉴판',
    p2Guide: '메뉴판에서 음료 1개와 간식 1개를 골라 영어로 읽어 보세요.',
    menuItems: [
      { name: 'Berry Blast Smoothie', price: '$5.50', desc: 'Fresh strawberries, blueberries & ice' },
      { name: 'Iced Choco Cloud', price: '$4.80', desc: 'Cold cocoa topped with whipped cream' },
      { name: 'Choco Croissant', price: '$4.20', desc: 'Warm flaky pastry with chocolate' },
      { name: 'Blueberry Muffin', price: '$3.80', desc: 'Soft & fluffy muffin baked today' },
      { name: 'Fruit Cream Sandwich', price: '$6.00', desc: 'Sweet cream with kiwi & strawberries' },
    ],
    p3Step: 'Page 3 · Polite Ordering',
    p3Heading: '정중하게 주문하는 질문 연습',
    patterns: [
      { en: 'Could I have a ___, please?', ko: '___ 하나 주시겠어요?' },
      { en: 'Can I get it without ___?', ko: '___는 빼고 주실 수 있나요?' },
      { en: 'What do you recommend?', ko: '어떤 메뉴를 추천해 주세요?' },
    ],
    questions: [
      'Which drink looks the most delicious to you, and why?',
      'Do you prefer eating at a cafe or taking snacks to go?',
      'What sweet treat do you like after school?',
    ],
    missions: [
      { label: 'Round 1 · 내가 손님', detail: 'Order 1 drink + 1 snack + 1 special request politely.' },
      { label: 'Round 2 · 내가 사장님', detail: 'Greet the tutor, recommend a menu item, and say the total price!' },
    ],
    p4Heading: '실전 카페 역할극 (2라운드)',
  }),

  unit({
    id: 'g3-03-show-and-tell',
    unitNo: 3,
    grade: 'grade3',
    gradeTag: '초3 · Unit 3',
    levelRange: 'Lv.1–2',
    theme: '웹캠 특화',
    title: 'Mystery Show & Tell',
    titleKo: '내 방 보물 웹캠 소개하기',
    cover: COVER_MAP.zoo,
    description: '책상이나 방에 있는 진짜 물건을 웹캠에 보여주며 묘사하고 3가지 힌트 스무고개를 진행합니다.',
    vocab: [
      { word: 'shiny', meaning: '반짝이는', example: 'My pencil case is silver and shiny.' },
      { word: 'cozy', meaning: '포근한', example: 'This plush bear feels soft and cozy.' },
      { word: 'lightweight', meaning: '가벼운', example: 'My water bottle is very lightweight.' },
      { word: 'useful', meaning: '유용한', example: 'It is useful when I study.' },
      { word: 'meaningful', meaning: '소중한', example: 'This keychain is meaningful to me.' },
    ],
    p2Step: 'Page 2 · 3-Step Formula',
    p2Heading: '물건 소개 3단계 공식',
    p2Guide: '방에서 물건 1개를 가져와 웹캠에 들며 3단계로 소개해 보세요!',
    patterns: [
      { en: 'Today, I want to show you my ___.', ko: '오늘 제가 보여드릴 건 ___예요.' },
      { en: 'I got it when / from ___.', ko: '___할 때 / ___에게서 받았어요.' },
      { en: 'My favorite thing about it is ___.', ko: '제일 마음에 드는 점은 ___예요.' },
    ],
    questions: [
      'What is your item made of, and how does it feel?',
      'How often do you use or play with it?',
      'If your item could talk, what would it say?',
    ],
    missions: [
      { label: 'Clue 1 · 색과 크기', detail: 'Hide an object and describe its color and size.' },
      { label: 'Clue 2 · 쓰임새', detail: 'Tell the tutor what you use it for.' },
      { label: 'Clue 3 · 첫 글자', detail: 'Give the starting letter and reveal it on camera!' },
    ],
    p4Heading: '웹캠 숨은 물건 맞히기 게임',
  }),

  unit({
    id: 'g3-04-secret-treehouse',
    unitNo: 4,
    grade: 'grade3',
    gradeTag: '초3 · Unit 4',
    levelRange: 'Lv.1–2',
    theme: '스토리텔링',
    title: 'The Secret Treehouse',
    titleKo: '비밀 나무 위의 아지트',
    cover: COVER_MAP.zoo,
    description: '숲속 나무 위 비밀 아지트를 꾸미고 친구를 초대하는 재미있는 상상 말하기 교재입니다.',
    vocab: [
      { word: 'climb', meaning: '기어오르다', example: 'We climb the wooden ladder together.' },
      { word: 'secret', meaning: '비밀의', example: 'Only best friends know the secret password.' },
      { word: 'lantern', meaning: '랜턴, 등불', example: 'A warm yellow lantern hangs by the window.' },
      { word: 'telescope', meaning: '망원경', example: 'We watch stars with a big telescope.' },
      { word: 'decorate', meaning: '꾸미다', example: 'Let’s decorate the walls with comic posters.' },
    ],
    readingTitle: 'Up in the Big Oak Tree',
    readingParagraphs: [
      'Behind Leo’s house stood the tallest oak tree in town. High in the branches sat a cozy wooden treehouse with a rope ladder.',
      'Inside, there were fluffy pillows, a box of board games, and a shiny telescope pointing at the sky.',
      '"Nobody can enter without our secret knock!" laughed Leo as his friend knocked three times and climbed up.',
    ],
    questions: [
      'What cool things were inside Leo’s treehouse?',
      'How do friends get inside the treehouse?',
      'If you had a secret treehouse, what 3 things would you put inside?',
      'Who would you invite first to your treehouse, and why?',
    ],
    missions: [
      { label: '1. 비밀 암호 정하기', detail: 'Invent a funny secret password or knock.' },
      { label: '2. 아지트 규칙 2가지', detail: 'Create 2 fun rules for your treehouse club.' },
      { label: '3. 화이트보드에 그리기', detail: 'Draw your treehouse with the pen tool and show your tutor!' },
    ],
    p4Heading: '나만의 비밀 아지트 설계하기',
  }),

  unit({
    id: 'g3-05-toy-shop',
    unitNo: 5,
    grade: 'grade3',
    gradeTag: '초3 · Unit 5',
    levelRange: 'Lv.1–2',
    theme: '역할극',
    title: 'Toy Shop Treasure Hunt',
    titleKo: '장난감 가게 쇼핑 대작전',
    cover: COVER_MAP.cafe,
    description: '20달러 용돈으로 친구 생일 선물을 고르고 가격을 묻는 실전 쇼핑 영어를 익힙니다.',
    vocab: [
      { word: 'allowance', meaning: '용돈', example: 'I saved twenty dollars from my allowance.' },
      { word: 'affordable', meaning: '가격이 알맞은', example: 'This puzzle is fun and affordable.' },
      { word: 'gift-wrap', meaning: '선물 포장하다', example: 'Could you gift-wrap this robot, please?' },
      { word: 'receipt', meaning: '영수증', example: 'Here is your change and receipt.' },
      { word: 'compare', meaning: '비교하다', example: 'Let’s compare the board game and the LEGO set.' },
    ],
    p2Step: 'Page 2 · Toy Shelf',
    p2Heading: 'Happy Toy World 가격표',
    p2Guide: '예산 $20 안에서 친구에게 줄 선물을 골라 보세요!',
    menuItems: [
      { name: 'Mini Space LEGO Set', price: '$14.00', desc: 'Build a rocket & astronaut' },
      { name: 'Glow-in-the-Dark Slime Kit', price: '$8.50', desc: 'Make 3 neon slime colors' },
      { name: 'Speedy RC Racing Car', price: '$18.00', desc: 'Fast remote-control mini car' },
      { name: 'Mystery Animal Blind Box', price: '$6.00', desc: 'Surprise cute figure inside' },
      { name: 'Junior Detective Board Game', price: '$12.00', desc: 'Fun puzzle game for 2–4 players' },
    ],
    questions: [
      'With $20, which toy or combination would you buy for your best friend?',
      'Which toy would you choose for yourself, and why?',
      'What is the best birthday gift you have ever received?',
    ],
    missions: [
      { label: 'Shopping Roleplay', detail: 'Ask the shopkeeper (Tutor) for a gift recommendation under $20, check the price, and ask for gift-wrapping!' },
      { label: 'Budget Challenge', detail: 'Explain how much change you have left after paying $20.' },
    ],
    p4Heading: '장난감 가게 쇼핑 역할극',
  }),

  unit({
    id: 'g3-06-dinosaur-park',
    unitNo: 6,
    grade: 'grade3',
    gradeTag: '초3 · Unit 6',
    levelRange: 'Lv.1–2',
    theme: '스토리텔링',
    title: 'Time-Travel Dinosaur Park',
    titleKo: '공룡 시대로 시간여행',
    cover: COVER_MAP.zoo,
    description: '타임머신을 타고 백악기 공룡 시대로 떠나 초식·육식 공룡을 비교하며 묘사합니다.',
    vocab: [
      { word: 'enormous', meaning: '거대한', example: 'The Brachiosaurus had an enormous neck.' },
      { word: 'footprint', meaning: '발자국', example: 'We found a giant footprint in the mud.' },
      { word: 'roar', meaning: '으르렁거리다', example: 'A loud roar echoed through the jungle.' },
      { word: 'herbivore', meaning: '초식 동물', example: 'Triceratops was a plant-eating herbivore.' },
      { word: 'fossil', meaning: '화석', example: 'Scientists study dinosaur fossils.' },
    ],
    readingTitle: 'Beep! Welcome to 70 Million Years Ago',
    readingParagraphs: [
      'Mia pressed the green button on her time watch. WHOOSH! Suddenly, her classroom vanished, and tall ferns surrounded her.',
      'A gentle Triceratops walked slowly across the river, while a baby Pterosaur swooped across the orange sky.',
      '"I have ten minutes before the portal closes," Mia whispered, taking out her sketchbook to draw them.',
    ],
    questions: [
      'Which dinosaur would you want to meet first—a flying one or a giant plant-eater?',
      'What would you pack in your backpack for a trip to dinosaur times?',
      'Would you be brave enough to take a photo near a T-Rex? Why or why not?',
    ],
    missions: [
      { label: '1. 공룡 비교하기', detail: 'Compare two dinosaurs using bigger, faster, or scarier.' },
      { label: '2. 탈출 이야기 만들기', detail: 'Tell a 3-sentence story about how you escaped back to today!' },
    ],
    p4Heading: '시간여행 탐험 일지 발표',
  }),

  unit({
    id: 'g3-07-animal-clinic',
    unitNo: 7,
    grade: 'grade3',
    gradeTag: '초3 · Unit 7',
    levelRange: 'Lv.1–2',
    theme: '역할극',
    title: "At the Animal Doctor's Clinic",
    titleKo: '동물병원 수의사 체험',
    cover: COVER_MAP.zoo,
    description: '아픈 강아지·고양이를 진찰하고 건강 조언을 해주는 수의사 역할극 교재입니다.',
    vocab: [
      { word: 'vet', meaning: '수의사', example: 'The kind vet checked the puppy’s ears.' },
      { word: 'fever', meaning: '열', example: 'Does the kitten have a fever?' },
      { word: 'bandage', meaning: '붕대', example: 'Let’s put a soft bandage on its paw.' },
      { word: 'gentle', meaning: '부드러운, 다정한', example: 'Be gentle when you hold a scared pet.' },
      { word: 'recover', meaning: '회복하다', example: 'With plenty of rest, it will recover soon.' },
    ],
    p2Step: 'Page 2 · Vet Checklist',
    p2Heading: '동물병원 진찰 표현',
    patterns: [
      { en: 'What seems to be the problem today?', ko: '오늘 어디가 아파서 왔나요?' },
      { en: 'My puppy hurt its ___ / won’t eat.', ko: '강아지가 ___를 다쳤어요 / 밥을 안 먹어요.' },
      { en: 'Make sure it drinks water and gets rest.', ko: '물을 마시고 푹 쉬게 해 주세요.' },
    ],
    questions: [
      'Do you have a pet, or what pet do you dream of having?',
      'What are 2 things a good pet owner must do every day?',
      'Would you like to be a vet for a day? Why?',
    ],
    missions: [
      { label: 'Roleplay · 내가 수의사!', detail: 'The tutor brings a silly pet (a sneezing panda or sleepy puppy). Ask what hurts and give 2 pieces of advice!' },
    ],
    p4Heading: '오늘의 꼬마 수의사 미션',
  }),

  unit({
    id: 'g3-08-airport-adventure',
    unitNo: 8,
    grade: 'grade3',
    gradeTag: '초3 · Unit 8',
    levelRange: 'Lv.1–2',
    theme: '역할극',
    title: 'Airport & Airplane Adventure',
    titleKo: '공항 수속과 비행기 영어',
    cover: COVER_MAP.london,
    description: '해외여행 공항 체크인부터 기내 음료 주문까지 아이 스스로 해볼 수 있는 실전 여행 영어입니다.',
    vocab: [
      { word: 'passport', meaning: '여권', example: 'Please keep your passport in a safe pocket.' },
      { word: 'boarding pass', meaning: '탑승권', example: 'My boarding pass says Gate 12.' },
      { word: 'window seat', meaning: '창가 자리', example: 'I love the window seat to see the clouds.' },
      { word: 'take off', meaning: '이륙하다', example: 'Our airplane is about to take off!' },
      { word: 'suitcase', meaning: '여행 가방', example: 'I packed snacks and a hoodie in my suitcase.' },
    ],
    p2Step: 'Page 2 · Boarding Pass',
    p2Heading: '공항 & 기내 필수 문장',
    patterns: [
      { en: 'Here is my passport. May I have a window seat?', ko: '여권 여기 있어요. 창가 자리로 주실 수 있나요?' },
      { en: 'Excuse me, could I have some orange juice?', ko: '실례지만 오렌지 주스 좀 주시겠어요?' },
      { en: 'Which gate is my flight leaving from?', ko: '제 비행기는 몇 번 게이트에서 출발하나요?' },
    ],
    questions: [
      'Do you prefer a window seat or an aisle seat on an airplane? Why?',
      'What 3 things do you always bring on a long flight?',
      'Which country do you want to fly to next?',
    ],
    missions: [
      { label: 'Scene 1 · 공항 체크인', detail: 'Check in with the airport staff (Tutor) and request a window seat.' },
      { label: 'Scene 2 · 기내 주문', detail: 'Order a drink and a blanket politely from the flight attendant!' },
    ],
    p4Heading: '공항·기내 2단계 여행 역할극',
  }),

  unit({
    id: 'g3-09-robot-puppy',
    unitNo: 9,
    grade: 'grade3',
    gradeTag: '초3 · Unit 9',
    levelRange: 'Lv.1–2',
    theme: '스토리텔링',
    title: 'The Robot Puppy Rescue',
    titleKo: '로봇 강아지 구조 대작전',
    cover: COVER_MAP.future,
    description: '배터리가 방전된 꼬마 로봇 강아지 Bolt를 도와주며 문제 해결 영어를 연습합니다.',
    vocab: [
      { word: 'battery', meaning: '배터리', example: 'Bolt’s battery is down to five percent!' },
      { word: 'rescue', meaning: '구조하다', example: 'We worked together to rescue the robot puppy.' },
      { word: 'recharge', meaning: '충전하다', example: 'He needs sunlight to recharge quickly.' },
      { word: 'clue', meaning: '단서', example: 'Glowing blue footprints were our first clue.' },
      { word: 'teamwork', meaning: '협동심', example: 'Great teamwork solved the problem fast.' },
    ],
    readingTitle: 'Bolt Needs Help!',
    readingParagraphs: [
      'On a rainy Tuesday, Hana heard a tiny "beep-woof!" near the park bench. It was Bolt, a small silver robot puppy with blinking yellow eyes.',
      'His battery light was flashing red! Hana checked the tag on his collar: "Please bring Bolt into a warm room and plug in his solar charger."',
      'With a towel and a sunny window, Bolt’s tail started wagging again in ten minutes!',
    ],
    questions: [
      'How did Hana know Bolt needed help?',
      'What would you do if you found a lost robot pet in the park?',
      'Would you rather have a real puppy or a robot puppy? Explain why!',
    ],
    missions: [
      { label: 'Design Robot Feature', detail: 'Add 2 cool buttons to Bolt (e.g. homework helper, snack finder) and explain what each button does!' },
    ],
    p4Heading: '나만의 로봇 강아지 업그레이드',
  }),

  unit({
    id: 'g3-10-dream-weekend',
    unitNo: 10,
    grade: 'grade3',
    gradeTag: '초3 · Unit 10',
    levelRange: 'Lv.1–2',
    theme: '일상 회화',
    title: 'My Crazy Dream Weekend',
    titleKo: '최고의 주말 계획 세우기',
    cover: COVER_MAP.cafe,
    description: '과거형(지난 주말)과 미래형(다가올 주말)을 자연스럽게 번갈아 말해보는 회화 교재입니다.',
    vocab: [
      { word: 'sleep in', meaning: '늦잠 자다', example: 'On Saturdays, I love to sleep in until nine.' },
      { word: 'amusement park', meaning: '놀이공원', example: 'Going to an amusement park is thrilling!' },
      { word: 'picnic', meaning: '소풍', example: 'My family had a sunny picnic by the river.' },
      { word: 'exhausted', meaning: '녹초가 된', example: 'After swimming all day, I felt exhausted.' },
      { word: 'unforgettable', meaning: '잊지 못할', example: 'It was an unforgettable weekend!' },
    ],
    readingTitle: 'Two Days of Pure Fun',
    readingParagraphs: [
      'Last Saturday, Noah slept in, ate warm pancakes, and rode his bicycle along the river with his dad.',
      'Next weekend, he plans to visit a science museum in the morning and watch an animated movie with popcorn at night.',
    ],
    questions: [
      'What was the best part of your last weekend?',
      'Do you like relaxing at home or going outside on weekends? Why?',
      'If you could design a dream Saturday with no homework, what would you do?',
    ],
    missions: [
      { label: 'Morning Plan', detail: 'Tell your tutor what you will eat and do on Saturday morning.' },
      { label: 'Afternoon Plan', detail: 'Tell your tutor where you will go and who you will bring!' },
    ],
    p4Heading: '드림 토요일 스케줄 발표',
  }),

  unit({
    id: 'g3-11-junior-chef',
    unitNo: 11,
    grade: 'grade3',
    gradeTag: '초3 · Unit 11',
    levelRange: 'Lv.1–2',
    theme: '요리 · 설명하기',
    title: 'Junior Chef: Make a Pizza!',
    titleKo: '주니어 셰프 나만의 피자 만들기',
    cover: COVER_MAP.cafe,
    description: '요리 순서를 First–Next–Then–Finally로 설명하고 세상에서 가장 기발한 피자를 발명합니다.',
    vocab: [
      { word: 'dough', meaning: '반죽', example: 'First, flatten the soft pizza dough.' },
      { word: 'spread', meaning: '펴 바르다', example: 'Spread rich tomato sauce in a circle.' },
      { word: 'sprinkle', meaning: '솔솔 뿌리다', example: 'Sprinkle lots of mozzarella cheese on top.' },
      { word: 'bake', meaning: '오븐에 굽다', example: 'Bake the pizza until the crust turns golden.' },
      { word: 'toppings', meaning: '토핑 재료', example: 'My favorite toppings are corn and pepperoni.' },
    ],
    p2Step: 'Page 2 · Cooking Steps',
    p2Heading: '순서대로 요리 설명하기',
    patterns: [
      { en: 'First, roll out the dough.', ko: '먼저 반죽을 둥글게 펴요.' },
      { en: 'Next, spread the sauce and add toppings.', ko: '다음엔 소스를 바르고 토핑을 올려요.' },
      { en: 'Finally, bake it and slice it hot!', ko: '마지막으로 구워서 따뜻하게 잘라요!' },
    ],
    questions: [
      'What toppings MUST be on your pizza, and which topping do you hate?',
      'Do you think pineapple belongs on pizza? Why or why not?',
      'What dish can you help cook at home?',
    ],
    missions: [
      { label: 'Invent a Funny Pizza', detail: 'Create either a Super Dessert Pizza or a Monster Veggie Pizza! Name it and explain 3 steps to make it.' },
    ],
    p4Heading: '세상에 없는 피자 레시피 발표',
  }),

  unit({
    id: 'g3-12-weather-explorer',
    unitNo: 12,
    grade: 'grade3',
    gradeTag: '초3 · Unit 12',
    levelRange: 'Lv.1–2',
    theme: '자연 · 계절',
    title: 'Weather Explorer & Seasons',
    titleKo: '사계절과 날씨 탐험가',
    cover: COVER_MAP.london,
    description: '봄·여름·가을·겨울 날씨와 옷차림을 영어로 설명하고 나만의 일기예보를 진행합니다.',
    vocab: [
      { word: 'breezy', meaning: '산들바람이 부는', example: 'Spring afternoons feel warm and breezy.' },
      { word: 'pouring', meaning: '비가 쏟아지는', example: 'Grab an umbrella—it is pouring outside!' },
      { word: 'freezing', meaning: '꽁꽁 얼 듯 추운', example: 'Winter mornings can be freezing cold.' },
      { word: 'forecast', meaning: '일기예보', example: 'The weather forecast says sunny skies tomorrow.' },
      { word: 'chilly', meaning: '쌀쌀한', example: 'Wear a jacket because autumn evenings get chilly.' },
    ],
    readingTitle: 'Four Seasons in Korea',
    readingParagraphs: [
      'In spring, pink cherry blossoms bloom while a gentle breeze blows through the park. Summer brings bright sunshine, cold watermelon, and sudden rain showers.',
      'Autumn paints the mountains red and gold, and winter turns rooftops white with snowy fun!',
    ],
    questions: [
      'Which of the four seasons is your absolute favorite, and why?',
      'What do you like doing on a pouring rainy day?',
      'How is the weather outside your window right now?',
    ],
    missions: [
      { label: 'TV Weather Reporter', detail: 'Act like a TV weather reporter! Give a fun 3-sentence weather forecast for tomorrow and suggest what clothes to wear.' },
    ],
    p4Heading: '꼬마 기상캐스터 일기예보 도전',
  }),

  // =========================================================================
  // GRADE 6 CURRICULUM TRACK (12 Units — 48 Pages)
  // =========================================================================
  unit({
    id: 'g6-01-future-school',
    unitNo: 1,
    grade: 'grade6',
    gradeTag: '초6 · Unit 1',
    levelRange: 'Lv.3–4',
    theme: '미래 · 리딩',
    title: 'Future School 2050',
    titleKo: '2050년 미래의 학교',
    cover: COVER_MAP.future,
    description: '미래 교실 기사를 읽고 AI 선생님과 인간 선생님의 역할을 논리적으로 비교·토론합니다.',
    vocab: [
      { word: 'hologram', meaning: '3D 홀로그램', example: 'Students explore planets using a giant hologram.' },
      { word: 'collaborate', meaning: '협력하다', example: 'Classmates collaborate on global projects.' },
      { word: 'flexible', meaning: '유연한', example: 'Future schools might offer a flexible schedule.' },
      { word: 'personalized', meaning: '개인 맞춤형의', example: 'AI coaches provide personalized quizzes.' },
      { word: 'empathy', meaning: '공감 능력', example: 'Human teachers show genuine empathy.' },
    ],
    readingTitle: 'Welcome to Skyview Academy (2050)',
    readingParagraphs: [
      'At Skyview Academy in 2050, students gather around glowing holographic tables to explore the solar system or walk through ancient Rome in 3D.',
      'Each student has a flexible schedule powered by an AI learning coach. However, human teachers still lead every classroom—guiding debates and supporting students emotionally.',
    ],
    questions: [
      'What feature from Skyview Academy do you wish your school had today?',
      'Do you prefer learning from printed books or interactive screens? Explain why.',
      'If you could invent one brand-new school subject for 2050, what would it be?',
    ],
    missions: [
      { label: 'AI vs. Human Debate', detail: 'State your side clearly, reply to the tutor’s counter-point, and propose the best balance!' },
    ],
    p4Heading: '미니 토론: AI 선생님 vs 인간 선생님',
  }),

  unit({
    id: 'g6-02-london-vlog',
    unitNo: 2,
    grade: 'grade6',
    gradeTag: '초6 · Unit 2',
    levelRange: 'Lv.3–4',
    theme: '여행 · 브이로그',
    title: 'Travel Vlog in London',
    titleKo: '런던 48시간 여행 브이로그',
    cover: COVER_MAP.london,
    description: '원어민 여행 구동사를 익히고, 외국인 친구에게 한국이나 꿈의 도시를 영어로 추천 발표합니다.',
    vocab: [
      { word: 'must-see', meaning: '꼭 가봐야 할 명소', example: 'Tower Bridge is a must-see landmark.' },
      { word: 'grab a bite', meaning: '간단히 뭐 좀 먹다', example: 'Let’s grab a bite at the street market.' },
      { word: 'get around', meaning: '(도시를) 돌아다니다', example: 'It is easy to get around London by bus.' },
      { word: 'scenic', meaning: '경치가 멋진', example: 'We took a scenic boat cruise along the Thames.' },
      { word: 'bucket list', meaning: '꼭 해보고 싶은 목록', example: 'Visiting Europe is on my bucket list.' },
    ],
    readingTitle: "Leo's 48-Hour London Vlog",
    readingParagraphs: [
      '"What’s up, guys! First, I hopped on the top deck of a famous red bus to get around London with the best panoramic view."',
      '"Next stop: Tower Bridge! Right after that, I walked over to the riverside market to grab a bite—crispy fish and chips and fresh berry pastries!"',
    ],
    questions: [
      'In London, would you start with the red bus or a river boat cruise? Why?',
      'What destination is currently at the top of your travel bucket list?',
      'What makes a trip truly memorable for you—food, landmarks, or meeting people?',
    ],
    missions: [
      { label: 'Be a Korea Travel Host!', detail: 'Recommend 1 must-see place, 1 food to grab a bite of, and 1 tip to get around Korea for your tutor!' },
    ],
    p4Heading: '외국인 친구에게 한국 여행 브이로그 소개',
  }),

  unit({
    id: 'g6-03-debate-smartphones',
    unitNo: 3,
    grade: 'grade6',
    gradeTag: '초6 · Unit 3',
    levelRange: 'Lv.3–4',
    theme: '찬반 토론',
    title: 'Should Kids Have Smartphones?',
    titleKo: '주니어 토론: 초등학생 스마트폰',
    cover: COVER_MAP.future,
    description: '찬성·반대 근거를 비교하고 원어민 선생님과 3라운드 영어 토론 후 합리적인 타협안을 만듭니다.',
    vocab: [
      { word: 'From my perspective,', meaning: '제 관점에서는,', example: 'From my perspective, phones help with safety.' },
      { word: 'distraction', meaning: '집중 방해 요소', example: 'Alerts can be a huge distraction during homework.' },
      { word: 'responsible', meaning: '책임감 있는', example: 'Kids can learn to be responsible with screen time.' },
      { word: 'On the other hand,', meaning: '반면에,', example: 'On the other hand, too much screen time hurts sleep.' },
      { word: 'compromise', meaning: '타협안, 절충안', example: 'Let’s design a fair compromise for families.' },
    ],
    p2Step: 'Page 2 · Pros & Cons',
    p2Heading: '찬성(Pros) vs 반대(Cons) 핵심 근거',
    p2Guide: '양쪽 입장의 근거를 읽어보고 가장 설득력 있는 이유를 골라 말해 보세요.',
    debatePros: [
      'Safety: Kids can contact parents anytime after school or academies.',
      'Learning Tool: Instant access to dictionaries, audiobooks, and maps.',
      'Digital Habits: Practicing self-control early builds responsibility.',
    ],
    debateCons: [
      'Focus & Sleep: Short videos and games distract from study and rest.',
      'Less Active Play: Kids spend less time on sports or face-to-face chats.',
      'Online Risks: Younger students may see unhealthy content or ads.',
    ],
    questions: [
      'Which argument on the Pro side is the strongest, and why?',
      'Which argument on the Con side worries you the most?',
      'What age do you think is ideal for getting a first smartphone?',
    ],
    missions: [
      { label: '3-Round Mini Debate', detail: 'State your side, answer the tutor’s counter-argument politely, and create 3 Golden Smartphone Rules!' },
    ],
    p4Heading: '3라운드 영어 토론 & 황금 규칙 만들기',
  }),

  unit({
    id: 'g6-04-mars-colony',
    unitNo: 4,
    grade: 'grade6',
    gradeTag: '초6 · Unit 4',
    levelRange: 'Lv.3–4',
    theme: '우주 · 과학',
    title: 'Life on a Mars Colony',
    titleKo: '화성 기지에서의 하루',
    cover: COVER_MAP.future,
    description: '화성에 건설된 미래 도시에서 살게 된다면 겪게 될 도전과 해결책을 영어로 탐구합니다.',
    vocab: [
      { word: 'gravity', meaning: '중력', example: 'Mars has much weaker gravity than Earth.' },
      { word: 'atmosphere', meaning: '대기', example: 'Humans cannot breathe the thin Martian atmosphere.' },
      { word: 'greenhouse', meaning: '온실', example: 'Astronauts grow lettuce inside a glass greenhouse.' },
      { word: 'oxygen', meaning: '산소', example: 'Solar machines produce clean oxygen for the dome.' },
      { word: 'pioneer', meaning: '개척자', example: 'The first Mars settlers will be brave pioneers.' },
    ],
    readingTitle: 'Morning Inside Dome Alpha',
    readingParagraphs: [
      'Living on Mars is very different from living on Earth. Outside the protective glass domes, temperatures drop below minus 60 degrees and red dust storms can last for weeks.',
      'Inside, however, astronauts bounce lightly in low gravity, harvest hydroponic tomatoes, and video-chat with Earth—even though every message takes up to 20 minutes to arrive!',
    ],
    questions: [
      'Would you volunteer to live on Mars for one year? Give two reasons!',
      'What everyday thing on Earth would you miss the most on Mars?',
      'What problem would be hardest to solve on Mars: food, boredom, or dust storms?',
    ],
    missions: [
      { label: 'Mars Packing List', detail: 'You can bring ONLY 3 personal items to Mars. Convince your mission commander (Tutor) why each item is essential!' },
    ],
    p4Heading: '화성 이주 3가지 필수품 설득 발표',
  }),

  unit({
    id: 'g6-05-why-we-dream',
    unitNo: 5,
    grade: 'grade6',
    gradeTag: '초6 · Unit 5',
    levelRange: 'Lv.3–4',
    theme: '뇌과학 · 리딩',
    title: 'Science Detective: Why Do We Dream?',
    titleKo: '뇌과학: 우리는 왜 꿈을 꿀까?',
    cover: COVER_MAP.future,
    description: '수면과 꿈에 관한 흥미로운 과학 지문을 읽고, 기억에 남는 꿈 이야기를 영어로 생생하게 들려줍니다.',
    vocab: [
      { word: 'vivid', meaning: '생생한', example: 'I had a super vivid dream about flying over Seoul.' },
      { word: 'memory', meaning: '기억', example: 'Sleep helps our brain organize daily memories.' },
      { word: 'subconscious', meaning: '잠재의식', example: 'Dreams often reflect our subconscious thoughts.' },
      { word: 'bizarre', meaning: '기묘한, 엉뚱한', example: 'In my bizarre dream, my dog was my math teacher!' },
      { word: 'creativity', meaning: '창의성', example: 'Many famous songs and inventions came from dreams.' },
    ],
    readingTitle: 'Your Brain Never Truly Sleeps',
    readingParagraphs: [
      'Even when your eyes are shut, your brain stays busy during REM sleep. Scientists believe dreams act like a nighttime librarian—sorting memories from the day and throwing away useless clutter.',
      'Dreams also let us practice handling tricky emotions safely and spark wild creativity that we rarely think of while awake.',
    ],
    questions: [
      'Do you usually remember your dreams in the morning, or forget them fast?',
      'Why do scientists compare dreaming to a "nighttime librarian"?',
      'What is the funniest or most bizarre dream you still remember?',
    ],
    missions: [
      { label: 'Storyteller Challenge', detail: 'Tell the story of a real or invented dream using past tense, vivid adjectives, and a twist ending!' },
    ],
    p4Heading: '가장 기묘했던 꿈 스토리텔링',
  }),

  unit({
    id: 'g6-06-world-street-food',
    unitNo: 6,
    grade: 'grade6',
    gradeTag: '초6 · Unit 6',
    levelRange: 'Lv.3–4',
    theme: '세계 문화 · 음식',
    title: 'Street Food Around the World',
    titleKo: '세계 길거리 음식 탐방',
    cover: COVER_MAP.cafe,
    description: '한국 떡볶이부터 멕시코 타코·일본 타코야키까지 맛과 식감을 풍부한 영어 어휘로 묘사합니다.',
    vocab: [
      { word: 'savory', meaning: '감칠맛 나는, 짭짤한', example: 'Tacos are warm, crunchy, and savory.' },
      { word: 'chewy', meaning: '쫄깃쫄깃한', example: 'Tteokbokki rice cakes are spicy and chewy.' },
      { word: 'aroma', meaning: '향기, 냄새', example: 'The sweet aroma of churros filled the night market.' },
      { word: 'authentic', meaning: '정통의, 현지의', example: 'Street stalls serve authentic local flavors.' },
      { word: 'mouthwatering', meaning: '군침이 도는', example: 'That sizzling pancake looks mouthwatering!' },
    ],
    readingTitle: 'A Night Market Tour in 3 Bites',
    readingParagraphs: [
      'Walk through a bustling night market anywhere in the world and your nose leads the way. In Mexico City, vendors fold warm corn tortillas filled with grilled beef and fresh lime.',
      'In Osaka, sizzling takoyaki balls are brushed with sweet sauce, while in Seoul, bright red tteokbokki and crispy hotteok warm up chilly evenings.',
    ],
    questions: [
      'How would you describe your favorite Korean street food to someone who has never tried it?',
      'Are you an adventurous eater who tries new foods, or do you stick to favorites?',
      'Which foreign street food do you want to try first?',
    ],
    missions: [
      { label: 'Food Critic Review', detail: 'Describe 1 Korean food in vivid detail (taste, texture, smell, how to eat it) without saying its name—see if your tutor guesses it!' },
    ],
    p4Heading: '영어 미식가 블라인드 음식 묘사',
  }),

  unit({
    id: 'g6-07-ocean-mysteries',
    unitNo: 7,
    grade: 'grade6',
    gradeTag: '초6 · Unit 7',
    levelRange: 'Lv.3–4',
    theme: '환경 · 과학',
    title: 'Ocean Mysteries & Deep Sea',
    titleKo: '심해의 비밀과 해양 보호',
    cover: COVER_MAP.zoo,
    description: '우주보다 덜 알려진 심해 생물의 비밀을 읽고, 플라스틱 줄이기 실천 방안을 영어로 논의합니다.',
    vocab: [
      { word: 'bioluminescent', meaning: '생물 발광하는', example: 'Deep-sea jellyfish are bioluminescent in the dark.' },
      { word: 'ecosystem', meaning: '생태계', example: 'Coral reefs support a rich ocean ecosystem.' },
      { word: 'pollution', meaning: '오염', example: 'Plastic pollution harms sea turtles and fish.' },
      { word: 'reusable', meaning: '재사용 가능한', example: 'Carrying a reusable tumbler reduces trash.' },
      { word: 'unexplored', meaning: '미탐사의', example: 'Over eighty percent of the ocean remains unexplored.' },
    ],
    readingTitle: 'A Glowing World Below',
    readingParagraphs: [
      'More than 80% of Earth’s oceans have never been mapped or explored! Thousands of meters down where sunlight never reaches, bizarre creatures glow like neon stars to attract food or hide from predators.',
      'Protecting this hidden world starts on land—even small habits like refusing single-use plastic help keep ocean ecosystems thriving.',
    ],
    questions: [
      'Would you rather explore deep space or the deepest part of the ocean? Why?',
      'Why do some deep-sea animals glow in the dark?',
      'What is one realistic eco-friendly habit students can do at school?',
    ],
    missions: [
      { label: 'Eco Campaign Pitch', detail: 'Create a 3-sentence "Save Our Oceans" slogan and action plan for your school!' },
    ],
    p4Heading: '학교 해양 보호 캠페인 발표',
  }),

  unit({
    id: 'g6-08-k-culture-pitch',
    unitNo: 8,
    grade: 'grade6',
    gradeTag: '초6 · Unit 8',
    levelRange: 'Lv.3–4',
    theme: '문화 소개 · 스피치',
    title: 'K-Culture Global Ambassador',
    titleKo: '외국인에게 한국 문화 소개하기',
    cover: COVER_MAP.london,
    description: 'K-POP, 한복, 웹툰, 한국 학교생활 등 외국인이 궁금해하는 한국 문화를 영어로 자신 있게 소개합니다.',
    vocab: [
      { word: 'tradition', meaning: '전통', example: 'Hanbok represents Korea’s colorful tradition.' },
      { word: 'phenomenon', meaning: '열풍, 현상', example: 'Korean webtoons became a worldwide phenomenon.' },
      { word: 'unique', meaning: '독특한', example: 'Korea blends ancient palaces with modern skyscrapers.' },
      { word: 'hospitality', meaning: '환대, 정', example: 'Visitors love Korean warmth and hospitality.' },
      { word: 'highlight', meaning: '가장 멋진 부분', example: 'Trying Korean barbecue was the highlight of his trip.' },
    ],
    readingTitle: 'Where Ancient Meets Modern',
    readingParagraphs: [
      'Foreign visitors to Korea are often amazed by how effortlessly history and innovation sit side by side—a 600-year-old royal palace stands just blocks away from futuristic subways and digital screens.',
      'From thrilling webtoons and K-pop choreography to late-night convenience store snacks, Korean culture keeps surprising the world.',
    ],
    questions: [
      'If a foreign exchange student joined your school for one day, what would surprise them most?',
      'Which part of K-culture are you proudest to share with global friends?',
      'What is one Korean convenience store snack or drink you would recommend?',
    ],
    missions: [
      { label: 'Global Ambassador Q&A', detail: 'Answer 3 rapid curiosity questions from your foreign tutor about Korean school lunches, holidays, and trends!' },
    ],
    p4Heading: '글로벌 한국 문화 홍보대사 인터뷰',
  }),

  unit({
    id: 'g6-09-debate-homework',
    unitNo: 9,
    grade: 'grade6',
    gradeTag: '초6 · Unit 9',
    levelRange: 'Lv.3–4',
    theme: '찬반 토론',
    title: 'Homework vs. Free Play Time',
    titleKo: '주니어 토론: 숙제는 꼭 필요할까?',
    cover: COVER_MAP.future,
    description: '초등학생 숙제의 장단점을 영어로 분석하고, 효과적인 공부와 휴식의 균형을 논리적으로 주장합니다.',
    vocab: [
      { word: 'reinforce', meaning: '강화하다, 복습하다', example: 'Short practice helps reinforce what we learned.' },
      { word: 'burnout', meaning: '번아웃, 지침', example: 'Too much homework can cause stress and burnout.' },
      { word: 'independent', meaning: '자기주도적인', example: 'Homework trains independent time management.' },
      { word: 'balanced', meaning: '균형 잡힌', example: 'Kids need a balanced mix of study and play.' },
      { word: 'quality over quantity', meaning: '양보다 질', example: 'Good homework focuses on quality over quantity.' },
    ],
    p2Step: 'Page 2 · Pros & Cons',
    p2Heading: '숙제 찬성(Pros) vs 반대(Cons)',
    debatePros: [
      'Review Power: Reviewing class material the same day locks it into memory.',
      'Study Habits: Teaches kids how to plan time independently before middle school.',
      'Parent Insight: Helps parents see what their child is learning.',
    ],
    debateCons: [
      'Stress & Fatigue: Kids already study at school and academies all afternoon.',
      'Less Creativity: Free play, reading, and sports also build smart brains.',
      'Repetitive Work: Copying worksheets without thinking rarely helps.',
    ],
    questions: [
      'Do you think homework actually helps you learn better, or just makes you tired?',
      'How many minutes of daily homework is fair for a 6th grader?',
      'What kind of "fun project homework" would you actually enjoy doing?',
    ],
    missions: [
      { label: 'Principal Pitch', detail: 'Persuade the School Principal (Tutor) to adopt your ideal homework policy with 2 strong reasons!' },
    ],
    p4Heading: '교장 선생님 설득하기 영어 스피치',
  }),

  unit({
    id: 'g6-10-olympic-teamwork',
    unitNo: 10,
    grade: 'grade6',
    gradeTag: '초6 · Unit 10',
    levelRange: 'Lv.3–4',
    theme: '스포츠 · 가치관',
    title: 'Sportsmanship & Teamwork',
    titleKo: '스포츠 정신과 팀워크',
    cover: COVER_MAP.london,
    description: '개인 종목과 팀 스포츠를 비교하고, 실패를 이겨내는 스포츠맨십에 대해 깊이 있게 대화합니다.',
    vocab: [
      { word: 'perseverance', meaning: '끈기, 인내심', example: 'Great athletes show perseverance after a loss.' },
      { word: 'sportsmanship', meaning: '스포츠맨십', example: 'Shaking hands after a tough match shows sportsmanship.' },
      { word: 'strategy', meaning: '전략', example: 'Our team changed strategy during halftime.' },
      { word: 'overcome', meaning: '극복하다', example: 'Practice helped him overcome his nervousness.' },
      { word: 'encourage', meaning: '격려하다', example: 'Good teammates encourage each other after mistakes.' },
    ],
    readingTitle: 'More Than Just a Gold Medal',
    readingParagraphs: [
      'At the Olympics, millions cheer for record-breaking winners, yet the moments people remember longest are often acts of kindness—like a runner stopping to help an injured rival cross the finish line.',
      'Whether in soccer, archery, or e-sports, learning how to lose gracefully and bounce back stronger matters even more than winning once.',
    ],
    questions: [
      'Do you prefer individual sports (like swimming or archery) or team sports (like soccer or basketball)? Why?',
      'Tell me about a time you didn’t give up even when something felt difficult.',
      'What makes someone a truly great team captain?',
    ],
    missions: [
      { label: 'Post-Match Interview', detail: 'Pretend you just won (or narrowly lost!) a big championship! Answer the sports reporter’s (Tutor) live interview questions.' },
    ],
    p4Heading: '결승전 직후 영어 인터뷰 롤플레이',
  }),

  unit({
    id: 'g6-11-ai-creativity',
    unitNo: 11,
    grade: 'grade6',
    gradeTag: '초6 · Unit 11',
    levelRange: 'Lv.3–4',
    theme: 'AI · 찬반 토론',
    title: 'AI Art & Human Creativity',
    titleKo: 'AI 시대와 인간의 창의성',
    cover: COVER_MAP.future,
    description: 'AI가 그림을 그리고 노래를 만드는 시대에 인간만의 창의성이 왜 중요한지 영어로 토론합니다.',
    vocab: [
      { word: 'original', meaning: '독창적인', example: 'Real artists express original personal stories.' },
      { word: 'tool', meaning: '도구', example: 'AI can be a helpful tool for brainstorming ideas.' },
      { word: 'emotion', meaning: '감정', example: 'Music moves us because it carries human emotion.' },
      { word: 'copyright', meaning: '저작권', example: 'Should AI art be allowed to win art contests?' },
      { word: 'imagination', meaning: '상상력', example: 'Human imagination asks questions machines never think of.' },
    ],
    p2Step: 'Page 2 · Debate Cards',
    p2Heading: 'AI 창작 도구 찬성 vs 우려',
    debatePros: [
      'Idea Spark: Anyone can quickly visualize story scenes or game characters.',
      'Accessibility: Helps people who struggle with drawing express creative stories.',
      'Speed: Saves time on rough drafts so humans can focus on big ideas.',
    ],
    debateCons: [
      'Fairness: Submitting AI-made art to a school art contest feels unfair.',
      'Originality: AI remixes existing data rather than feeling real life emotions.',
      'Skill Loss: Relying too much on AI may stop kids from practicing drawing or writing.',
    ],
    questions: [
      'If a student uses AI to paint a picture for an art contest, should it be allowed? Why?',
      'What is something humans can create that AI can never truly copy?',
      'How do you think students should use AI wisely for learning?',
    ],
    missions: [
      { label: 'Smart AI Pledge', detail: 'State 2 smart ways to use AI as a helper and 1 line we should never cross!' },
    ],
    p4Heading: '주니어 AI 현명한 활용 선언문',
  }),

  unit({
    id: 'g6-12-young-entrepreneurs',
    unitNo: 12,
    grade: 'grade6',
    gradeTag: '초6 · Unit 12',
    levelRange: 'Lv.3–4',
    theme: '발표 · 문제 해결',
    title: 'Young Entrepreneurs: Pitch an App!',
    titleKo: '주니어 창업가: 내 아이디어 발표',
    cover: COVER_MAP.future,
    description: '일상 속 불편함을 해결하는 나만의 앱·발명품을 기획하고 투자자(선생님) 앞에서 영어로 피칭합니다.',
    vocab: [
      { word: 'entrepreneur', meaning: '창업가', example: 'Even elementary students can be creative entrepreneurs!' },
      { word: 'target user', meaning: '주요 사용자', example: 'Our target users are busy students and pet owners.' },
      { word: 'solve a problem', meaning: '문제를 해결하다', example: 'Every great app starts by solving a real problem.' },
      { word: 'feature', meaning: '핵심 기능', example: 'Its coolest feature is a smart reminder alarm.' },
      { word: 'pitch', meaning: '아이디어 발표하다', example: 'Let me pitch my brand-new invention in one minute!' },
    ],
    readingTitle: 'Small Problems, Big Inventions',
    readingParagraphs: [
      'Did you know a 11-year-old invented the Popsicle by accident, and a 15-year-old invented earmuffs to keep his ears warm while ice skating?',
      'You do not have to be an adult to spot an annoying daily problem and design a clever app, gadget, or service that makes life easier!',
    ],
    questions: [
      'What small problem at school or home annoys you almost every day?',
      'Which app or gadget do you think was the smartest invention ever?',
      'If you built an app for kids your age, what would it do?',
    ],
    missions: [
      { label: '1. 이름 & 해결할 문제', detail: 'Name your app or invention and explain the problem it solves.' },
      { label: '2. 핵심 기능 2가지', detail: 'Explain 2 cool features to the Investor (Tutor).' },
      { label: '3. 투자자 Q&A', detail: 'Answer 2 sharp questions from the Investor to win funding!' },
    ],
    p4Heading: '주니어 스타트업 영어 피칭 도전!',
  }),
];

export function loadCustomAiTextbooks() {
  try {
    const raw = localStorage.getItem(CUSTOM_BOOKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const DELETED_CUSTOM_BOOKS_KEY = 'fluentcam_deleted_ai_books_v1';

export function loadDeletedAiBookIds() {
  try {
    const raw = localStorage.getItem(DELETED_CUSTOM_BOOKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomAiTextbook(book) {
  const existing = loadCustomAiTextbooks().filter((b) => b.id !== book.id);
  existing.unshift(book);
  localStorage.setItem(CUSTOM_BOOKS_KEY, JSON.stringify(existing.slice(0, 40)));
  const deleted = loadDeletedAiBookIds().filter((id) => id !== book.id);
  localStorage.setItem(DELETED_CUSTOM_BOOKS_KEY, JSON.stringify(deleted));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fluentcam:data-mutated', { detail: { kind: 'aibooks' } }));
  }
  return existing;
}

export function deleteCustomAiTextbook(bookId) {
  const next = loadCustomAiTextbooks().filter((b) => b.id !== bookId);
  localStorage.setItem(CUSTOM_BOOKS_KEY, JSON.stringify(next));
  const deleted = [...new Set([...loadDeletedAiBookIds(), bookId])].slice(-100);
  localStorage.setItem(DELETED_CUSTOM_BOOKS_KEY, JSON.stringify(deleted));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fluentcam:data-mutated', { detail: { kind: 'aibooks' } }));
  }
  return next;
}

export function getAllTextbooks() {
  return [...loadCustomAiTextbooks(), ...BUILTIN_TEXTBOOKS];
}

// Keep legacy export name working seamlessly
export const TEXTBOOKS = BUILTIN_TEXTBOOKS;

export function formatSingleTextbookPage(p, pageNum = 1) {
  if (!p) return '';
  const parts = [`Page ${pageNum} (${p.step} — ${p.heading})`];
  if (p.vocab) {
    parts.push(`Vocab: ${p.vocab.map((v) => `${v.word} (${v.meaning})`).join(', ')}`);
  }
  if (p.readingParagraphs) {
    parts.push(`Reading: "${p.readingParagraphs.join(' ')}"`);
  }
  if (p.menuItems) {
    parts.push(`Menu: ${p.menuItems.map((m) => `${m.name} (${m.price})`).join(', ')}`);
  }
  if (p.patterns) {
    parts.push(`Patterns: ${p.patterns.map((pt) => pt.en).join(' | ')}`);
  }
  if (p.debatePros) {
    parts.push(`Pros: ${p.debatePros.join(' / ')} | Cons: ${p.debateCons.join(' / ')}`);
  }
  if (p.questions) {
    parts.push(`Questions: ${p.questions.join(' / ')}`);
  }
  if (p.missionCards) {
    parts.push(`Mission: ${p.missionCards.map((m) => `${m.label}: ${m.detail}`).join(' / ')}`);
  }
  if (p.teacherNotes) {
    parts.push(`Guide: ${p.teacherNotes}`);
  }
  return parts.join('\n  ');
}

export function formatTextbookForPrompt(textbook, activePageIdx = 0) {
  if (!textbook) return '';
  if (textbook.id === 'custom-book') {
    const trimmedContent = String(textbook.customContent || '').slice(0, 1800);
    return `\n[Lesson Material]
Title: ${textbook.title || 'Custom Reading Material'}
${trimmedContent}
Guide the student warmly through this material with short speaking questions and full-sentence coaching.`;
  }

  const pages = textbook.pages || [];
  const safeIdx = Math.max(0, Math.min(pages.length - 1, activePageIdx));
  const outline = pages
    .map((p, idx) => `P${idx + 1}: ${p.heading}${idx === safeIdx ? ' (ACTIVE)' : ''}`)
    .join(' | ');
  const activeDetail = formatSingleTextbookPage(pages[safeIdx], safeIdx + 1);

  return `\n[Active Textbook]
"${textbook.title}" (${textbook.gradeTag}, ${textbook.levelRange}) | Pages: ${outline}
Stay 3–5 student speaking turns on each page, coach errors/fragments first, then call turn_textbook_page(pageNumber) to receive the next page's full content!
Active Page Content:
- ${activeDetail}`;
}
