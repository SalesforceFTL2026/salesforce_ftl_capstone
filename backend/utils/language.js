/**
 * Language helpers shared by the text chat and the voice agent.
 *
 * The AI assistants otherwise reply in whatever language the user happened to
 * type/speak in. These helpers let us pin the reply to the user's saved
 * languagePreference instead, and supply translated versions of the fixed,
 * NON-model-generated spoken scripts the voice agent falls back to.
 *
 * SAFETY NOTE: the `emergency` script below is life-safety text (it tells a
 * caller to dial 911). These translations are machine-drafted and should be
 * reviewed by a native speaker before being relied on in production, same as
 * the rest of the app's non-English safety strings.
 */

// Maps our stored language codes to a name the model understands, so the
// assistant replies in the user's chosen language. Must stay in sync with
// SUPPORTED_LANGUAGES (frontend) / VALID_LANGUAGES (authController).
export const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish',
  zh: 'Chinese',
  tl: 'Tagalog',
  vi: 'Vietnamese',
  fr: 'French',
  ko: 'Korean',
  ru: 'Russian',
  ht: 'Haitian Creole',
  hi: 'Hindi',
  ne: 'Nepali',
};

// Build a one-line instruction telling the model which language to answer in.
// Returns '' for English (or unknown codes) so the prompt is unchanged there.
export const buildLanguageDirective = (langCode) => {
  const name = LANGUAGE_NAMES[langCode];
  if (!name || langCode === 'en') return '';
  return `\n\nIMPORTANT: Always reply in ${name}, regardless of the language the user writes in. Keep emergency numbers (like 911) and proper names as-is.`;
};

// Instruction for the extractor/voice prompts that produce a structured request
// draft: write the free-text fields (description, location) in the user's
// language, but leave the enum fields (category, urgency) as their exact English
// values — those are validated against a fixed English list and the UI maps them
// to translated labels for display. Returns '' for English/unknown codes.
export const buildFieldLanguageDirective = (langCode) => {
  const name = LANGUAGE_NAMES[langCode];
  if (!name || langCode === 'en') return '';
  return `\n- Write "description" and "location" in ${name} (the user's language). Keep "category" and "urgency" as the exact English values listed above.`;
};

