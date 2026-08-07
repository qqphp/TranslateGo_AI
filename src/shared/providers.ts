export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
}

// Providers exposing the OpenAI-compatible chat-completions and models APIs.
// Keep "custom" so any compatible gateway can still be configured manually.
export const MODEL_PROVIDERS: ModelProvider[] = [
  { id: "custom", name: "Custom OpenAI-compatible API", baseUrl: "" },
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { id: "qwen", name: "Alibaba Cloud Qwen (China)", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { id: "qwen-intl", name: "Alibaba Cloud Qwen (International)", baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" },
  { id: "zhipu", name: "Zhipu AI / GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  { id: "moonshot", name: "Kimi / 月之暗面", baseUrl: "https://api.moonshot.cn/v1" },
  { id: "minimax", name: "MiniMax", baseUrl: "https://api.minimax.io/v1" },
  { id: "iflytek-spark", name: "iFlytek Spark / 讯飞星火", baseUrl: "https://spark-api-open.xf-yun.com/v1" },
  { id: "baichuan", name: "Baichuan / 百川智能", baseUrl: "https://api.baichuan-ai.com/v1" },
  { id: "01ai", name: "01.AI / 零一万物 Yi", baseUrl: "https://api.01.ai/v1" },
  { id: "stepfun", name: "StepFun / 阶跃星辰", baseUrl: "https://api.stepfun.com/v1" },
  { id: "sensenova", name: "SenseNova / 商汤日日新", baseUrl: "https://api.sensenova.cn/compatible-mode/v1" },
  { id: "baidu", name: "Baidu Qianfan", baseUrl: "https://qianfan.baidubce.com/v2" },
  { id: "tencent", name: "Tencent Hunyuan", baseUrl: "https://api.hunyuan.cloud.tencent.com/v1" },
  { id: "tencent-tokenhub", name: "Tencent Hunyuan / TokenHub", baseUrl: "https://tokenhub.tencentmaas.com/v1" },
  { id: "siliconflow", name: "SiliconFlow", baseUrl: "https://api.siliconflow.cn/v1" },
  { id: "volcengine", name: "Volcengine Ark", baseUrl: "https://ark.cn-beijing.volces.com/api/v3" },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  { id: "together", name: "Together AI", baseUrl: "https://api.together.xyz/v1" },
  { id: "mistral", name: "Mistral AI", baseUrl: "https://api.mistral.ai/v1" },
  { id: "cerebras", name: "Cerebras", baseUrl: "https://api.cerebras.ai/v1" },
  { id: "nvidia", name: "NVIDIA NIM", baseUrl: "https://integrate.api.nvidia.com/v1" },
  { id: "xai", name: "xAI / Grok", baseUrl: "https://api.x.ai/v1" },
  { id: "perplexity", name: "Perplexity", baseUrl: "https://api.perplexity.ai" },
  { id: "github", name: "GitHub Models", baseUrl: "https://models.inference.ai.azure.com" },
  { id: "ollama", name: "Ollama (local)", baseUrl: "http://localhost:11434/v1" },
  { id: "lm-studio", name: "LM Studio (local)", baseUrl: "http://localhost:1234/v1" }
];

export function providerForBaseUrl(baseUrl: string): string {
  return MODEL_PROVIDERS.find((provider) => provider.baseUrl === baseUrl)?.id ?? "custom";
}
