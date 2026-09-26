import {api} from './api-client.js';
const clone=x=>structuredClone(x||{});
export const SyncManager={
 async listAccounts(){const s=await this.pull();return s?[{id:s.payload?.accountId||'main',name:s.payload?.accountMeta?.name||'Main Account',type:s.payload?.accountMeta?.type||'FUNDED',updatedAt:s.updatedAt}]:[{id:'main',name:'Main Account',type:'FUNDED'}]},
 async ensureDefaultAccount(){return {id:'main',name:'Main Account',type:'FUNDED'}},
 async pull(){return api('/api/state').then(r=>r.state?{payload:r.state,clientModifiedAt:r.clientModifiedAt,version:r.version,updatedAt:r.updatedAt}:null)},
 async push(_user,state,_accountId='main',opts={}){const payload=clone(state);payload.sync=payload.sync||{};payload.sync.modifiedAt=Number(payload.sync.modifiedAt)||Date.now();return api('/api/state',{method:'PUT',body:JSON.stringify({state:payload,clientModifiedAt:payload.sync.modifiedAt,version:Number(opts.version||state.sync?.version||0)})})},
 async deleteAllUserData(){return api('/api/account',{method:'DELETE'})},
 async exportPersonalData(){const r=await this.pull();return {product:'XE3AGLE',exportedAt:new Date().toISOString(),state:r?.payload||null}},
 async listDevices(){return [{id:localStorage.getItem('xe3agle_device_id')||'current',name:'Current browser',platform:navigator.platform||'Browser',lastSeenAt:new Date().toISOString()}]},
 async registerDevice(){return true}, async revokeDevice(){return true}, async submitFeedback(){return {ok:true}}
};