// Fixed spoken scripts the voice agent says verbatim (they are deliberately NOT
// model-generated — a rate-limited or "creative" model must never garble a
// life-safety line). Because they bypass the model, they also bypass the
// language directive above, so we translate them here per language.
//
// Keys mirror the constants in voiceAgent.js:
//   emergency  -> EMERGENCY_SCRIPT (life-safety, dial 911)
//   review     -> REVIEW_HANDOFF_SCRIPT (request is on screen, press Submit)
//   giveUp     -> the "trouble over voice, finish on the form" handoff
const VOICE_SCRIPTS = {
  en: {
    emergency:
      'This sounds like a life-threatening emergency. Please call 911 right now — they can ' +
      "reach you faster than we can. I've marked your request critical, and it's here on " +
      'screen ready for you to send when you are safe.',
    review:
      "Thanks. I've put your request on the screen now. Please check the details and " +
      'fix anything I got wrong, then press Submit to send it.',
    giveUp:
      "I'm having trouble getting all the details over voice. I've put what you told me " +
      'on the screen — please finish the rest there and press Submit to send it.',
  },
  es: {
    emergency:
      'Esto parece una emergencia que pone en peligro la vida. Por favor, llame al 911 ahora mismo — ' +
      'ellos pueden llegar a usted más rápido que nosotros. He marcado su solicitud como crítica y ' +
      'está aquí en la pantalla, lista para enviar cuando esté a salvo.',
    review:
      'Gracias. He puesto su solicitud en la pantalla. Por favor, revise los detalles y ' +
      'corrija cualquier error, luego presione Enviar para mandarla.',
    giveUp:
      'Me cuesta obtener todos los detalles por voz. He puesto lo que me dijo en la pantalla — ' +
      'por favor, complete el resto ahí y presione Enviar para mandarla.',
  },
  zh: {
    emergency:
      '这听起来像是危及生命的紧急情况。请立即拨打 911 — 他们能比我们更快地赶到您身边。' +
      '我已将您的请求标记为紧急，它现在显示在屏幕上，等您安全后即可发送。',
    review:
      '谢谢。我已将您的请求显示在屏幕上。请检查各项信息，更正任何错误，然后按“提交”发送。',
    giveUp:
      '通过语音获取所有信息有些困难。我已把您告诉我的内容显示在屏幕上 — 请在那里补全其余内容，然后按“提交”发送。',
  },
  tl: {
    emergency:
      'Mukhang isa itong emergency na nakamamatay. Pakitawagan agad ang 911 — mas mabilis nilang ' +
      'maaabot kayo kaysa sa amin. Minarkahan ko na kritikal ang inyong kahilingan, at nasa screen ' +
      'na ito, handang ipadala kapag ligtas na kayo.',
    review:
      'Salamat. Nailagay ko na sa screen ang inyong kahilingan. Pakisuri ang mga detalye at ' +
      'itama ang anumang mali, pagkatapos ay pindutin ang Isumite upang ipadala ito.',
    giveUp:
      'Nahihirapan akong makuha ang lahat ng detalye sa pamamagitan ng boses. Nailagay ko na sa screen ' +
      'ang sinabi ninyo — pakikumpleto ang natitira doon at pindutin ang Isumite upang ipadala ito.',
  },
  vi: {
    emergency:
      'Đây có vẻ là một trường hợp khẩn cấp nguy hiểm đến tính mạng. Vui lòng gọi 911 ngay bây giờ — ' +
      'họ có thể đến với bạn nhanh hơn chúng tôi. Tôi đã đánh dấu yêu cầu của bạn là nghiêm trọng, và ' +
      'nó đang hiển thị trên màn hình, sẵn sàng để gửi khi bạn an toàn.',
    review:
      'Cảm ơn bạn. Tôi đã đưa yêu cầu của bạn lên màn hình. Vui lòng kiểm tra các chi tiết và ' +
      'sửa bất kỳ điều gì tôi ghi sai, rồi nhấn Gửi để gửi đi.',
    giveUp:
      'Tôi gặp khó khăn khi lấy đầy đủ chi tiết qua giọng nói. Tôi đã đưa những gì bạn nói lên màn hình — ' +
      'vui lòng hoàn tất phần còn lại ở đó và nhấn Gửi để gửi đi.',
  },
  fr: {
    emergency:
      "Cela ressemble à une urgence mettant la vie en danger. Veuillez appeler le 911 immédiatement — " +
      'ils peuvent vous atteindre plus vite que nous. J\'ai marqué votre demande comme critique, et ' +
      "elle est ici à l'écran, prête à être envoyée dès que vous êtes en sécurité.",
    review:
      "Merci. J'ai affiché votre demande à l'écran. Veuillez vérifier les détails et " +
      'corriger toute erreur, puis appuyez sur Envoyer pour la transmettre.',
    giveUp:
      "J'ai du mal à obtenir tous les détails par la voix. J'ai affiché ce que vous m'avez dit à l'écran — " +
      'veuillez compléter le reste là-bas et appuyer sur Envoyer pour la transmettre.',
  },
  ko: {
    emergency:
      '생명을 위협하는 응급 상황으로 보입니다. 지금 즉시 911에 전화하세요 — 그들은 저희보다 더 빨리 ' +
      '도착할 수 있습니다. 귀하의 요청을 위급으로 표시했으며, 화면에 표시되어 있으니 안전해지면 보내실 수 있습니다.',
    review:
      '감사합니다. 요청을 화면에 표시했습니다. 세부 정보를 확인하시고 잘못된 부분을 수정한 뒤, ' +
      '제출을 눌러 보내주세요.',
    giveUp:
      '음성으로 모든 세부 정보를 받기가 어렵습니다. 말씀하신 내용을 화면에 표시했으니 — ' +
      '나머지는 거기서 완성하신 후 제출을 눌러 보내주세요.',
  },
  ru: {
    emergency:
      'Это похоже на угрожающую жизни чрезвычайную ситуацию. Пожалуйста, немедленно позвоните 911 — ' +
      'они смогут добраться до вас быстрее, чем мы. Я отметил ваш запрос как критический, и ' +
      'он на экране, готов к отправке, как только вы будете в безопасности.',
    review:
      'Спасибо. Я вывел ваш запрос на экран. Пожалуйста, проверьте данные и ' +
      'исправьте всё, что я записал неверно, затем нажмите «Отправить».',
    giveUp:
      'Мне трудно получить все детали голосом. Я вывел на экран то, что вы сказали — ' +
      'пожалуйста, завершите остальное там и нажмите «Отправить».',
  },
  ht: {
    emergency:
      'Sa sanble se yon ijans ki ka touye ou. Tanpri rele 911 kounye a — yo ka rive jwenn ou pi ' +
      'vit pase nou. Mwen make demann ou an kòm kritik, epi li sou ekran an, li pare pou ou voye l ' +
      'lè ou an sekirite.',
    review:
      'Mèsi. Mwen mete demann ou an sou ekran an kounye a. Tanpri tcheke detay yo epi ' +
      'korije nenpòt bagay mwen te mal pran, apre sa peze Soumèt pou voye l.',
    giveUp:
      'Mwen gen difikilte pou m pran tout detay yo pa vwa. Mwen mete sa ou te di m sou ekran an — ' +
      'tanpri fini rès la la epi peze Soumèt pou voye l.',
  },
  hi: {
    emergency:
      'यह जानलेवा आपात स्थिति लगती है। कृपया अभी 911 पर कॉल करें — वे हमसे तेज़ी से आप तक ' +
      'पहुँच सकते हैं। मैंने आपके अनुरोध को गंभीर के रूप में चिह्नित कर दिया है, और यह स्क्रीन पर है, ' +
      'सुरक्षित होने पर भेजने के लिए तैयार है।',
    review:
      'धन्यवाद। मैंने आपका अनुरोध स्क्रीन पर रख दिया है। कृपया विवरण जाँचें और ' +
      'जो कुछ भी मैंने गलत लिखा हो उसे ठीक करें, फिर भेजने के लिए सबमिट दबाएँ।',
    giveUp:
      'आवाज़ से सभी विवरण लेने में मुझे कठिनाई हो रही है। आपने जो बताया वह मैंने स्क्रीन पर रख दिया है — ' +
      'कृपया बाकी वहीं पूरा करें और भेजने के लिए सबमिट दबाएँ।',
  },
  ne: {
    emergency:
      'यो ज्यान जोखिममा पार्ने आपत्कालजस्तो देखिन्छ। कृपया अहिले नै 911 मा फोन गर्नुहोस् — तिनीहरू ' +
      'हामीभन्दा छिटो तपाईंकहाँ पुग्न सक्छन्। मैले तपाईंको अनुरोधलाई गम्भीर भनी चिन्ह लगाएको छु, र ' +
      'यो स्क्रिनमा छ, तपाईं सुरक्षित भएपछि पठाउन तयार छ।',
    review:
      'धन्यवाद। मैले तपाईंको अनुरोध स्क्रिनमा राखेको छु। कृपया विवरण जाँच्नुहोस् र ' +
      'मैले गलत लेखेको कुनै कुरा सच्याउनुहोस्, त्यसपछि पठाउन सबमिट थिच्नुहोस्।',
    giveUp:
      'आवाजबाट सबै विवरण लिन मलाई गाह्रो भइरहेको छ। तपाईंले भन्नुभएको कुरा मैले स्क्रिनमा राखेको छु — ' +
      'कृपया बाँकी त्यहीँ पूरा गर्नुहोस् र पठाउन सबमिट थिच्नुहोस्।',
  },
};

/**
 * A fixed spoken script in the user's language, falling back to English for
 * unknown codes or any script we haven't translated yet.
 *
 * @param {string} name - 'emergency' | 'review' | 'giveUp'
 * @param {string} langCode
 * @returns {string}
 */
export const voiceScript = (name, langCode) => {
  const set = VOICE_SCRIPTS[langCode] || VOICE_SCRIPTS.en;
  return set[name] || VOICE_SCRIPTS.en[name];
};
