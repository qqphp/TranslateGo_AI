const REQUEST_TIMEOUT_MS = 30_000;

export class ModelListError extends Error {}

export async function fetchModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(new URL("models", base), { headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal });
    if (!response.ok) throw new ModelListError(`Could not retrieve models (${response.status}). Check the Base URL and API key.`);
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new ModelListError("The model service returned invalid JSON."); }
    const rows = (payload as { data?: unknown }).data;
    if (!Array.isArray(rows)) throw new ModelListError("The model service returned an unsupported model list.");
    const models = rows.map((row) => typeof row === "string" ? row : row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string" ? (row as { id: string }).id : "").filter(Boolean);
    if (!models.length) throw new ModelListError("No models are available for this API key.");
    return [...new Set(models)].sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (controller.signal.aborted) throw new ModelListError("Retrieving models timed out after 30 seconds.");
    throw error;
  } finally { clearTimeout(timeout); }
}
