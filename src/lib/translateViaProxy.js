// Gửi danh sách nhãn cần dịch đến proxy GPT
export async function translateLabelsViaGPT(labels) {
  const res = await fetch('http://localhost:3001/translate-gpt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels })
  });

  const data = await res.json();
  return data.result || labels;
}
