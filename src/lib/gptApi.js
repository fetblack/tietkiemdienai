export async function generateSmartAdvice(deviceList, roomType = 'phòng khách') {
  const OPENAI_API_KEY = ""; // 🔑 Thay bằng API key của bạn

  const prompt = `
Thiết bị nhận dạng được trong ${roomType} gồm:
${deviceList.map(d => `- ${d.label} (${(d.score * 100).toFixed(2)}%)`).join('\n')}

Hãy viết 3 gợi ý tiết kiệm điện cụ thể, đơn giản, thực tế, dễ hiểu bằng tiếng Việt.
  `;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300
    })
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  return data.choices[0].message.content.trim();
}
