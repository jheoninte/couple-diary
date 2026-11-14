import {test} from 'node:test';import assert from 'node:assert/strict';import {withTimeout} from '../request-timeout.js';
test('stalled requests return a retryable error',async()=>{await assert.rejects(withTimeout(new Promise(()=>{}),5),{code:'auth/request-timeout'});});
test('completed requests retain result and error',async()=>{assert.equal(await withTimeout(Promise.resolve('ok'),50),'ok');await assert.rejects(withTimeout(Promise.reject(Error('original')),50),/original/);});
