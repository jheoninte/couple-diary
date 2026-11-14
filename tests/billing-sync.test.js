import {test} from 'node:test';import assert from 'node:assert/strict';
import {syncTransactions} from '../billing-sync.js';
test('foreign transaction cannot block valid restore or account refresh',async()=>{const seen=[];const failures=await syncTransactions([{signedTransaction:'foreign'},{signedTransaction:'own'}],async jws=>{if(jws==='foreign')throw Error('account mismatch');seen.push(jws);},async()=>seen.push('refresh'));assert.deepEqual(seen,['own','refresh']);assert.equal(failures.length,1);});
