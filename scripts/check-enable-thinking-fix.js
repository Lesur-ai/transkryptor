const assert = require('assert/strict');

const {
    buildChatCompletionPayload,
    isThinkingModel,
    safeErrorDetails,
} = require('../src/server/server');

const messages = [{ role: 'user', content: 'Bonjour, dis-moi juste ok.' }];

function buildPayload(model, options = {}) {
    return buildChatCompletionPayload({
        model,
        messages,
        maxTokens: options.maxTokens || 100,
        stream: Boolean(options.stream),
    });
}

const mistralPayload = buildPayload('mistral-small4:119b');
assert.equal(isThinkingModel('mistral-small4:119b'), false);
assert.equal(Object.hasOwn(mistralPayload, 'enable_thinking'), false);
assert.deepEqual(mistralPayload, {
    model: 'mistral-small4:119b',
    messages,
    max_tokens: 100,
});

const gemmaPayload = buildPayload('gemma4:31b');
assert.equal(isThinkingModel('gemma4:31b'), false);
assert.equal(Object.hasOwn(gemmaPayload, 'enable_thinking'), false);

const qwenPayload = buildPayload('qwen3.6:35b-a3b');
assert.equal(isThinkingModel('qwen3.6:35b-a3b'), true);
assert.equal(qwenPayload.enable_thinking, false);

// qwen3.8:27b pense par défaut : sans ce flag, la sortie utile peut n'arriver que dans message.reasoning.
const qwen38Payload = buildPayload('qwen3.8:27b');
assert.equal(isThinkingModel('qwen3.8:27b'), true);
assert.equal(qwen38Payload.enable_thinking, false);

const qwenUppercasePayload = buildPayload('QWEN3:235B');
assert.equal(isThinkingModel('QWEN3:235B'), true);
assert.equal(qwenUppercasePayload.enable_thinking, false);

const streamingPayload = buildPayload('mistral-small4:119b', { stream: true, maxTokens: 16384 });
assert.equal(streamingPayload.stream, true);
assert.equal(streamingPayload.max_tokens, 16384);
assert.equal(Object.hasOwn(streamingPayload, 'enable_thinking'), false);

const circular = { error: { message: 'chat_template is not supported for Mistral tokenizers.' } };
circular.self = circular;
const details = safeErrorDetails({ response: { data: circular }, message: 'Request failed with status code 400' });
assert.equal(details, '[object Object]');

assert.equal(safeErrorDetails({ message: 'plain failure' }), 'plain failure');

console.log('enable_thinking payload regression checks passed');
