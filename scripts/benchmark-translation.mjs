const apiKey = process.env.TRANSLATION_API_KEY;
if (!apiKey) throw new Error("Set TRANSLATION_API_KEY before running this benchmark.");

const baseUrl = (process.env.TRANSLATION_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const model = process.env.TRANSLATION_MODEL || "deepseek-v4-flash";
const sizes = (process.env.BENCHMARK_BATCH_SIZES || "1,10,25").split(",").map(Number).filter((value) => Number.isInteger(value) && value > 0);
const iterations = Math.max(1, Number(process.env.BENCHMARK_ITERATIONS || 1));

const percentile = (values, fraction) => values.toSorted((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * fraction))];

async function benchmarkBatch(count) {
  const nodes = Array.from({ length: count }, (_, index) => ({
    id: `node-${index}`,
    text: `This is performance test sentence number ${index} for a browser translation extension.`
  }));
  const messages = count === 1 ? [
    { role: "system", content: "Translate the text. Return only the translation, without quotes, labels, notes, or Markdown." },
    { role: "user", content: `Source: English\nTarget: Chinese\n\n${nodes[0].text}` }
  ] : [
    { role: "system", content: "You are a translation engine. Translate every item from the requested source language to the requested target language. Return only a valid JSON array. Each item must be exactly {\"id\": string, \"translation\": string}; preserve every supplied id exactly; provide plain translations only, with no explanations or Markdown." },
    { role: "user", content: `Source language: English\nTarget language: Chinese\nItems:\n${JSON.stringify(nodes)}` }
  ];
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, stream: false, thinking: { type: "disabled" }, messages })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Benchmark request failed (${response.status}).`);
  const output = body?.choices?.[0]?.message?.content;
  if (typeof output !== "string" || !output.trim()) throw new Error("Benchmark received an empty response.");
  if (count > 1 && JSON.parse(output).length !== count) throw new Error(`Benchmark received an incomplete ${count}-item batch.`);
  return performance.now() - startedAt;
}

const report = [];
for (const count of sizes) {
  const samples = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) samples.push(await benchmarkBatch(count));
  report.push({
    count,
    samples: samples.length,
    p50Ms: Math.round(percentile(samples, 0.5)),
    p95Ms: Math.round(percentile(samples, 0.95)),
    segmentsPerSecond: Number((count / (percentile(samples, 0.5) / 1_000)).toFixed(2))
  });
}
console.table(report);
