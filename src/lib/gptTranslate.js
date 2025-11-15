export async function translateLabelsViaGPT(labels) {
  const prompt = `Dịch danh sách sau sang tiếng Việt, chỉ trả về chuỗi tiếng Việt cách nhau bằng dấu |:\n\n${labels.join(', ')}`;
  const response = await fetch('https://api.gptforfree.net/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'Bạn là một trợ lý AI giỏi dịch tiếng Anh sang tiếng Việt.' },
        { role: 'user', content: prompt }
      ],
      model: 'gpt-3.5-turbo',
    }),
  });

  const data = await response.json();
  const viList = data.choices?.[0]?.message?.content?.split('|').map(s => s.trim());
  return viList || labels; // fallback
}
