// Does not cancel a server commit; callers must never treat timeout as proof of failure.
export async function withTimeout(request, milliseconds=25000){
 let timer;
 try{return await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>{const error=Error('Request timed out');error.code='auth/request-timeout';reject(error);},milliseconds);})]);}
 finally{clearTimeout(timer);}
}
