import { FIRST_BATCH_NODES, MAX_CHARACTERS_PER_REQUEST, MAX_REQUESTS_PER_PAGE_TASK, NODES_PER_REQUEST } from "./constants";
import type { PageNode } from "./types";

export interface TranslationBatchPlan {
  batches: PageNode[][];
  accepted: PageNode[];
  overflow: PageNode[];
}

/**
 * Plans provider calls by both item count and prompt size. The same planner is
 * used before a page task is sent and again in the background worker, so the
 * displayed request count and the actual request count cannot drift apart.
 */
export function planTranslationBatches(
  nodes: PageNode[],
  maxRequests = MAX_REQUESTS_PER_PAGE_TASK
): TranslationBatchPlan {
  const batches: PageNode[][] = [];
  let current: PageNode[] = [];
  let currentCharacters = 0;
  let acceptedCount = 0;

  const flush = () => {
    if (!current.length || batches.length >= maxRequests) return;
    batches.push(current);
    acceptedCount += current.length;
    current = [];
    currentCharacters = 0;
  };

  for (const node of nodes) {
    const nodeLimit = batches.length === 0 ? FIRST_BATCH_NODES : NODES_PER_REQUEST;
    const exceedsNodeLimit = current.length >= nodeLimit;
    const exceedsCharacterLimit = current.length > 0 && currentCharacters + node.text.length > MAX_CHARACTERS_PER_REQUEST;
    if (exceedsNodeLimit || exceedsCharacterLimit) flush();
    if (batches.length >= maxRequests) break;
    current.push(node);
    currentCharacters += node.text.length;
  }
  flush();

  return {
    batches,
    accepted: nodes.slice(0, acceptedCount),
    overflow: nodes.slice(acceptedCount)
  };
}
