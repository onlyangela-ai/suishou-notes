// Patty 原稿的小怪獸（來自「環遊世界小怪獸」）
const SPIKES = "M34 130 L16.8 117 L38 110 L26.8 93 L49.4 92.7 L45.7 73 L67 79.8 L71 60 L88.5 72.9 L100 56 L111.5 72.9 L129 60 L133 79.8 L154 73 L150.6 92.7 L173 93 L162 110 L183 117 L166 130Z";
const G = s => `<g stroke="#1a1a1a" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" fill="none">${s}</g>`;
const cheeks = (y, a, b) => `<ellipse cx="${a}" cy="${y}" rx="9" ry="6" fill="#F4A3C1" stroke="none"/><ellipse cx="${b}" cy="${y}" rx="9" ry="6" fill="#F4A3C1" stroke="none"/>`;
const spiky = (spike, body, legs, eyeX, mouth) => G(`<path d="M67 184 L68 204 L84 204 L85 186Z M115 186 L116 204 L132 204 L133 184Z" fill="${legs}"/>
<rect x="65" y="203" width="22" height="9" rx="3" fill="#fff"/><rect x="113" y="203" width="22" height="9" rx="3" fill="#fff"/>
<path d="${SPIKES}" fill="${spike}"/><ellipse cx="100" cy="130" rx="66" ry="58" fill="${body}"/>
<path d="M40 154 Q100 222 160 154 Q100 196 40 154Z" fill="#000" fill-opacity="0.1" stroke="none"/>
<path d="M44 116 Q48 94 68 84" stroke="#fff" stroke-opacity="0.6" stroke-width="6"/>
<circle cx="100" cy="116" r="22" fill="#fff"/><circle cx="${eyeX}" cy="118" r="14" fill="#1a1a1a" stroke="none"/>
<circle cx="${eyeX - 5}" cy="112" r="5" fill="#fff" stroke="none"/><circle cx="${eyeX + 5}" cy="124" r="2.5" fill="#fff" stroke="none"/>
${cheeks(142, 56, 144)}${mouth}`);
const GRIN = `<path d="M74 146 Q100 154 126 146 Q122 174 100 175 Q78 174 74 146Z" fill="#1a1a1a"/><path d="M90 168 Q100 160 110 168 Q100 176 90 168Z" fill="#F07C8C" stroke="none"/><path d="M80 148 L85 158 L90 150 L95 160 L100 151 L105 160 L110 150 L115 158 L120 148Z" fill="#fff" stroke="none"/>`;
const MONSTERS = {
  bear: { name: "藍藍熊", svg: G(`<path d="M70 190 Q58 210 62 218 L92 214 Q86 200 84 190Z M130 190 Q142 210 138 218 L108 214 Q114 200 116 190Z" fill="#1a1a1a"/>
<path d="M48 66 Q38 30 74 38 Q86 52 80 70Z M152 66 Q162 30 126 38 Q114 52 120 70Z" fill="#4DB3E6"/>
<path d="M57 58 Q55 46 68 47 Q72 54 71 62Z M143 58 Q145 46 132 47 Q128 54 129 62Z" fill="#F4A3C1" stroke="none"/>
<rect x="46" y="54" width="108" height="140" rx="40" fill="#4DB3E6"/>
<path d="M50 160 Q54 194 90 194 L110 194 Q146 194 150 160 Q146 184 100 184 Q54 184 50 160Z" fill="#000" fill-opacity="0.1" stroke="none"/>
<path d="M56 92 Q52 124 58 152" stroke="#fff" stroke-opacity="0.55" stroke-width="6"/><circle cx="62" cy="80" r="3.5" fill="#fff" stroke="none"/>
<ellipse cx="78" cy="108" rx="11" ry="14" fill="#1a1a1a"/><circle cx="74" cy="101" r="4.5" fill="#fff" stroke="none"/><circle cx="82" cy="114" r="2.2" fill="#fff" stroke="none"/>
<ellipse cx="122" cy="108" rx="11" ry="14" fill="#1a1a1a"/><circle cx="118" cy="101" r="4.5" fill="#fff" stroke="none"/><circle cx="126" cy="114" r="2.2" fill="#fff" stroke="none"/>
${cheeks(130, 62, 138)}<path d="M90 130 Q100 152 110 130Z" fill="#1a1a1a"/><path d="M95 140 Q100 148 105 140Z" fill="#F07C8C" stroke="none"/>
<path d="M46 124 Q24 122 20 100 M154 124 Q176 122 180 100"/>`) },
  green: { name: "綠刺刺", svg: spiky("#6FBF86", "#9FDCA9", "#8FC9A0", 102, GRIN) },
  orange: { name: "橘刺刺", svg: spiky("#E07B2E", "#F7A65A", "#F2B98A", 96, `<ellipse cx="100" cy="162" rx="14" ry="15" fill="#1a1a1a"/><path d="M92 168 Q100 160 108 168 Q100 176 92 168Z" fill="#F07C8C" stroke="none"/>`) },
  purple: { name: "翻滾刺刺", svg: spiky("#8E5CC8", "#B88AEB", "#CDB3F0", 102, GRIN) },
  pumpkin: { name: "南瓜角怪", svg: G(`<path d="M50 98 Q18 78 22 28 Q60 46 88 64Z M150 98 Q182 78 178 28 Q140 46 112 64Z" fill="#1a1a1a"/>
<path d="M100 64 C146 58 182 84 182 128 C182 166 148 190 100 190 C52 190 18 166 18 128 C18 84 54 58 100 64Z" fill="#F4A04A"/>
<path d="M18 150 Q40 192 100 190 Q160 192 182 150 Q150 178 100 176 Q50 178 18 150Z" fill="#000" fill-opacity="0.1" stroke="none"/>
<path d="M70 66 Q44 126 68 188 M130 66 Q156 126 132 188" stroke-width="3.5"/><path d="M34 104 Q28 128 38 152" stroke="#fff" stroke-opacity="0.5" stroke-width="6"/>
<path d="M66 68 C66 54 134 54 134 68 C134 80 66 80 66 68Z" fill="#FFF1CF"/><path d="M76 56 C76 44 124 44 124 56 C124 66 76 66 76 56Z" fill="#FFF1CF"/>
<path d="M88 46 C88 34 108 34 110 20 C118 34 114 52 110 52 C100 54 88 54 88 46Z" fill="#FFF1CF"/>
<circle cx="100" cy="122" r="26" fill="#fff"/><circle cx="102" cy="125" r="16" fill="#1a1a1a" stroke="none"/><circle cx="96" cy="118" r="6" fill="#fff" stroke="none"/><circle cx="108" cy="132" r="3" fill="#fff" stroke="none"/>
<ellipse cx="52" cy="140" rx="11" ry="7" fill="#F4A3C1" stroke="none"/><ellipse cx="148" cy="140" rx="11" ry="7" fill="#F4A3C1" stroke="none"/>
<path d="M78 162 L84 155 L90 163 L96 155 L102 163 L108 155 L114 163 L120 155 L124 162" stroke-width="3.5"/>`) },
  cat: { name: "貓耳串串怪", svg: G(`<path d="M82 196 L80 214 M118 196 L120 214"/><path d="M80 212 L66 226 L82 224 L94 226Z M120 212 L106 226 L118 224 L134 226Z" fill="#1a1a1a"/>
<path d="M54 76 L58 16 L106 62Z M146 76 L142 16 L94 62Z" fill="#1a1a1a"/><path d="M66 62 L68 34 L90 56Z M134 62 L132 34 L110 56Z" fill="#fff" stroke-width="2.5"/>
<rect x="54" y="64" width="92" height="132" rx="20" fill="#F1ECF8"/>
<circle cx="100" cy="114" r="26" fill="#fff"/><circle cx="102" cy="117" r="16" fill="#1a1a1a" stroke="none"/><circle cx="96" cy="110" r="6" fill="#fff" stroke="none"/><circle cx="108" cy="124" r="3" fill="#fff" stroke="none"/>
${cheeks(140, 70, 130)}<path d="M80 160 Q86 153 92 160 T104 160 T116 160" stroke="#555" stroke-width="3.5"/>
<path d="M22 182 L52 106 M178 182 L148 106" stroke="#3b2f2f" stroke-width="3.5"/>
<circle cx="28" cy="166" r="8" fill="#3A7BD5"/><circle cx="34" cy="150" r="8" fill="#3FA05A"/><circle cx="40" cy="134" r="8" fill="#3A7BD5"/><circle cx="46" cy="118" r="8" fill="#3FA05A"/>
<circle cx="172" cy="166" r="8" fill="#3A7BD5"/><circle cx="166" cy="150" r="8" fill="#3FA05A"/><circle cx="160" cy="134" r="8" fill="#3A7BD5"/><circle cx="154" cy="118" r="8" fill="#3FA05A"/>`) },
};
const MKEYS = Object.keys(MONSTERS);
const mSvg = (k, cls = "") => `<svg class="${cls}" viewBox="10 12 180 220" aria-hidden="true">${(MONSTERS[k] || MONSTERS.bear).svg}</svg>`;

