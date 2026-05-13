import assert from 'node:assert/strict';
import { extractJSONArray } from './src/controllers/inspirationController.js';

function makeProposal(title) {
  return {
    title,
    tags: ['#广州记忆', '#城市文化'],
    styleTags: ['新闻快讯'],
    paceTag: '快',
    scenarioTags: ['常规报道'],
    isRecommended: true,
    recommendationReason: '适合快速发布',
    reasoning: '按新闻事实展开',
    visualStyle: '纪实手持，配合字幕条',
    bgmStyle: '轻新闻背景乐',
    newsFacts: {
      headline: title,
      who: '未提及',
      what: '未提及',
      when: '未提及',
      where: '未提及',
      why: '未提及',
      keyQuotes: [],
      mustRetain: []
    },
    roughScript: {
      scenes: [
        {
          type: 'ai_generated',
          description: '城市街景与资料画面',
          narration: '这里承载着广州记忆。',
          duration: 5,
          visualStyle: '新闻纪实',
          sourceRef: '基于主题假设',
          isAISupplemented: true
        }
      ]
    }
  };
}

const singleFencedObject = `由于用户仅提供“广州记忆”作为新闻稿标题，无具体内容，以下方案基于主题假设。

### 方案一（事件经过型）
\`\`\`json
${JSON.stringify(makeProposal('广州记忆'))}
\`\`\`
`;

const parsedSingle = extractJSONArray(singleFencedObject);
assert.equal(parsedSingle.length, 1);
assert.equal(parsedSingle[0].title, '广州记忆');

const multipleFencedObjects = `
### 方案一
\`\`\`json
${JSON.stringify(makeProposal('广州记忆 A'))}
\`\`\`

### 方案二
\`\`\`json
${JSON.stringify(makeProposal('广州记忆 B'))}
\`\`\`
`;

const parsedMultiple = extractJSONArray(multipleFencedObjects);
assert.equal(parsedMultiple.length, 2);
assert.deepEqual(parsedMultiple.map((proposal) => proposal.title), ['广州记忆 A', '广州记忆 B']);

const arrayWithExtraText = `以下是方案：\n${JSON.stringify([makeProposal('数组方案')])}\n请查收。`;
const parsedArray = extractJSONArray(arrayWithExtraText);
assert.equal(parsedArray.length, 1);
assert.equal(parsedArray[0].title, '数组方案');

const originalConsoleError = console.error;
console.error = () => {};
try {
  assert.throws(
    () => extractJSONArray('["#广州记忆", "#城市文化"]'),
    /JSON解析失败/
  );
} finally {
  console.error = originalConsoleError;
}

console.log('inspiration JSON parser tests passed');
