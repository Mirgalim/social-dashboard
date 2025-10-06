// backend/utils/query.js
// Acronym / ambiguity guard + Mongolian bias helpers

export function expandForMongolia(raw) {
    const q = (raw || "").trim();
  
    // Монголд түгээмэл ашиглагддаг товчилсон үгүүдийг өргөтгөж өгнө
    const special = [
      {
        test: /^mcs$/i,
        expand: '"М-Си-Эс" OR "М-Си-Эс групп" OR "MCS Group Mongolia" OR "MCS Holding" OR "MCS Групп"'
      },
      {
        test: /^xacbank$/i,
        expand: '"ХААН банк" OR "Khan Bank"'
      }
    ];
    for (const s of special) {
      if (s.test.test(q)) return s.expand;
    }
  
    return q;
  }
  
  // Латин бус (кирилл) эсвэл Монгол түгээмэл үг агуулсан эсэхийг шалгах
  const MONGOL_COMMON = ["монгол","улса","улсын","хөгжил","цахилгаан","компан","бан","групп","хк","уул","хот","цацраг","мэдээлэл"];
  
  export function likelyMongolian(text = "") {
    const t = (text || "").toLowerCase();
    if (/[\u0400-\u04FF]/.test(t)) return true; // кирилл байна
    return MONGOL_COMMON.some(w => t.includes(w));
  }
  
  // YouTube дээр гардаг Бразил MCs spam багасгах түлхүүр
  export const NEGATIVE_YT = "-funk -rap -clip -music -mc -mcs -dj -letra -lyric -trap -podcast";
  